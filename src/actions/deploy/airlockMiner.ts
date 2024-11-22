import {
  Address,
  Hash,
  keccak256,
  encodeAbiParameters,
  encodePacked,
  getAddress,
  Hex,
} from 'viem';
import { DopplerBytecode } from '../../abis/DopplerABI';
import { DERC20Bytecode } from '../../abis/DERC20ABI';

const FLAG_MASK = BigInt(0x3fff);

const flags = BigInt(
  (1 << 13) | // BEFORE_INITIALIZE_FLAG
  (1 << 12) | // AFTER_INITIALIZE_FLAG
  (1 << 11) | // BEFORE_ADD_LIQUIDITY_FLAG
  (1 << 7) | // BEFORE_SWAP_FLAG
  (1 << 6) // AFTER_SWAP_FLAG
);

/**
 * Parameters for the mine function.
 */
export interface MineParams {
  poolManager: Address;
  numTokensToSell: bigint;
  minTick: number;
  maxTick: number;
  airlock: Address;
  name: string;
  symbol: string;
  initialSupply: bigint;
  numeraire: Address;
  startingTime: bigint;
  endingTime: bigint;
  minimumProceeds: bigint;
  maximumProceeds: bigint;
  epochLength: bigint;
  gamma: number;
  numPDSlugs: bigint;
}

/**
 * Computes the CREATE2 address for a contract deployment.
 * @param salt The salt value.
 * @param initCodeHash The hash of the contract's initialization code.
 * @param deployer The address of the deployer.
 * @returns The computed CREATE2 address.
 */
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

/**
 * Mines a new contract by finding a suitable salt value.
 * @param tokenFactory The address of the token factory.
 * @param hookFactory The address of the hook factory.
 * @param params The parameters for the mine function.
 * @returns A tuple containing the salt, hook address, and token address.
 */
export function mine(
  tokenFactory: Address,
  hookFactory: Address,
  params: MineParams
): [Hash, Address, Address] {
  const isToken0 =
    params.numeraire !== '0x0000000000000000000000000000000000000000';

  const hookInitHash = keccak256(
    encodePacked(
      ['bytes', 'bytes'],
      [
        DopplerBytecode as Hex,
        encodeAbiParameters(
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
            params.minimumProceeds,
            params.maximumProceeds,
            params.startingTime,
            params.endingTime,
            params.minTick,
            params.maxTick,
            params.epochLength,
            params.gamma,
            isToken0,
            params.numPDSlugs,
            params.airlock,
          ]
        ),
      ]
    )
  );

  const tokenInitHash = keccak256(
    encodePacked(
      ['bytes', 'bytes'],
      [
        DERC20Bytecode.object as Hex,
        encodeAbiParameters(
          [
            { type: 'string' },
            { type: 'string' },
            { type: 'uint256' },
            { type: 'address' },
            { type: 'address' },
          ],
          [
            params.name,
            params.symbol,
            params.initialSupply,
            params.airlock,
            params.airlock,
          ]
        ),
      ]
    )
  );
  for (let salt = BigInt(0); salt < BigInt(1_000_000); salt++) {
    const saltBytes = `0x${salt.toString(16).padStart(64, '0')}` as Hash;
    const hook = computeCreate2Address(saltBytes, hookInitHash, hookFactory);
    const token = computeCreate2Address(saltBytes, tokenInitHash, tokenFactory);

    const hookBigInt = BigInt(hook);
    const tokenBigInt = BigInt(token);
    const numeraireBigInt = BigInt(params.numeraire);

    if (
      (hookBigInt & FLAG_MASK) === flags &&
      ((isToken0 && tokenBigInt < numeraireBigInt) ||
        (!isToken0 && tokenBigInt > numeraireBigInt))
    ) {
      return [saltBytes, hook, token];
    }
  }

  throw new Error('AirlockMiner: could not find salt');
}
