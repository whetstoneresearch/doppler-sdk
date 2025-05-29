import { Hono } from "hono";
import {
  and,
  client,
  desc,
  graphql,
  ilike,
  inArray,
  like,
  or,
  replaceBigInts,
} from "ponder";
import { db } from "ponder:api";
import schema, { token } from "ponder:schema";

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

    const results = await db
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
            like(token.address, query)
          )
        )
      )
      .orderBy(desc(token.holderCount))
      .limit(15);

    return c.json(replaceBigInts(results, (v) => String(v)));
  } catch (error) {
    console.error("Error in /search/:query");
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

export default app;
