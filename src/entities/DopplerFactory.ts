import {
  type Address,
  type Hex,
  type Hash,
  type PublicClient,
  type WalletClient,
  type Account,
  encodeAbiParameters,
  encodePacked,
  keccak256,
  getAddress,
  decodeEventLog,
  decodeAbiParameters,
  toHex,
} from 'viem';
import type {
  CreateStaticAuctionParams,
  CreateDynamicAuctionParams,
  CreateOpeningAuctionParams,
  CreateMulticurveParams,
  MigrationConfig,
  SupportedPublicClient,
  TokenConfig,
  Doppler404TokenConfig,
  StandardTokenConfig,
  SupportedChainId,
  CreateParams,
  MulticurveBundleExactInResult,
  MulticurveBundleExactOutResult,
  V4PoolKey,
  OpeningAuctionState,
  OpeningAuctionCreateResult,
  OpeningAuctionCompleteResult,
} from '../types';
import type { ModuleAddressOverrides } from '../types';
import { CHAIN_IDS, getAddresses } from '../addresses';
import { zeroAddress } from 'viem';
import {
  ZERO_ADDRESS,
  WAD,
  DEFAULT_PD_SLUGS,
  FLAG_MASK,
  DOPPLER_FLAGS,
  OPENING_AUCTION_FLAGS,
  DEFAULT_V3_NUM_POSITIONS,
  DEFAULT_V3_YEARLY_MINT_RATE,
  DEFAULT_V3_MAX_SHARE_TO_BE_SOLD,
  DEFAULT_V4_YEARLY_MINT_RATE,
  DEFAULT_V3_INITIAL_VOTING_DELAY,
  DEFAULT_V3_INITIAL_VOTING_PERIOD,
  DEFAULT_V3_INITIAL_PROPOSAL_THRESHOLD,
  DEFAULT_V4_INITIAL_VOTING_DELAY,
  DEFAULT_V4_INITIAL_VOTING_PERIOD,
  DEFAULT_V4_INITIAL_PROPOSAL_THRESHOLD,
  DEFAULT_CREATE_GAS_LIMIT,
  TICK_SPACINGS,
  DOPPLER_MAX_TICK_SPACING,
} from '../constants';
import {
  computeOptimalGamma,
  MIN_TICK,
  MAX_TICK,
  isToken0Expected,
} from '../utils';
import {
  airlockAbi,
  bundlerAbi,
  DERC20Bytecode,
  DERC2080Bytecode,
  DopplerBytecode,
  DopplerDN404Bytecode,
  OpeningAuctionBytecode,
  v4MulticurveInitializerAbi,
  openingAuctionAbi,
  openingAuctionInitializerAbi,
} from '../abis';

// Type definition for the custom migration encoder function
export type MigrationEncoder = (config: MigrationConfig) => Hex;

const MAX_UINT128 = (1n << 128n) - 1n;
const ONE_MILLION = 1_000_000n;
const OPENING_AUCTION_PHASE_SETTLED = 3;
const OPENING_AUCTION_STATUS_ACTIVE = 1;
// Auto-mined completion can race with on-chain state changes; keep retries bounded.
const MAX_COMPLETION_ATTEMPTS = 3;

const erc20BalanceOfAbi = [
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ type: 'address', name: 'account' }],
    outputs: [{ type: 'uint256', name: '' }],
    stateMutability: 'view',
  },
] as const;

// TokenFactory80 has the same deterministic CREATE2 address across all chains
const TOKEN_FACTORY_80_ADDRESS =
  '0xf0b5141dd9096254b2ca624dff26024f46087229' as const;

export class DopplerFactory<C extends SupportedChainId = SupportedChainId> {
  private publicClient: SupportedPublicClient;
  private walletClient?: WalletClient;
  private chainId: C;
  private customMigrationEncoder?: MigrationEncoder;

  private multicurveBundlerSupport = new Map<Address, boolean>();

  constructor(
    publicClient: SupportedPublicClient,
    walletClient: WalletClient | undefined,
    chainId: C,
  ) {
    this.publicClient = publicClient;
    this.walletClient = walletClient;
    this.chainId = chainId;
  }

  /**
   * Set a custom migration data encoder function
   * @param encoder Custom function to encode migration data
   * @returns The factory instance for method chaining
   */
  withCustomMigrationEncoder(encoder: MigrationEncoder): this {
    this.customMigrationEncoder = encoder;
    return this;
  }

  async encodeCreateStaticAuctionParams(
    params: CreateStaticAuctionParams<C>,
  ): Promise<CreateParams> {
    // Validate parameters
    this.validateStaticAuctionParams(params);

    const addresses = getAddresses(this.chainId);

    // Check if beneficiaries are provided - this determines which initializer to use
    const hasBeneficiaries =
      params.pool.beneficiaries && params.pool.beneficiaries.length > 0;

    // 1. Encode pool initializer data
    // Standard V3 initializer expects InitData struct WITHOUT beneficiaries (5 fields)
    // Lockable V3 initializer expects InitData struct WITH beneficiaries (6 fields)
    let poolInitializerData: Hex;

    if (hasBeneficiaries) {
      // Sort beneficiaries by address (ascending) as required by the contract
      const sortedBeneficiaries = params.pool
        .beneficiaries!.slice()
        .sort((a, b) => {
          const aAddr = a.beneficiary.toLowerCase();
          const bAddr = b.beneficiary.toLowerCase();
          return aAddr < bAddr ? -1 : aAddr > bAddr ? 1 : 0;
        });

      // Lockable V3 initializer encoding (6 fields including beneficiaries)
      poolInitializerData = encodeAbiParameters(
        [
          {
            type: 'tuple',
            components: [
              { type: 'uint24', name: 'fee' },
              { type: 'int24', name: 'tickLower' },
              { type: 'int24', name: 'tickUpper' },
              { type: 'uint16', name: 'numPositions' },
              { type: 'uint256', name: 'maxShareToBeSold' },
              {
                type: 'tuple[]',
                name: 'beneficiaries',
                components: [
                  { type: 'address', name: 'beneficiary' },
                  { type: 'uint96', name: 'shares' },
                ],
              },
            ],
          },
        ],
        [
          {
            fee: params.pool.fee,
            tickLower: params.pool.startTick,
            tickUpper: params.pool.endTick,
            numPositions: params.pool.numPositions ?? DEFAULT_V3_NUM_POSITIONS,
            maxShareToBeSold:
              params.pool.maxShareToBeSold ?? DEFAULT_V3_MAX_SHARE_TO_BE_SOLD,
            beneficiaries: sortedBeneficiaries.map((b) => ({
              beneficiary: b.beneficiary,
              shares: b.shares,
            })),
          },
        ],
      );
    } else {
      // Standard V3 initializer encoding (5 fields, no beneficiaries)
      poolInitializerData = encodeAbiParameters(
        [
          {
            type: 'tuple',
            components: [
              { type: 'uint24', name: 'fee' },
              { type: 'int24', name: 'tickLower' },
              { type: 'int24', name: 'tickUpper' },
              { type: 'uint16', name: 'numPositions' },
              { type: 'uint256', name: 'maxShareToBeSold' },
            ],
          },
        ],
        [
          {
            fee: params.pool.fee,
            tickLower: params.pool.startTick,
            tickUpper: params.pool.endTick,
            numPositions: params.pool.numPositions ?? DEFAULT_V3_NUM_POSITIONS,
            maxShareToBeSold:
              params.pool.maxShareToBeSold ?? DEFAULT_V3_MAX_SHARE_TO_BE_SOLD,
          },
        ],
      );
    }

    // 2. Encode migration data based on MigrationConfig
    const liquidityMigratorData = this.encodeMigrationData(params.migration);

    // 3. Encode token parameters (standard vs Doppler404)
    let tokenFactoryData: Hex;
    if (this.isDoppler404Token(params.token)) {
      const token404 = params.token;
      // Doppler404 expects: name, symbol, baseURI, unit
      const baseURI = token404.baseURI;
      const unit = token404.unit !== undefined ? BigInt(token404.unit) : 1000n;
      tokenFactoryData = encodeAbiParameters(
        [
          { type: 'string' },
          { type: 'string' },
          { type: 'string' },
          { type: 'uint256' },
        ],
        [params.token.name, params.token.symbol, baseURI, unit],
      );
    } else {
      const tokenStd = params.token as StandardTokenConfig;
      const vestingDuration = params.vesting?.duration ?? BigInt(0);
      const yearlyMintRate =
        tokenStd.yearlyMintRate ?? DEFAULT_V4_YEARLY_MINT_RATE;

      // Handle vesting recipients and amounts
      let vestingRecipients: Address[] = [];
      let vestingAmounts: bigint[] = [];

      if (params.vesting) {
        if (params.vesting.recipients && params.vesting.amounts) {
          // Use provided recipients and amounts
          vestingRecipients = params.vesting.recipients;
          vestingAmounts = params.vesting.amounts;
        } else {
          // Default: vest all non-sold tokens to userAddress
          vestingRecipients = [params.userAddress];
          vestingAmounts = [
            params.sale.initialSupply - params.sale.numTokensToSell,
          ];
        }
      }

      tokenFactoryData = encodeAbiParameters(
        [
          { type: 'string' },
          { type: 'string' },
          { type: 'uint256' },
          { type: 'uint256' },
          { type: 'address[]' },
          { type: 'uint256[]' },
          { type: 'string' },
        ],
        [
          tokenStd.name,
          tokenStd.symbol,
          yearlyMintRate,
          BigInt(vestingDuration),
          vestingRecipients,
          vestingAmounts,
          tokenStd.tokenURI,
        ],
      );
    }

    // 4. Encode governance factory data
    const governanceFactoryData: Hex = (() => {
      if (params.governance.type === 'noOp') {
        return '0x' as Hex;
      }
      if (params.governance.type === 'launchpad') {
        return encodeAbiParameters(
          [{ type: 'address' }],
          [params.governance.multisig],
        );
      }
      return encodeAbiParameters(
        [
          { type: 'string' },
          { type: 'uint48' },
          { type: 'uint32' },
          { type: 'uint256' },
        ],
        [
          params.token.name,
          params.governance.type === 'custom'
            ? params.governance.initialVotingDelay
            : DEFAULT_V3_INITIAL_VOTING_DELAY,
          params.governance.type === 'custom'
            ? params.governance.initialVotingPeriod
            : DEFAULT_V3_INITIAL_VOTING_PERIOD,
          params.governance.type === 'custom'
            ? params.governance.initialProposalThreshold
            : DEFAULT_V3_INITIAL_PROPOSAL_THRESHOLD,
        ],
      );
    })();

    // 4.1 Choose governance factory
    const governanceFactoryAddress: Address = (() => {
      if (params.governance.type === 'noOp') {
        const resolved =
          params.modules?.governanceFactory ??
          addresses.noOpGovernanceFactory ??
          ZERO_ADDRESS;
        if (!resolved || resolved === ZERO_ADDRESS) {
          throw new Error(
            'No-op governance requested, but no-op governanceFactory is not configured on this chain. Provide a governanceFactory override or use a supported chain.',
          );
        }
        return resolved;
      }
      if (params.governance.type === 'launchpad') {
        const resolved =
          params.modules?.governanceFactory ??
          addresses.launchpadGovernanceFactory ??
          ZERO_ADDRESS;
        if (!resolved || resolved === ZERO_ADDRESS) {
          throw new Error(
            'Launchpad governance requested, but launchpadGovernanceFactory is not configured on this chain. Provide a governanceFactory override or use a supported chain.',
          );
        }
        return resolved;
      }
      const resolved =
        params.modules?.governanceFactory ?? addresses.governanceFactory;
      if (!resolved || resolved === ZERO_ADDRESS) {
        throw new Error(
          'Standard governance requested but governanceFactory is not deployed on this chain.',
        );
      }
      return resolved;
    })();

    // 5. Generate a unique salt
    // Resolve token factory with override priority
    const resolvedTokenFactory: Address | undefined =
      params.modules?.tokenFactory ??
      (this.isDoppler404Token(params.token)
        ? (addresses.doppler404Factory as Address | undefined)
        : addresses.tokenFactory);

    if (!resolvedTokenFactory || resolvedTokenFactory === ZERO_ADDRESS) {
      throw new Error(
        'Token factory address not configured. Provide an explicit address via builder.withTokenFactory(...) or ensure chain config includes a valid factory.',
      );
    }

    // Build the base CreateParams for the V3-style ABI; salt will be mined below
    const baseCreateParams = {
      initialSupply: params.sale.initialSupply,
      numTokensToSell: params.sale.numTokensToSell,
      numeraire: params.sale.numeraire,
      tokenFactory: resolvedTokenFactory,
      tokenFactoryData: tokenFactoryData,
      governanceFactory: governanceFactoryAddress,
      governanceFactoryData: governanceFactoryData,
      poolInitializer: (() => {
        if (hasBeneficiaries) {
          const lockableInitializer =
            params.modules?.lockableV3Initializer ??
            addresses.lockableV3Initializer;
          if (!lockableInitializer) {
            throw new Error(
              'Lockable V3 initializer address not configured on this chain. Required when using beneficiaries.',
            );
          }
          return lockableInitializer;
        }
        return params.modules?.v3Initializer ?? addresses.v3Initializer;
      })(),
      poolInitializerData: poolInitializerData,
      liquidityMigrator: this.getMigratorAddress(
        params.migration,
        params.modules,
      ),
      liquidityMigratorData: liquidityMigratorData,
      integrator: params.integrator ?? ZERO_ADDRESS,
    };

    const minedCreateParams = await this.mineTokenOrder({
      params,
      baseCreateParams,
      addresses,
    });

    return minedCreateParams;
  }

  /**
   * Simulate a static auction creation and return predicted addresses.
   * Useful for pre-buy flows (bundle) to know the token/pool before sending.
   */
  async simulateCreateStaticAuction(
    params: CreateStaticAuctionParams<C>,
  ): Promise<{
    createParams: CreateParams;
    asset: Address;
    pool: Address;
    gasEstimate?: bigint;
    /** Execute the create with the same params used in simulation (guarantees address match) */
    execute: () => Promise<{
      poolAddress: Address;
      tokenAddress: Address;
      transactionHash: string;
    }>;
  }> {
    const createParams = await this.encodeCreateStaticAuctionParams(params);
    const addresses = getAddresses(this.chainId);

    const airlockAddress = params.modules?.airlock ?? addresses.airlock;
    const { request, result } = await (
      this.publicClient as PublicClient
    ).simulateContract({
      address: airlockAddress,
      abi: airlockAbi,
      functionName: 'create',
      args: [{ ...createParams }],
      account: this.walletClient?.account,
    });
    const simResult = result as readonly unknown[] | undefined;
    const gasEstimate = await this.resolveCreateGasEstimate({
      request,
      address: airlockAddress,
      createParams,
      account: this.walletClient?.account ?? params.userAddress,
    });

    if (!simResult || !Array.isArray(simResult) || simResult.length < 2) {
      throw new Error('Failed to simulate static auction create');
    }

    return {
      createParams,
      asset: simResult[0] as Address,
      pool: simResult[1] as Address,
      gasEstimate,
      execute: () =>
        this.createStaticAuction(params, { _createParams: createParams }),
    };
  }

  /**
   * Create a new static auction (using Uniswap V3 for initial liquidity)
   * @param params Configuration for the static auction
   * @returns The address of the created pool and token
   */
  async createStaticAuction(
    params: CreateStaticAuctionParams<C>,
    options?: { _createParams?: CreateParams },
  ): Promise<{
    poolAddress: Address;
    tokenAddress: Address;
    transactionHash: string;
  }> {
    // Use provided createParams (from simulate) or auto-simulate to get consistent params
    const createParams =
      options?._createParams ??
      (await this.simulateCreateStaticAuction(params)).createParams;

    const addresses = getAddresses(this.chainId);

    // Call the airlock contract to create the pool
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations');
    }

    const airlockAddress = params.modules?.airlock ?? addresses.airlock;
    const { request, result } = await (
      this.publicClient as PublicClient
    ).simulateContract({
      address: airlockAddress,
      abi: airlockAbi,
      functionName: 'create',
      args: [{ ...createParams }],
      account: this.walletClient.account,
    });
    const simResult = result as readonly unknown[] | undefined;

    const gasEstimate = await this.resolveCreateGasEstimate({
      request,
      address: airlockAddress,
      createParams,
      account: this.walletClient.account,
    });
    const gasOverride = params.gas ?? gasEstimate ?? DEFAULT_CREATE_GAS_LIMIT;
    const hash = await this.walletClient.writeContract({
      ...request,
      gas: gasOverride,
    });

    // Wait for transaction and get the receipt
    const receipt = await (
      this.publicClient as PublicClient
    ).waitForTransactionReceipt({ hash, confirmations: 2 });

    // Always extract actual addresses from event logs (source of truth)
    const actualAddresses = this.extractAddressesFromCreateEvent(receipt);

    if (!actualAddresses) {
      throw new Error(
        'Failed to extract addresses from Create event in transaction logs',
      );
    }

    // Warn if simulation predicted different addresses (helps debugging state divergence)
    if (simResult && Array.isArray(simResult) && simResult.length >= 2) {
      const simulatedToken = simResult[0] as Address;
      const simulatedPool = simResult[1] as Address;
      if (
        simulatedToken.toLowerCase() !==
        actualAddresses.tokenAddress.toLowerCase()
      ) {
        console.warn(
          `[DopplerSDK] Simulation predicted token ${simulatedToken} but actual is ${actualAddresses.tokenAddress}. ` +
            `This may indicate state divergence between simulation and execution.`,
        );
      }
      if (
        simulatedPool.toLowerCase() !==
        actualAddresses.poolOrHookAddress.toLowerCase()
      ) {
        console.warn(
          `[DopplerSDK] Simulation predicted pool ${simulatedPool} but actual is ${actualAddresses.poolOrHookAddress}. ` +
            `This may indicate state divergence between simulation and execution.`,
        );
      }
    }

