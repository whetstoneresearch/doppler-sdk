// Block intervals as named constants
export const BLOCK_INTERVALS = {
  FIVE_MINUTES: (60 * 5) / 12, // every 5 minutes
  FIFTY_BLOCKS: 50,             // every 50 blocks  
  THOUSAND_BLOCKS: 1000,        // every 1000 blocks
} as const;

// Time-based intervals
export const TIME_INTERVALS = {
  SECONDS_PER_BLOCK: 12,        // average Ethereum block time
  MINUTES_TO_BLOCKS: (minutes: number) => (minutes * 60) / 12,
  HOURS_TO_BLOCKS: (hours: number) => (hours * 60 * 60) / 12,
} as const;