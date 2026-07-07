# Domain Concepts

## Qlik Sense Monitoring

Butler SOS monitors **Qlik Sense Enterprise on Windows**. The monitoring targets Qlik Sense services that emit data through two channels:

### UDP Log Events

Qlik Sense services (engine, proxy, repository, scheduler) emit semicolon-delimited log events over UDP. Butler SOS configures these services using log4net UDP appender XML files in `src/config/log_appender_xml/` (one per service: engine, proxy, repository, scheduler). Each service sends events to Butler SOS's UDP listener.

### REST API Polling

Butler SOS also polls Qlik Sense HTTPS APIs:
- **Engine healthcheck API** — Engine health and performance metrics (`src/lib/healthmetrics.js`)
- **Proxy sessions API** — Per-user session data (`src/lib/proxysessionmetrics.js`)
- **QRS API** — App ID/name mappings (`src/lib/appnamesextract.js`)

All HTTPS connections use client certificates configured in the YAML config.

## Audit Events System

The audit events system captures detailed user interactions within Qlik Sense apps via the **Audit.qs** browser extension.

### How It Works

1. The Audit.qs extension runs in the user's browser and captures events (selection changes, sheet navigation, bookmark usage, etc.)
2. Events are sent to Butler SOS's REST API (`src/lib/audit-events-api.js`)
3. Butler SOS validates events against Ajv schemas, handles optional screenshot downloads
4. Events are routed to configured destinations

### Supported Event Types

The API supports 30+ event types including `selection.state.changed`, `navigation.sheet.loaded`, `bookmark.created`, `export.data`, and more. Event validation uses Ajv schemas built into the audit events API module.

### Screenshot Capture

The system can capture and store screenshots of Qlik Sense app states:
- Downloads screenshots from Qlik Sense via session cookies, certificate auth, or QRS ticket auth (`src/lib/audit-screenshots.js`)
- Uses an LRU cache for session cookies/tokens (`src/lib/audit-screenshot-session-cache.js`)
- Draws metadata headers (app name, user, timestamp) onto PNG images using `pngjs` (`src/lib/audit-screenshot-metadata-image.js`)

### Compatibility

Version compatibility between Butler SOS and Audit.qs is managed via a semver compatibility matrix in `src/lib/audit-qs-compatibility.js`.

## Output Destinations

### InfluxDB (v1, v2, v3)

The primary destination for metrics and events. Butler SOS supports all three major InfluxDB versions from a single codebase using a factory pattern. The version is auto-detected from the config file.

Data categories written to InfluxDB:
| Category | Content |
|---|---|
| `health-metrics` | Engine healthcheck API results |
| `sessions` | Proxy session metrics |
| `butler-memory` | Butler SOS own memory and CPU usage |
| `user-events` | User activity events from UDP |
| `event-counts` | UDP event count aggregations |
| `queue-metrics` | UDP queue processing metrics |
| `log-events` | Parsed and categorized log events |

### Audit Event Destinations

| Destination | Format | Source |
|---|---|---|
| **InfluxDB** | Time-series points | `src/lib/audit-destinations/influxdb/` |
| **Parquet** | Columnar Parquet files | `src/lib/audit-destinations/parquet/` (via `hyparquet-writer`) |
| **QVD** | Qlik QVD format | `src/lib/audit-destinations/qvd/` (via `qvdjs`) |
| **JSON** | JSON lines | `src/lib/audit-destinations/json/` |

File-based destinations (Parquet, QVD) share a common factory (`src/lib/audit-destinations/shared/base.js`) that manages in-memory buffering, file rotation (`YYYYMMDD_partN.<ext>`), flush timers, and error recovery.

### MQTT

Publishes health metrics, user sessions, log events, and user events to configurable MQTT topics (`src/lib/post-to-mqtt.js`).

### New Relic

Sends health metrics, proxy sessions, Butler SOS uptime, user events, log events, and error counts to New Relic via its REST API (`src/lib/post-to-new-relic.js`).

### Prometheus

Defines Prometheus metric collectors (gauges and counters) for health metrics, sessions, cache, CPU, and memory. Served via a dedicated Fastify instance on the `/metrics` endpoint (`src/lib/prom-client.js`).

## Telemetry

Butler SOS includes an optional anonymous usage reporting feature via PostHog (`src/lib/telemetry.js`). It collects:
- Feature usage statistics (which features are enabled)
- OS/platform information
- Configuration shape metadata

This can be disabled in the config file via `Butler-SOS.anonTelemetry.enable`.

## Utility Modules

| Module | Purpose |
|---|---|
| `src/lib/util/user-identity.js` | Parses Qlik user identity strings (`UserDirectory=X; UserId=Y`, `X\Y`) |
| `src/lib/util/qlik-session-utils.js` | Extracts virtual proxy name from Qlik session cookie names |
| `src/lib/servertags.js` | Extracts server tags (`host`, `server_name`, `server_description` + custom) for metrics tagging |
| `src/lib/serverheaders.js` | Extracts custom HTTP headers from server config objects |
| `src/lib/cert-utils.js` | Loads TLS client certificates for HTTPS requests to Qlik Sense |
| `src/lib/host-utils.js` | Hostname validation, IPv4 resolution, TCP port reachability checks |
