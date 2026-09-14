#!/usr/bin/env bash
# Fork deployed devnet programs and policy; candidate overlays are explicit opt-in.
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_DIR="${DOPPLER_SOL_SOURCE_DIR:-$ROOT_DIR/../doppler-sol}"
EXPECTED_REVISION=8bac0551f6e0f83a861f4822886d30a00095a22e
export DOPPLER_PREDICTION_FORK_MODE="${DOPPLER_PREDICTION_FORK_MODE:-deployed}"
[[ "$DOPPLER_PREDICTION_FORK_MODE" == deployed || "$DOPPLER_PREDICTION_FORK_MODE" == candidate ]] || { echo "Fork mode must be deployed or candidate" >&2; exit 1; }
export SOLANA_DEVNET_RPC_URL="${SOLANA_DEVNET_RPC_URL:-https://api.devnet.solana.com}"
if [[ -n "${DOPPLER_PREDICTION_FORK_REPORT_DIR:-}" ]]; then
  mkdir -p "$DOPPLER_PREDICTION_FORK_REPORT_DIR"
  [[ -z "$(ls -A "$DOPPLER_PREDICTION_FORK_REPORT_DIR")" ]] || { echo 'Report directory must be empty' >&2; exit 1; }
else
  export DOPPLER_PREDICTION_FORK_REPORT_DIR="$(mktemp -d "${TMPDIR:-/tmp}/doppler-prediction-devnet-fork.XXXXXX")"
fi
RUN_DIR="$DOPPLER_PREDICTION_FORK_REPORT_DIR"
RPC_PORT="${DOPPLER_PREDICTION_FORK_RPC_PORT:-19119}"
LOCAL_RPC_URL="http://127.0.0.1:$RPC_PORT"
VALIDATOR_BIN="${DOPPLER_PREDICTION_FORK_VALIDATOR:-solana-test-validator}"
VALIDATOR_BIN="$(command -v "$VALIDATOR_BIN")"
RUNTIME_CLI="$(dirname "$VALIDATOR_BIN")/solana"
VALIDATOR_PID=""
cleanup() {
  local result=$?
  if [[ -n "$VALIDATOR_PID" ]]; then
    kill "$VALIDATOR_PID" 2>/dev/null || true
    wait "$VALIDATOR_PID" 2>/dev/null || true
  fi
  echo "Devnet fork evidence retained: $RUN_DIR"
  if [[ "$result" != 0 && -f "$RUN_DIR/validator.log" ]]; then tail -60 "$RUN_DIR/validator.log" >&2; fi
}
trap cleanup EXIT
for executable in solana solana-keygen node; do
  command -v "$executable" >/dev/null || { echo "Required executable missing: $executable" >&2; exit 1; }
done
solana --version | tee "$RUN_DIR/toolchain.log"
"$VALIDATOR_BIN" --version >> "$RUN_DIR/toolchain.log"
[[ -x "$RUNTIME_CLI" ]] || { echo "Matching runtime CLI missing: $RUNTIME_CLI" >&2; exit 1; }
if [[ "$DOPPLER_PREDICTION_FORK_MODE" == candidate ]]; then
  for executable in cargo cargo-build-sbf; do
    command -v "$executable" >/dev/null || { echo "Required executable missing: $executable" >&2; exit 1; }
  done
  cargo-build-sbf --version >> "$RUN_DIR/toolchain.log"
  solana --version | grep -q 'solana-cli 4.1.0 ' || { echo 'Agave 4.1.0 required for this v3 devnet fork' >&2; exit 1; }
  cargo-build-sbf --version | grep -q '^cargo-build-sbf 4.1.0$' || { echo 'Agave 4.1.0 SBF builder required' >&2; exit 1; }
  [[ "$(git -C "$SOURCE_DIR" rev-parse HEAD)" == "$EXPECTED_REVISION" ]] || { echo "Expected protocol revision $EXPECTED_REVISION" >&2; exit 1; }
  [[ -z "$(git -C "$SOURCE_DIR" status --porcelain --untracked-files=no)" ]] || { echo 'Use a clean protocol checkout' >&2; exit 1; }
  export DOPPLER_PREDICTION_FORK_ARTIFACT_DIR="$SOURCE_DIR/target/devnet-ready/deploy"
  # Build from pinned source even if artifacts already exist. No remote deployment commands occur.
  for manifest in programs/initializer programs/trusted_oracle programs/prediction_migrator programs/hooks/prediction_hook; do
    CARGO_TARGET_DIR="$SOURCE_DIR/target/devnet-ready/build" cargo build-sbf --tools-version v1.54 --arch v3 \
      --sbf-out-dir "$DOPPLER_PREDICTION_FORK_ARTIFACT_DIR" --manifest-path "$SOURCE_DIR/$manifest/Cargo.toml"
  done
