import { ponder } from "ponder:registry";
import { ChainlinkOracleABI } from "@app/abis/ChainlinkOracleABI";
import { ethPrice, zoraUsdcPrice } from "ponder.schema";
import { UniswapV3PoolABI } from "@app/abis/v3-abis/UniswapV3PoolABI";
import { computeV3Price } from "@app/utils/v3-utils";
import { chainConfigs } from "@app/config";

ponder.on("BaseChainlinkEthPriceFeed:block", async ({ event, context }) => {
  const { db, client, chain } = context;
  const { timestamp } = event.block;

  const latestAnswer = await client.readContract({
    abi: ChainlinkOracleABI,
    address: chainConfigs["base"].addresses.shared.chainlinkEthOracle,
    functionName: "latestAnswer",
  });

  const price = latestAnswer;

  const roundedTimestamp = BigInt(Math.floor(Number(timestamp) / 300) * 300);
  const adjustedTimestamp = roundedTimestamp + 300n;

  await db
    .insert(ethPrice)
    .values({
      timestamp: adjustedTimestamp,
      chainId: chain.id,
      price,
    })
    .onConflictDoNothing();
});

ponder.on("UnichainChainlinkEthPriceFeed:block", async ({ event, context }) => {
  const { db, client, chain } = context;
  const { timestamp } = event.block;

  const latestAnswer = await client.readContract({
    abi: ChainlinkOracleABI,
    address: chainConfigs["unichain"].addresses.shared.chainlinkEthOracle,
    functionName: "latestAnswer",
  });

  const price = latestAnswer;

  const roundedTimestamp = BigInt(Math.floor(Number(timestamp) / 300) * 300);
  const adjustedTimestamp = roundedTimestamp + 300n;

  await db
    .insert(ethPrice)
    .values({
      timestamp: adjustedTimestamp,
      chainId: chain.id,
      price,
    })
    .onConflictDoNothing();
});

ponder.on("InkChainlinkEthPriceFeed:block", async ({ event, context }) => {
  const { db, client, chain } = context;
  const { timestamp } = event.block;

  const latestAnswer = await client.readContract({
    abi: ChainlinkOracleABI,
    address: chainConfigs["ink"].addresses.shared.chainlinkEthOracle,
    functionName: "latestAnswer",
  });

  const price = latestAnswer;

  const roundedTimestamp = BigInt(Math.floor(Number(timestamp) / 300) * 300);
  const adjustedTimestamp = roundedTimestamp + 300n;

  await db
    .insert(ethPrice)
    .values({
      timestamp: adjustedTimestamp,
      price,
      chainId: chain.id,
    })
    .onConflictDoNothing();
});

ponder.on("ZoraUsdcPrice:block", async ({ event, context }) => {
  const { db, client, chain } = context;
  const { timestamp } = event.block;

  const slot0 = await client.readContract({
    abi: UniswapV3PoolABI,
    address: chainConfigs[chain.name].addresses.zora.zoraTokenPool,
    functionName: "slot0",
  });

  const sqrtPriceX96 = slot0[0] as bigint;

  const price = computeV3Price({
    sqrtPriceX96,
    isToken0: true,
    decimals: 18,
    quoteDecimals: 6,
  });

  const roundedTimestamp = BigInt(Math.floor(Number(timestamp) / 300) * 300);
  const adjustedTimestamp = roundedTimestamp + 300n;

  await db
    .insert(zoraUsdcPrice)
    .values({
      timestamp: adjustedTimestamp,
      price,
      chainId: chain.id,
    })
    .onConflictDoNothing();
});

ponder.on(
  "BaseSepoliaChainlinkEthPriceFeed:block",
  async ({ event, context }) => {
    const { db, client, chain } = context;
    const { timestamp } = event.block;

    const latestAnswer = await client.readContract({
      abi: ChainlinkOracleABI,
      address: chainConfigs["baseSepolia"].addresses.shared.chainlinkEthOracle,
      functionName: "latestAnswer",
    });

    const price = latestAnswer;

    const roundedTimestamp = BigInt(Math.floor(Number(timestamp) / 300) * 300);
    const adjustedTimestamp = roundedTimestamp + 300n;

    await db
      .insert(ethPrice)
      .values({
        timestamp: adjustedTimestamp,
        chainId: chain.id,
        price,
      })
      .onConflictDoNothing();
  }
);
