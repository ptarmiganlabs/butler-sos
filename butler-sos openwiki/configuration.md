# Configuration

## Config Files

Butler SOS uses YAML configuration files loaded via the `config` npm package. A single config template is shipped with the source:

| File | Purpose | Size |
|---|---|---|
| `src/config/production_template.yaml` | Default template with safer defaults (many features disabled) | ~40KB |

The config file path is specified via CLI: `-c` or `--configfile`.

### Qlik Sense UDP Forwarder Configs

XML files for configuring Qlik Sense log4net UDP appenders are provided in `src/config/log_appender_xml/`:
- `engine/LocalLogConfig.xml`
- `proxy/LocalLogConfig.xml`
- `repository/LocalLogConfig.xml`
- `scheduler/LocalLogConfig.xml`

These configure Qlik Sense services to forward log events via UDP to Butler SOS.

## Config Loading and Validation

The config loading pipeline (`src/lib/globals/config-loader.js`) performs:

1. **Load YAML** — Reads the YAML file using the `config` package
2. **Path resolution** — Resolves relative paths in the config against `process.cwd()`
3. **Schema validation** — Validates against JSON Schema using Ajv (`src/lib/config-file-verify.js`)
4. **Conditional validation** — Only validates sections whose features are enabled in the config

### JSON Schema System

The configuration schema is split into 12 modular files under `src/lib/config-schemas/`, assembled by `index.js`:

| Schema Module | Covers |
|---|---|
| `basic-settings.js` | `logLevel`, `fileLogging`, `logDirectory`, `crashFile`, `systemInfo`, `anonTelemetry` |
| `monitoring-services.js` | Health check, Prometheus, Docker health check, uptime monitor, heartbeat |
| `credentials.js` | Certificate paths, API tokens, third-party credentials |
| `qlik-sense-events.js` | Qlik Sense event configuration (rejected event counts) |
| `user-events.js` | User activity UDP server config, destination routing |
| `log-events.js` | Log event sources (engine/proxy/repository/scheduler/qix-perf), categorization rules |
| `destinations.js` | InfluxDB, MQTT, New Relic destination configurations |
| `app-sessions.js` | App name extraction and session metrics settings |
| `servers.js` | Server list, tags, headers for monitored Qlik Sense servers |
| `audit-events.js` | Audit events API and destination configuration |
| `error-tracking.js` | Error tracking settings |

The assembled schema is exported from `src/lib/config-file-schema.js`.

### Key Config Sections

| Section | Purpose |
|---|---|
| `Butler-SOS.cert` | TLS certificate paths for connecting to Qlik Sense |
| `Butler-SOS.servers` | List of Qlik Sense servers to monitor (host, name, tags, headers) |
| `Butler-SOS.healthCheck` | Health check polling configuration |
| `Butler-SOS.userEvents` | User activity UDP listener and destination config |
| `Butler-SOS.logEvents` | Log event sources, categorization rules, destinations |
| `Butler-SOS.destinations` | InfluxDB, MQTT, New Relic connection settings |
| `Butler-SOS.auditEvents` | Audit events API and destination configuration |
| `Butler-SOS.prometheus` | Prometheus metrics server settings |
| `Butler-SOS.heartbeat` | Remote heartbeat URL and interval |
| `Butler-SOS.uptimeMonitor` | Butler SOS own uptime tracking |
| `Butler-SOS.anonTelemetry` | Anonymous usage reporting toggle |
| `Butler-SOS.crashFile` | Crash dump output configuration |
| `Butler-SOS.systemInfo` | OS system information gathering toggle |

## Config Visualization

Butler SOS includes a web UI for viewing the current configuration (`src/lib/config-visualise.js`). The config is obfuscated before display (`src/lib/config-obfuscate.js`), masking sensitive fields like passwords, IPs, API keys, and certificate paths with asterisks.

The visualization UI is served as static files from `static/configvis/` using Handlebars templating and SEA-aware path resolution (`src/lib/file-prep.js`).

## Change Guidance

| If you change... | Watch for... |
|---|---|
| Config schema modules | Update `production_template.yaml` to stay valid |
| `config-file-verify.js` | Conditional validation logic must match the feature enable/disable patterns in config |
| `config-obfuscate.js` | New sensitive config fields must be added to the obfuscation list |
| `config-loader.js` | Path resolution behavior affects all modules that reference file paths from config |
