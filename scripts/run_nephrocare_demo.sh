#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cleanup() {
  if [[ -n "${API_PID:-}" ]]; then
    kill "$API_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

cd "$ROOT"
.venv/bin/python api/nephrocare_api.py &
API_PID=$!

cd "$ROOT/frontend"
npm run dev -- --host 0.0.0.0 --port 5175
