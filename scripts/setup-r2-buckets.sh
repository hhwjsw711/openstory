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

# Determine environment
echo -e "${BLUE}Which environment are you setting up?${NC}"
echo "1) Development (velro-storage-dev)"
echo "2) Production (velro-storage)"
echo "3) Both"
read -p "Enter choice [1-3]: " ENV_CHOICE

BUCKETS=()
case $ENV_CHOICE in
    1)
        BUCKETS=("velro-storage-dev")
        ;;
    2)
        BUCKETS=("velro-storage")
        ;;
    3)
        BUCKETS=("velro-storage-dev" "velro-storage")
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

# Create buckets
for BUCKET in "${BUCKETS[@]}"; do
    echo ""
    echo -e "${BLUE}Creating bucket: ${BUCKET}${NC}"

    # Check if bucket already exists (match exact bucket name after "name:")
    if bunx wrangler r2 bucket list 2>&1 | grep -E "^name:\s+${BUCKET}$" > /dev/null; then
        echo -e "${YELLOW}⚠ Bucket '${BUCKET}' already exists${NC}"
        read -p "Do you want to configure CORS for this bucket? [y/N]: " CONFIGURE_CORS
    else
        # Create the bucket
        if bunx wrangler r2 bucket create "$BUCKET" 2>&1; then
            echo -e "${GREEN}✓ Created bucket: ${BUCKET}${NC}"
            CONFIGURE_CORS="y"
        else
            echo -e "${RED}✗ Failed to create bucket: ${BUCKET}${NC}"
            continue
        fi
    fi

    # CORS configuration instructions (manual setup required)
    if [[ "$CONFIGURE_CORS" =~ ^[Yy]$ ]]; then
        echo ""
        echo -e "${YELLOW}📝 CORS must be configured manually in Cloudflare Dashboard${NC}"
        echo -e "${BLUE}Go to: https://dash.cloudflare.com → R2 → ${BUCKET} → Settings → CORS Policy${NC}"
        echo ""

        if [[ "$BUCKET" == *"-dev" ]]; then
            echo -e "${BLUE}Development bucket CORS settings:${NC}"
            echo "  Allowed Origins (one per line):"
            echo "    http://localhost:3000"
            echo "    https://app.velro.ai"
        else
            echo -e "${BLUE}Production bucket CORS settings:${NC}"
            echo "  Allowed Origins:"
            echo "    https://app.velro.ai"
        fi

        echo ""
        echo "  Allowed Methods: GET, PUT, POST, DELETE, HEAD"
        echo "  Allowed Headers: content-type, authorization"
        echo "  Expose Headers: ETag"
        echo "  Max Age: 3600"
        echo ""
    fi
done

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
echo "   R2_BUCKET_NAME=velro-storage-dev  # or velro-storage for production"
echo "   R2_PUBLIC_URL=https://pub-xxxxx.r2.dev  # optional, for custom domain"
echo ""
echo -e "${YELLOW}💡 Tip: Keep your API credentials secure and never commit them to git${NC}"
echo ""
echo -e "${GREEN}Done!${NC}"
