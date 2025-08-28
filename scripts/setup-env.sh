#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Setting up .env.development.local...${NC}"

# Check if Supabase is running
echo -e "${BLUE}Checking Supabase status...${NC}"
SUPABASE_STATUS=$(pnpx supabase status 2>&1)

if echo "$SUPABASE_STATUS" | grep -q "supabase local development setup"; then
    echo -e "${GREEN}✓ Supabase is running${NC}"
    
    # Extract Supabase values
    SUPABASE_URL=$(echo "$SUPABASE_STATUS" | grep "API URL" | awk '{print $3}')
    SUPABASE_ANON_KEY=$(echo "$SUPABASE_STATUS" | grep "anon key" | awk '{print $3}')
    SUPABASE_SERVICE_KEY=$(echo "$SUPABASE_STATUS" | grep "service_role key" | awk '{print $3}')
    
    # Database URL is typically: postgresql://postgres:postgres@localhost:54322/postgres
    DATABASE_URL="postgresql://postgres:postgres@localhost:54322/postgres"
else
    echo -e "${RED}✗ Supabase is not running. Please run: pnpm supabase:start${NC}"
    exit 1
fi

# Get QStash credentials
echo -e "${BLUE}Setting up QStash credentials...${NC}"
echo -e "${YELLOW}Please provide your QStash credentials from https://console.upstash.com/qstash${NC}"
read -p "Enter your QSTASH_TOKEN: " QSTASH_TOKEN
read -p "Enter your QSTASH_URL (press Enter for default: https://qstash.upstash.io): " QSTASH_URL
QSTASH_URL=${QSTASH_URL:-"https://qstash.upstash.io"}

# Get the tunnel URL if qstash dev is running
echo -e "${BLUE}Checking for QStash tunnel...${NC}"
echo -e "${YELLOW}If you have 'pnpm qstash:dev' running, enter the tunnel URL (e.g., https://xxx.ngrok.io)${NC}"
echo -e "${YELLOW}Otherwise, press Enter to skip:${NC}"
read -p "QStash tunnel URL: " QSTASH_TUNNEL_URL

# Create .env.development.local file
ENV_FILE=".env.development.local"

cat > $ENV_FILE << EOF
# Supabase (Local Development)
NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_KEY
DATABASE_URL=$DATABASE_URL

# QStash
QSTASH_TOKEN=$QSTASH_TOKEN
QSTASH_URL=$QSTASH_URL
QSTASH_CURRENT_SIGNING_KEY=local_dev_key
QSTASH_NEXT_SIGNING_KEY=local_dev_key_next

# App URL (for QStash callbacks)
EOF

if [ -n "$QSTASH_TUNNEL_URL" ]; then
    echo "NEXT_PUBLIC_APP_URL=$QSTASH_TUNNEL_URL" >> $ENV_FILE
    echo "APP_URL=$QSTASH_TUNNEL_URL" >> $ENV_FILE
else
    echo "NEXT_PUBLIC_APP_URL=http://localhost:3000" >> $ENV_FILE
    echo "APP_URL=http://localhost:3000" >> $ENV_FILE
fi

cat >> $ENV_FILE << EOF

# Optional: AI Service Keys (add as needed)
# FAL_KEY=
# RUNWAY_API_SECRET=
# KLING_ACCESS_KEY=
# OPENAI_API_KEY=
# ANTHROPIC_API_KEY=
EOF

echo -e "${GREEN}✓ Created $ENV_FILE${NC}"
echo ""
echo -e "${BLUE}Environment variables configured:${NC}"
echo "  Supabase URL: $SUPABASE_URL"
echo "  Database URL: $DATABASE_URL"
echo "  QStash URL: $QSTASH_URL"
if [ -n "$QSTASH_TUNNEL_URL" ]; then
    echo "  App URL (tunnel): $QSTASH_TUNNEL_URL"
else
    echo "  App URL: http://localhost:3000"
fi
echo ""
echo -e "${GREEN}Setup complete! You can now run 'pnpm dev'${NC}"