fi
cd "$ROOT_DIR"
for signer in genesis creator second-creator; do
  solana-keygen new --no-bip39-passphrase --silent --outfile "$RUN_DIR/$signer-keypair.json"
done
GENESIS_PAYER="$(solana-keygen pubkey "$RUN_DIR/genesis-keypair.json")"
export SOLANA_FORK_UPGRADE_AUTHORITY="$GENESIS_PAYER"
export SOLANA_FORK_CREATOR="$(solana-keygen pubkey "$RUN_DIR/creator-keypair.json")"
SECOND_CREATOR="$(solana-keygen pubkey "$RUN_DIR/second-creator-keypair.json")"
"$RUNTIME_CLI" feature status --display-all --output json --url "$SOLANA_DEVNET_RPC_URL" > "$RUN_DIR/upstream-runtime-feature-registry.json"
npx --yes pnpm@10.11.0 exec tsx scripts/prepare-solana-prediction-devnet-fork.ts
export SOLANA_INITIALIZER_PROGRAM_ID=4h3Dqyo5qmteJoMxXt3tdtfXELDB6pdRTPU9mWruiKp1
export SOLANA_TRUSTED_ORACLE_PROGRAM_ID=HhUzN7VvonNUevATyugZUepzxpeEZMXQbV92X2xvsp5m
export SOLANA_PREDICTION_MIGRATOR_PROGRAM_ID=HYHdyy7QZg8Ucky9Z97xNtSCvrZxVNkeoney8xEPXjiZ
export SOLANA_PREDICTION_HOOK_PROGRAM_ID=7QcQDANJVC17Jgc6KjjeagSkm2zAphgHVPK5agJzyihB
if solana cluster-version --url "$LOCAL_RPC_URL" >/dev/null 2>&1; then
  echo "Refusing occupied local RPC port $RPC_PORT" >&2; exit 1
fi
PROGRAM_ARGS=()
if [[ "$DOPPLER_PREDICTION_FORK_MODE" == candidate ]]; then
  PROGRAM_ARGS=(
    --upgradeable-program "$SOLANA_INITIALIZER_PROGRAM_ID" "$DOPPLER_PREDICTION_FORK_ARTIFACT_DIR/initializer.so" "$GENESIS_PAYER" \
    --upgradeable-program "$SOLANA_TRUSTED_ORACLE_PROGRAM_ID" "$DOPPLER_PREDICTION_FORK_ARTIFACT_DIR/trusted_oracle.so" "$GENESIS_PAYER" \
    --upgradeable-program "$SOLANA_PREDICTION_MIGRATOR_PROGRAM_ID" "$DOPPLER_PREDICTION_FORK_ARTIFACT_DIR/prediction_migrator.so" "$GENESIS_PAYER" \
    --upgradeable-program "$SOLANA_PREDICTION_HOOK_PROGRAM_ID" "$DOPPLER_PREDICTION_FORK_ARTIFACT_DIR/prediction_hook.so" "$GENESIS_PAYER"
  )
fi
"$VALIDATOR_BIN" --reset --quiet --ledger "$RUN_DIR/ledger" --mint "$GENESIS_PAYER" \
  --url "$SOLANA_DEVNET_RPC_URL" --clone-feature-set \
  --account-dir "$RUN_DIR/genesis-accounts" \
  --rpc-port "$RPC_PORT" --faucet-port "$((RPC_PORT + 2))" --gossip-port "$((RPC_PORT + 3))" \
  --dynamic-port-range "$((RPC_PORT + 4))-$((RPC_PORT + 30))" \
  "${PROGRAM_ARGS[@]}" \
  > "$RUN_DIR/validator.log" 2>&1 &
