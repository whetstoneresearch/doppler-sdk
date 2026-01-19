import {
  type Address,
  type Hash,
  type Hex,
  encodeAbiParameters,
  encodePacked,
  keccak256,
  getAddress,
  decodeAbiParameters,
} from 'viem';
import { DERC20Bytecode, DopplerDN404Bytecode } from '../abis';

const DEFAULT_MAX_ITERATIONS = 1_000_000;

export type TokenVariant = 'standard' | 'doppler404';

export interface TokenAddressHookConfig {
  deployer: Address;
  initCodeHash: Hash;
  prefix?: string;
}

export interface TokenAddressMiningParams {
  prefix: string;
  tokenFactory: Address;
  initialSupply: bigint;
  recipient: Address;
  owner: Address;
  tokenData: Hex;
  tokenVariant?: TokenVariant;
  customBytecode?: Hex;
  maxIterations?: number;
  startSalt?: bigint;
  hook?: TokenAddressHookConfig;
}

export interface TokenAddressMiningResult {
  salt: Hash;
  tokenAddress: Address;
  iterations: number;
  hookAddress?: Address;
}

const STANDARD_TOKEN_DATA_ABI = [
  { type: 'string' },
  { type: 'string' },
  { type: 'uint256' },
  { type: 'uint256' },
  { type: 'address[]' },
  { type: 'uint256[]' },
  { type: 'string' },
] as const;

const DOPPLER404_TOKEN_DATA_ABI = [
  { type: 'string' },
  { type: 'string' },
  { type: 'string' },
  { type: 'uint256' },
] as const;

function normalizePrefix(prefix: string): string {
  const normalized = prefix.trim().toLowerCase().replace(/^0x/, '');
  if (normalized.length === 0) {
    throw new Error(
      'TokenAddressMiner: prefix must contain at least one hex character',
    );
  }
  if (normalized.length > 40) {
    throw new Error(
      'TokenAddressMiner: prefix cannot exceed 40 hex characters',
    );
  }
  if (!/^[0-9a-f]+$/i.test(normalized)) {
    throw new Error('TokenAddressMiner: prefix must be a hexadecimal string');
  }
  return normalized;
}

/**
 * Helper to convert hex string to Uint8Array
 */
function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * Helper to convert Uint8Array to hex string
 */
function bytesToHex(bytes: Uint8Array): string {
  return (
    '0x' +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  );
}

/**
 * Pre-compute CREATE2 buffer with constant prefix for fast mining
 * Buffer layout: 0xff (1 byte) + deployer (20 bytes) + salt (32 bytes) + initCodeHash (32 bytes) = 85 bytes
 */
function prepareCreate2Buffer(deployer: Address, initCodeHash: Hash): Uint8Array {
  const buffer = new Uint8Array(85);
  buffer[0] = 0xff;
  const deployerBytes = hexToBytes(deployer);
  buffer.set(deployerBytes, 1);
  const initCodeHashBytes = hexToBytes(initCodeHash);
  buffer.set(initCodeHashBytes, 53); // 1 + 20 + 32 = 53
  return buffer;
}

/**
 * Update salt in pre-computed CREATE2 buffer (bytes 21-52)
 * Uses direct byte manipulation instead of string conversion
 */
