import { index, onchainTable, primaryKey, relations } from "ponder";

/* TABLES */
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
    isDerc20: t.boolean().notNull(),
    image: t.text(),
    firstSeenAt: t.bigint().notNull(),
    lastSeenAt: t.bigint().notNull(),
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
}));

export const asset = onchainTable(
  "asset",
  (t) => ({
    address: t.hex().primaryKey(),
    pool: t.hex().notNull(),
    chainId: t.bigint().notNull(),
    numeraire: t.hex().notNull(),
    timelock: t.hex().notNull(),
    governance: t.hex().notNull(),
    liquidityMigrator: t.hex().notNull(),
    poolInitializer: t.hex().notNull(),
    migrationPool: t.hex().notNull(),
    numTokensToSell: t.bigint().notNull(),
    integrator: t.hex().notNull(),
    createdAt: t.bigint().notNull(),
    migratedAt: t.bigint(),
  }),
  (table) => ({
    addressIdx: index().on(table.address),
    chainIdIdx: index().on(table.chainId),
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
    chainId: t.bigint().notNull(),
  }),
  (table) => ({
    pk: primaryKey({
      columns: [table.pool, table.hourId, table.chainId],
    }),
  })
);

export const dailyVolume = onchainTable("daily_volume", (t) => ({
  pool: t.hex().notNull().primaryKey(),
  volume: t.bigint().notNull(),
  chainId: t.bigint().notNull(),
  checkpoints: t.jsonb().notNull(),
  lastUpdated: t.bigint().notNull(),
}));

export const position = onchainTable(
  "position",
  (t) => ({
    owner: t.text().notNull(),
    pool: t.hex().notNull(),
    tickLower: t.integer().notNull(),
    tickUpper: t.integer().notNull(),
    liquidity: t.bigint().notNull(),
    createdAt: t.bigint().notNull(),
    chainId: t.bigint().notNull(),
  }),
  (table) => ({
    pk: primaryKey({
      columns: [
        table.owner,
        table.pool,
        table.tickLower,
        table.tickUpper,
        table.chainId,
      ],
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

export const pool = onchainTable(
  "pool",
  (t) => ({
    address: t.hex().notNull(),
    chainId: t.bigint().notNull(),
    tick: t.integer().notNull(),
    sqrtPrice: t.bigint().notNull(),
    liquidity: t.bigint().notNull(),
    createdAt: t.bigint().notNull(),
    asset: t.hex().notNull(),
    baseToken: t.hex().notNull(),
    quoteToken: t.hex().notNull(),
    price: t.bigint().notNull(),
    fee: t.integer().notNull(),
    type: t.text().notNull(),
    dollarLiquidity: t.bigint().notNull(),
    dailyVolume: t.hex().notNull(),
  }),
  (table) => ({
    pk: primaryKey({
      columns: [
        table.address,
        table.chainId,
        table.baseToken,
        table.quoteToken,
      ],
    }),
    baseTokenIdx: index().on(table.baseToken),
    quoteTokenIdx: index().on(table.quoteToken),
  })
);

export const userAsset = onchainTable(
  "user_asset",
  (t) => ({
    chainId: t.bigint().notNull(),
    userId: t.text().notNull(),
    assetId: t.text().notNull(),
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

/* RELATIONS */

// assets have one pool
export const assetRelations = relations(asset, ({ one, many }) => ({
  pool: one(pool, { fields: [asset.pool], references: [pool.address] }),
  userAssets: many(userAsset),
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
  dailyVolume: one(dailyVolume, {
    fields: [pool.address],
    references: [dailyVolume.pool],
  }),
}));

// positions have one pool
export const positionRelations = relations(position, ({ one }) => ({
  pool: one(pool, { fields: [position.pool], references: [pool.address] }),
}));

// tokens have one pool
export const tokenRelations = relations(token, ({ one }) => ({
  pool: one(pool, { fields: [token.pool], references: [pool.address] }),
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
