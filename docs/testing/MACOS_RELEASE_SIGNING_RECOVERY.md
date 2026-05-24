# macOS Release Signing Recovery

This document describes how to recover from an interrupted or failed local macOS release signing rehearsal for Butler SOS. It is intended for maintainers who need to mimic the GitHub Actions `release-macos-arm64` job on a local Apple Silicon Mac or self-hosted macOS build host.

The goal is to exercise the same release path as CI while preserving the local keychain, generated artifacts, and working tree state.

## Scope

Use this guide when testing or recovering from local runs of `scripts/release-macos.sh`, including:

1. SEA binary preparation with `src/sea-config.json`.
2. Developer ID signing with the release certificate.
3. Hardened runtime signing with `release-config/butler-sos.entitlements`.
4. Release zip creation.
5. Notarization through `xcrun notarytool`.
6. Cleanup after failed or interrupted runs.

Do not store real secrets, certificates, passwords, generated `.p12` files, or notarization credentials in this document or in the repository.

## Safety Model

Never run the release script unguarded on a maintainer laptop. The script intentionally creates and uses a temporary keychain, temporarily changes the default keychain and keychain search list, and performs cleanup for legacy keychain names used by CI.

Before a local rehearsal, always:

1. Snapshot the current keychain state.
2. Use a disposable `RUNNER_TEMP` directory.
3. Preserve generated files that already exist.
4. Restore keychain state after the run, whether the script succeeds or fails.
5. Verify the working tree and keychain state before continuing.

The release script should create its temporary signing keychain under `RUNNER_TEMP` with a per-run name:

```text
${RUNNER_TEMP}/butler-sos-build-<run-id>-<attempt>-<job>-<pid>.keychain-db
```

Do not delete arbitrary local keychains. Only delete the disposable keychain path created for the rehearsal.

## Required Environment Variables

The local shell must have these variables set before running `scripts/release-macos.sh`:

| Variable | Purpose |
| --- | --- |
| `DIST_FILE_NAME` | Release binary name. Usually `butler-sos`. |
| `RELEASE_VERSION` | Version string used in the macOS zip name. |
| `MACOS_CERTIFICATE` | Base64 encoded Developer ID `.p12` certificate. |
| `MACOS_CERTIFICATE_PWD` | Password for the `.p12` certificate. |
| `MACOS_CERTIFICATE_NAME` | Developer ID Application certificate common name. |
| `MACOS_CI_KEYCHAIN_PWD` | Password for the disposable temporary keychain. |
| `PROD_MACOS_NOTARIZATION_APPLE_ID` | Apple ID used for notarization. |
| `PROD_MACOS_NOTARIZATION_TEAM_ID` | Apple Developer Team ID. |
| `PROD_MACOS_NOTARIZATION_PWD` | App-specific password for notarization. |

Use silent input for password-like values so they are not echoed on screen or stored in shell history:

```bash
read -s -p "MACOS_CERTIFICATE_PWD: " MACOS_CERTIFICATE_PWD; echo; export MACOS_CERTIFICATE_PWD
read -s -p "MACOS_CI_KEYCHAIN_PWD: " MACOS_CI_KEYCHAIN_PWD; echo; export MACOS_CI_KEYCHAIN_PWD
read -s -p "PROD_MACOS_NOTARIZATION_PWD: " PROD_MACOS_NOTARIZATION_PWD; echo; export PROD_MACOS_NOTARIZATION_PWD
```

For the base64 certificate, copy the secret value to the clipboard and import it without printing it:

```bash
export MACOS_CERTIFICATE="$(pbpaste)"
```

Set non-secret values directly:

```bash
export DIST_FILE_NAME="butler-sos"
export RELEASE_VERSION="15.0.1-local"
export MACOS_CERTIFICATE_NAME="Developer ID Application: Example Name (TEAMID)"
export PROD_MACOS_NOTARIZATION_APPLE_ID="name@example.com"
export PROD_MACOS_NOTARIZATION_TEAM_ID="TEAMID"
```

## Pre-Run Snapshot

Create a disposable working directory for recovery files:

