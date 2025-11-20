#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🌿 Starting database branching setup...${NC}"

# Check for jq
if ! command -v jq &> /dev/null; then
    echo -e "${RED}❌ jq is required but not installed.${NC}"
    exit 1
fi

# 1. Environment & Branch Detection
# Platform detection
if [ -n "$CF_PAGES" ]; then
  PLATFORM="cloudflare"
  BRANCH_NAME="$CF_PAGES_BRANCH"
elif [ -n "$VERCEL" ]; then
  PLATFORM="vercel"
  BRANCH_NAME="$VERCEL_GIT_COMMIT_REF"
elif [ -n "$RAILWAY_ENVIRONMENT" ]; then
  PLATFORM="railway"
  BRANCH_NAME="$RAILWAY_GIT_BRANCH"
else
  PLATFORM="local"
  # Try to get git branch, fallback to empty if git fails
  BRANCH_NAME=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
fi

# Allow override via BRANCH_NAME env var
if [ -n "$BRANCH_NAME_OVERRIDE" ]; then
  BRANCH_NAME="$BRANCH_NAME_OVERRIDE"
elif [ -z "$BRANCH_NAME" ] && [ -n "$BRANCH_NAME" ]; then
    # Case for if user passed BRANCH_NAME env var explicitly
    BRANCH_NAME="$BRANCH_NAME"
fi

echo -e "📍 Platform: ${BLUE}$PLATFORM${NC}"
echo -e "🌿 Branch: ${BLUE}$BRANCH_NAME${NC}"

if [ -z "$BRANCH_NAME" ]; then
  echo -e "${RED}❌ Could not detect branch name${NC}"
  exit 1
fi

# Skip if on main/master or production
if [[ "$BRANCH_NAME" == "main" || "$BRANCH_NAME" == "master" || "$BRANCH_NAME" == "prod" || "$BRANCH_NAME" == "production" ]]; then
  echo -e "${YELLOW}⏭️  Production branch detected. Skipping branch database creation.${NC}"
  exit 0
fi

# Check required secrets
if [ -z "$TURSO_API_TOKEN" ] || [ -z "$TURSO_ORG" ]; then
  echo -e "${YELLOW}⚠️  TURSO_API_TOKEN or TURSO_ORG not set. Skipping database branching.${NC}"
  exit 0
fi

# 2. Sanitize Branch Name for Turso
# Lowercase, replace non-alnum with hyphens, remove leading/trailing hyphens, truncate to 32 chars
SANITIZED_BRANCH=$(echo "$BRANCH_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g' | sed 's/-\+/-/g' | sed 's/^-//;s/-$//' | cut -c 1-32)
DB_NAME="velro-preview-${SANITIZED_BRANCH}"

echo -e "🗄️  Target Database: ${BLUE}$DB_NAME${NC}"

# 3. Check if Database Exists
echo -e "🔍 Checking if database exists..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TURSO_API_TOKEN" "https://api.turso.tech/v1/organizations/$TURSO_ORG/databases/$DB_NAME")

if [ "$HTTP_CODE" -eq 200 ]; then
  echo -e "${GREEN}✅ Database $DB_NAME already exists.${NC}"
else
  echo -e "${BLUE}🆕 Creating database $DB_NAME...${NC}"
  
  # Prepare JSON payload
  if [ -n "$TURSO_PRODUCTION_DB_NAME" ]; then
    echo -e "🌱 Seeding from: $TURSO_PRODUCTION_DB_NAME"
    JSON_DATA=$(jq -n --arg name "$DB_NAME" --arg group "default" --arg seedDb "$TURSO_PRODUCTION_DB_NAME" \
      '{name: $name, group: $group, seed: {type: "database", name: $seedDb}}')
  else
    JSON_DATA=$(jq -n --arg name "$DB_NAME" --arg group "default" \
      '{name: $name, group: $group}')
  fi
  
  CREATE_RES=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: Bearer $TURSO_API_TOKEN" -H "Content-Type: application/json" -d "$JSON_DATA" "https://api.turso.tech/v1/organizations/$TURSO_ORG/databases")
  CREATE_CODE=$(echo "$CREATE_RES" | tail -n1)
  CREATE_BODY=$(echo "$CREATE_RES" | head -n -1)

  if [ "$CREATE_CODE" -ne 200 ]; then
    echo -e "${RED}❌ Failed to create database: $CREATE_CODE $CREATE_BODY${NC}"
    exit 1
  fi

  # Wait for DB to be ready
  echo -e "${YELLOW}⏳ Waiting for database to be ready...${NC}"
  MAX_RETRIES=30
  COUNT=0
  while [ $COUNT -lt $MAX_RETRIES ]; do
    sleep 2
    CHECK_RES=$(curl -s -H "Authorization: Bearer $TURSO_API_TOKEN" "https://api.turso.tech/v1/organizations/$TURSO_ORG/databases/$DB_NAME")
    HOSTNAME=$(echo "$CHECK_RES" | jq -r '.database.Hostname // empty')
    if [ -n "$HOSTNAME" ]; then
      break
    fi
    COUNT=$((COUNT+1))
  done

  if [ -z "$HOSTNAME" ]; then
    echo -e "${RED}❌ Database did not become ready in time${NC}"
    exit 1
  fi
fi

# 4. Get/Create Auth Token
echo -e "${BLUE}🔑 Generating auth token...${NC}"

# Get Hostname
INFO_RES=$(curl -s -H "Authorization: Bearer $TURSO_API_TOKEN" "https://api.turso.tech/v1/organizations/$TURSO_ORG/databases/$DB_NAME")
HOSTNAME=$(echo "$INFO_RES" | jq -r '.database.Hostname')
DB_URL="libsql://${HOSTNAME}"

# Create Token
TOKEN_RES=$(curl -s -X POST -H "Authorization: Bearer $TURSO_API_TOKEN" "https://api.turso.tech/v1/organizations/$TURSO_ORG/databases/$DB_NAME/auth/tokens")
TOKEN=$(echo "$TOKEN_RES" | jq -r '.jwt')

if [ -z "$TOKEN" ] || [ "$TOKEN" == "null" ]; then
  echo -e "${RED}❌ Failed to create auth token${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Database ready at $DB_URL${NC}"

# 5. Run Migrations
echo -e "${BLUE}🚀 Running migrations...${NC}"
export TURSO_DATABASE_URL="$DB_URL"
export TURSO_AUTH_TOKEN="$TOKEN"

bun db:migrate

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Migrations failed${NC}"
  exit 1
fi

# 6. Update Environment for subsequent build steps
echo -e "${BLUE}📝 Writing connection details to .env.production.local${NC}"

# Write to .env.production.local
cat >> .env.production.local << EOF

# Auto-generated by scripts/branch-database.sh
TURSO_DATABASE_URL="$DB_URL"
TURSO_AUTH_TOKEN="$TOKEN"
EOF

echo -e "${GREEN}✨ Database setup complete!${NC}"

