#!/usr/bin/env bash

# Fix zsh plugin issues

echo "🔧 Fixing zsh plugin configuration..."

# Remove problematic pnpm plugin since we're using corepack
if [ -f ~/.zsh_plugins.txt ]; then
    echo "📝 Updating plugin list..."
    grep -v "ohmyzsh/ohmyzsh path:plugins/pnpm" ~/.zsh_plugins.txt > ~/.zsh_plugins.txt.tmp
    mv ~/.zsh_plugins.txt.tmp ~/.zsh_plugins.txt
fi

# Regenerate plugin cache
if [ -d ~/.antidote ]; then
    echo "💊 Regenerating Antidote plugin cache..."
    source ${ZDOTDIR:-$HOME}/.antidote/antidote.zsh
    antidote bundle < ~/.zsh_plugins.txt > ~/.zsh_plugins.zsh || echo "⚠️  Some plugins couldn't load, but that's okay"
else
    echo "ℹ️  Antidote not installed, skipping plugin regeneration"
fi

# Update .zshrc to handle missing plugins gracefully
if ! grep -q "antidote load" ~/.zshrc 2>/dev/null; then
    echo "" >> ~/.zshrc
    echo "# Antidote plugin manager with error handling" >> ~/.zshrc
    echo "if [ -f \${ZDOTDIR:-\$HOME}/.antidote/antidote.zsh ]; then" >> ~/.zshrc
    echo "    source \${ZDOTDIR:-\$HOME}/.antidote/antidote.zsh" >> ~/.zshrc
    echo "    if [ -f ~/.zsh_plugins.txt ]; then" >> ~/.zshrc
    echo "        antidote load ~/.zsh_plugins.txt 2>/dev/null || true" >> ~/.zshrc
    echo "    fi" >> ~/.zshrc
    echo "fi" >> ~/.zshrc
fi

echo "✅ Zsh plugin configuration fixed!"
echo ""
echo "🔄 Please run: source ~/.zshrc"
echo "   Or start a new shell session"