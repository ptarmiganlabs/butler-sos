Write-Host "🔍 Starting Butler SOS log monitoring..."
Write-Host "Monitor run time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss UTC')"
Write-Host "Server: $env:SERVER_NAME"
Write-Host "Service: $env:BUTLER_SOS_INSIDER_SERVICE_NAME"
Write-Host "Deploy path: $env:BUTLER_SOS_INSIDER_DEPLOY_PATH"

$deployPath = $env:BUTLER_SOS_INSIDER_DEPLOY_PATH
$serviceName = $env:BUTLER_SOS_INSIDER_SERVICE_NAME
$currentDate = Get-Date -Format "yyyy-MM-dd"
$previousDate = (Get-Date).AddDays(-1).ToString("yyyy-MM-dd")

# Define log file paths
$serviceErrorLogPath = Join-Path $deployPath "service-error.log"
$currentDayLogPath = Join-Path $deployPath "log\butler-sos.$currentDate.log"
$previousDayLogPath = Join-Path $deployPath "log\butler-sos.$previousDate.log"

Write-Host "Checking log files:"
Write-Host "  Service error log: $serviceErrorLogPath"
Write-Host "  Current day log: $currentDayLogPath"
Write-Host "  Previous day log: $previousDayLogPath"

$errorFound = $false
$allErrorEntries = @()
$currentTotalLines = 0
$currentInfoCount = 0
$currentWarnCount = 0
$currentErrorCount = 0
$currentFatalCount = 0
$previousTotalLines = 0
$previousInfoCount = 0
$previousWarnCount = 0
$previousErrorCount = 0
$previousFatalCount = 0

