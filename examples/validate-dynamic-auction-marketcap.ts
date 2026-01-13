import './env'
import { formatUnits, parseEther } from 'viem'
import { tickToMarketCap } from '../src/utils/marketCapHelpers'

const INDEXER_URL = 'https://indexer-prod.marble.live/sql/db'

// Known addresses
const WETH_BASE = '0x4200000000000000000000000000000000000006'
const USDC_BASE = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'
const USDT_BASE = '0xfde4c96c8593536e31f229ea8f37b2ada2699bb2'

interface PoolRow {
  name: string
  symbol: string
  token_address: string
  pool_address: string
  type: string
  tick: string
  is_token0: boolean
  price: string
  market_cap_usd: string
  quote_token: string
  initial_supply: string
  start_tick: string
  end_tick: string
}

async function queryIndexer(sql: string): Promise<PoolRow[]> {
  const query = {
    json: { sql, params: [], typings: null },
    meta: { values: { typings: ['undefined'] }, v: 1 },
  }

  const response = await fetch(`${INDEXER_URL}?sql=${encodeURIComponent(JSON.stringify(query))}`)
  const data = await response.json()
  return data.rows || []
}

async function main() {
  console.log('='.repeat(80))
  console.log('Validating Dynamic Auction (dhook) Market Caps')
  console.log('='.repeat(80))
  console.log('')

  // Find recent dhook pools
  const sql = `
    SELECT
      t.name,
      t.symbol,
      t.address as token_address,
      p.address as pool_address,
      p.type,
      p.tick,
      p.is_token0,
      p.price,
      p.market_cap_usd,
      p.quote_token
    FROM pool p
    JOIN token t ON t.pool = p.address AND t.chain_id = p.chain_id
    WHERE p.chain_id = 8453
      AND p.type = 'v4'
      AND CAST(p.market_cap_usd AS DECIMAL) > 1000000000000000000
    ORDER BY p.created_at DESC
    LIMIT 10
  `

  const rows = await queryIndexer(sql)

  if (rows.length === 0) {
    console.log('No dhook pools found')
    return
  }

  for (const row of rows) {
    const isUsdc = row.quote_token.toLowerCase() === USDC_BASE.toLowerCase()
    const isUsdt = row.quote_token.toLowerCase() === USDT_BASE.toLowerCase()
    const isWeth = row.quote_token.toLowerCase() === WETH_BASE.toLowerCase()
    const isStablecoin = isUsdc || isUsdt
    const numeraireName = isUsdc ? 'USDC' : isUsdt ? 'USDT' : isWeth ? 'ETH' : 'Unknown'
    const numerairePrice = isStablecoin ? 1 : 3000 // Assume $3000 ETH for validation
    const numeraireDecimals = isStablecoin ? 6 : 18

    // Parse indexer values
    const indexerMcap = parseFloat(formatUnits(BigInt(row.market_cap_usd || '0'), 18))
    const indexerPrice = parseFloat(formatUnits(BigInt(row.price || '0'), 18))
    const currentTick = parseInt(row.tick || '0')
    // Use standard 1B supply for calculation
    const initialSupply = parseEther('1000000000')

    // Calculate expected market cap from tick
    let calculatedMcap = 0
    try {
      calculatedMcap = tickToMarketCap(
        currentTick,
        initialSupply,
        numerairePrice,
        18,
        numeraireDecimals,
        row.quote_token as `0x${string}`
      )
    } catch (e) {
      // Skip if calculation fails
    }

    // Calculate ratio for comparison
    const ratio = indexerMcap > 0 && calculatedMcap > 0
      ? (indexerMcap / calculatedMcap)
      : 0

    console.log(`${row.name} (${row.symbol})`)
    console.log(`  Token: ${row.token_address}`)
    console.log(`  Pool: ${row.pool_address}`)
    console.log(`  Numeraire: ${numeraireName} (${row.quote_token})`)
    console.log(`  isToken0: ${row.is_token0}`)
    console.log(`  Current Tick: ${currentTick}`)
    console.log(`  --- Market Cap Comparison ---`)
    console.log(`  Indexer MCap: $${indexerMcap.toLocaleString(undefined, { maximumFractionDigits: 2 })}`)
    console.log(`  Calculated MCap: $${calculatedMcap.toLocaleString(undefined, { maximumFractionDigits: 2 })}`)
    console.log(`  Ratio (Indexer/Calculated): ${ratio.toFixed(4)}`)

    // Flag if there's a significant discrepancy
    if (ratio > 0 && (ratio > 10 || ratio < 0.1)) {
      console.log(`  ⚠️  SIGNIFICANT DISCREPANCY - ratio should be close to 1.0`)
    } else if (ratio > 0 && (ratio > 1.5 || ratio < 0.67)) {
      console.log(`  ⚡ Minor discrepancy (may be due to ETH price assumption)`)
    } else if (ratio > 0) {
      console.log(`  ✅ Values are reasonably close`)
    }
    console.log('')
  }

  // Also check for USDC-specific dhook pools
  console.log('='.repeat(80))
  console.log('USDC-based Dynamic Auctions Specifically')
  console.log('='.repeat(80))
  console.log('')

  const usdcSql = `
    SELECT
      t.name,
      t.symbol,
      t.address as token_address,
      p.address as pool_address,
      p.type,
      p.tick,
      p.is_token0,
      p.price,
      p.market_cap_usd,
      p.quote_token
    FROM pool p
    JOIN token t ON t.pool = p.address AND t.chain_id = p.chain_id
    WHERE p.chain_id = 8453
      AND p.type = 'v4'
      AND LOWER(p.quote_token) = '${USDC_BASE.toLowerCase()}'
    ORDER BY p.created_at DESC
    LIMIT 5
  `

  const usdcRows = await queryIndexer(usdcSql)

  if (usdcRows.length === 0) {
    console.log('No USDC-based dhook pools found')
  } else {
    for (const row of usdcRows) {
      const indexerMcap = parseFloat(formatUnits(BigInt(row.market_cap_usd || '0'), 18))
      const currentTick = parseInt(row.tick || '0')
      const initialSupply = parseEther('1000000000')

      let calculatedMcap = 0
      try {
        calculatedMcap = tickToMarketCap(
          currentTick,
          initialSupply,
          1, // USDC = $1
          18,
          6, // USDC has 6 decimals
          USDC_BASE as `0x${string}`
        )
      } catch (e) {
        // Skip if calculation fails
      }

      const ratio = indexerMcap > 0 && calculatedMcap > 0 ? (indexerMcap / calculatedMcap) : 0

      console.log(`${row.name} (${row.symbol})`)
      console.log(`  Token: ${row.token_address}`)
      console.log(`  Tick: ${currentTick}`)
      console.log(`  isToken0: ${row.is_token0}`)
      console.log(`  Indexer MCap: $${indexerMcap.toLocaleString(undefined, { maximumFractionDigits: 2 })}`)
      console.log(`  Calculated MCap: $${calculatedMcap.toLocaleString(undefined, { maximumFractionDigits: 2 })}`)
      console.log(`  Ratio: ${ratio.toFixed(4)}`)

      if (ratio > 0 && (ratio > 10 || ratio < 0.1)) {
        console.log(`  ⚠️  SIGNIFICANT DISCREPANCY`)
      } else if (ratio > 0) {
        console.log(`  ✅ OK`)
      }
      console.log('')
    }
  }

  // Also check for USDT-specific dhook pools
  console.log('='.repeat(80))
  console.log('USDT-based Dynamic Auctions Specifically')
  console.log('='.repeat(80))
  console.log('')

  const usdtSql = `
    SELECT
      t.name,
      t.symbol,
      t.address as token_address,
      p.address as pool_address,
      p.type,
      p.tick,
      p.is_token0,
      p.price,
      p.market_cap_usd,
      p.quote_token
    FROM pool p
    JOIN token t ON t.pool = p.address AND t.chain_id = p.chain_id
    WHERE p.chain_id = 8453
      AND p.type = 'v4'
      AND LOWER(p.quote_token) = '${USDT_BASE.toLowerCase()}'
    ORDER BY p.created_at DESC
    LIMIT 5
  `

  const usdtRows = await queryIndexer(usdtSql)

  if (usdtRows.length === 0) {
    console.log('No USDT-based dhook pools found')
  } else {
    for (const row of usdtRows) {
      const indexerMcap = parseFloat(formatUnits(BigInt(row.market_cap_usd || '0'), 18))
      const currentTick = parseInt(row.tick || '0')
      const initialSupply = parseEther('1000000000')

      let calculatedMcap = 0
      try {
        calculatedMcap = tickToMarketCap(
          currentTick,
          initialSupply,
          1, // USDT = $1
          18,
          6, // USDT has 6 decimals
          USDT_BASE as `0x${string}`
        )
      } catch (e) {
        // Skip if calculation fails
      }

      const ratio = indexerMcap > 0 && calculatedMcap > 0 ? (indexerMcap / calculatedMcap) : 0

      console.log(`${row.name} (${row.symbol})`)
      console.log(`  Token: ${row.token_address}`)
      console.log(`  Tick: ${currentTick}`)
      console.log(`  isToken0: ${row.is_token0}`)
      console.log(`  Indexer MCap: $${indexerMcap.toLocaleString(undefined, { maximumFractionDigits: 2 })}`)
      console.log(`  Calculated MCap: $${calculatedMcap.toLocaleString(undefined, { maximumFractionDigits: 2 })}`)
      console.log(`  Ratio: ${ratio.toFixed(4)}`)

      if (ratio > 0 && (ratio > 10 || ratio < 0.1)) {
        console.log(`  ⚠️  SIGNIFICANT DISCREPANCY`)
      } else if (ratio > 0) {
        console.log(`  ✅ OK`)
      }
      console.log('')
    }
  }
}

main().catch(console.error)
