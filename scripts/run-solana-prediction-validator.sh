#!/usr/bin/env bash
# Disposable local execution of the public prediction-market example collection.
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_DIR="${DOPPLER_SOL_SOURCE_DIR:-$ROOT_DIR/../doppler-sol}"
EXPECTED_REVISION=8bac0551f6e0f83a861f4822886d30a00095a22e
BUILD_DIR="$SOURCE_DIR/target/sdk-validator"
ARTIFACT_DIR="$BUILD_DIR/deploy"
RUN_DIR="$(mktemp -d "${TMPDIR:-/tmp}/doppler-prediction-validator.XXXXXX")"
RPC_PORT="${DOPPLER_PREDICTION_RPC_PORT:-18919}"
VALIDATOR_PID=""
cleanup() {
  local result=$?
  if [[ -n "$VALIDATOR_PID" && "${DOPPLER_KEEP_PREDICTION_VALIDATOR:-false}" != true ]]; then
    kill "$VALIDATOR_PID" 2>/dev/null || true
    wait "$VALIDATOR_PID" 2>/dev/null || true
  fi
  echo "Prediction validator evidence retained: $RUN_DIR"
  if [[ -n "$VALIDATOR_PID" && "${DOPPLER_KEEP_PREDICTION_VALIDATOR:-false}" == true ]]; then
    echo "Validator retained at http://127.0.0.1:$RPC_PORT (PID $VALIDATOR_PID; stop with kill $VALIDATOR_PID)"
  fi
  if [[ "$result" != 0 && -f "$RUN_DIR/validator.log" ]]; then tail -80 "$RUN_DIR/validator.log" >&2; fi
}
trap cleanup EXIT
for executable in solana solana-keygen solana-test-validator spl-token cargo cargo-build-sbf node; do
  command -v "$executable" >/dev/null || { echo "Required executable missing: $executable" >&2; exit 1; }
done
[[ "$(git -C "$SOURCE_DIR" rev-parse HEAD)" == "$EXPECTED_REVISION" ]] || {
  echo "Expected protocol revision $EXPECTED_REVISION in DOPPLER_SOL_SOURCE_DIR" >&2; exit 1;
}
[[ -z "$(git -C "$SOURCE_DIR" status --porcelain --untracked-files=no)" ]] || {
  echo 'Protocol source has tracked changes; use a clean checkout for reproducible verification.' >&2; exit 1;
}
cd "$ROOT_DIR"
# Always build: an arbitrary preexisting .so is not evidence for this source revision.
for manifest in programs/initializer programs/trusted_oracle programs/prediction_migrator programs/hooks/prediction_hook; do
  CARGO_TARGET_DIR="$BUILD_DIR" cargo build-sbf --tools-version v1.53 --arch v0 \
    --sbf-out-dir "$ARTIFACT_DIR" --manifest-path "$SOURCE_DIR/$manifest/Cargo.toml"
done
solana-keygen new --no-bip39-passphrase --silent --outfile "$RUN_DIR/payer.json"
PAYER="$(solana-keygen pubkey "$RUN_DIR/payer.json")"
export SOLANA_INITIALIZER_PROGRAM_ID=4h3Dqyo5qmteJoMxXt3tdtfXELDB6pdRTPU9mWruiKp1
export SOLANA_TRUSTED_ORACLE_PROGRAM_ID=HhUzN7VvonNUevATyugZUepzxpeEZMXQbV92X2xvsp5m
export SOLANA_PREDICTION_MIGRATOR_PROGRAM_ID=HYHdyy7QZg8Ucky9Z97xNtSCvrZxVNkeoney8xEPXjiZ
export SOLANA_PREDICTION_HOOK_PROGRAM_ID=7QcQDANJVC17Jgc6KjjeagSkm2zAphgHVPK5agJzyihB
node --input-type=module - "$ARTIFACT_DIR" "$RUN_DIR/artifacts.json" "$EXPECTED_REVISION" <<'JS'
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const [dir, out, revision] = process.argv.slice(2);
const artifacts = Object.fromEntries(['initializer', 'trusted_oracle', 'prediction_migrator', 'prediction_hook'].map(name => [name, createHash('sha256').update(readFileSync(`${dir}/${name}.so`)).digest('hex')]));
writeFileSync(out, JSON.stringify({ revision, compiler: 'v1.53', arch: 'v0', artifacts }, null, 2));
JS
solana-test-validator --reset --quiet --ledger "$RUN_DIR/ledger" --mint "$PAYER" \
  --rpc-port "$RPC_PORT" --faucet-port "$((RPC_PORT + 2))" --gossip-port "$((RPC_PORT + 3))" \
  --dynamic-port-range "$((RPC_PORT + 4))-$((RPC_PORT + 30))" \
  --upgradeable-program "$SOLANA_INITIALIZER_PROGRAM_ID" "$ARTIFACT_DIR/initializer.so" "$PAYER" \
  --bpf-program "$SOLANA_TRUSTED_ORACLE_PROGRAM_ID" "$ARTIFACT_DIR/trusted_oracle.so" \
  --bpf-program "$SOLANA_PREDICTION_MIGRATOR_PROGRAM_ID" "$ARTIFACT_DIR/prediction_migrator.so" \
  --bpf-program "$SOLANA_PREDICTION_HOOK_PROGRAM_ID" "$ARTIFACT_DIR/prediction_hook.so" \
  >"$RUN_DIR/validator.log" 2>&1 &
