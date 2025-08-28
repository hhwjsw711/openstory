#!/usr/bin/env zsh

# Fix GPG signing in the dev container
# The .gnupg directory is mounted read-only from the host, 
# so we need to copy it to a writable location

echo "🔐 Fixing GPG signing in container..."

# Check if the original GPG directory exists and is read-only
if [ -d "/home/node/.gnupg" ]; then
    # Create a writable copy of the GPG directory
    if [ ! -d "/home/node/.gnupg-copy" ]; then
        echo "📁 Creating writable copy of GPG directory..."
        cp -r /home/node/.gnupg /home/node/.gnupg-copy
        chmod 700 /home/node/.gnupg-copy
        chmod 600 /home/node/.gnupg-copy/* 2>/dev/null || true
        echo "✅ GPG directory copied to /home/node/.gnupg-copy"
    fi
    
    # Move original read-only mount aside
    if [ -d "/home/node/.gnupg" ] && [ ! -L "/home/node/.gnupg-readonly" ]; then
        sudo mv /home/node/.gnupg /home/node/.gnupg-readonly 2>/dev/null || true
    fi
    
    # Link the copy as the main GPG directory
    if [ ! -L "/home/node/.gnupg" ] && [ -d "/home/node/.gnupg-copy" ]; then
        ln -sf /home/node/.gnupg-copy /home/node/.gnupg
        echo "✅ Linked writable GPG directory"
    fi
fi

# Kill any existing gpg-agent processes
gpgconf --kill gpg-agent 2>/dev/null || true

# Update GPG to connect to the agent
export GPG_TTY=$(tty)
export GNUPGHOME=/home/node/.gnupg

# Test if GPG works now
if echo "test" | gpg --clearsign > /dev/null 2>&1; then
    echo "✅ GPG signing is working!"
else
    echo "⚠️  GPG signing still has issues, trying alternative fix..."
    
    # Alternative: Set up GPG to use loopback pinentry
    echo "allow-loopback-pinentry" >> /home/node/.gnupg/gpg-agent.conf 2>/dev/null || \
        echo "allow-loopback-pinentry" > /tmp/gpg-agent-extra.conf
    
    echo "pinentry-mode loopback" >> /home/node/.gnupg/gpg.conf 2>/dev/null || \
        echo "pinentry-mode loopback" > /tmp/gpg-extra.conf
    
    # Export config locations if main files are read-only
    if [ -f /tmp/gpg-extra.conf ]; then
        export GNUPG_CONF=/tmp/gpg-extra.conf
    fi
    
    # Restart agent
    gpgconf --kill gpg-agent 2>/dev/null || true
    gpg-agent --homedir /home/node/.gnupg \
              --options /tmp/gpg-agent.conf \
              --daemon 2>/dev/null
fi

# Add GPG configuration to shell RC files
for rcfile in ~/.bashrc ~/.zshrc; do
    if [ -f "$rcfile" ] && ! grep -q "GPG Container Fix" "$rcfile"; then
        cat >> "$rcfile" << 'EOFRC'

# GPG Container Fix
export GPG_TTY=$(tty)
export GNUPGHOME=/home/node/.gnupg
# Use writable socket directory
if [ ! -d /tmp/gnupg-sockets ]; then
    mkdir -p /tmp/gnupg-sockets
    chmod 700 /tmp/gnupg-sockets
fi
# Start GPG agent if not running
if ! pgrep -x gpg-agent > /dev/null; then
    gpg-agent --homedir /home/node/.gnupg \
              --options /tmp/gpg-agent.conf \
              --daemon 2>/dev/null || true
fi
EOFRC
        echo "✅ Added GPG fix to $rcfile"
    fi
done

echo "🔐 GPG setup complete. Please restart your shell or run: source ~/.zshrc"