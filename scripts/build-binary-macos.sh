#!/usr/bin/env bash
# Platform: macOS only
# Requires: Node.js, the npm dependencies (npm ci), codesign (for ad-hoc signing)

set -e

BASE_NAME="butler-sos"
GIT_SHA=$(git rev-parse --short HEAD)
DATE_STR=$(date +"%Y-%b-%d")
DIST_FILE_NAME="${BASE_NAME}--local--${DATE_STR}--${GIT_SHA}"

echo "=== Building Butler SOS binary for macOS ==="
echo "Output file: ./${DIST_FILE_NAME}"

echo "Step 1: Bundle source with esbuild..."
node scripts/bundle.mjs bundle

echo "Step 2: Generate SEA blob..."
node --experimental-sea-config src/sea-config.json

echo "Step 3: Copy Node.js executable..."
cp "$(node -e "process.stdout.write(process.execPath)")" "${DIST_FILE_NAME}"

echo "Step 4: Remove existing code signature from Node.js binary..."
codesign --remove-signature "./${DIST_FILE_NAME}"

echo "Step 5: Inject blob into binary..."
node scripts/bundle.mjs inject "${DIST_FILE_NAME}"

echo "Step 6: Re-sign binary with ad-hoc signature (required on arm64 macOS)..."
codesign --sign - "./${DIST_FILE_NAME}"

echo "Step 7: Make binary executable..."
chmod +x "./${DIST_FILE_NAME}"

echo "=== Build complete: ./${DIST_FILE_NAME} ==="
echo "Note: This binary has an ad-hoc signature for local use only."
echo "      For distribution, use the CI/CD pipeline which handles full signing and notarization."
