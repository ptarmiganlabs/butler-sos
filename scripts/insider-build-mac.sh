#!/usr/bin/env bash
set -e

KEYCHAIN_LABEL="${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-0}-${GITHUB_JOB:-macos}-$$"
KEYCHAIN_LABEL=$(printf '%s' "${KEYCHAIN_LABEL}" | tr -cd '[:alnum:]_.-')
KEYCHAIN_NAME="butler-sos-build-${KEYCHAIN_LABEL}.keychain-db"
KEYCHAIN_PATH="${RUNNER_TEMP:-${TMPDIR:-/tmp}}/${KEYCHAIN_NAME}"
SYSTEM_ROOTS_KEYCHAIN="/System/Library/Keychains/SystemRootCertificates.keychain"
LOGIN_KEYCHAIN="${HOME}/Library/Keychains/login.keychain-db"
DEFAULT_KEYCHAIN=""
declare -a OLD_KEYCHAIN_NAMES=()

cleanup_keychain_state() {
	local exit_code="$1"

	local restore_keychain="${DEFAULT_KEYCHAIN}"
	if [[ ! -f "${restore_keychain}" && -f "${LOGIN_KEYCHAIN}" ]]; then
		restore_keychain="${LOGIN_KEYCHAIN}"
	fi

	if [[ -n "${restore_keychain}" ]]; then
		echo "DEBUG: Restoring original default keychain"
		security default-keychain -d user -s "${restore_keychain}" || echo "WARNING: Failed to restore default keychain, continuing anyway"
	fi

	if ((${#OLD_KEYCHAIN_NAMES[@]})); then
		echo "DEBUG: Restoring original keychain list"
		security list-keychains -d user -s "${OLD_KEYCHAIN_NAMES[@]}" || echo "WARNING: Failed to restore keychain list, continuing anyway"
	fi

	security delete-keychain "${KEYCHAIN_PATH}" >/dev/null 2>&1 || true
	rm -f "${KEYCHAIN_PATH}"
	rm -f build.cjs certificate.p12 DeveloperIDG2CA.cer

	return "${exit_code}"
}

trap 'cleanup_keychain_state $?' EXIT

# Inject git SHA and date into package.json
GIT_SHA=$(git rev-parse --short HEAD)
DATE_STR=$(date +"%Y-%b-%d")
VERSION=$(grep -o '"version": "[^"]*"' package.json | cut -d'"' -f4)
sed -i '' "s/\"version\": \".*\"/\"version\": \"${VERSION}_${DATE_STR}_${GIT_SHA}\"/" package.json

# Get GitHub SHA for artifact naming
SHA=$GITHUB_SHA

# Create a single JS file using esbuild
./node_modules/.bin/esbuild src/bundle.js  --bundle --outfile=build.cjs --format=cjs --platform=node --target=node22 --inject:./src/lib/import-meta-url.js --define:import.meta.url=import_meta_url

# Generate blob to be injected into the binary
node --experimental-sea-config src/sea-config.json

# Get a copy of the Node executable
cp "$(node -p 'process.execPath')" "${DIST_FILE_NAME}"

# Remove the signature from the Node executable
codesign --remove-signature ${DIST_FILE_NAME}

# Inject the blob
npx postject ${DIST_FILE_NAME} NODE_SEA_BLOB sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 --macho-segment-name NODE_SEA

security delete-keychain "${KEYCHAIN_PATH}" >/dev/null 2>&1 || true
rm -f "${KEYCHAIN_PATH}"

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

echo "DEBUG: Using temporary keychain path: ${KEYCHAIN_PATH}"

echo "DEBUG: Creating new keychain"
security create-keychain -p "$MACOS_CI_KEYCHAIN_PWD" "${KEYCHAIN_PATH}"

echo "DEBUG: Getting current keychain list"
while IFS= read -r keychain_name; do
	OLD_KEYCHAIN_NAMES+=("${keychain_name}")
done < <(security list-keychains -d user | sed -e 's/^ *//' -e 's/"//g')
echo "DEBUG: Current keychains: ${OLD_KEYCHAIN_NAMES[*]}"

echo "DEBUG: Setting keychain search list"
security list-keychains -d user -s "${KEYCHAIN_PATH}" "${OLD_KEYCHAIN_NAMES[@]}" "${SYSTEM_ROOTS_KEYCHAIN}"

echo "DEBUG: Getting current default keychain"
DEFAULT_KEYCHAIN=$(security default-keychain -d user | tr -d '"' | tr -d '\n' | sed -e 's/^ *//')
echo "DEBUG: Default keychain is: ${DEFAULT_KEYCHAIN}"

echo "DEBUG: Setting our keychain as default"
security default-keychain -d user -s "${KEYCHAIN_PATH}"

echo "DEBUG: Unlocking keychain"
security unlock-keychain -p "$MACOS_CI_KEYCHAIN_PWD" "${KEYCHAIN_PATH}"

echo "DEBUG: Importing certificate into keychain"
security import certificate.p12 -k "${KEYCHAIN_PATH}" -P "$MACOS_CERTIFICATE_PWD" -T /usr/bin/codesign -A

echo "DEBUG: Importing Apple Developer ID G2 intermediate CA"
curl -f -L -sS -o DeveloperIDG2CA.cer https://www.apple.com/certificateauthority/DeveloperIDG2CA.cer
security import DeveloperIDG2CA.cer -k "${KEYCHAIN_PATH}"
rm DeveloperIDG2CA.cer

echo "DEBUG: Setting keychain timeout to prevent locking"
security set-keychain-settings -t 3600 -l "${KEYCHAIN_PATH}"

echo "DEBUG: Setting key partition list"
security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$MACOS_CI_KEYCHAIN_PWD" "${KEYCHAIN_PATH}"

echo "DEBUG: Default keychain after setup"
security default-keychain -d user || true

echo "DEBUG: Keychain search list after setup"
security list-keychains -d user || true

echo "DEBUG: Confirming system roots keychain is accessible"
security list-keychains -d user | grep -F "${SYSTEM_ROOTS_KEYCHAIN}" || true

echo "DEBUG: Available codesigning identities in build keychain"
security find-identity -v -p codesigning "${KEYCHAIN_PATH}" || true

echo "DEBUG: Available codesigning identities across search list"
security find-identity -v -p codesigning || true

echo "DEBUG: Certificates matching signer name in build keychain"
security find-certificate -a -c "$MACOS_CERTIFICATE_NAME" -Z "${KEYCHAIN_PATH}" || true

echo "DEBUG: Performing codesign operation"
codesign --keychain "${KEYCHAIN_PATH}" --force -s "$MACOS_CERTIFICATE_NAME" -v "./${DIST_FILE_NAME}" --deep --strict --options=runtime --timestamp --entitlements ./release-config/${DIST_FILE_NAME}.entitlements

echo "DEBUG: Verifying code signature"
codesign -vvv --deep --strict "./${DIST_FILE_NAME}"

# -------------------
# Notarize
# Store the notarization credentials so that we can prevent a UI password dialog from blocking the CI
echo "Create keychain profile"
# xcrun notarytool store-credentials "notarytool-profile" --apple-id "$PROD_MACOS_NOTARIZATION_APPLE_ID" --team-id "$PROD_MACOS_NOTARIZATION_TEAM_ID" --password "$PROD_MACOS_NOTARIZATION_PWD"
#xcrun notarytool store-credentials "notarytool-profile" --apple-id "$PROD_MACOS_NOTARIZATION_APPLE_ID" --team-id "$PROD_MACOS_NOTARIZATION_TEAM_ID" --password "$PROD_MACOS_NOTARIZATION_PWD" --keychain "${KEYCHAIN_NAME}"
echo "DEBUG: Using keychain at path: ${KEYCHAIN_PATH}"
xcrun notarytool store-credentials "notarytool-profile" --apple-id "$PROD_MACOS_NOTARIZATION_APPLE_ID" --team-id "$PROD_MACOS_NOTARIZATION_TEAM_ID" --password "$PROD_MACOS_NOTARIZATION_PWD" --keychain "${KEYCHAIN_PATH}"

# -------------------
# We can't notarize an app bundle directly, but we need to compress it as an archive.
# Therefore, we create a zip file containing our app bundle, so that we can send it to the
# notarization service
# Notarize insider binary
echo "Creating temp notarization archive for insider build"
zip -r "./${DIST_FILE_NAME}--macos-arm64--$SHA.zip" "./${DIST_FILE_NAME}" -x "*.DS_Store"
zip -u "./${DIST_FILE_NAME}--macos-arm64--$SHA.zip" "./THIRD-PARTY-NOTICES.md" -x "*.DS_Store"

# Add additional files to the zip file
cd src
zip -u -r "../${DIST_FILE_NAME}--macos-arm64--$SHA.zip" "./config/production_template.yaml" "./config/log_appender_xml" -x "*.DS_Store"
cd ..

# Here we send the notarization request to the Apple's Notarization service, waiting for the result.
echo "Notarize insider app"
# xcrun notarytool submit "./${DIST_FILE_NAME}--macos-arm64--$SHA.zip" --keychain-profile "notarytool-profile" --wait
# xcrun notarytool submit "./${DIST_FILE_NAME}--macos-arm64--$SHA.zip" --keychain-profile "notarytool-profile" --wait --keychain "${KEYCHAIN_NAME}"
xcrun notarytool submit "./${DIST_FILE_NAME}--macos-arm64--$SHA.zip" --keychain-profile "notarytool-profile" --wait --keychain "${KEYCHAIN_PATH}"

ls -la