VALIDATOR_PID=$!
ready=false
for _ in $(seq 1 120); do
  kill -0 "$VALIDATOR_PID" 2>/dev/null || { echo 'Fork validator exited early' >&2; exit 1; }
  slot="$(solana slot --url "$LOCAL_RPC_URL" 2>/dev/null || true)"
  if [[ "$slot" =~ ^[0-9]+$ && "$slot" -ge 5 ]]; then ready=true; break; fi
  kill -0 "$VALIDATOR_PID" 2>/dev/null || { echo 'Fork validator exited early' >&2; exit 1; }
  sleep 1
done
[[ "$ready" == true ]] || { echo 'Fork validator failed to produce slots' >&2; exit 1; }
# From this point every transaction URL is explicitly local. Config/allowlists are never bootstrapped.
export SOLANA_NETWORK=custom SOLANA_RPC_URL="$LOCAL_RPC_URL" SOLANA_WS_URL="ws://127.0.0.1:$((RPC_PORT + 1))"
export SOLANA_KEYPAIR_PATH="$RUN_DIR/creator-keypair.json" SOLANA_SECOND_CREATOR_KEYPAIR_PATH="$RUN_DIR/second-creator-keypair.json"
export SOLANA_KEYPAIR='' SOLANA_SECOND_CREATOR_KEYPAIR=''
export SOLANA_SECOND_QUOTE_MINT=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
# Agave initializes the native mint after account loading, replacing only lamports.
NATIVE_LAMPORTS="$(solana balance So11111111111111111111111111111111111111112 --lamports --url "$LOCAL_RPC_URL")"
[[ "$NATIVE_LAMPORTS" == '1000000000 lamports' ]] || { echo "Unexpected native mint bootstrap balance: $NATIVE_LAMPORTS" >&2; exit 1; }
WSOL_TOPUP="$(node -e 'const m=JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));const d=BigInt(m.unchangedAccounts[1].lamports)-1000000000n;if(d<0n)throw Error("Upstream native mint balance below local bootstrap");console.log(String(d/1000000000n)+"."+String(d%1000000000n).padStart(9,"0"))' "$RUN_DIR/fork-manifest.json")"
solana transfer So11111111111111111111111111111111111111112 "$WSOL_TOPUP" \
  --from "$RUN_DIR/genesis-keypair.json" --fee-payer "$RUN_DIR/genesis-keypair.json" \
  --url "$LOCAL_RPC_URL" | tee "$RUN_DIR/native-mint-restoration.log"
solana airdrop 100 "$SOLANA_FORK_CREATOR" --url "$LOCAL_RPC_URL"
solana airdrop 100 "$SECOND_CREATOR" --url "$LOCAL_RPC_URL"
npx --yes pnpm@10.11.0 exec tsx scripts/prepare-solana-prediction-devnet-fork.ts --verify
cp "$RUN_DIR/local-verification.json" "$RUN_DIR/local-before.json"
export SOLANA_PROBE_PAYER="$SOLANA_FORK_CREATOR"
npx --yes pnpm@10.11.0 exec tsx scripts/check-prediction-deployment.ts | tee "$RUN_DIR/fork-abi-probe.log"
for scenario in binary multi eight shared incremental void; do
  npx --yes pnpm@10.11.0 exec tsx examples/solana-prediction-market.ts \
    --scenario "$scenario" --manifest "$RUN_DIR/$scenario.json" --action all \
    2>&1 | tee "$RUN_DIR/$scenario.log"
done
COUNT_BEFORE="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).signatures.length)' "$RUN_DIR/binary.json")"
for action in setup all; do
  npx --yes pnpm@10.11.0 exec tsx examples/solana-prediction-market.ts \
    --scenario binary --manifest "$RUN_DIR/binary.json" --action "$action" \
    2>&1 | tee "$RUN_DIR/binary-replay-$action.log"
done
COUNT_AFTER="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).signatures.length)' "$RUN_DIR/binary.json")"
[[ "$COUNT_BEFORE" == "$COUNT_AFTER" ]] || { echo 'Completed replay submitted additional transactions' >&2; exit 1; }
npx --yes pnpm@10.11.0 exec tsx scripts/prepare-solana-prediction-devnet-fork.ts --verify
printf 'All six devnet-fork scenarios, exact payouts, replay and unchanged upstream config assertions passed.\n'
