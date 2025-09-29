# Send-Email-Modern.ps1
# Modern PowerShell (7+) version with enhanced Gmail support and better security
# Reusable PowerShell script for sending formatted emails
# Used by various GitHub Actions workflows

#Requires -Version 7.0

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
    [string]$Subject,
    
    [Parameter(Mandatory = $true)]
    [string]$Body,
    
    [Parameter(Mandatory = $false)]
    [string]$Username,
    
    [Parameter(Mandatory = $false)]
    [SecureString]$Password,
    
    [Parameter(Mandatory = $false)]
    [PSCredential]$Credential,
    
    [Parameter(Mandatory = $false)]
    [switch]$UseSSL,
    
    [Parameter(Mandatory = $false)]
    [switch]$IsBodyHtml,
    
    [Parameter(Mandatory = $false)]
    [ValidateSet("Normal", "High", "Low")]
    [string]$Priority = "Normal",
    
    [Parameter(Mandatory = $false)]
    [int]$TimeoutSeconds = 30
)

Write-Host "=== Send-Email-Modern.ps1 Starting ==="
Write-Host "PowerShell Version: $($PSVersionTable.PSVersion)"
Write-Host "SMTP Server: $SmtpServer"
Write-Host "SMTP Port: $SmtpPort"
Write-Host "From: $From"
Write-Host "To: $To"
Write-Host "Subject: $Subject"
Write-Host "Body Length: $($Body.Length)"
Write-Host "Has Username: $([bool]$Username)"
Write-Host "Has Password: $([bool]$Password)"
Write-Host "Has Credential: $([bool]$Credential)"
Write-Host "Use SSL: $UseSSL"
Write-Host "Is Body HTML: $IsBodyHtml"
Write-Host "Priority: $Priority"
Write-Host "Timeout: $TimeoutSeconds seconds"

# Modern PowerShell function using Send-MailMessage with enhanced error handling
function Send-EmailModern {
    param(
        [hashtable]$EmailParams
    )
    
    try {
        # Use the modern Send-MailMessage cmdlet if available
        if (Get-Command Send-MailMessage -ErrorAction SilentlyContinue) {
            Write-Host "Using Send-MailMessage cmdlet (modern method)"
            
            $sendParams = @{
                SmtpServer = $EmailParams.SmtpServer
                Port       = $EmailParams.Port
                From       = $EmailParams.From
                To         = $EmailParams.To
                Subject    = $EmailParams.Subject
                Body       = $EmailParams.Body
                BodyAsHtml = $EmailParams.IsBodyHtml
                Priority   = $EmailParams.Priority
                UseSsl     = $EmailParams.UseSSL
            }
            
            if ($EmailParams.Credential) {
                $sendParams.Credential = $EmailParams.Credential
            }
            
            Send-MailMessage @sendParams
            return $true
        }
    }
    catch {
        Write-Host "Send-MailMessage failed, falling back to .NET method: $($_.Exception.Message)" -ForegroundColor Yellow
        return $false
    }
    
    return $false
}

