import { index, onchainTable, primaryKey, relations } from "ponder";

/* TABLES */
export const user = onchainTable(
  "user",
  (t) => ({
    address: t.hex(),
    chainId: t.integer().notNull(),
    createdAt: t.bigint().notNull(),
    lastSeenAt: t.bigint().notNull(),
  }),
  (table) => ({
    pk: primaryKey({
      columns: [table.address, table.chainId],
    }),
    addressIdx: index().on(table.address),
  })
);

export const token = onchainTable(
  "token",
  (t) => ({
    address: t.hex(),
    chainId: t.integer().notNull(),
    name: t.text().notNull(),
    symbol: t.text().notNull(),
    decimals: t.integer().notNull(),
    tokenUriData: t.jsonb(),
    tokenUri: t.text(),
    totalSupply: t.bigint().notNull(),
    image: t.text(),
    isDerc20: t.boolean().notNull().default(false),
    isCreatorCoin: t.boolean().notNull().default(false),
    isContentCoin: t.boolean().notNull().default(false),
    derc20Data: t.hex(),
    firstSeenAt: t.bigint().notNull(),
    lastSeenAt: t.bigint().notNull(),
    pool: t.hex(),
    volumeUsd: t.bigint().notNull().default(0n),
    holderCount: t.integer().notNull().default(0),
    creatorAddress: t.hex().notNull(),
    creatorCoinPid: t.hex(),
    triedMetadata: t.boolean().notNull().default(false),
  }),
  (table) => ({
    pk: primaryKey({
      columns: [table.address, table.chainId],
    }),
    addressIdx: index().on(table.address),
    chainIdIdx: index().on(table.chainId),
    poolIdx: index().on(table.pool),
  })
);

export const ethPrice = onchainTable("eth_price", (t) => ({
  timestamp: t.bigint().notNull(),
  chainId: t.integer().notNull(),
  price: t.bigint().notNull(),
}),
  (table) => ({
    pk: primaryKey({
      columns: [table.timestamp, table.chainId],
    }),
  })
);

export const zoraUsdcPrice = onchainTable("zora_usdc_price", (t) => ({
  timestamp: t.bigint().notNull(),
  chainId: t.integer().notNull(),
  price: t.bigint().notNull(),
}),
  (table) => ({
    pk: primaryKey({
      columns: [table.timestamp, table.chainId],
    }),
  })
);

export const asset = onchainTable(
  "asset",
  (t) => ({
    address: t.hex().notNull(),
    isToken0: t.boolean().notNull(),
    poolAddress: t.hex().notNull(),
    chainId: t.integer().notNull(),
    numeraire: t.hex().notNull(),
    timelock: t.hex().notNull(),
    governance: t.hex().notNull(),
    liquidityMigrator: t.hex().notNull(),
    poolInitializer: t.hex().notNull(),
    migrationPool: t.hex().notNull(),
    v2Pool: t.hex(),
    numTokensToSell: t.bigint().notNull(),
    integrator: t.hex().notNull(),
    createdAt: t.bigint().notNull(),
    migratedAt: t.bigint(),
    migrated: t.boolean().notNull().default(false),
    migrationType: t.text().notNull().default("v2"),
    percentDayChange: t.doublePrecision().notNull().default(0),
    marketCapUsd: t.bigint().notNull().default(0n),
    holderCount: t.integer().notNull().default(0),
    dayVolumeUsd: t.bigint().notNull().default(0n),
    liquidityUsd: t.bigint().notNull().default(0n),
  }),
  (table) => ({
    pk: primaryKey({
      columns: [table.address, table.chainId],
    }),
    addressIdx: index().on(table.address),
    chainIdIdx: index().on(table.chainId),
    poolAddressIdx: index().on(table.poolAddress),
  })
);

export const hourBucket = onchainTable(
  "hour_bucket",
  (t) => ({
    hourId: t.integer().notNull(),
    pool: t.hex().notNull(),
    open: t.bigint().notNull(),
    close: t.bigint().notNull(),
    low: t.bigint().notNull(),
    high: t.bigint().notNull(),
    average: t.bigint().notNull(),
    count: t.integer().notNull(),
    chainId: t.integer().notNull(),
  }),
  (table) => ({
    pk: primaryKey({
      columns: [table.pool, table.hourId, table.chainId],
    }),
    poolIdx: index().on(table.pool),
    hourIdIdx: index().on(table.hourId),
    chainIdIdx: index().on(table.chainId),
  })
);

