/**
 * CPMM program error codes
 *
 * These correspond to the CpmmError enum in the on-chain program.
 * Anchor errors start at 6000 (0x1770).
 */
export enum CpmmErrorCode {
  /** Unauthorized - caller lacks required authority */
  Unauthorized = 6000,
  /** Pool is currently locked (reentrancy protection) */
  PoolLocked = 6001,
  /** Invalid fee value (exceeds max or invalid range) */
  InvalidFee = 6002,
  /** Invalid fee split value (exceeds max or invalid range) */
  InvalidFeeSplit = 6003,
  /** Invalid swap direction (must be 0 or 1) */
  InvalidDirection = 6004,
  /** Insufficient liquidity for operation */
  InsufficientLiquidity = 6005,
  /** Output amount less than minimum (slippage exceeded) */
  SlippageExceeded = 6006,
  /** Math operation overflowed */
  MathOverflow = 6007,
  /** Mints not in canonical order */
  InvalidMintOrder = 6008,
  /** Cannot create pool with identical tokens */
  SameMintPair = 6009,
  /** Vault account invalid or mismatch */
  InvalidVault = 6010,
  /** Position account invalid or mismatch */
  InvalidPosition = 6011,
  /** Cannot close position with non-zero shares or fees */
  PositionNotEmpty = 6012,
  /** Invalid route configuration */
  InvalidRoute = 6013,
  /** Not supported in v0.1 */
  NotSupportedInV0_1 = 6014,
  /** Oracle not initialized for this pool */
  OracleNotInitialized = 6015,
  /** Zero shares out */
  ZeroSharesOut = 6016,
  /** Sentinel program rejected the operation */
  SentinelRejected = 6017,
  /** Sentinel CPI call failed */
  SentinelCpiFailed = 6018,
  /** Sentinel program account not provided */
  SentinelProgramNotProvided = 6019,
  /** Sentinel program account is not executable */
  SentinelProgramNotExecutable = 6020,
  /** Sentinel return data missing or wrong program id */
  SentinelReturnDataMissing = 6021,
  /** Sentinel return data invalid length or could not deserialize */
  SentinelReturnDataInvalid = 6022,
  /** Sentinel program not in allowlist */
  SentinelNotAllowlisted = 6023,
  /** Pool has zero shares (no liquidity) */
  TotalSharesZero = 6024,
  /** Amount cannot be zero */
  AmountZero = 6025,
  /** Pool is paused by admin */
  Paused = 6026,
  /** Internal invariant violation */
  InvariantViolation = 6027,
  /** Invalid mint address */
  InvalidMint = 6028,
  /** Invalid input parameter */
  InvalidInput = 6029,
  /** Reentrancy detected */
  Reentrancy = 6030,
}

/**
 * Human-readable error messages
 */
