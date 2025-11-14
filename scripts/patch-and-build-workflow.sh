#!/bin/bash
set -e

echo "Building @upstash/workflow from GitHub source..."

cd node_modules/@upstash/workflow

# Install dependencies
echo "Installing dependencies..."
bun install > /dev/null 2>&1

# Build the package (types build will fail but JS builds successfully)
echo "Building runtime code..."
bun run build 2>&1 | grep -v "DTS Build error" | grep -v "error: script" | grep -v "error occurred in dts build" || true

# Copy built runtime files to root
echo "Copying built runtime files..."
cp dist/*.js dist/*.mjs . 2>/dev/null || true

# Download published types (they're properly bundled)
echo "Downloading published types..."
curl -sL https://registry.npmjs.org/@upstash/workflow/-/workflow-0.2.21.tgz | tar -xz 2>/dev/null

# Copy type definitions from published package
echo "Copying type definitions..."
cp package/*.d.ts package/*.d.mts . 2>/dev/null || true

# Cleanup
rm -rf package

echo "✓ @upstash/workflow built with patched runtime + published types"
