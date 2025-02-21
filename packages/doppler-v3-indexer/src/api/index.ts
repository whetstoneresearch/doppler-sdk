import { Hono } from "hono";
import { client, graphql, ilike, or } from "ponder";
import { db } from "ponder:api";
import schema, { token } from "ponder:schema";
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
    );

  return c.json(replaceBigInts(results, (v) => String(v)));
});

export default app;