export const hourBucketUsd = onchainTable(
  "hour_bucket_usd",
  (t) => ({
    hourId: t.integer().notNull(),
    pool: t.hex().notNull(),
    open: t.bigint().notNull(),
    close: t.bigint().notNull(),
    low: t.bigint().notNull(),
    high: t.bigint().notNull(),
    average: t.bigint().notNull(),
    count: t.integer().notNull(),
    chainId: t.integer().notNull(),
  }),
  (table) => ({
    pk: primaryKey({
      columns: [table.pool, table.hourId, table.chainId],
    }),
    poolIdx: index().on(table.pool),
    hourIdIdx: index().on(table.hourId),
    chainIdIdx: index().on(table.chainId),
  })
);

// 15-minute OHLC buckets (USD)
export const fifteenMinuteBucketUsd = onchainTable(
  "fifteen_minute_bucket_usd",
  (t) => ({
    minuteId: t.integer().notNull(),
    pool: t.hex().notNull(),
    open: t.bigint().notNull(),
    close: t.bigint().notNull(),
    low: t.bigint().notNull(),
    high: t.bigint().notNull(),
    average: t.bigint().notNull(),
    count: t.integer().notNull(),
    chainId: t.integer().notNull(),
    volumeUsd: t.bigint().notNull(),
  }),
  (table) => ({
    pk: primaryKey({
      columns: [table.pool, table.minuteId, table.chainId],
    }),
    poolIdx: index().on(table.pool),
    minuteIdIdx: index().on(table.minuteId),
    chainIdIdx: index().on(table.chainId),
  })
);
export const position = onchainTable(
  "position",
  (t) => ({
    owner: t.hex().notNull(),
    pool: t.hex().notNull(),
    tickLower: t.integer().notNull(),
    tickUpper: t.integer().notNull(),
    liquidity: t.bigint().notNull(),
    createdAt: t.bigint().notNull(),
    chainId: t.integer().notNull(),
  }),
  (table) => ({
    pk: primaryKey({
      columns: [table.pool, table.tickLower, table.tickUpper, table.chainId],
    }),
    ownerIdx: index().on(table.owner),
    poolIdx: index().on(table.pool),
  })
);

export const module = onchainTable(
  "module",
  (t) => ({
    address: t.text().notNull(),
    chainId: t.integer().notNull(),
    state: t.integer().notNull(),
    lastUpdated: t.bigint().notNull(),
  }),
  (table) => ({
    pk: primaryKey({
      columns: [table.address, table.chainId],
    }),
    addressIdx: index().on(table.address),
    chainIdIdx: index().on(table.chainId),
  })
);

export const v4PoolConfig = onchainTable("v4_pool_config", (t) => ({
  hookAddress: t.hex().notNull(),
  chainId: t.integer().notNull(),
  numTokensToSell: t.bigint().notNull(),
  minProceeds: t.bigint().notNull(),
  maxProceeds: t.bigint().notNull(),
  startingTime: t.bigint().notNull(),
  endingTime: t.bigint().notNull(),
  startingTick: t.integer().notNull(),
  endingTick: t.integer().notNull(),
  epochLength: t.bigint().notNull(),
  gamma: t.integer().notNull(),
  isToken0: t.boolean().notNull(),
  numPdSlugs: t.bigint().notNull(),
}),
  (table) => ({
    pk: primaryKey({
      columns: [table.hookAddress, table.chainId],
    }),
    hookAddressIdx: index().on(table.hookAddress),
    chainIdIdx: index().on(table.chainId),
  })
);

