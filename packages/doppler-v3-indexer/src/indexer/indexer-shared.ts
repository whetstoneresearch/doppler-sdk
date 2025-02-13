import { Context, ponder } from "ponder:registry";
import { Address, zeroAddress } from "viem";
import { DERC20ABI } from "../abis";
import {
  CHAINLINK_ETH_DECIMALS,
  secondsInDay,
  secondsInHour,
  WAD,
} from "@app/utils/constants";
import {
  token,
  hourBucket,
  asset,
  userAsset,
  user,
  ethPrice,
  dailyVolume,
} from "ponder.schema";
import { getAssetData } from "@app/utils/getAssetData";
import { addresses } from "@app/types/addresses";
import { ChainlinkOracleABI } from "@app/abis/ChainlinkOracleABI";
import { and, gte, lt } from "drizzle-orm";
import { PoolState } from "@app/utils/v3-utils/getV3PoolData";

interface Checkpoint {
  timestamp: string;
  volumeUsd: string;
  volumeNumeraire: string;
}

export const computeDollarLiquidity = async ({
  token0Balance,
  token1Balance,
  poolState,
  token0,
  price,
  timestamp,
  context,
}: {
  token0Balance: bigint;
  token1Balance: bigint;
  poolState: PoolState;
  token0: Address;
  price: bigint;
  timestamp: bigint;
  context: Context;
}) => {
  const ethPrice = await fetchEthPrice(timestamp, context);

  let assetLiquidity;
  let numeraireLiquidity;
  if (ethPrice?.price) {
    const assetBalance =
      poolState.asset === token0 ? token0Balance : token1Balance;
    assetLiquidity =
      (((assetBalance * price) / WAD) * ethPrice.price) /
      CHAINLINK_ETH_DECIMALS;

    const numeraireBalance =
      poolState.numeraire === token0 ? token0Balance : token1Balance;
    numeraireLiquidity =
      (numeraireBalance * ethPrice.price) / CHAINLINK_ETH_DECIMALS;
  } else {
    assetLiquidity = 0n;
    numeraireLiquidity = 0n;
  }

  return assetLiquidity + numeraireLiquidity;
};

export const fetchEthPrice = async (timestamp: bigint, context: Context) => {
  const { db } = context;
  const price = await db.sql.query.ethPrice.findFirst({
    where: and(
      gte(ethPrice.timestamp, timestamp - 5n * 60n),
      lt(ethPrice.timestamp, timestamp)
    ),
  });

  return price;
};

export const insertOrUpdateHourBucket = async ({
  poolAddress,
  price,
  timestamp,
  context,
}: {
  poolAddress: Address;
  price: bigint;
  timestamp: bigint;
  context: Context;
}) => {
  const { db, network } = context;
  const hourId = Math.floor(Number(timestamp) / secondsInHour) * secondsInHour;

  try {
    await db
      .insert(hourBucket)
      .values({
        hourId,
        pool: poolAddress,
        open: price,
        close: price,
        low: price,
        high: price,
        average: price,
        count: 1,
        chainId: BigInt(network.chainId),
      })
      .onConflictDoUpdate((row) => ({
        close: price,
        low: row.low < price ? row.low : price,
        high: row.high > price ? row.high : price,
        average:
          (row.average * BigInt(row.count) + price) / BigInt(row.count + 1),
        count: row.count + 1,
      }));
  } catch (e) {
    console.error("error inserting hour bucket", e);
  }
};

export const insertOrUpdateHourBucketUsd = async ({
  poolAddress,
  price,
  timestamp,
  context,
}: {
  poolAddress: Address;
  price: bigint;
  timestamp: bigint;
  context: Context;
}) => {
  const { db, network } = context;
  const hourId = Math.floor(Number(timestamp) / secondsInHour) * secondsInHour;

  const ethPrice = await fetchEthPrice(timestamp, context);

  if (!ethPrice) {
    console.error("No price found for timestamp", timestamp);
    return;
  }

  const usdPrice = (price * ethPrice.price) / CHAINLINK_ETH_DECIMALS;

  try {
    await db
      .insert(hourBucket)
      .values({
        hourId,
        pool: poolAddress,
        open: usdPrice,
        close: usdPrice,
        low: usdPrice,
        high: usdPrice,
        average: usdPrice,
        count: 1,
        chainId: BigInt(network.chainId),
      })
      .onConflictDoUpdate((row) => ({
        close: usdPrice,
        low: row.low < usdPrice ? row.low : usdPrice,
        high: row.high > usdPrice ? row.high : usdPrice,
        average:
          (row.average * BigInt(row.count) + usdPrice) / BigInt(row.count + 1),
        count: row.count + 1,
      }));
  } catch (e) {
    console.error("error inserting hour bucket", e);
  }
};

