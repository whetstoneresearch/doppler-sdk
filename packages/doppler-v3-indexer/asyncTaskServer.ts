import { Hono } from "hono";
import { Client } from "pg";

import { fetchTokenURI } from "./src/utils/fetchTokenURI";
import { fetchTokenUriData } from "./src/utils/fetchTokenUriData";

const app = new Hono();

const SCHEMA_NAME = "better-formatting";
const CONNECTION_STRING = process.env.DATABASE_URL || 
  `postgresql://writer-doppler-sdk-w26w:93ZboZh9YeLgNhOi8Iz9Gg@ep-rapid-mode-adk5gj7r.c-2.us-east-1.aws.neon.tech/doppler-sdk-w26w?channel_binding=require&sslmode=require`;

if (!CONNECTION_STRING) {
  throw new Error('DATABASE_URL is not set');
}

// Health check endpoint
app.get('/', async (c) => {
  const client = new Client({
    connectionString: CONNECTION_STRING,
  });

  try {
    await client.connect();
    const response = await client.query('SELECT version()');
    await client.end();
    
    const version = response.rows[0]?.version;
    if (!version) {
      return c.text('Database query returned no results', 500);
    }
    
    return c.json({ version });
  } catch (error) {
    await client.end();
    console.error('Database query failed:', error);
    return c.text('Failed to connect to database', 500);
  }
});

// Token metadata endpoint
app.get('/token-metadata', async (c) => {
  const tokenAddress = c.req.query('tokenAddress');
  const tokenId = c.req.query('tokenId');
  
  if (!tokenAddress) {
    return c.text('Missing tokenAddress parameter', 400);
  }

  const client = new Client({
    connectionString: CONNECTION_STRING,
  });

  try {
    await client.connect();
    
    // Parse tokenId, default to 0 for ERC721 or when not provided
    const parsedTokenId = tokenId ? Number(tokenId) : 0;
    
    const metadataUrl = await fetchTokenURI(tokenAddress, parsedTokenId);
    if (!metadataUrl) {
      await client.end();
      return c.text('Token URI not found', 404);
    }

    const tokenMetadata = await fetchTokenUriData(metadataUrl);
    if (!tokenMetadata) {
      await client.end();
      return c.text('Failed to fetch token metadata', 404);
    }

    // Update database with metadata
    await client.query(
      `UPDATE "${SCHEMA_NAME}".token SET token_uri_data = $1, tried_metadata = true WHERE address = $2 AND token_uri_data IS NULL`,
      [JSON.stringify(tokenMetadata), tokenAddress]
    );
    
    await client.end();

    return c.json(tokenMetadata);
  } catch (err: unknown) {
    await client.end();
    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
    console.error('Token metadata fetch failed:', errorMessage);
    return c.text(`Failed to process token metadata: ${errorMessage}`, 500);
  }
});

// Batch token metadata endpoint
app.post('/batch-token-metadata', async (c) => {
  try {
    const body = await c.req.json();
    const { tokens } = body;

    if (!Array.isArray(tokens) || tokens.length === 0) {
      return c.text('Invalid tokens array', 400);
    }

    const client = new Client({
      connectionString: CONNECTION_STRING,
    });

    await client.connect();
    
    const results = [];
    
    for (const token of tokens) {
      if (!token.address) {
        results.push({ 
          address: token.address, 
          error: 'Missing address' 
        });
        continue;
      }

      try {
        const tokenId = token.tokenId ? parseInt(token.tokenId, 10) : 0;
        const metadataUrl = await fetchTokenURI(token.address, tokenId);
        
        if (!metadataUrl) {
          results.push({ 
            address: token.address, 
            error: 'Token URI not found' 
          });
          continue;
        }

        const tokenMetadata = await fetchTokenUriData(metadataUrl);
        
        if (!tokenMetadata) {
          results.push({ 
            address: token.address, 
            error: 'Failed to fetch metadata' 
          });
          continue;
        }

        // Update database
        await client.query(
          `UPDATE "${SCHEMA_NAME}".token SET token_uri_data = $1, tried_metadata = true WHERE address = $2 AND token_uri_data IS NULL`,
          [JSON.stringify(tokenMetadata), token.address]
        );

        results.push({ 
          address: token.address, 
          metadata: tokenMetadata 
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({ 
          address: token.address, 
          error: errorMessage 
        });
      }
    }

    await client.end();
    return c.json({ results });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
    console.error('Batch token metadata processing failed:', errorMessage);
    return c.text(`Failed to process batch request: ${errorMessage}`, 500);
  }
});

export default app;
