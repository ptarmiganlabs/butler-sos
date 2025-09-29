# Butler SOS Log Monitoring System

This directory contains the scripts and templates for the Butler SOS log monitoring system that automatically checks for errors and sends alerts.

The system is used in conjunction with a GitHub Actions workflow to monitor log files on a Windows server running Butler SOS Insider builds, as part of the project's CI/CD deployment pipeline.

## Files Overview

### PowerShell Scripts

#### `Send-Email-PS51.ps1` (Recommended for Windows Server)

PowerShell 5.1 compatible email sending script with Gmail support. Automatically selected by `Send-ErrorAlert.ps1` for PowerShell versions below 7.

**Gmail Features:**

- Automatic Gmail SMTP configuration detection
- App Password support with helpful error messages
- Enhanced Gmail troubleshooting guidance
- Automatic SSL/TLS enablement for Gmail

#### `Send-Email-Modern.ps1`

Modern PowerShell (7+) version with enhanced features. Automatically selected for PowerShell 7+.

**Enhanced Features:**

- Uses `Send-MailMessage` cmdlet when available
- Better credential handling with PSCredential support
- Enhanced Gmail error diagnostics with specific guidance
- Automatic fallback to .NET method if cmdlet fails

**Common Parameters (both versions):**

- `SmtpServer` (required): SMTP server hostname (use `smtp.gmail.com` for Gmail)
- `SmtpPort` (required): SMTP server port (use `587` for Gmail with TLS)
- `From` (required): Sender email address
- `To` (required): Recipient email address
- `Subject` (required): Email subject
- `Body` (required): Email body content
- `Username` (optional): SMTP authentication username (required for Gmail)
- `Password` (optional): SMTP authentication password (use App Password for Gmail)
- `UseSSL` (optional): Use SSL encryption (automatically enabled for Gmail)
- `IsBodyHtml` (optional): Treat body as HTML (switch)
- `Priority` (optional): Email priority (Normal, High, Low)

#### `Send-ErrorAlert.ps1`

Generic script for sending service error alerts using customizable HTML templates.

**Parameters:**

- All email parameters from `Send-Email-PS51.ps1` or `Send-Email-Modern.ps1`
- `ServerName` (required): Name of the server
- `ServiceName` (required): Name of the service
- `ErrorEntries` (required): Array of error log entries
- `TemplatePath` (required): Full path to the HTML email template file
- Various log statistics parameters for the email template

#### `Test-Email.ps1`

Convenient test script for quickly testing the email functionality. Automatically detects PowerShell version and uses the appropriate email script.

**Parameters:**

- `From` (required): Sender email address
- `To` (required): Recipient email address
- `Username` (required): SMTP authentication username
- `Password` (required): SMTP authentication password
- `SmtpServer` (optional): SMTP server (default: smtp.gmail.com)
- `SmtpPort` (optional): SMTP port (default: 587)
- `TestHtml` (optional): Send HTML formatted test email instead of plain text

### Email Template

#### Template Structure

The system uses HTML email templates that can be customized for different projects. Templates use placeholder variables like `{{ERROR_COUNT}}`, `{{SERVER_NAME}}`, etc.

**Butler SOS Example**: `butler-sos-email-template-error-alert.html`

HTML email template for Butler SOS error alerts with professional formatting including:

- Error summary with counts and timestamps
- Detailed log statistics table
- Formatted display of error entries
- Action taken notification
- Next steps guidance
- Professional styling with responsive design

## Deployment

### Server Setup

When deploying to the destination server, place all scripts in:

```
D:\tools\scripts\insiders-build-monitor\
```

This location is hardcoded in the workflow and scripts for consistency.

### GitHub Repository Variables

Configure these repository variables in GitHub:

#### Required Variables

- `BUTLER_SOS_INSIDER_DEPLOY_RUNNER`: GitHub runner name (default: 'host2-win')
- `BUTLER_SOS_INSIDER_SERVICE_NAME`: Windows service name (default: 'Butler SOS insiders build')
- `BUTLER_SOS_INSIDER_DEPLOY_PATH`: Deployment directory (default: 'C:\butler-sos-insider')
- `SMTP_SERVER`: SMTP server hostname (use `smtp.gmail.com` for Gmail)
- `EMAIL_FROM`: Sender email address
- `EMAIL_TO`: Recipient email address
- `SERVER_NAME`: Friendly server name for emails (default: 'Butler SOS Insider Server')

