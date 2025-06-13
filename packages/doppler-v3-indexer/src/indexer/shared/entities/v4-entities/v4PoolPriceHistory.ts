import { Context } from "ponder:registry";
import { v4PoolPriceHistory } from "ponder:schema";
import { Address, formatEther } from "viem";
import { updatePool } from "../pool";

export const insertV4PoolPriceHistoryIfNotExists = async ({
  pool,
  context,
}: {
  pool: Address;
  context: Context;
}) => {
  const { db, chain } = context;

  const existingConfig = await db.find(v4PoolPriceHistory, {
    pool,
  });

  if (existingConfig) {
    return existingConfig;
  }

  return await db.insert(v4PoolPriceHistory).values({
    pool,
    chainId: BigInt(chain.id),
    history: {},
  });
};

export const addAndUpdateV4PoolPriceHistory = async ({
  pool,
  context,
  timestamp,
  marketCapUsd,
}: {
  pool: Address;
  timestamp: number;
  marketCapUsd: bigint;
  context: Context;
}) => {
  const { db } = context;

  const existingHistory = await db.find(v4PoolPriceHistory, {
    pool,
  });

  if (!existingHistory) {
    await insertV4PoolPriceHistoryIfNotExists({ pool, context });
  }

  const history = existingHistory?.history ?? {};

  const marketCapString = marketCapUsd.toString();

  const oneDayAgo = timestamp - 24 * 60 * 60;
  const filteredHistory = Object.fromEntries(
    Object.entries(history).filter(([key]) => Number(key) >= oneDayAgo)
  );

  // find the earliest timestamp in the history and return the marketCap
  const earliestTimestamp = Math.min(
    ...Object.keys(filteredHistory).map(Number)
  );

  const earliestMarketCap = filteredHistory[earliestTimestamp];

  // compute the 24hour price change using marketCap and earliestTimestamp

  const dayChangeUsd =
    !earliestMarketCap || earliestMarketCap === 0n
      ? 0
      : ((Number(formatEther(BigInt(marketCapUsd))) -
        Number(formatEther(BigInt(earliestMarketCap)))) /
        Number(formatEther(BigInt(earliestMarketCap)))) *
      100;

  if (dayChangeUsd > 1000000000) {
    return;
  }

  await Promise.all([
    updateV4PoolPriceHistory({
      pool,
      context,
      update: {
        history: { ...filteredHistory, [timestamp]: marketCapString },
      },
    }),
    updatePool({
      poolAddress: pool,
      context,
      update: {
        percentDayChange: dayChangeUsd,
      },
    }),
  ]);
};

export const updateV4PoolPriceHistory = async ({
  pool,
  context,
  update,
}: {
  pool: Address;
  context: Context;
  update?: Partial<typeof v4PoolPriceHistory.$inferInsert>;
}) => {
  const { db } = context;

  await db
    .update(v4PoolPriceHistory, {
      pool,
    })
    .set({
      ...update,
    });
};
