# Platform: Windows only
# Requires: Node.js, esbuild, PowerShell, Windows SDK (signtool.exe)
$ErrorActionPreference = 'Stop'

# Inject git SHA and date into package.json
$GIT_SHA = (git rev-parse --short HEAD)
$DATE_STR = (Get-Date -Format "yyyy-MMM-dd")
(Get-Content package.json) -replace '"version": "(.*?)"', ('"version": "$1_' + $DATE_STR + '_' + $GIT_SHA + '"') | Set-Content package.json

# Get GitHub SHA for artifact naming
$SHA = $env:GITHUB_SHA

# Create a single JS file using esbuild
./node_modules/.bin/esbuild "src/bundle.js" --bundle --outfile=build.cjs --format=cjs --platform=node --target=node22 --inject:./src/lib/import-meta-url.js --define:import.meta.url=import_meta_url

# Generate blob to be injected into the binary
node --experimental-sea-config src/sea-config.json

# Get a copy of the Node executable
node -e "require('fs').copyFileSync(process.execPath, '${env:DIST_FILE_NAME}.exe')" 

pwd
dir


# -------------------
# Remove node.exe's own signature before postject changes the file. signtool is found by search,
# as in release-win.ps1, because the Windows SDK version in its path differs between machines.
$signtool = Get-ChildItem "${env:ProgramFiles(x86)}\Windows Kits\10\bin\*\x64\signtool.exe" -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending | Select-Object -First 1
if (-not $signtool) { throw 'signtool.exe not found. Install the signing tools from the Windows SDK.' }
& $signtool.FullName remove /s "./${env:DIST_FILE_NAME}.exe"
if ($LASTEXITCODE -ne 0) { throw "signtool remove failed with exit code $LASTEXITCODE" }

npx --no-install postject "${env:DIST_FILE_NAME}.exe" NODE_SEA_BLOB sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2
if ($LASTEXITCODE -ne 0) { throw "postject failed with exit code $LASTEXITCODE" }

# Insider builds are not code-signed. Release builds are signed through Azure Artifact Signing
# in ci.yaml.

# -------------------
# Create insider's build zip
$compress = @{
  Path = "./${env:DIST_FILE_NAME}.exe"
  CompressionLevel = "Fastest"
  DestinationPath = "${env:DIST_FILE_NAME}--win-x64--$SHA.zip"
}
Compress-Archive @compress

# Add following directories & files to the created zip file, in the ./config directory.
# - ./src/config/production_template.yaml
# - ./src/config/log_appender_xml
# Also add THIRD-PARTY-NOTICES.md at the archive root.
mkdir config 2>$null
Copy-Item -Path ./src/config/log_appender_xml -Destination ./config/ -Recurse
Copy-Item -Path ./src/config/production_template.yaml -Destination ./config/

Compress-Archive -Path "./config" -Update -DestinationPath "./${env:DIST_FILE_NAME}--win-x64--$SHA.zip"
Compress-Archive -Path "./THIRD-PARTY-NOTICES.md" -Update -DestinationPath "./${env:DIST_FILE_NAME}--win-x64--$SHA.zip"


# -------------------
# Clean up
Remove-Item -Force build.cjs -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force ./config -ErrorAction SilentlyContinue

dir
