#!/usr/bin/env bash
set -euo pipefail

failures=()

steps=("typecheck" "test" "build")

for step in "${steps[@]}"; do
  echo ""
  echo "=== Running: npm run $step ==="
  echo ""
  if npm run "$step"; then
    echo ""
    echo "  ✓ $step passed"
  else
    echo ""
    echo "  ✗ $step failed"
    failures+=("$step")
  fi
done

echo ""
echo "==============================="
echo "  Summary"
echo "==============================="

for step in "${steps[@]}"; do
  if printf '%s\n' "${failures[@]}" | grep -qx "$step" 2>/dev/null; then
    echo "  ✗ $step"
  else
    echo "  ✓ $step"
  fi
done

echo ""

if [ ${#failures[@]} -gt 0 ]; then
  echo "Skipping install — ${#failures[@]} step(s) failed: ${failures[*]}"
  exit 1
fi

echo "All checks passed. Installing globally..."
echo ""
npm install -g .
echo ""
echo "Done. $(node -e "console.log(require('./package.json').name + '@' + require('./package.json').version)") installed globally."
