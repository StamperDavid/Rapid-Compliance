#!/bin/bash
# WORKER 1 AUTONOMOUS TYPESCRIPT FIXER
# This script walks through assigned files and applies fixes

set -e
cd ~/worktree-1

echo "========================================="
echo "WORKER 1 - AUTONOMOUS TYPESCRIPT FIXER"
echo "========================================="
echo ""
echo "Reading my assignment list..."
cat WORKER1_ASSIGNMENTS.txt
echo ""
echo "Reading fixing guide..."
echo ""

# File 1: proposal-generator.ts
echo "🔧 FILE 1/6: proposal-generator.ts"
echo "Getting errors..."
NODE_OPTIONS='--max-old-space-size=8192' npx tsc --noEmit 2>&1 | grep 'proposal-generator' | tee proposal-errors.txt

echo ""
echo "Analyzing error..."
cat proposal-errors.txt

echo ""
echo "Applying Pattern 6 fix (unknown to LogContext)..."
sed -i 's/logger.warn.*pdfError)/logger.warn('\''PDF generation failed, continuing without PDF'\'', pdfError as unknown)/g' src/lib/documents/proposal-generator.ts

echo ""
echo "Verifying fix..."
if NODE_OPTIONS='--max-old-space-size=8192' npx tsc --noEmit 2>&1 | grep 'proposal-generator' > /dev/null; then
  echo "❌ Still has errors - may need manual fix"
  NODE_OPTIONS='--max-old-space-size=8192' npx tsc --noEmit 2>&1 | grep 'proposal-generator'
else
  echo "✅ FIXED! Committing..."
  git add src/lib/documents/proposal-generator.ts
  git commit -m "[W1] Fix: Cast pdfError to unknown in proposal-generator"
fi

echo ""
echo "========================================="
echo "FILE 1 COMPLETE - Ready for file 2"
echo "========================================="
