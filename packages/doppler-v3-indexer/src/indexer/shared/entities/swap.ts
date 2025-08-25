import { Context } from "ponder:registry";
import { swap } from "ponder.schema";
import { Address } from "viem";

export const insertSwapIfNotExists = async ({
    txHash,
    timestamp,
    context,
    pool,
    asset,
    chainId,
    type,
    user,
    amountIn,
    amountOut,
    usdPrice,
}: {
    txHash: Address;
    timestamp: bigint;
    context: Context;
    pool: Address;
    asset: Address;
    chainId: bigint;
    type: string;
    user: Address;
    amountIn: bigint;
    amountOut: bigint;
    usdPrice: bigint;
}): Promise<typeof swap.$inferSelect> => {
    const { db } = context;

    const existingSwap = await db.find(swap, {
        txHash,
    });

    if (existingSwap) {
        return existingSwap;
    }


    return await db.insert(swap).values({
        txHash,
        timestamp,
        pool,
        asset,
        chainId,
        type,
        user,
        amountIn,
        amountOut,
        usdPrice,
    });
};
