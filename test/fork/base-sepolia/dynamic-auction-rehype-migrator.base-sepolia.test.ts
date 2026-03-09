import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { decodeAbiParameters, parseEther, type Address } from 'viem';
import {
  airlockAbi,
  CHAIN_IDS,
  DAY_SECONDS,
  DopplerSDK,
  getAddresses,
} from '../../../src';
import {
  getAnvilManager,
  getForkClients,
  getRpcEnvVar,
  hasRpcUrl,
  isAnvilForkEnabled,
} from '../../utils';

describe('Dynamic auction with RehypeDopplerHookMigrator (Base Sepolia fork)', () => {
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

  let publicClient: ReturnType<typeof getForkClients>['publicClient'];
  let account: ReturnType<typeof getForkClients>['account'];
  let sdk: DopplerSDK;
  let modulesWhitelisted = false;

  beforeAll(async () => {
    await anvilManager.start(chainId);

    const clients = getForkClients(chainId);
    publicClient = clients.publicClient;
    account = clients.account;
    sdk = new DopplerSDK({ publicClient, chainId });

    try {
      const [
        initializerState,
        dopplerHookMigratorState,
        rehypeHookMigratorState,
        tokenFactoryState,
        governanceFactoryState,
      ] = await Promise.all([
        publicClient.readContract({
          address: addresses.airlock,
          abi: airlockAbi,
          functionName: 'getModuleState',
          args: [addresses.v4Initializer],
        }),
        publicClient.readContract({
          address: addresses.airlock,
          abi: airlockAbi,
          functionName: 'getModuleState',
          args: [addresses.dopplerHookMigrator!],
        }),
        publicClient.readContract({
          address: addresses.airlock,
          abi: airlockAbi,
          functionName: 'getModuleState',
          args: [addresses.rehypeDopplerHookMigrator!],
        }),
        publicClient.readContract({
          address: addresses.airlock,
          abi: airlockAbi,
          functionName: 'getModuleState',
          args: [addresses.tokenFactory],
        }),
        publicClient.readContract({
          address: addresses.airlock,
          abi: airlockAbi,
          functionName: 'getModuleState',
          args: [addresses.governanceFactory],
        }),
      ]);

      modulesWhitelisted =
        Number(initializerState) === 3 &&
        Number(dopplerHookMigratorState) === 4 &&
        Number(rehypeHookMigratorState) === 4 &&
        Number(tokenFactoryState) === 1 &&
        Number(governanceFactoryState) === 2;
    } catch (error) {
      console.error('Failed to check module states:', error);
    }
  }, 60_000);

  afterAll(async () => {
    await anvilManager.stop(chainId);
  });

  it('simulates create() with canonical rehype migrator addresses and MigratorInitData layout', async () => {
    if (!modulesWhitelisted) {
      console.warn('Modules not whitelisted on this chain, skipping test');
      return;
    }

    const airlockBeneficiary = await sdk.getAirlockBeneficiary();

    const params = sdk
      .buildDynamicAuction()
      .tokenConfig({
        name: 'Rehype Migrator Test',
        symbol: 'RHT',
        tokenURI: 'ipfs://rehype-migrator-test',
      })
      .saleConfig({
        initialSupply: parseEther('1000000'),
        numTokensToSell: parseEther('500000'),
        numeraire: addresses.weth,
      })
      .withMarketCapRange({
        marketCap: { start: 500_000, min: 50_000 },
        numerairePrice: 3000,
        minProceeds: parseEther('0.01'),
        maxProceeds: parseEther('100'),
        duration: 300,
        epochLength: 60,
        fee: 3000,
        tickSpacing: 10,
      })
      .withGovernance({ type: 'default' })
      .withMigration({
        type: 'dopplerHook',
        fee: 3000,
        useDynamicFee: false,
        tickSpacing: 10,
        lockDuration: 30 * DAY_SECONDS,
        beneficiaries: [
          { beneficiary: account.address, shares: parseEther('0.95') },
          airlockBeneficiary,
        ],
        rehype: {
          buybackDestination: account.address,
          customFee: 3000,
          feeRoutingMode: 'directBuyback',
          feeDistributionInfo: {
            assetFeesToAssetBuybackWad: parseEther('0.25'),
            assetFeesToNumeraireBuybackWad: parseEther('0.25'),
            assetFeesToBeneficiaryWad: parseEther('0.25'),
            assetFeesToLpWad: parseEther('0.25'),
            numeraireFeesToAssetBuybackWad: parseEther('0.25'),
            numeraireFeesToNumeraireBuybackWad: parseEther('0.25'),
            numeraireFeesToBeneficiaryWad: parseEther('0.25'),
            numeraireFeesToLpWad: parseEther('0.25'),
          },
        },
      })
      .withUserAddress(account.address)
      .withTime({ startTimeOffset: 300 })
      .build();

    const simulation = await sdk.factory.simulateCreateDynamicAuction(params);
    expect(simulation.hookAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(simulation.tokenAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(simulation.poolId).toMatch(/^0x[a-fA-F0-9]{64}$/);
    expect(simulation.createParams.liquidityMigrator).toBe(
      addresses.dopplerHookMigrator,
    );

    const decodedMigration = decodeAbiParameters(
      [
        { type: 'uint24' },
        { type: 'bool' },
        { type: 'int24' },
        { type: 'uint32' },
        {
          type: 'tuple[]',
          components: [
            { type: 'address', name: 'beneficiary' },
            { type: 'uint96', name: 'shares' },
          ],
        },
        { type: 'address' },
        { type: 'bytes' },
        { type: 'address' },
        { type: 'uint256' },
      ],
      simulation.createParams.liquidityMigratorData,
    ) as readonly [
      number,
      boolean,
      number,
      number,
      readonly { beneficiary: Address; shares: bigint }[],
      Address,
      `0x${string}`,
      Address,
      bigint,
    ];

    expect(decodedMigration[5]).toBe(addresses.rehypeDopplerHookMigrator);

    const [rehypeInit] = decodeAbiParameters(
      [
        {
          type: 'tuple',
          components: [
            { name: 'numeraire', type: 'address' },
            { name: 'buybackDst', type: 'address' },
            { name: 'customFee', type: 'uint24' },
            { name: 'feeRoutingMode', type: 'uint8' },
            {
              name: 'feeDistributionInfo',
              type: 'tuple',
              components: [
                { name: 'assetFeesToAssetBuybackWad', type: 'uint256' },
                { name: 'assetFeesToNumeraireBuybackWad', type: 'uint256' },
                { name: 'assetFeesToBeneficiaryWad', type: 'uint256' },
                { name: 'assetFeesToLpWad', type: 'uint256' },
                { name: 'numeraireFeesToAssetBuybackWad', type: 'uint256' },
                {
                  name: 'numeraireFeesToNumeraireBuybackWad',
                  type: 'uint256',
                },
                { name: 'numeraireFeesToBeneficiaryWad', type: 'uint256' },
                { name: 'numeraireFeesToLpWad', type: 'uint256' },
              ],
            },
          ],
        },
      ],
      decodedMigration[6],
    ) as any;

    expect(rehypeInit.numeraire).toBe(addresses.weth);
    expect(rehypeInit.buybackDst).toBe(account.address);
    expect(Number(rehypeInit.customFee)).toBe(3000);
    expect(Number(rehypeInit.feeRoutingMode)).toBe(0);
    expect(rehypeInit.feeDistributionInfo.assetFeesToLpWad).toBe(
      parseEther('0.25'),
    );
    expect(rehypeInit.feeDistributionInfo.numeraireFeesToLpWad).toBe(
      parseEther('0.25'),
    );
  });
});
