import { ReadWriteFactory, DOPPLER_V4_ADDRESSES } from '../src'
import { createDrift } from '@delvtech/drift'
import type { Address } from 'viem'
import { parseEther } from 'viem'

async function main() {
  // This is a usage example; it does not broadcast transactions.
  const chainId = 84532 // Base Sepolia
  const addresses = DOPPLER_V4_ADDRESSES[chainId]

  // For building parameters, a default drift instance is sufficient.
  const drift = createDrift()
  const factory = new ReadWriteFactory(addresses.airlock, drift as any)

  const config = {
    name: 'My Multicurve Token',
    symbol: 'MMT',
    totalSupply: parseEther('1000000'),
    numTokensToSell: parseEther('600000'),
    tokenURI: 'ipfs://example/token.json',
    // Use WETH as numeraire on Base Sepolia
    numeraire: '0x4200000000000000000000000000000000000006' as Address,
    pool: {
      // Example: two evenly weighted curves aligned to tickSpacing
      fee: 3000,         // 0.3%
      tickSpacing: 60,   // ensure ranges are multiples of this
      curves: [
        // width = 600 ticks; divisible by tickSpacing (60) and numPositions (10)
        { tickLower: 174_300, tickUpper: 174_900, numPositions: 10, shares: parseEther('0.5') },
        { tickLower: 174_900, tickUpper: 175_500, numPositions: 10, shares: parseEther('0.5') },
      ],
      // Optional beneficiaries for lockable fees
      lockableBeneficiaries: [],
    },
    integrator: zeroAddress as Address,
  }

  const { createParams } = factory.buildMulticurveCreateParams(config as any, addresses, { useGovernance: true })
  console.log('CreateParams prepared:')
  console.log({
    initialSupply: createParams.initialSupply.toString(),
    numTokensToSell: createParams.numTokensToSell.toString(),
    numeraire: createParams.numeraire,
    poolInitializer: createParams.poolInitializer,
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
