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
# Test email sending (PowerShell 5.1)
.\Send-Email-PS51.ps1 -SmtpServer "smtp.example.com" -SmtpPort 587 -From "test@example.com" -To "admin@example.com" -Subject "Test" -Body "Test message" -UseSSL

# Test email sending (PowerShell 7+)
.\Send-Email-Modern.ps1 -SmtpServer "smtp.example.com" -SmtpPort 587 -From "test@example.com" -To "admin@example.com" -Subject "Test" -Body "Test message" -UseSSL

# Test error alert (requires error data and template path)
.\Send-ErrorAlert.ps1 -SmtpServer "smtp.example.com" -SmtpPort 587 -From "test@example.com" -To "admin@example.com" -ServerName "Test Server" -ServiceName "Test Service" -ErrorEntries @("Test error 1", "Test error 2") -TemplatePath ".\butler-sos-email-template-error-alert.html" -UseSSL
```

## Troubleshooting

### Common Issues

1. **Email script not found**: Ensure scripts are deployed to `D:\tools\scripts\insiders-build-monitor\`
2. **SMTP authentication fails**: Check SMTP credentials in GitHub secrets
3. **Service stop fails**: Verify service name in repository variables
4. **Log files not found**: Check deployment path and log directory structure

### Workflow Logs

All actions are logged in GitHub Actions workflow logs with detailed output including:

- File paths being checked
- Error counts and statistics
- Service stop attempts
- Email sending results

### Email Delivery Issues

- Check SMTP server settings and credentials
- Verify firewall allows outbound SMTP connections
- Check email server logs for delivery status
- Test SMTP settings with a simple email first
