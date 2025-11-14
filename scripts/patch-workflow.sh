#!/bin/bash
# Patch @upstash/workflow to fix express.ts type error

cd node_modules/@upstash/workflow || exit 1

# Fix express.ts serveMany return type
sed -i '' '102s/.*/export const serveMany = (/' platforms/express.ts
sed -i '' '103,104d' platforms/express.ts
sed -i '' '102a\
  workflows: Parameters<typeof serveManyBase>[0]["workflows"],\
  options?: Parameters<typeof serveManyBase>[0]["options"]\
): ReturnType<typeof Router> => {
' platforms/express.ts

echo "✓ Patched express.ts"
