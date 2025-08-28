#!/usr/bin/env bash

# Fix permissions for pnpm in dev container using pnpm Docker best practices
# Based on https://pnpm.io/docker

set -e

echo "🔧 Fixing permissions using pnpm Docker best practices..."

# Ensure we're in the project directory
cd /workspaces/velro || {
    echo "❌ Error: /workspaces/velro not found"
    exit 1
}

# Enable corepack for proper pnpm management (requires sudo)
echo "📦 Enabling corepack for pnpm management..."
sudo corepack enable
sudo corepack prepare pnpm@latest --activate

# Set up pnpm store in container-friendly location
echo "📁 Setting up pnpm store directory..."
export PNPM_HOME="/pnpm"
export PATH="$PNPM_HOME:$PATH"

# Create pnpm directories with correct permissions
sudo mkdir -p /pnpm/store
sudo chown -R node:node /pnpm

# Fix ownership of workspace files we need to modify (node_modules, package files, etc)
echo "📁 Fixing workspace permissions for pnpm..."
# Only fix directories and files that pnpm needs to modify
for item in node_modules package.json pnpm-lock.yaml .npmrc; do
    if [ -e "/workspaces/velro/$item" ]; then
        sudo chown -R node:node "/workspaces/velro/$item" 2>/dev/null || true
    fi
done

# Create node_modules if it doesn't exist
mkdir -p /workspaces/velro/node_modules
sudo chown -R node:node /workspaces/velro/node_modules

# Configure pnpm to use the container store
echo "⚙️ Configuring pnpm store location..."
pnpm config set store-dir /pnpm/store

# Clear any existing problematic cache
echo "🗑️ Clearing old pnpm cache..."
rm -rf node_modules/.pnpm 2>/dev/null || true
rm -rf node_modules 2>/dev/null || true
pnpm store prune || true

# Install dependencies with proper store location
echo "📦 Installing dependencies..."
pnpm install

echo "✅ Permissions fixed using pnpm Docker best practices!"
echo ""
echo "🚀 Configuration:"
echo "  PNPM_HOME: /pnpm"
echo "  Store location: /pnpm/store"
echo "  Corepack: Enabled"
echo ""
echo "You can now run:"
echo "  pnpm dev        # Start development server"
echo "  pnpm build      # Build the project"