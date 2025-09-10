import { Hono } from "hono";
import { client, graphql, replaceBigInts, sql } from "ponder";
import { db } from "ponder:api";
import schema from "ponder:schema";

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
      .map((id) => Number(id));

    // Normalize address queries to lowercase for case-insensitive matching
    const normalizedQuery =
      query.startsWith("0x") && query.length === 42
        ? query.toLowerCase()
        : query;

    if (!chainIds) return c.json([]);
    // First search tokens directly
    const tokenResults = await db.execute(sql`
      SELECT
       t.address,
       t.chain_id,
       t.symbol,
       t.name,
       p.market_cap_usd,
       ohlc.percent_day_change
      FROM token t
      LEFT JOIN pool p ON p.address = t.pool
      LEFT JOIN pool_day_agg_2 ohlc ohlc ON ohlc.pool = t.pool
      WHERE
        t.chain_id in (${chainIds.join(",")})
      AND 
        (t.name ILIKE ${`${normalizedQuery}%`} 
        OR t.address ILIKE ${`${normalizedQuery}%`} 
        OR t.symbol ILIKE ${`${normalizedQuery}%`})
      `);
    return c.json(replaceBigInts(tokenResults, (v) => String(v)));
  } catch (error) {
    console.error("Error in /search/:query", error);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

export default app;
