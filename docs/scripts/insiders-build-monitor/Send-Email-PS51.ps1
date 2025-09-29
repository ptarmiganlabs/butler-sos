# Send-Email-PS51.ps1
# PowerShell 5.1 compatible version
# Reusable PowerShell script for sending formatted emails with Gmail support
# Used by various GitHub Actions workflows on Windows Server systems

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
    [string]$Password,
    
    [Parameter(Mandatory = $false)]
    [switch]$UseSSL,
    
    [Parameter(Mandatory = $false)]
    [switch]$IsBodyHtml,
    
    [Parameter(Mandatory = $false)]
    [string]$Priority = "Normal"
)

# PowerShell 5.1 compatible function to convert plain text password to SecureString
function ConvertTo-SecureStringPS51 {
    param([string]$PlainTextPassword)
    
    if ([string]::IsNullOrEmpty($PlainTextPassword)) {
        return $null
    }
    
    $secureString = New-Object System.Security.SecureString
    $PlainTextPassword.ToCharArray() | ForEach-Object { $secureString.AppendChar($_) }
    $secureString.MakeReadOnly()
    return $secureString
}

try {
    Write-Host "Preparing to send email (PowerShell 5.1 compatible)..."
    Write-Host "SMTP Server: $SmtpServer"
    Write-Host "SMTP Port: $SmtpPort"
    Write-Host "From: $From"
    Write-Host "To: $To"
    Write-Host "Subject: $Subject"
    Write-Host "Use SSL: $($UseSSL.IsPresent)"
    Write-Host "HTML Body: $($IsBodyHtml.IsPresent)"
    Write-Host "Priority: $Priority"

    # Gmail-specific configuration
    if ($SmtpServer -like "*gmail*" -or $SmtpServer -eq "smtp.gmail.com") {
        Write-Host "Gmail SMTP detected - applying Gmail-specific settings"
        if ($SmtpPort -ne 587 -and $SmtpPort -ne 465) {
            Write-Host "Warning: Gmail typically uses port 587 (TLS) or 465 (SSL). Current port: $SmtpPort"
        }
        if (-not $UseSSL.IsPresent) {
            Write-Host "Warning: Gmail requires SSL/TLS. Enabling SSL automatically."
            $UseSSL = $true
        }
    }

    # Create mail message
    $mailMessage = New-Object System.Net.Mail.MailMessage
    $mailMessage.From = $From
    $mailMessage.To.Add($To)
    $mailMessage.Subject = $Subject
    $mailMessage.Body = $Body
    $mailMessage.IsBodyHtml = $IsBodyHtml.IsPresent
    
    # Set priority
    switch ($Priority.ToLower()) {
        "high" { $mailMessage.Priority = [System.Net.Mail.MailPriority]::High }
        "low" { $mailMessage.Priority = [System.Net.Mail.MailPriority]::Low }
        default { $mailMessage.Priority = [System.Net.Mail.MailPriority]::Normal }
    }

    # Create SMTP client
    $smtpClient = New-Object System.Net.Mail.SmtpClient($SmtpServer, $SmtpPort)
    $smtpClient.EnableSsl = $UseSSL.IsPresent -or $UseSSL

    # Set credentials if provided
    if ($Username -and $Password) {
        Write-Host "Using authentication with username: $Username"
        
        # Handle both SecureString and plain text passwords for PS 5.1 compatibility
        if ($Password -is [System.Security.SecureString]) {
            # Convert SecureString to plain text (PS 5.1 compatible method)
            $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($Password)
            $plainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
            [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
        }
        else {
            # Already plain text
            $plainPassword = $Password
        }
        
        $smtpClient.Credentials = New-Object System.Net.NetworkCredential($Username, $plainPassword)
        
        # Clear the plain text password from memory
        $plainPassword = $null
    }
    else {
        Write-Host "No credentials provided - using anonymous authentication"
    }

    # Gmail-specific timeout and delivery method settings
    if ($SmtpServer -like "*gmail*" -or $SmtpServer -eq "smtp.gmail.com") {
        $smtpClient.Timeout = 30000  # 30 seconds timeout for Gmail
        $smtpClient.DeliveryMethod = [System.Net.Mail.SmtpDeliveryMethod]::Network
    }

    # Send the email
    Write-Host "Sending email..."
    $smtpClient.Send($mailMessage)
    Write-Host "✅ Email sent successfully!"

    # Clean up
    $mailMessage.Dispose()
    $smtpClient.Dispose()

    return $true

}
catch [System.Net.Mail.SmtpException] {
    Write-Host "❌ SMTP Error: $($_.Exception.Message)" -ForegroundColor Red
    
    # Gmail-specific error guidance
    if ($SmtpServer -like "*gmail*" -or $SmtpServer -eq "smtp.gmail.com") {
        Write-Host "Gmail troubleshooting tips:" -ForegroundColor Yellow
        Write-Host "- Ensure you're using an App Password, not your regular Gmail password" -ForegroundColor Yellow
        Write-Host "- Enable 2-factor authentication on your Gmail account" -ForegroundColor Yellow
        Write-Host "- Generate an App Password: https://myaccount.google.com/apppasswords" -ForegroundColor Yellow
        Write-Host "- Use smtp.gmail.com with port 587 and SSL enabled" -ForegroundColor Yellow
        
        if ($_.Exception.Message -like "*authentication*" -or $_.Exception.Message -like "*credential*") {
            Write-Host "Authentication failed - check your App Password" -ForegroundColor Red
        }
    }
    
    Write-Host "SMTP Status Code: $($_.Exception.StatusCode)" -ForegroundColor Red
    return $false
    
}
catch {
    Write-Host "❌ Failed to send email: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Exception Type: $($_.Exception.GetType().FullName)" -ForegroundColor Red
    
    # PowerShell 5.1 compatible stack trace
    if ($_.Exception.StackTrace) {
        Write-Host "Stack trace: $($_.Exception.StackTrace)" -ForegroundColor Red
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