#### Optional Variables

- `SMTP_PORT`: SMTP port (default: 587, recommended for Gmail)

### GitHub Repository Secrets

Configure these secrets for SMTP authentication:

- `SMTP_USERNAME`: SMTP authentication username (your Gmail address)
- `SMTP_PASSWORD`: SMTP authentication password (use Gmail App Password, not regular password)

### Gmail Configuration

For Gmail users, see the detailed [Gmail Setup Guide](Gmail-Setup-Guide.md) which includes:

- Step-by-step App Password generation
- 2-factor authentication setup
- Troubleshooting common Gmail issues
- Security best practices
- Testing procedures

**Quick Gmail Setup:**

1. Enable 2-factor authentication on your Gmail account
2. Generate an App Password: https://myaccount.google.com/apppasswords
3. Use `smtp.gmail.com` and port `587` in repository variables
4. Use your Gmail address for `SMTP_USERNAME`
5. Use the 16-character App Password for `SMTP_PASSWORD`

## Workflow Schedule

The monitoring workflow (`butler-sos-log-monitor.yaml`) runs:

- **Twice daily** at 08:00 and 20:00 UTC
- **On-demand** via workflow_dispatch for testing

## Monitoring Logic

The workflow checks three log files:

1. `service-error.log` - Windows service error log
2. `log\butler-sos.YYYY-MM-DD.log` - Current day application log
3. `log\butler-sos.YYYY-MM-DD.log` - Previous day application log

### Error Detection

Searches for log entries matching these patterns (case-insensitive):

- `error:` or `ERROR`
- `fatal:` or `FATAL`

Uses regex pattern: `(?i)\b(error|fatal)[\s:]`

### Actions Taken When Errors Found

1. **Stop the Butler SOS service** to prevent further issues
2. **Send detailed email alert** with:
    - Error summary and counts
    - Full error log entries
    - Log file statistics
    - Action taken notification
    - Next steps guidance
3. **Log all actions** in GitHub Actions workflow logs

## Email Template Customization

The HTML email template uses placeholder substitution:

### Available Placeholders

- `{{ERROR_COUNT}}` - Number of errors found
- `{{DETECTION_TIME}}` - When errors were detected
- `{{SERVER_NAME}}` - Server name
- `{{SERVICE_NAME}}` - Service name
- `{{CURRENT_LOG_PATH}}` - Path to current day log
- `{{PREVIOUS_LOG_PATH}}` - Path to previous day log
- `{{SERVICE_ERROR_LOG_PATH}}` - Path to service error log
- `{{CURRENT_*_COUNT}}` - Current day log statistics
- `{{PREVIOUS_*_COUNT}}` - Previous day log statistics
- `{{ERROR_ENTRIES}}` - HTML formatted error entries
- `{{GENERATION_TIME}}` - Email generation timestamp

## Testing

### Manual Testing

Run the workflow manually using GitHub Actions:

1. Go to Actions tab in GitHub
2. Select "butler-sos-log-monitor" workflow
3. Click "Run workflow"
4. Select branch and click "Run workflow"

### Local Testing

Test the PowerShell scripts locally:

