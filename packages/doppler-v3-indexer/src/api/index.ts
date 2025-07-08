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
} from "ponder";
import { db } from "ponder:api";
import schema, { asset, token } from "ponder:schema";

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

export default app;
