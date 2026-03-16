#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ALLOWLIST_REGEX='^services/(ai/aiJsonParser\.js|tripMapper\.js)$'

violations=()

while IFS= read -r file; do
  if [[ "$file" =~ ^services/repositories/ ]]; then
    continue
  fi

  if [[ "$file" =~ ^services/contracts/ ]]; then
    continue
  fi

  if [[ "$file" =~ $ALLOWLIST_REGEX ]]; then
    continue
  fi

  if ! rg -q "catch\\s*\\(" "$file"; then
    continue
  fi

  if ! rg -q "normalizeError|logFlowError" "$file"; then
    violations+=("$file")
  fi
done < <(rg --files services | rg '\.(js|ts)$')

if [ "${#violations[@]}" -gt 0 ]; then
  echo "[FAIL] Service catch blocks must normalize errors (normalizeError/logFlowError)."
  for file in "${violations[@]}"; do
    echo " - $file"
  done
  exit 1
fi

echo "[OK] Service error normalization check passed."
