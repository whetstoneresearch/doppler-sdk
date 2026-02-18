import { describe, it, expect, beforeAll } from 'vitest'
import {
  DopplerSDK,
  getAddresses,
  CHAIN_IDS,
  airlockAbi,
  WAD,
} from '../../../src'
import { getTestClient, hasRpcUrl, getRpcEnvVar, delay, getForkClients } from '../../utils'
import { parseEther, type Address, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'

describe('Opening Auction (Base Sepolia fork) smoke test', () => {
  if (!hasRpcUrl(CHAIN_IDS.BASE_SEPOLIA)) {
    it.skip(`requires ${getRpcEnvVar(CHAIN_IDS.BASE_SEPOLIA)} env var`)
    return
  }

  const chainId = CHAIN_IDS.BASE_SEPOLIA
  const addresses = getAddresses(chainId)
  const publicClient = getTestClient(chainId)
  const sdk = new DopplerSDK({ publicClient, chainId })

  let initializerWhitelisted = false
  let tokenFactoryWhitelisted = false
  let governanceFactoryWhitelisted = false
  let migratorWhitelisted = false
  let states: {
    tokenFactory?: number
    governanceFactory?: number
    initializer?: number
    migrator?: number
  } = {}

  beforeAll(async () => {
    // Check that opening auction initializer is configured
    expect(addresses.openingAuctionInitializer).toBeDefined()
    expect(addresses.openingAuctionInitializer).not.toBe(
      '0x0000000000000000000000000000000000000000'
    )
    expect(addresses.openingAuctionPositionManager).toBeDefined()
    expect(addresses.openingAuctionPositionManager).not.toBe(
      '0x0000000000000000000000000000000000000000'
    )

    // Check initializer whitelist status
    try {
      const initState = await publicClient.readContract({
        address: addresses.airlock,
        abi: airlockAbi,
        functionName: 'getModuleState',
        args: [addresses.openingAuctionInitializer!],
      })
      states.initializer = Number(initState)
      initializerWhitelisted = states.initializer === 3 // ModuleState.PoolInitializer = 3
    } catch (e) {
      console.log('Could not read initializer state:', e)
    }

    await delay(500)

    // Check token factory whitelist status
    try {
      const tokenFactoryState = await publicClient.readContract({
        address: addresses.airlock,
        abi: airlockAbi,
        functionName: 'getModuleState',
        args: [addresses.tokenFactory],
      })
      states.tokenFactory = Number(tokenFactoryState)
      tokenFactoryWhitelisted = states.tokenFactory === 1 // ModuleState.TokenFactory = 1
    } catch (e) {
      console.log('Could not read token factory state:', e)
    }

    await delay(500)

    // Check governance factory whitelist status
    try {
      const governanceFactoryState = await publicClient.readContract({
        address: addresses.airlock,
        abi: airlockAbi,
        functionName: 'getModuleState',
        args: [addresses.governanceFactory],
      })
      states.governanceFactory = Number(governanceFactoryState)
      governanceFactoryWhitelisted = states.governanceFactory === 2 // ModuleState.GovernanceFactory = 2
    } catch (e) {
      console.log('Could not read governance factory state:', e)
    }

    await delay(500)

    // Check migrator whitelist status
    try {
      const migratorState = await publicClient.readContract({
        address: addresses.airlock,
        abi: airlockAbi,
        functionName: 'getModuleState',
        args: [addresses.v2Migrator],
      })
      states.migrator = Number(migratorState)
      migratorWhitelisted = states.migrator === 4 // ModuleState.LiquidityMigrator = 4
    } catch (e) {
      console.log('Could not read migrator state:', e)
    }
  })

  it('has opening auction contracts deployed on Base Sepolia', () => {
    expect(addresses.openingAuctionInitializer).toBe(
      '0x3dCd35945Dc86a9FaA80846B06CB4676961d0AEa'
    )
    expect(addresses.openingAuctionPositionManager).toBe(
      '0x957CA7472ced1C1B3608152F83E0E69F975a37a9'
    )
  })

  it('SDK opening auction lifecycle helper is available', async () => {
    // The SDK lifecycle helper is configured with the initializer address
    const lifecycle = sdk.getOpeningAuctionLifecycle()
    expect(lifecycle).toBeDefined()

    // The lifecycle helper provides methods to interact with the initializer
    // (actual contract calls require the initializer to be whitelisted)
  })

  it('can build opening auction params and SDK can encode them', async () => {
    const builder = sdk
      .buildOpeningAuction()
      .tokenConfig({
        type: 'standard',
        name: 'OpeningAuctionTest',
        symbol: 'OAT',
        tokenURI: 'ipfs://test',
      })
      .saleConfig({
        initialSupply: 1_000_000n * WAD,
        numTokensToSell: 800_000n * WAD,
        numeraire: addresses.weth,
      })
      .openingAuctionConfig({
        auctionDuration: 3600, // 1 hour
        minAcceptableTickToken0: -100000,
        minAcceptableTickToken1: 100000,
        incentiveShareBps: 500, // 5%
        tickSpacing: 60,
        fee: 3000,
        minLiquidity: 1n,
        shareToAuctionBps: 2000, // 20% to auction
      })
      .dopplerConfig({
        minProceeds: parseEther('1'),
        maxProceeds: parseEther('100'),
        startTick: 90000,
        endTick: 100000,
        epochLength: 3600,
        duration: 86400, // 24 hours
        fee: 3000,
        tickSpacing: 10,
      })
      .withUserAddress('0x1804c8AB1F12E6bbf3894d4083f33e07309d1f38' as Address)
      .withGovernance({ type: 'default' })
      .withMigration({ type: 'uniswapV2' })

    const params = builder.build()
    expect(params).toBeDefined()
    expect(params.openingAuction).toBeDefined()
    expect(params.doppler).toBeDefined()
    expect(params.token).toBeDefined()
    expect(params.sale).toBeDefined()

    // Test full encoding with wallet client (required for mining)
    if (initializerWhitelisted) {
      // Create SDK with wallet for encoding/mining
      const { walletClient } = getForkClients(chainId)
      const sdkWithWallet = new DopplerSDK({ publicClient, walletClient, chainId })
      const encoded = await sdkWithWallet.factory.encodeCreateOpeningAuctionParams(params)
      expect(encoded).toBeDefined()
      expect(encoded.createParams).toBeDefined()
      expect(encoded.createParams.poolInitializer).toBe(addresses.openingAuctionInitializer)
      expect(encoded.hookAddress).toBeDefined()
      expect(encoded.tokenAddress).toBeDefined()
      expect(encoded.minedSalt).toBeDefined()
    } else {
      console.log('OpeningAuctionInitializer not whitelisted yet, skipping encoding test')
    }
  })

  it('SDK can access opening auction lifecycle helper', () => {
    const lifecycle = sdk.getOpeningAuctionLifecycle()
    expect(lifecycle).toBeDefined()
  })

  it('SDK can access opening auction position manager helper', () => {
    const positionManager = sdk.getOpeningAuctionPositionManager()
    expect(positionManager).toBeDefined()
  })
})
