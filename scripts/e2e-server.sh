#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

anvil --host 127.0.0.1 --port 8545 --chain-id 19480 --silent &
anvil_pid=$!
cleanup() {
  kill "$anvil_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

for _ in $(seq 1 50); do
  if curl -sf -X POST http://127.0.0.1:8545 \
    -H 'content-type: application/json' \
    -d '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' | grep -q 0x4c18; then
    break
  fi
  sleep 0.1
done

export NEXT_PUBLIC_QMS_RPC_URL=http://127.0.0.1:8545
npx next dev --port 3456
