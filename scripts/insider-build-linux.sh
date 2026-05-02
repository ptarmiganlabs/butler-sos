#!/bin/bash
set -e

# Inject git SHA and date into package.json
GIT_SHA=$(git rev-parse --short HEAD)
DATE_STR=$(date +"%Y-%b-%d")
VERSION=$(grep -o '"version": "[^"]*"' package.json | cut -d'"' -f4)
sed -i "s/\"version\": \".*\"/\"version\": \"${VERSION}_${DATE_STR}_${GIT_SHA}\"/" package.json

# Get GitHub SHA for artifact naming
SHA=$GITHUB_SHA
SHA=${SHA:0:7}

./node_modules/.bin/esbuild src/bundle.js  --bundle --outfile=build.cjs --format=cjs --platform=node --target=node22 --inject:./src/lib/import-meta-url.js --define:import.meta.url=import_meta_url
node --experimental-sea-config src/sea-config.json

# Get a copy of the Node executable
cp $(command -v node) ${DIST_FILE_NAME}
npx postject ${DIST_FILE_NAME} NODE_SEA_BLOB sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2

# Compress insider's build
# Include following directories & files in the created archive file.
# - ./src/config/log_appender_xml
# - ./src/config/production_template.yaml
ls -la
zip -9 -r ./${DIST_FILE_NAME}--linux-x64--$SHA.zip ${DIST_FILE_NAME}

cd src
zip -9 -u -r "../${DIST_FILE_NAME}--linux-x64--$SHA.zip" "./config/production_template.yaml" "./config/log_appender_xml"

# -------------------
# Clean up
cd ..
rm build.cjs

ls -la
