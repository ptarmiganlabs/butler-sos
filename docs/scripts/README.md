# Butler SOS Scripts

This directory contains various scripts and utilities for Butler SOS.

## Insiders Build Monitor

The log monitoring system and email alert scripts are found⁄:

📁 **[insiders-build-monitor/](insiders-build-monitor/)**

This subdirectory contains:

- PowerShell email sending scripts (PS 5.1 and modern versions)
- Error alert system with HTML email templates
- Gmail configuration and setup guides
- Log monitoring workflow scripts

See the [README](insiders-build-monitor/README.md) in the insiders-build-monitor folder for complete documentation.

### Additional Resources

- **[Main Documentation](insiders-build-monitor/README.md)** - Complete setup and usage guide
- **[Gmail Setup Guide](insiders-build-monitor/Gmail-Setup-Guide.md)** - Step-by-step Gmail configuration
- **[Email Template](insiders-build-monitor/email-template-error-alert.html)** - HTML email template for alerts

### Deployment

When deploying to the target server, place all scripts in:

```text
D:\tools\scripts\insiders-build-monitor\
```

This maintains consistency with the workflow references and script paths.
