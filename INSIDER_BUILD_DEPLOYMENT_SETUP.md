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

**Option A: Using NSSM (Non-Sucking Service Manager) - Recommended**

NSSM is a popular tool for creating Windows services from executables and provides better service management capabilities.

First, download and install NSSM:
1. Download NSSM from https://nssm.cc/download
2. Extract to a location like `C:\nssm` 
3. Add `C:\nssm\win64` (or `win32`) to your system PATH

```cmd
REM Run as Administrator
REM Install the service
nssm install "Butler SOS insiders build" "C:\butler-sos-insider\butler-sos.exe"

REM Set service parameters
nssm set "Butler SOS insiders build" AppParameters "--config C:\butler-sos-insider\config\production_template.yaml"
nssm set "Butler SOS insiders build" AppDirectory "C:\butler-sos-insider"
nssm set "Butler SOS insiders build" DisplayName "Butler SOS insiders build"
nssm set "Butler SOS insiders build" Description "Butler SOS insider build for testing"
nssm set "Butler SOS insiders build" Start SERVICE_DEMAND_START

REM Optional: Set up logging
nssm set "Butler SOS insiders build" AppStdout "C:\butler-sos-insider\logs\stdout.log"
nssm set "Butler SOS insiders build" AppStderr "C:\butler-sos-insider\logs\stderr.log"

REM Optional: Set service account (default is Local System)
REM nssm set "Butler SOS insiders build" ObjectName ".\ServiceAccount" "password"
```

**NSSM Service Management Commands:**
```cmd
REM Start the service
nssm start "Butler SOS insiders build"

REM Stop the service  
nssm stop "Butler SOS insiders build"

REM Restart the service
nssm restart "Butler SOS insiders build"

REM Check service status
nssm status "Butler SOS insiders build"

REM Remove the service (if needed)
nssm remove "Butler SOS insiders build" confirm

REM Edit service configuration
nssm edit "Butler SOS insiders build"
```

**Using NSSM with PowerShell:**
```powershell
# Run as Administrator
$serviceName = "Butler SOS insiders build"
$exePath = "C:\butler-sos-insider\butler-sos.exe"
$configPath = "C:\butler-sos-insider\config\production_template.yaml"

# Install service
& nssm install $serviceName $exePath
& nssm set $serviceName AppParameters "--config $configPath"
& nssm set $serviceName AppDirectory "C:\butler-sos-insider"
& nssm set $serviceName DisplayName $serviceName
& nssm set $serviceName Description "Butler SOS insider build for testing"
& nssm set $serviceName Start SERVICE_DEMAND_START

# Create logs directory
New-Item -ItemType Directory -Path "C:\butler-sos-insider\logs" -Force

# Set up logging
& nssm set $serviceName AppStdout "C:\butler-sos-insider\logs\stdout.log"
& nssm set $serviceName AppStderr "C:\butler-sos-insider\logs\stderr.log"

Write-Host "Service '$serviceName' installed successfully with NSSM"
```

**Option B: Using PowerShell**
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

**Option C: Using SC command**
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

**Option D: Using NSSM (Non-Sucking Service Manager) - Recommended**

NSSM is a popular tool for creating Windows services from executables and provides better service management capabilities.

First, download and install NSSM:
1. Download NSSM from https://nssm.cc/download
2. Extract to a location like `C:\nssm` 
3. Add `C:\nssm\win64` (or `win32`) to your system PATH

```cmd
REM Run as Administrator
REM Install the service
nssm install "Butler SOS insiders build" "C:\butler-sos-insider\butler-sos.exe"

REM Set service parameters
nssm set "Butler SOS insiders build" AppParameters "--config C:\butler-sos-insider\config\production_template.yaml"
nssm set "Butler SOS insiders build" AppDirectory "C:\butler-sos-insider"
nssm set "Butler SOS insiders build" DisplayName "Butler SOS insiders build"
nssm set "Butler SOS insiders build" Description "Butler SOS insider build for testing"
nssm set "Butler SOS insiders build" Start SERVICE_DEMAND_START

REM Optional: Set up logging
nssm set "Butler SOS insiders build" AppStdout "C:\butler-sos-insider\logs\stdout.log"
nssm set "Butler SOS insiders build" AppStderr "C:\butler-sos-insider\logs\stderr.log"

REM Optional: Set service account (default is Local System)
REM nssm set "Butler SOS insiders build" ObjectName ".\ServiceAccount" "password"
```

