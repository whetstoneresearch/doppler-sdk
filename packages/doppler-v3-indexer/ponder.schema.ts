import { index, onchainTable, primaryKey, relations } from "ponder";

export const user = onchainTable(
  "user",
  (t) => ({
    address: t.hex().primaryKey(),
    createdAt: t.bigint().notNull(),
    lastSeenAt: t.bigint().notNull(),
  }),
  (table) => ({
    addressIdx: index().on(table.address),
  })
);

export const token = onchainTable(
  "token",
  (t) => ({
    address: t.hex().primaryKey(),
    chainId: t.bigint().notNull(),
    name: t.text().notNull(),
    symbol: t.text().notNull(),
    decimals: t.integer().notNull(),
    totalSupply: t.bigint().notNull(),
    image: t.text(),
    isDerc20: t.boolean().notNull().default(false),
    isCreatorCoin: t.boolean().notNull().default(false),
    isContentCoin: t.boolean().notNull().default(false),
    firstSeenAt: t.bigint().notNull(),
    lastSeenAt: t.bigint().notNull(),
    holderCount: t.integer().notNull().default(0),
    creatorAddress: t.hex().notNull(),
    creatorCoinPid: t.hex(),
    pool: t.hex(),
  }),
  (table) => ({
    addressIdx: index().on(table.address),
    chainIdIdx: index().on(table.chainId),
    poolIdx: index().on(table.pool),
  })
);

export const ethPrice = onchainTable("eth_price", (t) => ({
  timestamp: t.bigint().primaryKey(),
  price: t.bigint().notNull(),
}), (table) => ({
  timestampIdx: index().on(table.timestamp),
}));

export const zoraUsdcPrice = onchainTable("zora_usdc_price", (t) => ({
  timestamp: t.bigint().primaryKey(),
  price: t.bigint().notNull(),
}), (table) => ({
  timestampIdx: index().on(table.timestamp),
}));

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
    chainId: t.bigint().notNull(),
    volumeUsd: t.bigint().notNull(),
  }),
  (table) => ({
    pk: primaryKey({
      columns: [table.pool, table.minuteId, table.chainId],
    }),
    poolIdx: index().on(table.pool),
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
    chainId: t.bigint().notNull(),
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
    address: t.text().primaryKey(),
    chainId: t.bigint().notNull(),
    state: t.integer().notNull(),
    lastUpdated: t.bigint().notNull(),
  }),
  (table) => ({
    addressIdx: index().on(table.address),
    chainIdIdx: index().on(table.chainId),
  })
);

export const v4PoolConfig = onchainTable("v4_pool_config", (t) => ({
  hookAddress: t.hex().notNull().primaryKey(),
  poolKey: t.jsonb().notNull().default("{}"),
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
}), (table) => ({
  hookAddressIdx: index().on(table.hookAddress),
}));

export const pool = onchainTable(
  "pool",
  (t) => ({
    // initialization data
    address: t.hex().notNull(),
    chainId: t.bigint().notNull(),
    baseToken: t.hex().notNull(),
    quoteToken: t.hex().notNull(),
    createdAt: t.bigint().notNull(),
    isToken0: t.boolean().notNull(),
    integrator: t.hex(),
    type: t.text().notNull(),
    migrationType: t.text().notNull(),

    // pool state data
    tick: t.integer().notNull(),
    sqrtPrice: t.bigint().notNull(),
    liquidity: t.bigint().notNull(),
    fee: t.integer().notNull(),
    price: t.bigint().notNull(),

    // computed universal metrics
    dollarLiquidity: t.bigint().notNull(),
    volumeUsd: t.bigint().notNull(),
    totalFee0: t.bigint().notNull(),
    totalFee1: t.bigint().notNull(),
    reserves0: t.bigint().notNull().default(0n),
    reserves1: t.bigint().notNull().default(0n),
    holderCount: t.integer().notNull().default(0),
    marketCapUsd: t.bigint().notNull().default(0n),
    lastSwapTimestamp: t.bigint(),

    // doppler specificstate data
    minThreshold: t.bigint(),
    maxThreshold: t.bigint().notNull(),
    graduationBalance: t.bigint().notNull(),
    graduationPercentage: t.doublePrecision().notNull().default(0),
    totalProceeds: t.bigint().notNull().default(0n),
    totalTokensSold: t.bigint().notNull().default(0n),

    // routing data
    migrated: t.boolean().notNull().default(false),
    migratedAt: t.bigint(),
    isQuoteEth: t.boolean().notNull().default(false),
    isQuoteZora: t.boolean().notNull().default(false),
    isStreaming: t.boolean().notNull().default(false),
    isContentCoin: t.boolean().notNull().default(false),
    isCreatorCoin: t.boolean().notNull().default(false),

    // v4 specific state data
    v4PoolConfig: t.hex(),
    poolKey: t.jsonb(),

    // doppler initialization relations
    timelock: t.hex(),
    governance: t.hex(),
    liquidityMigrator: t.hex(),
    poolInitializer: t.hex(),
    migrationPool: t.hex(),
  }),
  (table) => ({
    pk: primaryKey({
      columns: [table.address, table.chainId],
    }),
    baseTokenIdx: index().on(table.baseToken),
    quoteTokenIdx: index().on(table.quoteToken),
    migrationPoolIdx: index().on(table.migrationPool),
  })
);

export const migrationPool = onchainTable("migration_pool", (t) => ({
  address: t.hex().notNull().primaryKey(),
  chainId: t.bigint().notNull(),
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
}), (table) => ({
  addressIdx: index().on(table.address),
  baseTokenIdx: index().on(table.baseToken),
  quoteTokenIdx: index().on(table.quoteToken),
  parentPoolIdx: index().on(table.parentPool),
}));

