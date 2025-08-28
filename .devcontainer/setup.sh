#!/usr/bin/env zsh

# Velro Development Container Setup Script
# This script sets up the development environment with all necessary tools

set -e  # Exit on error
set -u  # Exit on undefined variable
set -o pipefail  # Exit on pipe failure

echo "🚀 Setting up Velro development environment..."

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to install with error handling
install_tool() {
    local tool_name="$1"
    local install_command="$2"
    
    echo "🔧 Installing $tool_name..."
    if eval "$install_command"; then
        echo "✅ $tool_name installed successfully"
    else
        echo "⚠️  Warning: Failed to install $tool_name, continuing..."
    fi
}

# Note: System packages already installed in base container
echo "📦 Base packages already available in container..."

# Install Starship prompt
if ! command_exists starship; then
    install_tool "Starship prompt" "curl -sS https://starship.rs/install.sh | sh -s -- -y"
    echo 'eval "$(starship init zsh)"' >> ~/.zshrc
else
    echo "⭐ Starship already installed"
fi

# Install Antidote (zsh plugin manager)
if [ ! -d "${ZDOTDIR:-$HOME}/.antidote" ]; then
    install_tool "Antidote zsh plugin manager" "git clone --depth=1 https://github.com/mattmc3/antidote.git ${ZDOTDIR:-$HOME}/.antidote"
else
    echo "💊 Antidote already installed"
fi

# Create antidote plugins file
cat > ~/.zsh_plugins.txt << 'EOF'
# Essential zsh plugins for development
zsh-users/zsh-syntax-highlighting
zsh-users/zsh-autosuggestions
zsh-users/zsh-completions
zsh-users/zsh-history-substring-search

# Git integration
ohmyzsh/ohmyzsh path:plugins/git
ohmyzsh/ohmyzsh path:plugins/gitignore

# Node.js and development
ohmyzsh/ohmyzsh path:plugins/node
ohmyzsh/ohmyzsh path:plugins/nvm

# Additional productivity plugins
ohmyzsh/ohmyzsh path:plugins/colored-man-pages
ohmyzsh/ohmyzsh path:plugins/command-not-found
ohmyzsh/ohmyzsh path:plugins/sudo
EOF

# Setup antidote in .zshrc
cat >> ~/.zshrc << 'EOF'

# Antidote plugin manager
source ${ZDOTDIR:-$HOME}/.antidote/antidote.zsh
antidote load ${ZDOTDIR:-$HOME}/.zsh_plugins.txt
EOF

# Generate the static plugin file
echo "💊 Generating Antidote plugin cache..."
source ${ZDOTDIR:-$HOME}/.antidote/antidote.zsh
antidote bundle < ~/.zsh_plugins.txt > ~/.zsh_plugins.zsh || echo "⚠️  Plugin generation had issues, continuing..."

# Setup pnpm using Docker best practices
echo "📁 Setting up pnpm with Docker best practices..."
export PNPM_HOME="/pnpm"
export PATH="$PNPM_HOME:$PATH"

# Set SHELL environment variable for pnpm
export SHELL="/bin/zsh"

# Configure pnpm store location (following Docker best practices)
pnpm config set store-dir /pnpm/store
# Set global directory to match the store location
pnpm config set global-dir /pnpm/global
pnpm config set global-bin-dir /pnpm

# Add to shell configuration if not already present
if ! grep -q "PNPM_HOME" ~/.zshrc 2>/dev/null; then
    echo '' >> ~/.zshrc
    echo '# pnpm configuration (Docker best practices)' >> ~/.zshrc
    echo 'export PNPM_HOME="/pnpm"' >> ~/.zshrc
    echo 'export PATH="$PNPM_HOME:$PATH"' >> ~/.zshrc
fi

# Also add to bashrc for compatibility
if ! grep -q "PNPM_HOME" ~/.bashrc 2>/dev/null; then
    echo '' >> ~/.bashrc
    echo '# pnpm configuration (Docker best practices)' >> ~/.bashrc
    echo 'export PNPM_HOME="/pnpm"' >> ~/.bashrc
    echo 'export PATH="$PNPM_HOME:$PATH"' >> ~/.bashrc
fi

# Claude CLI installation
pnpm add -g @anthropic-ai/claude-code@latest

# Install Vercel CLI
if ! command_exists vercel; then
    echo "🚀 Installing Vercel CLI globally..."
    pnpm add -g vercel@latest
    
    # Verify installation
    if command_exists vercel; then
        echo "✅ Vercel CLI installed successfully"
        vercel --version
    else
        echo "⚠️  Vercel CLI installation completed but command not found"
        echo "   You may need to restart your shell or run: source ~/.zshrc"
    fi
