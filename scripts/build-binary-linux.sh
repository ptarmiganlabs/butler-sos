#!/usr/bin/env bash
# Platform: Linux only
# Requires: Node.js, the npm dependencies (npm ci)

set -e

BASE_NAME="butler-sos"
GIT_SHA=$(git rev-parse --short HEAD)
DATE_STR=$(date +"%Y-%b-%d")
DIST_FILE_NAME="${BASE_NAME}--local--${DATE_STR}--${GIT_SHA}"

echo "=== Building Butler SOS binary for Linux ==="
echo "Output file: ./${DIST_FILE_NAME}"

echo "Step 1: Bundle source with esbuild..."
node scripts/bundle.mjs bundle

echo "Step 2: Generate SEA blob..."
node --experimental-sea-config src/sea-config.json

echo "Step 3: Copy Node.js executable..."
cp "$(node -e "process.stdout.write(process.execPath)")" "${DIST_FILE_NAME}"

echo "Step 4: Inject blob into binary..."
node scripts/bundle.mjs inject "${DIST_FILE_NAME}"

echo "Step 5: Make binary executable..."
chmod +x "./${DIST_FILE_NAME}"

echo "=== Build complete: ./${DIST_FILE_NAME} ==="
