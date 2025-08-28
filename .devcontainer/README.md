# Velro Simplified Dev Container

A streamlined development container setup optimized for fast startup times, minimal resource usage, and excellent developer experience.

## Features

- **Fast Startup**: Under 2 minutes to fully operational environment
- **Low Resource Usage**: Under 2GB RAM usage
- **Node.js 22 LTS**: Latest stable Node.js with TypeScript support
- **pnpm Package Manager**: Fast, efficient package management throughout
- **Claude CLI**: AI-powered coding assistance directly in terminal
- **Vercel CLI**: Seamless deployment and hosting management
- **Native Supabase CLI**: No 15-service docker-compose overhead
- **QStash CLI**: Direct integration for job queue testing
- **GitHub CLI**: Native repository, PR, and issue management
- **Enhanced Terminal**: Antidote plugin manager + Starship prompt
- **Essential VS Code Extensions**: Curated set for Velro development

## Quick Start

### Prerequisites

- Docker Desktop or Docker Engine
- VS Code with Remote-Containers extension
- 4GB+ available RAM
- 10GB+ free disk space

### Starting the Container

1. **Open the project in VS Code**
   ```bash
   code /path/to/velro
   ```

2. **Open in Dev Container**
   - `Cmd+Shift+P` (macOS) or `Ctrl+Shift+P` (Windows/Linux)
   - Type "Dev Containers: Reopen in Container"
   - VS Code will automatically use `.devcontainer/devcontainer.json`

3. **Wait for Setup** (1-2 minutes)
   - Container builds and starts
   - Dependencies install automatically
   - Development tools configure

4. **Start Development**
   ```bash
   # Start Next.js development server
   dev
   
   # Start local Supabase (in another terminal)
   sbstart
   ```

## Development Workflow

### Available Commands

```bash
# Development
dev              # Start Next.js dev server with Turbopack
build            # Build production app
start            # Start production server

# Code Quality
lint             # Run Biome linter
format           # Format code with Biome
fix              # Auto-fix linting and formatting issues
typecheck        # TypeScript type checking

# AI Assistance
claude           # Claude CLI for AI-powered coding help
claudeauth       # Login to Claude CLI
claudelogout     # Logout from Claude CLI

# Deployment
vc               # Vercel CLI shorthand
vcdeploy         # Deploy to production with Vercel
vcdev            # Start Vercel development server
vclogin          # Login to Vercel
vclogout         # Logout from Vercel

# Supabase
sbstart          # Start local Supabase services
sbstop           # Stop local Supabase services
sbreset          # Reset local database
sbstatus         # Check service status

# QStash
qstash           # QStash CLI for job queue management

# GitHub CLI
gh               # Main GitHub CLI command
ghauth           # Login to GitHub CLI
ghlogout         # Logout from GitHub CLI
ghstatus         # Check authentication status
ghrepo           # View current repository
ghpr             # Create new pull request
ghprs            # List pull requests
ghprview         # View specific pull request
ghissues         # List repository issues
ghissue          # View specific issue
ghcreate         # Create new issue
ghclone          # Clone a repository
ghfork           # Fork a repository
ghrelease        # List releases

# Git shortcuts
gs               # git status
ga               # git add
gc               # git commit
gp               # git push
gl               # git log --oneline
```

### Port Forwarding

The container automatically forwards these ports:

- `3000` - Next.js development server
- `54321` - Supabase API Gateway
- `54322` - Supabase PostgreSQL Database  
- `54323` - Supabase Storage
- `54324` - Supabase Studio Dashboard

Access your app at: http://localhost:3000

## Getting Started with New Tools

### Claude CLI Setup

After container setup, authenticate with Claude:

```bash
# Login to Claude CLI
claudeauth

# Start using Claude for coding assistance
claude "Help me optimize this TypeScript function"
```

### Vercel CLI Setup

For deployment management:

```bash
# Login to Vercel
vclogin

# Deploy to production
vcdeploy

# Start local development with Vercel
vcdev
```

### GitHub CLI Setup

For repository and PR management:

```bash
# Login to GitHub CLI
ghauth

# Check authentication status
ghstatus

# View current repository information
ghrepo

# Create a new pull request
ghpr

# List all pull requests
ghprs

# List issues
ghissues

# Clone a repository
ghclone owner/repo-name

# Create a new issue
ghcreate
```

### Using pnpm

