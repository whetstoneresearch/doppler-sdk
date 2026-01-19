/**
 * DynamicAuctionFactory - Factory for V4 Dutch auction style bonding curves.
 *
 * This factory handles the creation and simulation of dynamic auctions using
 * Uniswap V4 hooks for gradual Dutch auction pricing. It includes the complex
 * hook address mining logic required for V4 deployments.
 */

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
import type { CreateDynamicAuctionParams } from './types';
import type { SupportedChainId } from '../common/addresses';
import { CHAIN_IDS, getAddresses } from '../common/addresses';
import {
  ZERO_ADDRESS,
  WAD,
  DEFAULT_PD_SLUGS,
} from '../common/constants';
import { airlockAbi, DERC20Bytecode, DERC2080Bytecode, DopplerBytecode, DopplerDN404Bytecode } from '../common/abis';
import { DopplerBytecodeBaseMainnet } from '../common/abis/bytecodes';
import { isToken0Expected } from '../internal/v4-shared/marketCapHelpers';
import { computeOptimalGamma } from './utils/gamma';
import {
  V4_MAX_FEE,
  DOPPLER_MAX_TICK_SPACING,
  DEFAULT_V4_INITIAL_VOTING_DELAY,
  DEFAULT_V4_INITIAL_VOTING_PERIOD,
  DEFAULT_V4_INITIAL_PROPOSAL_THRESHOLD,
  DEFAULT_V4_YEARLY_MINT_RATE,
  FLAG_MASK,
} from '../internal/v4-shared/constants';
import { DEFAULT_CREATE_GAS_LIMIT } from '../common/constants';

// Type definition for the custom migration encoder function
export type MigrationEncoder = (config: MigrationConfig) => Hex;

// TokenFactory80 has the same deterministic CREATE2 address across all chains
const TOKEN_FACTORY_80_ADDRESS =
  '0xf0b5141dd9096254b2ca624dff26024f46087229' as const;

export class DynamicAuctionFactory<C extends SupportedChainId = SupportedChainId> {
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
   * Encode parameters for creating a dynamic auction
   */
  async encodeCreateParams(
    params: CreateDynamicAuctionParams<C>,
  ): Promise<{
    createParams: CreateParams;
    hookAddress: Address;
    tokenAddress: Address;
  }> {
    this.validateParams(params);

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

    // 4. Prepare token parameters
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
            airlock: addresses.airlock,
            yearlyMintRate: t.yearlyMintRate ?? DEFAULT_V4_YEARLY_MINT_RATE,
            vestingDuration: BigInt(vestingDuration),
            recipients: vestingRecipients,
            amounts: vestingAmounts,
            tokenURI: t.tokenURI,
          };
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