export const pool = onchainTable(
  "pool",
  (t) => ({
    address: t.hex().notNull(),
    chainId: t.integer().notNull(),
    tick: t.integer().notNull(),
    sqrtPrice: t.bigint().notNull(),
    liquidity: t.bigint().notNull(),
    integrator: t.hex(),
    createdAt: t.bigint().notNull(),
    asset: t.hex().notNull(),
    baseToken: t.hex().notNull(),
    quoteToken: t.hex().notNull(),
    price: t.bigint().notNull(),
    fee: t.integer().notNull(),
    type: t.text().notNull(),
    dollarLiquidity: t.bigint().notNull(),
    dailyVolume: t.hex().notNull(),
    volumeUsd: t.bigint().notNull(),
    percentDayChange: t.doublePrecision().notNull().default(0),
    totalFee0: t.bigint().notNull(),
    totalFee1: t.bigint().notNull(),
    graduationBalance: t.bigint().notNull(),
    graduationPercentage: t.doublePrecision().notNull().default(0),
    minThreshold: t.bigint(),
    maxThreshold: t.bigint().notNull(),
    isToken0: t.boolean().notNull(),
    lastRefreshed: t.bigint(),
    lastSwapTimestamp: t.bigint(),
    reserves0: t.bigint().notNull().default(0n),
    reserves1: t.bigint().notNull().default(0n),
    totalProceeds: t.bigint().notNull().default(0n),
    totalTokensSold: t.bigint().notNull().default(0n),
    holderCount: t.integer().notNull().default(0),
    marketCapUsd: t.bigint().notNull().default(0n),
    migrated: t.boolean().notNull().default(false),
    migratedAt: t.bigint(),
    migratedToPool: t.hex(),
    migratedToV4PoolId: t.hex(), // For V4 migrations, stores the 32-byte pool ID
    migratedFromPool: t.hex(),
    isQuoteEth: t.boolean().notNull().default(false),
    isQuoteZora: t.boolean().notNull().default(false),
    isStreaming: t.boolean().notNull().default(false),
    migrationType: t.text().notNull().default("v2"),
    isContentCoin: t.boolean().notNull().default(false),
    isCreatorCoin: t.boolean().notNull().default(false),
    poolKey: t.jsonb().notNull().default("{}"),
  }),
  (table) => ({
    pk: primaryKey({
      columns: [table.address, table.chainId],
    }),
    baseTokenIdx: index().on(table.baseToken),
    quoteTokenIdx: index().on(table.quoteToken),
    lastRefreshedIdx: index().on(table.lastRefreshed),
    lastSwapTimestampIdx: index().on(table.lastSwapTimestamp),
  })
);

export const v2Pool = onchainTable("v2_pool", (t) => ({
  address: t.hex().notNull(),
  chainId: t.integer().notNull(),
  baseToken: t.hex().notNull(),
  quoteToken: t.hex().notNull(),
  reserveBaseToken: t.bigint().notNull(),
  reserveQuoteToken: t.bigint().notNull(),
  totalFeeBaseToken: t.bigint().notNull(),
  totalFeeQuoteToken: t.bigint().notNull(),
  price: t.bigint().notNull(),
  parentPool: t.hex().notNull(),
  v3Pool: t.hex().notNull(),
  migratedAt: t.bigint(),
  migrated: t.boolean().notNull(),
  isToken0: t.boolean().notNull(),
}),
  (table) => ({
    pk: primaryKey({
      columns: [table.address, table.chainId],
    }),
  })
);

export const migrationPool = onchainTable("migration_pool", (t) => ({
  address: t.hex().notNull(),
  chainId: t.integer().notNull(),
  baseToken: t.hex().notNull(),
  quoteToken: t.hex().notNull(),
  reserveBaseToken: t.bigint().notNull(),
  reserveQuoteToken: t.bigint().notNull(),
  price: t.bigint().notNull(),
  parentPool: t.hex().notNull(),
  migratedAt: t.bigint().notNull(),
  isToken0: t.boolean().notNull(),
  type: t.text().notNull().default("v2"),
  fee: t.integer().notNull(),
}),
  (table) => ({
    pk: primaryKey({
      columns: [table.address, table.chainId],
    }),
  })
);