// export const v4pools = onchainTable(
//   "v4_pools",
//   (t) => ({
//     // Identity - using 32-byte pool ID as primary key
//     poolId: t.hex().notNull(),
//     chainId: t.bigint().notNull(),

//     // PoolKey components for reconstruction
//     currency0: t.hex().notNull(),
//     currency1: t.hex().notNull(),
//     fee: t.integer().notNull(),
//     tickSpacing: t.integer().notNull(),
//     hooks: t.hex().notNull(),

//     // Pool state
//     sqrtPriceX96: t.bigint().notNull(),
//     liquidity: t.bigint().notNull(),
//     tick: t.integer().notNull(),

//     // Token references
//     baseToken: t.hex().notNull(),
//     quoteToken: t.hex().notNull(),
//     asset: t.hex(), // Reference to asset if this is a Doppler token

//     // Migration tracking
//     migratedFromPool: t.hex(), // Original Doppler pool address
//     migratedAt: t.bigint().notNull(),
//     migratorVersion: t.text().notNull().default("v4"),

//     // Metrics
//     price: t.bigint().notNull(),
//     volumeUsd: t.bigint().notNull().default(0n),
//     dollarLiquidity: t.bigint().notNull().default(0n),
//     totalFee0: t.bigint().notNull().default(0n),
//     totalFee1: t.bigint().notNull().default(0n),
//     reserves0: t.bigint().notNull().default(0n),
//     reserves1: t.bigint().notNull().default(0n),

//     // Timestamps
//     createdAt: t.bigint().notNull(),
//     lastRefreshed: t.bigint(),
//     lastSwapTimestamp: t.bigint(),

//     // Price tracking
//     percentDayChange: t.doublePrecision().notNull().default(0),

//     // Relations
//     dailyVolume: t.hex(),

//     // Helper fields
//     isToken0: t.boolean().notNull(),
//     isQuoteEth: t.boolean().notNull(),
//   }),
//   (table) => ({
//     pk: primaryKey({
//       columns: [table.poolId, table.chainId],
//     }),
//     baseTokenIdx: index().on(table.baseToken),
//     quoteTokenIdx: index().on(table.quoteToken),
//     assetIdx: index().on(table.asset),
//     migratedFromPoolIdx: index().on(table.migratedFromPool),
//     lastRefreshedIdx: index().on(table.lastRefreshed),
//     lastSwapTimestampIdx: index().on(table.lastSwapTimestamp),
//   })
// );

export const userToken = onchainTable(
  "user_token",
  (t) => ({
    chainId: t.bigint().notNull(),
    userId: t.hex().notNull(),
    tokenId: t.hex().notNull(),
    balance: t.bigint().notNull(),
    createdAt: t.bigint().notNull(),
    lastInteraction: t.bigint().notNull(),
  }),
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.tokenId, table.chainId] }),
    userIdIdx: index().on(table.userId),
    tokenIdx: index().on(table.tokenId),
    chainIdIdx: index().on(table.chainId),
  })
);

export const swap = onchainTable("swap", (t) => ({
  txHash: t.hex().notNull().primaryKey(),
  pool: t.hex().notNull(),
  token: t.hex().notNull(),
  chainId: t.bigint().notNull(),
  amountIn: t.bigint().notNull(),
  amountOut: t.bigint().notNull(),
  type: t.text().notNull(), // buy or sell
  user: t.hex().notNull(),
  timestamp: t.bigint().notNull(),
  usdPrice: t.bigint().notNull(),
}), (table) => ({
  poolIdx: index().on(table.pool),
  tokenIdx: index().on(table.token),
  chainIdIdx: index().on(table.chainId),
  userIdx: index().on(table.user),
  timestampIdx: index().on(table.timestamp),
}));

// tokens have one pool
export const tokenRelations = relations(token, ({ one, many }) => ({
  pool: one(pool, { fields: [token.pool], references: [pool.address] }),
  userTokens: many(userToken),
}));

export const swapRelations = relations(swap, ({ one }) => ({
  pool: one(pool, { fields: [swap.pool], references: [pool.address] }),
  token: one(token, { fields: [swap.token], references: [token.address] }),
}));

// pools have many positions
export const poolRelations = relations(pool, ({ one, many }) => ({
  positions: many(position),
  swaps: many(swap),
  baseToken: one(token, {
    fields: [pool.baseToken],
    references: [token.address],
  }),
  quoteToken: one(token, {
    fields: [pool.quoteToken],
    references: [token.address],
  }),
  fifteenMinuteBucketUsds: many(fifteenMinuteBucketUsd),
  v4PoolConfig: one(v4PoolConfig, {
    fields: [pool.v4PoolConfig],
    references: [v4PoolConfig.hookAddress],
  }),
  migrationPool: one(migrationPool, {
    fields: [pool.migrationPool],
    references: [migrationPool.address],
  }),
}));

export const migrationPoolRelations = relations(migrationPool, ({ one }) => ({
  parentPool: one(pool, {
    fields: [migrationPool.parentPool],
    references: [pool.address],
  }),
}));

export const positionRelations = relations(position, ({ one }) => ({
  pool: one(pool, { fields: [position.pool], references: [pool.address] }),
}));

export const userRelations = relations(user, ({ many }) => ({
  userTokens: many(userToken),
}));

export const userTokenRelations = relations(userToken, ({ one }) => ({
  user: one(user, { fields: [userToken.userId], references: [user.address] }),
  token: one(token, {
    fields: [userToken.tokenId],
    references: [token.address],
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