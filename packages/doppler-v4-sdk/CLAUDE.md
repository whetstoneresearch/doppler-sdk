# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build System

The Doppler V4 SDK uses the following build tools:
- **tsup** for bundling (`npm run build`)
- **vitest** for testing (`npm run test`)
- **size-limit** for bundle size analysis (`npm run size`)

## Common Commands

```bash
# Install dependencies
npm install

# Build the SDK
npm run build

# Watch for changes and rebuild
npm run build:watch

# Run tests
npm run test

# Run tests and watch for changes
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Analyze bundle size
npm run size
npm run analyze
```

## Architecture Overview

The Doppler V4 SDK is a TypeScript library for interacting with the Doppler protocol on Ethereum. It's structured around key entities:

1. **Doppler** - Core protocol interfaces
2. **Factory** - Contract deployment and configuration utilities
3. **Token** - ERC20 and ETH token interfaces
4. **Quoter** - Price quoting utilities

Each entity follows a pattern of providing both read-only and read-write interfaces:
- `Read<Entity>.ts` - Contains methods for querying data (view functions)
- `ReadWrite<Entity>.ts` - Extends read functionality with methods for transactions

The SDK uses [ethers.js](https://docs.ethers.org/v5/) and [viem](https://viem.sh/) for Ethereum interactions, wrapped with [@delvtech/drift](https://github.com/delvtech/drift) to provide consistent contract abstractions.

## Key Concepts

1. **Factory Pattern**: The SDK uses a factory pattern to create and deploy Doppler contracts. The `ReadWriteFactory` class provides methods for configuring and deploying Doppler pools.

2. **Hook Mining**: Pools use Uniswap V4 hooks for price discovery. The SDK has utilities for "mining" hook addresses to find ones compatible with flag requirements.

3. **Config Building**: The `buildConfig` method converts user-friendly parameters into the detailed configuration needed by the protocol.

4. **Price Calculations**: Functions for calculating price ranges, ticks, and optimal parameters based on market conditions.

5. **Token Integrations**: The SDK supports both ERC20 (wrapped as DERC20) and native ETH tokens.

## Working with the Codebase

When making changes:

1. Maintain the separation between read and read-write interfaces
2. Follow the established patterns for entity organization
3. Use consistent parameter naming and types
4. Keep helper functions organized by their domain (e.g., price-related utilities in related files)
5. Run tests to ensure changes don't break existing functionality

The system follows a specific pattern for creating and deploying pools, which involves:
1. Building a configuration with comprehensive parameters
2. Finding a suitable hook address through "mining" 
3. Deploying related contracts in a specific order
4. Setting up proper price ranges and pool parameters