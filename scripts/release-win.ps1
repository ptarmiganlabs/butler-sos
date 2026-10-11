# Platform: Windows only
# Requires: Node.js, the npm dependencies (npm ci), PowerShell, Windows SDK (signtool.exe)
#
# Builds the unsigned Windows release binary, butler-sos.exe, and a SHA-256 digest of it,
# butler-sos.exe.sha256, in the repository root. Signing happens elsewhere.
#
# In a release, ci.yaml's build-win64 job runs this script, sign-win64 signs the result through
# Azure Artifact Signing, and publish-win64 zips it with the config templates and attaches the zip
# to the release. sign-win64 holds the signing credential and runs none of this code, which is why
# this script stops at an unsigned binary. The digest is how sign-win64 knows that the file it signs
# is the file this built.
$ErrorActionPreference = 'Stop'

$name = if ($env:DIST_FILE_NAME) { $env:DIST_FILE_NAME } else { 'butler-sos' }
$binary = "./$name.exe"

# -------------------
# Bundle the app into one file, and turn that into the blob the executable carries.
./node_modules/.bin/esbuild "src/bundle.js" --bundle --outfile=build.cjs --format=cjs --platform=node --target=node22 --inject:./src/lib/import-meta-url.js --define:import.meta.url=import_meta_url
if ($LASTEXITCODE -ne 0) { throw "esbuild failed with exit code $LASTEXITCODE" }

node --experimental-sea-config src/sea-config.json
if ($LASTEXITCODE -ne 0) { throw "Generating the SEA blob failed with exit code $LASTEXITCODE" }

# -------------------
# Start from a copy of the Node.js executable running this script.
node -e "require('fs').copyFileSync(process.execPath, '$name.exe')"
if ($LASTEXITCODE -ne 0) { throw "Copying node.exe failed with exit code $LASTEXITCODE" }

# Remove node.exe's own signature before postject changes the file. Left in place, it no longer
# matches the contents, and Windows reports the binary as tampered with rather than as unsigned.
# signtool is found by search, because the Windows SDK version in its path differs between
# machines; the hard-coded 10.0.22621.0 path this used to have only existed on one of them.
$signtool = Get-ChildItem "${env:ProgramFiles(x86)}\Windows Kits\10\bin\*\x64\signtool.exe" -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending | Select-Object -First 1
if (-not $signtool) { throw 'signtool.exe not found. Install the signing tools from the Windows SDK.' }
& $signtool.FullName remove /s $binary
if ($LASTEXITCODE -ne 0) { throw "signtool remove failed with exit code $LASTEXITCODE" }

npx --no-install postject $binary NODE_SEA_BLOB sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2
if ($LASTEXITCODE -ne 0) { throw "postject failed with exit code $LASTEXITCODE" }

# -------------------
# Smoke-test it. A binary that cannot start is not worth signing, and this is the cheapest check
# that postject produced something that runs. It must also report the version being built.
$expected = node -p "require('./package.json').version"
$reported = (& $binary --version | Out-String).Trim()
if ($LASTEXITCODE -ne 0) { throw "The built binary failed to run: --version exited $LASTEXITCODE." }
if ($reported -notmatch [regex]::Escape($expected)) {
    throw "The built binary reports version '$reported', expected '$expected'."
}
Write-Host "smoke test: --version reports $reported"

# -------------------
# Check that it is unsigned rather than signed badly: sign-win64 signs a clean file or nothing.
$status = (Get-AuthenticodeSignature -LiteralPath $binary).Status
if ($status -ne 'NotSigned') { throw "The built binary should carry no signature; Windows reports '$status'." }

# -------------------
# Record what was built.
$hash = (Get-FileHash -LiteralPath $binary -Algorithm SHA256).Hash
Set-Content -LiteralPath "$binary.sha256" -Value $hash -Encoding ascii
Write-Host "unsigned SHA256: $hash"
Get-ChildItem $binary, "$binary.sha256"
