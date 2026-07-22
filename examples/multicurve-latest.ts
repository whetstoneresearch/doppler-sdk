/**
 * Example: Multicurve launch with DopplerERC20V1 using intended configuration
 * This example also showcases manually defining the Robinhood chain as it is
 * not yet supported by viem.
 *
 * Simulates by default. Set EXECUTE=1 to deploy, or ASSET_ADDRESS=0x...
 * to run post-launch reads/claims against an existing token.
 *
 * Optional writes:
 * - CLAIM_FEES=1
 * - CLAIM_VESTING=partial | full
 * - SCHEDULE_ID=0 applies CLAIM_VESTING to one schedule
 */
import './env';

import {
  CHAIN_IDS,
  DAY_SECONDS,
  DopplerSDK,
  FEE_TIERS,
  RehypeFeeRoutingMode,
  WAD,
  getAddresses,
} from '../src/evm';
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  formatUnits,
  getAddress,
  http,
  isAddress,
  isHex,
  parseEther,
  type Address,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const tokenDecimals = 18;
const defaultRobinhoodRpcUrl = 'https://rpc.mainnet.chain.robinhood.com';

const robinhoodChain = defineChain({
  id: CHAIN_IDS.ROBINHOOD,
  name: 'Robinhood Chain',
  nativeCurrency: { decimals: tokenDecimals, name: 'Ether', symbol: 'ETH' },
  rpcUrls: { default: { http: [defaultRobinhoodRpcUrl] } },
});

