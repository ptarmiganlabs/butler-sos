# Butler SOS Crash Dump Feature

## Feature Overview

Butler SOS can create crash dump files when it encounters an unrecoverable error.
These files capture diagnostic information at the time of the crash and are
designed to help operators and developers understand what went wrong.

### When crash dumps are created

Crash dumps are generated for three kinds of fatal events:

| Source | Description |
|---|---|
| `uncaughtException` | A synchronous exception that was not caught by any `try/catch` |
| `unhandledRejection` | A rejected Promise without a `.catch()` handler |
| `logFatal` | An explicit fatal error triggered by the application before `process.exit(1)` |

### Why it's useful

- **Debugging** — Stack traces and runtime context are preserved at the exact
  moment of the crash, even when log files have already been rotated or the
  application cannot write further log entries.
- **Support** — Operators can share the plain-text crash dump with the Butler SOS
  support team. Sensitive config fields (passwords, tokens, IPs) are never
  written, and common secret patterns in error messages are redacted automatically.
- **Monitoring** — External tools can watch the `crashFileDirectory` for new files
  and trigger alerts.

---

## Configuration Reference

The `crashFile` section is a **mandatory** key under `Butler-SOS`.

```yaml
Butler-SOS:
  logDirectory: ./logs

  crashFile:
    enable: true                      # Default: true
    crashFileDirectory: ./crash_dumps # Default: ./crash_dumps
    crashFileCreateJson: true         # Default: true
    crashFileCreateText: true         # Default: true
```

### Settings

| Setting | Type | Default | Description |
|---|---|---|---|
| `enable` | boolean | `true` | Master switch. Set to `false` to disable crash dump creation entirely. |
| `crashFileDirectory` | string | `./crash_dumps` | Directory where crash files are written. Relative paths are resolved from Butler SOS's working directory. Absolute paths are supported. An empty string uses the working directory. |
| `crashFileCreateJson` | boolean | `true` | When `true`, creates a machine-readable JSON crash dump file. |
| `crashFileCreateText` | boolean | `true` | When `true`, creates a human-readable plain-text crash dump file. |

### Examples

The snippets below show just the `crashFile` key.  In a real config file these
must be placed **under the top-level `Butler-SOS` key** (see the full example
in the Configuration Reference block above).

**Minimal — only plain-text files:**

```yaml
Butler-SOS:
  crashFile:
    enable: true
    crashFileDirectory: ./crash_dumps
    crashFileCreateJson: false
    crashFileCreateText: true
```

**Disabled:**

```yaml
Butler-SOS:
  crashFile:
    enable: false
    crashFileDirectory: ./crash_dumps
    crashFileCreateJson: true
    crashFileCreateText: true
```

---

## File Formats

### Filename pattern

Both file types use the same naming convention, which includes a timestamp, the
process ID, and a per-process incrementing counter to guarantee uniqueness even
when multiple crashes occur within the same millisecond:

```
crash_dump_<YYYYMMDD>_<HHMMSS>_<mmm>_<PID>_<counter>.<ext>
```

- Timestamp is local time
- `mmm` is milliseconds (3 digits, zero-padded)
- `PID` is the operating system process ID
- `counter` is a per-process integer starting at 1
- Extension is `.json` or `.txt`

**Example:** `crash_dump_20260509_143045_123_12345_1.json`

Files are never overwritten — each crash produces uniquely-named files, and
`flag: 'wx'` (exclusive create) prevents any silent overwrites if a filename
were somehow reused.

---