try {
    Write-Host "Preparing to send email (Modern PowerShell)..."
    Write-Host "PowerShell Version: $($PSVersionTable.PSVersion)"
    Write-Host "SMTP Server: $SmtpServer"
    Write-Host "SMTP Port: $SmtpPort"
    Write-Host "From: $From"
    Write-Host "To: $To"
    Write-Host "Subject: $Subject"
    Write-Host "Use SSL: $($UseSSL.IsPresent)"
    Write-Host "HTML Body: $($IsBodyHtml.IsPresent)"
    Write-Host "Priority: $Priority"
    Write-Host "Timeout: $TimeoutSeconds seconds"

    # Gmail-specific configuration and validation
    if ($SmtpServer -like "*gmail*" -or $SmtpServer -eq "smtp.gmail.com") {
        Write-Host "Gmail SMTP detected - applying Gmail-specific settings" -ForegroundColor Green
        
        # Validate Gmail settings
        if ($SmtpPort -ne 587 -and $SmtpPort -ne 465) {
            Write-Host "Warning: Gmail typically uses port 587 (TLS) or 465 (SSL). Current port: $SmtpPort" -ForegroundColor Yellow
            Write-Host "Recommended: Use port 587 with UseSSL for Gmail" -ForegroundColor Yellow
        }
        
        if (-not $UseSSL.IsPresent) {
            Write-Host "Gmail requires SSL/TLS. Enabling SSL automatically." -ForegroundColor Yellow
            $UseSSL = $true
        }
        
        # Gmail authentication guidance
        if (-not $Username -and -not $Credential) {
            throw "Gmail requires authentication. Provide either Username/Password or Credential parameter."
        }
        
        Write-Host "Gmail setup reminders:" -ForegroundColor Cyan
        Write-Host "- Use an App Password (not your regular Gmail password)" -ForegroundColor Cyan
        Write-Host "- Enable 2-factor authentication" -ForegroundColor Cyan
        Write-Host "- Generate App Password: https://myaccount.google.com/apppasswords" -ForegroundColor Cyan
    }

    # Prepare credential object
    $emailCredential = $null
    if ($Credential) {
        Write-Host "Using provided PSCredential object"
        $emailCredential = $Credential
    }
    elseif ($Username -and $Password) {
        Write-Host "Creating credential from Username/Password"
        $emailCredential = New-Object System.Management.Automation.PSCredential($Username, $Password)
    }

    # Prepare parameters for email sending
    $emailParams = @{
        SmtpServer     = $SmtpServer
        Port           = $SmtpPort
        From           = $From
        To             = $To
        Subject        = $Subject
        Body           = $Body
        IsBodyHtml     = $IsBodyHtml.IsPresent
        Priority       = $Priority
        UseSSL         = $UseSSL.IsPresent -or $UseSSL
        Credential     = $emailCredential
        TimeoutSeconds = $TimeoutSeconds
    }

    # Try modern method first
    $modernSuccess = Send-EmailModern -EmailParams $emailParams
    
    if (-not $modernSuccess) {
        Write-Host "Falling back to .NET System.Net.Mail method"
        
        # Create mail message
        $mailMessage = New-Object System.Net.Mail.MailMessage
        $mailMessage.From = $From
        $mailMessage.To.Add($To)
        $mailMessage.Subject = $Subject
        $mailMessage.Body = $Body
        $mailMessage.IsBodyHtml = $IsBodyHtml.IsPresent
        
        # Set UTF-8 encoding for proper character support
        $mailMessage.BodyEncoding = [System.Text.Encoding]::UTF8
        $mailMessage.SubjectEncoding = [System.Text.Encoding]::UTF8
        
        # Set priority
        $mailMessage.Priority = switch ($Priority.ToLower()) {
            "high" { [System.Net.Mail.MailPriority]::High }
            "low" { [System.Net.Mail.MailPriority]::Low }
            default { [System.Net.Mail.MailPriority]::Normal }
        }

        # Create SMTP client with modern settings
        $smtpClient = New-Object System.Net.Mail.SmtpClient($SmtpServer, $SmtpPort)
        $smtpClient.EnableSsl = $emailParams.UseSSL
        $smtpClient.Timeout = $TimeoutSeconds * 1000  # Convert to milliseconds
        
        # Gmail-specific settings
        if ($SmtpServer -like "*gmail*" -or $SmtpServer -eq "smtp.gmail.com") {
            $smtpClient.DeliveryMethod = [System.Net.Mail.SmtpDeliveryMethod]::Network
        }

        # Set credentials
        if ($emailCredential) {
            Write-Host "Using authentication with username: $($emailCredential.UserName)"
            $smtpClient.Credentials = $emailCredential.GetNetworkCredential()
        }
        else {
            Write-Host "No credentials provided - using anonymous authentication"
        }

        # Send the email
        Write-Host "Sending email via .NET method..."
        $smtpClient.Send($mailMessage)
        
        # Clean up
        $mailMessage.Dispose()
        $smtpClient.Dispose()
    }

    Write-Host "✅ Email sent successfully!" -ForegroundColor Green
    return $true

}
catch [System.Net.Mail.SmtpException] {
    Write-Host "❌ SMTP Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "SMTP Status Code: $($_.Exception.StatusCode)" -ForegroundColor Red
    
    # Enhanced Gmail error handling
    if ($SmtpServer -like "*gmail*" -or $SmtpServer -eq "smtp.gmail.com") {
        Write-Host "" -ForegroundColor Red
        Write-Host "📧 Gmail Troubleshooting Guide:" -ForegroundColor Yellow
        Write-Host "1. Verify you're using an App Password (not regular password)" -ForegroundColor Yellow
        Write-Host "2. Enable 2-factor authentication: https://myaccount.google.com/security" -ForegroundColor Yellow
        Write-Host "3. Generate App Password: https://myaccount.google.com/apppasswords" -ForegroundColor Yellow
        Write-Host "4. Use these settings: smtp.gmail.com, port 587, SSL enabled" -ForegroundColor Yellow
        Write-Host "5. Check Gmail account security: https://myaccount.google.com/lesssecureapps" -ForegroundColor Yellow
        
        switch -Wildcard ($_.Exception.Message) {
            "*authentication*" { Write-Host "🔐 Authentication issue - check App Password" -ForegroundColor Red }
            "*credential*" { Write-Host "🔐 Credential issue - verify username/password" -ForegroundColor Red }
            "*SSL*" { Write-Host "🔒 SSL/TLS issue - ensure UseSSL is enabled" -ForegroundColor Red }
            "*timeout*" { Write-Host "⏱️ Timeout issue - check network connectivity" -ForegroundColor Red }
            "*5.7.14*" { Write-Host "🚫 Gmail blocked sign-in - check security settings" -ForegroundColor Red }
        }
    }
    
    return $false
    
}
catch {
    Write-Host "❌ Unexpected error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Exception Type: $($_.Exception.GetType().FullName)" -ForegroundColor Red
    
    if ($_.Exception.StackTrace) {
        Write-Host "Stack trace:" -ForegroundColor Red
        Write-Host $_.Exception.StackTrace -ForegroundColor Red
    }
    
    return $false
    
}
finally {
    # Ensure cleanup
    if ($mailMessage) { 
        try { $mailMessage.Dispose() } catch { }
    }
    if ($smtpClient) { 
        try { $smtpClient.Dispose() } catch { }
    }
}