```bash
RECOVERY_DIR="$(mktemp -d)"
export RUNNER_TEMP="${RECOVERY_DIR}/runner-temp"
mkdir -p "${RUNNER_TEMP}"
```

Capture the current keychain default and search list:

```bash
security default-keychain -d user | tr -d '"' | sed -e 's/^ *//' > "${RECOVERY_DIR}/default-keychain.before"
security list-keychains -d user | sed -e 's/^ *//' -e 's/"//g' > "${RECOVERY_DIR}/keychains.before"
```

Record whether a legacy local keychain exists. Do not delete it unless it is known to be disposable:

```bash
ls -l "${HOME}/Library/Keychains" | grep 'build.keychain' || true
```

Preserve generated files that may already exist in the repository root:

```bash
mkdir -p "${RECOVERY_DIR}/artifacts"

for file in \
    build.cjs \
    sea-prep.blob \
    certificate.p12 \
    DeveloperIDG2CA.cer \
    AppleIncRootCertificate.cer \
    "${DIST_FILE_NAME}" \
    "${DIST_FILE_NAME}-${RELEASE_VERSION}-macos-arm64.zip"; do
    if [[ -e "${file}" ]]; then
        cp -p "${file}" "${RECOVERY_DIR}/artifacts/${file//\//_}"
        printf '%s\n' "${file}" >> "${RECOVERY_DIR}/artifacts.before"
    fi
done
```

`sea-prep.blob` is often an untracked generated file. If it existed before the rehearsal, restore the original file after the run instead of keeping the newly generated blob by accident.

## Safe Local Rehearsal

Validate the script syntax before running the release path:

```bash
bash -n scripts/release-macos.sh
```

Run the release script only after the environment variables, keychain snapshot, and artifact snapshot are in place:

```bash
bash ./scripts/release-macos.sh
```

The script should:

1. Bundle `src/bundle.js` into `build.cjs`.
2. Generate `sea-prep.blob` from `src/sea-config.json`.
3. Copy the current Node.js executable to `butler-sos`.
4. Remove the original Node.js signature.
5. Inject the SEA blob with `postject`.
6. Create a temporary keychain under `RUNNER_TEMP`.
7. Import the Developer ID certificate and Apple Developer ID G2 intermediate.
8. Sign the binary with hardened runtime and entitlements.
9. Verify the signature.
10. Store a notarytool profile in the temporary keychain.
11. Create the release zip.
12. Submit the zip for notarization.

## Standard Recovery

Run these steps after every local release rehearsal, even when it succeeds.

### Restore Keychain State

Restore the original default keychain:

```bash
ORIGINAL_DEFAULT_KEYCHAIN="$(cat "${RECOVERY_DIR}/default-keychain.before")"

if [[ -n "${ORIGINAL_DEFAULT_KEYCHAIN}" ]]; then
    security default-keychain -d user -s "${ORIGINAL_DEFAULT_KEYCHAIN}"
fi
```

Restore the original keychain search list:

```bash
if [[ -s "${RECOVERY_DIR}/keychains.before" ]]; then
    security list-keychains -d user -s $(cat "${RECOVERY_DIR}/keychains.before")
fi
```

Delete only the disposable keychain path created under `RUNNER_TEMP`:

```bash
if [[ -n "${RUNNER_TEMP}" ]]; then
    security delete-keychain "${KEYCHAIN_PATH}" >/dev/null 2>&1 || true
    rm -f "${KEYCHAIN_PATH}"
fi
```

Do not run broad keychain deletion commands. In particular, do not delete local `login.keychain-db`, `metadata.keychain-db`, or other personal keychains.

### Restore Generated Files

Remove sensitive temporary files from the repository root:

```bash
rm -f certificate.p12 DeveloperIDG2CA.cer AppleIncRootCertificate.cer
```

Remove generated release outputs unless they are intentionally being inspected:

```bash
rm -f build.cjs
rm -f "${DIST_FILE_NAME}"
rm -f "${DIST_FILE_NAME}-${RELEASE_VERSION}-macos-arm64.zip"
```

Restore files that existed before the rehearsal:

