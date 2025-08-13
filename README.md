# Doppler Protocol Ecosystem 🚀

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A suite of tools for interacting with the Doppler Protocol - liquidity bootstrapping protocol built on Uniswap.

## Packages

| Package                                              | Version                                                                                             | Description                          |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------ |
| [`doppler-v3-sdk`](/packages/doppler-v3-sdk)         | [![npm](https://img.shields.io/npm/v/doppler-v3-sdk)](https://www.npmjs.com/package/doppler-v3-sdk) | Core SDK for V3 interactions         |
| [`doppler-v4-sdk`](/packages/doppler-v4-sdk)         | [![npm](https://img.shields.io/npm/v/doppler-v4-sdk)](https://www.npmjs.com/package/doppler-v4-sdk) | Core SDK for V4 interactions         |
| [`doppler-router`](/packages/doppler-router)         | [![npm](https://img.shields.io/npm/v/doppler-router)](https://www.npmjs.com/package/doppler-router) | Swap routing & transaction execution |
| [`doppler-v3-indexer`](/packages/doppler-v3-indexer) | -                                                                                                   | V3 Indexer for protocol analytics    |
| [`doppler-v4-indexer`](/packages/doppler-v4-indexer) | -                                                                                                   | V4 Indexer for protocol analytics    |

### Installation

```bash
# Install V3 SDK
pnpm add doppler-v3-sdk
# Install Router
pnpm add doppler-router
# Install V4 SDK
pnpm add doppler-v4-sdk
# Run indexer dev environment
cd packages/doppler-v3-indexer
pnpm run dev
```

## License

Distributed under the MIT License. See `LICENSE` for more information.
