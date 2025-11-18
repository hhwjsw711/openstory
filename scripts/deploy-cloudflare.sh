#!/bin/bash

# Cloudflare Pages Deployment Script
# Builds and deploys the Next.js app to Cloudflare Pages
#
# Usage:
#   ./scripts/deploy-cloudflare.sh [--production]
#
# Options:
#   --production    Deploy to production (main branch)
#   (default)       Deploy as preview (current branch)
#
# Prerequisites:
#   - Cloudflare account with Pages enabled
#   - Wrangler CLI authenticated (run: bunx wrangler login)
#   - CLOUDFLARE_ACCOUNT_ID set in environment or .env file

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

echo -e "${BLUE}🚀 Cloudflare Pages Deployment${NC}"
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

# Determine branch name
if [ "$PRODUCTION" = true ]; then
  BRANCH="main"
  echo -e "${YELLOW}📦 Deploying to PRODUCTION${NC}"
else
  BRANCH=$(git branch --show-current)
  echo -e "${YELLOW}📦 Deploying preview from branch: ${BRANCH}${NC}"
fi
echo ""

# Run linter
echo -e "${BLUE}Running linter...${NC}"
bun lint
echo -e "${GREEN}✓ Linting passed${NC}"
echo ""

# Run type check
echo -e "${BLUE}Running type check...${NC}"
bun tsc --noEmit
echo -e "${GREEN}✓ Type check passed${NC}"
echo ""

# Run tests
echo -e "${BLUE}Running tests...${NC}"
if bun test; then
  echo -e "${GREEN}✓ Tests passed${NC}"
else
  echo -e "${YELLOW}⚠️  Tests failed but continuing deployment${NC}"
fi
echo ""

# Build Next.js application
echo -e "${BLUE}Building Next.js application...${NC}"
bun run build
echo -e "${GREEN}✓ Next.js build completed${NC}"
echo ""

# Build for Cloudflare Workers
echo -e "${BLUE}Building for Cloudflare Workers...${NC}"
bunx @cloudflare/next-on-pages
echo -e "${GREEN}✓ Cloudflare Workers build completed${NC}"
echo ""

# Deploy to Cloudflare Pages
echo -e "${BLUE}Deploying to Cloudflare Pages...${NC}"
bunx wrangler pages deploy .vercel/output/static \
  --project-name=velro \
  --branch="$BRANCH" \
  --commit-dirty=true

echo ""
echo -e "${GREEN}✅ Deployment successful!${NC}"
echo ""

if [ "$PRODUCTION" = true ]; then
  echo -e "${BLUE}Production URL:${NC} https://velro.pages.dev"
else
  echo -e "${BLUE}Preview URL:${NC} https://${BRANCH}.velro.pages.dev"
fi
echo ""
echo -e "${YELLOW}💡 Tips:${NC}"
echo -e "  • Check deployment status in Cloudflare dashboard"
echo -e "  • View logs: bunx wrangler pages deployment list"
echo -e "  • Rollback: Use Cloudflare dashboard to rollback to previous deployment"
echo ""
