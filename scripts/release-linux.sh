#!/usr/bin/env bash
# Platform: Linux only
# Requires: Node.js, the npm dependencies (npm ci)
set -e

node scripts/bundle.mjs bundle
node --experimental-sea-config src/sea-config.json

# Get a copy of the Node executable
cp "$(node -p 'process.execPath')" "${DIST_FILE_NAME}"
node scripts/bundle.mjs inject "${DIST_FILE_NAME}"

# Make binary executable
chmod +x ./${DIST_FILE_NAME}

# Compress the created binary
# Include following directories & files in the created archive file.
# - ./src/config/log_appender_xml
# - ./src/config/production_template.yaml
# - ./THIRD-PARTY-NOTICES.md
ls -la
echo "Creating zip file"
zip -9 -r ./${DIST_FILE_NAME}-${RELEASE_VERSION}-linux-x64.zip ${DIST_FILE_NAME}
zip -9 -u ./${DIST_FILE_NAME}-${RELEASE_VERSION}-linux-x64.zip THIRD-PARTY-NOTICES.md

# Add additional files to the zip file
cd src
echo "Adding additional files"
zip -9 -u -r "../${DIST_FILE_NAME}-${RELEASE_VERSION}-linux-x64.zip" "./config/production_template.yaml" "./config/log_appender_xml"

ls -la

# Return to repository root. Build artifacts are kept here so the workflow's
# later cleanup step can remove them without failing on already-missing files.
cd ..