export const insertOrUpdateDailyVolume = async ({
  tokenIn,
  poolAddress,
  amountIn,
  amountOut,
  timestamp,
  context,
}: {
  tokenIn: Address;
  poolAddress: Address;
  amountIn: bigint;
  amountOut: bigint;
  timestamp: bigint;
  context: Context;
}) => {
  const { db, network } = context;

  const price = await fetchEthPrice(timestamp, context);

  if (!price) {
    console.error("No price found for timestamp", timestamp);
    return;
  }

  let volumeUsd;
  let volumeNumeraire;
  if (tokenIn === addresses.shared.weth) {
    volumeUsd = (amountIn * price.price) / CHAINLINK_ETH_DECIMALS;
    volumeNumeraire = amountIn;
  } else {
    volumeUsd = (amountOut * price.price) / CHAINLINK_ETH_DECIMALS;
    volumeNumeraire = amountOut;
  }

  return await db
    .insert(dailyVolume)
    .values({
      pool: poolAddress,
      volumeUsd: volumeUsd,
      volumeNumeraire: volumeNumeraire,
      chainId: BigInt(network.chainId),
      lastUpdated: timestamp,
      checkpoints: [
        {
          timestamp: timestamp.toString(),
          volumeUsd: volumeUsd.toString(),
          volumeNumeraire: volumeNumeraire.toString(),
        },
      ],
    })
    .onConflictDoUpdate((row) => {
      const checkpoints: Checkpoint[] = [
        ...(row.checkpoints as Checkpoint[]),
        {
          timestamp: timestamp.toString(),
          volumeUsd: volumeUsd.toString(),
          volumeNumeraire: volumeNumeraire.toString(),
        },
      ];
      const updatedCheckpoints = checkpoints.filter(
        (checkpoint) =>
          BigInt(checkpoint.timestamp) >= timestamp - BigInt(secondsInDay)
      );
      const totalVolumeUsd = updatedCheckpoints.reduce(
        (acc, checkpoint) => acc + BigInt(checkpoint.volumeUsd),
        BigInt(0)
      );
      const totalVolumeNumeraire = updatedCheckpoints.reduce(
        (acc, checkpoint) => acc + BigInt(checkpoint.volumeNumeraire),
        BigInt(0)
      );
      return {
        volumeUsd: totalVolumeUsd,
        volumeNumeraire: totalVolumeNumeraire,
        checkpoints: updatedCheckpoints,
        lastUpdated: timestamp,
      };
    });
};