export const v4pools = onchainTable(
  "v4_pools",
  (t) => ({
    // Identity - using 32-byte pool ID as primary key
    poolId: t.hex().notNull(),
    chainId: t.integer().notNull(),

    // PoolKey components for reconstruction
    currency0: t.hex().notNull(),
    currency1: t.hex().notNull(),
    fee: t.integer().notNull(),
    tickSpacing: t.integer().notNull(),
    hooks: t.hex().notNull(),

    // Pool state
    sqrtPriceX96: t.bigint().notNull(),
    liquidity: t.bigint().notNull(),
    tick: t.integer().notNull(),

    // Token references
    baseToken: t.hex().notNull(),
    quoteToken: t.hex().notNull(),
    asset: t.hex(), // Reference to asset if this is a Doppler token

    // Migration tracking
    migratedFromPool: t.hex(), // Original Doppler pool address
    migratedAt: t.bigint().notNull(),
    migratorVersion: t.text().notNull().default("v4"),

    // Metrics
    price: t.bigint().notNull(),
    volumeUsd: t.bigint().notNull().default(0n),
    dollarLiquidity: t.bigint().notNull().default(0n),
    totalFee0: t.bigint().notNull().default(0n),
    totalFee1: t.bigint().notNull().default(0n),
    reserves0: t.bigint().notNull().default(0n),
    reserves1: t.bigint().notNull().default(0n),

    // Timestamps
    createdAt: t.bigint().notNull(),
    lastRefreshed: t.bigint(),
    lastSwapTimestamp: t.bigint(),

    // Price tracking
    percentDayChange: t.doublePrecision().notNull().default(0),

    // Relations
    dailyVolume: t.hex(),

    // Helper fields
    isToken0: t.boolean().notNull(),
    isQuoteEth: t.boolean().notNull(),
  }),
  (table) => ({
    pk: primaryKey({
      columns: [table.poolId, table.chainId],
    }),
    baseTokenIdx: index().on(table.baseToken),
    quoteTokenIdx: index().on(table.quoteToken),
    assetIdx: index().on(table.asset),
    migratedFromPoolIdx: index().on(table.migratedFromPool),
    lastRefreshedIdx: index().on(table.lastRefreshed),
    lastSwapTimestampIdx: index().on(table.lastSwapTimestamp),
  })
);

export const userAsset = onchainTable(
  "user_asset",
  (t) => ({
    chainId: t.integer().notNull(),
    userId: t.hex().notNull(),
    assetId: t.hex().notNull(),
    balance: t.bigint().notNull(),
    createdAt: t.bigint().notNull(),
    lastInteraction: t.bigint().notNull(),
  }),
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.assetId, table.chainId] }),
    userIdIdx: index().on(table.userId),
    assetIdIdx: index().on(table.assetId),
    chainIdIdx: index().on(table.chainId),
  })
);

// 24-hour volume buckets (keep forever)
export const volumeBucket24h = onchainTable(
  "volume_bucket_24h",
  (t) => ({
    poolAddress: t.hex().notNull(),
    assetAddress: t.hex().notNull(),
    chainId: t.integer().notNull(),
    timestamp: t.bigint().notNull(), // Rounded to day intervals
    
    // Volume metrics
    volumeUsd: t.bigint().notNull().default(0n),
    volumeToken0: t.bigint().notNull().default(0n),
    volumeToken1: t.bigint().notNull().default(0n),
    txCount: t.integer().notNull().default(0),
    uniqueUsers: t.integer().notNull().default(0),
    buyCount: t.integer().notNull().default(0),
    sellCount: t.integer().notNull().default(0),
    
    // Price metrics (OHLC)
    open: t.bigint().notNull(),
    high: t.bigint().notNull(),
    low: t.bigint().notNull(),
    close: t.bigint().notNull(),
    vwap: t.bigint(), // Volume-weighted average price
    
    // Snapshot metrics at close
    liquidityUsd: t.bigint().notNull(),
    marketCapUsd: t.bigint().notNull(),
    holderCount: t.integer().notNull().default(0),
    
    // Fee metrics
    feesUsd: t.bigint().notNull().default(0n),
    
    // Metadata
    createdAt: t.bigint().notNull(),
    updatedAt: t.bigint().notNull(),
  }),
  (table) => ({
    pk: primaryKey({
      columns: [table.poolAddress, table.timestamp, table.chainId],
    }),
    timestampIdx: index().on(table.timestamp),
    assetIdx: index().on(table.assetAddress),
    volumeIdx: index().on(table.volumeUsd),
    marketCapIdx: index().on(table.marketCapUsd),
    txCountIdx: index().on(table.txCount),
  })
);

export const swap = onchainTable("swap", (t) => ({
  txHash: t.hex().notNull(),
  pool: t.hex().notNull(),
  asset: t.hex().notNull(),
  chainId: t.integer().notNull(),
  amountIn: t.bigint().notNull(),
  amountOut: t.bigint().notNull(),
  type: t.text().notNull(), // buy or sell
  user: t.hex().notNull(),
  timestamp: t.bigint().notNull(),
  usdPrice: t.bigint().notNull(),
}),
  (table) => ({
    pk: primaryKey({
      columns: [table.txHash, table.chainId],
    }),
    poolIdx: index().on(table.pool),
    assetIdx: index().on(table.asset),
    chainIdIdx: index().on(table.chainId),
    txHashIdx: index().on(table.txHash),
    userIdx: index().on(table.user),
    timestampIdx: index().on(table.timestamp),
  })
);