    // 6. Mine hook address with appropriate flags
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
      tokenFactory: resolvedTokenFactory,
      tokenFactoryData: tokenFactoryData,
      poolInitializer: params.modules?.v4Initializer ?? addresses.v4Initializer,
      poolInitializerData: dopplerData,
      tokenVariant: this.isDoppler404Token(params.token)
        ? 'doppler404'
        : 'standard',
    });

    // 7. Encode migration data
    const liquidityMigratorData = this.encodeMigrationData(params.migration);

    const useNoOpGovernance = params.governance.type === 'noOp';

    // 8. Encode governance factory data
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
              : DEFAULT_V4_INITIAL_VOTING_DELAY,
            params.governance.type === 'custom'
              ? params.governance.initialVotingPeriod
              : DEFAULT_V4_INITIAL_VOTING_PERIOD,
            params.governance.type === 'custom'
              ? params.governance.initialProposalThreshold
              : DEFAULT_V4_INITIAL_PROPOSAL_THRESHOLD,
          ],
        );

    // 8.1 Choose governance factory
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

    // 9. Build the complete CreateParams
    const createParams = {
      initialSupply: params.sale.initialSupply,
      numTokensToSell: params.sale.numTokensToSell,
      numeraire: params.sale.numeraire,
      tokenFactory: resolvedTokenFactory,
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
   * Simulate a dynamic auction creation and return predicted addresses.
   */
  async simulate(
    params: CreateDynamicAuctionParams<C>,
  ): Promise<{
    createParams: CreateParams;
    hookAddress: Address;
    tokenAddress: Address;
    poolId: string;
    gasEstimate?: bigint;
    execute: () => Promise<{
      hookAddress: Address;
      tokenAddress: Address;
      poolId: string;
      transactionHash: string;
    }>;
  }> {
    const { createParams } = await this.encodeCreateParams(params);
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
      execute: () => this.create(params, { _createParams: createParams }),
    };
  }

  /**
   * Create a new dynamic auction
   */
  async create(
    params: CreateDynamicAuctionParams<C>,
    options?: { _createParams?: CreateParams },
  ): Promise<{
    hookAddress: Address;
    tokenAddress: Address;
    poolId: string;
    transactionHash: string;
  }> {
    const addresses = getAddresses(this.chainId);

    let createParams: CreateParams;
    if (options?._createParams) {
      createParams = options._createParams;
    } else {
      const simulation = await this.simulate(params);
      createParams = simulation.createParams;
    }

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
    ).waitForTransactionReceipt({ hash });

    const actualAddresses = this.extractAddressesFromCreateEvent(receipt);

    if (!actualAddresses) {
      throw new Error(
        'Failed to extract addresses from Create event in transaction logs',
      );
    }

    const actualTokenAddress = actualAddresses.tokenAddress;
    const actualHookAddress = actualAddresses.poolOrHookAddress;

    if (simResult && Array.isArray(simResult) && simResult.length >= 2) {
      const simulatedToken = simResult[0] as Address;
      const simulatedHook = simResult[1] as Address;
      if (simulatedToken.toLowerCase() !== actualTokenAddress.toLowerCase()) {
        console.warn(
          `[DopplerSDK] Simulation predicted token ${simulatedToken} but actual is ${actualTokenAddress}.`,
        );
      }
      if (simulatedHook.toLowerCase() !== actualHookAddress.toLowerCase()) {
        console.warn(
          `[DopplerSDK] Simulation predicted hook ${simulatedHook} but actual is ${actualHookAddress}.`,
        );
      }
    }

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

  // ============================================================================
  // Hook address mining
  // ============================================================================

  /**
   * Mines a salt and hook address with the appropriate V4 flags
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

    const isBase = this.chainId === CHAIN_IDS.BASE;

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
        [
          isBase
            ? (DopplerBytecodeBaseMainnet as Hex)
            : (DopplerBytecode as Hex),
          hookInitHashData,
        ],
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

    // Compute token init hash
    let tokenInitHash: Hash | undefined;
    if (params.tokenVariant === 'doppler404') {
      const { name, symbol, baseURI } = params.tokenFactoryData as {
        name: string;
        symbol: string;
        baseURI: string;
        unit?: bigint;
      };
      const { airlock, initialSupply } = params;
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

    // V4 hook flags
    const flags = BigInt(
      (1 << 13) | // BEFORE_INITIALIZE_FLAG
        (1 << 12) | // AFTER_INITIALIZE_FLAG
        (1 << 11) | // BEFORE_ADD_LIQUIDITY_FLAG
        (1 << 7) | // BEFORE_SWAP_FLAG
        (1 << 6) | // AFTER_SWAP_FLAG
        (1 << 5), // BEFORE_DONATE_FLAG
    );

    const numeraireBigInt = BigInt(params.numeraire);

    // Pre-allocate CREATE2 buffers
    const hookBuffer = this.prepareCreate2Buffer(params.deployer, hookInitHash);
    const tokenBuffer = tokenInitHash
      ? this.prepareCreate2Buffer(params.tokenFactory, tokenInitHash)
      : null;

    for (let salt = 0n; salt < 1_000_000n; salt++) {
      this.updateSaltInBuffer(hookBuffer, salt);

      const hookRaw = this.computeCreate2AddressFast(hookBuffer);
      const hookBigInt = BigInt(hookRaw);

      // Early termination: skip token computation if hook flags don't match
      if ((hookBigInt & FLAG_MASK) !== flags) {
        continue;
      }

      if (tokenBuffer) {
        this.updateSaltInBuffer(tokenBuffer, salt);

        const tokenRaw = this.computeCreate2AddressFast(tokenBuffer);
        const tokenBigInt = BigInt(tokenRaw);

        if (
          (isToken0 && tokenBigInt < numeraireBigInt) ||
          (!isToken0 && tokenBigInt > numeraireBigInt)
        ) {
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

  // ============================================================================
  // Private helper methods
  // ============================================================================

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

  private computePoolId(poolKey: {
    currency0: Address;
    currency1: Address;
    fee: number;
    tickSpacing: number;
    hooks: Address;
  }): string {
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

  // CREATE2 helper methods
  private hexToBytes(hex: string): Uint8Array {
    const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
    const bytes = new Uint8Array(cleanHex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
    }
    return bytes;
  }

  private bytesToHex(bytes: Uint8Array): string {
    return (
      '0x' +
      Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
    );
  }

  private prepareCreate2Buffer(
    deployer: Address,
    initCodeHash: Hash,
  ): Uint8Array {
    const buffer = new Uint8Array(85);
    buffer[0] = 0xff;
    const deployerBytes = this.hexToBytes(deployer);
    buffer.set(deployerBytes, 1);
    const initCodeHashBytes = this.hexToBytes(initCodeHash);
    buffer.set(initCodeHashBytes, 53);
    return buffer;
  }

  private updateSaltInBuffer(buffer: Uint8Array, salt: bigint): void {
    for (let i = 21; i < 53; i++) {
      buffer[i] = 0;
    }
    let remaining = salt;
    for (let i = 52; remaining > 0n && i >= 21; i--) {
      buffer[i] = Number(remaining & 0xffn);
      remaining >>= 8n;
    }
  }

  private computeCreate2AddressFast(buffer: Uint8Array): string {
    const hash = keccak256(this.bytesToHex(buffer) as Hex);
    return '0x' + hash.slice(-40).toLowerCase();
  }

  private validateParams(params: CreateDynamicAuctionParams): void {
    if (!params.token.name || params.token.name.trim().length === 0) {
      throw new Error('Token name is required');
    }
    if (!params.token.symbol || params.token.symbol.trim().length === 0) {
      throw new Error('Token symbol is required');
    }

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

    if (params.sale.initialSupply <= BigInt(0)) {
      throw new Error('Initial supply must be positive');
    }
    if (params.sale.numTokensToSell <= BigInt(0)) {
      throw new Error('Number of tokens to sell must be positive');
    }
    if (params.sale.numTokensToSell > params.sale.initialSupply) {
      throw new Error('Cannot sell more tokens than initial supply');
    }

    if (params.auction.duration <= 0) {
      throw new Error('Auction duration must be positive');
    }
    if (params.auction.epochLength <= 0) {
      throw new Error('Epoch length must be positive');
    }
    if (params.pool.tickSpacing <= 0) {
      throw new Error('Tick spacing must be positive');
    }

    if (params.pool.tickSpacing > DOPPLER_MAX_TICK_SPACING) {
      throw new Error(
        `Dynamic auctions require tickSpacing <= ${DOPPLER_MAX_TICK_SPACING} (Doppler.sol MAX_TICK_SPACING).`,
      );
    }

    if (params.auction.duration % params.auction.epochLength !== 0) {
      throw new Error('Epoch length must divide total duration evenly');
    }

    if (params.auction.gamma !== undefined) {
      if (params.auction.gamma % params.pool.tickSpacing !== 0) {
        throw new Error('Gamma must be divisible by tick spacing');
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
  }
}
