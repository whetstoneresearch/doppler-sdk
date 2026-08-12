#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEVNET_RPC_URL="${SOLANA_DEVNET_RPC_URL:-https://api.devnet.solana.com}"
RPC_PORT="${DOPPLER_LOCAL_REHYPE_RPC_PORT:-18909}"
RPC_URL="http://127.0.0.1:${RPC_PORT}"
WS_URL="ws://127.0.0.1:$((RPC_PORT + 1))"
RUN_DIR="$(mktemp -d "${TMPDIR:-/tmp}/doppler-sdk-devnet-rehype.XXXXXX")"
LEDGER_DIR="$RUN_DIR/ledger"
VALIDATOR_LOG="$RUN_DIR/validator.log"
PAYER_KEYPAIR="$RUN_DIR/payer.json"
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
PAYER_ADDRESS="$(solana-keygen pubkey "$PAYER_KEYPAIR")"

cd "$ROOT_DIR"
pnpm exec tsx scripts/prepare-solana-devnet-rehypothecation-fork.ts \
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

INITIALIZER_PROGRAM="$(read_manifest programs.initializerProgram)"
LAUNCH_HOOK_PROGRAM="$(read_manifest programs.dopplerLaunchHookV2Program)"
REHYPE_ROUTER_PROGRAM="$(read_manifest programs.dopplerRehypeRouterV1Program)"
TOKEN_METADATA_PROGRAM="$(read_manifest programs.tokenMetadataProgram)"
INITIALIZER_CONFIG="$(read_manifest accounts.initializerConfig)"
HOOK_CONFIG="$(read_manifest accounts.dopplerLaunchHookV2Config)"

validator_args=(
  --ledger "$LEDGER_DIR"
  --reset
  --quiet
  --url "$DEVNET_RPC_URL"
  --clone-feature-set
  --mint "$PAYER_ADDRESS"
  --rpc-port "$RPC_PORT"
  --log-messages-bytes-limit 100000000
  --clone-upgradeable-program "$INITIALIZER_PROGRAM"
  --clone-upgradeable-program "$LAUNCH_HOOK_PROGRAM"
  --clone-upgradeable-program "$REHYPE_ROUTER_PROGRAM"
  --clone-upgradeable-program "$TOKEN_METADATA_PROGRAM"
  --clone "$INITIALIZER_CONFIG"
  --clone "$HOOK_CONFIG"
)

echo "Starting disposable devnet fork at $RPC_URL"
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
export SOLANA_INITIALIZER_PROGRAM_ID="$INITIALIZER_PROGRAM"
export SOLANA_DOPPLER_LAUNCH_HOOK_V2_PROGRAM_ID="$LAUNCH_HOOK_PROGRAM"
export SOLANA_DOPPLER_REHYPE_ROUTER_V1_PROGRAM_ID="$REHYPE_ROUTER_PROGRAM"
export SOLANA_FEE_REHYPOTHECATION_STRATEGY="${SOLANA_FEE_REHYPOTHECATION_STRATEGY:-numeraire}"

pnpm exec tsx examples/solana-fee-rehypothecation-launch.ts
