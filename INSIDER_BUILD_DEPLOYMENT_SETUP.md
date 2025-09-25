# Butler SOS Insider Build Automatic Deployment Setup

This document describes the setup required to enable automatic deployment of Butler SOS insider builds to the testing server.

## Overview

The GitHub Actions workflow `insiders-build.yaml` now includes automatic deployment of Windows insider builds to the `host2-win` server. After a successful build, the deployment job will:

1. Download the Windows installer build artifact
2. Stop the "Butler SOS insiders build" Windows service
3. Replace the binary with the new version
4. Start the service again
5. Verify the deployment was successful

## Manual Setup Required

### 1. GitHub Runner Configuration

On the `host2-win` server, ensure the GitHub runner is configured with:

**Runner Labels:**
- The runner must be labeled as `host2-win` (this matches the `runs-on` value in the workflow)

**Permissions:**
- The runner service account must have permission to:
  - Stop and start Windows services
  - Write to the deployment directory (`C:\butler-sos-insider`)
  - Execute PowerShell scripts

**PowerShell Execution Policy:**
```powershell
# Run as Administrator
Set-ExecutionPolicy RemoteSigned -Scope LocalMachine
```

### 2. Windows Service Setup

Create a Windows service named exactly `"Butler SOS insiders build"`:

**Option A: Using PowerShell (Recommended)**
```powershell
# Run as Administrator
$serviceName = "Butler SOS insiders build"
$exePath = "C:\butler-sos-insider\butler-sos.exe"
$configPath = "C:\butler-sos-insider\config\production_template.yaml"

# Create the service
New-Service -Name $serviceName -BinaryPathName "$exePath --config $configPath" -DisplayName $serviceName -Description "Butler SOS insider build for testing" -StartupType Manual

# Set service to run as Local System or specify custom account
# For custom account:
# $credential = Get-Credential
# $service = Get-WmiObject -Class Win32_Service -Filter "Name='$serviceName'"
# $service.Change($null,$null,$null,$null,$null,$null,$credential.UserName,$credential.GetNetworkCredential().Password)
```

**Option B: Using SC command**
```cmd
REM Run as Administrator
sc create "Butler SOS insiders build" binPath="C:\butler-sos-insider\butler-sos.exe --config C:\butler-sos-insider\config\production_template.yaml" DisplayName="Butler SOS insiders build" start=demand
```

**Option C: Using Windows Service Manager (services.msc)**
1. Open Services management console
2. Right-click and select "Create Service"
3. Fill in the details:
   - Service Name: `Butler SOS insiders build`
   - Display Name: `Butler SOS insiders build`
   - Path to executable: `C:\butler-sos-insider\butler-sos.exe`
   - Startup Type: Manual or Automatic as preferred

### 3. Directory Setup

Create the deployment directory with proper permissions:

```powershell
# Run as Administrator
$deployPath = "C:\butler-sos-insider"
$runnerUser = "NT SERVICE\github-runner"  # Adjust based on your runner service account

# Create directory
New-Item -ItemType Directory -Path $deployPath -Force

# Grant permissions to the runner service account
$acl = Get-Acl $deployPath
$accessRule = New-Object System.Security.AccessControl.FileSystemAccessRule($runnerUser, "FullControl", "ContainerInherit,ObjectInherit", "None", "Allow")
$acl.SetAccessRule($accessRule)
Set-Acl -Path $deployPath -AclObject $acl

Write-Host "Directory created and permissions set for: $deployPath"
```

### 4. Service Permissions

Grant the GitHub runner service account permission to manage the Butler SOS service:

```powershell
# Run as Administrator
# Download and use the SubInACL tool or use PowerShell with .NET classes

# Option A: Using PowerShell (requires additional setup)
$serviceName = "Butler SOS insiders build"
$runnerUser = "NT SERVICE\github-runner"  # Adjust based on your runner service account

# This is a simplified example - you may need more advanced permission management
# depending on your security requirements

Write-Host "Service permissions need to be configured manually using Group Policy or SubInACL"
Write-Host "Grant '$runnerUser' the following rights:"
Write-Host "- Log on as a service"
Write-Host "- Start and stop services"
Write-Host "- Manage service permissions for '$serviceName'"
```

## Testing the Deployment

### Manual Test

To manually test the deployment process:

1. Trigger the insider build workflow in GitHub Actions
2. Monitor the workflow logs for the `deploy-windows-insider` job
3. Check that the service stops and starts properly
4. Verify the new binary is deployed to `C:\butler-sos-insider`

### Troubleshooting

**Common Issues:**

1. **Service not found:**
   - Ensure the service name is exactly `"Butler SOS insiders build"`
   - Check that the service was created successfully

2. **Permission denied:**
   - Verify the GitHub runner has service management permissions
   - Check directory permissions for `C:\butler-sos-insider`

3. **Service won't start:**
   - Check the service configuration and binary path
   - Review Windows Event Logs for service startup errors
   - Ensure the configuration file is present and valid

4. **GitHub Runner not found:**
   - Verify the runner is labeled as `host2-win`
   - Ensure the runner is online and accepting jobs

**Log Locations:**
- GitHub Actions logs: Available in the workflow run details
- Windows Event Logs: Check System and Application logs
- Service logs: Check Butler SOS application logs if configured

## Configuration Files

The deployment includes the configuration template and log appender files in the zip package:
- `config/production_template.yaml` - Main configuration template
- `config/log_appender_xml/` - Log4j configuration files

Adjust the service binary path to point to your actual configuration file location if different from the template.

## Security Considerations

- The deployment uses PowerShell scripts with `continue-on-error: true` to prevent workflow failures
- Service management requires elevated permissions - ensure the GitHub runner runs with appropriate privileges
- Consider using a dedicated service account rather than Local System for better security
- Monitor deployment logs for any security-related issues

## Support

If you encounter issues with the automatic deployment:

1. Check the GitHub Actions workflow logs for detailed error messages
2. Verify the manual setup steps were completed correctly
3. Test service operations manually before relying on automation
4. Consider running a test deployment on a non-production system first