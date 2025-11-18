#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Setting up .env.development.local...${NC}"
echo ""

# Check if wrangler is authenticated
echo -e "${BLUE}Checking Cloudflare Wrangler authentication...${NC}"
if bunx wrangler whoami > /dev/null 2>&1; then
  echo -e "${GREEN}✓ Wrangler authenticated${NC}"
  echo ""

  # List secrets from Cloudflare preview environment
  echo -e "${BLUE}Listing secrets from Cloudflare preview environment...${NC}"
  PROJECT_NAME="velro"

  # Get list of secrets (names only - values are not readable for security)
  echo -e "${BLUE}Secrets configured in Cloudflare preview:${NC}"
  if bunx wrangler pages secret list --project-name="$PROJECT_NAME" --env="preview" 2>/dev/null | grep -v "^$" | tail -n +2; then
    echo ""
    echo -e "${GREEN}✓ Connected to Cloudflare project: $PROJECT_NAME${NC}"
    echo -e "${YELLOW}Note: Secret values cannot be read from Cloudflare (write-only for security)${NC}"
    echo -e "${YELLOW}Make sure your .env.development.local matches these secrets${NC}"
  else
    echo -e "${YELLOW}⚠ Could not list secrets from Cloudflare${NC}"
    echo -e "${YELLOW}This is normal if the project doesn't exist yet${NC}"
    echo -e "${YELLOW}Continuing with default local development setup...${NC}"
  fi
else
  echo -e "${YELLOW}⚠ Wrangler not authenticated${NC}"
  echo -e "${YELLOW}Run 'bunx wrangler login' to connect to Cloudflare${NC}"
  echo -e "${YELLOW}Continuing with default local development setup...${NC}"
fi
echo ""

# Setup local SQLite database with Turso
echo -e "${BLUE}Setting up local SQLite database (Turso)...${NC}"
TURSO_DATABASE_URL="file:local.db"
echo -e "${GREEN}✓ Database configured for local development${NC}"

# Setup QStash for local development
echo -e "${BLUE}Setting up QStash for local development...${NC}"
echo -e "${YELLOW}Make sure 'bun qstash:dev' is running in another terminal!${NC}"

# QStash local development credentials (use environment variables if set, otherwise use defaults)
QSTASH_URL="${QSTASH_URL:-http://127.0.0.1:8080}"
QSTASH_TOKEN="${QSTASH_TOKEN:-eyJVc2VySUQiOiJkZWZhdWx0VXNlciIsIlBhc3N3b3JkIjoiZGVmYXVsdFBhc3N3b3JkIn0=}"
QSTASH_CURRENT_SIGNING_KEY="${QSTASH_CURRENT_SIGNING_KEY:-sig_7kYjw48mhY7kAjqNGcy6cr29RJ6r}"
QSTASH_NEXT_SIGNING_KEY="${QSTASH_NEXT_SIGNING_KEY:-sig_5ZB6DVzB1wjE8S6rZ7eenA8Pdnhs}"
APP_URL="${APP_URL:-http://localhost:3000}"
NEXT_PUBLIC_APP_URL="${NEXT_PUBLIC_APP_URL:-http://localhost:3000}"

# Create .env.development.local file
ENV_FILE=".env.development.local"

cat > $ENV_FILE << EOF
# Turso (Local Development)
# Using local SQLite file for development (fast, no network latency)
# For production, use https:// URL with TURSO_AUTH_TOKEN
TURSO_DATABASE_URL=$TURSO_DATABASE_URL
# TURSO_AUTH_TOKEN not needed for local file: URLs

# QStash
QSTASH_URL=$QSTASH_URL
QSTASH_TOKEN=$QSTASH_TOKEN
QSTASH_CURRENT_SIGNING_KEY=$QSTASH_CURRENT_SIGNING_KEY
QSTASH_NEXT_SIGNING_KEY=$QSTASH_NEXT_SIGNING_KEY

# App URL - used by QStash webhooks, Better Auth, and internal API calls
APP_URL=$APP_URL
NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
EOF

# Generate a random secret for BetterAuth
BETTER_AUTH_SECRET=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p -c 32)

cat >> $ENV_FILE << EOF

# BetterAuth Configuration
BETTER_AUTH_SECRET=$BETTER_AUTH_SECRET

# Google OAuth Configuration (optional - for Google sign-in)
# GOOGLE_CLIENT_ID=your-google-client-id
# GOOGLE_CLIENT_SECRET=your-google-client-secret

# Cloudflare R2 Storage
# R2_ACCOUNT_ID=your-cloudflare-account-id
# R2_ACCESS_KEY_ID=your-r2-access-key-id
# R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
# R2_BUCKET_NAME=velro-storage-dev  # or velro-storage for production
# R2_PUBLIC_URL=https://pub-xxxxx.r2.dev  # optional, for custom domain

# Optional: AI Service Keys (add as needed)
# OPENROUTER_KEY=
# CEREBRAS_API_KEY=
# FAL_KEY=
# RUNWAY_API_SECRET=
# KLING_ACCESS_KEY=
# OPENAI_API_KEY=
# ANTHROPIC_API_KEY=
EOF

echo -e "${GREEN}✓ Updated $ENV_FILE${NC}"
echo ""
echo -e "${BLUE}Environment variables configured:${NC}"
echo "  Database: local.db (SQLite via Turso)"
echo "  QStash URL: $QSTASH_URL"
echo "  QStash Token: defaultUser (local dev defaults)"
echo "  App URL: $APP_URL"
echo ""
echo -e "${YELLOW}💡 Tips:${NC}"
echo -e "${YELLOW}   • You can override QStash values by setting them as environment variables before running this script${NC}"
echo -e "${YELLOW}   • Remember to keep 'bun qstash:dev' running in another terminal!${NC}"
echo -e "${YELLOW}   • Don't forget to set up R2 credentials for file storage (see R2 section in .env)${NC}"
echo -e "${YELLOW}   • To sync secrets to Cloudflare: bun setup:cloudflare-secrets${NC}"
echo -e "${YELLOW}   • To list Cloudflare secrets: bunx wrangler pages secret list --project-name=velro${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "   1. Initialize database: bun db:setup"
echo "   2. Setup R2 storage: bun scripts/setup-r2-buckets.sh"
echo "   3. Add R2 credentials to $ENV_FILE"
echo "   4. Sync secrets to Cloudflare: bun setup:cloudflare-secrets"
echo ""
echo -e "${GREEN}Setup complete! Run 'bun db:setup' then 'bun dev' to start${NC}"