async function main(): Promise<void> {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey || !isHex(privateKey)) {
    throw new Error('PRIVATE_KEY must be a 0x-prefixed hex string');
  }
  const rpcUrl = process.env.RPC_URL || defaultRobinhoodRpcUrl;

  const account = privateKeyToAccount(privateKey);
  const chainId = CHAIN_IDS.ROBINHOOD;
  const addresses = getAddresses(chainId);
  const rehypeDopplerHookInitializer = addresses.rehypeDopplerHookInitializer;
  if (!rehypeDopplerHookInitializer) {
    throw new Error('RehypeDopplerHookInitializer is not configured');
  }
  const shouldExecute = process.env.EXECUTE === '1';
  const shouldClaimFees = process.env.CLAIM_FEES === '1';
  const vestingClaimMode = process.env.CLAIM_VESTING;
  if (
    vestingClaimMode &&
    vestingClaimMode !== 'partial' &&
    vestingClaimMode !== 'full'
  ) {
    throw new Error('CLAIM_VESTING must be partial or full');
  }
  const selectedScheduleId = process.env.SCHEDULE_ID
    ? BigInt(process.env.SCHEDULE_ID)
    : undefined;
  const existingAssetAddress = readOptionalAddress('ASSET_ADDRESS');
  const numerairePrice = Number(process.env.NUMERAIRE_PRICE_USD ?? 3500);
  if (!Number.isFinite(numerairePrice) || numerairePrice <= 0) {
    throw new Error('NUMERAIRE_PRICE_USD must be a positive number');
  }

  const publicClient = createPublicClient({
    chain: robinhoodChain,
    transport: http(rpcUrl),
  });
  const walletClient = createWalletClient({
    chain: robinhoodChain,
    transport: http(rpcUrl),
    account,
  });
  const sdk = new DopplerSDK({ publicClient, walletClient, chainId });

  const airlockBeneficiary = await sdk.getAirlockBeneficiary(WAD / 20n);
  const poolFeeBeneficiaries = [
    airlockBeneficiary,
    { beneficiary: account.address, shares: WAD - airlockBeneficiary.shares },
  ];
  const day = BigInt(DAY_SECONDS);
  const vestingAllocations = [
    {
      recipient: account.address,
      amount: parseEther('40000'),
      schedule: { duration: 180n * day, cliffDuration: 30 * DAY_SECONDS },
    },
    {
      recipient: account.address,
      amount: parseEther('20000'),
      schedule: { duration: 365n * day, cliffDuration: 90 * DAY_SECONDS },
    },
    {
      recipient: account.address,
      amount: parseEther('15000'),
      schedule: { duration: 730n * day, cliffDuration: 180 * DAY_SECONDS },
    },
  ];

  const params = sdk
    .buildMulticurveAuction()
    .tokenConfig({
      type: 'dopplerERC20V1',
      name: 'Multicurve Latest',
      symbol: 'MLT',
      tokenURI: 'ipfs://multicurve-latest.json',
      maxBalanceLimit: parseEther('25000'),
      balanceLimitEnd: Math.floor(Date.now() / 1000) + DAY_SECONDS,
      controller: account.address,
      excludedFromBalanceLimit: [account.address],
    })
    .saleConfig({
      initialSupply: 1_000_000n * WAD,
      numTokensToSell: 900_000n * WAD,
      numeraire: addresses.weth,
    })
    .withCurves({
      numerairePrice,
      fee: FEE_TIERS.LOW,
      beneficiaries: poolFeeBeneficiaries,
      curves: [
        {
          marketCap: { start: 500_000, end: 2_000_000 },
          numPositions: 8,
          shares: parseEther('0.4'),
        },
        {
          marketCap: { start: 2_000_000, end: 8_000_000 },
          numPositions: 12,
          shares: parseEther('0.35'),
        },
        {
          marketCap: { start: 8_000_000, end: 'max' },
          numPositions: 16,
          shares: parseEther('0.25'),
        },
      ],
    })
    .withVesting({ allocations: vestingAllocations })
    // TODO(PR #170): TEMPORARY legacy Robinhood config until its initializer
    // accepts fee beneficiaries; revert the dedicated compatibility commit.
    .withRehypeDopplerHookInitializer({
      hookAddress: rehypeDopplerHookInitializer,
      buybackDestination: account.address,
      startFee: 3000,
      endFee: 3000,
      durationSeconds: 0,
      feeRoutingMode: RehypeFeeRoutingMode.RouteToBeneficiaryFees,
      // Send all fees to beneficiaries in numeraire
      feeDistributionInfo: {
        assetFeesToAssetBuybackWad: 0n,
        assetFeesToNumeraireBuybackWad: WAD,
        assetFeesToBeneficiaryWad: 0n,
        assetFeesToLpWad: 0n,
        numeraireFeesToAssetBuybackWad: 0n,
        numeraireFeesToNumeraireBuybackWad: 0n,
        numeraireFeesToBeneficiaryWad: WAD,
        numeraireFeesToLpWad: 0n,
      },
    })
    .withGovernance({ type: 'noOp' })
    .withMigration({ type: 'noOp' })
    .withUserAddress(account.address)
    .build();

  console.log('Multicurve latest example');
  console.log('Deployer:', account.address);
  console.log('Rehype numeraire fee recipient:', account.address);

  const simulation = await sdk.factory.simulateCreateMulticurve(params);
  console.log('Simulation OK');
  console.log('Predicted token:', simulation.tokenAddress);
  console.log('Predicted pool id:', simulation.poolId);

  let assetAddress = existingAssetAddress;
  if (shouldExecute) {
    const result = await simulation.execute();
    assetAddress = result.tokenAddress;
    console.log('Created token:', result.tokenAddress);
    console.log('Create tx:', result.transactionHash);
  }
  if (!assetAddress) {
    console.log('Skipping post-launch reads. Set EXECUTE=1 or ASSET_ADDRESS.');
    return;
  }

  const token = sdk.getDopplerERC20V1(assetAddress);
  const [maxBalanceLimit, balanceLimitActive, scheduleIds] = await Promise.all([
    token.getMaxBalanceLimit(),
    token.isBalanceLimitActive(),
    token.getScheduleIdsOf(account.address),
  ]);
  console.log('Max balance limit:', formatToken(maxBalanceLimit));
  console.log('Balance limit active:', balanceLimitActive);
  console.log('Vesting schedules for deployer:', scheduleIds.length);

  for (const scheduleId of scheduleIds) {
    const [vesting, availableAmount] = await Promise.all([
      token.getVestingDataForSchedule(account.address, scheduleId),
      token.getAvailableVestedAmountForSchedule(account.address, scheduleId),
    ]);
    console.log('Schedule:', scheduleId.toString(), {
      total: formatToken(vesting.totalAmount),
      released: formatToken(vesting.releasedAmount),
      available: formatToken(availableAmount),
    });
  }

  if (vestingClaimMode) {
    const availableAmount =
      selectedScheduleId === undefined
        ? await token.getAvailableVestedAmount(account.address)
        : await token.getAvailableVestedAmountForSchedule(
            account.address,
            selectedScheduleId,
          );
    const amount =
      vestingClaimMode === 'partial' ? availableAmount / 2n : availableAmount;
    const txHash =
      amount === 0n
        ? undefined
        : selectedScheduleId === undefined
          ? await token.release(amount)
          : await token.releaseSchedule(selectedScheduleId, amount);
    if (amount === 0n) console.log('No vested amount is available.');
    if (txHash) console.log('Vesting claim tx:', txHash);
  }

  const pool = await sdk.getMulticurvePool(assetAddress);
  const state = await pool.getState();
  console.log('Pool status:', state.status);
  try {
    const pendingFees = await pool.getPendingFees(account.address);
    console.log('Pending token0 fees:', formatToken(pendingFees.fees0));
    console.log('Pending token1 fees:', formatToken(pendingFees.fees1));
  } catch (error: unknown) {
    if (!(error instanceof Error)) throw error;
    console.log('Pending fee preview unavailable:', error.message);
  }

  if (shouldClaimFees) {
    const collection = await pool.collectFees();
    console.log('Fee claim tx:', collection.transactionHash);
    console.log('Collected token0 fees:', formatToken(collection.fees0));
    console.log('Collected token1 fees:', formatToken(collection.fees1));
  }
}

function readOptionalAddress(name: string): Address | undefined {
  const value = process.env[name];
  if (!value) return undefined;
  if (!isAddress(value)) throw new Error(`${name} must be an address`);
  return getAddress(value);
}

function formatToken(amount: bigint): string {
  return formatUnits(amount, tokenDecimals);
}

main().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error('Error:', error.message);
  } else {
    console.error('Error:', String(error));
  }
  process.exitCode = 1;
});
