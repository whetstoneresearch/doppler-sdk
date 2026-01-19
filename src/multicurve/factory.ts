/**
 * MulticurveFactory - Factory for V4 multi-position static bonding curves.
 *
 * This factory handles the creation and simulation of multicurve pools using
 * Uniswap V4 with multiple position ranges (curves) and optional beneficiaries.
 */

import {
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
  type Account,
  encodeAbiParameters,
  keccak256,
  decodeEventLog,
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
import type {
  CreateMulticurveParams,
  MulticurveBundleExactInResult,
  MulticurveBundleExactOutResult,
} from './types';
import type { V4PoolKey } from '../internal/v4-shared/types';
import type { SupportedChainId } from '../common/addresses';
import { getAddresses } from '../common/addresses';
import {
  ZERO_ADDRESS,
  WAD,
} from '../common/constants';
import { MAX_TICK } from '../common/utils/tickMath';
import { airlockAbi, bundlerAbi, v4MulticurveInitializerAbi } from '../common/abis';
import {
  DEFAULT_V4_INITIAL_VOTING_DELAY,
  DEFAULT_V4_INITIAL_VOTING_PERIOD,
  DEFAULT_V4_INITIAL_PROPOSAL_THRESHOLD,
} from '../internal/v4-shared/constants';
import { DEFAULT_CREATE_GAS_LIMIT } from '../common/constants';
import { DEFAULT_V3_YEARLY_MINT_RATE } from '../static/constants';

// Type definition for the custom migration encoder function
export type MigrationEncoder = (config: MigrationConfig) => Hex;

const MAX_UINT128 = (1n << 128n) - 1n;

const MULTICURVE_BUNDLER_SELECTORS = ['0xe2e9faa1', '0x07087b06'] as const;

export class MulticurveFactory<C extends SupportedChainId = SupportedChainId> {
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
   */
  withCustomMigrationEncoder(encoder: MigrationEncoder): this {
    this.customMigrationEncoder = encoder;
    return this;
  }

  /**
   * Encode parameters for creating a multicurve pool
   */
  encodeCreateParams(params: CreateMulticurveParams<C>): CreateParams {
    this.validateParams(params);

    if (!params.pool || params.pool.curves.length === 0) {
      throw new Error('Multicurve pool must include at least one curve');
    }

    const normalizedCurves = this.normalizeMulticurveCurves(
      params.pool.curves,
      params.pool.tickSpacing,
    );

    const addresses = getAddresses(this.chainId);

    // Pool initializer data
    const sortedBeneficiaries = (params.pool.beneficiaries ?? [])
      .slice()
      .sort((a, b) => {
        const aAddr = a.beneficiary.toLowerCase();
        const bAddr = b.beneficiary.toLowerCase();
        return aAddr < bAddr ? -1 : aAddr > bAddr ? 1 : 0;
      });

    const useScheduledInitializer = params.schedule !== undefined;
    const useDopplerHook = params.dopplerHook !== undefined;
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
          'Scheduled multicurve startTime must fit within uint32',
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

    // Shared curve and beneficiary component definitions
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

    const curvesData = normalizedCurves.map((c) => ({
      tickLower: c.tickLower,
      tickUpper: c.tickUpper,
      numPositions: c.numPositions,
      shares: c.shares,
    }));
    const beneficiariesData = sortedBeneficiaries.map((b) => ({
      beneficiary: b.beneficiary,
      shares: b.shares,
    }));

    // Encode pool initializer data based on initializer type
    let poolInitializerData: Hex;

    if (useDopplerHookInitializer) {
      let farTick: number;
      if (params.dopplerHook?.farTick !== undefined) {
        farTick = params.dopplerHook.farTick;
      } else {
        const allTickUppers = params.pool.curves.map((c) => c.tickUpper);
        farTick = Math.max(...allTickUppers);
      }

      let onInitializationDopplerHookCalldata: Hex = '0x';
      let graduationDopplerHookCalldata: Hex = '0x';
      let dopplerHookAddress: Address = ZERO_ADDRESS;

      if (useDopplerHook) {
        const hook = params.dopplerHook!;
        dopplerHookAddress = hook.hookAddress;
        onInitializationDopplerHookCalldata = encodeAbiParameters(
          [
            { type: 'address' },
            { type: 'address' },
            { type: 'uint24' },
            { type: 'uint256' },
            { type: 'uint256' },
            { type: 'uint256' },
            { type: 'uint256' },
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
        { name: 'beneficiaries', type: 'tuple[]', components: beneficiaryComponents },
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
      const scheduledTupleComponents = [
        { name: 'fee', type: 'uint24' },
        { name: 'tickSpacing', type: 'int24' },
        { name: 'curves', type: 'tuple[]', components: curveComponents },
        { name: 'beneficiaries', type: 'tuple[]', components: beneficiaryComponents },
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
      const basicTupleComponents = [
        { name: 'fee', type: 'uint24' },
        { name: 'tickSpacing', type: 'int24' },
        { name: 'curves', type: 'tuple[]', components: curveComponents },
        { name: 'beneficiaries', type: 'tuple[]', components: beneficiaryComponents },
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

    // Token factory data
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

    // Resolve module addresses
    const salt = this.generateRandomSalt(params.userAddress);
    const resolvedTokenFactory: Address | undefined =
      params.modules?.tokenFactory ??
      (this.isDoppler404Token(params.token)
        ? (addresses.doppler404Factory as Address | undefined)
        : addresses.tokenFactory);
    if (!resolvedTokenFactory || resolvedTokenFactory === ZERO_ADDRESS) {
      throw new Error(
        'Token factory address not configured.',
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
      throw new Error(
        useDopplerHookInitializer
          ? 'DopplerHookInitializer address not configured on this chain.'
          : useScheduledInitializer
            ? 'Scheduled multicurve initializer address not configured.'
            : 'Multicurve initializer address not configured.',
      );
    }

    const hasBeneficiaries =
      params.pool.beneficiaries && params.pool.beneficiaries.length > 0;

    let liquidityMigratorData: Hex;
    let resolvedMigrator: Address | undefined;

    if (hasBeneficiaries) {
      liquidityMigratorData = '0x' as Hex;
      resolvedMigrator = params.modules?.noOpMigrator ?? addresses.noOpMigrator;
      if (!resolvedMigrator || resolvedMigrator === ZERO_ADDRESS) {
        throw new Error(
          'NoOpMigrator address not configured on this chain.',
        );
      }
    } else {
      liquidityMigratorData = this.encodeMigrationData(params.migration);
      resolvedMigrator = this.getMigratorAddress(
        params.migration,
        params.modules,
      );
      if (!resolvedMigrator || resolvedMigrator === ZERO_ADDRESS) {
        throw new Error('Migrator address not configured on this chain.');
      }
    }

    const governanceFactoryAddress: Address = (() => {
      if (useNoOpGovernance) {
        const resolved =
          params.modules?.governanceFactory ??
          addresses.noOpGovernanceFactory ??
          ZERO_ADDRESS;
        if (!resolved || resolved === ZERO_ADDRESS) {
          throw new Error(
            'No-op governance requested, but no-op governanceFactory is not configured.',
          );
        }
        return resolved;
      }
      const resolved =
        params.modules?.governanceFactory ?? addresses.governanceFactory;
      if (!resolved || resolved === ZERO_ADDRESS) {
        throw new Error(
          'Standard governance requested but governanceFactory is not deployed.',
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

  /**
   * Simulate a multicurve pool creation
   */
  async simulate(params: CreateMulticurveParams<C>): Promise<{
    createParams: CreateParams;
    tokenAddress: Address;
    poolId: Hex;
    gasEstimate?: bigint;
    execute: () => Promise<{
      tokenAddress: Address;
      poolId: Hex;
      transactionHash: string;
    }>;
  }> {
    const addresses = getAddresses(this.chainId);
    const createParams = this.encodeCreateParams(params);
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

    const tokenAddress = simResult[0] as Address;
    const poolId = await this.computeMulticurvePoolId(params, tokenAddress);

    return {
      createParams,
      tokenAddress,
      poolId,
      gasEstimate,
      execute: () => this.create(params, { _createParams: createParams }),
    };
  }

  /**
   * Create a new multicurve pool
   */
  async create(
    params: CreateMulticurveParams<C>,
    options?: { _createParams?: CreateParams },
  ): Promise<{ tokenAddress: Address; poolId: Hex; transactionHash: string }> {
    const addresses = getAddresses(this.chainId);
    if (!this.walletClient)
      throw new Error('Wallet client required for write operations');

    const createParams =
      options?._createParams ?? (await this.simulate(params)).createParams;
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

    const actualAddresses = this.extractAddressesFromCreateEvent(receipt);

    if (!actualAddresses) {
      throw new Error(
        'Failed to extract token address from Create event',
      );
    }

    const actualTokenAddress = actualAddresses.tokenAddress;

    if (simResult && Array.isArray(simResult) && simResult.length >= 1) {
      const simulatedToken = simResult[0] as Address;
      if (simulatedToken.toLowerCase() !== actualTokenAddress.toLowerCase()) {
        console.warn(
          `[DopplerSDK] Simulation predicted token ${simulatedToken} but actual is ${actualTokenAddress}.`,
        );
      }
    }

    const poolId = await this.computeMulticurvePoolId(
      params,
      actualTokenAddress,
    );

    return { tokenAddress: actualTokenAddress, poolId, transactionHash: hash };
  }

  // ============================================================================
  // Multicurve bundle helpers
  // ============================================================================

  async simulateBundleExactOut(
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

  async simulateBundleExactIn(
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
    return Math.floor(MAX_TICK / tickSpacing) * tickSpacing;
  }

  private getBundlerAddress(): Address {
    const addresses = getAddresses(this.chainId);
    const addr = addresses.bundler;
    if (!addr || addr === zeroAddress) {
      throw new Error('Bundler address not configured for this chain');
    }
    return addr;
  }

  private async computeMulticurvePoolId(
    params: CreateMulticurveParams<C>,
    tokenAddress: Address,
  ): Promise<Hex> {
    const addresses = getAddresses(this.chainId);

    const useScheduledInitializer = params.schedule !== undefined;
    const initializerAddress = useScheduledInitializer
      ? (params.modules?.v4ScheduledMulticurveInitializer ??
        addresses.v4ScheduledMulticurveInitializer)
      : (params.modules?.v4MulticurveInitializer ??
        addresses.v4MulticurveInitializer);

    if (!initializerAddress) {
      throw new Error('Multicurve initializer address not configured');
    }

    const hookAddress = (await (this.publicClient as PublicClient).readContract(
      {
        address: initializerAddress,
        abi: v4MulticurveInitializerAbi,
        functionName: 'HOOK',
      },
    )) as Address;

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

  private async ensureMulticurveBundlerSupport(
    bundler: Address,
  ): Promise<void> {
    if (this.multicurveBundlerSupport.get(bundler)) {
      return;
    }

    const client = this.publicClient as PublicClient;
    if (!client || typeof client.getBytecode !== 'function') {
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
        `Bundler at ${bundler} does not support multicurve bundling.`,
      );
    }

    this.multicurveBundlerSupport.set(bundler, true);
  }

  private ensureUint128(
    value: bigint,
    name: string,
    opts?: { allowZero?: boolean },
  ): void {
    if (value < 0n || value > MAX_UINT128) {
      throw new Error(`${name} must be a non-negative 128-bit integer`);
    }
    if (!opts?.allowZero && value === 0n) {
      throw new Error(`${name} must be positive`);
    }
  }

  private parseMulticurveBundleResult(result: unknown): {
    asset: Address;
    poolKey: V4PoolKey;
    amount: bigint;
    gasEstimate: bigint;
  } {
    const arr = result as unknown[];
    if (!Array.isArray(arr) || arr.length < 4) {
      throw new Error(
        'Unexpected multicurve bundle simulation result format',
      );
    }
    const asset = arr[0] as Address;
    const poolKey = this.normalizePoolKey(arr[1]);
    const amount = BigInt(arr[2] as string | number | bigint);
    const gasEstimate = BigInt(arr[3] as string | number | bigint);
    return { asset, poolKey, amount, gasEstimate };
  }

  private normalizePoolKey(value: unknown): V4PoolKey {
    if (
      value &&
      typeof value === 'object' &&
      'currency0' in value &&
      'currency1' in value
    ) {
      const obj = value as Record<string, unknown>;
      const feeValue = Number(obj.fee);
      const tickSpacingValue = Number(obj.tickSpacing);
      if (!Number.isFinite(feeValue) || !Number.isFinite(tickSpacingValue)) {
        throw new Error(
          'Invalid pool key numeric fields in multicurve bundle simulation result',
        );
      }
      return {
        currency0: obj.currency0 as Address,
        currency1: obj.currency1 as Address,
        fee: feeValue,
        tickSpacing: tickSpacingValue,
        hooks: obj.hooks as Address,
      };
    }
    if (Array.isArray(value) && value.length >= 5) {
      const [currency0, currency1, fee, tickSpacing, hooks] = value;
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

  private validateParams(params: CreateMulticurveParams<C>): void {
    if (!params.token.name || params.token.name.trim().length === 0) {
      throw new Error('Token name is required');
    }
    if (!params.token.symbol || params.token.symbol.trim().length === 0) {
      throw new Error('Token symbol is required');
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