/* RELATIONS */

// assets have one pool
export const assetRelations = relations(asset, ({ one, many }) => ({
  pool: one(pool, { fields: [asset.poolAddress], references: [pool.address] }),
  userAssets: many(userAsset),
  swaps: many(swap),
  volumeBuckets24h: many(volumeBucket24h),
}));

export const swapRelations = relations(swap, ({ one }) => ({
  pool: one(pool, { fields: [swap.pool], references: [pool.address] }),
  asset: one(asset, { fields: [swap.asset], references: [asset.address] }),
}));

// pools have many positions
export const poolRelations = relations(pool, ({ one, many }) => ({
  positions: many(position),
  baseToken: one(token, {
    fields: [pool.baseToken],
    references: [token.address],
  }),
  quoteToken: one(token, {
    fields: [pool.quoteToken],
    references: [token.address],
  }),
  asset: one(asset, {
    fields: [pool.asset],
    references: [asset.address],
  }),
  hourBuckets: many(hourBucket),
  hourBucketUsds: many(hourBucketUsd),
  fifteenMinuteBucketUsds: many(fifteenMinuteBucketUsd),
  swaps: many(swap),
  volumeBuckets24h: many(volumeBucket24h),
}));

export const v2PoolRelations = relations(v2Pool, ({ one }) => ({
  v3Pool: one(pool, {
    fields: [v2Pool.v3Pool],
    references: [pool.address],
  }),
}));

export const migrationPoolRelations = relations(migrationPool, ({ one }) => ({
  parentPool: one(pool, {
    fields: [migrationPool.parentPool],
    references: [pool.address],
  }),
}));

// positions have one pool
export const positionRelations = relations(position, ({ one }) => ({
  pool: one(pool, { fields: [position.pool], references: [pool.address] }),
}));

// tokens have one pool
export const tokenRelations = relations(token, ({ one }) => ({
  pool: one(pool, { fields: [token.pool], references: [pool.address] }),
  derc20Data: one(asset, {
    fields: [token.derc20Data],
    references: [asset.address],
  }),
}));

// users have many assets and positions
export const userRelations = relations(user, ({ many }) => ({
  userAssets: many(userAsset),
}));

// userAsset has one user and one asset
export const userAssetRelations = relations(userAsset, ({ one }) => ({
  user: one(user, { fields: [userAsset.userId], references: [user.address] }),
  asset: one(asset, {
    fields: [userAsset.assetId],
    references: [asset.address],
  }),
}));

export const hourBucketRelations = relations(hourBucket, ({ one }) => ({
  pool: one(pool, {
    fields: [hourBucket.pool],
    references: [pool.address],
  }),
}));

export const hourBucketUsdRelations = relations(hourBucketUsd, ({ one }) => ({
  pool: one(pool, {
    fields: [hourBucketUsd.pool],
    references: [pool.address],
  }),
}));

export const fifteenMinuteBucketUsdRelations = relations(
  fifteenMinuteBucketUsd,
  ({ one }) => ({
    pool: one(pool, {
      fields: [fifteenMinuteBucketUsd.pool],
      references: [pool.address],
    }),
  })
);

// v4pools relations
export const v4poolsRelations = relations(v4pools, ({ one, many }) => ({
  baseToken: one(token, {
    fields: [v4pools.baseToken],
    references: [token.address],
  }),
  quoteToken: one(token, {
    fields: [v4pools.quoteToken],
    references: [token.address],
  }),
  asset: one(asset, {
    fields: [v4pools.asset],
    references: [asset.address],
  }),
  migratedFromPool: one(pool, {
    fields: [v4pools.migratedFromPool],
    references: [pool.address],
  }),
}));

// Time bucket relations
export const volumeBucket24hRelations = relations(volumeBucket24h, ({ one }) => ({
  pool: one(pool, {
    fields: [volumeBucket24h.poolAddress],
    references: [pool.address],
  }),
  asset: one(asset, {
    fields: [volumeBucket24h.assetAddress],
    references: [asset.address],
  }),
}));
