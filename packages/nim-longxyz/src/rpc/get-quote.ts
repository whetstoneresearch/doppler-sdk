import Quoter from '@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json'
import { ethers } from 'ethers'
import {
  config,
  CurrentConfig,
  getPoolConstants,
} from '~/components/FormTrade/service/config'
import { getProvider } from '~/components/FormTrade/service/provider'
import {
  fromReadableAmount,
  toReadableAmount,
} from '~/components/FormTrade/service/utils'

export async function getQuote(amount: number): Promise<string> {
  const quoterContract = new ethers.Contract(
    config.QUOTER_CONTRACT_ADDRESS,
    Quoter.abi,
    getProvider()
  )

  const poolConstants = await getPoolConstants()

  console.log({ poolConstants })

  const quotedAmountOut = await quoterContract.callStatic.quoteExactInputSingle(
    poolConstants.token0,
    poolConstants.token1,
    poolConstants.fee,
    fromReadableAmount(amount, CurrentConfig.tokens.in.decimals).toString(),
    0
  )

  return toReadableAmount(quotedAmountOut, CurrentConfig.tokens.out.decimals)
}
