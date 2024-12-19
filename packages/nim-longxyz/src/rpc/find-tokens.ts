import { useQuery } from '@tanstack/react-query'
import type { Address, Hex } from 'viem'
import { ReadDerc20, ReadFactory } from 'doppler-v3-sdk'
import { getDrift } from '~/rpc/utils/drift'
import { addresses } from './utils/addresses'

export type PoolQueryResult = {
  data: PoolData[] | undefined
  error: Error | null
  isLoading: boolean
}

export type TokenData = {
  address: Address
  name: string
  symbol: string
  decimals: number
  totalSupply?: bigint
  poolBalance?: bigint
}

export type PoolData = {
  asset: TokenData
  numeraire: TokenData
  pool: Address
  poolAssetBalance: bigint
  poolNumeraireBalance: bigint
}

export interface PoolCreationData {
  asset: ReadDerc20
  numeraire: ReadDerc20
  pool: Address
  governance: Address
  liquidityMigrator: Address
  migrationPool: Address
  poolInitializer: Address
  timelock: Address
}

const getCreationData = async (airlock: Address) => {
  const drift = getDrift()
  const readFactory = new ReadFactory(airlock, drift)
  const logs = await readFactory.getCreateEvents({
    fromBlock: 0n,
    toBlock: 'latest',
  })
  const assetDatas = await Promise.all(
    logs.map(async log => {
      const assetData = await readFactory.getAssetData(log.args.asset)
      const { numeraire, ...rest } = assetData
      return {
        ...rest,
        asset: new ReadDerc20(log.args.asset, drift),
        numeraire: new ReadDerc20(numeraire, drift),
      }
    })
  )
  return assetDatas
}

export type Token = {
  asset: {
    address: string
    name: string
    symbol: string
    decimals: number
    totalSupply: bigint
  }
  numeraire: {
    address: string
    name: string
    symbol: string
    decimals: number
  }

  pool: Hex
  poolAssetBalance: bigint
  poolNumeraireBalance: bigint
}

const getPoolCreationData = async (
  poolCreation: PoolCreationData
): Promise<Token> => {
  const [assetData, numeraireData] = await Promise.all([
    Promise.all([
      poolCreation.asset.getName(),
      poolCreation.asset.getSymbol(),
      poolCreation.asset.getDecimals(),
      poolCreation.asset.getTotalSupply(),
      poolCreation.asset.getBalanceOf(poolCreation.pool),
    ]),
    Promise.all([
      poolCreation.numeraire.getName(),
      poolCreation.numeraire.getSymbol(),
      poolCreation.numeraire.getDecimals(),
      poolCreation.numeraire.getBalanceOf(poolCreation.pool),
    ]),
  ])

  const [
    assetName,
    assetSymbol,
    assetDecimals,
    assetTotalSupply,
    poolAssetBalance,
  ] = assetData
  const [
    numeraireName,
    numeraireSymbol,
    numeraireDecimals,
    poolNumeraireBalance,
  ] = numeraireData

  return {
    asset: {
      address: poolCreation.asset.contract.address,
      name: assetName,
      symbol: assetSymbol,
      decimals: assetDecimals,
      totalSupply: assetTotalSupply,
    },
    numeraire: {
      address: poolCreation.numeraire.contract.address,
      name: numeraireName,
      symbol: numeraireSymbol,
      decimals: numeraireDecimals,
    },
    pool: poolCreation.pool,
    poolAssetBalance,
    poolNumeraireBalance,
  }
}

export default async function findTokens() {
  const airlock = addresses.airlock
  const creationData = await getCreationData(airlock)
  const tokens = await Promise.all(
    creationData.map(data => getPoolCreationData(data))
  )

  return tokens
}
