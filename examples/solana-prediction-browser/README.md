# Prediction markets browser walkthrough

A small Vite app using the SDK source and Wallet Standard. It covers oracle and market creation, outcome registration, market inspection, quoted buys, oracle finalization, per-entry settlement, winning claims, later proceeds, and void refunds. It runs locally; nothing is published.

## Run

From the SDK root, install the root dependencies first (`pnpm install`), then:

```sh
cd examples/solana-prediction-browser
npm ci
npm run dev
```

Open the localhost URL printed by Vite. `npm run build` typechecks the example and builds static assets; `npm run preview` serves that build.

The page imports `../../src/solana/` directly so it exercises your current changes, not an older published SDK. The example has its own lockfile and does not change root dependencies.

## Prerequisites

- For external wallet signing: a Wallet Standard Solana browser wallet supporting `solana:signAndSendTransaction` and the selected network. Local validators require a wallet advertising `solana:localnet`.
- Alternatively, **Use local test wallet** generates an ephemeral in-memory signer and requests 10 SOL from a loopback validator faucet. The app rejects all known public cluster genesis hashes, including through localhost proxies, and binds the signer to the validator genesis on each send. It clears the signer on reload, disconnect, network change, or RPC edits. This key is never persisted or exported; do not fund it with real assets.
- For external wallet signing, a funded **tester** wallet. Never import the deployer or upgrade-authority key into this app.
- A matching deployed Trusted Oracle, Prediction Migrator, Prediction Hook, and Initializer stack, with the prediction programs allowlisted. The source builders enforce the matching compiled program IDs. A successful app build does not establish deployment compatibility.
- Public devnet RPC or a localhost validator. Devnet transactions require a funded Wallet Standard tester wallet; the app checks the devnet genesis hash before signing and submitting. Local transactions reject known public-cluster genesis hashes, including through localhost proxies. The app rejects other endpoints; use the CLI examples for custom RPC setups.

## Walkthrough

1. Select **Devnet** and connect a funded tester wallet, or select **Local validator** and connect a compatible wallet (or choose **Use local test wallet**). Create an oracle with 2–8 unique outcome labels, or paste an existing oracle. Labels encode UTF-8 bytes padded to 32 bytes; they must match the IDs used by other clients.
2. Create a market with wrapped SOL (default) or a classic SPL Token quote mint. Another creator can reuse the oracle with their own separate market.
3. Load the market, select each outcome slot, and register it. Every slot must exist before buying. The app generates ephemeral mint/vault signers in memory, partially signs the transaction, and asks the connected wallet to sign and submit. No private keys are downloaded or persisted.
4. Select an outcome. The app discovers its launch using the market creator and oracle. Use **Preview buy** to fetch reserves, subtract pending fees, and populate a minimum output with 0.5% slippage. Buy with raw quote units. Wrapped SOL input is funded from the wallet automatically. Other SPL quote tokens must already be in the wallet's associated token account.
5. Switch to the oracle authority wallet and choose the actual winning slot. Finalizing is irreversible and affects every market sharing the oracle. Switch back to a participant for payouts.
6. Select and settle each outcome. Winner settlement enables winning claims; later losing-entry settlement adds proceeds. **Preview payout & balance** reads the current receipt and pot to show the wallet token balance and claimable quote for the entered burn amount. Future settlements are excluded. Claims burn raw winner-token units. **Harvest later proceeds** uses the existing claim receipt with zero burn.
7. If the winner had zero surviving circulating supply at settlement, the market is void. Settle entries and refund each owned outcome by selecting it and entering a positive raw burn amount. These refunds are entry-specific.

Market state and transaction activity distinguish submission from confirmation. A confirmation timeout preserves the signature: check its status and reload before retrying. **Download public session state** exports only addresses, network, and transaction signatures; use **Import addresses** for a CLI manifest or browser session after reopening to resume registration or settlement. CLI manifests with multiple markets populate a market selector; imports verify a supplied genesis hash against the selected RPC. A successfully submitted but interrupted registration can be discovered from on-chain creator launches without retaining ephemeral keys.

Amounts are raw integer token units, not decimal display amounts. Independent curve prices are not normalized probabilities. Claims return quote tokens to the associated account; wrapped SOL remains wrapped. The app does not close token accounts automatically.

This is a developer walkthrough, not a production market UI. Check the SDK's validator/devnet evidence separately from this example's build and browser rendering checks. Wallet signing and on-chain success require the prerequisites above and should be recorded with confirmed signatures.

The sender measures transaction size before submission. It uses a legacy message when that fits and the signer supports it, or creates and confirms a per-action address lookup table for larger v0 transactions. Lookup-table setup appears as separate confirmed receipts and may require additional wallet approvals. The sender waits for table activation and refreshes the blockhash before the launch transaction.

The matching devnet Oracle and Market ABI has passed a read-only compatibility probe. Live Wallet Standard signing is still unverified; this is separate from the confirmed local browser lifecycle and production build checks.