    return {
      tokenAddress: actualAddresses.tokenAddress,
      poolAddress: actualAddresses.poolOrHookAddress,
      transactionHash: hash,
    };
  }

  /**
   * Generate a random salt based on user address
   */
  private generateRandomSalt(account: Address): Hex {
    // Use crypto.getRandomValues for secure random generation
    const array = new Uint8Array(32);

    // Try to use crypto API if available (Node.js or browser)
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(array);
    } else {
      // Fallback: use timestamp and account for deterministic generation
      const timestamp = Date.now();
      const timestampBytes = new Uint8Array(8);
      for (let i = 0; i < 8; i++) {
        timestampBytes[i] = (timestamp >> (i * 8)) & 0xff;
      }

      // Fill array with timestamp and account-based entropy
      for (let i = 0; i < 32; i++) {
        if (i < 8) {
          array[i] = timestampBytes[i];
        } else {
          array[i] = i;
        }
      }
    }

    // XOR with address bytes for additional entropy
    if (account) {
      const addressBytes = account.slice(2).padStart(40, '0');
      for (let i = 0; i < 20; i++) {
        const addressByte = parseInt(
          addressBytes.slice(i * 2, (i + 1) * 2),
          16,
        );
        array[i] ^= addressByte;
      }
    }

    return `0x${Array.from(array)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')}` as Hex;
  }

  /**
   * Extract actual deployed addresses from Create event logs.
   * This is the source of truth - what actually deployed on-chain.
   * @param receipt Transaction receipt containing logs
   * @returns Token and pool/hook addresses from the Create event, or null if not found
   */
  private extractAddressesFromCreateEvent(receipt: {
    logs: readonly unknown[];
  }): { tokenAddress: Address; poolOrHookAddress: Address } | null {
    const createEvent = receipt.logs.find((log: unknown) => {
      try {
        const decoded = decodeEventLog({
          abi: airlockAbi,
          data: (log as { data: Hex }).data,
          topics: (log as { topics: readonly `0x${string}`[] }).topics as [
            `0x${string}`,
            ...`0x${string}`[],
          ],
        });
        return decoded.eventName === 'Create';
      } catch {
        return false;
      }
    });

    if (!createEvent) return null;

    const decoded = decodeEventLog({
      abi: airlockAbi,
      data: (createEvent as { data: Hex }).data,
      topics: (createEvent as { topics: readonly `0x${string}`[] }).topics as [
        `0x${string}`,
        ...`0x${string}`[],
      ],
    });

    if (decoded.eventName === 'Create') {
      const args = decoded.args as { asset: Address; poolOrHook: Address };
      return { tokenAddress: args.asset, poolOrHookAddress: args.poolOrHook };
    }

    return null;
  }

  /**
   * Iteratively mine a salt that ensures the newly created token sorts after the numeraire.
   * This mirrors the legacy SDK behaviour so tick configuration can assume the numeraire is token0.
   */
  private async mineTokenOrder(args: {
    params: CreateStaticAuctionParams<C>;
    baseCreateParams: Omit<CreateParams, 'salt'>;
    addresses: ReturnType<typeof getAddresses>;
  }): Promise<CreateParams> {
    const { params, baseCreateParams, addresses } = args;

    const airlockAddress = params.modules?.airlock ?? addresses.airlock;
    if (!airlockAddress || airlockAddress === ZERO_ADDRESS) {
      throw new Error(
        'Airlock address not configured. Provide an explicit address via modules.airlock or ensure chain config includes a valid airlock.',
      );
    }

    const accountForSimulation =
      this.walletClient?.account ?? params.userAddress;
    const numeraireBigInt = BigInt(params.sale.numeraire);

    let attempt = 0n;
    const maxAttempts = 256n;
    let salt = this.generateRandomSalt(params.userAddress);

    while (attempt < maxAttempts) {
      const createParams = { ...baseCreateParams, salt } as CreateParams;

      const { result } = await (
        this.publicClient as PublicClient
      ).simulateContract({
        address: airlockAddress,
        abi: airlockAbi,
        functionName: 'create',
        args: [{ ...createParams }],
        account: accountForSimulation,
      });

      const simResult = result as readonly unknown[] | undefined;
      if (!simResult || !Array.isArray(simResult) || simResult.length < 2) {
        throw new Error(
          'Failed to simulate static auction create while mining token ordering',
        );
      }

      const tokenAddress = simResult[0] as Address;
      if (BigInt(tokenAddress) > numeraireBigInt) {
        return createParams;
      }

      attempt += 1n;
      const incrementedAccount = toHex(
        BigInt(params.userAddress) + attempt,
      ) as Address;
      salt = this.generateRandomSalt(incrementedAccount);
    }

    throw new Error(
      'Token mining exceeded iteration limit while trying to force token order. Try again or provide a different user address.',
    );
  }

  async encodeCreateDynamicAuctionParams(
    params: CreateDynamicAuctionParams<C>,
  ): Promise<{
    createParams: CreateParams;
    hookAddress: Address;
    tokenAddress: Address;
  }> {
    // Validate parameters
    this.validateDynamicAuctionParams(params);

    const addresses = getAddresses(this.chainId);

    // 1. Calculate gamma if not provided
    const gamma =
      params.auction.gamma ??
      computeOptimalGamma(
        params.auction.startTick,
        params.auction.endTick,
        params.auction.duration,
        params.auction.epochLength,
        params.pool.tickSpacing,
      );

    // 2. Prepare time parameters
    // Use provided block timestamp or fetch the latest
    let blockTimestamp: number;
    if (params.blockTimestamp !== undefined) {
      blockTimestamp = params.blockTimestamp;
    } else {
      const latestBlock = await (this.publicClient as PublicClient).getBlock({
        blockTag: 'latest',
      });
      blockTimestamp = Number(
        (latestBlock as { timestamp: bigint | number }).timestamp,
      );
    }

    // Use startTimeOffset if provided, otherwise default to 30 seconds
    const startTimeOffset = params.startTimeOffset ?? 30;
    const startTime = blockTimestamp + startTimeOffset;
    const endTime = blockTimestamp + params.auction.duration + startTimeOffset;

    // 3. Prepare hook initialization data
    const dopplerData = {
      minimumProceeds: params.auction.minProceeds,
      maximumProceeds: params.auction.maxProceeds,
      startingTime: BigInt(startTime),
      endingTime: BigInt(endTime),
      startingTick: params.auction.startTick,
      endingTick: params.auction.endTick,
      epochLength: BigInt(params.auction.epochLength),
      gamma,
      isToken0: false, // Will be determined during mining
      numPDSlugs: BigInt(params.auction.numPdSlugs ?? DEFAULT_PD_SLUGS),
      fee: params.pool.fee,
      tickSpacing: params.pool.tickSpacing,
    };

    // 4. Prepare token parameters (standard vs Doppler404)
    if (this.isDoppler404Token(params.token)) {
      if (
        !addresses.doppler404Factory ||
        addresses.doppler404Factory === ZERO_ADDRESS
      ) {
        throw new Error(
          'Doppler404 factory address not configured for this chain',
        );
      }
    }

    const vestingDuration = params.vesting?.duration ?? BigInt(0);
    const tokenFactoryData = this.isDoppler404Token(params.token)
      ? (() => {
          const t = params.token as Doppler404TokenConfig;
          return {
            name: t.name,
            symbol: t.symbol,
            baseURI: t.baseURI,
            unit: t.unit !== undefined ? BigInt(t.unit) : 1000n,
          };
        })()
      : (() => {
          const t = params.token as StandardTokenConfig;

          // Handle vesting recipients and amounts
          let vestingRecipients: Address[] = [];
          let vestingAmounts: bigint[] = [];

          if (params.vesting) {
            if (params.vesting.recipients && params.vesting.amounts) {
              // Use provided recipients and amounts
              vestingRecipients = params.vesting.recipients;
              vestingAmounts = params.vesting.amounts;
            } else {
              // Default: vest all non-sold tokens to userAddress
              vestingRecipients = [params.userAddress];
              vestingAmounts = [
                params.sale.initialSupply - params.sale.numTokensToSell,
              ];
            }
          }

          return {
            name: t.name,
            symbol: t.symbol,
            initialSupply: params.sale.initialSupply,
            airlock: addresses.airlock,
            yearlyMintRate: t.yearlyMintRate ?? DEFAULT_V4_YEARLY_MINT_RATE,
            vestingDuration: BigInt(vestingDuration),
            recipients: vestingRecipients,
            amounts: vestingAmounts,
            tokenURI: t.tokenURI,
          };
        })();

    // 5. Mine hook address with appropriate flags
    // Resolve token factory with override priority (works for both standard and doppler404 variants)
    const resolvedTokenFactoryDyn: Address | undefined =
      params.modules?.tokenFactory ??
      (this.isDoppler404Token(params.token)
        ? (addresses.doppler404Factory as Address | undefined)
        : addresses.tokenFactory);

    if (!resolvedTokenFactoryDyn || resolvedTokenFactoryDyn === ZERO_ADDRESS) {
      throw new Error(
        'Token factory address not configured. Provide an explicit address via builder.withTokenFactory(...) or ensure chain config includes a valid factory.',
      );
    }

    const [
      salt,
      hookAddress,
      tokenAddress,
      poolInitializerData,
      encodedTokenFactoryData,
    ] = this.mineHookAddress({
      airlock: params.modules?.airlock ?? addresses.airlock,
      poolManager: params.modules?.poolManager ?? addresses.poolManager,
      deployer: params.modules?.dopplerDeployer ?? addresses.dopplerDeployer,
      initialSupply: params.sale.initialSupply,
      numTokensToSell: params.sale.numTokensToSell,
      numeraire: params.sale.numeraire,
      tokenFactory: resolvedTokenFactoryDyn,
      tokenFactoryData: tokenFactoryData,
      poolInitializer: params.modules?.v4Initializer ?? addresses.v4Initializer,
      poolInitializerData: dopplerData,
      tokenVariant: this.isDoppler404Token(params.token)
        ? 'doppler404'
        : 'standard',
    });

    // 6. Encode migration data
    const liquidityMigratorData = this.encodeMigrationData(params.migration);

    // 7. Encode governance factory data
    const governanceFactoryData: Hex = (() => {
      if (params.governance.type === 'noOp') {
        return '0x' as Hex;
      }
      if (params.governance.type === 'launchpad') {
        return encodeAbiParameters(
          [{ type: 'address' }],
          [params.governance.multisig],
        );
      }
      return encodeAbiParameters(
        [
          { type: 'string' },
          { type: 'uint48' },
          { type: 'uint32' },
          { type: 'uint256' },
        ],
        [
          params.token.name,
          params.governance.type === 'custom'
            ? params.governance.initialVotingDelay
            : DEFAULT_V4_INITIAL_VOTING_DELAY,
          params.governance.type === 'custom'
            ? params.governance.initialVotingPeriod
            : DEFAULT_V4_INITIAL_VOTING_PERIOD,
          params.governance.type === 'custom'
            ? params.governance.initialProposalThreshold
            : DEFAULT_V4_INITIAL_PROPOSAL_THRESHOLD,
        ],
      );
    })();

    // 7.1 Choose governance factory
    const governanceFactoryAddress: Address = (() => {
      if (params.governance.type === 'noOp') {
        const resolved =
          params.modules?.governanceFactory ??
          addresses.noOpGovernanceFactory ??
          ZERO_ADDRESS;
        if (!resolved || resolved === ZERO_ADDRESS) {
          throw new Error(
            'No-op governance requested, but no-op governanceFactory is not configured on this chain. Provide a governanceFactory override or use a supported chain.',
          );
        }
        return resolved;
      }
      if (params.governance.type === 'launchpad') {
        const resolved =
          params.modules?.governanceFactory ??
          addresses.launchpadGovernanceFactory ??
          ZERO_ADDRESS;
        if (!resolved || resolved === ZERO_ADDRESS) {
          throw new Error(
            'Launchpad governance requested, but launchpadGovernanceFactory is not configured on this chain. Provide a governanceFactory override or use a supported chain.',
          );
        }
        return resolved;
      }
      const resolved =
        params.modules?.governanceFactory ?? addresses.governanceFactory;
      if (!resolved || resolved === ZERO_ADDRESS) {
        throw new Error(
          'Standard governance requested but governanceFactory is not deployed on this chain.',
        );
      }
      return resolved;
    })();

    // 8. Build the complete CreateParams for the V4-style ABI
    const createParams = {
      initialSupply: params.sale.initialSupply,
      numTokensToSell: params.sale.numTokensToSell,
      numeraire: params.sale.numeraire,
      tokenFactory: resolvedTokenFactoryDyn,
      tokenFactoryData: encodedTokenFactoryData,
      governanceFactory: governanceFactoryAddress,
      governanceFactoryData: governanceFactoryData,
      poolInitializer: params.modules?.v4Initializer ?? addresses.v4Initializer,
      poolInitializerData: poolInitializerData,
      liquidityMigrator: this.getMigratorAddress(
        params.migration,
        params.modules,
      ),
      liquidityMigratorData: liquidityMigratorData,
      integrator: params.integrator ?? ZERO_ADDRESS,
      salt: salt,
    };

    return { createParams, hookAddress, tokenAddress };
  }

  /**
   * Create a new dynamic auction (using Uniswap V4 hook for gradual Dutch auction)
   * @param params Configuration for the dynamic auction
   * @returns The address of the created hook and token
   */
  async createDynamicAuction(
    params: CreateDynamicAuctionParams<C>,
    options?: { _createParams?: CreateParams },
  ): Promise<{
    hookAddress: Address;
    tokenAddress: Address;
    poolId: string;
    transactionHash: string;
  }> {
    const addresses = getAddresses(this.chainId);

    // Use provided createParams (from simulate) or auto-simulate to get consistent params
    let createParams: CreateParams;

    if (options?._createParams) {
      createParams = options._createParams;
    } else {
      const simulation = await this.simulateCreateDynamicAuction(params);
      createParams = simulation.createParams;
    }

    // Call the airlock contract to create the pool
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations');
    }

    const airlockAddress = params.modules?.airlock ?? addresses.airlock;
    const { request, result } = await (
      this.publicClient as PublicClient
    ).simulateContract({
      address: airlockAddress,
      abi: airlockAbi,
      functionName: 'create',
      args: [{ ...createParams }],
      account: this.walletClient.account,
    });
    const simResult = result as readonly unknown[] | undefined;

    const gasEstimate = await this.resolveCreateGasEstimate({
      request,
      address: airlockAddress,
      createParams,
      account: this.walletClient.account,
    });
    const gasOverride = params.gas ?? gasEstimate ?? DEFAULT_CREATE_GAS_LIMIT;
    const hash = await this.walletClient.writeContract({
      ...request,
      gas: gasOverride,
    });

    // Wait for transaction and get the receipt
    const receipt = await (
      this.publicClient as PublicClient
    ).waitForTransactionReceipt({ hash });

    // Always extract actual addresses from event logs (source of truth)
    const actualAddresses = this.extractAddressesFromCreateEvent(receipt);

    if (!actualAddresses) {
      throw new Error(
        'Failed to extract addresses from Create event in transaction logs',
      );
    }

    const actualTokenAddress = actualAddresses.tokenAddress;
    const actualHookAddress = actualAddresses.poolOrHookAddress;

    // Warn if simulation predicted different addresses (helps debugging state divergence)
    if (simResult && Array.isArray(simResult) && simResult.length >= 2) {
      const simulatedToken = simResult[0] as Address;
      const simulatedHook = simResult[1] as Address;
      if (simulatedToken.toLowerCase() !== actualTokenAddress.toLowerCase()) {
        console.warn(
          `[DopplerSDK] Simulation predicted token ${simulatedToken} but actual is ${actualTokenAddress}. ` +
            `This may indicate state divergence between simulation and execution.`,
        );
      }
      if (simulatedHook.toLowerCase() !== actualHookAddress.toLowerCase()) {
        console.warn(
          `[DopplerSDK] Simulation predicted hook ${simulatedHook} but actual is ${actualHookAddress}. ` +
            `This may indicate state divergence between simulation and execution.`,
        );
      }
    }

    // Calculate pool ID for V4 using actual addresses
    const poolId = this.computePoolId({
      currency0:
        actualTokenAddress < params.sale.numeraire
          ? actualTokenAddress
          : params.sale.numeraire,
      currency1:
        actualTokenAddress < params.sale.numeraire
          ? params.sale.numeraire
          : actualTokenAddress,
      fee: params.pool.fee,
      tickSpacing: params.pool.tickSpacing,
      hooks: actualHookAddress,
    });

    return {
      hookAddress: actualHookAddress,
      tokenAddress: actualTokenAddress,
      poolId,
      transactionHash: hash,
    };
  }

  /**
   * Simulate a dynamic auction creation and return predicted addresses and poolId.
   * Useful for clients that need the hook/token/poolId before submitting the tx.
   */
  async simulateCreateDynamicAuction(
    params: CreateDynamicAuctionParams<C>,
  ): Promise<{
    createParams: CreateParams;
    hookAddress: Address;
    tokenAddress: Address;
    poolId: string;
    gasEstimate?: bigint;
    /** Execute the create with the same params used in simulation (guarantees address match) */
    execute: () => Promise<{
      hookAddress: Address;
      tokenAddress: Address;
      poolId: string;
      transactionHash: string;
    }>;
  }> {
    const { createParams } =
      await this.encodeCreateDynamicAuctionParams(params);
    const addresses = getAddresses(this.chainId);

    const airlockAddress = params.modules?.airlock ?? addresses.airlock;
    const { request, result } = await (
      this.publicClient as PublicClient
    ).simulateContract({
      address: airlockAddress,
      abi: airlockAbi,
      functionName: 'create',
      args: [{ ...createParams }],
      account: this.walletClient?.account,
    });
    const simResult = result as readonly unknown[] | undefined;
    const gasEstimate = await this.resolveCreateGasEstimate({
      request,
      address: airlockAddress,
      createParams,
      account: this.walletClient?.account ?? params.userAddress,
    });

    if (!simResult || !Array.isArray(simResult) || simResult.length < 2) {
      throw new Error('Failed to simulate dynamic auction create');
    }

    const tokenAddress = simResult[0] as Address;
    const hookAddress = simResult[1] as Address;

    const poolId = this.computePoolId({
      currency0:
        tokenAddress < params.sale.numeraire
          ? tokenAddress
          : params.sale.numeraire,
      currency1:
        tokenAddress < params.sale.numeraire
          ? params.sale.numeraire
          : tokenAddress,
      fee: params.pool.fee,
      tickSpacing: params.pool.tickSpacing,
      hooks: hookAddress,
    });

    return {
      createParams,
      hookAddress,
      tokenAddress,
      poolId,
      gasEstimate,
      execute: () =>
        this.createDynamicAuction(params, { _createParams: createParams }),
    };
  }

  async encodeCreateOpeningAuctionParams(
    params: CreateOpeningAuctionParams<C>,
  ): Promise<{
    createParams: CreateParams;
    hookAddress: Address;
    tokenAddress: Address;
    minedSalt: Hash;
  }> {
    this.validateOpeningAuctionParams(params);
    const addresses = getAddresses(this.chainId);

    const openingAuctionInitializer = this.resolveOpeningAuctionInitializerAddress(
      params.modules,
      addresses,
    );

    const [poolManagerForAuction, auctionDeployer] = await Promise.all([
      (this.publicClient as PublicClient).readContract({
        address: openingAuctionInitializer,
        abi: openingAuctionInitializerAbi,
        functionName: 'poolManager',
      }) as Promise<Address>,
      (this.publicClient as PublicClient).readContract({
        address: openingAuctionInitializer,
        abi: openingAuctionInitializerAbi,
        functionName: 'auctionDeployer',
      }) as Promise<Address>,
    ]);

    let blockTimestamp: number;
    if (params.blockTimestamp !== undefined) {
      blockTimestamp = params.blockTimestamp;
    } else {
      const latestBlock = await (this.publicClient as PublicClient).getBlock({
        blockTag: 'latest',
      });
      blockTimestamp = Number(
        (latestBlock as { timestamp: bigint | number }).timestamp,
      );
    }

    const startOffset =
      params.startTimeOffset ?? params.doppler.startTimeOffset ?? 30;
    const startTime =
      params.startingTime ??
      params.doppler.startingTime ??
      blockTimestamp + startOffset;
    const endTime = startTime + params.doppler.duration;

    const isToken0 = isToken0Expected(params.sale.numeraire);
    const gamma =
      params.doppler.gamma ??
      computeOptimalGamma(
        params.doppler.startTick,
        params.doppler.endTick,
        params.doppler.duration,
        params.doppler.epochLength,
        params.doppler.tickSpacing,
      );

    const dopplerData = encodeAbiParameters(
      [
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'int24' },
        { type: 'int24' },
        { type: 'uint256' },
        { type: 'int24' },
        { type: 'bool' },
        { type: 'uint256' },
        { type: 'uint24' },
        { type: 'int24' },
      ],
      [
        params.doppler.minProceeds,
        params.doppler.maxProceeds,
        BigInt(startTime),
        BigInt(endTime),
        params.doppler.startTick,
        params.doppler.endTick,
        BigInt(params.doppler.epochLength),
        gamma,
        isToken0,
        BigInt(params.doppler.numPdSlugs ?? DEFAULT_PD_SLUGS),
        params.doppler.fee,
        params.doppler.tickSpacing,
      ],
    );

    const poolInitializerData = encodeAbiParameters(
      [
        {
          type: 'tuple',
          components: [
            {
              name: 'auctionConfig',
              type: 'tuple',
              components: [
                { name: 'auctionDuration', type: 'uint256' },
                { name: 'minAcceptableTickToken0', type: 'int24' },
                { name: 'minAcceptableTickToken1', type: 'int24' },
                { name: 'incentiveShareBps', type: 'uint256' },
                { name: 'tickSpacing', type: 'int24' },
                { name: 'fee', type: 'uint24' },
                { name: 'minLiquidity', type: 'uint128' },
                { name: 'shareToAuctionBps', type: 'uint256' },
              ],
            },
            { name: 'dopplerData', type: 'bytes' },
          ],
        },
      ],
      [
        {
          auctionConfig: {
            auctionDuration: BigInt(params.openingAuction.auctionDuration),
            minAcceptableTickToken0:
              params.openingAuction.minAcceptableTickToken0,
            minAcceptableTickToken1:
              params.openingAuction.minAcceptableTickToken1,
            incentiveShareBps: BigInt(params.openingAuction.incentiveShareBps),
            tickSpacing: params.openingAuction.tickSpacing,
            fee: params.openingAuction.fee,
            minLiquidity: params.openingAuction.minLiquidity,
            shareToAuctionBps: BigInt(params.openingAuction.shareToAuctionBps),
          },
          dopplerData,
        },
      ],
    );

    if (this.isDoppler404Token(params.token)) {
      if (
        !addresses.doppler404Factory ||
        addresses.doppler404Factory === ZERO_ADDRESS
      ) {
        throw new Error(
          'Doppler404 factory address not configured for this chain',
        );
      }
    }

    const vestingDuration = params.vesting?.duration ?? BigInt(0);
    const tokenFactoryData = this.isDoppler404Token(params.token)
      ? (() => {
          const t = params.token as Doppler404TokenConfig;
          return {
            name: t.name,
            symbol: t.symbol,
            baseURI: t.baseURI,
            unit: t.unit !== undefined ? BigInt(t.unit) : 1000n,
          };
        })()
      : (() => {
          const t = params.token as StandardTokenConfig;
          let vestingRecipients: Address[] = [];
          let vestingAmounts: bigint[] = [];

          if (params.vesting) {
            if (params.vesting.recipients && params.vesting.amounts) {
              vestingRecipients = params.vesting.recipients;
              vestingAmounts = params.vesting.amounts;
            } else {
              vestingRecipients = [params.userAddress];
              vestingAmounts = [
                params.sale.initialSupply - params.sale.numTokensToSell,
              ];
            }
          }

          return {
            name: t.name,
            symbol: t.symbol,
            initialSupply: params.sale.initialSupply,
            airlock: params.modules?.airlock ?? addresses.airlock,
            yearlyMintRate: t.yearlyMintRate ?? DEFAULT_V4_YEARLY_MINT_RATE,
            vestingDuration: BigInt(vestingDuration),
            recipients: vestingRecipients,
            amounts: vestingAmounts,
            tokenURI: t.tokenURI,
          };
        })();

    const resolvedTokenFactory: Address | undefined =
      params.modules?.tokenFactory ??
      (this.isDoppler404Token(params.token)
        ? (addresses.doppler404Factory as Address | undefined)
        : addresses.tokenFactory);

    if (!resolvedTokenFactory || resolvedTokenFactory === ZERO_ADDRESS) {
      throw new Error(
        'Token factory address not configured. Provide an explicit address via builder.withTokenFactory(...) or ensure chain config includes a valid factory.',
      );
    }

    const auctionTokens =
      (params.sale.numTokensToSell *
        BigInt(params.openingAuction.shareToAuctionBps)) /
      10_000n;
    if (auctionTokens <= 0n) {
      throw new Error('Opening auction token allocation rounds to zero');
    }

    const [salt, hookAddress, tokenAddress, encodedTokenFactoryData] =
      this.mineOpeningAuctionHookAddress({
        auctionDeployer,
        openingAuctionInitializer,
        poolManager: poolManagerForAuction,
        auctionTokens,
        openingAuctionConfig: params.openingAuction,
        numeraire: params.sale.numeraire,
        tokenFactory: resolvedTokenFactory,
        tokenFactoryData,
        airlock: params.modules?.airlock ?? addresses.airlock,
        initialSupply: params.sale.initialSupply,
        tokenVariant: this.isDoppler404Token(params.token)
          ? 'doppler404'
          : 'standard',
      });

    const liquidityMigratorData = this.encodeMigrationData(params.migration);

    const governanceFactoryData: Hex = (() => {
      if (params.governance.type === 'noOp') {
        return '0x' as Hex;
      }
      if (params.governance.type === 'launchpad') {
        return encodeAbiParameters(
          [{ type: 'address' }],
          [params.governance.multisig],
        );
      }
      return encodeAbiParameters(
        [
          { type: 'string' },
          { type: 'uint48' },
          { type: 'uint32' },
          { type: 'uint256' },
        ],
        [
          params.token.name,
          params.governance.type === 'custom'
            ? params.governance.initialVotingDelay
            : DEFAULT_V4_INITIAL_VOTING_DELAY,
          params.governance.type === 'custom'
            ? params.governance.initialVotingPeriod
            : DEFAULT_V4_INITIAL_VOTING_PERIOD,
          params.governance.type === 'custom'
            ? params.governance.initialProposalThreshold
            : DEFAULT_V4_INITIAL_PROPOSAL_THRESHOLD,
        ],
      );
    })();

    const governanceFactoryAddress: Address = (() => {
      if (params.governance.type === 'noOp') {
        const resolved =
          params.modules?.governanceFactory ??
          addresses.noOpGovernanceFactory ??
          ZERO_ADDRESS;
        if (!resolved || resolved === ZERO_ADDRESS) {
          throw new Error(
            'No-op governance requested, but no-op governanceFactory is not configured on this chain. Provide a governanceFactory override or use a supported chain.',
          );
        }
        return resolved;
      }
      if (params.governance.type === 'launchpad') {
        const resolved =
          params.modules?.governanceFactory ??
          addresses.launchpadGovernanceFactory ??
          ZERO_ADDRESS;
        if (!resolved || resolved === ZERO_ADDRESS) {
          throw new Error(
            'Launchpad governance requested, but launchpadGovernanceFactory is not configured on this chain. Provide a governanceFactory override or use a supported chain.',
          );
        }
        return resolved;
      }
      const resolved =
        params.modules?.governanceFactory ?? addresses.governanceFactory;
      if (!resolved || resolved === ZERO_ADDRESS) {
        throw new Error(
          'Standard governance requested but governanceFactory is not deployed on this chain.',
        );
      }
      return resolved;
    })();

    const createParams: CreateParams = {
      initialSupply: params.sale.initialSupply,
      numTokensToSell: params.sale.numTokensToSell,
      numeraire: params.sale.numeraire,
      tokenFactory: resolvedTokenFactory,
      tokenFactoryData: encodedTokenFactoryData,
      governanceFactory: governanceFactoryAddress,
      governanceFactoryData,
      poolInitializer: openingAuctionInitializer,
      poolInitializerData,
      liquidityMigrator: this.getMigratorAddress(
        params.migration,
        params.modules,
      ),
      liquidityMigratorData,
      integrator: params.integrator ?? ZERO_ADDRESS,
      salt,
    };

    return {
      createParams,
      hookAddress,
      tokenAddress,
      minedSalt: salt,
    };
  }

  async simulateCreateOpeningAuction(
    params: CreateOpeningAuctionParams<C>,
  ): Promise<{
    createParams: CreateParams;
    openingAuctionHookAddress: Address;
    tokenAddress: Address;
    minedSalt: Hash;
    gasEstimate?: bigint;
    execute: () => Promise<OpeningAuctionCreateResult>;
  }> {
    const { createParams, minedSalt } =
      await this.encodeCreateOpeningAuctionParams(params);
    const addresses = getAddresses(this.chainId);

    const airlockAddress = params.modules?.airlock ?? addresses.airlock;
    const { request, result } = await (
      this.publicClient as PublicClient
    ).simulateContract({
      address: airlockAddress,
      abi: airlockAbi,
      functionName: 'create',
      args: [{ ...createParams }],
      account: this.walletClient?.account,
    });
    const simResult = result as readonly unknown[] | undefined;
    const gasEstimate = await this.resolveCreateGasEstimate({
      request,
      address: airlockAddress,
      createParams,
      account: this.walletClient?.account ?? params.userAddress,
    });

    if (!simResult || !Array.isArray(simResult) || simResult.length < 2) {
      throw new Error('Failed to simulate opening auction create');
    }

    return {
      createParams,
      openingAuctionHookAddress: simResult[1] as Address,
      tokenAddress: simResult[0] as Address,
      minedSalt,
      gasEstimate,
      execute: () =>
        this.createOpeningAuction(params, {
          _createParams: createParams,
          _minedSalt: minedSalt,
        }),
    };
  }

  async createOpeningAuction(
    params: CreateOpeningAuctionParams<C>,
    options?: { _createParams?: CreateParams; _minedSalt?: Hash },
  ): Promise<OpeningAuctionCreateResult> {
    const addresses = getAddresses(this.chainId);
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations');
    }

    let createParams = options?._createParams;
    let minedSalt = options?._minedSalt;
    if (!createParams || !minedSalt) {
      const simulation = await this.simulateCreateOpeningAuction(params);
      createParams = simulation.createParams;
      minedSalt = simulation.minedSalt;
    }

    const airlockAddress = params.modules?.airlock ?? addresses.airlock;
    const { request, result } = await (
      this.publicClient as PublicClient
    ).simulateContract({
      address: airlockAddress,
      abi: airlockAbi,
      functionName: 'create',
      args: [{ ...createParams }],
      account: this.walletClient.account,
    });
    const simResult = result as readonly unknown[] | undefined;

    const gasEstimate = await this.resolveCreateGasEstimate({
      request,
      address: airlockAddress,
      createParams,
      account: this.walletClient.account,
    });
    const gasOverride = params.gas ?? gasEstimate ?? DEFAULT_CREATE_GAS_LIMIT;
    const hash = await this.walletClient.writeContract({
      ...request,
      gas: gasOverride,
    });

    const receipt = await (
      this.publicClient as PublicClient
    ).waitForTransactionReceipt({ hash });

    const actualAddresses = this.extractAddressesFromCreateEvent(receipt);
    if (!actualAddresses) {
      throw new Error(
        'Failed to extract addresses from Create event in transaction logs',
      );
    }

    if (simResult && Array.isArray(simResult) && simResult.length >= 2) {
      const simulatedToken = simResult[0] as Address;
      const simulatedHook = simResult[1] as Address;
      if (simulatedToken.toLowerCase() !== actualAddresses.tokenAddress.toLowerCase()) {
        console.warn(
          `[DopplerSDK] Simulation predicted token ${simulatedToken} but actual is ${actualAddresses.tokenAddress}. ` +
            `This may indicate state divergence between simulation and execution.`,
        );
      }
      if (simulatedHook.toLowerCase() !== actualAddresses.poolOrHookAddress.toLowerCase()) {
        console.warn(
          `[DopplerSDK] Simulation predicted opening hook ${simulatedHook} but actual is ${actualAddresses.poolOrHookAddress}. ` +
            `This may indicate state divergence between simulation and execution.`,
        );
      }
    }

    return {
      tokenAddress: actualAddresses.tokenAddress,
      openingAuctionHookAddress: actualAddresses.poolOrHookAddress,
      transactionHash: hash,
      createParams,
      minedSalt,
    };
  }

  async simulateCompleteOpeningAuction(args: {
    asset: Address;
    initializerAddress?: Address;
    dopplerSalt?: Hash;
    blockTimestamp?: number;
  }): Promise<{
    asset: Address;
    dopplerSalt: Hash;
    dopplerHookAddress: Address;
    gasEstimate?: bigint;
    execute: () => Promise<OpeningAuctionCompleteResult>;
  }> {
    const initializerAddress = args.initializerAddress
      ? args.initializerAddress
      : this.resolveOpeningAuctionInitializerAddress();

    const autoMined = args.dopplerSalt === undefined;
    const deterministic = args.blockTimestamp !== undefined;
    const maxAttempts =
      autoMined && !deterministic ? MAX_COMPLETION_ATTEMPTS : 1;

    let startSalt: bigint | undefined;
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const stateRaw = await (this.publicClient as PublicClient).readContract({
        address: initializerAddress,
        abi: openingAuctionInitializerAbi,
        functionName: 'getState',
        args: [args.asset],
      });
      const state = this.normalizeOpeningAuctionState(stateRaw);

      const phase = await (this.publicClient as PublicClient).readContract({
        address: state.openingAuctionHook,
        abi: openingAuctionAbi,
        functionName: 'phase',
      });
      if (Number(phase) !== OPENING_AUCTION_PHASE_SETTLED) {
        throw new Error(
          'Opening auction is not settled yet. Run settleAuction() first, then simulate completion.',
        );
      }

      const completion =
        args.dopplerSalt !== undefined
          ? {
              dopplerSalt: args.dopplerSalt,
              dopplerHookAddress: zeroAddress,
            }
          : await this.mineDopplerCompletionSalt({
              asset: args.asset,
              initializerAddress,
              state,
              blockTimestamp: args.blockTimestamp,
              startSalt,
            });

      try {
        const { request } = await (this.publicClient as PublicClient).simulateContract(
          {
            address: initializerAddress,
            abi: openingAuctionInitializerAbi,
            functionName: 'completeAuction',
            args: [args.asset, completion.dopplerSalt],
            account: this.walletClient?.account,
          },
        );

        const gasEstimate =
          request &&
          typeof request === 'object' &&
          'gas' in (request as Record<string, unknown>)
            ? ((request as { gas?: bigint }).gas ?? undefined)
            : undefined;

        return {
          asset: args.asset,
          dopplerSalt: completion.dopplerSalt,
          dopplerHookAddress: completion.dopplerHookAddress,
          gasEstimate,
          execute: () =>
            this.completeOpeningAuction({
              asset: args.asset,
              initializerAddress,
              ...(args.dopplerSalt !== undefined
                ? { dopplerSalt: args.dopplerSalt }
                : {}),
              autoSettle: false,
              blockTimestamp: args.blockTimestamp,
            }),
        };
      } catch (err) {
        lastError = err;
        if (attempt >= maxAttempts) {
          if (maxAttempts === 1) throw err;
          break;
        }
        if (autoMined) startSalt = BigInt(completion.dopplerSalt) + 1n;
      }
    }

    const lastMsg =
      lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(
      `simulateCompleteOpeningAuction failed after ${maxAttempts} attempt${
        maxAttempts === 1 ? '' : 's'
      }: ${lastMsg}`,
    );
  }

  async completeOpeningAuction(args: {
    asset: Address;
    initializerAddress?: Address;
    dopplerSalt?: Hash;
    autoSettle?: boolean;
    blockTimestamp?: number;
  }): Promise<OpeningAuctionCompleteResult> {
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations');
    }

    const initializerAddress = args.initializerAddress
      ? args.initializerAddress
      : this.resolveOpeningAuctionInitializerAddress();

    const stateRaw = await (this.publicClient as PublicClient).readContract({
      address: initializerAddress,
      abi: openingAuctionInitializerAbi,
      functionName: 'getState',
      args: [args.asset],
    });
    const state = this.normalizeOpeningAuctionState(stateRaw);
    if (state.status !== OPENING_AUCTION_STATUS_ACTIVE) {
      throw new Error(
        `Opening auction status is not active for ${args.asset}. Current status: ${state.status}.`,
      );
    }

    const autoSettle = args.autoSettle ?? true;
    const phase = await (this.publicClient as PublicClient).readContract({
      address: state.openingAuctionHook,
      abi: openingAuctionAbi,
      functionName: 'phase',
    });

    if (autoSettle && Number(phase) !== OPENING_AUCTION_PHASE_SETTLED) {
      const { request } = await (this.publicClient as PublicClient).simulateContract(
        {
          address: state.openingAuctionHook,
          abi: openingAuctionAbi,
          functionName: 'settleAuction',
          account: this.walletClient.account,
        },
      );
      const settleTx = await this.walletClient.writeContract(request);
      await (this.publicClient as PublicClient).waitForTransactionReceipt({
        hash: settleTx,
      });
    }

    const autoMined = args.dopplerSalt === undefined;
    const deterministic = args.blockTimestamp !== undefined;
    const maxAttempts =
      autoMined && !deterministic ? MAX_COMPLETION_ATTEMPTS : 1;

    let startSalt: bigint | undefined;
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const stateRawAttempt = await (this.publicClient as PublicClient).readContract({
        address: initializerAddress,
        abi: openingAuctionInitializerAbi,
        functionName: 'getState',
        args: [args.asset],
      });
      const stateAttempt = this.normalizeOpeningAuctionState(stateRawAttempt);
      if (stateAttempt.status !== OPENING_AUCTION_STATUS_ACTIVE) {
        throw new Error(
          `Opening auction status is not active for ${args.asset}. Current status: ${stateAttempt.status}.`,
        );
      }

      const completion =
        args.dopplerSalt !== undefined
          ? {
              dopplerSalt: args.dopplerSalt,
              dopplerHookAddress: zeroAddress,
            }
          : await this.mineDopplerCompletionSalt({
              asset: args.asset,
              initializerAddress,
              state: stateAttempt,
              blockTimestamp: args.blockTimestamp,
              startSalt,
            });

      let request: unknown;
      try {
        ({ request } = await (this.publicClient as PublicClient).simulateContract({
          address: initializerAddress,
          abi: openingAuctionInitializerAbi,
          functionName: 'completeAuction',
          args: [args.asset, completion.dopplerSalt],
          account: this.walletClient.account,
        }));
      } catch (err) {
        lastError = err;
        if (attempt >= maxAttempts) {
          if (maxAttempts === 1) throw err;
          break;
        }
        if (autoMined) startSalt = BigInt(completion.dopplerSalt) + 1n;
        continue;
      }

      const txHash = await this.walletClient.writeContract(request as any);
      const receipt = await (this.publicClient as PublicClient).waitForTransactionReceipt({
        hash: txHash,
      });
      if (receipt.status === 'reverted') {
        const receiptError = new Error(
          `completeAuction transaction reverted (hash: ${txHash})`,
        );
        lastError = receiptError;
        if (attempt >= maxAttempts) {
          if (maxAttempts === 1) throw receiptError;
          break;
        }
        if (autoMined) startSalt = BigInt(completion.dopplerSalt) + 1n;
        continue;
      }

      const dopplerHookAddress = await (this.publicClient as PublicClient).readContract(
        {
          address: initializerAddress,
          abi: openingAuctionInitializerAbi,
          functionName: 'getDopplerHook',
          args: [args.asset],
        },
      );

      return {
        asset: args.asset,
        dopplerHookAddress:
          dopplerHookAddress === zeroAddress
            ? completion.dopplerHookAddress
            : dopplerHookAddress,
        transactionHash: txHash,
        dopplerSalt: completion.dopplerSalt,
      };
    }

    const lastMsg =
      lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(
      `completeOpeningAuction failed after ${maxAttempts} attempt${
        maxAttempts === 1 ? '' : 's'
      }: ${lastMsg}`,
    );
  }

  async simulateRecoverOpeningAuctionIncentives(args: {
    asset: Address;
    initializerAddress?: Address;
    account?: Address | Account;
  }): Promise<{ request: unknown }> {
    const initializerAddress = args.initializerAddress
      ? args.initializerAddress
      : this.resolveOpeningAuctionInitializerAddress();

    const { request } = await (this.publicClient as PublicClient).simulateContract(
      {
        address: initializerAddress,
        abi: openingAuctionInitializerAbi,
        functionName: 'recoverOpeningAuctionIncentives',
        args: [args.asset],
        account: args.account ?? this.walletClient?.account,
      },
    );
    return { request };
  }

  async recoverOpeningAuctionIncentives(args: {
    asset: Address;
    initializerAddress?: Address;
  }): Promise<Hash> {
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations');
    }
    const simulation = await this.simulateRecoverOpeningAuctionIncentives({
      ...args,
      account: this.walletClient.account,
    });
    return this.walletClient.writeContract(simulation.request as any);
  }

  async simulateSweepOpeningAuctionIncentives(args: {
    asset: Address;
    initializerAddress?: Address;
    account?: Address | Account;
  }): Promise<{ request: unknown }> {
    const initializerAddress = args.initializerAddress
      ? args.initializerAddress
      : this.resolveOpeningAuctionInitializerAddress();

    const { request } = await (this.publicClient as PublicClient).simulateContract(
      {
        address: initializerAddress,
        abi: openingAuctionInitializerAbi,
        functionName: 'sweepOpeningAuctionIncentives',
        args: [args.asset],
        account: args.account ?? this.walletClient?.account,
      },
    );
    return { request };
  }

  async sweepOpeningAuctionIncentives(args: {
    asset: Address;
    initializerAddress?: Address;
  }): Promise<Hash> {
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations');
    }
    const simulation = await this.simulateSweepOpeningAuctionIncentives({
      ...args,
      account: this.walletClient.account,
    });
    return this.walletClient.writeContract(simulation.request as any);
  }

  private resolveOpeningAuctionInitializerAddress(
    modules?: ModuleAddressOverrides,
    chainAddresses?: ReturnType<typeof getAddresses>,
  ): Address {
    const addresses = chainAddresses ?? getAddresses(this.chainId);
    const resolved =
      modules?.openingAuctionInitializer ??
      addresses.openingAuctionInitializer ??
      ZERO_ADDRESS;
    if (!resolved || resolved === ZERO_ADDRESS) {
      throw new Error(
        'OpeningAuctionInitializer address not configured. Provide modules.openingAuctionInitializer or configure chain addresses.',
      );
    }
    return resolved;
  }

  private normalizeOpeningAuctionState(raw: unknown): OpeningAuctionState {
    if (Array.isArray(raw)) {
      const [
        numeraire,
        auctionStartTime,
        auctionEndTime,
        auctionTokens,
        dopplerTokens,
        status,
        openingAuctionHook,
        dopplerHook,
        openingAuctionPoolKey,
        dopplerInitData,
        isToken0,
      ] = raw as [
        Address,
        bigint,
        bigint,
        bigint,
        bigint,
        number,
        Address,
        Address,
        unknown,
        `0x${string}`,
        boolean,
      ];

      return {
        numeraire,
        auctionStartTime,
        auctionEndTime,
        auctionTokens,
        dopplerTokens,
        status,
        openingAuctionHook,
        dopplerHook,
        openingAuctionPoolKey: this.normalizePoolKey(openingAuctionPoolKey),
        dopplerInitData,
        isToken0,
      };
    }

    const value = raw as Record<string, unknown>;
    return {
      numeraire: value.numeraire as Address,
      auctionStartTime: value.auctionStartTime as bigint,
      auctionEndTime: value.auctionEndTime as bigint,
      auctionTokens: value.auctionTokens as bigint,
      dopplerTokens: value.dopplerTokens as bigint,
      status: Number(value.status),
      openingAuctionHook: value.openingAuctionHook as Address,
      dopplerHook: value.dopplerHook as Address,
      openingAuctionPoolKey: this.normalizePoolKey(
        value.openingAuctionPoolKey,
      ),
      dopplerInitData: value.dopplerInitData as `0x${string}`,
      isToken0: Boolean(value.isToken0),
    };
  }

  private decodeDopplerInitData(dopplerData: `0x${string}`): {
    minimumProceeds: bigint;
    maximumProceeds: bigint;
    startingTime: bigint;
    endingTime: bigint;
    startingTick: number;
    endingTick: number;
    epochLength: bigint;
    gamma: number;
    isToken0: boolean;
    numPDSlugs: bigint;
    lpFee: number;
    tickSpacing: number;
  } {
    const decoded = decodeAbiParameters(
      [
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'int24' },
        { type: 'int24' },
        { type: 'uint256' },
        { type: 'int24' },
        { type: 'bool' },
        { type: 'uint256' },
        { type: 'uint24' },
        { type: 'int24' },
      ],
      dopplerData,
    );

    return {
      minimumProceeds: decoded[0],
      maximumProceeds: decoded[1],
      startingTime: decoded[2],
      endingTime: decoded[3],
      startingTick: Number(decoded[4]),
      endingTick: Number(decoded[5]),
      epochLength: decoded[6],
      gamma: Number(decoded[7]),
      isToken0: decoded[8],
      numPDSlugs: decoded[9],
      lpFee: Number(decoded[10]),
      tickSpacing: Number(decoded[11]),
    };
  }

  private encodeDopplerInitData(data: {
    minimumProceeds: bigint;
    maximumProceeds: bigint;
    startingTime: bigint;
    endingTime: bigint;
    startingTick: number;
    endingTick: number;
    epochLength: bigint;
    gamma: number;
    isToken0: boolean;
    numPDSlugs: bigint;
    lpFee: number;
    tickSpacing: number;
  }): Hex {
    return encodeAbiParameters(
      [
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'int24' },
        { type: 'int24' },
        { type: 'uint256' },
        { type: 'int24' },
        { type: 'bool' },
        { type: 'uint256' },
        { type: 'uint24' },
        { type: 'int24' },
      ],
      [
        data.minimumProceeds,
        data.maximumProceeds,
        data.startingTime,
        data.endingTime,
        data.startingTick,
        data.endingTick,
        data.epochLength,
        data.gamma,
        data.isToken0,
        data.numPDSlugs,
        data.lpFee,
        data.tickSpacing,
      ],
    );
  }

  private alignTickTowardZero(tick: number, tickSpacing: number): number {
    return tick - (tick % tickSpacing);
  }

  private alignTickForDirection(
    isToken0: boolean,
    tick: number,
    tickSpacing: number,
  ): number {
    if (isToken0) {
      return tick < 0
        ? Math.trunc((tick - tickSpacing + 1) / tickSpacing) * tickSpacing
        : Math.trunc(tick / tickSpacing) * tickSpacing;
    }

    return tick < 0
      ? Math.trunc(tick / tickSpacing) * tickSpacing
      : Math.trunc((tick + tickSpacing - 1) / tickSpacing) * tickSpacing;
  }

  private async mineDopplerCompletionSalt(args: {
    asset: Address;
    initializerAddress: Address;
    state: OpeningAuctionState;
    blockTimestamp?: number;
    startSalt?: bigint;
  }): Promise<{ dopplerSalt: Hash; dopplerHookAddress: Address }> {
    const [phaseRaw, clearingTickRaw, incentiveTokensTotal, totalIncentivesClaimed] =
      await Promise.all([
        (this.publicClient as PublicClient).readContract({
          address: args.state.openingAuctionHook,
          abi: openingAuctionAbi,
          functionName: 'phase',
        }),
        (this.publicClient as PublicClient).readContract({
          address: args.state.openingAuctionHook,
          abi: openingAuctionAbi,
          functionName: 'clearingTick',
        }),
        (this.publicClient as PublicClient).readContract({
          address: args.state.openingAuctionHook,
          abi: openingAuctionAbi,
          functionName: 'incentiveTokensTotal',
        }),
        (this.publicClient as PublicClient).readContract({
          address: args.state.openingAuctionHook,
          abi: openingAuctionAbi,
          functionName: 'totalIncentivesClaimed',
        }),
      ]);

    if (Number(phaseRaw) !== OPENING_AUCTION_PHASE_SETTLED) {
      throw new Error('Opening auction must be settled before completion mining');
    }

    const rawAssetBalance = await (this.publicClient as PublicClient).readContract({
      address: args.asset,
      abi: erc20BalanceOfAbi,
      functionName: 'balanceOf',
      args: [args.state.openingAuctionHook],
    });

    const reservedIncentives =
      totalIncentivesClaimed < incentiveTokensTotal
        ? incentiveTokensTotal - totalIncentivesClaimed
        : 0n;
    const unsoldTokens =
      rawAssetBalance > reservedIncentives
        ? rawAssetBalance - reservedIncentives
        : 0n;

    const dopplerData = this.decodeDopplerInitData(args.state.dopplerInitData);
    let alignedClearingTick = this.alignTickForDirection(
      args.state.isToken0,
      Number(clearingTickRaw),
      dopplerData.tickSpacing,
    );
    const minAligned = this.alignTickTowardZero(MIN_TICK, dopplerData.tickSpacing);
    const maxAligned = this.alignTickTowardZero(MAX_TICK, dopplerData.tickSpacing);
    if (alignedClearingTick < minAligned) alignedClearingTick = minAligned;
    if (alignedClearingTick > maxAligned) alignedClearingTick = maxAligned;

    let blockTimestamp: number;
    if (args.blockTimestamp !== undefined) {
      blockTimestamp = args.blockTimestamp;
    } else {
      const latestBlock = await (this.publicClient as PublicClient).getBlock({
        blockTag: 'latest',
      });
      blockTimestamp = Number(
        (latestBlock as { timestamp: bigint | number }).timestamp,
      );
    }

    const originalDuration = dopplerData.endingTime - dopplerData.startingTime;
    let newStartingTime = dopplerData.startingTime;
    let newEndingTime = dopplerData.endingTime;
    if (BigInt(blockTimestamp) >= dopplerData.startingTime) {
      newStartingTime = BigInt(blockTimestamp + 1);
      newEndingTime = newStartingTime + originalDuration;
    }

    const modifiedDopplerData = this.encodeDopplerInitData({
      ...dopplerData,
      startingTime: newStartingTime,
      endingTime: newEndingTime,
      startingTick: alignedClearingTick,
    });
    const decodedModified = this.decodeDopplerInitData(
      modifiedDopplerData as `0x${string}`,
    );

    const [poolManager, dopplerDeployer] = await Promise.all([
      (this.publicClient as PublicClient).readContract({
        address: args.initializerAddress,
        abi: openingAuctionInitializerAbi,
        functionName: 'poolManager',
      }) as Promise<Address>,
      (this.publicClient as PublicClient).readContract({
        address: args.initializerAddress,
        abi: openingAuctionInitializerAbi,
        functionName: 'dopplerDeployer',
      }) as Promise<Address>,
    ]);

    let startSalt = args.startSalt ?? 0n;
    while (startSalt < ONE_MILLION) {
      const mined = this.mineDopplerHookSalt({
        dopplerDeployer,
        poolManager,
        initializerAddress: args.initializerAddress,
        unsoldTokens,
        dopplerData: decodedModified,
        startSalt,
      });

      const bytecode = await (this.publicClient as PublicClient).getBytecode({
        address: mined.hookAddress,
      });
      if (!bytecode || bytecode === '0x') {
        return {
          dopplerSalt: mined.salt,
          dopplerHookAddress: mined.hookAddress,
        };
      }
      startSalt = BigInt(mined.salt) + 1n;
    }

    throw new Error('Could not find an unused Doppler completion salt');
  }

  private mineDopplerHookSalt(args: {
    dopplerDeployer: Address;
    poolManager: Address;
    initializerAddress: Address;
    unsoldTokens: bigint;
    dopplerData: {
      minimumProceeds: bigint;
      maximumProceeds: bigint;
      startingTime: bigint;
      endingTime: bigint;
      startingTick: number;
      endingTick: number;
      epochLength: bigint;
      gamma: number;
      isToken0: boolean;
      numPDSlugs: bigint;
      lpFee: number;
      tickSpacing: number;
    };
    startSalt?: bigint;
  }): { salt: Hash; hookAddress: Address } {
    const { dopplerData } = args;
    const initHashData = encodeAbiParameters(
      [
        { type: 'address' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'int24' },
        { type: 'int24' },
        { type: 'uint256' },
        { type: 'int24' },
        { type: 'bool' },
        { type: 'uint256' },
        { type: 'address' },
        { type: 'uint24' },
      ],
      [
        args.poolManager,
        args.unsoldTokens,
        dopplerData.minimumProceeds,
        dopplerData.maximumProceeds,
        dopplerData.startingTime,
        dopplerData.endingTime,
        dopplerData.startingTick,
        dopplerData.endingTick,
        dopplerData.epochLength,
        dopplerData.gamma,
        dopplerData.isToken0,
        dopplerData.numPDSlugs,
        args.initializerAddress,
        dopplerData.lpFee,
      ],
    );

    const initHash = keccak256(
      encodePacked(['bytes', 'bytes'], [DopplerBytecode as Hex, initHashData]),
    );
    const hookBuffer = this.prepareCreate2Buffer(args.dopplerDeployer, initHash);

    for (let salt = args.startSalt ?? 0n; salt < ONE_MILLION; salt++) {
      this.updateSaltInBuffer(hookBuffer, salt);
      const hookRaw = this.computeCreate2AddressFast(hookBuffer);
      const hookBigInt = BigInt(hookRaw);
      if ((hookBigInt & FLAG_MASK) !== DOPPLER_FLAGS) {
        continue;
      }

      return {
        salt: `0x${salt.toString(16).padStart(64, '0')}` as Hash,
        hookAddress: getAddress(hookRaw) as Address,
      };
    }

    throw new Error('Could not mine Doppler completion salt');
  }

  private mineOpeningAuctionHookAddress(params: {
    auctionDeployer: Address;
    openingAuctionInitializer: Address;
    poolManager: Address;
    auctionTokens: bigint;
    openingAuctionConfig: CreateOpeningAuctionParams<C>['openingAuction'];
    numeraire: Address;
    tokenFactory: Address;
    tokenFactoryData:
      | {
          name: string;
          symbol: string;
          baseURI: string;
          unit?: bigint;
        }
      | {
          name: string;
          symbol: string;
          initialSupply: bigint;
          airlock: Address;
          yearlyMintRate: bigint;
          vestingDuration: bigint;
          recipients: Address[];
          amounts: bigint[];
          tokenURI: string;
        };
    airlock: Address;
    initialSupply: bigint;
    tokenVariant: 'standard' | 'doppler404';
  }): [Hash, Address, Address, Hex] {
    const config = params.openingAuctionConfig;
    const initHashData = encodeAbiParameters(
      [
        { type: 'address' },
        { type: 'address' },
        { type: 'uint256' },
        {
          type: 'tuple',
          components: [
            { type: 'uint256', name: 'auctionDuration' },
            { type: 'int24', name: 'minAcceptableTickToken0' },
            { type: 'int24', name: 'minAcceptableTickToken1' },
            { type: 'uint256', name: 'incentiveShareBps' },
            { type: 'int24', name: 'tickSpacing' },
            { type: 'uint24', name: 'fee' },
            { type: 'uint128', name: 'minLiquidity' },
            { type: 'uint256', name: 'shareToAuctionBps' },
          ],
        },
      ],
      [
        params.poolManager,
        params.openingAuctionInitializer,
        params.auctionTokens,
        {
          auctionDuration: BigInt(config.auctionDuration),
          minAcceptableTickToken0: config.minAcceptableTickToken0,
          minAcceptableTickToken1: config.minAcceptableTickToken1,
          incentiveShareBps: BigInt(config.incentiveShareBps),
          tickSpacing: config.tickSpacing,
          fee: config.fee,
          minLiquidity: config.minLiquidity,
          shareToAuctionBps: BigInt(config.shareToAuctionBps),
        },
      ],
    );

    const hookInitHash = keccak256(
      encodePacked(
        ['bytes', 'bytes'],
        [OpeningAuctionBytecode as Hex, initHashData],
      ),
    );

    const encodedTokenFactoryData =
      params.tokenVariant === 'doppler404'
        ? (() => {
            const t = params.tokenFactoryData as {
              name: string;
              symbol: string;
              baseURI: string;
              unit?: bigint;
            };
            return encodeAbiParameters(
              [
                { type: 'string' },
                { type: 'string' },
                { type: 'string' },
                { type: 'uint256' },
              ],
              [t.name, t.symbol, t.baseURI, t.unit ?? 1000n],
            );
          })()
        : (() => {
            const t = params.tokenFactoryData as {
              name: string;
              symbol: string;
              initialSupply: bigint;
              airlock: Address;
              yearlyMintRate: bigint;
              vestingDuration: bigint;
              recipients: Address[];
              amounts: bigint[];
              tokenURI: string;
            };
            return encodeAbiParameters(
              [
                { type: 'string' },
                { type: 'string' },
                { type: 'uint256' },
                { type: 'uint256' },
                { type: 'address[]' },
                { type: 'uint256[]' },
                { type: 'string' },
              ],
              [
                t.name,
                t.symbol,
                t.yearlyMintRate,
                t.vestingDuration,
                t.recipients,
                t.amounts,
                t.tokenURI,
              ],
            );
          })();

    let tokenInitHash: Hash;
    if (params.tokenVariant === 'doppler404') {
      const t = params.tokenFactoryData as {
        name: string;
        symbol: string;
        baseURI: string;
      };
      const initData = encodeAbiParameters(
        [
          { type: 'string' },
          { type: 'string' },
          { type: 'uint256' },
          { type: 'address' },
          { type: 'address' },
          { type: 'string' },
        ],
        [
          t.name,
          t.symbol,
          params.initialSupply,
          params.airlock,
          params.airlock,
          t.baseURI,
        ],
      );
      tokenInitHash = keccak256(
        encodePacked(['bytes', 'bytes'], [DopplerDN404Bytecode as Hex, initData]),
      );
    } else {
      const t = params.tokenFactoryData as {
        name: string;
        symbol: string;
        yearlyMintRate: bigint;
        vestingDuration: bigint;
        recipients: Address[];
        amounts: bigint[];
        tokenURI: string;
      };
      const initData = encodeAbiParameters(
        [
          { type: 'string' },
          { type: 'string' },
          { type: 'uint256' },
          { type: 'address' },
          { type: 'address' },
          { type: 'uint256' },
          { type: 'uint256' },
          { type: 'address[]' },
          { type: 'uint256[]' },
          { type: 'string' },
        ],
        [
          t.name,
          t.symbol,
          params.initialSupply,
          params.airlock,
          params.airlock,
          t.yearlyMintRate,
          t.vestingDuration,
          t.recipients,
          t.amounts,
          t.tokenURI,
        ],
      );
      const isTokenFactory80 =
        params.tokenFactory.toLowerCase() === TOKEN_FACTORY_80_ADDRESS;
      tokenInitHash = keccak256(
        encodePacked(
          ['bytes', 'bytes'],
          [
            isTokenFactory80
              ? (DERC2080Bytecode as Hex)
              : (DERC20Bytecode as Hex),
            initData,
          ],
        ),
      );
    }

    const isToken0 = isToken0Expected(params.numeraire);
    const numeraireBigInt = BigInt(params.numeraire);
    const hookBuffer = this.prepareCreate2Buffer(
      params.auctionDeployer,
      hookInitHash,
    );
    const tokenBuffer = this.prepareCreate2Buffer(params.tokenFactory, tokenInitHash);

    for (let salt = 0n; salt < ONE_MILLION; salt++) {
      this.updateSaltInBuffer(hookBuffer, salt);
      const hookRaw = this.computeCreate2AddressFast(hookBuffer);
      if ((BigInt(hookRaw) & FLAG_MASK) !== OPENING_AUCTION_FLAGS) {
        continue;
      }

      this.updateSaltInBuffer(tokenBuffer, salt);
      const tokenRaw = this.computeCreate2AddressFast(tokenBuffer);
      const tokenBigInt = BigInt(tokenRaw);
      if (
        (isToken0 && tokenBigInt < numeraireBigInt) ||
        (!isToken0 && tokenBigInt > numeraireBigInt)
      ) {
        return [
          `0x${salt.toString(16).padStart(64, '0')}` as Hash,
          getAddress(hookRaw) as Address,
          getAddress(tokenRaw) as Address,
          encodedTokenFactoryData,
        ];
      }
    }

    throw new Error('Unable to mine opening auction salt');
  }

  private async resolveCreateGasEstimate(args: {
    request?: unknown;
    address: Address;
    createParams: CreateParams;
    account?: Address | Account;
  }): Promise<bigint | undefined> {
    const { request, address, createParams, account } = args;
    const gasFromRequest =
      request &&
      typeof request === 'object' &&
      'gas' in (request as Record<string, unknown>)
        ? (request as { gas?: bigint }).gas
        : undefined;

    if (gasFromRequest) {
      return gasFromRequest;
    }

    try {
      const estimated = await (
        this.publicClient as PublicClient
      ).estimateContractGas({
        address,
        abi: airlockAbi,
        functionName: 'create',
        args: [{ ...createParams }],
        account,
      });
      return estimated;
    } catch {
      return undefined;
    }
  }

  private isDoppler404Token(
    token: TokenConfig,
  ): token is Doppler404TokenConfig {
    return (token as Doppler404TokenConfig).type === 'doppler404';
  }

  /**
   * Encode migration data based on the MigrationConfig
   * This replaces the manual encoding methods from the old SDKs
   */
  private encodeMigrationData(config: MigrationConfig): Hex {
    // Use custom encoder if available
    if (this.customMigrationEncoder) {
      return this.customMigrationEncoder(config);
    }

    switch (config.type) {
      case 'uniswapV2':
        // V2 migrator expects empty data
        return '0x' as Hex;

      case 'noOp':
        // NoOp migrator expects empty data
        return '0x' as Hex;

      case 'uniswapV4':
        // Encode V4 migration data with optional streamable fees config
        // When streamableFees is omitted, mirror legacy SDK behaviour by emitting an empty payload
        const streamableFees = config.streamableFees;
        if (!streamableFees) {
          // Default V4 migrator behaviour: no additional payload required
          return '0x';
        }

        // Copy beneficiaries and sort by address in ascending order (required by contract)
        const beneficiaryData = [...streamableFees.beneficiaries].sort(
          (a, b) => {
            const addrA = a.beneficiary.toLowerCase();
            const addrB = b.beneficiary.toLowerCase();
            return addrA < addrB ? -1 : addrA > addrB ? 1 : 0;
          },
        );

        // Note: The contract will validate that the airlock owner gets at least 5%
        // If not present, the SDK user should add it manually

        return encodeAbiParameters(
          [
            { type: 'uint24' }, // fee
            { type: 'int24' }, // tickSpacing
            { type: 'uint32' }, // lockDuration (0 if no streamableFees)
            {
              type: 'tuple[]',
              components: [
                { type: 'address', name: 'beneficiary' },
                { type: 'uint96', name: 'shares' },
              ],
            },
          ],
          [
            config.fee,
            config.tickSpacing,
            streamableFees.lockDuration,
            beneficiaryData,
          ],
        );

      default:
        throw new Error('Unknown migration type');
    }
  }

  /**
   * Encode create params for Uniswap V4 Multicurve initializer/migrator flow
   */
  encodeCreateMulticurveParams(
    params: CreateMulticurveParams<C>,
  ): CreateParams {
    // Validate parameters
    this.validateMulticurveParams(params);

    // Basic validation
    if (!params.pool || params.pool.curves.length === 0) {
      throw new Error('Multicurve pool must include at least one curve');
    }

    const normalizedCurves = this.normalizeMulticurveCurves(
      params.pool.curves,
      params.pool.tickSpacing,
    );

    const addresses = getAddresses(this.chainId);

    // Pool initializer data: (fee, tickSpacing, farTick, curves[], beneficiaries[], dopplerHook, onInitializationCalldata, graduationCalldata)
    const sortedBeneficiaries = (params.pool.beneficiaries ?? [])
      .slice()
      .sort(
        (
          a: NonNullable<typeof params.pool.beneficiaries>[number],
          b: NonNullable<typeof params.pool.beneficiaries>[number],
        ) => {
          const aAddr = a.beneficiary.toLowerCase();
          const bAddr = b.beneficiary.toLowerCase();
          return aAddr < bAddr ? -1 : aAddr > bAddr ? 1 : 0;
        },
      );

    const useScheduledInitializer = params.schedule !== undefined;
    const useDopplerHook = params.dopplerHook !== undefined;
    // Allow using DopplerHookInitializer even without a hook if explicitly overridden
    const useDopplerHookInitializer =
      useDopplerHook || params.modules?.dopplerHookInitializer !== undefined;

    let scheduleStartTime: number | undefined;
    if (useScheduledInitializer) {
      scheduleStartTime = Number(params.schedule!.startTime);
      if (
        !Number.isFinite(scheduleStartTime) ||
        !Number.isInteger(scheduleStartTime)
      ) {
        throw new Error(
          'Scheduled multicurve startTime must be an integer number of seconds since Unix epoch',
        );
      }
      if (scheduleStartTime < 0) {
        throw new Error('Scheduled multicurve startTime cannot be negative');
      }
      const UINT32_MAX = 0xffffffff;
      if (scheduleStartTime > UINT32_MAX) {
        throw new Error(
          'Scheduled multicurve startTime must fit within uint32 (seconds since Unix epoch up to year 2106)',
        );
      }
    }

    // Validate dopplerHook fee distribution if provided
    if (useDopplerHook) {
      const hook = params.dopplerHook!;
      const totalDistribution =
        hook.assetBuybackPercentWad +
        hook.numeraireBuybackPercentWad +
        hook.beneficiaryPercentWad +
        hook.lpPercentWad;
      if (totalDistribution !== WAD) {
        throw new Error(
          `DopplerHook fee distribution must sum to ${WAD} (100%), but got ${totalDistribution}`,
        );
      }
    }

    // Shared curve and beneficiary component definitions for ABI encoding
    const curveComponents = [
      { type: 'int24', name: 'tickLower' },
      { type: 'int24', name: 'tickUpper' },
      { type: 'uint16', name: 'numPositions' },
      { type: 'uint256', name: 'shares' },
    ];
    const beneficiaryComponents = [
      { type: 'address', name: 'beneficiary' },
      { type: 'uint96', name: 'shares' },
    ];

    // Prepare curve and beneficiary data (shared across all initializer formats)
    const curvesData = normalizedCurves.map(
      (c: (typeof normalizedCurves)[number]) => ({
        tickLower: c.tickLower,
        tickUpper: c.tickUpper,
        numPositions: c.numPositions,
        shares: c.shares,
      }),
    );
    const beneficiariesData = sortedBeneficiaries.map(
      (b: NonNullable<typeof params.pool.beneficiaries>[number]) => ({
        beneficiary: b.beneficiary,
        shares: b.shares,
      }),
    );

    // Encode pool initializer data based on which initializer is being used
    // Each initializer expects a different InitData struct format:
    //
    // UniswapV4MulticurveInitializer (basic):
    //   struct InitData { uint24 fee; int24 tickSpacing; Curve[] curves; BeneficiaryData[] beneficiaries; }
    //
    // UniswapV4ScheduledMulticurveInitializer:
    //   struct InitData { uint24 fee; int24 tickSpacing; Curve[] curves; BeneficiaryData[] beneficiaries; uint32 startingTime; }
    //
    // DopplerHookInitializer:
    //   struct InitData { uint24 fee; int24 tickSpacing; int24 farTick; Curve[] curves; BeneficiaryData[] beneficiaries;
    //                     address dopplerHook; bytes onInitializationDopplerHookCalldata; bytes graduationDopplerHookCalldata; }

    let poolInitializerData: Hex;

    if (useDopplerHookInitializer) {
      // DopplerHookInitializer format (8 fields)
      // Calculate farTick: use provided value from dopplerHook, or auto-calculate from curves
      let farTick: number;
      if (params.dopplerHook?.farTick !== undefined) {
        farTick = params.dopplerHook.farTick;
      } else {
        // Auto-calculate from curves (max tickUpper)
        const allTickUppers = params.pool.curves.map((c) => c.tickUpper);
        farTick = Math.max(...allTickUppers);
      }

      // Encode dopplerHook initialization calldata if provided
      let onInitializationDopplerHookCalldata: Hex = '0x';
      let graduationDopplerHookCalldata: Hex = '0x';
      let dopplerHookAddress: Address = ZERO_ADDRESS;

      if (useDopplerHook) {
        const hook = params.dopplerHook!;
        dopplerHookAddress = hook.hookAddress;
        onInitializationDopplerHookCalldata = encodeAbiParameters(
          [
            { type: 'address' }, // numeraire
            { type: 'address' }, // buybackDst
            { type: 'uint24' }, // customFee
            { type: 'uint256' }, // assetBuybackPercentWad
            { type: 'uint256' }, // numeraireBuybackPercentWad
            { type: 'uint256' }, // beneficiaryPercentWad
            { type: 'uint256' }, // lpPercentWad
          ],
          [
            params.sale.numeraire,
            hook.buybackDestination,
            hook.customFee,
            hook.assetBuybackPercentWad,
            hook.numeraireBuybackPercentWad,
            hook.beneficiaryPercentWad,
            hook.lpPercentWad,
          ],
        );
        graduationDopplerHookCalldata = hook.graduationCalldata ?? '0x';
      }

      const dopplerHookTupleComponents = [
        { name: 'fee', type: 'uint24' },
        { name: 'tickSpacing', type: 'int24' },
        { name: 'farTick', type: 'int24' },
        { name: 'curves', type: 'tuple[]', components: curveComponents },
        {
          name: 'beneficiaries',
          type: 'tuple[]',
          components: beneficiaryComponents,
        },
        { name: 'dopplerHook', type: 'address' },
        { name: 'onInitializationDopplerHookCalldata', type: 'bytes' },
        { name: 'graduationDopplerHookCalldata', type: 'bytes' },
      ];

      poolInitializerData = encodeAbiParameters(
        [{ type: 'tuple', components: dopplerHookTupleComponents }],
        [
          {
            fee: params.pool.fee,
            tickSpacing: params.pool.tickSpacing,
            farTick,
            curves: curvesData,
            beneficiaries: beneficiariesData,
            dopplerHook: dopplerHookAddress,
            onInitializationDopplerHookCalldata,
            graduationDopplerHookCalldata,
          },
        ],
      );
    } else if (useScheduledInitializer) {
      // UniswapV4ScheduledMulticurveInitializer format (5 fields)
      const scheduledTupleComponents = [
        { name: 'fee', type: 'uint24' },
        { name: 'tickSpacing', type: 'int24' },
        { name: 'curves', type: 'tuple[]', components: curveComponents },
        {
          name: 'beneficiaries',
          type: 'tuple[]',
          components: beneficiaryComponents,
        },
        { name: 'startingTime', type: 'uint32' },
      ];

      poolInitializerData = encodeAbiParameters(
        [{ type: 'tuple', components: scheduledTupleComponents }],
        [
          {
            fee: params.pool.fee,
            tickSpacing: params.pool.tickSpacing,
            curves: curvesData,
            beneficiaries: beneficiariesData,
            startingTime: scheduleStartTime!,
          },
        ],
      );
    } else {
      // UniswapV4MulticurveInitializer format (4 fields - basic)
      const basicTupleComponents = [
        { name: 'fee', type: 'uint24' },
        { name: 'tickSpacing', type: 'int24' },
        { name: 'curves', type: 'tuple[]', components: curveComponents },
        {
          name: 'beneficiaries',
          type: 'tuple[]',
          components: beneficiaryComponents,
        },
      ];

      poolInitializerData = encodeAbiParameters(
        [{ type: 'tuple', components: basicTupleComponents }],
        [
          {
            fee: params.pool.fee,
            tickSpacing: params.pool.tickSpacing,
            curves: curvesData,
            beneficiaries: beneficiariesData,
          },
        ],
      );
    }

    // Token factory data (standard vs 404)
    let tokenFactoryData: Hex;
    if (this.isDoppler404Token(params.token)) {
      const token404 = params.token;
      const unit = token404.unit !== undefined ? BigInt(token404.unit) : 1000n;
      tokenFactoryData = encodeAbiParameters(
        [
          { type: 'string' },
          { type: 'string' },
          { type: 'string' },
          { type: 'uint256' },
        ],
        [token404.name, token404.symbol, token404.baseURI, unit],
      );
    } else {
      const tokenStd = params.token as StandardTokenConfig;
      const vestingDuration = params.vesting?.duration ?? BigInt(0);
      const yearlyMintRate =
        tokenStd.yearlyMintRate ?? DEFAULT_V3_YEARLY_MINT_RATE;

      // Handle vesting recipients and amounts
      let vestingRecipients: Address[] = [];
      let vestingAmounts: bigint[] = [];

      if (params.vesting) {
        if (params.vesting.recipients && params.vesting.amounts) {
          // Use provided recipients and amounts
          vestingRecipients = params.vesting.recipients;
          vestingAmounts = params.vesting.amounts;
        } else {
          // Default: vest all non-sold tokens to userAddress
          vestingRecipients = [params.userAddress];
          vestingAmounts = [
            params.sale.initialSupply - params.sale.numTokensToSell,
          ];
        }
      }

      tokenFactoryData = encodeAbiParameters(
        [
          { type: 'string' },
          { type: 'string' },
          { type: 'uint256' },
          { type: 'uint256' },
          { type: 'address[]' },
          { type: 'uint256[]' },
          { type: 'string' },
        ],
        [
          tokenStd.name,
          tokenStd.symbol,
          yearlyMintRate,
          BigInt(vestingDuration),
          vestingRecipients,
          vestingAmounts,
          tokenStd.tokenURI,
        ],
      );
    }

    // Governance factory data
    const governanceFactoryData: Hex = (() => {
      if (params.governance.type === 'noOp') {
        return '0x' as Hex;
      }
      if (params.governance.type === 'launchpad') {
        return encodeAbiParameters(
          [{ type: 'address' }],
          [params.governance.multisig],
        );
      }
      return encodeAbiParameters(
        [
          { type: 'string' },
          { type: 'uint48' },
          { type: 'uint32' },
          { type: 'uint256' },
        ],
        [
          params.token.name,
          params.governance.type === 'custom'
            ? params.governance.initialVotingDelay
            : DEFAULT_V4_INITIAL_VOTING_DELAY,
          params.governance.type === 'custom'
            ? params.governance.initialVotingPeriod
            : DEFAULT_V4_INITIAL_VOTING_PERIOD,
          params.governance.type === 'custom'
            ? params.governance.initialProposalThreshold
            : DEFAULT_V4_INITIAL_PROPOSAL_THRESHOLD,
        ],
      );
    })();

    // Resolve module addresses
    const salt = this.generateRandomSalt(params.userAddress);
    const resolvedTokenFactory: Address | undefined =
      params.modules?.tokenFactory ??
      (this.isDoppler404Token(params.token)
        ? (addresses.doppler404Factory as Address | undefined)
        : addresses.tokenFactory);
    if (!resolvedTokenFactory || resolvedTokenFactory === ZERO_ADDRESS) {
      throw new Error(
        'Token factory address not configured. Provide an explicit address or ensure chain config includes a valid factory.',
      );
    }

    const resolvedInitializer: Address | undefined = (() => {
      if (useDopplerHookInitializer) {
        return (
          params.modules?.dopplerHookInitializer ??
          addresses.dopplerHookInitializer
        );
      }
      if (useScheduledInitializer) {
        return (
          params.modules?.v4ScheduledMulticurveInitializer ??
          addresses.v4ScheduledMulticurveInitializer
        );
      }
      return (
        params.modules?.v4MulticurveInitializer ??
        addresses.v4MulticurveInitializer
      );
    })();
    if (!resolvedInitializer || resolvedInitializer === ZERO_ADDRESS) {
      if (useDopplerHookInitializer) {
        throw new Error(
          'DopplerHookInitializer address not configured on this chain. Override via builder.withDopplerHookInitializer() or update chain config.',
        );
      }
      throw new Error(
        useScheduledInitializer
          ? 'Scheduled multicurve initializer address not configured on this chain. Override via builder or update chain config.'
          : 'Multicurve initializer address not configured on this chain. Override via builder or update chain config.',
      );
    }

    // When beneficiaries are provided, use NoOpMigrator with empty data
    // The beneficiaries will be handled by the multicurve initializer, not the migrator
    const hasBeneficiaries =
      params.pool.beneficiaries && params.pool.beneficiaries.length > 0;

    let liquidityMigratorData: Hex;
    let resolvedMigrator: Address | undefined;

    if (hasBeneficiaries) {
      // Use NoOpMigrator with empty data when beneficiaries are provided
      liquidityMigratorData = '0x' as Hex;
      resolvedMigrator = params.modules?.noOpMigrator ?? addresses.noOpMigrator;
      if (!resolvedMigrator || resolvedMigrator === ZERO_ADDRESS) {
        throw new Error(
          'NoOpMigrator address not configured on this chain. Override via modules.noOpMigrator or update chain config.',
        );
      }
    } else {
      // Use standard migration flow when no beneficiaries
      liquidityMigratorData = this.encodeMigrationData(params.migration);
      resolvedMigrator = this.getMigratorAddress(
        params.migration,
        params.modules,
      );
      if (!resolvedMigrator || resolvedMigrator === ZERO_ADDRESS) {
        throw new Error(
          'Migrator address not configured on this chain. Override via builder or update chain config.',
        );
      }
    }

    const governanceFactoryAddress: Address = (() => {
      if (params.governance.type === 'noOp') {
        const resolved =
          params.modules?.governanceFactory ??
          addresses.noOpGovernanceFactory ??
          ZERO_ADDRESS;
        if (!resolved || resolved === ZERO_ADDRESS) {
          throw new Error(
            'No-op governance requested, but no-op governanceFactory is not configured on this chain.',
          );
        }
        return resolved;
      }
      if (params.governance.type === 'launchpad') {
        const resolved =
          params.modules?.governanceFactory ??
          addresses.launchpadGovernanceFactory ??
          ZERO_ADDRESS;
        if (!resolved || resolved === ZERO_ADDRESS) {
          throw new Error(
            'Launchpad governance requested, but launchpadGovernanceFactory is not configured on this chain.',
          );
        }
        return resolved;
      }
      const resolved =
        params.modules?.governanceFactory ?? addresses.governanceFactory;
      if (!resolved || resolved === ZERO_ADDRESS) {
        throw new Error(
          'Standard governance requested but governanceFactory is not deployed on this chain.',
        );
      }
      return resolved;
    })();

    const createParams: CreateParams = {
      initialSupply: params.sale.initialSupply,
      numTokensToSell: params.sale.numTokensToSell,
      numeraire: params.sale.numeraire,
      tokenFactory: resolvedTokenFactory,
      tokenFactoryData,
      governanceFactory: governanceFactoryAddress,
      governanceFactoryData,
      poolInitializer: resolvedInitializer,
      poolInitializerData,
      liquidityMigrator: resolvedMigrator,
      liquidityMigratorData,
      integrator: params.integrator ?? ZERO_ADDRESS,
      salt,
    };

    return createParams;
  }

  async simulateCreateMulticurve(params: CreateMulticurveParams<C>): Promise<{
    createParams: CreateParams;
    tokenAddress: Address;
    poolId: Hex;
    gasEstimate?: bigint;
    /** Execute the create with the same params used in simulation (guarantees address match) */
    execute: () => Promise<{
      tokenAddress: Address;
      poolId: Hex;
      transactionHash: string;
    }>;
  }> {
    const addresses = getAddresses(this.chainId);
    const createParams = this.encodeCreateMulticurveParams(params);
    const airlockAddress = params.modules?.airlock ?? addresses.airlock;
    const { request, result } = await (
      this.publicClient as PublicClient
    ).simulateContract({
      address: airlockAddress,
      abi: airlockAbi,
      functionName: 'create',
      args: [{ ...createParams }],
      account: this.walletClient?.account,
    });
    const simResult = result as readonly unknown[] | undefined;
    const gasEstimate = await this.resolveCreateGasEstimate({
      request,
      address: airlockAddress,
      createParams,
      account: this.walletClient?.account ?? params.userAddress,
    });
    if (!simResult || !Array.isArray(simResult) || simResult.length < 2) {
      throw new Error('Failed to simulate multicurve create');
    }

    // simResult[0] is "asset" in contract terminology, we call it tokenAddress for SDK consistency
    const tokenAddress = simResult[0] as Address;
    const poolId = await this.computeMulticurvePoolId(params, tokenAddress);

    return {
      createParams,
      tokenAddress,
      poolId,
      gasEstimate,
      execute: () =>
        this.createMulticurve(params, { _createParams: createParams }),
    };
  }

  async createMulticurve(
    params: CreateMulticurveParams<C>,
    options?: { _createParams?: CreateParams },
  ): Promise<{ tokenAddress: Address; poolId: Hex; transactionHash: string }> {
    const addresses = getAddresses(this.chainId);
    if (!this.walletClient)
      throw new Error('Wallet client required for write operations');

    // Use provided createParams (from simulate) or auto-simulate to get consistent params
    const createParams =
      options?._createParams ??
      (await this.simulateCreateMulticurve(params)).createParams;
    const airlockAddress = params.modules?.airlock ?? addresses.airlock;
    const { request, result } = await (
      this.publicClient as PublicClient
    ).simulateContract({
      address: airlockAddress,
      abi: airlockAbi,
      functionName: 'create',
      args: [{ ...createParams }],
      account: this.walletClient.account,
    });
    const simResult = result as readonly unknown[] | undefined;
    const gasEstimate = await this.resolveCreateGasEstimate({
      request,
      address: airlockAddress,
      createParams,
      account: this.walletClient.account,
    });
    const gas = params.gas ?? gasEstimate ?? DEFAULT_CREATE_GAS_LIMIT;
    const hash = await this.walletClient.writeContract({ ...request, gas });
    const receipt = await (
      this.publicClient as PublicClient
    ).waitForTransactionReceipt({ hash, confirmations: 2 });

    // Always extract actual addresses from event logs (source of truth)
    const actualAddresses = this.extractAddressesFromCreateEvent(receipt);

    if (!actualAddresses) {
      throw new Error(
        'Failed to extract token address from Create event in transaction logs',
      );
    }

    const actualTokenAddress = actualAddresses.tokenAddress;

    // Warn if simulation predicted different address (helps debugging state divergence)
    if (simResult && Array.isArray(simResult) && simResult.length >= 1) {
      const simulatedToken = simResult[0] as Address;
      if (simulatedToken.toLowerCase() !== actualTokenAddress.toLowerCase()) {
        console.warn(
          `[DopplerSDK] Simulation predicted token ${simulatedToken} but actual is ${actualTokenAddress}. ` +
            `This may indicate state divergence between simulation and execution.`,
        );
      }
    }

    // Compute poolId from the PoolKey using actual token address
    const poolId = await this.computeMulticurvePoolId(
      params,
      actualTokenAddress,
    );

    return { tokenAddress: actualTokenAddress, poolId, transactionHash: hash };
  }

  /**
   * Normalize user-provided multicurve positions and ensure they satisfy SDK constraints
   */
  private normalizeMulticurveCurves(
    curves: CreateMulticurveParams['pool']['curves'],
    tickSpacing: number,
  ): CreateMulticurveParams['pool']['curves'] {
    if (tickSpacing <= 0) {
      throw new Error('Tick spacing must be positive');
    }
    if (!curves.length) {
      throw new Error('Multicurve pool must include at least one curve');
    }

    let totalShares = 0n;
    let mostPositiveTickUpper: number | undefined;

    const sanitizedCurves = curves.map((curve) => {
      const sanitized = { ...curve };

      if (
        !Number.isFinite(sanitized.tickLower) ||
        !Number.isFinite(sanitized.tickUpper)
      ) {
        throw new Error('Multicurve ticks must be finite numbers');
      }
      if (sanitized.tickLower >= sanitized.tickUpper) {
        throw new Error(
          'Multicurve curve tickLower must be less than tickUpper',
        );
      }
      if (
        !Number.isInteger(sanitized.numPositions) ||
        sanitized.numPositions <= 0
      ) {
        throw new Error(
          'Multicurve curve numPositions must be a positive integer',
        );
      }
      if (sanitized.shares <= 0n) {
        throw new Error('Multicurve curve shares must be positive');
      }

      totalShares += sanitized.shares;
      if (totalShares > WAD) {
        throw new Error('Total multicurve shares cannot exceed 100% (1e18)');
      }

      if (
        mostPositiveTickUpper === undefined ||
        sanitized.tickUpper > mostPositiveTickUpper
      ) {
        mostPositiveTickUpper = sanitized.tickUpper;
      }

      return sanitized;
    });

    if (totalShares === WAD) {
      return sanitizedCurves;
    }

    const missingShare = WAD - totalShares;
    if (missingShare <= 0n) {
      return sanitizedCurves;
    }

    const fallbackTickLower = mostPositiveTickUpper;
    if (fallbackTickLower === undefined) {
      throw new Error('Unable to determine fallback multicurve tick range');
    }

    const fallbackTickUpper = this.roundMaxTickDown(tickSpacing);

    const fallbackCurve = {
      // Extend from the most positive user tick out to the maximum supported tick bucket
      tickLower: fallbackTickLower,
      tickUpper: fallbackTickUpper,
      numPositions:
        sanitizedCurves[sanitizedCurves.length - 1]?.numPositions ?? 1,
      shares: missingShare,
    };

    return [...sanitizedCurves, fallbackCurve];
  }

  private roundMaxTickDown(tickSpacing: number): number {
    if (tickSpacing <= 0) {
      throw new Error('Tick spacing must be positive');
    }

    const rounded = Math.floor(MAX_TICK / tickSpacing) * tickSpacing;
    return rounded;
  }

  private validateStaticAuctionParams(params: CreateStaticAuctionParams): void {
    // Validate token parameters
    if (!params.token.name || params.token.name.trim().length === 0) {
      throw new Error('Token name is required');
    }
    if (!params.token.symbol || params.token.symbol.trim().length === 0) {
      throw new Error('Token symbol is required');
    }

    // Validate tick range
    if (params.pool.startTick >= params.pool.endTick) {
      throw new Error('Start tick must be less than end tick');
    }

    const tickSpacing = (TICK_SPACINGS as Record<number, number>)[
      params.pool.fee
    ];
    if (tickSpacing === undefined) {
      throw new Error(
        `Unsupported fee tier ${params.pool.fee} for static auctions`,
      );
    }

    if (params.pool.startTick < MIN_TICK || params.pool.endTick > MAX_TICK) {
      throw new Error(
        `Ticks must be within the allowed range (${MIN_TICK} to ${MAX_TICK})`,
      );
    }

    const startTickAligned = params.pool.startTick % tickSpacing === 0;
    const endTickAligned = params.pool.endTick % tickSpacing === 0;
    if (!startTickAligned || !endTickAligned) {
      throw new Error(
        `Pool ticks must be multiples of tick spacing ${tickSpacing} for fee tier ${params.pool.fee}`,
      );
    }

    // Validate sale config
    if (params.sale.initialSupply <= BigInt(0)) {
      throw new Error('Initial supply must be positive');
    }
    if (params.sale.numTokensToSell <= BigInt(0)) {
      throw new Error('Number of tokens to sell must be positive');
    }
    if (params.sale.numTokensToSell > params.sale.initialSupply) {
      throw new Error('Cannot sell more tokens than initial supply');
    }

    // Validate vesting if provided
    if (params.vesting) {
      // Validate recipients and amounts arrays match
      if (params.vesting.recipients && params.vesting.amounts) {
        if (
          params.vesting.recipients.length !== params.vesting.amounts.length
        ) {
          throw new Error(
            'Vesting recipients and amounts arrays must have the same length',
          );
        }
        if (params.vesting.recipients.length === 0) {
          throw new Error('Vesting recipients array cannot be empty');
        }
        // Validate total vested amount doesn't exceed available tokens
        const totalVested = params.vesting.amounts.reduce(
          (sum, amt) => sum + amt,
          BigInt(0),
        );
        const availableForVesting =
          params.sale.initialSupply - params.sale.numTokensToSell;
        if (totalVested > availableForVesting) {
          throw new Error(
            `Total vesting amount (${totalVested}) exceeds available tokens (${availableForVesting})`,
          );
        }
      } else {
        // Default case: validate there are tokens available for vesting
        const vestedAmount =
          params.sale.initialSupply - params.sale.numTokensToSell;
        if (vestedAmount <= BigInt(0)) {
          throw new Error('No tokens available for vesting');
        }
      }
    }

    // Validate migration config
    if (
      params.migration.type === 'uniswapV4' &&
      params.migration.streamableFees
    ) {
      const beneficiaries = params.migration.streamableFees.beneficiaries;
      if (beneficiaries.length === 0) {
        throw new Error(
          'At least one beneficiary is required for V4 migration',
        );
      }

      // Check that shares sum to 100% (WAD)
      const totalShares = beneficiaries.reduce((sum, b) => sum + b.shares, 0n);
      if (totalShares !== WAD) {
        throw new Error(
          `Beneficiary shares must sum to ${WAD} (100%), but got ${totalShares}`,
        );
      }
    }

    // Validate pool beneficiaries for V3 locked pools
    if (params.pool.beneficiaries && params.pool.beneficiaries.length > 0) {
      const beneficiaries = params.pool.beneficiaries;

      // Check that shares sum to 100% (WAD)
      const totalShares = beneficiaries.reduce((sum, b) => sum + b.shares, 0n);
      if (totalShares !== WAD) {
        throw new Error(
          `Pool beneficiary shares must sum to ${WAD} (100%), but got ${totalShares}`,
        );
      }

      // Validate each beneficiary has positive shares
      for (const b of beneficiaries) {
        if (b.shares <= 0n) {
          throw new Error('Each beneficiary must have positive shares');
        }
      }
    }
  }

  /**
   * Validate dynamic auction parameters
   */
  private validateDynamicAuctionParams(
    params: CreateDynamicAuctionParams,
  ): void {
    // Validate token parameters
    if (!params.token.name || params.token.name.trim().length === 0) {
      throw new Error('Token name is required');
    }
    if (!params.token.symbol || params.token.symbol.trim().length === 0) {
      throw new Error('Token symbol is required');
    }

    // Validate tick range
    const isToken0 = isToken0Expected(params.sale.numeraire);
    if (isToken0 && params.auction.startTick <= params.auction.endTick) {
      throw new Error(
        'Start tick must be greater than end tick if base token is currency0',
      );
    }
    if (!isToken0 && params.auction.startTick >= params.auction.endTick) {
      throw new Error(
        'Start tick must be less than end tick if base token is currency1',
      );
    }

    // Validate sale config
    if (params.sale.initialSupply <= BigInt(0)) {
      throw new Error('Initial supply must be positive');
    }
    if (params.sale.numTokensToSell <= BigInt(0)) {
      throw new Error('Number of tokens to sell must be positive');
    }
    if (params.sale.numTokensToSell > params.sale.initialSupply) {
      throw new Error('Cannot sell more tokens than initial supply');
    }

    // Validate auction parameters
    if (params.auction.duration <= 0) {
      throw new Error('Auction duration must be positive');
    }
    if (params.auction.epochLength <= 0) {
      throw new Error('Epoch length must be positive');
    }
    if (params.pool.tickSpacing <= 0) {
      throw new Error('Tick spacing must be positive');
    }

    // Validate tick spacing against Doppler contract constraint
    // @see Doppler.sol line 159: `int24 constant MAX_TICK_SPACING = 30`
    if (params.pool.tickSpacing > DOPPLER_MAX_TICK_SPACING) {
      throw new Error(
        `Dynamic auctions require tickSpacing <= ${DOPPLER_MAX_TICK_SPACING} (Doppler.sol MAX_TICK_SPACING). ` +
          `Got tickSpacing=${params.pool.tickSpacing}. ` +
          `Use withMarketCapRange() which handles this automatically, or use a smaller tickSpacing with poolConfig().`,
      );
    }

    // Validate that total duration is divisible by epoch length
    if (params.auction.duration % params.auction.epochLength !== 0) {
      throw new Error('Epoch length must divide total duration evenly');
    }

    // Validate gamma if provided
    if (params.auction.gamma !== undefined) {
      if (params.auction.gamma % params.pool.tickSpacing !== 0) {
        throw new Error('Gamma must be divisible by tick spacing');
      }
    }

    // Validate migration config
    if (
      params.migration.type === 'uniswapV4' &&
      params.migration.streamableFees
    ) {
      const beneficiaries = params.migration.streamableFees.beneficiaries;
      if (beneficiaries.length === 0) {
        throw new Error(
          'At least one beneficiary is required for V4 migration',
        );
      }

      // Check that shares sum to 100% (WAD)
      const totalShares = beneficiaries.reduce((sum, b) => sum + b.shares, 0n);
      if (totalShares !== WAD) {
        throw new Error(
          `Beneficiary shares must sum to ${WAD} (100%), but got ${totalShares}`,
        );
      }
    }
  }

  private validateOpeningAuctionParams(
    params: CreateOpeningAuctionParams<C>,
  ): void {
    if (!params.token.name || params.token.name.trim().length === 0) {
      throw new Error('Token name is required');
    }
    if (!params.token.symbol || params.token.symbol.trim().length === 0) {
      throw new Error('Token symbol is required');
    }

    if (params.sale.initialSupply <= 0n) {
      throw new Error('Initial supply must be positive');
    }
    if (params.sale.numTokensToSell <= 0n) {
      throw new Error('Number of tokens to sell must be positive');
    }
    if (params.sale.numTokensToSell > params.sale.initialSupply) {
      throw new Error('Cannot sell more tokens than initial supply');
    }

    if (params.openingAuction.shareToAuctionBps <= 0) {
      throw new Error('openingAuction.shareToAuctionBps must be positive');
    }
    if (params.openingAuction.shareToAuctionBps > 10_000) {
      throw new Error('openingAuction.shareToAuctionBps cannot exceed 10_000');
    }
    if (params.openingAuction.incentiveShareBps < 0) {
      throw new Error('openingAuction.incentiveShareBps cannot be negative');
    }
    if (params.openingAuction.incentiveShareBps > 10_000) {
      throw new Error('openingAuction.incentiveShareBps cannot exceed 10_000');
    }
    if (params.openingAuction.auctionDuration <= 0) {
      throw new Error('openingAuction.auctionDuration must be positive');
    }
    if (params.openingAuction.tickSpacing <= 0) {
      throw new Error('openingAuction.tickSpacing must be positive');
    }
    if (params.openingAuction.minLiquidity <= 0n) {
      throw new Error('openingAuction.minLiquidity must be positive');
    }

    if (params.doppler.duration <= 0 || params.doppler.epochLength <= 0) {
      throw new Error('doppler.duration and doppler.epochLength must be positive');
    }
    if (params.doppler.duration % params.doppler.epochLength !== 0) {
      throw new Error('doppler.epochLength must divide doppler.duration evenly');
    }
    if (params.doppler.tickSpacing <= 0) {
      throw new Error('doppler.tickSpacing must be positive');
    }
    if (params.doppler.tickSpacing > DOPPLER_MAX_TICK_SPACING) {
      throw new Error(
        `doppler.tickSpacing must be <= ${DOPPLER_MAX_TICK_SPACING}`,
      );
    }
    if (params.openingAuction.tickSpacing % params.doppler.tickSpacing !== 0) {
      throw new Error(
        `openingAuction.tickSpacing (${params.openingAuction.tickSpacing}) must be divisible by doppler.tickSpacing (${params.doppler.tickSpacing})`,
      );
    }

    const isToken0 = isToken0Expected(params.sale.numeraire);
    if (isToken0 && params.doppler.startTick < params.doppler.endTick) {
      throw new Error(
        'doppler.startTick must be >= doppler.endTick when token is expected as currency0',
      );
    }
    if (!isToken0 && params.doppler.startTick > params.doppler.endTick) {
      throw new Error(
        'doppler.startTick must be <= doppler.endTick when token is expected as currency1',
      );
    }

    if (
      params.doppler.gamma !== undefined &&
      params.doppler.gamma % params.doppler.tickSpacing !== 0
    ) {
      throw new Error('doppler.gamma must be divisible by doppler.tickSpacing');
    }
  }

  /**
   * Validate multicurve auction parameters
   */
  private validateMulticurveParams(params: CreateMulticurveParams<C>): void {
    // Validate token parameters
    if (!params.token.name || params.token.name.trim().length === 0) {
      throw new Error('Token name is required');
    }
    if (!params.token.symbol || params.token.symbol.trim().length === 0) {
      throw new Error('Token symbol is required');
    }

    // Validate sale config
    if (params.sale.initialSupply <= BigInt(0)) {
      throw new Error('Initial supply must be positive');
    }
    if (params.sale.numTokensToSell <= BigInt(0)) {
      throw new Error('Number of tokens to sell must be positive');
    }
    if (params.sale.numTokensToSell > params.sale.initialSupply) {
      throw new Error('Cannot sell more tokens than initial supply');
    }

    // Validate vesting if provided
    if (params.vesting) {
      // Validate recipients and amounts arrays match
      if (params.vesting.recipients && params.vesting.amounts) {
        if (
          params.vesting.recipients.length !== params.vesting.amounts.length
        ) {
          throw new Error(
            'Vesting recipients and amounts arrays must have the same length',
          );
        }
        if (params.vesting.recipients.length === 0) {
          throw new Error('Vesting recipients array cannot be empty');
        }
        // Validate total vested amount doesn't exceed available tokens
        const totalVested = params.vesting.amounts.reduce(
          (sum, amt) => sum + amt,
          BigInt(0),
        );
        const availableForVesting =
          params.sale.initialSupply - params.sale.numTokensToSell;
        if (totalVested > availableForVesting) {
          throw new Error(
            `Total vesting amount (${totalVested}) exceeds available tokens (${availableForVesting})`,
          );
        }
      }
    }

    // Validate pool beneficiaries if provided
    if (params.pool.beneficiaries && params.pool.beneficiaries.length > 0) {
      const beneficiaries = params.pool.beneficiaries;
      const totalShares = beneficiaries.reduce((sum, b) => sum + b.shares, 0n);
      if (totalShares !== WAD) {
        throw new Error(
          `Pool beneficiary shares must sum to ${WAD} (100%), but got ${totalShares}`,
        );
      }
      for (const b of beneficiaries) {
        if (b.shares <= 0n) {
          throw new Error('Each beneficiary must have positive shares');
        }
      }
    }

    // Validate migration config for V4
    if (
      params.migration.type === 'uniswapV4' &&
      params.migration.streamableFees
    ) {
      const beneficiaries = params.migration.streamableFees.beneficiaries;
      if (beneficiaries.length === 0) {
        throw new Error(
          'At least one beneficiary is required for V4 migration',
        );
      }
      const totalShares = beneficiaries.reduce((sum, b) => sum + b.shares, 0n);
      if (totalShares !== WAD) {
        throw new Error(
          `Beneficiary shares must sum to ${WAD} (100%), but got ${totalShares}`,
        );
      }
    }
  }

  /**
   * Get the airlock contract address for the current chain
   */
  private getAirlockAddress(): Address {
    const addresses = getAddresses(this.chainId);
    return addresses.airlock;
  }

  /**
   * Get the appropriate initializer address based on auction type
   */
  private getInitializerAddress(isStatic: boolean): Address {
    const addresses = getAddresses(this.chainId);
    return isStatic ? addresses.v3Initializer : addresses.v4Initializer;
  }

  /**
   * Get the Bundler contract address for the current chain
   * Used to perform atomic create + swap ("bundle") flows for static auctions
   */
  private getBundlerAddress(): Address {
    const addresses = getAddresses(this.chainId);
    const addr = addresses.bundler;
    if (!addr || addr === zeroAddress) {
      throw new Error('Bundler address not configured for this chain');
    }
    return addr;
  }

  /**
   * Get the appropriate migrator address based on migration config
   * Allows override via ModuleAddressOverrides when provided in params.
   */
  private getMigratorAddress(
    config: MigrationConfig,
    overrides?: ModuleAddressOverrides,
  ): Address {
    const addresses = getAddresses(this.chainId);

    switch (config.type) {
      case 'uniswapV2':
        return overrides?.v2Migrator ?? addresses.v2Migrator;
      case 'uniswapV4': {
        const v4Address = overrides?.v4Migrator ?? addresses.v4Migrator;
        if (v4Address === '0x0000000000000000000000000000000000000000') {
          throw new Error(
            'UniswapV4Migrator not deployed on this chain. Use uniswapV2 migration or provide override via modules.v4Migrator.',
          );
        }
        return v4Address;
      }
      case 'noOp': {
        const noOpAddress = overrides?.noOpMigrator ?? addresses.noOpMigrator;
        if (!noOpAddress) {
          throw new Error(
            'NoOpMigrator not configured on this chain. Provide override via modules.noOpMigrator or update chain config.',
          );
        }
        return noOpAddress;
      }

      default:
        throw new Error('Unknown migration type');
    }
  }

  // computeTicks moved to builders. No longer needed here.
  // computeOptimalGamma moved to utils.

  // -----------------------------
  // Bundler helpers (Static/V3)
  // -----------------------------

  /**
   * Simulate a bundle with exact input on Uniswap V3 as part of create
   * Returns the expected output amount for the provided exact input.
   */
  async simulateBundleExactInput(
    createParams: CreateParams,
    params: {
      tokenIn: Address;
      tokenOut: Address;
      amountIn: bigint;
      fee: number;
      sqrtPriceLimitX96: bigint;
    },
  ): Promise<bigint> {
    const bundler = this.getBundlerAddress();
    const { result } = await (
      this.publicClient as PublicClient
    ).simulateContract({
      address: bundler,
      abi: bundlerAbi,
      functionName: 'simulateBundleExactIn',
      args: [
        { ...createParams },
        {
          tokenIn: params.tokenIn,
          tokenOut: params.tokenOut,
          amountIn: params.amountIn,
          fee: params.fee,
          sqrtPriceLimitX96: params.sqrtPriceLimitX96,
        },
      ],
    });
    return result as unknown as bigint;
  }

  /**
   * Simulate a bundle with exact output on Uniswap V3 as part of create
   * Returns the required input amount for the provided exact output.
   */
  async simulateBundleExactOutput(
    createParams: CreateParams,
    params: {
      tokenIn: Address;
      tokenOut: Address;
      amount: bigint;
      fee: number;
      sqrtPriceLimitX96: bigint;
    },
  ): Promise<bigint> {
    const bundler = this.getBundlerAddress();
    const { result } = await (
      this.publicClient as PublicClient
    ).simulateContract({
      address: bundler,
      abi: bundlerAbi,
      functionName: 'simulateBundleExactOut',
      args: [
        { ...createParams },
        {
          tokenIn: params.tokenIn,
          tokenOut: params.tokenOut,
          amount: params.amount,
          fee: params.fee,
          sqrtPriceLimitX96: params.sqrtPriceLimitX96,
        },
      ],
    });
    return result as unknown as bigint;
  }

  // Bundler helpers (Multicurve/V4)
  async simulateMulticurveBundleExactOut(
    createParams: CreateParams,
    params?: {
      exactAmountOut?: bigint;
    },
  ): Promise<MulticurveBundleExactOutResult> {
    const bundler = this.getBundlerAddress();
    await this.ensureMulticurveBundlerSupport(bundler);
    const exactAmountOut = params?.exactAmountOut ?? 0n;
    this.ensureUint128(exactAmountOut, 'exactAmountOut', { allowZero: true });
    const hookData = '0x' as Hex;

    const { result } = await (
      this.publicClient as PublicClient
    ).simulateContract({
      address: bundler,
      abi: bundlerAbi,
      functionName: 'simulateMulticurveBundleExactOut',
      args: [{ ...createParams }, exactAmountOut, hookData],
    });

    const { asset, poolKey, amount, gasEstimate } =
      this.parseMulticurveBundleResult(result);

    return {
      asset,
      poolKey,
      amountIn: amount,
      gasEstimate,
    };
  }

  async simulateMulticurveBundleExactIn(
    createParams: CreateParams,
    params: {
      exactAmountIn: bigint;
    },
  ): Promise<MulticurveBundleExactInResult> {
    const bundler = this.getBundlerAddress();
    await this.ensureMulticurveBundlerSupport(bundler);
    if (params.exactAmountIn === undefined) {
      throw new Error(
        'exactAmountIn is required for multicurve bundle simulations',
      );
    }
    const exactAmountIn = params.exactAmountIn;
    this.ensureUint128(exactAmountIn, 'exactAmountIn');
    const hookData = '0x' as Hex;

    const { result } = await (
      this.publicClient as PublicClient
    ).simulateContract({
      address: bundler,
      abi: bundlerAbi,
      functionName: 'simulateMulticurveBundleExactIn',
      args: [{ ...createParams }, exactAmountIn, hookData],
    });

    const { asset, poolKey, amount, gasEstimate } =
      this.parseMulticurveBundleResult(result);

    return {
      asset,
      poolKey,
      amountOut: amount,
      gasEstimate,
    };
  }

  /**
   * Execute an atomic create + swap bundle through the Bundler
   * commands/inputs are Universal Router encoded values (e.g., from doppler-router)
   */
  async bundle(
    createParams: CreateParams,
    commands: Hex,
    inputs: Hex[],
    options?: { gas?: bigint; value?: bigint },
  ): Promise<Hash> {
    if (!this.walletClient) {
      throw new Error('Wallet client required for write operations');
    }

    const bundler = this.getBundlerAddress();
    const { request } = await (
      this.publicClient as PublicClient
    ).simulateContract({
      address: bundler,
      abi: bundlerAbi,
      functionName: 'bundle',
      args: [{ ...createParams }, commands, inputs],
      account: this.walletClient.account,
      value: options?.value ?? 0n,
    });
    const gas = options?.gas ?? undefined;
    const tx = await this.walletClient.writeContract(
      gas ? { ...request, gas } : request,
    );
    return tx;
  }

  private ensureUint128(
    value: bigint,
    paramName: string,
    options: { allowZero?: boolean } = {},
  ): void {
    const { allowZero = false } = options;
    if (value < 0n) {
      throw new Error(`${paramName} cannot be negative`);
    }
    if (!allowZero && value === 0n) {
      throw new Error(`${paramName} must be greater than zero`);
    }
    if (value > MAX_UINT128) {
      throw new Error(`${paramName} exceeds uint128 range`);
    }
  }

  private parseMulticurveBundleResult(result: unknown): {
    asset: Address;
    poolKey: V4PoolKey;
    amount: bigint;
    gasEstimate: bigint;
  } {
    let asset: Address | undefined;
    let poolKeyRaw: unknown;
    let amount: bigint | undefined;
    let gasEstimate: bigint | undefined;

    if (Array.isArray(result)) {
      if (result.length < 4) {
        throw new Error('Unexpected multicurve bundle simulation result shape');
      }
      asset = result[0] as Address;
      poolKeyRaw = result[1];
      amount = result[2] as bigint;
      gasEstimate = result[3] as bigint;
    } else if (result && typeof result === 'object') {
      const obj = result as Record<string, unknown>;
      asset = obj.asset as Address | undefined;
      poolKeyRaw = obj.poolKey;
      amount = (obj.amountIn ?? obj.amountOut ?? obj.amount) as
        | bigint
        | undefined;
      gasEstimate = obj.gasEstimate as bigint | undefined;
    } else {
      throw new Error('Unexpected multicurve bundle simulation result format');
    }

    if (
      asset === undefined ||
      poolKeyRaw === undefined ||
      amount === undefined ||
      gasEstimate === undefined
    ) {
      throw new Error('Incomplete multicurve bundle simulation result');
    }

    return {
      asset,
      poolKey: this.normalizePoolKey(poolKeyRaw),
      amount,
      gasEstimate,
    };
  }

  private normalizePoolKey(value: any): V4PoolKey {
    if (Array.isArray(value)) {
      const [currency0, currency1, feeRaw, tickSpacingRaw, hooks] = value as [
        Address,
        Address,
        number | bigint,
        number | bigint,
        Address,
      ];
      const feeValue = Number(feeRaw);
      const tickSpacingValue = Number(tickSpacingRaw);
      if (!Number.isFinite(feeValue) || !Number.isFinite(tickSpacingValue)) {
        throw new Error(
          'Invalid pool key numeric fields in multicurve bundle simulation result',
        );
      }
      return {
        currency0: currency0 as Address,
        currency1: currency1 as Address,
        fee: feeValue,
        tickSpacing: tickSpacingValue,
        hooks: hooks as Address,
      };
    }
    if (value && typeof value === 'object') {
      const { currency0, currency1, fee, tickSpacing, hooks } = value as Record<
        string,
        unknown
      >;
      const feeValue = Number(fee);
      const tickSpacingValue = Number(tickSpacing);
      if (!Number.isFinite(feeValue) || !Number.isFinite(tickSpacingValue)) {
        throw new Error(
          'Invalid pool key numeric fields in multicurve bundle simulation result',
        );
      }
      return {
        currency0: currency0 as Address,
        currency1: currency1 as Address,
        fee: feeValue,
        tickSpacing: tickSpacingValue,
        hooks: hooks as Address,
      };
    }
    throw new Error(
      'Unable to normalize PoolKey from multicurve bundle simulation result',
    );
  }
  /**
   * Mines a salt and hook address with the appropriate flags
   *
   * This method iterates through possible salt values to find a combination that:
   * - Produces a hook address with required Doppler flags
   * - Maintains proper token ordering relative to numeraire
   * - Ensures deterministic deployment addresses
   *
   * @param params - Parameters for hook address mining
   * @returns Tuple of [salt, hook address, token address, pool data, token data]
   * @throws {Error} If no valid salt can be found within the search limit
   * @private
   */
  private mineHookAddress(params: {
    airlock: Address;
    poolManager: Address;
    deployer: Address;
    initialSupply: bigint;
    numTokensToSell: bigint;
    numeraire: Address;
    tokenFactory: Address;
    tokenFactoryData:
      | {
          name: string;
          symbol: string;
          baseURI: string;
          unit?: bigint;
        }
      | {
          name: string;
          symbol: string;
          initialSupply: bigint;
          airlock: Address;
          yearlyMintRate: bigint;
          vestingDuration: bigint;
          recipients: Address[];
          amounts: bigint[];
          tokenURI: string;
        };
    poolInitializer: Address;
    poolInitializerData: {
      minimumProceeds: bigint;
      maximumProceeds: bigint;
      startingTime: bigint;
      endingTime: bigint;
      startingTick: number;
      endingTick: number;
      epochLength: bigint;
      gamma: number;
      numPDSlugs: bigint;
      fee: number;
      tickSpacing: number;
    };
    customDerc20Bytecode?: `0x${string}`;
    tokenVariant?: 'standard' | 'doppler404';
  }): [Hash, Address, Address, Hex, Hex] {
    const isToken0 = isToken0Expected(params.numeraire);

    const {
      minimumProceeds,
      maximumProceeds,
      startingTime,
      endingTime,
      startingTick,
      endingTick,
      epochLength,
      gamma,
      numPDSlugs,
      fee,
      tickSpacing,
    } = params.poolInitializerData;

    const poolInitializerData = encodeAbiParameters(
      [
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'int24' },
        { type: 'int24' },
        { type: 'uint256' },
        { type: 'int24' },
        { type: 'bool' },
        { type: 'uint256' },
        { type: 'uint24' },
        { type: 'int24' },
      ],
      [
        minimumProceeds,
        maximumProceeds,
        startingTime,
        endingTime,
        startingTick,
        endingTick,
        epochLength,
        gamma,
        isToken0,
        numPDSlugs,
        fee,
        tickSpacing,
      ],
    );

    const { poolManager, numTokensToSell, poolInitializer } = params;

    const hookInitHashData = encodeAbiParameters(
      [
        { type: 'address' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'int24' },
        { type: 'int24' },
        { type: 'uint256' },
        { type: 'int24' },
        { type: 'bool' },
        { type: 'uint256' },
        { type: 'address' },
        { type: 'uint24' },
      ],
      [
        poolManager,
        numTokensToSell,
        minimumProceeds,
        maximumProceeds,
        startingTime,
        endingTime,
        startingTick,
        endingTick,
        epochLength,
        gamma,
        isToken0,
        numPDSlugs,
        poolInitializer,
        fee,
      ],
    );

    const hookInitHash = keccak256(
      encodePacked(
        ['bytes', 'bytes'],
        [DopplerBytecode as Hex, hookInitHashData],
      ),
    );

    const tokenFactoryData =
      params.tokenVariant === 'doppler404'
        ? (() => {
            const t = params.tokenFactoryData as {
              name: string;
              symbol: string;
              baseURI: string;
              unit?: bigint;
            };
            return encodeAbiParameters(
              [
                { type: 'string' },
                { type: 'string' },
                { type: 'string' },
                { type: 'uint256' },
              ],
              [t.name, t.symbol, t.baseURI, t.unit ?? 1000n],
            );
          })()
        : (() => {
            const {
              name,
              symbol,
              yearlyMintRate,
              vestingDuration,
              recipients,
              amounts,
              tokenURI,
            } = params.tokenFactoryData as {
              name: string;
              symbol: string;
              initialSupply: bigint;
              airlock: Address;
              yearlyMintRate: bigint;
              vestingDuration: bigint;
              recipients: Address[];
              amounts: bigint[];
              tokenURI: string;
            };
            return encodeAbiParameters(
              [
                { type: 'string' },
                { type: 'string' },
                { type: 'uint256' },
                { type: 'uint256' },
                { type: 'address[]' },
                { type: 'uint256[]' },
                { type: 'string' },
              ],
              [
                name,
                symbol,
                yearlyMintRate,
                vestingDuration,
                recipients,
                amounts,
                tokenURI,
              ],
            );
          })();

    // Compute token init hash; use DN404 bytecode if tokenVariant is doppler404
    let tokenInitHash: Hash | undefined;
    if (params.tokenVariant === 'doppler404') {
      const { name, symbol, baseURI } = params.tokenFactoryData as {
        name: string;
        symbol: string;
        baseURI: string;
        unit?: bigint;
      };
      const { airlock, initialSupply } = params;
      // DN404 constructor: (name, symbol, initialSupply, recipient, owner, baseURI)
      const initHashData = encodeAbiParameters(
        [
          { type: 'string' },
          { type: 'string' },
          { type: 'uint256' },
          { type: 'address' },
          { type: 'address' },
          { type: 'string' },
        ],
        [name, symbol, initialSupply, airlock, airlock, baseURI],
      );
      tokenInitHash = keccak256(
        encodePacked(
          ['bytes', 'bytes'],
          [DopplerDN404Bytecode as Hex, initHashData],
        ),
      );
    } else {
      const {
        name,
        symbol,
        yearlyMintRate,
        vestingDuration,
        recipients,
        amounts,
        tokenURI,
      } = params.tokenFactoryData as {
        name: string;
        symbol: string;
        initialSupply: bigint;
        airlock: Address;
        yearlyMintRate: bigint;
        vestingDuration: bigint;
        recipients: Address[];
        amounts: bigint[];
        tokenURI: string;
      };
      const { airlock, initialSupply } = params;
      const initHashData = encodeAbiParameters(
        [
          { type: 'string' },
          { type: 'string' },
          { type: 'uint256' },
          { type: 'address' },
          { type: 'address' },
          { type: 'uint256' },
          { type: 'uint256' },
          { type: 'address[]' },
          { type: 'uint256[]' },
          { type: 'string' },
        ],
        [
          name,
          symbol,
          initialSupply,
          airlock,
          airlock,
          yearlyMintRate,
          vestingDuration,
          recipients,
          amounts,
          tokenURI,
        ],
      );
      // Use DERC2080Bytecode for TokenFactory80, DERC20Bytecode otherwise
      const isTokenFactory80 =
        params.tokenFactory.toLowerCase() === TOKEN_FACTORY_80_ADDRESS;
      const bytecode = isTokenFactory80
        ? (DERC2080Bytecode as Hex)
        : ((params.customDerc20Bytecode as Hex) ?? (DERC20Bytecode as Hex));

      tokenInitHash = keccak256(
        encodePacked(['bytes', 'bytes'], [bytecode, initHashData]),
      );
    }

    // Use the exact flags from V4 SDK
    const flags = BigInt(
      (1 << 13) | // BEFORE_INITIALIZE_FLAG
        (1 << 12) | // AFTER_INITIALIZE_FLAG
        (1 << 11) | // BEFORE_ADD_LIQUIDITY_FLAG
        (1 << 7) | // BEFORE_SWAP_FLAG
        (1 << 6) | // AFTER_SWAP_FLAG
        (1 << 5), // BEFORE_DONATE_FLAG
    );

    // Pre-compute values outside the loop (optimization)
    const numeraireBigInt = BigInt(params.numeraire);

    // Pre-allocate CREATE2 buffers with constant parts
    const hookBuffer = this.prepareCreate2Buffer(params.deployer, hookInitHash);
    const tokenBuffer = tokenInitHash
      ? this.prepareCreate2Buffer(params.tokenFactory, tokenInitHash)
      : null;

    for (let salt = 0n; salt < 1_000_000n; salt++) {
      // Update salt in pre-computed buffer (avoids string formatting)
      this.updateSaltInBuffer(hookBuffer, salt);

      // Compute hook address using fast method (no checksum)
      const hookRaw = this.computeCreate2AddressFast(hookBuffer);
      const hookBigInt = BigInt(hookRaw);

      // Early termination: skip token computation if hook flags don't match
      // Only ~1 in 8192 addresses match the required flags, so this saves ~50% of keccak256 calls
      if ((hookBigInt & FLAG_MASK) !== flags) {
        continue;
      }

      if (tokenBuffer) {
        // Update salt in token buffer
        this.updateSaltInBuffer(tokenBuffer, salt);

        // Compute token address using fast method
        const tokenRaw = this.computeCreate2AddressFast(tokenBuffer);
        const tokenBigInt = BigInt(tokenRaw);

        if (
          (isToken0 && tokenBigInt < numeraireBigInt) ||
          (!isToken0 && tokenBigInt > numeraireBigInt)
        ) {
          // Found a match! Convert to proper format for return
          const saltBytes = `0x${salt.toString(16).padStart(64, '0')}` as Hash;
          const hook = getAddress(hookRaw) as Address;
          const token = getAddress(tokenRaw) as Address;
          return [
            saltBytes,
            hook,
            token,
            poolInitializerData,
            tokenFactoryData,
          ];
        }
      }
    }

    throw new Error('AirlockMiner: could not find salt');
  }

  /**
   * Computes the CREATE2 address for a contract deployment
   * @param salt - The salt used for deployment
   * @param initCodeHash - Hash of the initialization code
   * @param deployer - Address of the deploying contract
   * @returns The computed contract address
   * @private
   */
  private computeCreate2Address(
    salt: Hash,
    initCodeHash: Hash,
    deployer: Address,
  ): Address {
    const encoded = encodePacked(
      ['bytes1', 'address', 'bytes32', 'bytes32'],
      ['0xff', deployer, salt, initCodeHash],
    );
    return getAddress(`0x${keccak256(encoded).slice(-40)}`);
  }

  /**
   * Helper to convert hex string to Uint8Array
   * @private
   */
  private hexToBytes(hex: string): Uint8Array {
    const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
    const bytes = new Uint8Array(cleanHex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
    }
    return bytes;
  }

  /**
   * Helper to convert Uint8Array to hex string
   * @private
   */
  private bytesToHex(bytes: Uint8Array): string {
    return (
      '0x' +
      Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
    );
  }

  /**
   * Pre-compute CREATE2 buffer with constant prefix for fast mining
   * Buffer layout: 0xff (1 byte) + deployer (20 bytes) + salt (32 bytes) + initCodeHash (32 bytes) = 85 bytes
   * @private
   */
  private prepareCreate2Buffer(
    deployer: Address,
    initCodeHash: Hash,
  ): Uint8Array {
    const buffer = new Uint8Array(85);
    buffer[0] = 0xff;
    const deployerBytes = this.hexToBytes(deployer);
    buffer.set(deployerBytes, 1);
    const initCodeHashBytes = this.hexToBytes(initCodeHash);
    buffer.set(initCodeHashBytes, 53); // 1 + 20 + 32 = 53
    return buffer;
  }

  /**
   * Update salt in pre-computed CREATE2 buffer (bytes 21-52)
   * Uses direct byte manipulation instead of string conversion
   * @private
   */
  private updateSaltInBuffer(buffer: Uint8Array, salt: bigint): void {
    // Salt is 32 bytes, positioned at offset 21 (after 0xff + 20-byte deployer)
    // Clear salt region first
    for (let i = 21; i < 53; i++) {
      buffer[i] = 0;
    }
    // Write salt bytes from right to left (big-endian)
    let remaining = salt;
    for (let i = 52; remaining > 0n && i >= 21; i--) {
      buffer[i] = Number(remaining & 0xffn);
      remaining >>= 8n;
    }
  }

  /**
   * Compute CREATE2 address from pre-computed buffer (fast version for mining)
   * Returns raw lowercase address without checksum for comparison
   * @private
   */
  private computeCreate2AddressFast(buffer: Uint8Array): string {
    const hash = keccak256(this.bytesToHex(buffer) as Hex);
    // Return last 40 hex chars (20 bytes) as lowercase address
    return '0x' + hash.slice(-40).toLowerCase();
  }

  /**
   * Compute V4 pool ID from pool key components
   */
  private computePoolId(poolKey: {
    currency0: Address;
    currency1: Address;
    fee: number;
    tickSpacing: number;
    hooks: Address;
  }): string {
    // V4 pools are identified by the hash of their PoolKey
    const encoded = encodeAbiParameters(
      [
        { type: 'address' },
        { type: 'address' },
        { type: 'uint24' },
        { type: 'int24' },
        { type: 'address' },
      ],
      [
        poolKey.currency0,
        poolKey.currency1,
        poolKey.fee,
        poolKey.tickSpacing,
        poolKey.hooks,
      ],
    );
    return keccak256(encoded);
  }

  /**
   * Compute the V4 poolId for a multicurve pool by reading the hook address from the initializer
   */
  private async computeMulticurvePoolId(
    params: CreateMulticurveParams<C>,
    tokenAddress: Address,
  ): Promise<Hex> {
    const addresses = getAddresses(this.chainId);

    // Determine which initializer to use (scheduled vs regular)
    const useScheduledInitializer = params.schedule !== undefined;
    const initializerAddress = useScheduledInitializer
      ? (params.modules?.v4ScheduledMulticurveInitializer ??
        addresses.v4ScheduledMulticurveInitializer)
      : (params.modules?.v4MulticurveInitializer ??
        addresses.v4MulticurveInitializer);

    if (!initializerAddress) {
      throw new Error('Multicurve initializer address not configured');
    }

    // Read the HOOK address from the initializer contract
    const hookAddress = (await (this.publicClient as PublicClient).readContract(
      {
        address: initializerAddress,
        abi: v4MulticurveInitializerAbi,
        functionName: 'HOOK',
      },
    )) as Address;

    // Construct the pool key and compute poolId
    const numeraire = params.sale.numeraire;
    const currency0 = tokenAddress < numeraire ? tokenAddress : numeraire;
    const currency1 = tokenAddress < numeraire ? numeraire : tokenAddress;

    return this.computePoolId({
      currency0,
      currency1,
      fee: params.pool.fee,
      tickSpacing: params.pool.tickSpacing,
      hooks: hookAddress,
    }) as Hex;
  }

  private async ensureMulticurveBundlerSupport(
    bundler: Address,
  ): Promise<void> {
    if (this.multicurveBundlerSupport.get(bundler)) {
      return;
    }

    const client = this.publicClient as PublicClient;
    if (!client || typeof client.getBytecode !== 'function') {
      // If we cannot check support, optimistically assume true.
      this.multicurveBundlerSupport.set(bundler, true);
      return;
    }

    const bytecode = await client.getBytecode({ address: bundler });
    const supports = Boolean(
      bytecode &&
      MULTICURVE_BUNDLER_SELECTORS.every((selector) =>
        bytecode.includes(selector.slice(2)),
      ),
    );

    if (!supports) {
      throw new Error(
        `Bundler at ${bundler} does not support multicurve bundling. Ensure the Doppler Bundler has been upgraded and update chain addresses.`,
      );
    }

    this.multicurveBundlerSupport.set(bundler, true);
  }
}

const MULTICURVE_BUNDLER_SELECTORS = ['0xe2e9faa1', '0x07087b06'] as const;
