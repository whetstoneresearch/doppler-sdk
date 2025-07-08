import { Address } from "viem";

/**
 * Base error class for indexer-specific errors
 */
export class IndexerError extends Error {
  constructor(message: string, public readonly context?: Record<string, unknown>) {
    super(message);
    this.name = "IndexerError";
  }
}

/**
 * Error thrown when pool data cannot be fetched
 */
export class PoolDataError extends IndexerError {
  constructor(
    message: string,
    public readonly poolAddress: Address,
    context?: Record<string, unknown>
  ) {
    super(message, { poolAddress, ...context });
    this.name = "PoolDataError";
  }
}

/**
 * Error thrown when asset data cannot be fetched
 */
export class AssetDataError extends IndexerError {
  constructor(
    message: string,
    public readonly assetAddress: Address,
    context?: Record<string, unknown>
  ) {
    super(message, { assetAddress, ...context });
    this.name = "AssetDataError";
  }
}

/**
 * Error thrown when price calculation fails
 */
export class PriceCalculationError extends IndexerError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, context);
    this.name = "PriceCalculationError";
  }
}

/**
 * Wraps an async function with standardized error handling
 * Logs errors and optionally rethrows them
 */
export const withErrorHandling = <T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options?: {
    rethrow?: boolean;
    fallbackValue?: ReturnType<T>;
    errorMessage?: string;
  }
): T => {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      const errorMessage = options?.errorMessage || `Error in ${fn.name || "function"}`;
      
      console.error(errorMessage, {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        args,
      });

      if (options?.rethrow) {
        throw error;
      }

      if (options?.fallbackValue !== undefined) {
        return options.fallbackValue;
      }

      // If it's an IndexerError, preserve it
      if (error instanceof IndexerError) {
        throw error;
      }

      // Otherwise wrap it
      throw new IndexerError(errorMessage, {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  }) as T;
};

/**
 * Safe wrapper for pool data fetching operations
 */
export const safeGetPoolData = withErrorHandling(
  async (fetchFn: () => Promise<any>, poolAddress: Address) => {
    const data = await fetchFn();
    if (!data) {
      throw new PoolDataError("Failed to fetch pool data", poolAddress);
    }
    return data;
  },
  { rethrow: false }
);

/**
 * Validates that a value is not null or undefined
 */
export const assertDefined = <T>(
  value: T | null | undefined,
  errorMessage: string
): T => {
  if (value === null || value === undefined) {
    throw new IndexerError(errorMessage);
  }
  return value;
};