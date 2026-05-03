#!/usr/bin/env bash
set -e

# Create a single JS file using esbuild
./node_modules/.bin/esbuild src/bundle.js  --bundle --outfile=build.cjs --format=cjs --platform=node --target=node22 --inject:./src/lib/import-meta-url.js --define:import.meta.url=import_meta_url

NODE_EXECUTABLE="$(node -p 'process.execPath')"

# Generate blob to be injected into the binary
"${NODE_EXECUTABLE}" --experimental-sea-config src/sea-config.json

# Get a copy of the Node executable
cp "${NODE_EXECUTABLE}" "${DIST_FILE_NAME}"

# Remove the signature from the Node executable
codesign --remove-signature ${DIST_FILE_NAME}

# Inject the blob
npx postject ${DIST_FILE_NAME} NODE_SEA_BLOB sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 --macho-segment-name NODE_SEA

security delete-keychain build.keychain || true

pwd
ls -la

# Start signing of the binary

# -------------------
# We need to create a new keychain, otherwise using the certificate will prompt
# with a UI dialog asking for the certificate password, which we can't
# use in a headless CI environment

# Turn our base64-encoded certificate back to a regular .p12 file              
echo "DEBUG: Decoding certificate from base64"
printf '%s' "$MACOS_CERTIFICATE" | base64 --decode > certificate.p12

echo "DEBUG: Setting KEYCHAIN_NAME environment variable"
export KEYCHAIN_NAME="build.keychain"

echo "DEBUG: Creating new keychain"
security create-keychain -p "$MACOS_CI_KEYCHAIN_PWD" "${KEYCHAIN_NAME}"

echo "DEBUG: Getting current keychain list"
OLD_KEYCHAIN_NAMES=$(security list-keychains -d user | sed -e 's/"//g' | xargs)
echo "DEBUG: Current keychains: ${OLD_KEYCHAIN_NAMES}"

echo "DEBUG: Setting keychain search list"
security list-keychains -d user -s "${KEYCHAIN_NAME}" ${OLD_KEYCHAIN_NAMES}

echo "DEBUG: Getting current default keychain"
DEFAULT_KEYCHAIN=$(security default-keychain -d user | sed -e 's/"//g' | xargs)
echo "DEBUG: Default keychain is: ${DEFAULT_KEYCHAIN}"

echo "DEBUG: Setting our keychain as default"
security default-keychain -d user -s "${KEYCHAIN_NAME}"

echo "DEBUG: Unlocking keychain"
security unlock-keychain -p "$MACOS_CI_KEYCHAIN_PWD" "${KEYCHAIN_NAME}"

echo "DEBUG: Importing certificate into keychain"
security import certificate.p12 -k "${KEYCHAIN_NAME}" -P "$MACOS_CERTIFICATE_PWD" -T /usr/bin/codesign

echo "DEBUG: Setting keychain timeout to prevent locking"
security set-keychain-settings -t 3600 -l "${KEYCHAIN_NAME}"

echo "DEBUG: Setting key partition list"
security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$MACOS_CI_KEYCHAIN_PWD" "${KEYCHAIN_NAME}"

echo "DEBUG: Performing codesign operation"
codesign --force -s "$MACOS_CERTIFICATE_NAME" -v "./${DIST_FILE_NAME}" --deep --strict --options=runtime --timestamp --entitlements ./release-config/${DIST_FILE_NAME}.entitlements

echo "DEBUG: Verifying code signature"
codesign -vvv --deep --strict "./${DIST_FILE_NAME}"

# -------------------
# Notarize
# Store the notarization credentials so that we can prevent a UI password dialog from blocking the CI
echo "Create keychain profile"
# Get the absolute path to the keychain in ~/Library/Keychains/ with the -db suffix macOS adds to keychain files
KEYCHAIN_PATH=~/Library/Keychains/${KEYCHAIN_NAME}-db
echo "DEBUG: Using keychain at path: ${KEYCHAIN_PATH}"
xcrun notarytool store-credentials "notarytool-profile" --apple-id "$PROD_MACOS_NOTARIZATION_APPLE_ID" --team-id "$PROD_MACOS_NOTARIZATION_TEAM_ID" --password "$PROD_MACOS_NOTARIZATION_PWD" --keychain "${KEYCHAIN_PATH}"

# -------------------
# We can't notarize an app bundle directly, but we need to compress it as an archive.
# Therefore, we create a zip file containing our app bundle, so that we can send it to the
# notarization service
# Notarize insider binary
echo "Creating temp notarization archive for release build"
zip -r "./${DIST_FILE_NAME}-${RELEASE_VERSION}-macos-arm64.zip" "./${DIST_FILE_NAME}" -x "*.DS_Store"

# Add additional files to the zip file
cd src
zip -u -r "../${DIST_FILE_NAME}-${RELEASE_VERSION}-macos-arm64.zip" "./config/production_template.yaml" "./config/log_appender_xml" -x "*.DS_Store"
cd ..

# Here we send the notarization request to the Apple's Notarization service, waiting for the result.
echo "Notarize release app"
xcrun notarytool submit "./${DIST_FILE_NAME}-${RELEASE_VERSION}-macos-arm64.zip" --keychain-profile "notarytool-profile" --wait --keychain "${KEYCHAIN_PATH}"

echo "DEBUG: Restoring original default keychain"
security default-keychain -d user -s "$DEFAULT_KEYCHAIN" || echo "WARNING: Failed to restore default keychain, continuing anyway"

echo "DEBUG: Restoring original keychain list"
security list-keychains -d user -s ${OLD_KEYCHAIN_NAMES} || echo "WARNING: Failed to restore keychain list, continuing anyway"

# -------------------
# Clean up
# Delete build keychain
security delete-keychain build.keychain

ls -la
