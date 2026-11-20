# Platform: Windows (PowerShell 5.1 and 7), and PowerShell 7 elsewhere
# Requires: PowerShell

# Whether a binary's --version report says it is the version being built.
#
# Used by scripts/release-win.ps1's smoke test, and checked by scripts/diag/win-version-check.ps1.
#
# A stock build prints its version alone, so one line has to be exactly "<version>" (with an
# optional leading "v"): a substring match would also accept 15.1.10 for 15.1.1, or an error
# message that happens to mention the version. A variant build - one that bundled its own
# extensions module - names itself on its first line, as "butler-sos <version> (<variant>)"
# (src/lib/util/version-report.js), and is the version being built all the same. The labelled
# detail lines under that headline - core, the variant's own version, the build date - never stand
# in for it.
function Test-VersionReport {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [AllowEmptyString()]
        [string] $Report,

        [Parameter(Mandatory = $true)]
        [string] $Version
    )

    $escaped = [regex]::Escape($Version)

    return ($Report -match "(?m)^\s*v?$escaped\s*$") -or
        ($Report -match "(?m)^\s*butler-sos $escaped \([^)\r\n]+\)\s*$")
}