```bash
if [[ -f "${RECOVERY_DIR}/artifacts/sea-prep.blob" ]]; then
    cp -p "${RECOVERY_DIR}/artifacts/sea-prep.blob" sea-prep.blob
else
    rm -f sea-prep.blob
fi
```

If other generated files existed before the rehearsal and must be preserved, restore them from `"${RECOVERY_DIR}/artifacts"` in the same way.

### Verify Recovery

Compare the current keychain state with the pre-run snapshot:

```bash
security default-keychain -d user | tr -d '"' | sed -e 's/^ *//' > "${RECOVERY_DIR}/default-keychain.after"
security list-keychains -d user | sed -e 's/^ *//' -e 's/"//g' > "${RECOVERY_DIR}/keychains.after"

diff -u "${RECOVERY_DIR}/default-keychain.before" "${RECOVERY_DIR}/default-keychain.after"
diff -u "${RECOVERY_DIR}/keychains.before" "${RECOVERY_DIR}/keychains.after"
```

Check the repository state:

```bash
git status --short
```

Only intentional source changes should remain.

## Failure Playbooks

### Interrupted Run Before Cleanup

Symptoms:

- The shell was closed or interrupted during signing or notarization.
- `security default-keychain -d user` still points at the temporary keychain.
- `security list-keychains -d user` still includes a `butler-sos-build-*.keychain-db` path.

Recovery:

1. Restore the default keychain from `default-keychain.before`.
2. Restore the keychain search list from `keychains.before`.
3. Delete only the disposable keychain path that was created under `RUNNER_TEMP`.
4. Remove `certificate.p12`, `DeveloperIDG2CA.cer`, and `AppleIncRootCertificate.cer`.
5. Restore or remove generated artifacts using the pre-run snapshot.
6. Run the verification commands in the previous section.

### Codesign Chain Failure

Symptoms:

```text
Warning: unable to build chain to self-signed root for signer "..."
./butler-sos: errSecInternalComponent
```

Diagnostics:

```bash
KEYCHAIN_PATH="$(find "${RUNNER_TEMP}" -maxdepth 1 -name 'butler-sos-build-*.keychain-db' -print -quit)"

security list-keychains -d user
security find-identity -v -p codesigning "${KEYCHAIN_PATH}"
security find-identity -v -p codesigning
security find-certificate -a -c "${MACOS_CERTIFICATE_NAME}" -Z "${KEYCHAIN_PATH}"
```

Expected checks:

1. The temporary keychain appears in the search list before signing.
2. `/System/Library/Keychains/SystemRootCertificates.keychain` appears in the search list before signing.
3. Exactly one intended Developer ID Application identity is visible.
4. The certificate issuer is Apple Developer ID G2.
5. Apple Root CA has been trusted only in the temporary keychain with `security add-trusted-cert -r trustRoot -p codeSign -k "${KEYCHAIN_PATH}" AppleIncRootCertificate.cer`.

Do not use `security add-trusted-cert` against login or system keychains as a first recovery step. Headless host trust-setting changes can fail and may modify permanent trust settings. It is safe to use `security add-trusted-cert` against the disposable per-run keychain created under `RUNNER_TEMP`.

### Certificate Import Failure

Symptoms:

- `security import certificate.p12` fails.
- `security find-identity -v -p codesigning "${KEYCHAIN_PATH}"` shows no valid identities.

Recovery:

1. Confirm `MACOS_CERTIFICATE` is set without printing it:

    ```bash
    [[ -n "${MACOS_CERTIFICATE}" ]] && echo "MACOS_CERTIFICATE is set"
    ```

2. Confirm `MACOS_CERTIFICATE_PWD` is set without printing it:

    ```bash
    [[ -n "${MACOS_CERTIFICATE_PWD}" ]] && echo "MACOS_CERTIFICATE_PWD is set"
    ```

3. Remove any partially decoded certificate file:

    ```bash
    rm -f certificate.p12
    ```

4. Re-enter the secret values using silent input and rerun the rehearsal from a clean `RUNNER_TEMP`.

### Key Partition List Failure

Symptoms:

- `security set-key-partition-list` fails.
- `codesign` prompts for key access or returns an access-related failure.

