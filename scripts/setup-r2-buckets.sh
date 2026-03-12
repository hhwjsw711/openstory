#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Setting up Cloudflare R2 buckets...${NC}"
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}✗ Wrangler is not installed${NC}"
    echo -e "${YELLOW}Installing wrangler...${NC}"
    bun add -D wrangler
fi

# Check if user is logged in
echo -e "${BLUE}Checking Wrangler authentication...${NC}"
if ! bunx wrangler whoami &> /dev/null; then
    echo -e "${YELLOW}You need to authenticate with Cloudflare${NC}"
    echo -e "${BLUE}Opening browser for authentication...${NC}"
    bunx wrangler login

    if ! bunx wrangler whoami &> /dev/null; then
        echo -e "${RED}✗ Authentication failed${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✓ Authenticated with Cloudflare${NC}"
echo ""

# Get account ID
echo -e "${BLUE}Fetching Cloudflare account information...${NC}"
ACCOUNT_INFO=$(bunx wrangler whoami 2>&1)
ACCOUNT_ID=$(echo "$ACCOUNT_INFO" | grep "Account ID" | awk '{print $3}')

if [ -z "$ACCOUNT_ID" ]; then
    echo -e "${RED}✗ Could not retrieve account ID${NC}"
    echo -e "${YELLOW}Please set R2_ACCOUNT_ID manually in your .env file${NC}"
    read -p "Enter your Cloudflare Account ID: " ACCOUNT_ID
fi

echo -e "${GREEN}✓ Account ID: ${ACCOUNT_ID}${NC}"
echo ""

# Get bucket name from user
read -p "Enter bucket name for storage (e.g., my-app-storage): " BUCKET_NAME
if [ -z "$BUCKET_NAME" ]; then
    echo -e "${RED}Bucket name is required${NC}"
    exit 1
fi

APP_URL="${APP_URL:-http://localhost:3000}"

# Create bucket
echo ""
echo -e "${BLUE}Creating bucket: ${BUCKET_NAME}${NC}"

# Check if bucket already exists
if bunx wrangler r2 bucket list 2>&1 | grep -E "^name:\s+${BUCKET_NAME}$" > /dev/null; then
    echo -e "${YELLOW}⚠ Bucket '${BUCKET_NAME}' already exists${NC}"
    read -p "Do you want to configure CORS for this bucket? [y/N]: " CONFIGURE_CORS
else
    # Create the bucket
    if bunx wrangler r2 bucket create "$BUCKET_NAME" 2>&1; then
        echo -e "${GREEN}✓ Created bucket: ${BUCKET_NAME}${NC}"
        CONFIGURE_CORS="y"
    else
        echo -e "${RED}✗ Failed to create bucket: ${BUCKET_NAME}${NC}"
        exit 1
    fi
fi

# CORS configuration instructions (manual setup required)
if [[ "$CONFIGURE_CORS" =~ ^[Yy]$ ]]; then
    echo ""
    echo -e "${YELLOW}📝 CORS must be configured manually in Cloudflare Dashboard${NC}"
    echo -e "${BLUE}Go to: https://dash.cloudflare.com → R2 → ${BUCKET_NAME} → Settings → CORS Policy${NC}"
    echo ""
    echo -e "${BLUE}CORS settings:${NC}"
    echo "  Allowed Origins (one per line):"
    echo "    http://localhost:3000"
    echo "    ${APP_URL}"
    echo ""
    echo "  Allowed Methods: GET, PUT, POST, DELETE, HEAD"
    echo "  Allowed Headers: content-type, authorization"
    echo "  Expose Headers: ETag"
    echo "  Max Age: 3600"
    echo ""
fi

echo ""
echo -e "${GREEN}=== Setup Complete ===${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Create an R2 API token in the Cloudflare dashboard:"
echo "   https://dash.cloudflare.com/?to=/:account/r2/api-tokens"
echo ""
echo "2. Add these environment variables to your .env file:"
echo ""
echo "   R2_ACCOUNT_ID=${ACCOUNT_ID}"
echo "   R2_ACCESS_KEY_ID=<your-access-key-id>"
echo "   R2_SECRET_ACCESS_KEY=<your-secret-access-key>"
echo "   R2_BUCKET_NAME=${BUCKET_NAME}"
echo "   R2_PUBLIC_STORAGE_DOMAIN=<your-custom-domain>"
echo ""
echo -e "${YELLOW}💡 Tip: Keep your API credentials secure and never commit them to git${NC}"
echo ""
echo -e "${BLUE}=== Platform Notes ===${NC}"
echo ""
echo -e "${GREEN}Cloudflare Workers:${NC}"
echo "  Most storage operations use native R2 bindings (configured in wrangler.jsonc)."
echo "  S3 credentials (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY) are only needed"
echo "  for generating presigned/download URLs."
echo ""
echo -e "${GREEN}Other platforms (Vercel, Railway):${NC}"
echo "  All storage operations use the S3 SDK."
echo "  All R2 credentials above are required."
echo ""
echo -e "${GREEN}Done!${NC}"
