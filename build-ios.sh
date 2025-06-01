#!/usr/bin/env bash

echo "--- Installing EAS CLI ---"
npm install -g eas-cli@latest --no-audit --fund=false --omit=optional

echo "--- Logging in to Expo (if needed) ---"
# Make sure you're already logged in, or run `eas login`

echo "--- Checking prerequisites ---"
eas whoami || { echo "❌ You must be logged in to Expo!"; exit 1; }

echo "--- Installing dependencies ---"
yarn install

echo "--- iOS Production Build Start ---"
eas build -p ios --profile ios-prod --non-interactive

echo "--- iOS Build Triggered ---"
