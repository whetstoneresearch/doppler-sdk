import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parseEther } from 'viem';
import {
  CHAIN_IDS,
  DopplerSDK,
  WAD,
  getAddresses,
  verifyPreparedCreateReceipt,
} from '../../../../src/evm';
import {
  getAnvilManager,
  getForkClients,
  getRpcEnvVar,
  hasRpcUrl,
  isAnvilForkEnabled,
  type ForkClients,
} from '../../utils';

const fixedSalt = `0x${'35'.repeat(32)}` as const;

describe('prepared Rehype multicurve create (Base Sepolia fork)', () => {
  if (!isAnvilForkEnabled()) {
    it.skip('requires ANVIL_FORK_ENABLED=true');
    return;
  }
  if (!hasRpcUrl(CHAIN_IDS.BASE_SEPOLIA)) {
    it.skip(`requires ${getRpcEnvVar(CHAIN_IDS.BASE_SEPOLIA)} env var`);
    return;
  }

  const chainId = CHAIN_IDS.BASE_SEPOLIA;
  const addresses = getAddresses(chainId);
  const anvilManager = getAnvilManager();
  let clients: ForkClients;

  beforeAll(async () => {
    await anvilManager.start(chainId);
    clients = getForkClients(chainId, 0, { timeout: 90_000 });
  }, 90_000);

  afterAll(async () => {
    await anvilManager.stop(chainId);
  });

  it(
    'broadcasts and verifies an externally submitted DopplerERC20V1 Rehype create',
    { timeout: 120_000 },
    async () => {
      const dopplerHookInitializer = addresses.dopplerHookInitializer;
      const rehypeHook = addresses.rehypeDopplerHookInitializer;
      if (!dopplerHookInitializer || !rehypeHook) {
        throw new Error(
          'Base Sepolia Rehype and DopplerHook initializer addresses are required',
        );
      }

      const sdk = new DopplerSDK({
        publicClient: clients.publicClient,
        chainId,
      });
      const protocolBeneficiary = await sdk.getAirlockBeneficiary(WAD / 10n);
      const params = sdk
        .buildMulticurveAuction()
        .tokenConfig({
          name: 'Prepared Rehype Fork Token',
          symbol: 'PRFT',
          tokenURI: 'ipfs://prepared-rehype-fork-token',
        })
        .saleConfig({
          initialSupply: parseEther('1000000000'),
          numTokensToSell: parseEther('1000000000'),
          numeraire: addresses.weth,
        })
        .poolConfig({
          fee: 0,
          tickSpacing: 8,
          curves: Array.from({ length: 10 }, (_, index) => ({
            tickLower: index * 16_000,
            tickUpper: 240_000,
            numPositions: 10,
            shares: WAD / 10n,
          })),
          beneficiaries: [
            protocolBeneficiary,
            { beneficiary: clients.account.address, shares: (WAD * 9n) / 10n },
          ],
        })
        .withRehypeDopplerHookInitializer({
          hookAddress: rehypeHook,
          buybackDestination: clients.account.address,
          startFee: 3000,
          endFee: 3000,
          durationSeconds: 0,
          feeRoutingMode: 0,
          feeDistributionInfo: {
            assetFeesToAssetBuybackWad: WAD / 4n,
            assetFeesToNumeraireBuybackWad: WAD / 4n,
            assetFeesToBeneficiaryWad: WAD / 4n,
            assetFeesToLpWad: WAD / 4n,
            numeraireFeesToAssetBuybackWad: WAD / 4n,
            numeraireFeesToNumeraireBuybackWad: WAD / 4n,
            numeraireFeesToBeneficiaryWad: WAD / 4n,
            numeraireFeesToLpWad: WAD / 4n,
          },
          farTick: 200_000,
        })
        .withMigration({ type: 'noOp' })
        .withUserAddress(clients.account.address)
        .withSalt(fixedSalt)
        .build();

      const prepared = await sdk.factory.prepareCreateMulticurve(params, {
        account: clients.account.address,
      });
      const hash = await clients.walletClient.sendTransaction({
        account: clients.account,
        chain: clients.chain,
        ...prepared.transaction,
        ...(prepared.gasEstimate.status === 'estimated'
          ? { gas: prepared.gasEstimate.gas }
          : {}),
      });
      const receipt = await clients.publicClient.waitForTransactionReceipt({
        hash,
      });
      const verified = verifyPreparedCreateReceipt({ prepared, receipt });
      console.log('Prepared Rehype fork transaction:', receipt.transactionHash);

      expect(verified.receiptIdentity.tokenAddress).toBe(
        prepared.prediction.tokenAddress,
      );
      expect(verified.receiptIdentity.poolOrHookAddress).toBe(
        prepared.prediction.poolOrHookAddress,
      );
      expect(verified.preparedIdentity.poolKey.hooks).toBe(
        dopplerHookInitializer,
      );
      expect(verified.preparedIdentity.poolKey.hooks).not.toBe(rehypeHook);
      expect(verified.preparedIdentity.poolId).toBe(prepared.prediction.poolId);
      expect(verified.preparedIdentity.tokenIsCurrency0).toBe(
        prepared.prediction.tokenIsCurrency0,
      );
      expect(verified).toHaveProperty('receiptIdentity');
      expect(verified).toHaveProperty('preparedIdentity');
    },
  );
});
