# Repository Guidelines

## Project Structure & Module Organization

This is a TypeScript SDK published as `@whetstone-research/doppler-sdk`. Source lives in `src/`, split by platform: `src/evm/` contains EVM builders, entities, ABIs, constants, and utilities; `src/solana/` contains Solana clients, helpers, migrators, generated codecs, and React bindings. Tests live in `test/evm/` and `test/solana/`; EVM tests are further grouped into `unit`, `integration`, `fork`, `e2e`, `setup`, and `utils`. Examples are in `examples/`, docs in `docs/`, and generation scripts/IDLs in `scripts/`.

## Build, Test, and Development Commands

Use pnpm with Node.js `>=18`.

- `pnpm build` builds ESM/CJS/types output with `tsup` into `dist/`.
- `pnpm start` or `pnpm build:watch` runs `tsup` in watch mode.
- `pnpm test` runs the default Vitest suite.
- `pnpm test:unit` runs unit tests; `pnpm test:solana` runs Solana tests.
- `pnpm test:fork` and `pnpm test:live` enable environment-sensitive fork/live tests.
- `pnpm typecheck` and `pnpm typecheck:test` validate source and test TypeScript.
- `pnpm lint`, `pnpm lint:fix`, `pnpm format`, and `pnpm format:check` use Oxlint/Oxfmt on `src/` and `examples/`.
- `pnpm generate:codecs` regenerates `src/solana/generated/`; `pnpm generate:addresses` refreshes `src/evm/deployments.generated.ts`.

## Coding Style & Naming Conventions

Write ESM TypeScript and prefer explicit exports from entry points such as `src/evm/index.ts` and `src/solana/index.ts`. Classes/builders use `PascalCase`; functions and variables use `camelCase`; constants follow nearby patterns. Update generated files through scripts rather than manual edits. Oxfmt is authoritative; package Prettier settings use 80 columns, semicolons, single quotes, and trailing commas.

## Testing Guidelines

Vitest is the test runner. Name tests `*.test.ts` and place them near the relevant platform and scope, for example `test/evm/unit/utils/priceHelpers.test.ts` or `test/solana/unit/core/oracle.test.ts`. Add unit tests for pure helpers and integration/fork tests for SDK workflows or chain-specific behavior. Run `pnpm test:unit`, the relevant platform suite, and `pnpm typecheck:test` before submitting changes.

## Commit & Pull Request Guidelines

Recent history uses short imperative subjects such as `ci`, `update examples`, and conventional prefixes like `feat:` and `chore(release):`. Keep commit messages concise and scope them when helpful, for example `feat: add Solana quote helper` or `fix: validate auction tick spacing`.

Never amend existing commits. Put follow-up work in a new commit.
Always use conventional commit messages, for example `fix: validate auction tick spacing` or `docs: update contributor guidance`.

Pull requests should include a summary, affected EVM/Solana areas, tests run, and required environment variables. Link issues when available. For generated code or deployment address changes, call out the generation command used.

## Security & Configuration Tips

Copy `examples/.env.example` or `.env.example` for local configuration. Never commit private keys, RPC secrets, or live wallet credentials. For live and fork tests, verify chain IDs, RPC URLs, and funded accounts before submitting transactions.

Do not introduce new mainnet deployment details, program IDs, addresses, or operational runbooks into source, examples, generated files, docs, or PR text unless the user explicitly asks for that mainnet disclosure. Prefer devnet defaults and custom-deployment placeholders for Solana examples and SDK helpers.
