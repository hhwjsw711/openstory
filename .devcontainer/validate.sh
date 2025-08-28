#!/bin/bash

# Velro Development Container Validation Script
# Run this script to check if your devcontainer setup is ready

set -e

echo "🔍 Validating Velro devcontainer setup..."

# Check if required files exist
echo "📁 Checking required files..."
required_files=(
    "package.json"
    ".devcontainer/devcontainer.json"
    ".devcontainer/setup.sh"
)

for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file exists"
    else
        echo "❌ $file is missing"
        exit 1
    fi
done

# Check Docker availability
echo "🐳 Checking Docker..."
if command -v docker >/dev/null 2>&1; then
    echo "✅ Docker is available"
    if docker info >/dev/null 2>&1; then
        echo "✅ Docker daemon is running"
    else
        echo "❌ Docker daemon is not running"
        exit 1
    fi
else
    echo "❌ Docker is not installed"
    exit 1
fi

# Validate package.json has required dependencies
echo "📦 Checking package.json dependencies..."
if grep -q "\"react\":" package.json && grep -q "\"react-dom\":" package.json; then
    echo "✅ React dependencies found"
else
    echo "❌ Missing React dependencies in package.json"
    exit 1
fi

if grep -q "\"next\":" package.json; then
    echo "✅ Next.js dependency found"
else
    echo "❌ Missing Next.js dependency in package.json"
    exit 1
fi

# Check if setup script is executable
echo "🔧 Checking setup script permissions..."
if [ -x ".devcontainer/setup.sh" ]; then
    echo "✅ setup.sh is executable"
else
    echo "❌ setup.sh is not executable (run: chmod +x .devcontainer/setup.sh)"
    exit 1
fi

# Validate devcontainer.json syntax
echo "📄 Validating devcontainer.json syntax..."
if command -v jq >/dev/null 2>&1; then
    if jq empty .devcontainer/devcontainer.json >/dev/null 2>&1; then
        echo "✅ devcontainer.json is valid JSON"
    else
        echo "❌ devcontainer.json has invalid JSON syntax"
        exit 1
    fi
else
    echo "⚠️  Cannot validate JSON syntax (jq not installed)"
fi

# Check VS Code extension
echo "💻 Checking VS Code Dev Containers extension..."
if command -v code >/dev/null 2>&1; then
    echo "✅ VS Code CLI is available"
    echo "   Make sure you have the 'Dev Containers' extension installed"
else
    echo "⚠️  VS Code CLI not found (install VS Code or add to PATH)"
fi

echo ""
echo "🎉 Validation complete!"
echo ""
echo "📋 Next steps:"
echo "1. Open VS Code in this directory: code ."
echo "2. Press Cmd+Shift+P (Mac) or Ctrl+Shift+P (Windows/Linux)"
echo "3. Type 'Dev Containers: Reopen in Container'"
echo "4. Wait for the container to build and setup (~2-3 minutes)"
echo "5. Run 'dev' to start the Next.js development server"
echo ""
echo "🚨 If you encounter issues:"
echo "- Check Docker has 4GB+ RAM allocated"
echo "- Ensure 10GB+ free disk space"
echo "- Try 'Dev Containers: Rebuild Container' if needed"