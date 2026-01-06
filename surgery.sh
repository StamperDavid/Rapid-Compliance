#!/bin/bash
#############################################
# Pattern 1 Surgery - ESLint Auto-Fix
# Targets: no-explicit-any, unused-imports, no-unused-vars
#############################################

set -e

TARGET_DIR=${1:-"src"}

echo "🔧 Pattern 1 Surgery starting on: $TARGET_DIR"
echo "================================================"

# Pattern 1.1: Fix explicit 'any' types
echo "🩹 [1/3] Fixing @typescript-eslint/no-explicit-any..."
npx eslint "$TARGET_DIR/**/*.{ts,tsx}" \
  --rule '@typescript-eslint/no-explicit-any: error' \
  --fix \
  --no-error-on-unmatched-pattern \
  2>&1 | head -20

# Pattern 1.2: Remove unused imports
echo "🩹 [2/3] Removing unused imports..."
npx eslint "$TARGET_DIR/**/*.{ts,tsx}" \
  --rule 'unused-imports/no-unused-imports: error' \
  --fix \
  --no-error-on-unmatched-pattern \
  2>&1 | head -20

# Pattern 1.3: Remove unused variables
echo "🩹 [3/3] Removing unused variables..."
npx eslint "$TARGET_DIR/**/*.{ts,tsx}" \
  --rule '@typescript-eslint/no-unused-vars: error' \
  --fix \
  --no-error-on-unmatched-pattern \
  2>&1 | head -20

echo "✅ Pattern 1 Surgery complete on $TARGET_DIR"
echo "================================================"
