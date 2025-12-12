#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

CERT_DIR="certs"
CERT_FILE="$CERT_DIR/localhost.pem"
KEY_FILE="$CERT_DIR/localhost-key.pem"

echo -e "${GREEN}Setting up local SSL certificates with mkcert...${NC}"
echo ""

# Check if mkcert is installed
if ! command -v mkcert &> /dev/null; then
    echo -e "${RED}✗ mkcert is not installed${NC}"
    echo ""
    echo -e "${YELLOW}Install mkcert:${NC}"
    echo "  macOS:   brew install mkcert"
    echo "  Linux:   See https://github.com/FiloSottile/mkcert#installation"
    echo "  Windows: choco install mkcert"
    echo ""
    exit 1
fi

echo -e "${GREEN}✓ mkcert is installed${NC}"

# Create certs directory if it doesn't exist
mkdir -p "$CERT_DIR"

# Install local CA if not already installed
echo -e "${BLUE}Installing local CA (if needed)...${NC}"
mkcert -install 2>&1 | grep -q "already exists" && echo -e "${GREEN}✓ Local CA already installed${NC}" || echo -e "${GREEN}✓ Local CA installed${NC}"

# Generate certificates
echo -e "${BLUE}Generating certificates for localhost and 127.0.0.1...${NC}"
mkcert -key-file "$KEY_FILE" -cert-file "$CERT_FILE" localhost 127.0.0.1 ::1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Certificates generated successfully${NC}"
    echo ""
    echo -e "${BLUE}Certificate files:${NC}"
    echo "  Certificate: $CERT_FILE"
    echo "  Private Key:  $KEY_FILE"
    echo ""
    echo -e "${YELLOW}💡 To use these certificates with Next.js dev server:${NC}"
    echo "  Add to package.json scripts:"
    echo "    \"dev:https\": \"next dev --experimental-https --experimental-https-key $KEY_FILE --experimental-https-cert $CERT_FILE\""
    echo ""
    echo -e "${GREEN}Setup complete!${NC}"
else
    echo -e "${RED}✗ Failed to generate certificates${NC}"
    exit 1
fi

