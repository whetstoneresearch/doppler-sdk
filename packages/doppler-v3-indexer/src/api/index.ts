import { Hono } from "hono";
import {
  and,
  client,
  desc,
  eq,
  graphql,
  ilike,
  inArray,
  like,
  or,
  replaceBigInts,
  gte,
  lt,
} from "ponder";
import { db } from "ponder:api";
import schema, { asset, token, volumeBucket24h, pool } from "ponder:schema";
import { getDayBucketTimestamp, DAY_IN_SECONDS } from "@app/utils/time-buckets";

const app = new Hono();

app.use("/graphql", graphql({ db, schema }));
app.use("/", graphql({ db, schema }));
app.use("/sql/*", client({ db, schema }));

app.get("/search/:query", async (c) => {
  try {
    const query = c.req.param("query");

    const chainIds = c.req
      .query("chain_ids")
      ?.split(",")
      .map((id) => BigInt(id));

    // Normalize address queries to lowercase for case-insensitive matching
    const normalizedQuery = query.startsWith("0x") && query.length === 42 
      ? query.toLowerCase() 
      : query;

    // First search tokens directly
    const tokenResults = await db
      .select()
      .from(token)
      .where(
        or(
          and(
            inArray(token.chainId, chainIds || []),
            or(
              ilike(token.name, `%${query}%`),
              ilike(token.symbol, `%${query}%`)
            )
          ),
          and(
            inArray(token.chainId, chainIds || []),
            like(token.address, normalizedQuery)
          ),
          and(
            inArray(token.chainId, chainIds || []),
            like(token.pool, normalizedQuery)
          )
        )
      )
      .orderBy(desc(token.holderCount))
      .limit(15);

    // If searching by address, also search for tokens by governance address
    if (query.startsWith("0x") && query.length === 42) {
      const assetResults = await db
        .select()
        .from(asset)
        .where(
          and(
            inArray(asset.chainId, chainIds || []),
            eq(asset.governance, normalizedQuery as `0x${string}`)
          )
        );

      // Get tokens associated with these assets
      if (assetResults.length > 0) {
        const assetAddresses = assetResults.map(a => a.address);
        const governanceTokens = await db
          .select()
          .from(token)
          .where(
            and(
              inArray(token.chainId, chainIds || []),
              inArray(token.derc20Data, assetAddresses)
            )
          )
          .orderBy(desc(token.holderCount))
          .limit(15);

        // Combine and deduplicate results
        const combinedResults = [...tokenResults];
        for (const govToken of governanceTokens) {
          if (!combinedResults.find(t => t.address === govToken.address)) {
            combinedResults.push(govToken);
          }
        }
        
        return c.json(replaceBigInts(combinedResults.slice(0, 15), (v) => String(v)));
      }
    }

    return c.json(replaceBigInts(tokenResults, (v) => String(v)));
  } catch (error) {
    console.error("Error in /search/:query", error);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

/**
 * Get top tokens by 24h volume for a specific chain
 */
app.get("/analytics/top-volume/:chainId", async (c) => {
  try {
    const chainId = BigInt(c.req.param("chainId"));
    const limit = parseInt(c.req.query("limit") || "100");
    const currentTimestamp = BigInt(Date.now() / 1000);
    const currentDayTimestamp = getDayBucketTimestamp(currentTimestamp);
    
    // Get today's volume buckets
    const buckets = await db
      .select({
        poolAddress: volumeBucket24h.poolAddress,
        assetAddress: volumeBucket24h.assetAddress,
        volumeUsd: volumeBucket24h.volumeUsd,
        txCount: volumeBucket24h.txCount,
        marketCapUsd: volumeBucket24h.marketCapUsd,
        high: volumeBucket24h.high,
        low: volumeBucket24h.low,
        close: volumeBucket24h.close,
      })
      .from(volumeBucket24h)
      .where(
        and(
          eq(volumeBucket24h.chainId, chainId),
          eq(volumeBucket24h.timestamp, currentDayTimestamp)
        )
      )
      .orderBy(desc(volumeBucket24h.volumeUsd))
      .limit(limit);

    // Join with token data for names and symbols
    const results = await Promise.all(
      buckets.map(async (bucket) => {
        const tokenData = await db
          .select()
          .from(token)
          .where(eq(token.address, bucket.assetAddress))
          .limit(1);

        return {
          ...bucket,
          token: tokenData[0] || null,
        };
      })
    );

    return c.json(replaceBigInts(results, (v) => String(v)));
  } catch (error) {
    console.error("Error in /analytics/top-volume", error);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

/**
 * Get historical volume data for a specific pool
 */
app.get("/analytics/pool-history/:poolAddress", async (c) => {
  try {
    const poolAddress = c.req.param("poolAddress").toLowerCase() as `0x${string}`;
    const chainId = BigInt(c.req.query("chainId") || "1");
    const days = parseInt(c.req.query("days") || "30");
    const currentTimestamp = BigInt(Date.now() / 1000);
    const startTimestamp = currentTimestamp - (BigInt(days) * DAY_IN_SECONDS);
    
    const history = await db
      .select()
      .from(volumeBucket24h)
      .where(
        and(
          eq(volumeBucket24h.poolAddress, poolAddress),
          eq(volumeBucket24h.chainId, chainId),
          gte(volumeBucket24h.timestamp, startTimestamp)
        )
      )
      .orderBy(desc(volumeBucket24h.timestamp));

    return c.json(replaceBigInts(history, (v) => String(v)));
  } catch (error) {
    console.error("Error in /analytics/pool-history", error);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

/**
 * Get market overview stats for a chain
 */
app.get("/analytics/market-overview/:chainId", async (c) => {
  try {
    const chainId = BigInt(c.req.param("chainId"));
    const currentTimestamp = BigInt(Date.now() / 1000);
    const currentDayTimestamp = getDayBucketTimestamp(currentTimestamp);
    const previousDayTimestamp = currentDayTimestamp - DAY_IN_SECONDS;
    
    // Get aggregated stats for current day
    const currentDayStats = await db
      .select({
        totalVolumeUsd: db.sum(volumeBucket24h.volumeUsd),
        totalTxCount: db.sum(volumeBucket24h.txCount),
        uniquePools: db.count(volumeBucket24h.poolAddress),
      })
      .from(volumeBucket24h)
      .where(
        and(
          eq(volumeBucket24h.chainId, chainId),
          eq(volumeBucket24h.timestamp, currentDayTimestamp)
        )
      );

    // Get aggregated stats for previous day
    const previousDayStats = await db
      .select({
        totalVolumeUsd: db.sum(volumeBucket24h.volumeUsd),
      })
      .from(volumeBucket24h)
      .where(
        and(
          eq(volumeBucket24h.chainId, chainId),
          eq(volumeBucket24h.timestamp, previousDayTimestamp)
        )
      );

    const currentVolume = BigInt(currentDayStats[0]?.totalVolumeUsd || "0");
    const previousVolume = BigInt(previousDayStats[0]?.totalVolumeUsd || "0");
    
    let volumeChange = 0;
    if (previousVolume > 0n) {
      volumeChange = Number(((currentVolume - previousVolume) * 100n) / previousVolume);
    }

    return c.json(replaceBigInts({
      totalVolumeUsd: String(currentVolume),
      totalTransactions: currentDayStats[0]?.totalTxCount || 0,
      activePools: currentDayStats[0]?.uniquePools || 0,
      volumeChange24h: volumeChange,
      timestamp: String(currentDayTimestamp),
    }, (v) => String(v)));
  } catch (error) {
    console.error("Error in /analytics/market-overview", error);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

/**
 * Get top gainers/losers by market cap change
 */
app.get("/analytics/top-movers/:chainId", async (c) => {
  try {
    const chainId = BigInt(c.req.param("chainId"));
    const limit = parseInt(c.req.query("limit") || "20");
    const type = c.req.query("type") || "gainers"; // "gainers" or "losers"
    const currentTimestamp = BigInt(Date.now() / 1000);
    const currentDayTimestamp = getDayBucketTimestamp(currentTimestamp);
    const previousDayTimestamp = currentDayTimestamp - DAY_IN_SECONDS;
    
    // Get current and previous day buckets
    const currentBuckets = await db
      .select()
      .from(volumeBucket24h)
      .where(
        and(
          eq(volumeBucket24h.chainId, chainId),
          eq(volumeBucket24h.timestamp, currentDayTimestamp)
        )
      );

    const previousBuckets = await db
      .select()
      .from(volumeBucket24h)
      .where(
        and(
          eq(volumeBucket24h.chainId, chainId),
          eq(volumeBucket24h.timestamp, previousDayTimestamp)
        )
      );

    // Create a map of previous day data
    const previousMap = new Map(
      previousBuckets.map(b => [b.poolAddress, b])
    );

    // Calculate price changes
    const movers = currentBuckets
      .map(current => {
        const previous = previousMap.get(current.poolAddress);
        if (!previous || previous.marketCapUsd === 0n) return null;
        
        const change = Number(
          ((current.marketCapUsd - previous.marketCapUsd) * 100n) / previous.marketCapUsd
        );
        
        return {
          poolAddress: current.poolAddress,
          assetAddress: current.assetAddress,
          currentMarketCap: String(current.marketCapUsd),
          previousMarketCap: String(previous.marketCapUsd),
          changePercent: change,
          volumeUsd: String(current.volumeUsd),
          price: String(current.close),
        };
      })
      .filter(m => m !== null)
      .sort((a, b) => type === "gainers" 
        ? (b!.changePercent - a!.changePercent)
        : (a!.changePercent - b!.changePercent)
      )
      .slice(0, limit);

    // Join with token data
    const results = await Promise.all(
      movers.map(async (mover) => {
        const tokenData = await db
          .select()
          .from(token)
          .where(eq(token.address, mover!.assetAddress))
          .limit(1);

        return {
          ...mover,
          token: tokenData[0] || null,
        };
      })
    );

    return c.json(results);
  } catch (error) {
    console.error("Error in /analytics/top-movers", error);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

export default app;
