#!/bin/bash
# Bypass Budget Ratchet
# Ensures eslint-disable comment counts only go DOWN, never UP.
# Compares current codebase counts against .eslint-bypass-budget.json

BUDGET_FILE=".eslint-bypass-budget.json"

if [ ! -f "$BUDGET_FILE" ]; then
  echo "⚠️  No bypass budget file found. Skipping ratchet check."
  exit 0
fi

FAILED=0
CURRENT_TOTAL=$(grep -rc "eslint-disable" src/ --include="*.tsx" --include="*.ts" 2>/dev/null | grep -v ":0$" | awk -F: '{sum+=$2} END {print sum+0}')
BUDGET_TOTAL=$(node -e "console.log(require('./$BUDGET_FILE')._total)")

if [ "$CURRENT_TOTAL" -gt "$BUDGET_TOTAL" ]; then
  echo "❌ Bypass budget exceeded! Current: $CURRENT_TOTAL, Budget: $BUDGET_TOTAL"
  echo "   You added new eslint-disable comments. Remove them and fix the underlying code."
  FAILED=1
else
  echo "✅ Bypass ratchet OK ($CURRENT_TOTAL/$BUDGET_TOTAL)"
fi

exit $FAILED
