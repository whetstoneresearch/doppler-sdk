# Quotes and Swaps (EVM SDK)

This guide shows how to get price quotes and execute swaps using the EVM entrypoint of `@whetstone-research/doppler-sdk` across Uniswap V2, V3, and V4 (including Doppler dynamic auctions).

- Quoting uses the SDK `Quoter` for V2/V3/V4.
- Executing swaps uses the Uniswap Universal Router. For convenience, we show examples with the `doppler-router` helpers used in the miniapp.

## Setup

```ts
import { DopplerSDK, Quoter, getAddresses, DYNAMIC_FEE_FLAG } from '@whetstone-research/doppler-sdk/evm'
import { createPublicClient, createWalletClient, http, parseUnits } from 'viem'
import { base } from 'viem/chains'

const publicClient = createPublicClient({ chain: base, transport: http(rpcUrl) })
const walletClient  = createWalletClient({ chain: base, transport: http(rpcUrl), account })

const sdk = new DopplerSDK({ publicClient, walletClient, chainId: base.id })
const quoter = new Quoter(publicClient, base.id)
const addresses = getAddresses(base.id)
```

---

## Quoting

### V3: Exact Input (Single Pool)

```ts
const { amountOut, sqrtPriceX96After } = await quoter.quoteExactInputV3({
  tokenIn:  tokenInAddress,
  tokenOut: tokenOutAddress,
  amountIn: parseUnits('1.0', inDecimals),
  fee: 3000,                 // 0.3%
  sqrtPriceLimitX96: 0n,     // optional
})
```

### V3: Exact Output (Single Pool)

```ts
const { amountIn } = await quoter.quoteExactOutputV3({
  tokenIn:  tokenInAddress,
  tokenOut: tokenOutAddress,
  amountOut: parseUnits('100', outDecimals),
  fee: 3000,
})
```

### V2: Exact Input (Path)

```ts
// Simple 2-hop path (tokenIn -> tokenOut). Multi-hop supported.
const amounts = await quoter.quoteExactInputV2({
  amountIn: parseUnits('1.0', inDecimals),
  path: [tokenInAddress, tokenOutAddress],
})
const amountOut = amounts[amounts.length - 1]
```

### V4 (Dynamic Auctions): Exact Input

For Doppler V4 dynamic auctions, build a `poolKey` and determine direction with `zeroForOne`:

```ts
import { Address } from 'viem'

// Sort to get currency0/currency1 as in V4 (lexicographically ascending)
const [currency0, currency1] = [baseToken as Address, quoteToken as Address]
  .sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1))

const poolKey = {
  currency0,
  currency1,
  fee: DYNAMIC_FEE_FLAG, // Doppler dynamic auctions use the dynamic fee flag
  tickSpacing: 8,        // Typical for Doppler auctions; use actual value if known
  hooks: hookAddress as Address,
}

// Direction: swap 0->1 when tokenIn is currency0
const zeroForOne = (tokenInAddress.toLowerCase() === currency0.toLowerCase())

const { amountOut } = await quoter.quoteExactInputV4({
  poolKey,
  zeroForOne,
  exactAmount: parseUnits('1.0', inDecimals),
  hookData: '0x', // usually empty for Doppler swaps
})
```

Notes:
- Use your pool’s actual `tickSpacing` if available from the indexer or hook config.
- `hookData` is typically `0x` for Doppler swaps.

---

## Executing Swaps (Universal Router)

The SDK exposes addresses for the Uniswap Universal Router via `getAddresses(chainId)`. To build inputs, the miniapp uses `doppler-router` helpers; you can do the same or craft bytes manually.

Install helpers:

```bash
npm install doppler-router
```

### V4 Dynamic Auction: Swap Exact In Single

```ts
import { CommandBuilder, V4ActionBuilder, V4ActionType } from 'doppler-router'
import { zeroAddress, maxUint256, parseUnits } from 'viem'

// 1) Build poolKey and zeroForOne as in the quoting example
const [currency0, currency1] = [baseToken as Address, quoteToken as Address]
  .sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1))
const poolKey = { currency0, currency1, fee: DYNAMIC_FEE_FLAG, tickSpacing: 8, hooks: hookAddress as Address }
const zeroForOne = (tokenInAddress.toLowerCase() === currency0.toLowerCase())
const amountIn = parseUnits('1.0', inDecimals)
const minAmountOut = 0n // add slippage logic as needed

// 2) Build V4 swap actions
const actionBuilder = new V4ActionBuilder()
const [actions, params] = actionBuilder
  .addSwapExactInSingle(poolKey, zeroForOne, amountIn, minAmountOut, '0x')
  // Settle and take ensures outputs are transferred correctly
  .addAction(V4ActionType.SETTLE_ALL, [zeroForOne ? poolKey.currency0 : poolKey.currency1, maxUint256])
  .addAction(V4ActionType.TAKE_ALL,   [zeroForOne ? poolKey.currency1 : poolKey.currency0, 0])
  .build()

// 3) Encode Universal Router command
const [commands, inputs] = new CommandBuilder().addV4Swap(actions, params).build()

// 4) Minimal Universal Router ABI with execute()
const universalRouterAbi = [
  {
    type: 'function',
    name: 'execute',
    stateMutability: 'payable',
    inputs: [
      { name: 'commands', type: 'bytes' },
      { name: 'inputs',   type: 'bytes[]' },
    ],
    outputs: [],
  },
] as const

// 5) Execute
const txHash = await walletClient.writeContract({
  address: addresses.universalRouter,
  abi: universalRouterAbi,
  functionName: 'execute',
  args: [commands, inputs],
  // Send ETH when swapping from native currency (currency0 usually WETH/native)
  value: zeroForOne ? amountIn : 0n,
})
const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
```

