#!/bin/bash

# Cloudflare Pages Secrets Setup Script
# Syncs environment variables to Cloudflare Pages using wrangler secret bulk
#
# Usage:
#   ./scripts/setup-cloudflare-secrets.sh [--production]
#
# Options:
#   --production    Set secrets for production environment (.env.production)
#   (default)       Set secrets for development/preview environment (.env.development.local)
#
# Prerequisites:
#   - Cloudflare account with Pages enabled
#   - Wrangler CLI authenticated (run: bunx wrangler login)
#   - .env.development.local file with your secrets (or .env.production for prod)

set -e # Exit on error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Parse arguments
PRODUCTION=false
if [ "$1" == "--production" ]; then
  PRODUCTION=true
fi

echo -e "${BLUE}🔐 Cloudflare Pages Secrets Setup${NC}"
echo ""

# Check if wrangler is authenticated
echo -e "${BLUE}Checking Wrangler authentication...${NC}"
if ! bunx wrangler whoami > /dev/null 2>&1; then
  echo -e "${RED}❌ Not authenticated with Wrangler${NC}"
  echo -e "${YELLOW}Please run: bunx wrangler login${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Wrangler authenticated${NC}"
echo ""

# Determine environment file and environment name
if [ "$PRODUCTION" = true ]; then
  ENV_FILE=".env.production"
  ENV_NAME="production"
  echo -e "${YELLOW}📦 Setting up PRODUCTION environment${NC}"
else
  ENV_FILE=".env.development.local"
  ENV_NAME="preview"
  echo -e "${YELLOW}📦 Setting up DEVELOPMENT/PREVIEW environment${NC}"
fi
echo ""

# Check if environment file exists
if [ ! -f "$ENV_FILE" ]; then
  echo -e "${RED}❌ Environment file not found: $ENV_FILE${NC}"
  echo -e "${YELLOW}Please create $ENV_FILE with your secrets${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Found environment file: $ENV_FILE${NC}"
echo ""

# Use wrangler secret bulk to set all secrets at once
echo -e "${BLUE}Setting secrets from $ENV_FILE...${NC}"
bunx wrangler secret bulk --env="$ENV_NAME" "$ENV_FILE"

echo ""
echo -e "${GREEN}✅ Secrets setup complete!${NC}"
echo ""
echo -e "${BLUE}Environment:${NC} $ENV_NAME"
echo -e "${BLUE}File:${NC} $ENV_FILE"
echo ""
