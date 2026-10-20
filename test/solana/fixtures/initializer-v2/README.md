# V2 initializer fixtures

The mainnet and devnet example suites load these pinned initializer candidates into disposable local validators. Other programs and protocol configurations are cloned from the selected network. Passing these suites validates the SDK against the candidate; it does not establish that V2 is deployed on either network.

`manifest.json` records the protocol source commit, build toolchain, uncompressed sizes, and SHA-256 hashes. `scripts/prepare-solana-initializer-candidate.mjs` verifies those hashes before writing the local executable. Successful launch execution verifies the compiled program ID against the network's SDK deployment. The fixtures are gzip-compressed without timestamps and are excluded from the published SDK by its `files: ["dist"]` setting.

To refresh them, use a clean checkout of the recorded `doppler-sol` revision and its `scripts/build-fork-programs.ts` helper for `doppler_launch_markets_v1` on each network. Put Solana 4.1.0's binaries on `PATH`; these fixtures use platform-tools v1.54 and SBPF v3. The protocol helper rewrites network IDs, including linked interfaces, in a disposable source tree. Compress the resulting binaries with `gzip -n -9`, update the manifest, and run both example suites.

```sh
pnpm test:solana:fork:examples
pnpm test:solana:fork:devnet-examples
```

The prediction lifecycle suite remains a separate check of deployed programs, using explicit legacy launch mode and a validator matched to devnet. Its runtime and feature-set assertions remain enabled.
