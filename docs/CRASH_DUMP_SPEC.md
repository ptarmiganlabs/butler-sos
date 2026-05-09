# Butler SOS Crash Dump Specification

## Overview

When Butler SOS encounters an unrecoverable error (uncaught exception, unhandled promise rejection), it writes crash dump files for debugging purposes.

## Design Goals

1. **No sensitive data leakage** — IPs, passwords, API keys, tokens must never appear in crash dumps
2. **Machine + human readable** — JSON for tooling, TXT for human review
3. **SEA-compatible** — Works correctly in packaged Single Executable Applications
4. **Non-blocking** — Crash dump writing must not throw or block process exit

---

## File Naming

```
butler-sos_crash_<YYYYMMDD>_<HHMMSS>_<mmm>.json
butler-sos_crash_<YYYYMMDD>_<HHMMSS>_<mmm>.txt
```

- **Timestamp format**: ISO 8601 UTC with milliseconds
- **Directory**: Same as application logs (`Butler-SOS.logDirectory`)
- **Example**: `butler-sos_crash_20260509_143045_123.json`

---

## JSON Schema

```json
{
  "version": "1.0",
  "timestamp": "2026-05-09T14:30:45.123Z",
  "app": {
    "name": "butler-sos",
    "version": "14.0.0"
  },
  "runtime": {
    "nodeVersion": "22.10.0",
    "platform": "darwin/arm64",
    "isSea": true
  },
  "error": {
    "type": "Error",
    "message": "Connection refused",
    "stack": "at Function.foo (src/lib/foo.js:123)\n    at Module._compile ..."
  },
  "context": {
    "exitCode": 1,
    "source": "uncaughtException"
  },
  "config": {
    "logLevel": "info",
    "fileLogging": true,
    "anonTelemetry": false
  }
}
```

**Fields**:
| Field | Type | Description |
|-------|------|-------------|
| `version` | string | Crash dump format version (current: "1.0") |
| `timestamp` | string | ISO 8601 UTC timestamp |
| `app.name` | string | Always "butler-sos" |
| `app.version` | string | Butler SOS version from package.json |
| `runtime.nodeVersion` | string | `process.version` |
| `runtime.platform` | string | `process.platform` + `process.arch` |
| `runtime.isSea` | boolean | Running as packaged SEA |
| `error.type` | string | Error constructor name (e.g., "Error", "TypeError") |
| `error.message` | string | Error message |
| `error.stack` | string | Full stack trace |
| `context.exitCode` | number | Process exit code (always 1) |
| `context.source` | string | "uncaughtException" \| "unhandledRejection" \| "logFatal" |
| `config` | object | Sanitized non-sensitive config fields |

---

## Plain Text Format

```
====================================
BUTLER SOS CRASH REPORT
====================================
Generated: 2026-05-09T14:30:45.123Z

=== APPLICATION INFO ===
Butler SOS Version: 14.0.0
Node.js Version: 22.10.0
Platform: darwin/arm64
Executable: SEA (packaged) | Node.js

=== CRASH INFO ===
Error Type: Error
Source: uncaughtException
Exit Code: 1

=== ERROR MESSAGE ===
Connection refused

=== STACK TRACE ===
at Function.foo (src/lib/foo.js:123)
    at Module._compile (node:internal/modules/cjs-loader:456)
...

====================================
END OF CRASH REPORT
====================================
```

---

## Sensitive Data Handling

**CRITICAL: These MUST be excluded from crash dumps:**

| Category | Examples | Config Paths |
|----------|----------|--------------|
| IP addresses | Server hosts, client IPs | `*.host`, `serverHost`, `hostIP` |
| Credentials | Passwords, passphrases | `*.password`, `*.passphrase`, `*.clientCertPassphrase` |
| API keys | New Relic keys, InfluxDB tokens | `*.token`, `*.insertApiKey`, `*.apiToken` |
| Account info | Account names/IDs | `*.accountId`, `*.accountName`, `*.org` |
| Certificates | Paths, contents | `*.clientCert`, `*.clientCertKey`, `*.clientCertCA` |
| Headers | Authorization headers | `*.headers` |
| MQTT topics | Base topics | `*.baseTopic` |
| Usernames | Auth usernames | `*.username` |
| Buckets | InfluxDB buckets | `*.bucket` |

**Allowed config fields (non-sensitive):**
```yaml
logLevel
fileLogging
logDirectory
anonTelemetry
systemInfo.enable
userEvents.enable
logEvents (exclude udpServerConfig.serverHost)
influxdbConfig.version
influxdbConfig.enable
prometheus.enable
mqttConfig.enable
auditEvents.enable
```

**Stack trace sanitization:**
- Remove any path components that could reveal full file system structure
- Keep only relative paths (after `src/`) and line numbers
- Example: `/Users/goran/code/butler-sos/src/lib/foo.js:123` → `src/lib/foo.js:123`

---

## Feature Flag

Enable/disable via config:

```yaml
Butler-SOS:
  crashDump:
    enable: false  # default: false
```

When disabled, no crash dumps are written (but error is still logged).

---

## Error Sources

Crash dumps are written for:

1. **`uncaughtException`** — Synchronous exceptions not caught by try/catch
2. **`unhandledRejection`** — Promise rejections without `.catch()`
3. **`logFatal()`** — Explicit fatal errors before `process.exit(1)`

---

## Implementation Notes

- Write files asynchronously, don't block process exit
- Use `fs.promises` for non-blocking I/O
- Wrap writes in try/catch — crash dump failures must never throw
- Both files (JSON + TXT) should be written for each crash
- No file rotation — rely on system's log rotation or manual cleanup
- In SEA mode, use `sea.getExecPath()` for log directory

---

## API

### `writeCrashDump(error, source)`

**Parameters:**
- `error` (Error): The error object
- `source` (string): "uncaughtException" | "unhandledRejection" | "logFatal"

**Returns:** void (async, fire-and-forget)

**Behavior:**
1. Generate timestamped filenames
2. Build sanitized config object
3. Sanitize stack trace (strip full paths)
4. Write JSON file
5. Write TXT file
6. Catch and suppress any errors (never throw)

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `docs/CRASH_DUMP_SPEC.md` | This specification |
| `src/lib/crash-dump.js` | New: Crash dump generation module |
| `src/butler-sos.js` | Modify: Add process error handlers |
| `src/lib/log-error.js` | Modify: Add `logFatal()` function |
| `src/lib/config-schemas/basic-settings.js` | Modify: Add `crashDump` config schema |
| `src/config/production_template.yaml` | Modify: Document new config options |
| `src/lib/__tests__/crash-dump.test.js` | New: Unit tests |

---

## Testing Requirements

1. **JSON generation**: Verify all required fields present
2. **TXT generation**: Verify format matches specification
3. **Sensitive data filtering**: Verify IPs, passwords, tokens never appear
4. **Stack sanitization**: Verify full paths are stripped
5. **Config sanitization**: Verify only non-sensitive fields included
6. **Non-blocking**: Verify write failures don't throw
7. **File naming**: Verify timestamp format is correct