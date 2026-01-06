#!/bin/bash
# Worker 1: Fix src/lib TypeScript errors

echo "🔧 Worker 1: Fixing src/lib TypeScript errors"

# Get list of files with errors in src/lib
NODE_OPTIONS='--max-old-space-size=8192' npx tsc --noEmit 2>&1 | grep 'src/lib' | cut -d'(' -f1 | sort -u > lib-files-with-errors.txt

echo "📋 Files to fix:"
cat lib-files-with-errors.txt

# Fix pdf-parser (known fix)
echo ""
echo "🔧 Fixing pdf-parser.ts..."
sed -i "s/pdfParse = (await import('pdf-parse')).default;/const module = await import('pdf-parse'); pdfParse = module.default || module;/" src/lib/agent/parsers/pdf-parser.ts

# TODO: Add more automated fixes here based on error patterns

echo "✅ Worker 1 fixes applied"
echo "📊 Remaining errors in src/lib:"
NODE_OPTIONS='--max-old-space-size=8192' npx tsc --noEmit 2>&1 | grep -c 'src/lib' || true