### JSON format

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
    "stack": "at Function.foo (src/lib/foo.js:123)\n    at Module._compile (node:internal/modules/cjs-loader:456)"
  },
  "context": {
    "exitCode": 1,
    "source": "uncaughtException"
  },
  "config": {
    "logLevel": "info",
    "fileLogging": true,
    "logDirectory": "./logs",
    "anonTelemetry": false,
    "systemInfoEnable": true,
    "userEventsEnable": true,
    "influxdbEnable": true,
    "influxdbVersion": 2,
    "prometheusEnable": false,
    "mqttEnable": false,
    "auditEventsEnable": false
  }
}
```

#### JSON field descriptions

| Field | Type | Description |
|---|---|---|
| `version` | string | Crash dump format version (currently `"1.0"`) |
| `timestamp` | string | ISO 8601 UTC timestamp of when the dump was created |
| `app.name` | string | Always `"butler-sos"` |
| `app.version` | string | Butler SOS version from `package.json` |
| `runtime.nodeVersion` | string | Node.js version (from `process.version`) |
| `runtime.platform` | string | `process.platform/process.arch` (e.g. `"linux/x64"`) |
| `runtime.isSea` | boolean | `true` when running as a packaged SEA binary |
| `error.type` | string | Error constructor name (e.g. `"Error"`, `"TypeError"`) |
| `error.message` | string | Error message |
| `error.stack` | string | Sanitized stack trace (absolute paths stripped) |
| `context.exitCode` | number | Always `1` |
| `context.source` | string | `"uncaughtException"`, `"unhandledRejection"`, or `"logFatal"` |
| `config` | object | Sanitized, non-sensitive configuration snapshot (see below) |

---

### Plain-text format

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

### Config fields

Sensitive config fields are **never** written to crash dump files:

| Category | Examples |
|---|---|
| IP addresses / hostnames | Server hosts, client IPs, broker hosts |
| Credentials | Passwords, passphrases, client cert passphrases |
| API keys & tokens | New Relic keys, InfluxDB tokens |
| Account information | Account names, account IDs, organizations |
| Certificate paths & contents | `clientCert`, `clientCertKey`, `clientCertCA` |
| HTTP headers | Authorization headers |
| MQTT topics | Base topics |
| Usernames | Auth usernames |
| Storage bucket names | InfluxDB buckets |

Only the following **non-sensitive** config fields are captured in the `config`
section of the JSON dump:

- `logLevel`
- `fileLogging`
- `logDirectory`
- `anonTelemetry`
- `systemInfoEnable`
- `userEventsEnable`
- `influxdbEnable` / `influxdbVersion`
- `prometheusEnable`
- `mqttEnable`
- `auditEventsEnable`

### Error content: best-effort redaction

Error messages and stack traces are included to aid debugging.
Butler SOS applies **best-effort redaction** of common sensitive patterns:

| Pattern | Example input | After redaction |
|---|---|---|
| URL with embedded credentials | `mqtt://admin:secret@broker.example.com` | `mqtt://[REDACTED]@broker.example.com` |
| Authorization header tokens | `Bearer eyJhbGci...` | `Bearer [REDACTED]` |
| Key-value secret pairs | `password=hunter2` | `password=[REDACTED]` |
| JSON-style secret fields | `"token": "abc123"` | `"token": "[REDACTED]"` |

> **Note:** Redaction is best-effort only. Error messages generated by third-party
> libraries or unexpected secret formats may not be caught. Treat crash dump files
> as potentially sensitive and restrict access accordingly (e.g. limit who can
> read the `crashFileDirectory`).

### Stack traces

Absolute file system paths are removed from stack traces. Only
`src/`-relative paths and line numbers are preserved.

---

## Troubleshooting

### Where to find crash dumps

By default, crash dump files are created in `./crash_dumps/` relative to the
directory from which Butler SOS was started.  Use `crashFileDirectory` in the
config file to change this location.

### How to interpret the contents

1. Open the `.txt` file for a quick human-readable summary.
2. Open the `.json` file for machine-readable data that can be processed by
   support tooling.
3. The `error.message` and `error.stack` fields identify where the crash
   originated.
4. The `context.source` field tells you whether the crash was caused by an
   uncaught exception, unhandled rejection, or an explicit fatal error.
5. The `config` section shows which major features were enabled at the time of
   the crash.

### Crash dumps are not being created

- Verify `Butler-SOS.crashFile.enable` is `true`.
- Verify `Butler-SOS.crashFile.crashFileCreateJson` or
  `Butler-SOS.crashFile.crashFileCreateText` (or both) are `true`.
- Check that Butler SOS has write permission to the `crashFileDirectory`.
- If `crashFileDirectory` is a relative path, it is resolved from the process
  working directory, which may differ from the installation directory.
