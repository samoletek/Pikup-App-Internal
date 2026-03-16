#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ui_violations=$(rg "from ['\"].*config/supabase|from ['\"].*supabase['\"]" hooks screens contexts components -n || true)
service_violations=$(rg "from ['\"].*config/supabase|from ['\"].*supabase['\"]" services -n -g '!services/repositories/**' || true)

if [ -n "$ui_violations" ]; then
  echo "[FAIL] Supabase boundary violations found in UI/hook layers:"
  echo "$ui_violations"
  exit 1
fi

if [ -n "$service_violations" ]; then
  echo "[FAIL] Supabase boundary violations found in service layer (outside repositories):"
  echo "$service_violations"
  exit 1
fi

echo "[OK] Supabase boundary check passed."
