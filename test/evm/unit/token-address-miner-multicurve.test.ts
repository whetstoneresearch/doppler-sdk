import { describe, expect, it } from 'vitest'
import {
  type Address,
  type Hex,
  encodeAbiParameters,
  encodePacked,
  keccak256,
  getAddress,
  parseEther,
} from 'viem'
import { mineTokenAddress } from '../../../src/evm/utils/tokenAddressMiner'

const TOKEN_FACTORY = '0x0000000000000000000000000000000000000fac' as Address
const AIRLOCK = '0x000000000000000000000000000000000000a11c' as Address
const DOPPLER_ERC20_V1_IMPLEMENTATION =
  '0xDB7B520bb5C3a2C5d4871198081911359f93be87' as Address

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
] as const

function buildDopplerErc20V1TokenData(): Hex {
  return encodeAbiParameters(DOPPLER_ERC20_V1_TOKEN_ABI, [
    'Multicurve Token',
    'MULTI',
    [{ cliff: 90n, duration: 180n }],
    [AIRLOCK],
    [0n],
    [parseEther('100000')],
    'ipfs://multicurve',
    10_000n,
    1_800,
    AIRLOCK,
    [AIRLOCK],
  ])
}

function computeSoladyCloneInitCodeHash(implementation: Address): `0x${string}` {
  return keccak256(
    `0x602c3d8160093d39f33d3d3d3d363d3d37363d73${implementation.slice(
      2
    )}5af43d3d93803e602a57fd5bf3`
  )
}

function computeCreate2Address(salt: `0x${string}`, initCodeHash: `0x${string}`, deployer: Address): Address {
  const encoded = encodePacked(
    ['bytes1', 'address', 'bytes32', 'bytes32'],
    ['0xff', deployer, salt, initCodeHash]
  )
  return getAddress(`0x${keccak256(encoded).slice(-40)}`)
}

describe('mineTokenAddress for multicurve auctions', () => {
  it('mines vanity token address for multicurve with standard token', () => {
    const initialSupply = parseEther('1000000')
    const tokenData = buildDopplerErc20V1TokenData()

    const result = mineTokenAddress({
      prefix: 'cafe',
      tokenFactory: TOKEN_FACTORY,
      initialSupply,
      recipient: AIRLOCK,
      owner: AIRLOCK,
      tokenData,
      v2Implementation: DOPPLER_ERC20_V1_IMPLEMENTATION,
      maxIterations: 500_000,
    })

    // Verify the prefix
    expect(result.tokenAddress.slice(2).toLowerCase().startsWith('cafe')).toBe(true)
    expect(result.iterations).toBeGreaterThan(0)
    expect(result.iterations).toBeLessThanOrEqual(500_000)

    // Verify the CREATE2 computation is correct
    const initHash = computeSoladyCloneInitCodeHash(DOPPLER_ERC20_V1_IMPLEMENTATION)
    const manualAddress = computeCreate2Address(result.salt, initHash, TOKEN_FACTORY)
    expect(manualAddress).toBe(result.tokenAddress)
  })

  it('finds different salts for different prefixes', () => {
    const initialSupply = parseEther('1000000')
    const tokenData = buildDopplerErc20V1TokenData()

    const result1 = mineTokenAddress({
      prefix: 'a',
      tokenFactory: TOKEN_FACTORY,
      initialSupply,
      recipient: AIRLOCK,
      owner: AIRLOCK,
      tokenData,
      v2Implementation: DOPPLER_ERC20_V1_IMPLEMENTATION,
      maxIterations: 100_000,
    })

    const result2 = mineTokenAddress({
      prefix: 'b',
      tokenFactory: TOKEN_FACTORY,
      initialSupply,
      recipient: AIRLOCK,
      owner: AIRLOCK,
      tokenData,
      v2Implementation: DOPPLER_ERC20_V1_IMPLEMENTATION,
      maxIterations: 100_000,
    })

    // Different prefixes should yield different salts and addresses
    expect(result1.salt).not.toBe(result2.salt)
    expect(result1.tokenAddress).not.toBe(result2.tokenAddress)

    // But both should match their respective prefixes
    expect(result1.tokenAddress.slice(2).toLowerCase().startsWith('a')).toBe(true)
    expect(result2.tokenAddress.slice(2).toLowerCase().startsWith('b')).toBe(true)
  })

  it('mines with configurable start salt', () => {
    const initialSupply = parseEther('1000000')
    const tokenData = buildDopplerErc20V1TokenData()

    // Mine starting from salt 10000
    const result = mineTokenAddress({
      prefix: '1',
      tokenFactory: TOKEN_FACTORY,
      initialSupply,
      recipient: AIRLOCK,
      owner: AIRLOCK,
      tokenData,
      v2Implementation: DOPPLER_ERC20_V1_IMPLEMENTATION,
      startSalt: 10000n,
      maxIterations: 100_000,
    })

    expect(result.tokenAddress.slice(2).toLowerCase().startsWith('1')).toBe(true)
    expect(result.iterations).toBeGreaterThan(0)

    // The salt should be >= 10000 since we started there
    const saltValue = BigInt(result.salt)
    expect(saltValue).toBeGreaterThanOrEqual(10000n)
  })

  it('respects iteration limit', () => {
    const initialSupply = parseEther('1000000')
    const tokenData = buildDopplerErc20V1TokenData()

    // Use a very rare prefix with low iteration limit
    expect(() =>
      mineTokenAddress({
        prefix: 'deadbeef',
        tokenFactory: TOKEN_FACTORY,
        initialSupply,
        recipient: AIRLOCK,
        owner: AIRLOCK,
        tokenData,
        v2Implementation: DOPPLER_ERC20_V1_IMPLEMENTATION,
        maxIterations: 10, // Very low limit
      })
    ).toThrowError(/could not find salt/i)
  })
})
