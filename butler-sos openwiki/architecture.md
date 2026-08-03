# Architecture

## Overview

Butler SOS is a Node.js (ESM) application that runs continuously as a monitoring service. The architecture is organized around a **singleton global state** (`Settings` class) that orchestrates initialization and provides centralized access to all subsystems.

### Key Design Decisions

- **ESM only** — `"type": "module"` in `package.json`; all imports use `import`/`export`
- **JSDoc enforced** — ESLint with `eslint-plugin-jsdoc` requires documentation on all params, returns, and Promise types
- **Config-driven** — YAML config via the `config` package; no env vars or hard-coded values for runtime behavior
- **SEA compatible** — Designed to run as both source code and as a Node.js Single Executable Application (SEA) binary

## Entrypoint: `src/butler-sos.js`

The `mainScript()` function in `src/butler-sos.js` orchestrates the entire startup sequence:

1. **Suppress warnings** — Patches `process.emit` to filter `ExperimentalWarning: Fetch API` and `DEP0169` (from `@influxdata/influxdb3-client`)
2. **Initialize globals** — Loads and initializes `src/globals.js` (Settings singleton)
3. **Start optional services** — Based on config, starts:
   - UDP server for user activity events (port ~9997)
   - UDP server for log events (port ~9996)
   - Health metrics polling timer
   - Proxy session metrics polling timer
   - App name extraction timer
   - Heartbeat timer
   - Service uptime monitor
   - Anonymous telemetry timer
4. **Start REST servers** — All built on Fastify:
   - Docker healthcheck server (`/health` on port 12398)
   - Prometheus metrics server (`/metrics`)
   - Config visualization server (web UI for obfuscated config)
   - Audit events API server (receives audit events from browser extension)
5. **Register process-level handlers** — `uncaughtException` (crash dump + exit) and `unhandledRejection` (log + continue)

### Warning Suppression

The app patches `process.emit` rather than `process.emitWarning` because in SEA binaries, the built-in `url` module holds a reference to the original `process.emitWarning` captured before any JS-level override can take effect. This ensures the suppression works in both source and SEA modes.

## Singleton Global State: `src/globals.js`

The `Settings` class is the central source of truth for all application-wide state. Key properties:

| Property | Source Module | Description |
|---|---|---|
| `config` | `lib/globals/config-loader.js` | YAML configuration loaded via `config` package |
| `logger` | `lib/globals/logging.js` | Winston logger (console + daily-rotating file) |
| `isSea` | `lib/sea-wrapper.js` | Whether running as Single Executable Application |
| `appVersion` | `lib/globals/app-info.js` | Version from `package.json` (SEA-aware) |
| `certPath`, `keyPath`, `caPath` | `lib/cert-utils.js` | TLS certificate paths for Qlik Sense HTTPS requests |
| `mqttClient` | Initialized in `globals.init()` | MQTT client instance |
| `hostInfo` | `lib/globals/host-info.js` | System info (CPU, RAM, OS, Docker) + instance ID |
| `appNames` | Populated by `lib/appnamesextract.js` | Qlik app ID/name mappings |
| `udpServerUserActivity` | `lib/globals/udp-servers.js` | UDP socket for user events |
| `udpServerLogEvents` | `lib/globals/udp-servers.js` | UDP socket for log events |

The initialization sequence in `Settings.init()`:
1. SEA initialization (`sea-wrapper.js`)
2. App info (`app-info.js`)
3. CLI parsing (`command-line.js`)
4. Config loading (`config-loader.js`)
5. Logging setup (`logging.js`)
6. UDP server creation (`udp-servers.js`)
7. InfluxDB client init (`influxdb.js`)
8. MQTT client creation
9. Host info gathering (`host-info.js`)

## UDP Event Pipeline

The core data collection mechanism uses a rate-limited pipeline:

```
Qlik Sense (UDP)
  → dgram socket (dgram4)
  → UdpQueueManager (rate-limited p-queue, circular buffer for latency tracking)
  → message-event.js (parser + dispatcher)
  → per-source handler (engine/proxy/repository/scheduler/qix-perf)
  → log-event-categorise.js (rule-based categorization, can drop matched events)
  → event-publisher.js (routes to configured destinations: MQTT, InfluxDB, New Relic)
```

Key modules:
- **`src/lib/udp-queue-manager.js`** — Rate-limited queue using `p-queue` with configurable concurrency, rate limits, overflow handling, and circular buffer for processing latency
- **`src/lib/udp-ip-validator.js`** — IPv4 validation, hostname resolution, source IP allowlisting with throttled reject warnings
- **`src/lib/udp-event.js`** — Tracks UDP event counts (log events by source, user events, rejected events), flushes to InfluxDB periodically

### Log Event Handlers (`src/lib/udp_handlers/log_events/`)

Five specialized handlers parse Qlik Sense's semicolon-delimited UDP message format:

