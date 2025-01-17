import { DERC20Bytecode, DopplerBytecode } from '@/abis';
import { encodeAbiParameters, encodePacked, getAddress, keccak256, } from 'viem';
const FLAG_MASK = BigInt(0x3fff);
const flags = BigInt((1 << 13) | // BEFORE_INITIALIZE_FLAG
    (1 << 12) | // AFTER_INITIALIZE_FLAG
    (1 << 11) | // BEFORE_ADD_LIQUIDITY_FLAG
    (1 << 7) | // BEFORE_SWAP_FLAG
    (1 << 6) // AFTER_SWAP_FLAG
);
function computeCreate2Address(salt, initCodeHash, deployer) {
    const encoded = encodePacked(['bytes1', 'address', 'bytes32', 'bytes32'], ['0xff', deployer, salt, initCodeHash]);
    return getAddress(`0x${keccak256(encoded).slice(-40)}`);
}
export function mine(tokenFactory, hookFactory, params) {
    const isToken0 = params.numeraire !== '0x0000000000000000000000000000000000000000';
    const hookInitHash = keccak256(encodePacked(['bytes', 'bytes'], [
        DopplerBytecode,
        encodeAbiParameters([
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
        ], [
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
        ]),
    ]));
    const tokenInitHash = keccak256(encodePacked(['bytes', 'bytes'], [
        DERC20Bytecode,
        encodeAbiParameters([
            { type: 'string' },
            { type: 'string' },
            { type: 'uint256' },
            { type: 'address' },
            { type: 'address' },
        ], [
            params.name,
            params.symbol,
            params.initialSupply,
            params.airlock,
            params.airlock,
        ]),
    ]));
    for (let salt = BigInt(0); salt < BigInt(1000000); salt++) {
        const saltBytes = `0x${salt.toString(16).padStart(64, '0')}`;
        const hook = computeCreate2Address(saltBytes, hookInitHash, hookFactory);
        const token = computeCreate2Address(saltBytes, tokenInitHash, tokenFactory);
        const hookBigInt = BigInt(hook);
        const tokenBigInt = BigInt(token);
        const numeraireBigInt = BigInt(params.numeraire);
        if ((hookBigInt & FLAG_MASK) === flags &&
            ((isToken0 && tokenBigInt < numeraireBigInt) ||
                (!isToken0 && tokenBigInt > numeraireBigInt))) {
            return [saltBytes, hook, token];
        }
    }
    throw new Error('AirlockMiner: could not find salt');
}
//# sourceMappingURL=airlockMiner.js.map