else
    echo "🚀 Vercel CLI already installed"
    vercel --version
fi

# Note: Supabase CLI will be run using pnpx instead of global installation
echo "🗄️ Supabase CLI will be accessed via pnpx"
echo "   Use 'pnpx supabase' to run Supabase commands"

# Note: QStash CLI will be run using pnpx instead of global installation
echo "📬 QStash CLI will be accessed via pnpx"
echo "   Use 'pnpx @upstash/qstash-cli' to run QStash commands"

# Note: GitHub CLI is already installed via devcontainer feature
# Configure GitHub CLI with helpful settings
echo "🐙 Configuring GitHub CLI..."
gh config set git_protocol https
gh config set editor code
gh config set prompt enabled


# Verify project setup
echo "📁 Verifying project setup..."
cd /workspaces/velro

# Verify we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found in /workspaces/velro"
    exit 1
fi

# Check if node_modules exists (should have been installed in onCreateCommand)
if [ -d "node_modules" ]; then
    echo "✅ Project dependencies already installed"
else
    echo "⚠️  Warning: node_modules not found, attempting to install..."
    if pnpm install; then
        echo "✅ Project dependencies installed successfully"
    else
        echo "❌ Error: Failed to install project dependencies"
        exit 1
    fi
fi

# Create useful aliases
echo "🔗 Setting up development aliases..."
cat >> ~/.zshrc << 'EOF'

# Velro Development Aliases
alias dev="pnpm dev"
alias build="pnpm build"
alias start="pnpm start"
alias lint="pnpx @biomejs/biome check ."
alias format="pnpx @biomejs/biome format ."
alias fix="pnpx @biomejs/biome check --write ."
alias typecheck="pnpx tsc --noEmit"

# Claude CLI aliases
# alias claude="claude"
# alias claudeauth="claude auth login"
# alias claudelogout="claude auth logout"

# Vercel CLI aliases
alias vc="vercel"
alias vcdeploy="vercel --prod"
alias vcdev="vercel dev"
alias vclogin="vercel login"
alias vclogout="vercel logout"

# Supabase aliases (using pnpx)
alias sb="pnpx supabase"
alias sbstart="pnpx supabase start"
alias sbstop="pnpx supabase stop"
alias sbreset="pnpx supabase db reset"
alias sbstatus="pnpx supabase status"

# Git aliases
alias gs="git status"
alias ga="git add"
alias gc="git commit"
alias gp="git push"
alias gl="git log --oneline"

# QStash/Upstash development (using pnpx)
alias qstash="pnpx @upstash/qstash-cli"
alias qstashdev="pnpx @upstash/qstash-cli dev"

# GitHub CLI aliases
alias ghauth="gh auth login"
alias ghlogout="gh auth logout"
alias ghrepo="gh repo view"
alias ghpr="gh pr create"
alias ghprs="gh pr list"
alias ghprview="gh pr view"
alias ghissues="gh issue list"
alias ghissue="gh issue view"
alias ghcreate="gh issue create"
alias ghstatus="gh auth status"
alias ghclone="gh repo clone"
alias ghfork="gh repo fork"
alias ghrelease="gh release list"
EOF

# Create Starship configuration
echo "🌟 Configuring Starship prompt..."
mkdir -p ~/.config
cat > ~/.config/starship.toml << 'EOF'
# Velro Development Starship Configuration

format = """
$username\
$hostname\
$directory\
$git_branch\
$git_state\
$git_status\
$nodejs\
$typescript\
$package\
$cmd_duration\
$line_break\
$character"""

[character]
success_symbol = "[➜](bold green)"
error_symbol = "[➜](bold red)"

[directory]
truncation_length = 3
truncation_symbol = "…/"

[git_branch]
symbol = "🌱 "
format = "on [$symbol$branch]($style) "

[git_status]
format = '([\[$all_status$ahead_behind\]]($style) )'

[nodejs]
symbol = "⬢ "
format = "via [$symbol($version )]($style)"

[package]
symbol = "📦 "
format = "is [$symbol$version]($style) "

[cmd_duration]
min_time = 2_000
format = "took [$duration](bold yellow)"
EOF

# Note: zsh already set as default shell in container
echo "🐚 zsh already configured as default shell..."

