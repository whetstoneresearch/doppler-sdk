#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MAINNET_RPC_URL="${SOLANA_MAINNET_RPC_URL:-https://api.mainnet-beta.solana.com}"
RPC_PORT="${DOPPLER_LOCAL_RPC_PORT:-18899}"
RPC_URL="http://127.0.0.1:${RPC_PORT}"
WS_URL="ws://127.0.0.1:$((RPC_PORT + 1))"
RUN_DIR="$(mktemp -d "${TMPDIR:-/tmp}/doppler-sdk-mainnet-fork.XXXXXX")"
LEDGER_DIR="$RUN_DIR/ledger"
VALIDATOR_LOG="$RUN_DIR/validator.log"
PAYER_KEYPAIR="$RUN_DIR/payer.json"
COSIGNER_KEYPAIR="$RUN_DIR/cosigner.json"
HOOK_CONFIG_FIXTURE="$RUN_DIR/hook-config.json"
FORK_MANIFEST="$RUN_DIR/fork-manifest.json"
VALIDATOR_PID=""

cleanup() {
  local exit_code="$?"

  if [[ -n "$VALIDATOR_PID" ]] && kill -0 "$VALIDATOR_PID" >/dev/null 2>&1; then
    kill "$VALIDATOR_PID" >/dev/null 2>&1 || true
    wait "$VALIDATOR_PID" >/dev/null 2>&1 || true
  fi

  if [[ "$exit_code" -ne 0 ]] && [[ -f "$VALIDATOR_LOG" ]]; then
    echo "Validator log tail:" >&2
    tail -100 "$VALIDATOR_LOG" >&2 || true
  fi

  if [[ "${DOPPLER_KEEP_FORK_ARTIFACTS:-false}" == "true" ]]; then
    echo "Fork artifacts retained at $RUN_DIR"
  else
    rm -rf "$RUN_DIR"
  fi
}
trap cleanup EXIT

for command in solana solana-keygen solana-test-validator; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Required command not found: $command" >&2
    exit 1
  fi
done

solana-keygen new \
  --no-bip39-passphrase \
  --silent \
  --outfile "$PAYER_KEYPAIR"
solana-keygen new \
  --no-bip39-passphrase \
  --silent \
  --outfile "$COSIGNER_KEYPAIR"

PAYER_ADDRESS="$(solana-keygen pubkey "$PAYER_KEYPAIR")"
COSIGNER_ADDRESS="$(solana-keygen pubkey "$COSIGNER_KEYPAIR")"

cd "$ROOT_DIR"
pnpm exec tsx scripts/prepare-solana-mainnet-fork.ts \
  --rpc-url "$MAINNET_RPC_URL" \
  --cosigner "$COSIGNER_ADDRESS" \
  --account-output "$HOOK_CONFIG_FIXTURE" \
  --manifest-output "$FORK_MANIFEST"

read_manifest() {
  node -e '
    const fs = require("node:fs");
    const manifest = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const value = process.argv[2]
      .split(".")
      .reduce((current, key) => current[key], manifest);
    process.stdout.write(String(value));
  ' "$FORK_MANIFEST" "$1"
}

CPMM_PROGRAM="$(read_manifest programs.cpmmProgram)"
INITIALIZER_PROGRAM="$(read_manifest programs.initializerProgram)"
CPMM_MIGRATOR_PROGRAM="$(read_manifest programs.cpmmMigratorProgram)"
LAUNCH_HOOK_PROGRAM="$(read_manifest programs.dopplerLaunchHookV1Program)"
TOKEN_METADATA_PROGRAM="$(read_manifest programs.tokenMetadataProgram)"
CPMM_CONFIG="$(read_manifest accounts.cpmmConfig)"
INITIALIZER_CONFIG="$(read_manifest accounts.initializerConfig)"
HOOK_CONFIG="$(read_manifest accounts.hookConfig)"

