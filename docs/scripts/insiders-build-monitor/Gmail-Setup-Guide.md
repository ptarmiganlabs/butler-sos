# Gmail Setup Guide for Butler SOS Email Alerts

This guide will help you configure Gmail to send Butler SOS error alerts through the monitoring system.

## Prerequisites

1. **Gmail Account**: You need a Gmail account to send emails from
2. **2-Factor Authentication**: Must be enabled on your Gmail account
3. **App Password**: Required for automated email sending

## Step-by-Step Setup

### Step 1: Enable 2-Factor Authentication

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Under "Signing in to Google", click on "2-Step Verification"
3. Follow the setup process to enable 2-factor authentication
4. **Important**: You cannot create App Passwords without 2-factor authentication enabled

### Step 2: Generate App Password

1. Go to [App Passwords](https://myaccount.google.com/apppasswords)
2. Select "Other (Custom name)" from the dropdown
3. Enter a name like "Butler SOS Alerts"
4. Click "Generate"
5. **Copy the 16-character password** - you'll need this for the GitHub secrets
6. **Important**: This password is only shown once, save it securely

### Step 3: Configure GitHub Repository Variables

Set these repository variables in GitHub (Settings → Secrets and variables → Actions → Variables):

#### Required Variables

```text
SMTP_SERVER = smtp.gmail.com
SMTP_PORT = 587
EMAIL_FROM = your-email@gmail.com
EMAIL_TO = recipient@example.com
SERVER_NAME = Butler SOS Production Server
```

#### Optional Variables (with defaults)

```text
BUTLER_SOS_INSIDER_DEPLOY_RUNNER = host2-win
BUTLER_SOS_INSIDER_SERVICE_NAME = Butler SOS insiders build
BUTLER_SOS_INSIDER_DEPLOY_PATH = C:\butler-sos-insider
```

### Step 4: Configure GitHub Repository Secrets

Set these repository secrets in GitHub (Settings → Secrets and variables → Actions → Secrets):

```text
SMTP_USERNAME = your-email@gmail.com
SMTP_PASSWORD = your-16-char-app-password
```

**Important**: Use the App Password (16 characters) for `SMTP_PASSWORD`, NOT your regular Gmail password.

## Gmail Settings Summary

| Setting        | Value                           |
| -------------- | ------------------------------- |
| SMTP Server    | smtp.gmail.com                  |
| SMTP Port      | 587 (recommended) or 465        |
| Security       | SSL/TLS (automatically enabled) |
| Authentication | Required (App Password)         |

## Testing Your Configuration

### Method 1: Manual Workflow Run

1. Go to your GitHub repository
2. Click "Actions" tab
3. Select "butler-sos-log-monitor" workflow
4. Click "Run workflow" button
5. Select your branch and click "Run workflow"

### Method 2: PowerShell Script Test

If you have access to the server, you can test the email functionality directly:

```powershell
# Test basic email sending (PowerShell 5.1)
D:\tools\scripts\insiders-build-monitor\Send-Email-PS51.ps1 `
    -SmtpServer "smtp.gmail.com" `
    -SmtpPort 587 `
    -From "your-email@gmail.com" `
    -To "recipient@example.com" `
    -Subject "Test Email" `
    -Body "This is a test message" `
    -Username "your-email@gmail.com" `
    -Password "your-app-password" `
    -UseSSL

# Test error alert email
D:\tools\scripts\insiders-build-monitor\Send-ErrorAlert.ps1 `
    -SmtpServer "smtp.gmail.com" `
    -SmtpPort 587 `
    -From "your-email@gmail.com" `
    -To "recipient@example.com" `
    -ServerName "Test Server" `
    -ServiceName "Test Service" `
    -ErrorEntries @("Test error 1", "Test error 2") `
    -TemplatePath "D:\tools\scripts\insiders-build-monitor\butler-sos-email-template-error-alert.html" `
    -Username "your-email@gmail.com" `
    -Password "your-app-password" `
    -UseSSL
```

## Troubleshooting

### Common Issues and Solutions

#### "Authentication Failed" Error

- **Cause**: Wrong credentials or App Password not generated
- **Solution**:
    - Verify you're using the App Password, not your regular Gmail password
    - Regenerate the App Password if needed
    - Ensure 2-factor authentication is enabled

#### "SSL Connection Failed" Error

- **Cause**: SSL/TLS connection issues
- **Solution**:
    - Ensure `UseSSL` is enabled (automatic for Gmail)
    - Try port 465 instead of 587
    - Check server firewall settings

#### "SMTP Exception: Mailbox unavailable" Error

- **Cause**: Gmail account security settings
- **Solution**:
    - Check [Less secure app access](https://myaccount.google.com/lesssecureapps) (should be OFF)
    - Verify the email address is correct
    - Try signing into Gmail from the server's IP address once

#### "Timeout" Error

- **Cause**: Network connectivity issues
- **Solution**:
    - Check internet connectivity from the server
    - Verify firewall allows outbound connections on port 587/465
    - Test with `telnet smtp.gmail.com 587`

### Gmail-Specific Error Codes

| Error Code | Meaning                       | Solution                                     |
| ---------- | ----------------------------- | -------------------------------------------- |
| 5.7.14     | Please log in via web browser | Sign into Gmail from server IP once          |
| 5.5.1      | Authentication Required       | Check App Password                           |
| 5.7.0      | Authentication Required       | Enable 2-factor auth and create App Password |

### Testing Network Connectivity

From the Windows server, test SMTP connectivity:

```powershell
# Test SMTP port connectivity
Test-NetConnection -ComputerName smtp.gmail.com -Port 587

# Test with telnet (if available)
telnet smtp.gmail.com 587
```

### Checking Gmail Account Activity

1. Go to [Gmail Security Checkup](https://myaccount.google.com/security-checkup)
2. Review recent security activity
3. Check for any blocked sign-in attempts
4. Review connected apps and sites

## PowerShell Version Compatibility

The scripts automatically detect PowerShell version and use the appropriate method:

- **PowerShell 5.1**: Uses `Send-Email-PS51.ps1` with .NET System.Net.Mail
- **PowerShell 7+**: Uses `Send-Email-Modern.ps1` with enhanced features

Both versions include Gmail-specific optimizations and error handling.

## Security Best Practices

1. **Never use your regular Gmail password** in automation
2. **Always use App Passwords** for automated sending
3. **Limit App Password scope** to only what's needed
4. **Regularly rotate App Passwords** (every 6-12 months)
5. **Monitor Gmail security activity** for unusual access
6. **Use repository secrets** (not variables) for sensitive data

## Additional Resources

- [Google Account Help - App Passwords](https://support.google.com/accounts/answer/185833)
- [Gmail SMTP Settings](https://support.google.com/mail/answer/7126229)
- [Google Account Security](https://myaccount.google.com/security)
- [Gmail Less Secure Apps](https://support.google.com/accounts/answer/6010255)
