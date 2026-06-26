import { describe, expect, it } from 'vitest';
import {
  type Address,
  type Hash,
  type Hex,
  encodeAbiParameters,
  encodePacked,
  keccak256,
  getAddress,
} from 'viem';
import { mineTokenAddress } from '../../../src/evm/utils/tokenAddressMiner';
import { DopplerDN404Bytecode } from '../../../src/evm/abis';

const TOKEN_FACTORY = '0x0000000000000000000000000000000000000fac' as Address;
const RECIPIENT = '0x000000000000000000000000000000000000beef' as Address;
const OWNER = '0x000000000000000000000000000000000000c0de' as Address;
const HOOK_DEPLOYER = '0x000000000000000000000000000000000000dEaD' as Address;

const DOPPLER_ERC20_V1_TOKEN_ABI = [
  { type: 'string' },
  { type: 'string' },
  {
    type: 'tuple[]',
    components: [
      { type: 'uint64', name: 'cliff' },
      { type: 'uint64', name: 'duration' },
    ],
  },
  { type: 'address[]' },
  { type: 'uint256[]' },
  { type: 'uint256[]' },
  { type: 'string' },
  { type: 'uint256' },
  { type: 'uint48' },
  { type: 'address' },
  { type: 'address[]' },
] as const;

const DOPPLER404_TOKEN_ABI = [
  { type: 'string' },
  { type: 'string' },
  { type: 'string' },
  { type: 'uint256' },
] as const;

const DOPPLER_ERC20_V1_IMPLEMENTATION =
  '0xDB7B520bb5C3a2C5d4871198081911359f93be87' as Address;

function buildDopplerErc20V1TokenData(
  name = 'Vanity Token V1',
  symbol = 'VNY1',
): Hex {
  return encodeAbiParameters(DOPPLER_ERC20_V1_TOKEN_ABI, [
    name,
    symbol,
    [{ cliff: 90n, duration: 180n }],
    [RECIPIENT],
    [0n],
    [100n],
    'ipfs://token-v1',
    10_000n,
    1_800,
    OWNER,
    [RECIPIENT],
  ]);
}

function computeCreate2Address(
  salt: Hash,
  initCodeHash: Hash,
  deployer: Address,
): Address {
  const encoded = encodePacked(
    ['bytes1', 'address', 'bytes32', 'bytes32'],
    ['0xff', deployer, salt, initCodeHash],
  );
  return getAddress(`0x${keccak256(encoded).slice(-40)}`);
}

function computeSoladyCloneInitCodeHash(implementation: Address): Hash {
  return keccak256(
    `0x602c3d8160093d39f33d3d3d3d363d3d37363d73${implementation.slice(
      2,
    )}5af43d3d93803e602a57fd5bf3`,
  ) as Hash;
}

