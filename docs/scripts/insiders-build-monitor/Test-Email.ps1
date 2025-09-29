# Test-Email.ps1
# Quick test script for the email sending functionality
# Automatically detects PowerShell version and uses appropriate email script

param(
    [Parameter(Mandatory = $true)]
    [string]$From,
    
    [Parameter(Mandatory = $true)]
    [string]$To,
    
    [Parameter(Mandatory = $true)]
    [string]$Username,
    
    [Parameter(Mandatory = $true)]
    [string]$Password,
    
    [Parameter(Mandatory = $false)]
    [string]$SmtpServer = "smtp.gmail.com",
    
    [Parameter(Mandatory = $false)]
    [int]$SmtpPort = 587,
    
    [Parameter(Mandatory = $false)]
    [switch]$TestHtml
)

Write-Host "=== Email Test Script ==="
Write-Host "PowerShell Version: $($PSVersionTable.PSVersion)"
Write-Host "Testing email functionality..."

$scriptDir = Split-Path $MyInvocation.MyCommand.Path -Parent

# Determine which email script to use
$psVersion = $PSVersionTable.PSVersion.Major
if ($psVersion -ge 7) {
    $emailScript = Join-Path $scriptDir "Send-Email-Modern.ps1"
    Write-Host "Using modern PowerShell email script for PS $psVersion"
}
else {
    $emailScript = Join-Path $scriptDir "Send-Email-PS51.ps1"
    Write-Host "Using PowerShell 5.1 compatible email script for PS $psVersion"
}

if (-not (Test-Path $emailScript)) {
    Write-Host "❌ Email script not found: $emailScript" -ForegroundColor Red
    exit 1
}

# Prepare test content
if ($TestHtml) {
    $subject = "HTML Email Test from Butler SOS Monitor"
    $body = @"
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; }
        .header { color: #2c3e50; }
        .success { color: #27ae60; background: #d5f4e6; padding: 10px; border-radius: 5px; }
        .info { color: #3498db; }
    </style>
</head>
<body>
    <h1 class="header">🧪 HTML Email Test</h1>
    <div class="success">
        <h2>✅ Success!</h2>
        <p>If you're seeing this formatted HTML email, the email system is working correctly!</p>
    </div>
    
    <h3 class="info">Test Details:</h3>
    <ul>
        <li><strong>PowerShell Version:</strong> $($PSVersionTable.PSVersion)</li>
        <li><strong>Script Used:</strong> $(Split-Path $emailScript -Leaf)</li>
        <li><strong>SMTP Server:</strong> $SmtpServer</li>
        <li><strong>SMTP Port:</strong> $SmtpPort</li>
        <li><strong>Test Time:</strong> $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss UTC')</li>
    </ul>
    
    <p><em>This is a test email from the Butler SOS monitoring system.</em></p>
</body>
</html>
"@
    $isBodyHtml = $true
}
else {
    $subject = "Plain Text Email Test from Butler SOS Monitor"
    $body = @"
Plain Text Email Test

✅ Success!
If you're receiving this email, the email system is working correctly!

Test Details:
- PowerShell Version: $($PSVersionTable.PSVersion)
- Script Used: $(Split-Path $emailScript -Leaf)
- SMTP Server: $SmtpServer
- SMTP Port: $SmtpPort
- Test Time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss UTC')

This is a test email from the Butler SOS monitoring system.
"@
    $isBodyHtml = $false
}

# Prepare parameters
$params = @{
    SmtpServer = $SmtpServer
    SmtpPort   = $SmtpPort
    From       = $From
    To         = $To
    Subject    = $subject
    Body       = $body
    Username   = $Username
    Password   = $Password
    UseSSL     = $true
    Priority   = "High"
}

if ($isBodyHtml) {
    $params.IsBodyHtml = $true
}

Write-Host "Sending test email..."
Write-Host "  From: $From"
Write-Host "  To: $To"
Write-Host "  Type: $(if ($TestHtml) { 'HTML' } else { 'Plain Text' })"

try {
    $result = & $emailScript @params
    
    if ($result) {
        Write-Host "✅ Test email sent successfully!" -ForegroundColor Green
        Write-Host "Check your inbox at: $To"
    }
    else {
        Write-Host "❌ Test email failed to send" -ForegroundColor Red
    }
}
catch {
    Write-Host "❌ Exception occurred: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "=== Test Complete ==="