validator_args=(
  --ledger "$LEDGER_DIR"
  --reset
  --quiet
  --url "$MAINNET_RPC_URL"
  --clone-feature-set
  --mint "$PAYER_ADDRESS"
  --rpc-port "$RPC_PORT"
  --log-messages-bytes-limit 100000000
  --clone-upgradeable-program "$CPMM_PROGRAM"
  --clone-upgradeable-program "$INITIALIZER_PROGRAM"
  --clone-upgradeable-program "$CPMM_MIGRATOR_PROGRAM"
  --clone-upgradeable-program "$LAUNCH_HOOK_PROGRAM"
  --clone-upgradeable-program "$TOKEN_METADATA_PROGRAM"
  --clone "$CPMM_CONFIG"
  --clone "$INITIALIZER_CONFIG"
  --account "$HOOK_CONFIG" "$HOOK_CONFIG_FIXTURE"
)

echo "Starting disposable mainnet fork at $RPC_URL"
solana-test-validator "${validator_args[@]}" >"$VALIDATOR_LOG" 2>&1 &
VALIDATOR_PID="$!"

for _ in $(seq 1 180); do
  if solana cluster-version --url "$RPC_URL" >/dev/null 2>&1; then
    break
  fi
  if ! kill -0 "$VALIDATOR_PID" >/dev/null 2>&1; then
    echo "Local validator exited early" >&2
    exit 1
  fi
  sleep 1
done

if ! solana cluster-version --url "$RPC_URL" >/dev/null 2>&1; then
  echo "Timed out waiting for local validator" >&2
  exit 1
fi

export SOLANA_NETWORK=custom
export SOLANA_RPC_URL="$RPC_URL"
export SOLANA_WS_URL="$WS_URL"
export SOLANA_KEYPAIR_PATH="$PAYER_KEYPAIR"
export COSIGNER_KEYPAIR_PATH="$COSIGNER_KEYPAIR"
export SOLANA_CPMM_PROGRAM_ID="$CPMM_PROGRAM"
export SOLANA_INITIALIZER_PROGRAM_ID="$INITIALIZER_PROGRAM"
export SOLANA_CPMM_MIGRATOR_PROGRAM_ID="$CPMM_MIGRATOR_PROGRAM"
export SOLANA_DOPPLER_LAUNCH_HOOK_V1_PROGRAM_ID="$LAUNCH_HOOK_PROGRAM"
export SOL_PRICE_USD="${SOL_PRICE_USD:-150}"
export SOLANA_COSIGNER_BUY_AMOUNT_SOL="${SOLANA_COSIGNER_BUY_AMOUNT_SOL:-0.2}"
export SOLANA_FEE_BENEFICIARY_1_WALLET="${SOLANA_FEE_BENEFICIARY_1_WALLET:-$PAYER_ADDRESS}"
export SOLANA_FEE_BENEFICIARY_1_BASE_AMOUNT="${SOLANA_FEE_BENEFICIARY_1_BASE_AMOUNT:-140000000}"
export SOLANA_FEE_BENEFICIARY_1_SHARE_BPS="${SOLANA_FEE_BENEFICIARY_1_SHARE_BPS:-7000}"
export SOLANA_FEE_BENEFICIARY_2_WALLET="${SOLANA_FEE_BENEFICIARY_2_WALLET:-$COSIGNER_ADDRESS}"
export SOLANA_FEE_BENEFICIARY_2_BASE_AMOUNT="${SOLANA_FEE_BENEFICIARY_2_BASE_AMOUNT:-60000000}"
export SOLANA_FEE_BENEFICIARY_2_SHARE_BPS="${SOLANA_FEE_BENEFICIARY_2_SHARE_BPS:-3000}"

echo "Running dynamic-fee launch example"
pnpm exec tsx examples/solana-dynamic-fee-launch.ts

echo
echo "Running managed-cosigner launch example"
pnpm exec tsx examples/solana-cosigner-gated-buy.ts