| Handler | Log Source | Path |
|---|---|---|
| Engine | `/qseow-engine/` | `handlers/engine-handler.js` |
| Proxy | `/qseow-proxy/` | `handlers/proxy-handler.js` |
| Repository | `/qseow-repository/` | `handlers/repository-handler.js` |
| Scheduler | `/qseow-scheduler/` | `handlers/scheduler-handler.js` |
| QIX Perf | `/qseow-qix-perf/` | `handlers/qix-perf-handler.js` |

QIX performance events pass through filters (`filters/qix-perf-filters.js`) that match against app ID, object type, method, and other criteria.

### User Event Handler (`src/lib/udp_handlers/user_events/`)

Parses user session events (session start/stop, connection open/close). Uses Bowser for user-agent parsing to extract browser information.

## InfluxDB Storage Layer: `src/lib/influxdb/`

Uses a **factory pattern** to support InfluxDB v1, v2, and v3 from a single codebase:

```
src/lib/influxdb/
├── index.js              # Facade — exports all write functions
├── factory.js            # Dispatches to v1/v2/v3 based on detected version
├── shared/
│   ├── utils.js          # Version detection, point formatting, tag validation
│   ├── health-metrics-builder.js
│   └── queue-metrics-builder.js
├── v1/                   # Uses `influx` npm package
│   ├── butler-memory.js
│   ├── event-counts.js
│   ├── health-metrics.js
│   ├── log-events.js
│   ├── queue-metrics.js
│   ├── sessions.js
│   └── user-events.js
├── v2/                   # Uses `@influxdata/influxdb-client`
│   └── (same 7 modules + utils.js)
└── v3/                   # Uses `@influxdata/influxdb3-client`
    └── (same 7 modules)
```

Each version has parallel modules for the same 7 data categories. The `index.js` facade delegates to `factory.js`, which dispatches to the correct version-specific implementation.

## REST API Servers (Fastify)

| Server | Port | Purpose | Key Source |
|---|---|---|---|
| Docker Healthcheck | 12398 | `/health` endpoint for Docker container health probes | `butler-sos.js` (Fastify + `fastify-healthcheck`) |
| Prometheus Metrics | Configurable | `/metrics` endpoint exposing Butler-SOS and Node.js metrics | `src/lib/prom-client.js` |
| Config Visualization | Configurable | Web UI showing obfuscated configuration | `src/lib/config-visualise.js` |
| Audit Events API | Configurable | Receives audit events from Audit.qs browser extension | `src/lib/audit-events-api.js` |

All servers use Fastify with plugins from `src/plugins/` (`sensible.js` for HTTP error utilities, `support.js` for app decoration).

## SEA (Single Executable Application) Support

The app runs as both source code and a standalone binary:

- **`src/lib/sea-wrapper.js`** — Detects SEA mode via `process.pkg` and `PKG_EXECPATH` heuristics. Provides `isSea()` and SEA-aware path resolution.
- **`src/sea-config.json`** — Maps `build.cjs` as the main blob, embeds static assets (404.html, logo, config visualization HTML/JS/CSS).
- **`src/bundle.js`** — esbuild entry point that sets `NODE_ENV=production` and requires `./butler-sos`.
- In SEA mode, `__dirname`/`__filename` are unavailable; all file access goes through the SEA wrapper.

## Error Handling

- **`src/lib/log-error.js`** — Unified error logging. SEA mode shows message only; non-SEA shows message + stack trace. Supports `logFatal()` which triggers crash dumps.
- **`src/lib/crash-dump.js`** — Writes structured crash dumps (JSON + TXT) on fatal errors. Redacts sensitive config fields. Uses timeouts to never block `process.exit()`.
- **`src/lib/error-categorizer.js`** — Categorizes errors: `timeout`, `connection_refused`, `host_not_found`, `connection_reset`, `auth_error`, `tls_error`, `rate_limited`, etc.
- **`src/lib/error-tracker.js`** — Thread-safe (Mutex) error counter per API type. Resets daily at midnight UTC. Optionally writes to InfluxDB.

## Change Guidance

| If you change... | Watch for... | Tests to run... |
|---|---|---|
| `src/globals.js` or `lib/globals/*` | Every module imports globals; breaking changes cascade | Full suite: `npm run test:unit` |
| `src/lib/influxdb/*` | v1/v2/v3 implementations must stay in sync | `npm run test:unit` |
| `src/lib/udp_handlers/*` | Message format parsing is brittle; test with real UDP payloads | `npm run test:unit` |
| `src/lib/config-schemas/*` | Schema changes affect config validation; check against `production_template.yaml` | `npm run test:unit` |
| `src/butler-sos.js` | Startup order matters; adding services requires understanding init sequence | `npm run test:unit` |
| `src/lib/audit-events-api.js` | REST API changes may break Audit.qs extension compatibility | `npm run test:unit` |