function updateSaltInBuffer(buffer: Uint8Array, salt: bigint): void {
  // Salt is 32 bytes, positioned at offset 21 (after 0xff + 20-byte deployer)
  // Clear salt region first
  for (let i = 21; i < 53; i++) {
    buffer[i] = 0;
  }
  // Write salt bytes from right to left (big-endian)
  let remaining = salt;
  for (let i = 52; remaining > 0n && i >= 21; i--) {
    buffer[i] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
}

/**
 * Compute CREATE2 address from pre-computed buffer (fast version for mining)
 * Returns raw lowercase address without checksum for comparison
 */
function computeCreate2AddressFast(buffer: Uint8Array): string {
  const hash = keccak256(bytesToHex(buffer) as Hex);
  // Return last 40 hex chars (20 bytes) as lowercase address
  return '0x' + hash.slice(-40).toLowerCase();
}

function buildTokenInitHash(params: {
  variant: TokenVariant;
  tokenData: Hex;
  initialSupply: bigint;
  recipient: Address;
  owner: Address;
  customBytecode?: Hex;
}): Hash {
  const {
    variant,
    tokenData,
    initialSupply,
    recipient,
    owner,
    customBytecode,
  } = params;

  if (variant === 'doppler404') {
    const [name, symbol, baseURI] = decodeAbiParameters(
      DOPPLER404_TOKEN_DATA_ABI,
      tokenData,
    ) as readonly [string, string, string, bigint | undefined];

    const initHashData = encodeAbiParameters(
      [
        { type: 'string' },
        { type: 'string' },
        { type: 'uint256' },
        { type: 'address' },
        { type: 'address' },
        { type: 'string' },
      ],
      [name, symbol, initialSupply, recipient, owner, baseURI],
    );

    return keccak256(
      encodePacked(
        ['bytes', 'bytes'],
        [customBytecode ?? (DopplerDN404Bytecode as Hex), initHashData],
      ),
    ) as Hash;
  }

  const [
    name,
    symbol,
    yearlyMintRate,
    vestingDuration,
    vestingRecipients,
    vestingAmounts,
    tokenURI,
  ] = decodeAbiParameters(STANDARD_TOKEN_DATA_ABI, tokenData) as readonly [
    string,
    string,
    bigint,
    bigint,
    readonly Address[],
    readonly bigint[],
    string,
  ];

  const initHashData = encodeAbiParameters(
    [
      { type: 'string' },
      { type: 'string' },
      { type: 'uint256' },
      { type: 'address' },
      { type: 'address' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'address[]' },
      { type: 'uint256[]' },
      { type: 'string' },
    ],
    [
      name,
      symbol,
      initialSupply,
      recipient,
      owner,
      yearlyMintRate,
      vestingDuration,
      Array.from(vestingRecipients),
      Array.from(vestingAmounts),
      tokenURI,
    ],
  );

  return keccak256(
    encodePacked(
      ['bytes', 'bytes'],
      [customBytecode ?? (DERC20Bytecode as Hex), initHashData],
    ),
  ) as Hash;
}

export function mineTokenAddress(
  params: TokenAddressMiningParams,
): TokenAddressMiningResult {
  const {
    prefix,
    tokenFactory,
    initialSupply,
    recipient,
    owner,
    tokenData,
    tokenVariant = 'standard',
    customBytecode,
    maxIterations = DEFAULT_MAX_ITERATIONS,
    startSalt = 0n,
    hook,
  } = params;

  if (maxIterations <= 0 || !Number.isFinite(maxIterations)) {
    throw new Error(
      'TokenAddressMiner: maxIterations must be a positive finite number',
    );
  }
  if (startSalt < 0n) {
    throw new Error('TokenAddressMiner: startSalt cannot be negative');
  }

  const normalizedPrefix = normalizePrefix(prefix);
  const tokenInitHash = buildTokenInitHash({
    variant: tokenVariant,
    tokenData,
    initialSupply,
    recipient,
    owner,
    customBytecode,
  });

  const hookConfig = hook
    ? {
        deployer: hook.deployer,
        initCodeHash: hook.initCodeHash,
        prefix: hook.prefix ? normalizePrefix(hook.prefix) : undefined,
      }
    : undefined;

  const maxSalt = startSalt + BigInt(maxIterations);
  let iterations = 0;

  // Pre-allocate CREATE2 buffer with constant parts (optimization)
  const tokenBuffer = prepareCreate2Buffer(tokenFactory, tokenInitHash);
  const hookBuffer = hookConfig
    ? prepareCreate2Buffer(hookConfig.deployer, hookConfig.initCodeHash)
    : null;

  for (let salt = startSalt; salt < maxSalt; salt++) {
    // Update salt in pre-computed buffer (avoids string formatting)
    updateSaltInBuffer(tokenBuffer, salt);

    // Compute token address using fast method (no checksum)
    const candidateRaw = computeCreate2AddressFast(tokenBuffer);
    iterations++;

    if (candidateRaw.slice(2).startsWith(normalizedPrefix)) {
      let hookAddressRaw: string | undefined;
      if (hookBuffer) {
        updateSaltInBuffer(hookBuffer, salt);
        hookAddressRaw = computeCreate2AddressFast(hookBuffer);
        if (
          hookConfig?.prefix &&
          !hookAddressRaw.slice(2).startsWith(hookConfig.prefix)
        ) {
          continue;
        }
      }

      // Found a match! Convert to proper format for return
      const saltHex = `0x${salt.toString(16).padStart(64, '0')}` as Hash;
      return {
        salt: saltHex,
        tokenAddress: getAddress(candidateRaw) as Address,
        iterations,
        hookAddress: hookAddressRaw
          ? (getAddress(hookAddressRaw) as Address)
          : undefined,
      };
    }
  }

  throw new Error(
    `TokenAddressMiner: could not find salt matching prefix ${prefix} within ${maxIterations} iterations`,
  );
}
