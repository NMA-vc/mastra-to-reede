#!/usr/bin/env bash
# Start `reede serve`, run the Mastra agent against it, then check the sealed chain.
# Needs `reede` on PATH (or REEDE_BIN), built with the ingest feature, and Node 20+.
# REEDE_PORT overrides 4318.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
reede="${REEDE_BIN:-reede}"
port="${REEDE_PORT:-4318}"
work="${WORK_DIR:-$(mktemp -d)}"
out="$work/ingest"
mkdir -p "$work"

# Install into a scratch copy so this directory stays free of node_modules.
if [ ! -d "$work/app/node_modules" ]; then
  mkdir -p "$work/app"
  cp "$here/package.json" "$here/package-lock.json" "$here/agent.js" "$work/app/"
  (cd "$work/app" && npm install --silent --no-audit --no-fund)
fi

"$reede" serve --listen "127.0.0.1:$port" --out "$out" >"$work/serve.log" 2>&1 &
server=$!
trap 'kill "$server" 2>/dev/null || true' EXIT
for _ in $(seq 1 50); do
  grep -q "listening on" "$work/serve.log" 2>/dev/null && break
  kill -0 "$server" 2>/dev/null || { cat "$work/serve.log"; exit 1; }
  sleep 0.1
done

(cd "$work/app" && REEDE_OTLP_ENDPOINT="http://127.0.0.1:$port" node agent.js)
sleep 1
cat "$work/serve.log"
"$reede" ingest check --out "$out" --pubkey "$(cat "$out/pubkey.hex")"
"$reede" receipt verify --chain "$out/chain.json" --pubkey "$(cat "$out/pubkey.hex")"
echo "chain, span files and key are in $out"
