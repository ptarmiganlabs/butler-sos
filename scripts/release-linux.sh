#!/usr/bin/env bash
set -e

./node_modules/.bin/esbuild src/bundle.js  --bundle --outfile=build.cjs --format=cjs --platform=node --target=node22 --inject:./src/lib/import-meta-url.js --define:import.meta.url=import_meta_url
node --experimental-sea-config src/sea-config.json

# Get a copy of the Node executable
cp "$(node -p 'process.execPath')" "${DIST_FILE_NAME}"
npx postject ${DIST_FILE_NAME} NODE_SEA_BLOB sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2

# Make binary executable
chmod +x ./${DIST_FILE_NAME}

# Compress the created binary
# Include following directories & files in the created archive file.
# - ./src/config/log_appender_xml
# - ./src/config/production_template.yaml
ls -la
echo "Creating zip file"
zip -9 -r ./${DIST_FILE_NAME}-${RELEASE_VERSION}-linux-x64.zip ${DIST_FILE_NAME}

# Add additional files to the zip file
cd src
echo "Adding additional files"
zip -9 -u -r "../${DIST_FILE_NAME}-${RELEASE_VERSION}-linux-x64.zip" "./config/production_template.yaml" "./config/log_appender_xml"

ls -la

# Return to repository root. Build artifacts are kept here so the workflow's
# later cleanup step can remove them without failing on already-missing files.
cd ..
