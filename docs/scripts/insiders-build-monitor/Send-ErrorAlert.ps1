# Send-ErrorAlert.ps1
# Generic script for sending service error alerts using email templates
# Used by log monitoring workflows

param(
    [Parameter(Mandatory = $true)]
    [string]$SmtpServer,
    
    [Parameter(Mandatory = $true)]
    [int]$SmtpPort,
    
    [Parameter(Mandatory = $true)]
    [string]$From,
    
    [Parameter(Mandatory = $true)]
    [string]$To,
    
    [Parameter(Mandatory = $true)]
    [string]$ServerName,
    
    [Parameter(Mandatory = $true)]
    [string]$ServiceName,
    
    [Parameter(Mandatory = $true)]
    [array]$ErrorEntries,
    
    [Parameter(Mandatory = $false)]
    [string]$Username,
    
    [Parameter(Mandatory = $false)]
    $Password,  # Accept both string and SecureString for PS 5.1 compatibility
    
    [Parameter(Mandatory = $false)]
    [string]$CurrentLogPath = "N/A",
    
    [Parameter(Mandatory = $false)]
    [string]$PreviousLogPath = "N/A",
    
    [Parameter(Mandatory = $false)]
    [string]$ServiceErrorLogPath = "N/A",
    
    [Parameter(Mandatory = $false)]
    [int]$CurrentTotalLines = 0,
    
    [Parameter(Mandatory = $false)]
    [int]$CurrentInfoCount = 0,
    
    [Parameter(Mandatory = $false)]
    [int]$CurrentWarnCount = 0,
    
    [Parameter(Mandatory = $false)]
    [int]$CurrentErrorCount = 0,
    
    [Parameter(Mandatory = $false)]
    [int]$CurrentFatalCount = 0,
    
    [Parameter(Mandatory = $false)]
    [int]$PreviousTotalLines = 0,
    
    [Parameter(Mandatory = $false)]
    [int]$PreviousInfoCount = 0,
    
    [Parameter(Mandatory = $false)]
    [int]$PreviousWarnCount = 0,
    
    [Parameter(Mandatory = $false)]
    [int]$PreviousErrorCount = 0,
    
    [Parameter(Mandatory = $false)]
    [int]$PreviousFatalCount = 0,
    
    [Parameter(Mandatory = $false)]
    [switch]$UseSSL,
    
    [Parameter(Mandatory = $true)]
    [string]$TemplatePath
)

