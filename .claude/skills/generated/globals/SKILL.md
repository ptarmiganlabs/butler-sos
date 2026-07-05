---
name: globals
description: "Skill for the Globals area of butler-sos. 36 symbols across 21 files."
---

# Globals

36 symbols | 21 files | Cohesion: 43%

## When to Use

- Working with code in `src/`
- Understanding how getAppNames, setupAppNamesExtractTimer, initInfluxDBClient work
- Modifying globals-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/lib/post-to-mqtt.js` | publishAsync, postHealthToMQTT, postUserSessionsToMQTT, postUserEventToMQTT, postLogEventToMQTT |
| `src/lib/appnamesextract.js` | trackAppNamesFailure, getAppNames, setupAppNamesExtractTimer |
| `src/lib/heartbeat.js` | callRemoteURL, setupHeartbeatTimer, t |
| `src/lib/sea-wrapper.js` | initialize, isSea, getAsset |
| `src/lib/config-file-verify.js` | createConditionalSchema, makeFeatureConditional, verifyConfigFileSchema |
| `src/lib/audit-events-api.js` | cleanupRateLimitViolationState, onExceeded |
| `src/lib/globals/influxdb.js` | initInfluxDBClient, initInfluxDB |
| `src/lib/udp-event.js` | setupUdpEventsStorage, UdpEvents |
| `src/lib/audit-destinations/influxdb/buffer.test.js` | get |
| `src/lib/audit-destinations/parquet/index.js` | getAuditParquetConfig |

## Entry Points

Start here when exploring this area:

- **`getAppNames`** (Function) — `src/lib/appnamesextract.js:37`
- **`setupAppNamesExtractTimer`** (Function) — `src/lib/appnamesextract.js:94`
- **`initInfluxDBClient`** (Function) — `src/lib/globals/influxdb.js:14`
- **`initInfluxDB`** (Function) — `src/lib/globals/influxdb.js:418`
- **`setupHeartbeatTimer`** (Function) — `src/lib/heartbeat.js:34`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `ErrorTracker` | Class | `src/lib/error-tracker.js` | 16 |
| `UdpEvents` | Class | `src/lib/udp-event.js` | 13 |
| `UdpQueueManager` | Class | `src/lib/udp-queue-manager.js` | 185 |
| `getAppNames` | Function | `src/lib/appnamesextract.js` | 37 |
| `setupAppNamesExtractTimer` | Function | `src/lib/appnamesextract.js` | 94 |
| `initInfluxDBClient` | Function | `src/lib/globals/influxdb.js` | 14 |
| `initInfluxDB` | Function | `src/lib/globals/influxdb.js` | 418 |
| `setupHeartbeatTimer` | Function | `src/lib/heartbeat.js` | 34 |
| `t` | Function | `src/lib/heartbeat.js` | 43 |
| `postHealthToMQTT` | Function | `src/lib/post-to-mqtt.js` | 32 |
| `postUserSessionsToMQTT` | Function | `src/lib/post-to-mqtt.js` | 112 |
| `postUserEventToMQTT` | Function | `src/lib/post-to-mqtt.js` | 155 |
| `postLogEventToMQTT` | Function | `src/lib/post-to-mqtt.js` | 291 |
| `setupUdpEventsStorage` | Function | `src/lib/udp-event.js` | 363 |
| `initCommandLine` | Function | `src/lib/globals/command-line.js` | 7 |
| `initLogging` | Function | `src/lib/globals/logging.js` | 9 |
| `verifyConfigFileSchema` | Function | `src/lib/config-file-verify.js` | 91 |
| `initConfig` | Function | `src/lib/globals/config-loader.js` | 11 |
| `initUdp` | Function | `src/lib/globals/udp-servers.js` | 10 |
| `initAppInfo` | Function | `src/lib/globals/app-info.js` | 10 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `SetupConfigVisServer → IsSea` | cross_community | 6 |
| `SetupHealthMetricsTimer → GetErrorStats` | cross_community | 6 |
| `SetupHealthMetricsTimer → IsSea` | cross_community | 6 |
| `SetupUserSessionsTimer → GetErrorStats` | cross_community | 6 |
| `SetupUserSessionsTimer → IsSea` | cross_community | 6 |
| `WriteAuditEventToParquet → Get` | cross_community | 6 |
| `WriteAuditEventToQvd → Get` | cross_community | 6 |
| `ProcessAuditEventEnvelope → Get` | cross_community | 6 |
| `Init → MakeFeatureConditional` | cross_community | 5 |
| `Init → IsValidHostname` | cross_community | 5 |

## Connected Areas

| Area | Connections |
|------|-------------|
| V2 | 7 calls |
| Cluster_37 | 5 calls |
| Influxdb | 5 calls |
| Cluster_36 | 1 calls |
| Cluster_41 | 1 calls |

## How to Explore

1. `gitnexus_context({name: "getAppNames"})` — see callers and callees
2. `gitnexus_query({query: "globals"})` — find related execution flows
3. Read key files listed above for implementation details
