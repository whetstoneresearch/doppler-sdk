import { onchainTable, primaryKey, relations } from "ponder";

export const asset = onchainTable("asset", (t) => ({
  id: t.text().primaryKey(),
  numeraire: t.text().notNull(),
  timelock: t.text().notNull(),
  governance: t.text().notNull(),
  liquidityMigrator: t.text().notNull(),
  poolInitializer: t.text().notNull(),
  pool: t.text().notNull(),
  migrationPool: t.text().notNull(),
  numTokensToSell: t.bigint().notNull(),
  totalSupply: t.bigint().notNull(),
  integrator: t.text().notNull(),
  createdAt: t.bigint().notNull(),
  migratedAt: t.bigint(),
}));

export const v3Pool = onchainTable("v3_pool", (t) => ({
  id: t.text().primaryKey(),
  tick: t.integer().notNull(),
  sqrtPrice: t.bigint().notNull(),
  liquidity: t.bigint().notNull(),
  createdAt: t.bigint().notNull(),
}));

// assets have one pool
export const assetRelations = relations(asset, ({ one, many }) => ({
  pool: one(v3Pool, { fields: [asset.pool], references: [v3Pool.id] }),
  userAssets: many(userAsset),
}));

export const position = onchainTable("position", (t) => ({
  id: t.text().primaryKey(),
  owner: t.text().notNull(),
  pool: t.text().notNull(),
  tickLower: t.integer().notNull(),
  tickUpper: t.integer().notNull(),
  liquidity: t.bigint().notNull(),
  createdAt: t.bigint().notNull(),
}));

// pools have many positions
export const poolRelations = relations(v3Pool, ({ many }) => ({
  positions: many(position),
}));

// positions have one pool
export const positionRelations = relations(position, ({ one }) => ({
  pool: one(v3Pool, { fields: [position.pool], references: [v3Pool.id] }),
}));

export const module = onchainTable("module", (t) => ({
  id: t.text().primaryKey(),
  state: t.integer().notNull(),
  lastUpdated: t.bigint().notNull(),
}));

export const user = onchainTable("user", (t) => ({
  id: t.text().primaryKey(),
  address: t.text().notNull(),
  createdAt: t.bigint().notNull(),
}));

// users have many assets and positions
export const userRelations = relations(user, ({ many }) => ({
  userAssets: many(userAsset),
}));

export const userAsset = onchainTable(
  "user_asset",
  (t) => ({
    userId: t.text().notNull(),
    assetId: t.text().notNull(),
  }),
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.assetId] }),
  })
);

export const userAssetRelations = relations(userAsset, ({ one }) => ({
  user: one(user, { fields: [userAsset.userId], references: [user.id] }),
  asset: one(asset, { fields: [userAsset.assetId], references: [asset.id] }),
}));
