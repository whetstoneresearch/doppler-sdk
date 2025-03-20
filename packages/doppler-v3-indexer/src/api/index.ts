import { Hono } from "hono";
import { client, desc, graphql, gte, ilike, or } from "ponder";
import { db } from "ponder:api";
import schema, { pool, token } from "ponder:schema";
import { replaceBigInts } from "ponder";

const app = new Hono();

app.use("/graphql", graphql({ db, schema }));
app.use("/", graphql({ db, schema }));
app.use("/sql/*", client({ db, schema }));

app.get("/search/:query", async (c) => {
  const query = c.req.param("query");
  const results = await db
    .select()
    .from(token)
    .where(
      or(
        ilike(token.name, `%${query}%`),
        ilike(token.symbol, `%${query}%`),
        ilike(token.address, `%${query}%`)
      )
    )
    .orderBy(desc(token.holderCount))
    .limit(15);

  return c.json(replaceBigInts(results, (v) => String(v)));
});

app.get("/migrateable-pools", async (c) => {
  const pools = await db
    .select()
    .from(pool)
    .where(gte(pool.graduationBalance, pool.graduationThreshold));
  return c.json(replaceBigInts(pools, (v) => String(v)));
});

export default app;
