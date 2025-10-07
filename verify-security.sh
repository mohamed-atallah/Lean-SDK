#!/bin/bash

echo "================================"
echo "🔒 Security Verification Script"
echo "================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0

# 1. Check if .env exists
echo "1. Checking if .env file exists..."
if [ -f ".env" ]; then
    echo -e "${GREEN}✅ .env file exists${NC}"
else
    echo -e "${RED}❌ .env file not found! Run: cp .env.example .env${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# 2. Check if .env is in git
echo "2. Checking if .env is git-ignored..."
if git check-ignore .env > /dev/null 2>&1; then
    echo -e "${GREEN}✅ .env is properly ignored by git${NC}"
else
    echo -e "${RED}❌ WARNING: .env is NOT ignored by git!${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# 3. Check if .gitignore exists
echo "3. Checking if .gitignore exists..."
if [ -f ".gitignore" ]; then
    echo -e "${GREEN}✅ .gitignore file exists${NC}"
else
    echo -e "${RED}❌ .gitignore file not found!${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# 4. Search for hardcoded credentials in code (excluding .env and docs)
echo "4. Searching for hardcoded credentials in code files..."
CLIENT_ID="0e2f5780-1416-4a49-b63b-fc4ddae45343"
CLIENT_SECRET_HEX="30653266353738302d313431362d3461"

FOUND_IN_CODE=0

# Search in code files only (not .env, not docs)
for file in *.js *.html; do
    if [ -f "$file" ]; then
        if grep -q "$CLIENT_ID" "$file" 2>/dev/null; then
            echo -e "${RED}❌ Found client_id in: $file${NC}"
            FOUND_IN_CODE=$((FOUND_IN_CODE + 1))
        fi
        if grep -q "$CLIENT_SECRET_HEX" "$file" 2>/dev/null; then
            echo -e "${RED}❌ Found client_secret in: $file${NC}"
            FOUND_IN_CODE=$((FOUND_IN_CODE + 1))
        fi
    fi
done

if [ $FOUND_IN_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ No hardcoded credentials found in code files${NC}"
else
    echo -e "${RED}❌ Found credentials in $FOUND_IN_CODE file(s)${NC}"
    ERRORS=$((ERRORS + FOUND_IN_CODE))
fi
echo ""

# 5. Check if connections/*.json are ignored
echo "5. Checking if connections/*.json are git-ignored..."
if [ -f "connections/all_connections.json" ]; then
    if git check-ignore connections/all_connections.json > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Connection files are properly ignored${NC}"
    else
        echo -e "${RED}❌ WARNING: Connection files are NOT ignored!${NC}"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${YELLOW}⚠️  No connection files found (OK if not tested yet)${NC}"
fi
echo ""

# 6. Check if required files exist
echo "6. Checking required files..."
REQUIRED_FILES=(".env.example" "SECURITY.md" "README.md" "server.js" "app.js")
for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅ $file exists${NC}"
    else
        echo -e "${RED}❌ $file not found!${NC}"
        ERRORS=$((ERRORS + 1))
    fi
done
echo ""

# 7. Check git status
echo "7. Checking git status..."
if git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Git repository detected${NC}"

    # Check if .env is in staging area
    if git diff --cached --name-only | grep -q "^\.env$"; then
        echo -e "${RED}❌ WARNING: .env is staged for commit!${NC}"
        echo -e "   Run: git reset HEAD .env"
        ERRORS=$((ERRORS + 1))
    else
        echo -e "${GREEN}✅ .env is not staged for commit${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Not a git repository${NC}"
fi
echo ""

# Summary
echo "================================"
echo "📊 Verification Summary"
echo "================================"

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ All security checks passed!${NC}"
    echo -e "${GREEN}🚀 Repository is ready for GitHub publishing${NC}"
    exit 0
else
    echo -e "${RED}❌ Found $ERRORS security issue(s)${NC}"
    echo -e "${YELLOW}⚠️  Please fix the issues above before publishing${NC}"
    exit 1
fi
