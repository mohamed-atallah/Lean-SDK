#!/bin/bash

echo "╔════════════════════════════════════════╗"
echo "║  FINAL SECURITY CHECK FOR GITHUB       ║"
echo "╚════════════════════════════════════════╝"
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

TOTAL_CHECKS=0
PASSED_CHECKS=0

# Function to run check
run_check() {
    local test_name="$1"
    local command="$2"
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    echo -n "[$TOTAL_CHECKS] $test_name... "
    
    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PASS${NC}"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
        return 0
    else
        echo -e "${RED}❌ FAIL${NC}"
        return 1
    fi
}

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  CHECKING GIT CONFIGURATION${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

run_check ".gitignore exists" "test -f .gitignore"
run_check ".env.example exists" "test -f .env.example"
run_check ".env exists locally" "test -f .env"
run_check ".env is git-ignored" "git check-ignore .env"
run_check "CLAUDE.md is git-ignored" "git check-ignore CLAUDE.md"
run_check "SECURITY.md is git-ignored" "git check-ignore SECURITY.md"
run_check "CHANGES.md is git-ignored" "git check-ignore CHANGES.md"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  CHECKING FOR CREDENTIALS IN CODE${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Scan tracked files for credentials
CLIENT_ID="0e2f5780-1416-4a49-b63b-fc4ddae45343"
CLIENT_SECRET_HEX="30653266353738302d313431362d3461"

FOUND=0
for file in $(git ls-files | grep -E '\.(js|html|md)$' | grep -v ".claude"); do
    if grep -q "$CLIENT_ID" "$file" 2>/dev/null; then
        echo -e "${RED}❌ Found CLIENT_ID in tracked file: $file${NC}"
        FOUND=$((FOUND + 1))
    fi
    if grep -q "$CLIENT_SECRET_HEX" "$file" 2>/dev/null; then
        echo -e "${RED}❌ Found CLIENT_SECRET in tracked file: $file${NC}"
        FOUND=$((FOUND + 1))
    fi
done

TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
if [ $FOUND -eq 0 ]; then
    echo -e "[$TOTAL_CHECKS] No credentials in tracked files... ${GREEN}✅ PASS${NC}"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
else
    echo -e "[$TOTAL_CHECKS] Credentials found in $FOUND file(s)... ${RED}❌ FAIL${NC}"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  CHECKING CONNECTION FILES${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if ls connections/*.json > /dev/null 2>&1; then
    run_check "Connection JSON files are git-ignored" "git status --short | grep -q 'connections/.*\.json' && exit 1 || exit 0"
else
    echo "⚠️  No connection files found (OK - not tested yet)"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  CHECKING REQUIRED FILES${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

run_check "server.js exists" "test -f server.js"
run_check "app.js exists" "test -f app.js"
run_check "index.html exists" "test -f index.html"
run_check "README.md exists" "test -f README.md"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  FILES TO BE PUBLISHED${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

PUBLIC_FILES=$(git ls-files | grep -v ".claude" | wc -l | tr -d ' ')
echo -e "${GREEN}📄 $PUBLIC_FILES files will be published to GitHub${NC}"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  FILES THAT WILL STAY PRIVATE${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

git status --ignored --short 2>/dev/null | grep "^!!" | sed 's/!! //' | while read -r file; do
    echo -e "${YELLOW}🔒 $file${NC}"
done

echo ""
echo "╔════════════════════════════════════════╗"
echo "║           FINAL RESULTS                ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo -e "Total Checks: $TOTAL_CHECKS"
echo -e "Passed: ${GREEN}$PASSED_CHECKS${NC}"
echo -e "Failed: ${RED}$((TOTAL_CHECKS - PASSED_CHECKS))${NC}"
echo ""

if [ $PASSED_CHECKS -eq $TOTAL_CHECKS ]; then
    echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  ✅ ALL CHECKS PASSED!                 ║${NC}"
    echo -e "${GREEN}║  🚀 READY FOR GITHUB PUBLISHING        ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${GREEN}You can safely run:${NC}"
    echo -e "  git add ."
    echo -e "  git commit -m 'Security: Protect credentials with environment variables'"
    echo -e "  git push origin main"
    exit 0
else
    echo -e "${RED}╔════════════════════════════════════════╗${NC}"
    echo -e "${RED}║  ❌ SECURITY ISSUES FOUND!             ║${NC}"
    echo -e "${RED}║  ⚠️  DO NOT PUBLISH TO GITHUB YET     ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════╝${NC}"
    exit 1
fi
