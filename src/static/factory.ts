/**
 * StaticAuctionFactory - Factory for V3-style static bonding curve auctions.
 *
 * This factory handles the creation and simulation of static auctions using
 * Uniswap V3 for initial liquidity. It's extracted from the monolithic
 * DopplerFactory for better modularity and tree-shaking.
 */

import {
  type Address,
  type Hex,
  type Hash,
  type PublicClient,
  type WalletClient,
  type Account,
  encodeAbiParameters,
  decodeEventLog,
  toHex,
  zeroAddress,
} from 'viem';
import type {
  MigrationConfig,
  SupportedPublicClient,
  TokenConfig,
  Doppler404TokenConfig,
  StandardTokenConfig,
  CreateParams,
  ModuleAddressOverrides,
} from '../common/types';
import type { CreateStaticAuctionParams } from './types';
import type { SupportedChainId } from '../common/addresses';
import { getAddresses } from '../common/addresses';
import { ZERO_ADDRESS, WAD, TICK_SPACINGS, DEFAULT_CREATE_GAS_LIMIT } from '../common/constants';
import { MIN_TICK, MAX_TICK } from '../common/utils/tickMath';
import { airlockAbi, bundlerAbi } from '../common/abis';
import {
  DEFAULT_V3_NUM_POSITIONS,
  DEFAULT_V3_MAX_SHARE_TO_BE_SOLD,
  DEFAULT_V3_INITIAL_VOTING_DELAY,
  DEFAULT_V3_INITIAL_VOTING_PERIOD,
  DEFAULT_V3_INITIAL_PROPOSAL_THRESHOLD,
} from './constants';
import { DEFAULT_V4_YEARLY_MINT_RATE } from '../internal/v4-shared/constants';

// Type definition for the custom migration encoder function
export type MigrationEncoder = (config: MigrationConfig) => Hex;

export class StaticAuctionFactory<C extends SupportedChainId = SupportedChainId> {
  private publicClient: SupportedPublicClient;
  private walletClient?: WalletClient;
  private chainId: C;
  private customMigrationEncoder?: MigrationEncoder;

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
   */
  withCustomMigrationEncoder(encoder: MigrationEncoder): this {
    this.customMigrationEncoder = encoder;
    return this;
  }

