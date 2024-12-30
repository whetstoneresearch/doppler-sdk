import { onchainEnum, onchainTable, relations } from "ponder";

export const migrationState = onchainEnum("migrationState", [
  "NOT_MIGRATED",
  "MIGRATED",
]);

export const assets = onchainTable("assets", (t) => ({
  id: t.hex().primaryKey(),
  numeraire: t.hex().notNull(),
  pool: t.hex().notNull(),
  timelock: t.hex().notNull(),
  governance: t.hex().notNull(),
  liquidityMigrator: t.hex().notNull(),
  migrationPool: t.hex().notNull(),
  poolInitializer: t.hex().notNull(),
  createdAt: t.timestamp().notNull(),
  migratedAt: t.timestamp(),
  v2Pool: t.hex().notNull(),
  migrationState: migrationState("migrationState").default("NOT_MIGRATED"),
}));

export const users = onchainTable("users", (t) => ({
  id: t.hex().primaryKey(),
  address: t.hex().notNull(),
  since: t.timestamp().notNull(),
}));

export const userAssets = onchainTable("userAssets", (t) => ({
  id: t.hex().primaryKey(),
  userId: t.hex().notNull(),
  assetId: t.hex().notNull(),
  interactedAt: t.timestamp().notNull(),
}));

export const usersRelations = relations(users, ({ many }) => ({
  userAssets: many(userAssets),
}));

export const assetsRelations = relations(assets, ({ many }) => ({
  userAssets: many(userAssets),
}));

export const userAssetsRelations = relations(userAssets, ({ one }) => ({
  user: one(users, {
    fields: [userAssets.userId],
    references: [users.id],
  }),
  asset: one(assets, {
    fields: [userAssets.assetId],
    references: [assets.id],
  }),
}));