VALIDATOR_PID=$!
export SOLANA_NETWORK=custom SOLANA_RPC_URL="http://127.0.0.1:$RPC_PORT" SOLANA_WS_URL="ws://127.0.0.1:$((RPC_PORT + 1))" SOLANA_KEYPAIR_PATH="$RUN_DIR/payer.json"
ready=false
for _ in $(seq 1 90); do
  slot="$(solana slot --url "$SOLANA_RPC_URL" 2>/dev/null || true)"
  if [[ "$slot" =~ ^[0-9]+$ && "$slot" -ge 5 ]]; then ready=true; break; fi
  kill -0 "$VALIDATOR_PID" 2>/dev/null || { echo 'Validator exited early' >&2; exit 1; }
  sleep 1
done
[[ "$ready" == true ]] || { echo "Validator failed to produce slots before timeout" >&2; exit 1; }
solana cluster-version --url "$SOLANA_RPC_URL"
solana-keygen new --no-bip39-passphrase --silent --outfile "$RUN_DIR/second-creator.json"
SECOND_CREATOR="$(solana-keygen pubkey "$RUN_DIR/second-creator.json")"
solana airdrop 100 "$SECOND_CREATOR" --url "$SOLANA_RPC_URL"
export SOLANA_SECOND_CREATOR_KEYPAIR_PATH="$RUN_DIR/second-creator.json"
export SOLANA_PROBE_PAYER="$PAYER"
npx --yes pnpm@10.11.0 exec tsx scripts/check-prediction-deployment.ts | tee "$RUN_DIR/deployment-probe.log"
npx --yes pnpm@10.11.0 exec tsx scripts/setup-solana-prediction-validator.ts
# The creator beneficiary must differ from the protocol config admin.
solana-keygen new --no-bip39-passphrase --silent --outfile "$RUN_DIR/creator.json"
CREATOR="$(solana-keygen pubkey "$RUN_DIR/creator.json")"
solana airdrop 100 "$CREATOR" --url "$SOLANA_RPC_URL"
export SOLANA_KEYPAIR_PATH="$RUN_DIR/creator.json"
spl-token --url "$SOLANA_RPC_URL" --fee-payer "$SOLANA_KEYPAIR_PATH" --output json   create-token --owner "$SOLANA_KEYPAIR_PATH" --decimals 9 > "$RUN_DIR/quote-mint.json"
export SOLANA_SECOND_QUOTE_MINT="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).commandOutput.address)' "$RUN_DIR/quote-mint.json")"
spl-token --url "$SOLANA_RPC_URL" --fee-payer "$SOLANA_KEYPAIR_PATH" --output json   create-account "$SOLANA_SECOND_QUOTE_MINT" --owner "$SOLANA_KEYPAIR_PATH" > "$RUN_DIR/quote-account.json"
spl-token --url "$SOLANA_RPC_URL" --output json address --verbose   --token "$SOLANA_SECOND_QUOTE_MINT" --owner "$SOLANA_KEYPAIR_PATH" > "$RUN_DIR/quote-address.json"
QUOTE_ACCOUNT="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).associatedTokenAddress)' "$RUN_DIR/quote-address.json")"
spl-token --url "$SOLANA_RPC_URL" --fee-payer "$SOLANA_KEYPAIR_PATH"   mint "$SOLANA_SECOND_QUOTE_MINT" 100 "$QUOTE_ACCOUNT" --mint-authority "$SOLANA_KEYPAIR_PATH"
for scenario in binary multi eight shared incremental void; do
  npx --yes pnpm@10.11.0 exec tsx test/solana/integration/prediction/run.ts \
    --scenario "$scenario" --manifest "$RUN_DIR/$scenario.json" --action all \
    2>&1 | tee "$RUN_DIR/$scenario.log"
done
# Replaying a completed market must not register, rebuy, or settle it again.
SIGNATURE_COUNT_BEFORE="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).signatures.length)' "$RUN_DIR/binary.json")"
npx --yes pnpm@10.11.0 exec tsx test/solana/integration/prediction/run.ts   --scenario binary --manifest "$RUN_DIR/binary.json" --action all   2>&1 | tee "$RUN_DIR/binary-replay.log"
SIGNATURE_COUNT_AFTER="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).signatures.length)' "$RUN_DIR/binary.json")"
[[ "$SIGNATURE_COUNT_BEFORE" == "$SIGNATURE_COUNT_AFTER" ]] || {
  echo "Completed replay submitted additional transactions" >&2; exit 1;
}
echo "All prediction scenarios and completed replay assertions passed."
