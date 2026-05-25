#!/bin/bash
# HabitForge QA Runner — catches errors before you do
# Run from project root: npm run qa

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color
BOLD='\033[1m'

PASS=0
FAIL=0
WARN=0

pass() { echo -e "  ${GREEN}✅ $1${NC}"; ((PASS++)); }
fail() { echo -e "  ${RED}❌ $1${NC}"; echo -e "     ${RED}$2${NC}"; ((FAIL++)); }
warn() { echo -e "  ${YELLOW}⚠️  $1${NC}"; ((WARN++)); }

echo ""
echo -e "${BOLD}══════════════════════════════════════════${NC}"
echo -e "${BOLD}  HabitForge QA Suite${NC}"
echo -e "${BOLD}══════════════════════════════════════════${NC}"
echo ""

# ─── 1. SHARED TYPES ───────────────────────────────
echo -e "${BOLD}📦 Shared Types${NC}"

cd shared
if npx tsc --noEmit 2>/dev/null; then
  pass "TypeScript compilation"
else
  fail "TypeScript compilation" "Run: cd shared && npx tsc --noEmit"
fi
cd ..

# ─── 2. BACKEND ────────────────────────────────────
echo ""
echo -e "${BOLD}🖥️  Backend (NestJS)${NC}"

cd backend

# TypeScript
if npx tsc --noEmit 2>/dev/null; then
  pass "TypeScript compilation"
else
  fail "TypeScript compilation" "Run: cd backend && npx tsc --noEmit"
fi

# Prisma
if npx prisma validate 2>/dev/null; then
  pass "Prisma schema valid"
else
  fail "Prisma schema invalid" "Run: cd backend && npx prisma validate"
fi

# Check Prisma client is in sync
MIGRATE_STATUS=$(npx prisma migrate status 2>&1 || true)
if echo "$MIGRATE_STATUS" | grep -q "Database schema is up to date"; then
  pass "Database in sync with schema"
elif echo "$MIGRATE_STATUS" | grep -q "Following migration"; then
  pass "Database in sync with schema"
else
  warn "Database may be out of sync — run: npx prisma migrate dev"
fi

# Unit tests
if npm test -- --passWithNoTests --silent 2>/dev/null; then
  pass "Unit tests pass"
else
  fail "Unit tests failing" "Run: cd backend && npm test"
fi

# Check for missing env vars
if [ -f .env.example ]; then
  MISSING_VARS=""
  while IFS= read -r line; do
    VAR_NAME=$(echo "$line" | grep -oP '^[A-Z_]+(?==)' || true)
    if [ -n "$VAR_NAME" ] && [ -f .env ]; then
      if ! grep -q "^$VAR_NAME=" .env 2>/dev/null; then
        MISSING_VARS="$MISSING_VARS $VAR_NAME"
      fi
    fi
  done < .env.example

  if [ -z "$MISSING_VARS" ]; then
    pass "All env vars from .env.example present in .env"
  else
    fail "Missing env vars in .env:$MISSING_VARS" "Compare .env with .env.example"
  fi
fi

cd ..

# ─── 3. MOBILE ─────────────────────────────────────
echo ""
echo -e "${BOLD}📱 Mobile (Expo)${NC}"

cd mobile

# TypeScript
if npx tsc --noEmit 2>/dev/null; then
  pass "TypeScript compilation"
else
  fail "TypeScript compilation" "Run: cd mobile && npx tsc --noEmit"
fi

# React version check
REACT_VER=$(node -e "console.log(require('./node_modules/react/package.json').version)" 2>/dev/null || echo "unknown")
RN_VER=$(node -e "console.log(require('./node_modules/react-native/package.json').version)" 2>/dev/null || echo "unknown")

# Check root react version too
ROOT_REACT_VER=$(node -e "console.log(require('../node_modules/react/package.json').version)" 2>/dev/null || echo "none")

