#!/bin/bash
# Worker 1: Fix case declaration errors
set -e
cd /root/worktree-1
export NODE_OPTIONS=--max-old-space-size=4096

echo "Fixing case block declarations..."

# Fix src/components/website-builder/ResponsiveRenderer.tsx
if [ -f "src/components/website-builder/ResponsiveRenderer.tsx" ]; then
  npx eslint src/components/website-builder/ResponsiveRenderer.tsx --quiet --format=compact || true
  echo "ResponsiveRenderer.tsx needs manual case block wrapping"
fi

# Fix src/components/website-builder/WidgetRenderer.tsx  
if [ -f "src/components/website-builder/WidgetRenderer.tsx" ]; then
  npx eslint src/components/website-builder/WidgetRenderer.tsx --quiet --format=compact || true
  echo "WidgetRenderer.tsx needs manual case block wrapping"
fi

# Fix src/lib/enrichment/validation-service.ts
if [ -f "src/lib/enrichment/validation-service.ts" ]; then
  npx eslint src/lib/enrichment/validation-service.ts --quiet --format=compact || true
  echo "validation-service.ts needs manual case block wrapping"
fi

# Fix src/lib/conversation/conversation-engine.ts (5 errors)
if [ -f "src/lib/conversation/conversation-engine.ts" ]; then
  npx eslint src/lib/conversation/conversation-engine.ts --quiet --format=compact || true
fi

# Fix src/lib/integrations/oauth-service.ts (5 errors)
if [ -f "src/lib/integrations/oauth-service.ts" ]; then
  npx eslint src/lib/integrations/oauth-service.ts --quiet --format=compact || true
fi

# Fix src/lib/integrations/payment/square.ts (4 errors)
if [ -f "src/lib/integrations/payment/square.ts" ]; then
  npx eslint src/lib/integrations/payment/square.ts --quiet --format=compact || true
fi

echo "Analysis complete. Ready for manual fixes."
