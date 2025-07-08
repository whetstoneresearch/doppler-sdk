# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the Doppler V3 Indexer - a multi-chain blockchain indexing service built with [Ponder](https://ponder.sh/) that indexes Uniswap V2, V3, and V4 protocol events across Ethereum mainnet, Base, Unichain, and Ink chains.

## Essential Commands

```bash
# Development
pnpm dev          # Start development server with hot reload

# Production
pnpm start        # Start production server

# Database
pnpm db           # Database management utilities

# Code Generation
pnpm codegen      # Generate types from schema (run after schema changes)

# Code Quality
pnpm lint         # Run ESLint
pnpm typecheck    # Run TypeScript compiler
```

## High-Level Architecture

### Core Components

1. **Protocol Adapters** (`src/adapters/`)
   - Factory pattern implementation for V2, V3, and V4 protocols
   - Each adapter handles protocol-specific logic for price calculation and data extraction

2. **Indexer Event Handlers** (`src/indexer/`)
   - `indexer-v2.ts`, `indexer-v3.ts`, `indexer-v4.ts` - Protocol-specific event handlers
   - `indexer-shared.ts` - Shared logic for oracle updates and scheduled jobs
   - Events are processed in omnichain order for cross-chain consistency

3. **Configuration System** (`src/config/`)
   - Modular chain configurations (mainnet, base, unichain, ink)
   - Dynamic contract loading based on chain and protocol version
   - Block intervals and checkpoints for efficient indexing

4. **Core Services** (`src/core/`)
   - `PriceService` - Handles price calculations across protocols
   - `SwapService` & `SwapOrchestrator` - Process and orchestrate swap events
   - `MarketDataService` - Aggregates market metrics

### Database Schema

Key entities in `ponder.schema.ts`:
- `user`, `token`, `asset` - Base entities
- `pool`, `v2Pool` - Liquidity pool representations
- `position`, `swap` - User interactions
- `ethPrice`, `hourBucket`, `dailyVolume` - Time-series data

### API Endpoints

- `/graphql` - GraphQL API for querying indexed data
- `/search/:query` - REST endpoint for token search with chain filtering
- `/sql/*` - Direct SQL access (development only)

## Development Workflow

1. **Adding New Chains**: 
   - Create chain config in `src/config/chains/`
   - Add to `chainConfigs` in `src/config/chains/index.ts`

2. **Adding New Contracts**:
   - Add ABI to `src/abis/`
   - Create contract config in `src/config/contracts/`
   - Update relevant indexer file

3. **Schema Changes**:
   - Modify `ponder.schema.ts`
   - Run `pnpm codegen` to update types
   - Update relevant indexer handlers

4. **Testing Changes**:
   - Use `pnpm dev` for hot-reload development
   - Monitor logs for indexing errors
   - Check database state with `pnpm db`

## Important Notes

- The project uses PostgreSQL for data storage
- Indexing runs in omnichain mode for cross-chain consistency
- Price calculations use protocol-specific formulas (see utils/v*-utils/)
- All monetary values are stored as bigint to prevent precision loss