Diagnostics:

```bash
security unlock-keychain -p "${MACOS_CI_KEYCHAIN_PWD}" "${KEYCHAIN_PATH}"
security set-keychain-settings -t 3600 -l "${KEYCHAIN_PATH}"
security find-identity -v -p codesigning "${KEYCHAIN_PATH}"
```

Recovery:

1. Confirm the temporary keychain password is correct.
2. Delete the disposable keychain path.
3. Start again with a fresh `RUNNER_TEMP`.

### Notarytool Profile Failure

Symptoms:

- `xcrun notarytool store-credentials` fails.
- `xcrun notarytool submit` cannot find `notarytool-profile`.

Diagnostics:

```bash
xcrun notarytool history --apple-id "${PROD_MACOS_NOTARIZATION_APPLE_ID}" --team-id "${PROD_MACOS_NOTARIZATION_TEAM_ID}" --password "${PROD_MACOS_NOTARIZATION_PWD}"
```

Recovery:

1. Confirm notarization variables are set without printing values.
2. Re-enter `PROD_MACOS_NOTARIZATION_PWD` with silent input.
3. Rerun with a fresh disposable keychain, because the notary profile is stored in that temporary keychain.

### Notarization Rejection

Symptoms:

- Signing succeeds.
- The zip is submitted.
- `xcrun notarytool submit --wait` returns a rejection.

Diagnostics:

```bash
xcrun notarytool history --keychain-profile "notarytool-profile" --keychain "${KEYCHAIN_PATH}"
xcrun notarytool log "<submission-id>" --keychain-profile "notarytool-profile" --keychain "${KEYCHAIN_PATH}"
```

Recovery:

1. Read the notarization log for the rejected file path and reason.
2. Verify the binary before zip creation:

    ```bash
    codesign -vvv --deep --strict "./${DIST_FILE_NAME}"
    spctl --assess --type execute --verbose "./${DIST_FILE_NAME}"
    ```

3. Fix the signing or packaging issue before resubmitting.

### Leftover Generated Files

Symptoms:

- `git status --short` shows generated files after cleanup.
- Existing `sea-prep.blob` was replaced by a new blob.

Recovery:

1. Remove generated files that did not exist before the run.
2. Restore `sea-prep.blob` from `"${RECOVERY_DIR}/artifacts/sea-prep.blob"` if it existed before the run.
3. Re-run `git status --short`.

## Diagnostic Commands

Use these commands when investigating a local signing or notarization failure. Avoid printing secret values.

```bash
security default-keychain -d user
security list-keychains -d user
security find-identity -v -p codesigning
security find-certificate -a -c "${MACOS_CERTIFICATE_NAME}" -Z "${KEYCHAIN_PATH}"
codesign -dv --verbose=4 "./${DIST_FILE_NAME}" || true
codesign -vvv --deep --strict "./${DIST_FILE_NAME}"
spctl --assess --type execute --verbose "./${DIST_FILE_NAME}"
xcrun notarytool history --keychain-profile "notarytool-profile" --keychain "${KEYCHAIN_PATH}"
git status --short
```

## Related Files

- `scripts/release-macos.sh`: macOS release build, signing, zip, and notarization script.
- `scripts/insider-build-mac.sh`: passing macOS insider build reference flow.
- `.github/workflows/ci.yaml`: release workflow contract and environment variable wiring.
- `release-config/butler-sos.entitlements`: entitlements used for Developer ID signing.
- `src/sea-config.json`: Node SEA configuration used to generate `sea-prep.blob`.

## Final Checklist

Before leaving the machine after a failed local release rehearsal:

1. `security default-keychain -d user` matches the pre-run snapshot.
2. `security list-keychains -d user` matches the pre-run snapshot.
3. The disposable `RUNNER_TEMP` keychain has been deleted.
4. `certificate.p12`, `DeveloperIDG2CA.cer`, and `AppleIncRootCertificate.cer` are removed from the repository root.
5. Generated binaries and release zips are removed unless intentionally retained.
6. Existing `sea-prep.blob` has been restored or removed according to the pre-run snapshot.
7. `git status --short` shows only intentional source changes.
