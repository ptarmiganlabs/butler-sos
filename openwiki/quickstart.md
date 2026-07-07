# Butler SOS — Quickstart

## What Is Butler SOS?

**Butler SOS** (Butler SenseOps Stats) is an open-source DevOps monitoring tool for **Qlik Sense Enterprise on Windows**. It collects operational metrics, log events, and user activity from Qlik Sense and publishes them to multiple destinations: InfluxDB (v1, v2, v3), Prometheus, New Relic, and MQTT.

- **Repository**: https://github.com/ptarmiganlabs/butler-sos
- **Documentation site**: https://butler-sos.ptarmiganlabs.com
- **License**: MIT
- **Author**: Göran Sander / Ptarmigan Labs
- **Current version**: 15.0.1 (from `package.json`)

## Core Capabilities

| Capability | How It Works | Key Source |
|---|---|---|
| **Log event collection** | UDP server receives semicolon-delimited log events from Qlik Sense services (engine, proxy, repository, scheduler, QIX perf) | `src/lib/udp_handlers/log_events/` |
| **User activity tracking** | UDP server receives user session events (session start/stop, connection open/close) | `src/lib/udp_handlers/user_events/` |
| **Health metrics** | Polls Qlik Sense engine healthcheck HTTPS API at configurable intervals | `src/lib/healthmetrics.js` |
| **Proxy session metrics** | Polls Qlik Proxy sessions API for per-user session data | `src/lib/proxysessionmetrics.js` |
| **Audit events API** | REST API that receives detailed audit events from the Audit.qs browser extension | `src/lib/audit-events-api.js` |
| **App name extraction** | Queries Qlik QRS API for app ID/name mappings | `src/lib/appnamesextract.js` |

## Data Destinations

| Destination | What It Receives | Key Source |
|---|---|---|
| **InfluxDB v1** | Health metrics, sessions, log events, user events, error counts, queue metrics | `src/lib/influxdb/v1/` |
| **InfluxDB v2** | Same as v1, using `@influxdata/influxdb-client` | `src/lib/influxdb/v2/` |
| **InfluxDB v3** | Same as v1, using `@influxdata/influxdb3-client` | `src/lib/influxdb/v3/` |
| **MQTT** | All event types published to configurable topics | `src/lib/post-to-mqtt.js` |
| **New Relic** | Health metrics, sessions, uptime, user events, log events, error counts | `src/lib/post-to-new-relic.js` |
| **Prometheus** | Gauges and counters via HTTP `/metrics` endpoint | `src/lib/prom-client.js` |
| **Parquet files** | Audit events written to partitioned Parquet files | `src/lib/audit-destinations/parquet/` |
| **QVD files** | Audit events written to Qlik QVD format | `src/lib/audit-destinations/qvd/` |
| **JSON files** | Audit events written to JSON | `src/lib/audit-destinations/json/` |

## Running the Application

### Source Mode (Development)

```bash
npm ci
npm run butler-sos -- -c src/config/production_template.yaml
```

### Docker

```bash
docker build -t butler-sos:latest .
docker run --rm -it -v $(pwd)/src/config:/app/src/config butler-sos:latest node src/butler-sos.js -c src/config/production_template.yaml
```

Docker Compose stacks for full monitoring (InfluxDB + Grafana) are available in `docs/docker-compose/`.

### Standalone Binary (SEA)

The app can be built as a Single Executable Application (SEA) — a standalone binary with no Node.js dependency:

```bash
npm run build:binary:linux    # Linux x64
npm run build:binary:macos    # macOS arm64
npm run build:binary:win      # Windows x64
```

See [Operations](operations.md) for build details.

## Project Structure

```
butler-sos/
├── src/                          # Application source code
│   ├── butler-sos.js             # Main entrypoint
│   ├── globals.js                # Singleton Settings (global state)
│   ├── bundle.js                 # esbuild entry (sets NODE_ENV=production)
│   ├── docker-healthcheck.js     # Docker HEALTHCHECK script
│   ├── config/                   # YAML config files + Qlik log4net XML
│   ├── plugins/                  # Fastify plugins
│   ├── lib/                      # Core application modules
│   │   ├── globals/              # Global initialization submodules
│   │   ├── influxdb/             # InfluxDB data storage (v1/v2/v3)
│   │   ├── udp_handlers/         # UDP message processing pipeline
│   │   ├── audit-destinations/   # Audit event output destinations
│   │   ├── config-schemas/       # JSON Schema definitions for config validation
│   │   ├── util/                 # Qlik-specific utilities
│   │   └── *.js                  # Data collection, destinations, utilities
│   └── __tests__/                # Jest test files
├── docs/                         # Documentation (Docker Compose, Grafana, audit config)
├── scripts/                      # Build and release scripts
├── static/                       # Static web assets (config visualization UI)
├── release-config/               # macOS signing entitlements
├── release-please-config.json    # Release-please automated release config
├── Dockerfile                    # Multi-stage Docker image
├── jest.config.mjs               # Jest test configuration
└── package.json                  # Project metadata and scripts
```

## Key Design Patterns

1. **Singleton Global State** — `src/globals.js` (Settings class) holds all application-wide state. Every module imports it.
2. **Factory Pattern** — InfluxDB writes dispatch to v1/v2/v3 implementations based on config version.
3. **Modular Config Schema** — 12 focused JSON Schema modules assembled into one validation schema.
4. **UDP Event Pipeline** — `UDP socket → Queue Manager → Parser → Handler → Categorizer → Destinations`.
5. **SEA Support** — Designed to run as both source code and a Node.js Single Executable Application binary.

## Quality Gates

Before committing changes:

```bash
npm run lint:fix       # ESLint + JSDoc + Prettier
npm run test:unit      # Jest (ESM mode)
```

## Navigation

| Topic | Page |
|---|---|
| System architecture, data flow, entry points | [Architecture](architecture.md) |
| Domain concepts: Qlik Sense monitoring, audit events, destinations | [Domain](domain.md) |
| Configuration system, YAML files, JSON Schema | [Configuration](configuration.md) |
| Docker, binary builds, releases, Grafana | [Operations](operations.md) |
| Testing patterns, coverage, conventions | [Testing](testing.md) |