export const insertTokenIfNotExists = async ({
  address,
  timestamp,
  context,
  isDerc20 = false,
  poolAddress,
}: {
  address: Address;
  timestamp: bigint;
  context: Context;
  isDerc20?: boolean;
  poolAddress?: Address;
}) => {
  const { db, network } = context;
  const existingToken = await db.find(token, {
    address,
  });

  if (existingToken) return existingToken;

  const chainId = BigInt(network.chainId);

  // ignore pool field for native tokens
  if (address === zeroAddress) {
    return await db.insert(token).values({
      address,
      chainId,
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
      firstSeenAt: timestamp,
      lastSeenAt: timestamp,
      totalSupply: 0n,
      isDerc20: false,
    });
  } else {
    const [
      nameResult,
      symbolResult,
      decimalsResult,
      totalSupplyResult,
      tokenURIResult,
    ] = await context.client.multicall({
      contracts: [
        {
          abi: DERC20ABI,
          address,
          functionName: "name",
        },
        {
          abi: DERC20ABI,
          address,
          functionName: "symbol",
        },
        {
          abi: DERC20ABI,
          address,
          functionName: "decimals",
        },
        {
          abi: DERC20ABI,
          address,
          functionName: "totalSupply",
        },
        {
          abi: DERC20ABI,
          address,
          functionName: "tokenURI",
        },
      ],
    });

    const tokenURI = tokenURIResult?.result;
    let image: string | undefined;
    if (tokenURI?.startsWith("ipfs://")) {
      try {
        const cid = tokenURI.replace("ipfs://", "");
        // TODO: Use a better IPFS gateway
        const response = await fetch(`https://ipfs.io/ipfs/${cid}`);
        const data = await response.json();

        if (
          data &&
          typeof data === "object" &&
          "image" in data &&
          typeof data.image === "string"
        ) {
          if (data.image.startsWith("ipfs://")) {
            image = data.image;
          }
        }
      } catch (error) {
        console.error(
          `Failed to fetch IPFS metadata for token ${address}:`,
          error
        );
      }
    }

    return await context.db
      .insert(token)
      .values({
        address,
        chainId,
        name: nameResult?.result ?? `Unknown Token (${address})`,
        symbol: symbolResult?.result ?? "???",
        decimals: decimalsResult.result ?? 18,
        totalSupply: totalSupplyResult.result ?? 0n,
        firstSeenAt: timestamp,
        lastSeenAt: timestamp,
        isDerc20,
        image,
        pool: isDerc20 ? poolAddress : undefined,
        derc20Data: isDerc20 ? address : undefined,
      })
      .onConflictDoNothing();
  }
};

ponder.on("Airlock:Migrate", async ({ event, context }) => {
  const { db, network } = context;
  const { asset: assetId } = event.args;

  const assetData = await getAssetData(assetId, context);

  if (!assetData) {
    console.error("Airlock:Migrate - Asset data not found");
    return;
  }

  await db
    .insert(asset)
    .values({
      ...assetData,
      address: assetId,
      chainId: BigInt(network.chainId),
      createdAt: event.block.timestamp,
      migratedAt: event.block.timestamp,
      migrated: true,
    })
    .onConflictDoUpdate((row) => ({
      migratedAt: event.block.timestamp,
      migrated: true,
    }));
});

ponder.on("DERC20:Transfer", async ({ event, context }) => {
  const { db, network } = context;
  const { address } = event.log;
  const { from, to, value } = event.args;

  await db
    .insert(user)
    .values({
      address: to,
      createdAt: event.block.timestamp,
      lastSeenAt: event.block.timestamp,
    })
    .onConflictDoUpdate((row) => ({
      lastSeenAt: event.block.timestamp,
    }));

  await db
    .insert(user)
    .values({
      address: from,
      createdAt: event.block.timestamp,
      lastSeenAt: event.block.timestamp,
    })
    .onConflictDoUpdate((row) => ({
      lastSeenAt: event.block.timestamp,
    }));

  await db
    .insert(userAsset)
    .values({
      userId: to,
      assetId: address,
      chainId: BigInt(network.chainId),
      balance: value,
      createdAt: event.block.timestamp,
      lastInteraction: event.block.timestamp,
    })
    .onConflictDoUpdate((row) => ({
      balance: row.balance + value,
      lastInteraction: event.block.timestamp,
    }));

  await db
    .insert(userAsset)
    .values({
      userId: from,
      assetId: address,
      chainId: BigInt(network.chainId),
      balance: -value,
      createdAt: event.block.timestamp,
      lastInteraction: event.block.timestamp,
    })
    .onConflictDoUpdate((row) => ({
      balance: row.balance - value,
      lastInteraction: event.block.timestamp,
    }));
});

ponder.on("ChainlinkEthPriceFeed:block", async ({ event, context }) => {
  const { db, client } = context;
  const { timestamp } = event.block;

  const latestAnswer = await client.readContract({
    abi: ChainlinkOracleABI,
    address: addresses.oracle.chainlinkEth,
    functionName: "latestAnswer",
  });

  const price = latestAnswer;

  await db
    .insert(ethPrice)
    .values({
      timestamp: timestamp,
      price: price,
    })
    .onConflictDoNothing();
});
