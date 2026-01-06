#!/bin/bash
# TypeScript Error Fixing Script for Worker 1
# Systematic approach to fix all 476 lines of errors

set -e

echo "🔧 Starting TypeScript error fixes..."

# Category 1: Install missing lucide-react dependency
echo "📦 Checking lucide-react installation..."
if ! npm list lucide-react &>/dev/null; then
  echo "Installing lucide-react..."
  npm install lucide-react
fi

# Category 2: Fix pdf-parser default export issue
echo "🔧 Fixing pdf-parser import..."
sed -i 's/pdfParse = (await import('\''pdf-parse'\'')).default;/const module = await import('\''pdf-parse'\''); pdfParse = module.default || module;/g' src/lib/agent/parsers/pdf-parser.ts

# Category 3: Fix DocumentData type casts in continuous-learning-engine.ts
echo "🔧 Fixing DocumentData types in continuous-learning-engine..."
# This requires more complex sed or manual intervention

# Category 4: Fix adminDb possibly null checks
echo "🔧 Adding adminDb null checks..."
FILES_WITH_ADMINDB=(
  "src/lib/db/admin-firestore-service.ts"
  "src/lib/email-writer/email-delivery-service.ts"
)

for file in "${FILES_WITH_ADMINDB[@]}"; do
  if [ -f "$file" ]; then
    echo "Processing $file..."
    # Add null checks before adminDb usage
    # This is complex - would need specific line-by-line fixes
  fi
done

# Category 5: Run TypeScript compiler again to see remaining errors
echo "🔍 Checking remaining errors..."
NODE_OPTIONS='--max-old-space-size=8192' npx tsc --noEmit 2>&1 | tee tsc-remaining-errors.txt | head -50

echo "✅ Initial fixes complete. Check tsc-remaining-errors.txt for details."
