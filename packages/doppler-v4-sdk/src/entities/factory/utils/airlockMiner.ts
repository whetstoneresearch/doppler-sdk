import { DERC20Bytecode, DopplerBytecode } from '@/abis';
import {
  Address,
  encodeAbiParameters,
  encodePacked,
  getAddress,
  Hash,
  Hex,
  keccak256,
} from 'viem';

const FLAG_MASK = BigInt(0x3fff);

const flags = BigInt(
  (1 << 13) | // BEFORE_INITIALIZE_FLAG
    (1 << 12) | // AFTER_INITIALIZE_FLAG
    (1 << 11) | // BEFORE_ADD_LIQUIDITY_FLAG
    (1 << 7) | // BEFORE_SWAP_FLAG
    (1 << 6) | // AFTER_SWAP_FLAG
    (1 << 5) // BEFORE_DONATE_FLAG
);

export interface MineV4Params {
  airlock: Address;
  poolManager: Address;
  deployer: Address;
  initialSupply: bigint;
  numTokensToSell: bigint;
  numeraire: Address;
  tokenFactory: Address;
  tokenFactoryData: TokenFactoryData;
  poolInitializer: Address;
  poolInitializerData: DopplerData;
}

export interface DopplerData {
  initialPrice: bigint;
  minimumProceeds: bigint;
  maximumProceeds: bigint;
  startingTime: bigint;
  endingTime: bigint;
  startingTick: number;
  endingTick: number;
  epochLength: bigint;
  gamma: number;
  isToken0: boolean;
  numPDSlugs: bigint;
}

export interface TokenFactoryData {
  name: string;
  symbol: string;
  airlock: Address;
  initialSupply: bigint;
  yearlyMintCap: bigint;
  vestingDuration: bigint;
  recipients: Address[];
  amounts: bigint[];
}

function computeCreate2Address(
  salt: Hash,
  initCodeHash: Hash,
  deployer: Address
): Address {
  const encoded = encodePacked(
    ['bytes1', 'address', 'bytes32', 'bytes32'],
    ['0xff', deployer, salt, initCodeHash]
  );
  return getAddress(`0x${keccak256(encoded).slice(-40)}`);
}

export function mine(params: MineV4Params): [Hash, Address, Address, Hex, Hex] {
  const isToken0 =
    params.numeraire !== '0x0000000000000000000000000000000000000000';

  const {
    initialPrice,
    minimumProceeds,
    maximumProceeds,
    startingTime,
    endingTime,
    startingTick,
    endingTick,
    epochLength,
    gamma,
    numPDSlugs,
  } = params.poolInitializerData;

  const poolInitializerData = encodeAbiParameters(
    [
      { type: 'uint160' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'int24' },
      { type: 'int24' },
      { type: 'uint256' },
      { type: 'int24' },
      { type: 'bool' },
      { type: 'uint256' },
    ],

    [
      initialPrice,
      minimumProceeds,
      maximumProceeds,
      startingTime,
      endingTime,
      startingTick,
      endingTick,
      epochLength,
      gamma,
      isToken0,
      numPDSlugs,
    ]
  );

  const hookInitHashData = encodeAbiParameters(
    [
      { type: 'address' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'int24' },
      { type: 'int24' },
      { type: 'uint256' },
      { type: 'int24' },
      { type: 'bool' },
      { type: 'uint256' },
      { type: 'address' },
    ],
    [
      params.poolManager,
      params.numTokensToSell,
      minimumProceeds,
      maximumProceeds,
      startingTime,
      endingTime,
      startingTick,
      endingTick,
      epochLength,
      gamma,
      isToken0,
      numPDSlugs,
      params.poolInitializer,
    ]
  );

  const hookInitHash = keccak256(
    encodePacked(['bytes', 'bytes'], [DopplerBytecode as Hex, hookInitHashData])
  );

  const { name, symbol, yearlyMintCap, vestingDuration, recipients, amounts } =
    params.tokenFactoryData;

  const tokenFactoryData = encodeAbiParameters(
    [
      { type: 'string' },
      { type: 'string' },
      { type: 'uint256' },
      { type: 'uint256' },
      { type: 'address[]' },
      { type: 'uint256[]' },
    ],
    [name, symbol, yearlyMintCap, vestingDuration, recipients, amounts]
  );

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
    ],
    [
      name,
      symbol,
      params.initialSupply,
      params.airlock,
      params.airlock,
      yearlyMintCap,
      vestingDuration,
      recipients,
      amounts,
    ]
  );

  const tokenInitHash = keccak256(
    encodePacked(['bytes', 'bytes'], [DERC20Bytecode as Hex, initHashData])
  );

  for (let salt = BigInt(0); salt < BigInt(1_000_000); salt++) {
    const saltBytes = `0x${salt.toString(16).padStart(64, '0')}` as Hash;
    const hook = computeCreate2Address(
      saltBytes,
      hookInitHash,
      params.deployer
    );
    const token = computeCreate2Address(
      saltBytes,
      tokenInitHash,
      params.tokenFactory
    );

    const hookBigInt = BigInt(hook);
    const tokenBigInt = BigInt(token);
    const numeraireBigInt = BigInt(params.numeraire);

    if (
      (hookBigInt & FLAG_MASK) === flags &&
      ((isToken0 && tokenBigInt < numeraireBigInt) ||
        (!isToken0 && tokenBigInt > numeraireBigInt))
    ) {
      console.log('found salt', salt);
      console.log('hook', hook);
      console.log('token', token);
      return [saltBytes, hook, token, poolInitializerData, tokenFactoryData];
    }
  }

  throw new Error('AirlockMiner: could not find salt');
}
