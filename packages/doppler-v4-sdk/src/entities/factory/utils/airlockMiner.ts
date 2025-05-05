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
import { encodeTokenFactoryData } from './factory';
import { TokenFactoryData, DopplerData } from '../types';

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
    minimumProceeds,
    maximumProceeds,
    startingTime,
    endingTime,
    startingTick,
    endingTick,
    epochLength,
    gamma,
    numPDSlugs,
    fee,
    tickSpacing,
  } = params.poolInitializerData;

  const poolInitializerData = encodeAbiParameters(
    [
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
      { type: 'uint24' },
      { type: 'int24' },
    ],
    [
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
      fee,
      tickSpacing,
    ]
  );

  const { poolManager, numTokensToSell, poolInitializer } = params;

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
      { type: 'uint24' },
    ],
    [
      poolManager,
      numTokensToSell,
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
      poolInitializer,
      fee,
    ]
  );

  const hookInitHash = keccak256(
    encodePacked(['bytes', 'bytes'], [DopplerBytecode as Hex, hookInitHashData])
  );

  const {
    name,
    symbol,
    yearlyMintRate,
    vestingDuration,
    recipients,
    amounts,
    tokenURI,
  } = params.tokenFactoryData;

  const tokenFactoryData = encodeTokenFactoryData(
    {
      name,
      symbol,
      tokenURI,
    },
    {
      amounts,
      recipients,
      vestingDuration,
      yearlyMintRate,
    }
  );

  const { airlock, initialSupply } = params;

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
      airlock,
      airlock,
      yearlyMintRate,
      vestingDuration,
      recipients,
      amounts,
      tokenURI,
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
      return [saltBytes, hook, token, poolInitializerData, tokenFactoryData];
    }
  }

  throw new Error('AirlockMiner: could not find salt');
}