Tips:
- For ERC20 inputs, ensure allowance (Permit2 or token approve). See `doppler-router` `getPermitSignature` helper.
- Use a non‑zero `minAmountOut` based on a prior quote and desired slippage.

### V3 and V2 Swaps

The Universal Router also supports V3/V2 swaps. You can:
- Use the `CommandBuilder` to add V3/V2 swap commands similarly, or
- Call the respective pool routers directly (outside the scope of this doc).

The unified SDK’s `Quoter` covers price discovery for all of V2/V3/V4 regardless of which path you choose for execution.

---

## End‑to‑End Pattern (Miniapp)

The `doppler-v4-miniapp` in this repo demonstrates:
- Building V4 `poolKey` and `zeroForOne` from base/quote tokens
- Quoting via `quoter.quoteExactInputV4`
- Executing via Universal Router using `doppler-router` builders

Look at `src/pages/PoolDetails.tsx` for a complete reference implementation.

---

## Atomic Multicurve Dev Buy

`MulticurveBuilder.withDevBuy(...)` routes multicurve creation and one exact-input purchase through Bundler in the same transaction. Dev buys support DopplerHookInitializer and Rehype initializer families; standard, scheduled, and decay initializers reject them. Production use is intended for compatible Rehype initializers configured with no-op governance and no-op migration; no-op migration requires pool beneficiaries.

A configured Bundler deployment is required. Use the chain default through `sdk.bundler`, or select a compatible custom deployment with `.withBundler(address)` and access its custody positions through `sdk.getBundler(address)`.

```ts
const params = sdk
  .buildMulticurveAuction()
  // Configure token, sale, curves, beneficiaries, and Rehype initializer.
  .withGovernance({ type: 'noOp' })
  .withMigration({ type: 'noOp' })
  .withDevBuy({
    exactAmountIn: parseEther('0.01'),
    recipient: user,
    vesting: {
      vestingDuration: 7n * 24n * 60n * 60n,
      cliffDuration: 24n * 60n * 60n,
      permissionlessClaim: false,
    },
  })
  .build();

const simulated = await sdk.factory.simulateCreateMulticurve(params);
console.log('Simulated output:', simulated.devBuy?.simulatedAmountOut);

const result = await simulated.execute();
console.log('Actual output:', result.devBuy?.amountOut);
```

Native numeraire sends exactly `exactAmountIn` as transaction value. ERC-20 numeraire sends zero native value and may require a separate `approve(bundler, exactAmountIn)` transaction before the atomic create-and-buy transaction. The wallet must already hold the input token; wrapping WETH and approving it do not form part of the atomic Bundler transaction. Permit2 and unlimited approvals are not used.

Bundler is exact-input only. Its simulation is informational because the contract has no minimum output, deadline, slippage limit, or hook-data parameter; state changes before execution can change the amount received.

Omit `vesting` to deliver purchased tokens directly to `recipient`. When vesting is present, Bundler holds the output under a linear schedule; `cliffDuration` defaults to zero and `permissionlessClaim` defaults to `false`. Permissionless claims change who may trigger a claim, never its recipient.

```ts
const bundler = sdk.getBundler(result.devBuy!.bundler);
const position = await bundler.getVesting(result.tokenAddress);
const claimable = await bundler.getClaimable(result.tokenAddress);

if (claimable > 0n) {
  const claimHash = await bundler.claim(result.tokenAddress);
  await publicClient.waitForTransactionReceipt({ hash: claimHash });
}
```

`simulateCreateMulticurve` returns `SimulatedMulticurveCreate`, while `prepareCreateMulticurve(params, { account })` returns `PreparedMulticurveCreate` with the Bundler transaction, an optional ERC-20 approval transaction, and deterministic prediction data. Executed receipt verification checks the Bundler recipient, exact input, output amount, and vesting event before returning `MulticurveCreateResult`.
