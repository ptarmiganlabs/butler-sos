# Platform: Windows (PowerShell 5.1 and 7), and PowerShell 7 elsewhere
# Requires: PowerShell
$ErrorActionPreference = 'Stop'

# Checks Test-VersionReport in scripts/lib/version-report.ps1, the --version match that
# scripts/release-win.ps1 applies to every binary it builds. That script runs only once a release
# is being built, after bundling and injecting, so a match that refused a good binary, or accepted a
# wrong one, would otherwise first be found by a release. Here it is fed reports in the shapes the
# binary prints (src/lib/util/version-report.js), with no build at all.
. "$PSScriptRoot/../lib/version-report.ps1"

Write-Host "PowerShell $($PSVersionTable.PSVersion) ($($PSVersionTable.PSEdition))"

# What a stock build reports, and what a variant build reports when its description names the
# variant `acme`.
$stock = @('15.1.1')
$variant = @('butler-sos 15.1.1 (acme)', '  core    15.1.1', '  acme    2.1.0', '  built   2026-10-24')

$cases = @(
    @{ Name = 'a stock build'; Lines = $stock; Accept = $true },
    @{ Name = 'a stock build with a leading v'; Lines = @('v15.1.1'); Accept = $true },
    @{ Name = 'a variant build'; Lines = $variant; Accept = $true },
    @{ Name = 'a later patch release'; Lines = @('15.1.10'); Accept = $false },
    @{ Name = 'a variant of a later patch release'; Lines = @('butler-sos 15.1.10 (acme)', '  core    15.1.10'); Accept = $false },
    @{ Name = 'the detail lines without their headline'; Lines = @('  core    15.1.1', '  acme    2.1.0'); Accept = $false },
    @{ Name = 'an error that mentions the version'; Lines = @('Error: butler-sos 15.1.1 failed to start'); Accept = $false },
    @{ Name = 'brackets with no variant in them'; Lines = @('butler-sos 15.1.1 ()'); Accept = $false },
    @{ Name = 'text after the variant'; Lines = @('butler-sos 15.1.1 (acme) and more'); Accept = $false },
    @{ Name = 'nothing at all'; Lines = @(''); Accept = $false }
)

# Joined both ways: Out-String ends lines with CRLF on Windows, and the match must not depend on
# which.
$newlines = @(
    @{ Name = 'LF'; Value = "`n" },
    @{ Name = 'CRLF'; Value = "`r`n" }
)

$failures = @()

foreach ($case in $cases) {
    foreach ($newline in $newlines) {
        $report = $case.Lines -join $newline.Value
        $accepted = Test-VersionReport -Report $report -Version '15.1.1'
        $label = "$($case.Name), $($newline.Name)"

        if ($accepted -ne $case.Accept) {
            $failures += "${label}: expected accepted=$($case.Accept), got accepted=$accepted"
        }
        else {
            Write-Host "ok: $label (accepted=$accepted)"
        }
    }
}

if ($failures.Count -gt 0) {
    throw ("Test-VersionReport got {0} case(s) wrong:`n  {1}" -f $failures.Count, ($failures -join "`n  "))
}

Write-Host "ok: Test-VersionReport accepts a stock and a variant report of 15.1.1, and refuses every other shape."