export const CPMM_ERROR_MESSAGES: Record<CpmmErrorCode, string> = {
  [CpmmErrorCode.Unauthorized]: 'Unauthorized: Caller lacks required authority',
  [CpmmErrorCode.PoolLocked]: 'Pool is currently locked (reentrancy protection)',
  [CpmmErrorCode.InvalidFee]: 'Invalid fee value (exceeds max or invalid range)',
  [CpmmErrorCode.InvalidFeeSplit]: 'Invalid fee split value (exceeds max or invalid range)',
  [CpmmErrorCode.InvalidDirection]: 'Invalid swap direction (must be 0 or 1)',
  [CpmmErrorCode.InsufficientLiquidity]: 'Insufficient liquidity for this operation',
  [CpmmErrorCode.SlippageExceeded]: 'Slippage exceeded: Output amount less than minimum',
  [CpmmErrorCode.MathOverflow]: 'Math operation overflowed',
  [CpmmErrorCode.InvalidMintOrder]: 'Token mints not in canonical order',
  [CpmmErrorCode.SameMintPair]: 'Cannot create pool with identical tokens',
  [CpmmErrorCode.InvalidVault]: 'Vault account is invalid or does not match',
  [CpmmErrorCode.InvalidPosition]: 'Position account is invalid or does not match',
  [CpmmErrorCode.PositionNotEmpty]: 'Cannot close position with non-zero shares or fees',
  [CpmmErrorCode.InvalidRoute]: 'Invalid route configuration',
  [CpmmErrorCode.NotSupportedInV0_1]: 'Not supported in v0.1',
  [CpmmErrorCode.OracleNotInitialized]: 'Oracle not initialized for this pool',
  [CpmmErrorCode.ZeroSharesOut]: 'Zero shares out',
  [CpmmErrorCode.SentinelRejected]: 'Sentinel program rejected the operation',
  [CpmmErrorCode.SentinelCpiFailed]: 'Sentinel CPI call failed',
  [CpmmErrorCode.SentinelProgramNotProvided]: 'Sentinel program account not provided',
  [CpmmErrorCode.SentinelProgramNotExecutable]: 'Sentinel program account is not executable',
  [CpmmErrorCode.SentinelReturnDataMissing]: 'Sentinel return data missing or wrong program id',
  [CpmmErrorCode.SentinelReturnDataInvalid]: 'Sentinel return data invalid length or could not deserialize',
  [CpmmErrorCode.SentinelNotAllowlisted]: 'Sentinel program not in allowlist',
  [CpmmErrorCode.TotalSharesZero]: 'Pool has zero shares (no liquidity)',
  [CpmmErrorCode.AmountZero]: 'Amount cannot be zero',
  [CpmmErrorCode.Paused]: 'Pool is paused by admin',
  [CpmmErrorCode.InvariantViolation]: 'Internal invariant violation',
  [CpmmErrorCode.InvalidMint]: 'Invalid mint address',
  [CpmmErrorCode.InvalidInput]: 'Invalid input parameter',
  [CpmmErrorCode.Reentrancy]: 'Reentrancy detected',
};

/**
 * Custom error class for CPMM program errors
 */
export class CpmmError extends Error {
  constructor(
    public readonly code: CpmmErrorCode,
    public readonly logs?: string[],
  ) {
    super(CPMM_ERROR_MESSAGES[code] || `Unknown CPMM error: ${code}`);
    this.name = 'CpmmError';
  }

  /**
   * Get the error code name
   */
  get codeName(): string {
    return CpmmErrorCode[this.code] || 'Unknown';
  }
}

/**
 * Parse error code from transaction logs
 */
export function parseErrorFromLogs(logs: string[]): CpmmError | null {
  // Look for Anchor error pattern: "Program log: AnchorError ..."
  // or custom error pattern: "Program log: Error Code: ..."
  for (const log of logs) {
    // Pattern 1: Anchor error with code
    const anchorMatch = log.match(/AnchorError.*Error Code:\s*(\w+)\.\s*Error Number:\s*(\d+)/);
    if (anchorMatch) {
      const errorNumber = parseInt(anchorMatch[2], 10);
      if (errorNumber >= 6000 && errorNumber <= 6030) {
        return new CpmmError(errorNumber as CpmmErrorCode, logs);
      }
    }

    // Pattern 2: Error number in hex
    const hexMatch = log.match(/Error Number:\s*0x([0-9a-fA-F]+)/);
    if (hexMatch) {
      const errorNumber = parseInt(hexMatch[1], 16);
      if (errorNumber >= 6000 && errorNumber <= 6030) {
        return new CpmmError(errorNumber as CpmmErrorCode, logs);
      }
    }

    // Pattern 3: Custom error message
    const customMatch = log.match(/Error Message:\s*(.+)/);
    if (customMatch) {
      const message = customMatch[1].toLowerCase();
      // Try to match message to error code
      for (const [code, msg] of Object.entries(CPMM_ERROR_MESSAGES)) {
        if (msg.toLowerCase().includes(message) || message.includes(msg.toLowerCase())) {
          return new CpmmError(parseInt(code) as CpmmErrorCode, logs);
        }
      }
    }
  }

  return null;
}

/**
 * Check if an error code is a CPMM error
 */
export function isCpmmError(code: number): code is CpmmErrorCode {
  return code >= 6000 && code <= 6030;
}

/**
 * Get error message from code
 */
export function getErrorMessage(code: number): string {
  if (isCpmmError(code)) {
    return CPMM_ERROR_MESSAGES[code];
  }
  return `Unknown error code: ${code}`;
}
