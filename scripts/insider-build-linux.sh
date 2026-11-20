#!/usr/bin/env bash
# Platform: Linux only
# Requires: Node.js, the npm dependencies (npm ci)
set -e

# Inject git SHA and date into package.json
GIT_SHA=$(git rev-parse --short HEAD)
DATE_STR=$(date +"%Y-%b-%d")
VERSION=$(grep -o '"version": "[^"]*"' package.json | cut -d'"' -f4)
sed -i "s/\"version\": \".*\"/\"version\": \"${VERSION}_${DATE_STR}_${GIT_SHA}\"/" package.json

# Get GitHub SHA for artifact naming
SHA=$GITHUB_SHA

node scripts/bundle.mjs bundle
node --experimental-sea-config src/sea-config.json

# Get a copy of the Node executable
cp "$(node -p 'process.execPath')" "${DIST_FILE_NAME}"
node scripts/bundle.mjs inject "${DIST_FILE_NAME}"

# Compress insider's build
# Include following directories & files in the created archive file.
# - ./src/config/log_appender_xml
# - ./src/config/production_template.yaml
# - ./THIRD-PARTY-NOTICES.md
ls -la
zip -9 -r ./${DIST_FILE_NAME}--linux-x64--$SHA.zip ${DIST_FILE_NAME}
zip -9 -u ./${DIST_FILE_NAME}--linux-x64--$SHA.zip THIRD-PARTY-NOTICES.md

cd src
zip -9 -u -r "../${DIST_FILE_NAME}--linux-x64--$SHA.zip" "./config/production_template.yaml" "./config/log_appender_xml"

# -------------------
# Clean up
cd ..
rm build.cjs

ls -la
