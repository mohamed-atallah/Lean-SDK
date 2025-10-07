#!/bin/bash

echo "🔍 COMPREHENSIVE SECURITY SCAN"
echo "======================================"
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ISSUES=0

# Patterns to search for
CLIENT_ID="0e2f5780-1416-4a49-b63b-fc4ddae45343"
CLIENT_SECRET_HEX="30653266353738302d313431362d3461"
CLIENT_SECRET_PLAIN="fQBN2yzSvbxTMXD38xcuEPQs71gT7T5q"

echo "📋 Scanning files that will be committed to GitHub..."
echo ""

# Get list of files that are NOT ignored
git ls-files -c 2>/dev/null > /tmp/tracked_files.txt
if [ $? -ne 0 ]; then
    echo "Not a git repository, scanning all files..."
    find . -type f -not -path "*/node_modules/*" -not -path "*/.git/*" > /tmp/tracked_files.txt
fi

# Scan each tracked file
while IFS= read -r file; do
    if [ -f "$file" ]; then
        # Check for client_id
        if grep -q "$CLIENT_ID" "$file" 2>/dev/null; then
            echo -e "${RED}❌ FOUND CLIENT_ID in: $file${NC}"
            ISSUES=$((ISSUES + 1))
        fi
        
        # Check for client_secret (hex)
        if grep -q "$CLIENT_SECRET_HEX" "$file" 2>/dev/null; then
            echo -e "${RED}❌ FOUND CLIENT_SECRET (hex) in: $file${NC}"
            ISSUES=$((ISSUES + 1))
        fi
        
        # Check for client_secret (plain)
        if grep -q "$CLIENT_SECRET_PLAIN" "$file" 2>/dev/null; then
            echo -e "${RED}❌ FOUND CLIENT_SECRET (plain) in: $file${NC}"
            ISSUES=$((ISSUES + 1))
        fi
    fi
done < /tmp/tracked_files.txt

rm -f /tmp/tracked_files.txt

echo ""
echo "======================================"
if [ $ISSUES -eq 0 ]; then
    echo -e "${GREEN}✅ PASSED: No credentials found in tracked files${NC}"
else
    echo -e "${RED}❌ FAILED: Found credentials in $ISSUES file(s)${NC}"
fi

exit $ISSUES