All package management now uses pnpm for better performance:

```bash
# Install dependencies
pnpm install

# Add a new package
pnpm add package-name

# Remove a package
pnpm remove package-name

# Run scripts
pnpm dev
pnpm build
pnpm test

# Execute packages (instead of npx)
pnpx @biomejs/biome check .
```

## Configuration

### Environment Variables

A template `.env.local` file is created during setup. Fill in your actual values:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# QStash Configuration
QSTASH_URL=https://qstash.upstash.io
QSTASH_TOKEN=your_qstash_token_here
QSTASH_CURRENT_SIGNING_KEY=your_signing_key_here
QSTASH_NEXT_SIGNING_KEY=your_next_signing_key_here
```

### Getting Supabase Keys

After starting Supabase locally:

```bash
sbstatus
```

Copy the API URL and anon key to your `.env.local` file.

### Terminal Customization

The container includes:

- **Starship Prompt**: Beautiful, fast prompt with git integration
- **Antidote**: Modern zsh plugin manager
- **Essential Plugins**: Syntax highlighting, autosuggestions, completions

## Migration from Existing Dev Container

### From Complex Docker Compose Setup

1. **Stop existing containers**
   ```bash
   docker-compose down
   ```

2. **Switch to simple container**
   - Use VS Code command palette
   - Select "Dev Containers: Rebuild and Reopen in Container"
   - The container will use `.devcontainer/devcontainer.json` automatically

3. **Verify functionality**
   ```bash
   # Check Node.js version
   node --version  # Should show v22.x.x
   
   # Check tools
   pnpm --version
   claude --version
   vercel --version
   supabase --version
   qstash --version
   gh --version
   ```

### From Local Development

1. **Backup local configuration**
   ```bash
   cp .env.local .env.local.backup
   ```

2. **Open in container** (follow Quick Start steps)

3. **Restore configuration**
   ```bash
   # Compare and merge any custom settings
   diff .env.local.backup .env.local
   ```

## Troubleshooting

### Container Won't Start

1. **Check Docker resources**
   - Ensure 4GB+ RAM allocated to Docker
   - Free up disk space (10GB+ recommended)

2. **Clear Docker cache**
   ```bash
   docker system prune -a
   ```

3. **Rebuild container**
   - VS Code: "Dev Containers: Rebuild Container"

### Slow Performance

1. **Check resource allocation**
   ```bash
   docker stats
   ```

2. **Optimize VS Code settings**
   - Disable unused extensions
   - Close unnecessary editor tabs

3. **Use development mode**
   ```bash
   # Faster than production build
   dev
   ```

### Supabase Connection Issues

1. **Check service status**
   ```bash
   sbstatus
   ```

2. **Restart services**
   ```bash
   sbstop && sbstart
   ```

3. **Verify environment variables**
   ```bash
   cat .env.local | grep SUPABASE
   ```

### Port Conflicts

If ports are already in use:

1. **Stop conflicting services**
   ```bash
   sudo lsof -i :3000  # Find process using port 3000
   kill -9 <PID>       # Stop the process
   ```

2. **Use alternative ports**
   ```bash
   # Start Next.js on different port
   pnpm dev -- --port 3001
   ```

## Performance Benchmarks

### Startup Time
- **Cold start**: ~90 seconds (first time)
- **Warm start**: ~30 seconds (subsequent starts)
- **Hot restart**: ~10 seconds (rebuild only)

### Resource Usage
- **Base container**: ~500MB RAM
- **With Next.js dev**: ~1.2GB RAM
- **With Supabase local**: ~1.8GB RAM
- **Full stack running**: ~2.0GB RAM

### Development Speed
- **TypeScript compilation**: Fast (turbopack)
- **Hot reload**: <200ms
- **Biome formatting**: <100ms
- **Test execution**: Depends on test suite

## GitHub CLI Workflows

### Repository Management

```bash
# View repository information
ghrepo                           # Current repository
ghrepo owner/repo-name          # Specific repository

# Clone repositories
ghclone owner/repo-name         # Clone to current directory
ghclone owner/repo-name --clone-path ./projects

# Fork repositories
ghfork owner/repo-name          # Fork to your account
```

### Pull Request Workflows

```bash
# Create pull requests
ghpr                            # Interactive PR creation
ghpr --title "Fix: Update API endpoint" --body "Description here"

