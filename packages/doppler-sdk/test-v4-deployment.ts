import { createPublicClient, createWalletClient, http, parseEther } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'
import { DopplerSDK, DynamicAuctionBuilder } from './src/index'

// Test reproducing the V4 SDK deployment parameters
async function testV4Deployment() {
  const privateKey = process.env.PRIVATE_KEY as `0x${string}`
  const account = privateKeyToAccount(privateKey)
  
  const publicClient = createPublicClient({
    chain: base,
    transport: http(process.env.RPC_URL),
  })
  
  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(process.env.RPC_URL),
  })
  
  const sdk = new DopplerSDK({
    publicClient,
    walletClient,
    chainId: base.id,
  })
  
  // Create the exact same parameters as the V4 SDK example via builder
  const params = new DynamicAuctionBuilder()
    .tokenConfig({
      name: 'TestToken',
      symbol: 'TEST',
      tokenURI: 'https://example.com/token.json',
      yearlyMintRate: 0n,
    })
    .saleConfig({
      initialSupply: parseEther('1000000'),
      numTokensToSell: parseEther('500000'),
      numeraire: '0x0000000000000000000000000000000000000000', // ETH
    })
    .poolConfig({ fee: 3000, tickSpacing: 60 })
    .auctionByTicks({
      durationDays: 7,
      epochLength: 43200,
      startTick: 175000,
      endTick: 225000,
      minProceeds: parseEther('100'),
      maxProceeds: parseEther('1000'),
      gamma: 60,
      numPdSlugs: 3,
    })
    .withGovernance({ useDefaults: true })
    .withMigration({ type: 'uniswapV2' })
    .withIntegrator('0x0000000000000000000000000000000000000000')
    .withUserAddress(account.address)
    .build()
  
  console.log('Creating dynamic auction with V4 SDK parameters...')
  console.log('Parameters:', JSON.stringify(params, (key, value) => 
    typeof value === 'bigint' ? value.toString() : value, 2))
  
  try {
    const result = await sdk.factory.createDynamicAuction(params)
    console.log('Success!', result)
  } catch (error) {
    console.error('Error:', error)
  }
}

testV4Deployment()
