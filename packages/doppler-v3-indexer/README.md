# Doppler V3 Indexer — Configs & Usage

This package ships with multiple Ponder configs so you can index different networks or a Zora‑only subset. You can select a config at runtime via `--config` when using `ponder dev` or `ponder start`.

## Configs

- `ponder.config.ts`: Multichain (Base, Unichain, Ink) + Zora listeners on Base.
- `ponder.config.multichain.ts`: Multichain (same scope as above).
- `ponder.config.zora.ts`: Zora‑only on Base (limits chains/contracts to Zora needs).

## Run

From this package directory:

- Dev (hot reload): `ponder dev --config ./ponder.config.ts`
- Prod: `ponder start --config ./ponder.config.ts`

Swap the config path to target a different setup, for example:

- Multichain: `ponder dev --config ./ponder.config.multichain.ts`
- Zora‑only: `ponder dev --config ./ponder.config.zora.ts`

## Block Handlers

If you choose a config that does not enable certain chains/blocks, you may need to comment out the corresponding block handlers to avoid registering unused listeners.

- Location: `src/indexer/blockHandlers.ts`
- Handlers defined:
  - `BaseChainlinkEthPriceFeed`
  - `UnichainChainlinkEthPriceFeed`
  - `InkChainlinkEthPriceFeed`
  - `ZoraUsdcPrice`

Comment out the `ponder.on("…:block", …)` sections for any chains you are not indexing with your chosen config. For example, when using `ponder.config.zora.ts` you can comment out `UnichainChainlinkEthPriceFeed` and `InkChainlinkEthPriceFeed` handlers.

## Notes

- RPC env vars live in `.env.local` (see `.env.local.example`). Common ones:
  - Base: `PONDER_RPC_URL_8453`
  - Unichain: `PONDER_RPC_URL_130`
  - Ink: `PONDER_RPC_URL_57073`
- The database connection defaults to Postgres at `postgresql://postgres:postgres@localhost:5432/default` (see `docker-compose.yml`).