# List and view PRs
ghprs                           # List all PRs
ghprs --state open             # Only open PRs
ghprview 123                   # View specific PR by number
ghprview --web                 # Open current branch PR in browser

# PR reviews
gh pr review 123               # Review a PR
gh pr review 123 --approve     # Approve a PR
gh pr review 123 --request-changes --body "Comments here"

# Merge PRs
gh pr merge 123                # Interactive merge
gh pr merge 123 --squash       # Squash merge
gh pr merge 123 --merge        # Create merge commit
```

### Issue Management

```bash
# List and view issues
ghissues                       # List all issues
ghissues --state open          # Only open issues
ghissue 456                    # View specific issue

# Create issues
ghcreate                       # Interactive issue creation
ghcreate --title "Bug: Login fails" --body "Steps to reproduce..."

# Work with issues
gh issue close 456             # Close an issue
gh issue reopen 456            # Reopen an issue
gh issue edit 456              # Edit issue details
```

### Release Management

```bash
# List releases
ghrelease                      # List all releases
ghrelease --limit 5            # Show latest 5 releases

# Create releases
gh release create v1.0.0       # Create new release
gh release create v1.0.0 --notes "Release notes here"
gh release create v1.0.0 --generate-notes  # Auto-generate notes

# Upload assets
gh release upload v1.0.0 dist/*  # Upload build artifacts
```

### Authentication and Configuration

```bash
# Authentication
ghauth                         # Login interactively
ghstatus                       # Check auth status
ghlogout                       # Logout

# Configuration
gh config list                 # Show current config
gh config set editor code      # Set default editor
gh config set git_protocol https  # Use HTTPS for Git operations
```

## Advanced Configuration

### Custom VS Code Settings

Add to `.vscode/settings.json`:

```json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "biomejs.biome"
}
```

### Additional Tools

To add more development tools, modify `setup.sh`:

```bash
# Install additional global packages
pnpm install -g your-tool@latest
```

### Shell Customization

Add custom aliases to `~/.zshrc`:

```bash
# Custom aliases
alias mycommand="your custom command"
```

## Security Considerations

- SSH keys, Git config, and GPG keys are mounted from host (read-only for security)
- Claude configuration is mounted from host for seamless authentication
- Environment variables should never contain production secrets
- Use local Supabase for development only
- QStash uses development-only tokens

### Host Directory Mounts

The container automatically mounts these directories from your host machine:

- `~/.ssh` → `/home/node/.ssh` (read-only) - SSH keys for Git operations
- `~/.gitconfig` → `/home/node/.gitconfig` (read-only) - Git configuration
- `~/.gnupg` → `/home/node/.gnupg` (read-only) - GPG keys for commit signing
- `~/.claude` → `/home/node/.claude` - Claude CLI configuration and authentication

**Note**: The devcontainer automatically creates these directories if they don't exist using the `prebuild.sh` script. If you need to set them up manually:

```bash
# Set up SSH keys (if not already configured)
ssh-keygen -t ed25519 -C "your-email@example.com"

# Set up GPG signing (optional)
gpg --generate-key

# Authenticate Claude CLI (if not already done)
claude auth login
```

## Support

### Getting Help

1. **Check logs**
   ```bash
   # Container logs
   docker logs <container_name>
   
   # Application logs
   dev  # Check console output
   ```

2. **Reset environment**
   ```bash
   # Nuclear option: rebuild everything
   # VS Code: "Dev Containers: Rebuild Container (No Cache)"
   ```

3. **Compare with working setup**
   - Check against team member's working configuration
   - Verify all required environment variables are set

### Known Issues

- **ARM64 Macs**: All tools compatible, no known issues
- **Windows WSL2**: Requires WSL2 backend, file watching may be slower
- **Linux**: Native Docker, best performance

### Version Compatibility

- **Node.js**: 22.x LTS (production ready)
- **pnpm**: Latest stable (replaces npm throughout)
- **Claude CLI**: Latest stable
- **Vercel CLI**: Latest stable
- **Supabase CLI**: Latest stable
- **GitHub CLI**: Latest stable
- **Biome**: Latest stable
- **VS Code**: 1.80+ recommended

## Contributing

To improve this dev container setup:

1. Test changes in isolated environment
2. Update documentation
3. Verify performance benchmarks
4. Submit pull request with rationale

---

**Happy coding!** 🚀

This simplified dev container provides everything you need for Velro development while maintaining fast startup times and low resource usage.