**NSSM Service Management Commands:**
```cmd
REM Start the service
nssm start "Butler SOS insiders build"

REM Stop the service  
nssm stop "Butler SOS insiders build"

REM Restart the service
nssm restart "Butler SOS insiders build"

REM Check service status
nssm status "Butler SOS insiders build"

REM Remove the service (if needed)
nssm remove "Butler SOS insiders build" confirm

REM Edit service configuration
nssm edit "Butler SOS insiders build"
```

**Using NSSM with PowerShell:**
```powershell
# Run as Administrator
$serviceName = "Butler SOS insiders build"
$exePath = "C:\butler-sos-insider\butler-sos.exe"
$configPath = "C:\butler-sos-insider\config\production_template.yaml"

# Install service
& nssm install $serviceName $exePath
& nssm set $serviceName AppParameters "--config $configPath"
& nssm set $serviceName AppDirectory "C:\butler-sos-insider"
& nssm set $serviceName DisplayName $serviceName
& nssm set $serviceName Description "Butler SOS insider build for testing"
& nssm set $serviceName Start SERVICE_DEMAND_START

# Create logs directory
New-Item -ItemType Directory -Path "C:\butler-sos-insider\logs" -Force

# Set up logging
& nssm set $serviceName AppStdout "C:\butler-sos-insider\logs\stdout.log"
& nssm set $serviceName AppStderr "C:\butler-sos-insider\logs\stderr.log"

Write-Host "Service '$serviceName' installed successfully with NSSM"
```

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
   - If using NSSM: `nssm status "Butler SOS insiders build"`

2. **Permission denied:**
   - Verify the GitHub runner has service management permissions
   - Check directory permissions for `C:\butler-sos-insider`
   - If using NSSM: Ensure NSSM is in system PATH and accessible to the runner account

3. **Service won't start:**
   - Check the service configuration and binary path
   - Review Windows Event Logs for service startup errors
   - Ensure the configuration file is present and valid
   - **If using NSSM:**
     - Check service configuration: `nssm get "Butler SOS insiders build" AppDirectory`
     - Check parameters: `nssm get "Butler SOS insiders build" AppParameters`
     - Review NSSM logs in `C:\butler-sos-insider\logs\` (if configured)
     - Use `nssm edit "Butler SOS insiders build"` to open the GUI editor

4. **GitHub Runner not found:**
   - Verify the runner is labeled as `host2-win`
   - Ensure the runner is online and accepting jobs

5. **NSSM-specific issues:**
   - **NSSM not found:** Ensure NSSM is installed and in system PATH
   - **Service already exists:** Use `nssm remove "Butler SOS insiders build" confirm` to remove and recreate
   - **Wrong parameters:** Use `nssm set "Butler SOS insiders build" AppParameters "new-parameters"`
   - **Logging issues:** Verify the logs directory exists and has write permissions

**NSSM Diagnostic Commands:**
```cmd
REM Check if NSSM is available
nssm version

REM Get all service parameters
nssm dump "Butler SOS insiders build"

REM Check specific configuration
nssm get "Butler SOS insiders build" Application
nssm get "Butler SOS insiders build" AppDirectory
nssm get "Butler SOS insiders build" AppParameters
nssm get "Butler SOS insiders build" Start

REM View service status
nssm status "Butler SOS insiders build"
```

**Log Locations:**
- GitHub Actions logs: Available in the workflow run details
- Windows Event Logs: Check System and Application logs
- Service logs: Check Butler SOS application logs if configured
- **NSSM logs** (if using NSSM with logging enabled): 
  - stdout: `C:\butler-sos-insider\logs\stdout.log`
  - stderr: `C:\butler-sos-insider\logs\stderr.log`

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