# Pull environment variables from Vercel if authenticated
echo "🔄 Checking Vercel authentication..."
if command_exists vercel; then
    if vercel whoami >/dev/null 2>&1; then
        echo "✅ Vercel authenticated"
        if [ ! -f "/workspaces/velro/.env.local" ]; then
            echo "📥 Pulling environment variables from Vercel..."
            cd /workspaces/velro
            if vercel env pull .env.local --environment=development --yes 2>/dev/null; then
                echo "✅ Environment variables pulled from Vercel"
            else
                echo "⚠️  Could not pull Vercel env vars - project may not be linked"
                echo "   Run 'vercel link' to connect to your Vercel project"
            fi
        else
            echo "ℹ️  .env.local already exists - skipping Vercel pull"
            echo "   To update from Vercel, delete .env.local and run setup again"
        fi
    else
        echo "ℹ️  Not authenticated with Vercel"
        echo "   Run 'vercel login' to authenticate and pull environment variables"
    fi
else
    echo "⚠️  Vercel CLI not installed - skipping env pull"
fi

# Create .env.development.local template for local development overrides
if [ ! -f "/workspaces/velro/.env.development.local" ]; then
    echo "📝 Creating .env.development.local template..."
    cat > /workspaces/velro/.env.development.local << 'EOF'
# Local Development Environment Overrides
# This file is for development-specific variables that override .env.local
# Add any local development variables here

# Supabase Local Configuration (auto-populated by start-services.sh)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=will_be_set_by_start_services
SUPABASE_SERVICE_ROLE_KEY=will_be_set_by_start_services

# Development flags
NODE_ENV=development
NEXT_PUBLIC_DEBUG=true
EOF
    echo "✅ Created .env.development.local for local overrides"
fi

# Create .env.local only if Vercel pull didn't create it
if [ ! -f "/workspaces/velro/.env.local" ]; then
    echo "📝 Creating .env.local template (no Vercel connection)..."
    cat > /workspaces/velro/.env.local << 'EOF'
# Velro Environment Variables
# This file should contain production secrets pulled from Vercel
# Run 'vercel env pull' to populate this file

# QStash Configuration (get from Upstash Console)
QSTASH_URL=https://qstash.upstash.io
QSTASH_TOKEN=your_qstash_token_here
QSTASH_CURRENT_SIGNING_KEY=your_signing_key_here
QSTASH_NEXT_SIGNING_KEY=your_next_signing_key_here

# Other production secrets
# Add production API keys and secrets here
EOF
    echo "✅ Created .env.local template"
fi

# Set proper permissions
echo "🔐 Setting proper permissions..."
chmod +x /workspaces/velro/.devcontainer/setup.sh

# Handle SSH configuration if available
if [ -d ~/.ssh ]; then
    echo "🔑 Setting SSH permissions..."
    # Try to set permissions, but don't fail if read-only
    chmod 700 ~/.ssh 2>/dev/null || echo "ℹ️  SSH directory is read-only (this is normal in containers)"
    # Use find to avoid glob errors when directory is empty
    find ~/.ssh -type f -exec chmod 600 {} \; 2>/dev/null || true
    echo "✅ SSH configuration checked"
else
    echo "ℹ️  No SSH directory found - you can set up SSH keys later if needed"
fi

# Handle GPG configuration if available
if [ -d ~/.gnupg ]; then
    echo "🔐 Setting GPG permissions..."
    # Try to set permissions, but don't fail if read-only
    chmod 700 ~/.gnupg 2>/dev/null || echo "ℹ️  GPG directory is read-only (this is normal in containers)"
    # Use find to avoid glob errors when directory is empty
    find ~/.gnupg -type f -exec chmod 600 {} \; 2>/dev/null || true
    echo "✅ GPG configuration checked"
else
    echo "ℹ️  No GPG directory found - GPG signing will be unavailable"
fi

# Verify critical tools are available
echo "🔍 Verifying installed tools..."
for tool in node pnpm git; do
    if command_exists "$tool"; then
        echo "✅ $tool is available"
    else
        echo "❌ $tool is not available"
    fi
done

echo "✅ Velro development environment setup complete!"
echo ""
echo "🎉 You can now:"
echo "  • Run 'dev' to start the Next.js development server"
echo "  • Run 'sbstart' (or 'pnpx supabase start') to start local Supabase services"  
echo "  • Run 'lint' or 'format' to check/format code with Biome"
echo "  • Run 'vc' or 'vercel' for deployment management"
echo "  • Run 'gh' or GitHub CLI aliases for repository management"
echo "  • Use GitHub Copilot for additional AI-assisted coding"
echo ""
echo "🔧 New tools installed:"
echo "  • Claude CLI - Installed"
echo "  • Vercel CLI - Deployment and hosting"
echo "  • GitHub CLI - Repository and PR management"
echo "  • All tools now use pnpm instead of npm"
echo ""
echo "⚡ Environment is optimized for fast startup and low resource usage"
echo "📚 Check .devcontainer/README.md for more information"