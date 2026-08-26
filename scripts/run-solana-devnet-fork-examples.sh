#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEVNET_RPC_URL="${SOLANA_DEVNET_RPC_URL:-https://api.devnet.solana.com}"
RPC_PORT="${DOPPLER_LOCAL_DEVNET_RPC_PORT:-18909}"
RPC_URL="http://127.0.0.1:${RPC_PORT}"
WS_URL="ws://127.0.0.1:$((RPC_PORT + 1))"
RUN_DIR="$(mktemp -d "${TMPDIR:-/tmp}/doppler-sdk-devnet-fork.XXXXXX")"
LEDGER_DIR="$RUN_DIR/ledger"
VALIDATOR_LOG="$RUN_DIR/validator.log"
PAYER_KEYPAIR="$RUN_DIR/payer.json"
FORK_MANIFEST="$RUN_DIR/fork-manifest.json"
FEE_STATE="$RUN_DIR/fee-state.json"
VESTING_STATE="$RUN_DIR/vesting-state.json"
VALIDATOR_PID=""
RUN_REHYPOTHECATION_EXAMPLES="${SOLANA_RUN_DEVNET_REHYPOTHECATION_EXAMPLES:-false}"

if [[ "$RUN_REHYPOTHECATION_EXAMPLES" != "true" ]] && \
  [[ "$RUN_REHYPOTHECATION_EXAMPLES" != "false" ]]; then
  echo "SOLANA_RUN_DEVNET_REHYPOTHECATION_EXAMPLES must be true or false" >&2
  exit 1
fi

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
pnpm exec tsx scripts/prepare-solana-devnet-fork.ts \
  --manifest-output "$FORK_MANIFEST"

read_json() {
  node -e '
    const fs = require("node:fs");
    const document = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const value = process.argv[2]
      .split(".")
      .reduce((current, key) => current[key], document);
    process.stdout.write(String(value));
  ' "$1" "$2"
}

CPMM_PROGRAM="$(read_json "$FORK_MANIFEST" programs.cpmmProgram)"
INITIALIZER_PROGRAM="$(read_json "$FORK_MANIFEST" programs.initializerProgram)"
CPMM_MIGRATOR_PROGRAM="$(read_json "$FORK_MANIFEST" programs.cpmmMigratorProgram)"
LAUNCH_HOOK_V1_PROGRAM="$(read_json "$FORK_MANIFEST" programs.dopplerLaunchHookV1Program)"
LAUNCH_HOOK_V2_PROGRAM="$(read_json "$FORK_MANIFEST" programs.dopplerLaunchHookV2Program)"
REHYPE_ROUTER_PROGRAM="$(read_json "$FORK_MANIFEST" programs.dopplerRehypeRouterV1Program)"
VESTING_PROGRAM="$(read_json "$FORK_MANIFEST" programs.dopplerVestingProgram)"
TOKEN_METADATA_PROGRAM="$(read_json "$FORK_MANIFEST" programs.tokenMetadataProgram)"
CPMM_CONFIG="$(read_json "$FORK_MANIFEST" accounts.cpmmConfig)"
INITIALIZER_CONFIG="$(read_json "$FORK_MANIFEST" accounts.initializerConfig)"
HOOK_CONFIG="$(read_json "$FORK_MANIFEST" accounts.dopplerLaunchHookV2Config)"

validator_args=(
  --ledger "$LEDGER_DIR"
  --reset
  --quiet
  --url "$DEVNET_RPC_URL"
  --clone-feature-set
  --mint "$PAYER_ADDRESS"
  --rpc-port "$RPC_PORT"
  --log-messages-bytes-limit 100000000
  --clone-upgradeable-program "$CPMM_PROGRAM"
  --clone-upgradeable-program "$INITIALIZER_PROGRAM"
  --clone-upgradeable-program "$CPMM_MIGRATOR_PROGRAM"
  --clone-upgradeable-program "$LAUNCH_HOOK_V2_PROGRAM"
  --clone-upgradeable-program "$REHYPE_ROUTER_PROGRAM"
  --clone-upgradeable-program "$VESTING_PROGRAM"
  --clone-upgradeable-program "$TOKEN_METADATA_PROGRAM"
  --clone "$CPMM_CONFIG"
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
export SOLANA_CPMM_PROGRAM_ID="$CPMM_PROGRAM"
export SOLANA_INITIALIZER_PROGRAM_ID="$INITIALIZER_PROGRAM"
export SOLANA_CPMM_MIGRATOR_PROGRAM_ID="$CPMM_MIGRATOR_PROGRAM"
export SOLANA_DOPPLER_LAUNCH_HOOK_V1_PROGRAM_ID="$LAUNCH_HOOK_V1_PROGRAM"
export SOLANA_DOPPLER_LAUNCH_HOOK_V2_PROGRAM_ID="$LAUNCH_HOOK_V2_PROGRAM"
export SOLANA_DOPPLER_REHYPE_ROUTER_V1_PROGRAM_ID="$REHYPE_ROUTER_PROGRAM"
export SOLANA_VESTING_PROGRAM_ID="$VESTING_PROGRAM"

echo
echo "Running examples/solana-vesting-launch.ts"
export SOLANA_VESTING_CLIFF_SECONDS=0
export SOLANA_VESTING_DURATION_SECONDS=0
export SOLANA_VESTING_STATE_OUTPUT="$VESTING_STATE"
pnpm exec tsx examples/solana-vesting-launch.ts

export SOLANA_VESTING_LAUNCH="$(read_json "$VESTING_STATE" launch)"
export SOLANA_VESTING_BASE_MINT="$(read_json "$VESTING_STATE" baseMint)"

echo
echo "Running examples/solana-vesting-claim.ts"
pnpm exec tsx examples/solana-vesting-claim.ts

echo
echo "Running examples/solana-create-spot-pool.ts"
export SPOT_POOL_BASE_MINT="$SOLANA_VESTING_BASE_MINT"
export SPOT_POOL_BASE_AMOUNT="${SPOT_POOL_BASE_AMOUNT:-1000000}"
export SPOT_POOL_QUOTE_AMOUNT_LAMPORTS="${SPOT_POOL_QUOTE_AMOUNT_LAMPORTS:-10000000}"
pnpm exec tsx examples/solana-create-spot-pool.ts

if [[ "$RUN_REHYPOTHECATION_EXAMPLES" == "true" ]]; then
  echo
  echo "Running examples/solana-fee-rehypothecation-launch.ts"
  export SOLANA_FEE_REHYPOTHECATION_STRATEGY="${SOLANA_FEE_REHYPOTHECATION_STRATEGY:-numeraire}"
  export SOLANA_FEE_REHYPOTHECATION_SETTLE_AND_CLAIM=false
  export SOLANA_FEE_REHYPOTHECATION_STATE_OUTPUT="$FEE_STATE"
  pnpm exec tsx examples/solana-fee-rehypothecation-launch.ts

  export SOLANA_LAUNCH="$(read_json "$FEE_STATE" launch)"
  export SOLANA_BASE_MINT="$(read_json "$FEE_STATE" baseMint)"

  echo
  echo "Running examples/solana-fee-rehypothecation-settle-and-claim.ts"
  pnpm exec tsx examples/solana-fee-rehypothecation-settle-and-claim.ts
else
  echo
  echo "Skipping fee-rehypothecation examples until the current router ABI is deployed to devnet"
fi