try {
    # Check service-error.log
    Write-Host "📋 Checking service-error.log..."
    if (Test-Path $serviceErrorLogPath) {
        Write-Host "✅ Found service-error.log"
        $serviceErrorContent = Get-Content -Path $serviceErrorLogPath -ErrorAction SilentlyContinue
        if ($serviceErrorContent -and $serviceErrorContent.Count -gt 0) {
            Write-Host "❌ Errors found in service-error.log:" -ForegroundColor Red
            $serviceErrorContent | ForEach-Object { 
                Write-Host "  $_" -ForegroundColor Red 
                $allErrorEntries += "SERVICE-ERROR: $_"
            }
            $errorFound = $true
        }
        else {
            Write-Host "✅ service-error.log is empty"
        }
    }
    else {
        Write-Host "ℹ️  service-error.log does not exist"
    }
                      
    # Check current day log file
    Write-Host "📋 Checking current day log file..."
    if (Test-Path $currentDayLogPath) {
        Write-Host "✅ Found current day log file"
        $currentDayContent = Get-Content -Path $currentDayLogPath -ErrorAction SilentlyContinue
        if ($currentDayContent) {
            $currentTotalLines = $currentDayContent.Count
            $currentInfoCount = ($currentDayContent | Where-Object { $_ -match '(?i)\binfo[\s:]' }).Count
            $currentWarnCount = ($currentDayContent | Where-Object { $_ -match '(?i)\bwarn[\s:]' }).Count
            $currentErrorCount = ($currentDayContent | Where-Object { $_ -match '(?i)\berror[\s:]' }).Count
            $currentFatalCount = ($currentDayContent | Where-Object { $_ -match '(?i)\bfatal[\s:]' }).Count
                              
            # Check for error/fatal entries
            $errorEntries = $currentDayContent | Where-Object { $_ -match '(?i)\b(error|fatal)[\s:]' }
            if ($errorEntries -and $errorEntries.Count -gt 0) {
                Write-Host "❌ Error/Fatal entries found in current day log:" -ForegroundColor Red
                $errorEntries | ForEach-Object { 
                    Write-Host "  $_" -ForegroundColor Red 
                    $allErrorEntries += "CURRENT-DAY: $_"
                }
                $errorFound = $true
            }
            else {
                Write-Host "✅ No error/fatal entries in current day log"
            }
                              
            Write-Host "Current day log stats: Total=$currentTotalLines, Info=$currentInfoCount, Warn=$currentWarnCount, Error=$currentErrorCount, Fatal=$currentFatalCount"
        }
        else {
            Write-Host "ℹ️  Current day log file is empty"
        }
    }
    else {
        Write-Host "ℹ️  Current day log file does not exist"
    }

    # Check previous day log file
    Write-Host "📋 Checking previous day log file..."
    if (Test-Path $previousDayLogPath) {
        Write-Host "✅ Found previous day log file"
        $previousDayContent = Get-Content -Path $previousDayLogPath -ErrorAction SilentlyContinue
        if ($previousDayContent) {
            $previousTotalLines = $previousDayContent.Count
            $previousInfoCount = ($previousDayContent | Where-Object { $_ -match '(?i)\binfo[\s:]' }).Count
            $previousWarnCount = ($previousDayContent | Where-Object { $_ -match '(?i)\bwarn[\s:]' }).Count
            $previousErrorCount = ($previousDayContent | Where-Object { $_ -match '(?i)\berror[\s:]' }).Count
            $previousFatalCount = ($previousDayContent | Where-Object { $_ -match '(?i)\bfatal[\s:]' }).Count
                              
            # Check for error/fatal entries
            $errorEntries = $previousDayContent | Where-Object { $_ -match '(?i)\b(error|fatal)[\s:]' }
            if ($errorEntries -and $errorEntries.Count -gt 0) {
                Write-Host "❌ Error/Fatal entries found in previous day log:" -ForegroundColor Red
                $errorEntries | ForEach-Object { 
                    Write-Host "  $_" -ForegroundColor Red 
                    $allErrorEntries += "PREVIOUS-DAY: $_"
                }
                $errorFound = $true
            }
            else {
                Write-Host "✅ No error/fatal entries in previous day log"
            }
                              
            Write-Host "Previous day log stats: Total=$previousTotalLines, Info=$previousInfoCount, Warn=$previousWarnCount, Error=$previousErrorCount, Fatal=$previousFatalCount"
        }
        else {
            Write-Host "ℹ️  Previous day log file is empty"
        }
    }
    else {
        Write-Host "ℹ️  Previous day log file does not exist"
    }

    # Summary
    if ($errorFound) {
        Write-Host "❌ ERRORS DETECTED - Taking action!" -ForegroundColor Red
        $totalErrors = $allErrorEntries.Count
        Write-Host "Total error entries found: $totalErrors" -ForegroundColor Red
                          
        # Export error data for email step
        $errorData = @{
            ErrorFound          = $true
            ErrorEntries        = $allErrorEntries
            CurrentLogPath      = $currentDayLogPath
            PreviousLogPath     = $previousDayLogPath
            ServiceErrorLogPath = $serviceErrorLogPath
            CurrentTotalLines   = $currentTotalLines
            CurrentInfoCount    = $currentInfoCount
            CurrentWarnCount    = $currentWarnCount
            CurrentErrorCount   = $currentErrorCount
            CurrentFatalCount   = $currentFatalCount
            PreviousTotalLines  = $previousTotalLines
            PreviousInfoCount   = $previousInfoCount
            PreviousWarnCount   = $previousWarnCount
            PreviousErrorCount  = $previousErrorCount
            PreviousFatalCount  = $previousFatalCount
        }
                          
        # Save error data to file for next step
        $errorDataJson = $errorData | ConvertTo-Json -Depth 10
        $errorDataPath = Join-Path $env:TEMP "butler-sos-error-data.json"
        $errorDataJson | Out-File -FilePath $errorDataPath -Encoding UTF8
        Write-Host "Error data saved to: $errorDataPath"
                          
        # Set GitHub Actions output
        "errors_found=true" | Out-File -FilePath $env:GITHUB_OUTPUT -Append
        $errorCount = $allErrorEntries.Count
        "error_count=$errorCount" | Out-File -FilePath $env:GITHUB_OUTPUT -Append
                          
    }
    else {
        Write-Host "✅ No errors found in any log files - system appears healthy" -ForegroundColor Green
        "errors_found=false" | Out-File -FilePath $env:GITHUB_OUTPUT -Append
        "error_count=0" | Out-File -FilePath $env:GITHUB_OUTPUT -Append
    }

}
catch {
    # Log FULL exception details for debugging
    Write-Host ("Full exception: " + $_.Exception.ToString()) -ForegroundColor Red

    $errorMsg = $_.Exception.Message
    $stack = $_.Exception.StackTrace
    Write-Host ("❌ Failed to check log files: " + $errorMsg) -ForegroundColor Red
    Write-Host ("Stack trace: " + $stack) -ForegroundColor Red
    Write-Host ("::error::Log monitoring failed - " + $errorMsg)
    exit 1
}