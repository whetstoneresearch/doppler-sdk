# V2 initializer fixture

The mainnet example suite loads this pinned initializer candidate into a disposable local validator while cloning other programs and protocol configuration from mainnet. Passing that suite validates the SDK against the candidate; it does not establish that V2 is deployed on mainnet. The devnet example suite clones the deployed V2 initializer directly.

`manifest.json` records the protocol source commit, build toolchain, uncompressed size, and SHA-256 hash. `scripts/prepare-solana-initializer-candidate.mjs` verifies the hash before writing the local executable. Successful launch execution verifies the compiled program ID against the SDK deployment. The fixture is gzip-compressed without a timestamp and is excluded from the published SDK by its `files: ["dist"]` setting.

To refresh it, use a clean checkout of the recorded `doppler-sol` revision and its `scripts/build-fork-programs.ts` helper for `doppler_launch_markets_v1` on mainnet. Put Solana 4.1.0's binaries on `PATH`; this fixture uses platform-tools v1.54 and SBPF v3. The protocol helper rewrites network IDs, including linked interfaces, in a disposable source tree. Compress the resulting binary with `gzip -n -9`, update the manifest, and run the mainnet example suite.

```sh
pnpm test:solana:fork:examples
```

The devnet example suite tests V2 against deployed programs. The prediction lifecycle suite separately exercises explicit legacy launch compatibility, also against deployed programs. Its runtime and feature-set assertions remain enabled.
