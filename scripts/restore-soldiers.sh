#!/bin/bash
# Simple wrapper script to restore Soldiers tab with spreadsheet ID from .env.local

set -e

# Read spreadsheet ID from .env.local
SPREADSHEET_ID=$(grep VITE_SPREADSHEET_ID .env.local | cut -d '=' -f2)

if [ -z "$SPREADSHEET_ID" ]; then
  echo "ERROR: Could not read VITE_SPREADSHEET_ID from .env.local"
  exit 1
fi

echo "📋 Spreadsheet ID: $SPREADSHEET_ID"
echo ""

# Check if token is provided
if [ -z "$1" ]; then
  echo "Usage: ./scripts/restore-soldiers.sh YOUR_OAUTH_TOKEN [--dry-run]"
  echo ""
  echo "How to get your OAuth token:"
  echo "  1. Open ShabTzak app in browser (logged in)"
  echo "  2. Open DevTools (F12) → Network tab"
  echo "  3. Look for requests to sheets.googleapis.com"
  echo "  4. Copy the Authorization header (without 'Bearer ')"
  echo ""
  echo "Example:"
  echo "  ./scripts/restore-soldiers.sh ya29.a0AcM612xyz..."
  echo "  ./scripts/restore-soldiers.sh ya29.a0AcM612xyz... --dry-run"
  exit 1
fi

TOKEN="$1"
DRY_RUN=""

if [ "$2" = "--dry-run" ]; then
  DRY_RUN="--dry-run"
  echo "🔍 DRY RUN MODE - no changes will be made"
  echo ""
fi

# Run the Node.js script
node scripts/update-soldiers-sheet.js \
  --token "$TOKEN" \
  --spreadsheet-id "$SPREADSHEET_ID" \
  $DRY_RUN
