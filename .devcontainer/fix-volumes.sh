#!/bin/bash

# Fix Docker volume permissions for pnpm in devcontainer
set -e

echo "🔧 Fixing Docker volume permissions..."

# Create directories if they don't exist and fix ownership
sudo mkdir -p /workspaces/velro/node_modules /home/node/.local/share/pnpm

# Fix ownership of volumes 
echo "👤 Setting ownership to node user..."
sudo chown -R node:node /workspaces/velro/node_modules /home/node/.local/share/pnpm

# Ensure write permissions
echo "🔓 Setting write permissions..."
sudo chmod -R u+w /workspaces/velro/node_modules /home/node/.local/share/pnpm

# Set proper pnpm store permissions
echo "📦 Configuring pnpm store..."
sudo -u node mkdir -p /home/node/.local/share/pnpm/store

echo "✅ Volume permissions fixed successfully!"