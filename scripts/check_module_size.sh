#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

WARN_LIMIT=350
FAIL_LIMIT=450

TARGET_DIRS=(components hooks services screens contexts)
EXCLUDE_PATTERN='\.styles\.|/styles\.js$|\.constants\.|\.utils\.|\.mock\.'

warning_count=0
error_count=0

while IFS= read -r file; do
  lines=$(wc -l < "$file")

  if [ "$lines" -gt "$FAIL_LIMIT" ]; then
    echo "[FAIL] $file has $lines lines (limit: $FAIL_LIMIT)"
    error_count=$((error_count + 1))
  elif [ "$lines" -gt "$WARN_LIMIT" ]; then
    echo "[WARN] $file has $lines lines (warn threshold: $WARN_LIMIT)"
    warning_count=$((warning_count + 1))
  fi
done < <(rg --files "${TARGET_DIRS[@]}" | rg -v "$EXCLUDE_PATTERN")

echo "Module size check summary: warnings=$warning_count errors=$error_count"

if [ "$error_count" -gt 0 ]; then
  exit 1
fi