```powershell
# Quick test using the Test-Email.ps1 script (Plain Text)
.\Test-Email.ps1 -From "your-email@gmail.com" -To "recipient@example.com" -Username "your-email@gmail.com" -Password "your-app-password"

# Quick test using the Test-Email.ps1 script (HTML)
.\Test-Email.ps1 -From "your-email@gmail.com" -To "recipient@example.com" -Username "your-email@gmail.com" -Password "your-app-password" -TestHtml

# Test basic email sending (PowerShell 5.1)
.\Send-Email-PS51.ps1 -SmtpServer "smtp.gmail.com" -SmtpPort 587 -From "your-email@gmail.com" -To "recipient@example.com" -Subject "Test Email" -Body "This is a test message" -Username "your-email@gmail.com" -Password "your-app-password" -UseSSL

# Test HTML email sending (PowerShell 5.1)
.\Send-Email-PS51.ps1 -SmtpServer "smtp.gmail.com" -SmtpPort 587 -From "your-email@gmail.com" -To "recipient@example.com" -Subject "HTML Test Email" -Body "<h1>Test HTML Email</h1><p>This is a <strong>test HTML message</strong> with <em>formatting</em>.</p>" -Username "your-email@gmail.com" -Password "your-app-password" -UseSSL -IsBodyHtml

# Test email sending (PowerShell 7+)
.\Send-Email-Modern.ps1 -SmtpServer "smtp.gmail.com" -SmtpPort 587 -From "your-email@gmail.com" -To "recipient@example.com" -Subject "Test Email" -Body "This is a test message" -Username "your-email@gmail.com" -Password (ConvertTo-SecureString "your-app-password" -AsPlainText -Force) -UseSSL

# Test complete error alert system (requires error data and template path)
.\Send-ErrorAlert.ps1 -SmtpServer "smtp.gmail.com" -SmtpPort 587 -From "your-email@gmail.com" -To "recipient@example.com" -ServerName "Test Server" -ServiceName "Test Service" -ErrorEntries @("Test error 1", "Test error 2") -TemplatePath ".\butler-sos-email-template-error-alert.html" -Username "your-email@gmail.com" -Password "your-app-password" -UseSSL

# Test encoding fix with special template
.\Send-ErrorAlert.ps1 -SmtpServer "smtp.gmail.com" -SmtpPort 587 -From "your-email@gmail.com" -To "recipient@example.com" -ServerName "Test Server" -ServiceName "Test Service" -ErrorEntries @("ERROR: Connection failed", "ERROR: Invalid configuration") -TemplatePath ".\test-encoding-template.html" -Username "your-email@gmail.com" -Password "your-app-password" -UseSSL
```

**Note**: Replace `your-email@gmail.com` with your actual Gmail address and `your-app-password` with your Gmail App Password. For Gmail, always use an App Password, not your regular Gmail password.

## Troubleshooting

### Common Issues

1. **Email script not found**: Ensure scripts are deployed to `D:\tools\scripts\insiders-build-monitor\`
2. **SMTP authentication fails**: Check SMTP credentials in GitHub secrets
3. **Service stop fails**: Verify service name in repository variables
4. **Log files not found**: Check deployment path and log directory structure
5. **Mangled characters in emails**: HTML template encoding issues - see Email Encoding section below

### Workflow Logs

All actions are logged in GitHub Actions workflow logs with detailed output including:

- File paths being checked
- Error counts and statistics
- Service stop attempts
- Email sending results

**Email Script Debugging Logs**: When email sending fails, detailed logs are saved to `D:\tools\scripts\insiders-build-monitor\logs\`:

- `email-output.log` - Complete script output and parameters
- `email-error.log` - Exception details and stack traces

These log files are overwritten on each run to help with debugging email delivery issues.

### Email Delivery Issues

- Check SMTP server settings and credentials
- Verify firewall allows outbound SMTP connections
- Check email server logs for delivery status
- Test SMTP settings with a simple email first

### Email Encoding Issues

If emails display garbled characters or corrupted emojis (like "âš¡" instead of "⚡"):

1. **Use HTML entities instead of Unicode emojis** in templates:
    - Instead of `⚡` use `&#9889;`
    - Instead of `🚨` use `&#128680;`
    - Instead of `⚠️` use `&#9888;&#65039;`

2. **Test with the encoding test template**:

    ```powershell
    .\Send-ErrorAlert.ps1 -SmtpServer "smtp.gmail.com" -SmtpPort 587 -From "your@gmail.com" -To "recipient@example.com" -ServerName "Test" -ServiceName "Test" -ErrorEntries @("Test error") -TemplatePath ".\test-encoding-template.html" -Username "your@gmail.com" -Password "app-password" -UseSSL
    ```

3. **Ensure UTF-8 encoding**: The scripts now include explicit UTF-8 encoding for both templates and email content