describe('mineTokenAddress', () => {
  it('mines a matching prefix for standard tokens', () => {
    const initialSupply = 1_000_000n;
    const tokenData = buildDopplerErc20V1TokenData();

    const result = mineTokenAddress({
      prefix: '0',
      tokenFactory: TOKEN_FACTORY,
      initialSupply,
      recipient: RECIPIENT,
      owner: OWNER,
      tokenData,
      v2Implementation: DOPPLER_ERC20_V1_IMPLEMENTATION,
    });

    expect(result.tokenAddress.slice(2).toLowerCase().startsWith('0')).toBe(
      true,
    );
    expect(result.iterations).toBeGreaterThan(0);

    const initHash = computeSoladyCloneInitCodeHash(
      DOPPLER_ERC20_V1_IMPLEMENTATION,
    );
    const manualAddress = computeCreate2Address(
      result.salt,
      initHash,
      TOKEN_FACTORY,
    );
    expect(manualAddress).toBe(result.tokenAddress);
  });

  it('mines a matching suffix for standard tokens', () => {
    const initialSupply = 1_000_000n;
    const tokenData = buildDopplerErc20V1TokenData();

    const result = mineTokenAddress({
      prefix: '',
      suffix: '0',
      tokenFactory: TOKEN_FACTORY,
      initialSupply,
      recipient: RECIPIENT,
      owner: OWNER,
      tokenData,
      v2Implementation: DOPPLER_ERC20_V1_IMPLEMENTATION,
      maxIterations: 100_000,
    });

    expect(result.tokenAddress.slice(2).toLowerCase().endsWith('0')).toBe(true);
    expect(result.iterations).toBeGreaterThan(0);
  });

  it('mines dopplerERC20V1 token addresses using the clone init code hash', () => {
    const initialSupply = 1_000_000n;
    const tokenData = buildDopplerErc20V1TokenData();

    const result = mineTokenAddress({
      prefix: '0',
      tokenFactory: TOKEN_FACTORY,
      initialSupply,
      recipient: RECIPIENT,
      owner: OWNER,
      tokenData,
      tokenVariant: 'dopplerERC20V1',
      v2Implementation: DOPPLER_ERC20_V1_IMPLEMENTATION,
    });

    expect(result.tokenAddress.slice(2).toLowerCase().startsWith('0')).toBe(
      true,
    );

    const initHash = computeSoladyCloneInitCodeHash(
      DOPPLER_ERC20_V1_IMPLEMENTATION,
    );
    const manualAddress = computeCreate2Address(
      result.salt,
      initHash,
      TOKEN_FACTORY,
    );
    expect(manualAddress).toBe(result.tokenAddress);
  });

  it('throws when dopplerERC20V1 mining is attempted without an implementation address', () => {
    const tokenData = encodeAbiParameters(DOPPLER_ERC20_V1_TOKEN_ABI, [
      'Vanity Token V1',
      'VNY1',
      [{ cliff: 90n, duration: 180n }],
      [RECIPIENT],
      [0n],
      [100n],
      'ipfs://token-v1',
      10_000n,
      1_800,
      OWNER,
      [RECIPIENT],
    ]);

    expect(() =>
      mineTokenAddress({
        prefix: '0',
        tokenFactory: TOKEN_FACTORY,
        initialSupply: 1_000_000n,
        recipient: RECIPIENT,
        owner: OWNER,
        tokenData,
        tokenVariant: 'dopplerERC20V1',
      }),
    ).toThrow(
      'TokenAddressMiner: v2Implementation is required for dopplerERC20V1 tokens',
    );
  });

  it('mines a matching prefix and suffix together', () => {
    const initialSupply = 1_000_000n;
    const tokenData = buildDopplerErc20V1TokenData();

    const result = mineTokenAddress({
      prefix: '0',
      suffix: '0',
      tokenFactory: TOKEN_FACTORY,
      initialSupply,
      recipient: RECIPIENT,
      owner: OWNER,
      tokenData,
      v2Implementation: DOPPLER_ERC20_V1_IMPLEMENTATION,
      maxIterations: 500_000,
    });

    const addr = result.tokenAddress.slice(2).toLowerCase();
    expect(addr.startsWith('0')).toBe(true);
    expect(addr.endsWith('0')).toBe(true);
  });

  it('mines doppler404 token addresses', () => {
    const initialSupply = 42_000n;
    const tokenData = encodeAbiParameters(DOPPLER404_TOKEN_ABI, [
      'Vanity404',
      'VNY404',
      'ipfs://metadata',
      1000n,
    ]);

    const result = mineTokenAddress({
      prefix: '1',
      tokenFactory: TOKEN_FACTORY,
      initialSupply,
      recipient: RECIPIENT,
      owner: OWNER,
      tokenData,
      tokenVariant: 'doppler404',
    });

    expect(result.tokenAddress.slice(2).toLowerCase().startsWith('1')).toBe(
      true,
    );

    const initHashData = encodeAbiParameters(
      [
        { type: 'string' },
        { type: 'string' },
        { type: 'uint256' },
        { type: 'address' },
        { type: 'address' },
        { type: 'string' },
      ],
      [
        'Vanity404',
        'VNY404',
        initialSupply,
        RECIPIENT,
        OWNER,
        'ipfs://metadata',
      ],
    );
    const initHash = keccak256(
      encodePacked(
        ['bytes', 'bytes'],
        [DopplerDN404Bytecode as Hex, initHashData],
      ),
    ) as Hash;
    const manualAddress = computeCreate2Address(
      result.salt,
      initHash,
      TOKEN_FACTORY,
    );
    expect(manualAddress).toBe(result.tokenAddress);
  });

  it('returns hook address when hook configuration is provided', () => {
    const initialSupply = 250_000n;
    const tokenData = buildDopplerErc20V1TokenData('Hook Vanity', 'HVNY');

    const hookInitHash = keccak256(
      encodePacked(['bytes'], ['0xfeedface']),
    ) as Hash;

    const result = mineTokenAddress({
      prefix: '12',
      tokenFactory: TOKEN_FACTORY,
      initialSupply,
      recipient: RECIPIENT,
      owner: OWNER,
      tokenData,
      v2Implementation: DOPPLER_ERC20_V1_IMPLEMENTATION,
      hook: {
        deployer: HOOK_DEPLOYER,
        initCodeHash: hookInitHash,
        prefix: 'a',
      },
      maxIterations: 500_000,
    });

    expect(result.hookAddress).toBeDefined();
    expect(result.hookAddress!.slice(2).toLowerCase().startsWith('a')).toBe(
      true,
    );

    const recomputedHook = getAddress(
      `0x${keccak256(
        encodePacked(
          ['bytes1', 'address', 'bytes32', 'bytes32'],
          ['0xff', HOOK_DEPLOYER, result.salt, hookInitHash],
        ),
      ).slice(-40)}`,
    );

    expect(recomputedHook).toBe(result.hookAddress);
  });

  it('throws when prefix cannot be mined within iteration limit', () => {
    const initialSupply = 1_000_000n;
    const tokenData = buildDopplerErc20V1TokenData();

    const initHash = computeSoladyCloneInitCodeHash(
      DOPPLER_ERC20_V1_IMPLEMENTATION,
    );
    const firstCandidate = computeCreate2Address(
      '0x'.padEnd(66, '0') as Hash,
      initHash,
      TOKEN_FACTORY,
    );
    const impossiblePrefix =
      firstCandidate.slice(2, 6) === 'dead' ? 'feed' : 'dead';

    expect(() =>
      mineTokenAddress({
        prefix: impossiblePrefix,
        tokenFactory: TOKEN_FACTORY,
        initialSupply,
        recipient: RECIPIENT,
        owner: OWNER,
        tokenData,
        v2Implementation: DOPPLER_ERC20_V1_IMPLEMENTATION,
        maxIterations: 1,
      }),
    ).toThrowError(/could not find salt/i);
  });

  it('throws when neither prefix nor suffix is provided', () => {
    const initialSupply = 1_000_000n;
    const tokenData = buildDopplerErc20V1TokenData();

    expect(() =>
      mineTokenAddress({
        prefix: '',
        tokenFactory: TOKEN_FACTORY,
        initialSupply,
        recipient: RECIPIENT,
        owner: OWNER,
        tokenData,
        v2Implementation: DOPPLER_ERC20_V1_IMPLEMENTATION,
      }),
    ).toThrowError(/must provide prefix and\/or suffix/i);
  });

  it('throws on invalid suffix', () => {
    const initialSupply = 1_000_000n;
    const tokenData = buildDopplerErc20V1TokenData();

    expect(() =>
      mineTokenAddress({
        prefix: '',
        suffix: 'zz',
        tokenFactory: TOKEN_FACTORY,
        initialSupply,
        recipient: RECIPIENT,
        owner: OWNER,
        tokenData,
        v2Implementation: DOPPLER_ERC20_V1_IMPLEMENTATION,
      }),
    ).toThrowError(/suffix must be a hexadecimal string/i);
  });
});
