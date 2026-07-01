# Contributing

Thanks for taking the time to improve Doppler SDK. This guide explains how to
set up the repository, choose the right checks, and prepare changes so they are
easy to review.

## Ways to Contribute

Helpful contributions include:

- bug reports with concrete reproduction steps
- focused fixes for open issues
- tests that cover existing behavior or prevent regressions
- examples that make SDK workflows easier to understand
- documentation improvements that clarify current behavior
- SDK API improvements discussed with maintainers before implementation

For larger API or behavior changes, open an issue first. Describe the problem,
the proposed API or behavior, and any alternatives you considered.

## Before You Start

Create your branch from the latest `main`:

```bash
git fetch origin
git switch main
git pull --ff-only
git switch -c feat/short-description
```

Keep pull requests focused. A PR that changes one behavior, test area, or docs
topic is easier to review than a PR that mixes unrelated cleanup with feature
work.

## Development Setup

Use Node.js `>=18`. CI currently runs the main test workflow on Node.js 22.
This repository uses pnpm; the pinned package-manager version is recorded in
`package.json`.

```bash
pnpm install
```

For examples, fork tests, and live tests, copy the env template and provide only
the values needed for the command you are running:

```bash
cp .env.example .env
```

Never commit private keys, RPC secrets, wallet credentials, or local `.env`
files.

## Project Layout

- `src/evm/`: EVM SDK builders, entities, ABIs, constants, and utilities
- `src/solana/`: Solana clients, helpers, migrators, generated codecs, and
  React bindings
- `test/evm/`: EVM unit, integration, fork, and live tests
- `test/solana/`: Solana unit tests
- `examples/`: runnable SDK examples
- `docs/`: focused guides and longer-form API documentation
- `scripts/`: code generation and maintenance scripts

## Coding Guidelines

- Follow the style of the surrounding file before introducing a new pattern.
- Keep public APIs explicit and typed.
- Prefer narrow, domain-specific helpers over generic abstractions.
- Add comments only when they explain a non-obvious invariant, protocol rule,
  or integration constraint.
- Do not manually edit generated files. Regenerate them with the relevant
  script.

Generated artifacts:

- Run `pnpm generate:codecs` after changing Solana IDLs in `scripts/idl/`.
- Run `pnpm generate:addresses` when refreshing EVM deployment data from the
  configured Doppler deployments source.

## Examples

Examples should be runnable and safe by default.

- Import `./env` first so local `.env` files are loaded consistently.
- Use `../src/evm` or `../src/solana` imports inside this repository.
- Prefer simulation or read-only behavior by default.
- Require an explicit `EXECUTE=1`, `EXECUTE_*`, or similarly clear env flag
  before broadcasting transactions.
- Document required and optional environment variables at the top of the file.
- Avoid hard-coded private credentials, secret RPC URLs, or live wallet data.

## Tests and Checks

Run the smallest useful check while iterating, then run the relevant final
checks before opening a PR.

Core checks:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:solana
```

Additional checks:

```bash
pnpm typecheck:test
pnpm build
pnpm test
```

Run platform-specific tests when your change touches that platform:

```bash
pnpm test:solana
pnpm test:fork
pnpm test:live
pnpm test:whitelisting
```

Fork and live tests require RPC configuration and may require funded accounts or
provider API keys. Do not run live write examples or live tests unless you have
confirmed the target chain, wallet, and RPC endpoint.

## Pull Requests

Before opening a PR:

- make sure the branch is based on current `main`
- include tests for behavior changes
- update examples or docs when user-facing behavior changes
- regenerate generated files with the documented command when applicable
- run the checks relevant to your change

PR descriptions should include:

- a short summary of what changed
- affected areas, such as EVM, Solana, examples, docs, or generated artifacts
- tests and checks run
- required environment variables for manual verification, if any
- linked issues, for example `Closes #123`

Use conventional commit messages for commits, for example:

```bash
feat(evm): add quote helper
fix(solana): validate migration threshold
docs: add vesting release example
test(evm): cover multicurve fee preview
```

During review, prefer follow-up commits for requested changes so reviewers can
see what changed. If a maintainer asks you to squash or rebase, coordinate that
in the PR.

## AI-Assisted Contributions

If a contribution was materially assisted by AI tools, disclose that in the PR
description and summarize the scope of assistance. Reviewers still expect you to
understand the change, verify it, and take responsibility for the final result.

## Review Guidelines

Reviewers should prioritize correctness, security, tests, compatibility, and
developer experience. Be concrete when requesting changes, and distinguish
blocking issues from optional nits. The goal is to make the codebase better and
to keep the contribution process productive.
