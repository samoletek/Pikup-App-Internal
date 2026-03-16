#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

LEGACY_FILE="services/AIImageService.js"

if [ -f "$LEGACY_FILE" ]; then
  echo "[FAIL] Legacy AI service file still exists: $LEGACY_FILE"
  exit 1
fi

if rg --hidden --glob '!node_modules/**' --glob '!coverage/**' --glob '!*package-lock.json' --glob '!scripts/check_ai_entrypoint.sh' -n "AIImageService" components hooks screens services contexts config navigation constants utils; then
  echo "[FAIL] Found stale AIImageService references. Use services/AIService.js only."
  exit 1
fi

echo "[OK] Single AI entrypoint guard passed (services/AIService.js)."
