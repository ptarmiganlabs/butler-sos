#!/usr/bin/env bash
# Build a standalone Butler SOS binary for Linux (x64).
# Run this script from the repository root: bash scripts/build-binary-linux.sh
# The resulting binary is placed in the repository root as ./butler-sos

set -e

DIST_FILE_NAME="butler-sos"
SENTINEL_FUSE="NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2"

echo "=== Building Butler SOS binary for Linux ==="

echo "Step 1: Bundle source with esbuild..."
node_modules/.bin/esbuild src/bundle.js \
    --bundle \
    --outfile=build.cjs \
    --format=cjs \
    --platform=node \
    --target=node22 \
    --inject:./src/lib/import-meta-url.js \
    --define:import.meta.url=import_meta_url

echo "Step 2: Generate SEA blob..."
node --experimental-sea-config src/sea-config.json

echo "Step 3: Copy Node.js executable..."
cp "$(node -e "process.stdout.write(process.execPath)")" "${DIST_FILE_NAME}"

echo "Step 4: Inject blob into binary..."
npx postject "${DIST_FILE_NAME}" NODE_SEA_BLOB sea-prep.blob \
    --sentinel-fuse "${SENTINEL_FUSE}"

echo "Step 5: Make binary executable..."
chmod +x "./${DIST_FILE_NAME}"

echo "=== Build complete: ./${DIST_FILE_NAME} ==="