if [ "$REACT_VER" != "unknown" ]; then
  pass "React version: $REACT_VER, React Native: $RN_VER"
else
  fail "Cannot determine React version" "Check mobile/node_modules/react"
fi

if [ "$ROOT_REACT_VER" != "none" ] && [ "$ROOT_REACT_VER" != "$REACT_VER" ]; then
  warn "Duplicate React: root=$ROOT_REACT_VER, mobile=$REACT_VER — ensure metro.config.js pins resolution"
fi

# Check expo-router entry point
MAIN_FIELD=$(node -e "console.log(require('./package.json').main || '')" 2>/dev/null)
if [ "$MAIN_FIELD" = "expo-router/entry" ]; then
  pass "Expo Router entry point configured"
else
  fail "package.json main should be 'expo-router/entry'" "Got: $MAIN_FIELD"
fi

# Check all router.replace/push targets have matching files
echo "  Checking route references..."
ROUTE_ERRORS=""
for route_ref in $(grep -rhoP "router\.(replace|push)\(['\"]([^'\"]+)['\"]" app/ --include="*.tsx" --include="*.ts" 2>/dev/null | grep -oP "['\"][^'\"]+['\"]" | tr -d "'" | tr -d '"'); do
  # Normalize route: /(tabs) -> (tabs)/index, /login -> (auth)/login, etc.
  ROUTE_FILE=$(echo "$route_ref" | sed 's|^/||')
  # Check if a matching .tsx file exists
  FOUND=false
  for candidate in "app/${ROUTE_FILE}.tsx" "app/${ROUTE_FILE}/index.tsx" "app/${ROUTE_FILE}/_layout.tsx"; do
    if [ -f "$candidate" ]; then
      FOUND=true
      break
    fi
  done
  if [ "$FOUND" = false ]; then
    ROUTE_ERRORS="$ROUTE_ERRORS\n     - $route_ref"
  fi
done

if [ -z "$ROUTE_ERRORS" ]; then
  pass "All route references resolve to files"
else
  warn "Some routes may not resolve:$ROUTE_ERRORS"
fi

# Component tests
if npm test -- --passWithNoTests --silent 2>/dev/null; then
  pass "Component tests pass"
else
  fail "Component tests failing" "Run: cd mobile && npm test"
fi

cd ..

# ─── 4. CROSS-WORKSPACE ───────────────────────────
echo ""
echo -e "${BOLD}🔗 Cross-Workspace Checks${NC}"

# .gitignore check
if [ -f .gitignore ] && grep -q "\.env" .gitignore; then
  pass ".env is in .gitignore"
else
  fail ".env is NOT in .gitignore" "Your secrets may be committed!"
fi

# Check no secrets in committed files
if git rev-parse --git-dir > /dev/null 2>&1; then
  SECRETS_FOUND=$(git ls-files | xargs grep -l "sk-or-v1\|OPENROUTER_API_KEY=.*[a-f0-9]\{20\}" 2>/dev/null | grep -v node_modules | grep -v ".env.example" || true)
  if [ -z "$SECRETS_FOUND" ]; then
    pass "No API keys found in tracked files"
  else
    fail "API keys found in tracked files" "$SECRETS_FOUND"
  fi
fi

# ─── SUMMARY ───────────────────────────────────────
echo ""
echo -e "${BOLD}══════════════════════════════════════════${NC}"
echo -e "  ${GREEN}✅ Passed: $PASS${NC}  ${RED}❌ Failed: $FAIL${NC}  ${YELLOW}⚠️  Warnings: $WARN${NC}"
echo -e "${BOLD}══════════════════════════════════════════${NC}"
echo ""

if [ $FAIL -gt 0 ]; then
  echo -e "${RED}${BOLD}QA FAILED — fix the errors above before continuing.${NC}"
  exit 1
else
  echo -e "${GREEN}${BOLD}QA PASSED — you're clear to proceed.${NC}"
  exit 0
fi
