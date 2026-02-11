/**
 * Example: Create a Decay Multicurve Auction on Base Sepolia
 *
 * This example demonstrates how to configure a multicurve auction that starts
 * with a higher swap fee and linearly decays to a terminal fee.
 *
 * Notes:
 * - `pool.fee` is the terminal fee (`endFee`)
 * - `withDecay.startFee` must be >= `pool.fee`
 * - The decay multicurve initializer must be whitelisted on the target chain
 */
import './env'

import { DopplerSDK, WAD, airlockAbi, getAddresses } from '../src'
import { createPublicClient, createWalletClient, http, parseEther, type Address } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'

const privateKey = process.env.PRIVATE_KEY as `0x${string}`
const rpcUrl = process.env.RPC_URL ?? baseSepolia.rpcUrls.default.http[0]

if (!privateKey) throw new Error('PRIVATE_KEY is not set')

async function main() {
  const account = privateKeyToAccount(privateKey)

  const publicClient = createPublicClient({ chain: baseSepolia, transport: http(rpcUrl) })
  const walletClient = createWalletClient({ chain: baseSepolia, transport: http(rpcUrl), account })

  const sdk = new DopplerSDK({ publicClient, walletClient, chainId: baseSepolia.id })
  const addresses = getAddresses(baseSepolia.id)

  const startTime = Math.floor(Date.now() / 1000) + 10 // launch in 10 seconds

  const airlockOwner = await publicClient.readContract({
    address: addresses.airlock,
    abi: airlockAbi,
    functionName: 'owner',
  }) as Address

  const protocolOwnerShare = WAD / 20n // 5%
  const beneficiaries =
    airlockOwner.toLowerCase() === account.address.toLowerCase()
      ? [{ beneficiary: airlockOwner, shares: WAD }]
      : [
          { beneficiary: airlockOwner, shares: protocolOwnerShare },
          { beneficiary: account.address, shares: WAD - protocolOwnerShare },
        ]

  const params = sdk
    .buildMulticurveAuction()
    .tokenConfig({ name: 'Decay Multicurve 2', symbol: 'DMC', tokenURI: 'ipfs://decay.json' })
    .saleConfig({
      initialSupply: 1_000_000n * WAD,
      numTokensToSell: 900_000n * WAD,
      numeraire: '0x4200000000000000000000000000000000000006',
    })
    .poolConfig({
      fee: 12_000, // terminal fee: 1.2%
      tickSpacing: 200,
      curves: [
        { tickLower: 0, tickUpper: 220000, numPositions: 1, shares: parseEther('0.99') },
        { tickLower: 220_000, tickUpper: 887_200, numPositions: 1, shares: parseEther('0.01') },
      ],
      beneficiaries,
    })
    .withDecay({
      startTime,
      startFee: 800_000, // start at 80%
      durationSeconds: 15, // decay over 15 seconds
    })
    .withGovernance({ type: 'noOp' })
    .withMigration({ type: 'noOp' })
    .withUserAddress(account.address)
    .build()

  const result = await sdk.factory.createMulticurve(params)

  console.log('✅ Decay multicurve created')
  console.log('Airlock owner beneficiary:', airlockOwner)
  console.log('Token address:', result.tokenAddress)
  console.log('Pool ID:', result.poolId)
  console.log('Transaction:', result.transactionHash)

  // Optional: read back the fee schedule from the pool hook
  const pool = await sdk.getMulticurvePool(result.tokenAddress)
  const schedule = await pool.getFeeSchedule()
  console.log('Fee schedule:', schedule)
}

main().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})