  /**
   * Encode parameters for creating a static auction
   */
  async encodeCreateParams(
    params: CreateStaticAuctionParams<C>,
  ): Promise<CreateParams> {
    this.validateParams(params);

    const addresses = getAddresses(this.chainId);

    // Check if beneficiaries are provided - this determines which initializer to use
    const hasBeneficiaries =
      params.pool.beneficiaries && params.pool.beneficiaries.length > 0;

    // 1. Encode pool initializer data
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

    // 2. Encode migration data
    const liquidityMigratorData = this.encodeMigrationData(params.migration);

    // 3. Encode token parameters
    let tokenFactoryData: Hex;
    if (this.isDoppler404Token(params.token)) {
      const token404 = params.token;
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

    const useNoOpGovernance = params.governance.type === 'noOp';

    // 4. Encode governance factory data
    const governanceFactoryData: Hex = useNoOpGovernance
      ? ('0x' as Hex)
      : encodeAbiParameters(
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

    // 4.1 Choose governance factory
    const governanceFactoryAddress: Address = (() => {
      if (useNoOpGovernance) {
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
      const resolved =
        params.modules?.governanceFactory ?? addresses.governanceFactory;
      if (!resolved || resolved === ZERO_ADDRESS) {
        throw new Error(
          'Standard governance requested but governanceFactory is not deployed on this chain.',
        );
      }
      return resolved;
    })();

    // 5. Resolve token factory
    const resolvedTokenFactory: Address | undefined =
      params.modules?.tokenFactory ??
      (this.isDoppler404Token(params.token)
        ? (addresses.doppler404Factory as Address | undefined)
        : addresses.tokenFactory);

    if (!resolvedTokenFactory || resolvedTokenFactory === ZERO_ADDRESS) {
      throw new Error(
        'Token factory address not configured. Provide an explicit address via builder.withTokenFactory(...).',
      );
    }

    // Build the base CreateParams; salt will be mined below
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
              'Lockable V3 initializer address not configured on this chain.',
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
   */
  async simulate(
    params: CreateStaticAuctionParams<C>,
  ): Promise<{
    createParams: CreateParams;
    asset: Address;
    pool: Address;
    gasEstimate?: bigint;
    execute: () => Promise<{
      poolAddress: Address;
      tokenAddress: Address;
      transactionHash: string;
    }>;
  }> {
    const createParams = await this.encodeCreateParams(params);
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
      execute: () => this.create(params, { _createParams: createParams }),
    };
  }

  /**
   * Create a new static auction
   */
  async create(
    params: CreateStaticAuctionParams<C>,
    options?: { _createParams?: CreateParams },
  ): Promise<{
    poolAddress: Address;
    tokenAddress: Address;
    transactionHash: string;
  }> {
    const createParams =
      options?._createParams ?? (await this.simulate(params)).createParams;

    const addresses = getAddresses(this.chainId);

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

    const receipt = await (
      this.publicClient as PublicClient
    ).waitForTransactionReceipt({ hash, confirmations: 2 });

    const actualAddresses = this.extractAddressesFromCreateEvent(receipt);

    if (!actualAddresses) {
      throw new Error(
        'Failed to extract addresses from Create event in transaction logs',
      );
    }

    if (simResult && Array.isArray(simResult) && simResult.length >= 2) {
      const simulatedToken = simResult[0] as Address;
      const simulatedPool = simResult[1] as Address;
      if (
        simulatedToken.toLowerCase() !==
        actualAddresses.tokenAddress.toLowerCase()
      ) {
        console.warn(
          `[DopplerSDK] Simulation predicted token ${simulatedToken} but actual is ${actualAddresses.tokenAddress}.`,
        );
      }
      if (
        simulatedPool.toLowerCase() !==
        actualAddresses.poolOrHookAddress.toLowerCase()
      ) {
        console.warn(
          `[DopplerSDK] Simulation predicted pool ${simulatedPool} but actual is ${actualAddresses.poolOrHookAddress}.`,
        );
      }
    }

    return {
      tokenAddress: actualAddresses.tokenAddress,
      poolAddress: actualAddresses.poolOrHookAddress,
      transactionHash: hash,
    };
  }

  // ============================================================================
  // Bundler methods (V3 pre-buy)
  // ============================================================================

  /**
   * Simulate a bundle with exact input on Uniswap V3 as part of create
   * Returns the expected output amount for the provided exact input.
   */
  async simulateBundleExactIn(
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
  async simulateBundleExactOut(
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

  private getBundlerAddress(): Address {
    const addresses = getAddresses(this.chainId);
    const addr = addresses.bundler;
    if (!addr || addr === zeroAddress) {
      throw new Error('Bundler address not configured for this chain');
    }
    return addr;
  }

  // ============================================================================
  // Private helper methods
  // ============================================================================

  private generateRandomSalt(account: Address): Hex {
    const array = new Uint8Array(32);

    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(array);
    } else {
      const timestamp = Date.now();
      const timestampBytes = new Uint8Array(8);
      for (let i = 0; i < 8; i++) {
        timestampBytes[i] = (timestamp >> (i * 8)) & 0xff;
      }
      for (let i = 0; i < 32; i++) {
        if (i < 8) {
          array[i] = timestampBytes[i];
        } else {
          array[i] = i;
        }
      }
    }

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

  private async mineTokenOrder(args: {
    params: CreateStaticAuctionParams<C>;
    baseCreateParams: Omit<CreateParams, 'salt'>;
    addresses: ReturnType<typeof getAddresses>;
  }): Promise<CreateParams> {
    const { params, baseCreateParams, addresses } = args;

    const airlockAddress = params.modules?.airlock ?? addresses.airlock;
    if (!airlockAddress || airlockAddress === ZERO_ADDRESS) {
      throw new Error('Airlock address not configured.');
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
      'Token mining exceeded iteration limit while trying to force token order.',
    );
  }

  private async resolveCreateGasEstimate(args: {
    request: unknown;
    address: Address;
    createParams: CreateParams;
    account: Address | Account | undefined;
  }): Promise<bigint | undefined> {
    const { request, address, createParams, account } = args;
    const requestObj = request as { gas?: bigint } | undefined;
    const gasFromRequest = requestObj?.gas;
    if (gasFromRequest !== undefined) {
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

  private encodeMigrationData(config: MigrationConfig): Hex {
    if (this.customMigrationEncoder) {
      return this.customMigrationEncoder(config);
    }

    switch (config.type) {
      case 'uniswapV2':
        return '0x' as Hex;

      case 'noOp':
        return '0x' as Hex;

      case 'uniswapV4':
        const streamableFees = config.streamableFees;
        if (!streamableFees) {
          return '0x';
        }

        const beneficiaryData = [...streamableFees.beneficiaries].sort(
          (a, b) => {
            const addrA = a.beneficiary.toLowerCase();
            const addrB = b.beneficiary.toLowerCase();
            return addrA < addrB ? -1 : addrA > addrB ? 1 : 0;
          },
        );

        return encodeAbiParameters(
          [
            { type: 'uint24' },
            { type: 'int24' },
            { type: 'uint32' },
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

  private getMigratorAddress(
    config: MigrationConfig,
    modules: ModuleAddressOverrides | undefined,
  ): Address {
    const addresses = getAddresses(this.chainId);

    switch (config.type) {
      case 'uniswapV2':
        return modules?.v2Migrator ?? addresses.v2Migrator ?? ZERO_ADDRESS;
      case 'uniswapV4':
        return modules?.v4Migrator ?? addresses.v4Migrator ?? ZERO_ADDRESS;
      case 'noOp':
        return modules?.noOpMigrator ?? addresses.noOpMigrator ?? ZERO_ADDRESS;
      default:
        throw new Error('Unknown migration type');
    }
  }

  private validateParams(params: CreateStaticAuctionParams): void {
    if (!params.token.name || params.token.name.trim().length === 0) {
      throw new Error('Token name is required');
    }
    if (!params.token.symbol || params.token.symbol.trim().length === 0) {
      throw new Error('Token symbol is required');
    }

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

    if (params.sale.initialSupply <= BigInt(0)) {
      throw new Error('Initial supply must be positive');
    }
    if (params.sale.numTokensToSell <= BigInt(0)) {
      throw new Error('Number of tokens to sell must be positive');
    }
    if (params.sale.numTokensToSell > params.sale.initialSupply) {
      throw new Error('Cannot sell more tokens than initial supply');
    }

    if (params.vesting) {
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
        const vestedAmount =
          params.sale.initialSupply - params.sale.numTokensToSell;
        if (vestedAmount <= BigInt(0)) {
          throw new Error('No tokens available for vesting');
        }
      }
    }

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
  }
}
