#!/bin/bash

# Fix ESLint warnings in ecommerce directory
# This script applies targeted sed replacements to fix common patterns

cd "C:\Users\David\PycharmProjects\AI Sales Platform"

# Fix 1: Replace 'any' in function parameters with 'unknown'
find src/lib/ecommerce -name "*.ts" -exec sed -i 's/: any)/: unknown)/g' {} \;

# Fix 2: Replace 'Record<string, any>' with 'Record<string, unknown>'
find src/lib/ecommerce -name "*.ts" -exec sed -i 's/Record<string, any>/Record<string, unknown>/g' {} \;

# Fix 3: Replace 'as any' with proper type guards (will need manual review)
# This is too complex for sed, will handle manually

echo "Basic fixes applied. Running ESLint to check remaining issues..."
npx eslint "src/lib/ecommerce/**/*.ts"
