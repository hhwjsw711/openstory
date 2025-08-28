#!/bin/zsh

# Velro Development Container Pre-build Script
# This script ensures required host directories exist before container starts

set -e  # Exit on error

echo "🔧 Preparing host directories for devcontainer..."

# Function to create directory if it doesn't exist
ensure_directory() {
    local dir="$1"
    local description="$2"
    
    if [ ! -d "$dir" ]; then
        echo "📁 Creating $description directory: $dir"
        mkdir -p "$dir"
        echo "✅ Created $dir"
    else
        echo "✅ $description directory exists: $dir"
    fi
}

# Ensure required directories exist
ensure_directory "$HOME/.ssh" "SSH"
ensure_directory "$HOME/.gnupg" "GPG"
ensure_directory "$HOME/.claude" "Claude CLI"

# Set proper permissions for SSH directory
if [ -d "$HOME/.ssh" ]; then
    chmod 700 "$HOME/.ssh"
    echo "🔐 Set SSH directory permissions"
fi

# Set proper permissions for GPG directory  
if [ -d "$HOME/.gnupg" ]; then
    chmod 700 "$HOME/.gnupg"
    echo "🔐 Set GPG directory permissions"
fi

# Create a basic gitconfig if it doesn't exist
if [ ! -f "$HOME/.gitconfig" ]; then
    echo "📝 Creating basic .gitconfig..."
    cat > "$HOME/.gitconfig" << 'EOF'
[user]
    name = Your Name
    email = your.email@example.com
[init]
    defaultBranch = main
[core]
    editor = code --wait
[pull]
    rebase = false
EOF
    echo "✅ Created basic .gitconfig (please update with your details)"
fi

# Make sure all scripts are executable
echo "🔧 Setting script permissions..."
chmod +x "$PWD/.devcontainer/setup.sh" 2>/dev/null || true
chmod +x "$PWD/.devcontainer/start-services.sh" 2>/dev/null || true
chmod +x "$PWD/.devcontainer/validate.sh" 2>/dev/null || true

echo "🎉 Host directories prepared for devcontainer!"
echo ""
echo "📋 Next steps:"
echo "  1. Update ~/.gitconfig with your name and email"
echo "  2. Set up SSH keys if needed: ssh-keygen -t ed25519 -C 'your-email@example.com'"
echo "  3. Set up GPG signing if desired: gpg --generate-key"
echo "  4. Authenticate Claude CLI after container starts: claude auth login"