try {
    Write-Host "=== Send-ErrorAlert.ps1 Starting ==="
    Write-Host "PowerShell Version: $($PSVersionTable.PSVersion)"
    Write-Host "SMTP Server: $SmtpServer"
    Write-Host "SMTP Port: $SmtpPort"
    Write-Host "From: $From"
    Write-Host "To: $To"
    Write-Host "Template Path: $TemplatePath"
    Write-Host "Error Entries Count: $($ErrorEntries.Count)"
    
    Write-Host "Preparing service error alert email..."
    
    # Read email template
    if (-not (Test-Path $TemplatePath)) {
        throw "Email template not found at: $TemplatePath"
    }
    
    Write-Host "Loading email template from: $TemplatePath"
    $template = Get-Content -Path $TemplatePath -Raw -Encoding UTF8
    
    # Prepare error entries HTML
    $errorEntriesHtml = ""
    $errorCount = 0
    
    if ($ErrorEntries -and $ErrorEntries.Count -gt 0) {
        $errorCount = $ErrorEntries.Count
        $errorEntriesHtml = "<h4>Found $errorCount error(s):</h4>`n"
        
        foreach ($entry in $ErrorEntries) {
            # Simple HTML encoding without System.Web dependency
            $encodedEntry = $entry -replace "&", "&amp;" -replace "<", "&lt;" -replace ">", "&gt;" -replace '"', "&quot;"
            $errorEntriesHtml += "<div class='log-entry error-entry'>$encodedEntry</div>`n"
        }
        Write-Host "Processed $errorCount error entries for email"
    }
    else {
        $errorEntriesHtml = "<p>No specific error entries to display.</p>"
    }
    
    # Get current timestamp
    $detectionTime = Get-Date -Format "yyyy-MM-dd HH:mm:ss UTC"
    $generationTime = Get-Date -Format "yyyy-MM-dd HH:mm:ss UTC"
    
    # Replace template placeholders
    $emailBody = $template -replace "{{ERROR_COUNT}}", $errorCount
    $emailBody = $emailBody -replace "{{DETECTION_TIME}}", $detectionTime
    $emailBody = $emailBody -replace "{{SERVER_NAME}}", $ServerName
    $emailBody = $emailBody -replace "{{SERVICE_NAME}}", $ServiceName
    $emailBody = $emailBody -replace "{{CURRENT_LOG_PATH}}", $CurrentLogPath
    $emailBody = $emailBody -replace "{{PREVIOUS_LOG_PATH}}", $PreviousLogPath
    $emailBody = $emailBody -replace "{{SERVICE_ERROR_LOG_PATH}}", $ServiceErrorLogPath
    $emailBody = $emailBody -replace "{{CURRENT_TOTAL_LINES}}", $CurrentTotalLines
    $emailBody = $emailBody -replace "{{CURRENT_INFO_COUNT}}", $CurrentInfoCount
    $emailBody = $emailBody -replace "{{CURRENT_WARN_COUNT}}", $CurrentWarnCount
    $emailBody = $emailBody -replace "{{CURRENT_ERROR_COUNT}}", $CurrentErrorCount
    $emailBody = $emailBody -replace "{{CURRENT_FATAL_COUNT}}", $CurrentFatalCount
    $emailBody = $emailBody -replace "{{PREVIOUS_TOTAL_LINES}}", $PreviousTotalLines
    $emailBody = $emailBody -replace "{{PREVIOUS_INFO_COUNT}}", $PreviousInfoCount
    $emailBody = $emailBody -replace "{{PREVIOUS_WARN_COUNT}}", $PreviousWarnCount
    $emailBody = $emailBody -replace "{{PREVIOUS_ERROR_COUNT}}", $PreviousErrorCount
    $emailBody = $emailBody -replace "{{PREVIOUS_FATAL_COUNT}}", $PreviousFatalCount
    $emailBody = $emailBody -replace "{{ERROR_ENTRIES}}", $errorEntriesHtml
    $emailBody = $emailBody -replace "{{GENERATION_TIME}}", $generationTime
    
    # Create subject
    $subject = "ALERT: Service Error Alert - $errorCount error(s) detected on $ServerName"
    
    # Call the appropriate Send-Email script based on PowerShell version
    $scriptDir = Split-Path $TemplatePath -Parent
    
    # Determine which email script to use based on PowerShell version
    $psVersion = $PSVersionTable.PSVersion.Major
    if ($psVersion -ge 7) {
        $sendEmailScript = Join-Path $scriptDir "Send-Email-Modern.ps1"
        Write-Host "Using modern PowerShell email script for PS $psVersion"
    }
    else {
        $sendEmailScript = Join-Path $scriptDir "Send-Email-PS51.ps1"
        Write-Host "Using PowerShell 5.1 compatible email script for PS $psVersion"
    }
    
    if (-not (Test-Path $sendEmailScript)) {
        throw "Email script not found: $sendEmailScript. Ensure both Send-Email-Modern.ps1 and Send-Email-PS51.ps1 are deployed."
    }
    
    Write-Host "Calling email script: $sendEmailScript"
    Write-Host "Email parameters:"
    Write-Host "  Subject: $subject"
    Write-Host "  Body length: $($emailBody.Length) characters"
    Write-Host "  IsBodyHtml: True"
    Write-Host "  Priority: High"
    if ($Username) { Write-Host "  Using authentication with username: $Username" }
    if ($UseSSL) { Write-Host "  Using SSL" }
    
    Write-Host "Executing email script..."
    
    $params = @{
        SmtpServer = $SmtpServer
        SmtpPort   = $SmtpPort
        From       = $From
        To         = $To
        Subject    = $subject
        Body       = $emailBody
        IsBodyHtml = $true
        Priority   = "High"
    }
    
    if ($Username) { $params.Username = $Username }
    if ($Password) { $params.Password = $Password }
    if ($UseSSL) { $params.UseSSL = $true }
    
    $result = & $sendEmailScript @params
    Write-Host "Email script returned: $result"
    
    if ($result) {
        Write-Host "✅ Service error alert sent successfully!"
        return $true
    }
    else {
        Write-Host "❌ Failed to send service error alert"
        return $false
    }
    
}
catch {
    Write-Host "❌ Failed to prepare/send service error alert: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Stack trace: $($_.Exception.StackTrace)" -ForegroundColor Red
    return $false
}