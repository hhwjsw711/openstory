#!/bin/bash

# Cloudflare Pages Secrets Setup Script
# Syncs environment variables to Cloudflare Pages
#
# Usage:
#   ./scripts/setup-cloudflare-secrets.sh [--production]
#
# Options:
#   --production    Set secrets for production environment
#   (default)       Set secrets for preview environment
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
  ENV_FILE=".env.local"
  ENV_NAME="preview"
  echo -e "${YELLOW}📦 Setting up PREVIEW environment${NC}"
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

# Project name
PROJECT_NAME="frontend"

# Required secrets for Cloudflare deployment
REQUIRED_SECRETS=(
  "TURSO_DATABASE_URL"
  "TURSO_AUTH_TOKEN"
  "BETTER_AUTH_SECRET"
  "R2_ACCOUNT_ID"
  "R2_ACCESS_KEY_ID"
  "R2_SECRET_ACCESS_KEY"
  "R2_BUCKET_NAME"
  "QSTASH_TOKEN"
  "QSTASH_CURRENT_SIGNING_KEY"
  "QSTASH_NEXT_SIGNING_KEY"
)

# Optional secrets
OPTIONAL_SECRETS=(
  "APP_URL"
  "NEXT_PUBLIC_APP_URL"
  "GOOGLE_CLIENT_ID"
  "GOOGLE_CLIENT_SECRET"
  "FAL_KEY"
  "CEREBRAS_API_KEY"
  "RESEND_API_KEY"
)

# Load environment variables from file
echo -e "${BLUE}Loading environment variables from $ENV_FILE...${NC}"
source "$ENV_FILE"
echo -e "${GREEN}✓ Environment variables loaded${NC}"
echo ""

# Function to set a secret
set_secret() {
  local key=$1
  local value=$2
  local is_optional=$3

  if [ -z "$value" ]; then
    if [ "$is_optional" = "true" ]; then
      echo -e "${YELLOW}⊘ Skipping optional secret: $key (not set)${NC}"
      return 0
    else
      echo -e "${RED}❌ Required secret missing: $key${NC}"
      return 1
    fi
  fi

  echo -e "${BLUE}Setting secret: $key${NC}"
  echo "$value" | bunx wrangler pages secret put "$key" --project-name="$PROJECT_NAME" --env="$ENV_NAME" > /dev/null 2>&1
  echo -e "${GREEN}✓ Set: $key${NC}"
}

# Set required secrets
echo -e "${BLUE}Setting required secrets...${NC}"
MISSING_REQUIRED=0
for secret in "${REQUIRED_SECRETS[@]}"; do
  value="${!secret}"
  if ! set_secret "$secret" "$value" "false"; then
    MISSING_REQUIRED=1
  fi
done
echo ""

if [ $MISSING_REQUIRED -eq 1 ]; then
  echo -e "${RED}❌ Some required secrets are missing. Please add them to $ENV_FILE${NC}"
  exit 1
fi

# Set optional secrets
echo -e "${BLUE}Setting optional secrets...${NC}"
for secret in "${OPTIONAL_SECRETS[@]}"; do
  value="${!secret}"
  set_secret "$secret" "$value" "true"
done
echo ""

echo -e "${GREEN}✅ Secrets setup complete!${NC}"
echo ""
echo -e "${BLUE}Environment:${NC} $ENV_NAME"
echo -e "${BLUE}Project:${NC} $PROJECT_NAME"
echo ""
echo -e "${YELLOW}💡 Tips:${NC}"
echo -e "  • View secrets in Cloudflare dashboard: Workers & Pages > $PROJECT_NAME > Settings > Environment variables"
echo -e "  • Update a secret: bunx wrangler pages secret put <KEY_NAME> --project-name=$PROJECT_NAME"
echo -e "  • Delete a secret: bunx wrangler pages secret delete <KEY_NAME> --project-name=$PROJECT_NAME"
echo -e "  • List secrets: bunx wrangler pages secret list --project-name=$PROJECT_NAME"
echo ""
