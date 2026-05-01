import './env';
import {
  DopplerSDK,
  StaticAuctionBuilder,
  DAY_SECONDS,
  getAddresses,
} from '../src/evm';
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  type Address,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL ?? process.env.RPC_URL;
if (!rpcUrl) {
  throw new Error('Set BASE_SEPOLIA_RPC_URL or RPC_URL');
}

const privateKey = process.env.PRIVATE_KEY as `0x${string}` | undefined;
const account = privateKey ? privateKeyToAccount(privateKey) : undefined;
const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(rpcUrl),
});
const walletClient = account
  ? createWalletClient({
      chain: baseSepolia,
      transport: http(rpcUrl),
      account,
    })
  : undefined;

const sdk = new DopplerSDK({
  publicClient,
  walletClient,
  chainId: baseSepolia.id,
});

const userAddress = (account?.address ?? process.env.USER_ADDRESS) as
  | Address
  | undefined;
if (!userAddress) {
  throw new Error('Set PRIVATE_KEY or USER_ADDRESS');
}
const resolvedUserAddress: Address = userAddress;

const addresses = getAddresses(baseSepolia.id);
const params = StaticAuctionBuilder.forChain(baseSepolia.id)
  .tokenConfig({
    name: 'Doppler ERC20 V1 Example',
    symbol: 'DERV1',
    tokenURI: 'ipfs://example-v1-token',
    maxBalanceLimit: parseEther('10000'),
    balanceLimitEnd: Math.floor(Date.now() / 1000) + 30 * DAY_SECONDS,
    controller: resolvedUserAddress,
    // User-controlled exclusions; the default DopplerERC20V1 path also adds required protocol modules.
    excludedFromBalanceLimit: [resolvedUserAddress],
  })
  .saleConfig({
    initialSupply: parseEther('1000000'),
    numTokensToSell: parseEther('900000'),
    numeraire: addresses.weth,
  })
  .poolByTicks({ startTick: -120000, endTick: -60000, fee: 3000 })
  .withVesting({
    duration: 365n * BigInt(DAY_SECONDS),
    recipients: [resolvedUserAddress],
    amounts: [parseEther('100000')],
  })
  .withGovernance({ type: 'noOp' })
  .withMigration({ type: 'uniswapV2' })
  .withUserAddress(resolvedUserAddress)
  .build();

const simulation = await sdk.factory.simulateCreateStaticAuction(params);
console.log('Predicted token:', simulation.asset);
console.log('Predicted pool:', simulation.pool);
console.log('Template-specific fields selected dopplerERC20V1 automatically.');

if (process.env.EXECUTE === '1') {
  if (!walletClient) {
    throw new Error('Set PRIVATE_KEY to broadcast');
  }
  const created = await simulation.execute();
  console.log('Created token:', created.tokenAddress);
  console.log('Create tx:', created.transactionHash);
}

const tokenAddress = (process.env.TOKEN_ADDRESS ?? simulation.asset) as Address;
const token = sdk.getDopplerERC20V1(tokenAddress);
const scheduleCount = await token.getVestingScheduleCount();
console.log('Vesting schedules:', scheduleCount.toString());

for (let scheduleId = 0n; scheduleId < scheduleCount; scheduleId++) {
  const schedule = await token.getVestingSchedule(scheduleId);
  const vesting = await token.getVestingDataForSchedule(
    resolvedUserAddress,
    scheduleId,
  );
  const available = await token.getAvailableVestedAmountForSchedule(
    resolvedUserAddress,
    scheduleId,
  );
  console.log('Schedule', scheduleId.toString(), {
    cliffDuration: schedule.cliffDuration.toString(),
    duration: schedule.duration.toString(),
    totalAmount: vesting.totalAmount.toString(),
    releasedAmount: vesting.releasedAmount.toString(),
    available: available.toString(),
  });

  if (process.env.RELEASE_SCHEDULE_ID === scheduleId.toString()) {
    await token.releaseSchedule(scheduleId, available / 2n);
  }
}

const totalAvailable =
  await token.getAvailableVestedAmount(resolvedUserAddress);
console.log('Total releasable across schedules:', totalAvailable.toString());

console.log(
  'Max balance limit:',
  (await token.getMaxBalanceLimit()).toString(),
);
console.log('Balance limit end:', await token.getBalanceLimitEnd());
console.log('Balance limit active:', await token.isBalanceLimitActive());
console.log('Controller:', await token.getController());
console.log(
  'User excluded from balance limit:',
  await token.isExcludedFromBalanceLimit(resolvedUserAddress),
);
