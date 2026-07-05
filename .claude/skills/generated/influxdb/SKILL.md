---
name: influxdb
description: "Skill for the Influxdb area of butler-sos. 94 symbols across 38 files."
---

# Influxdb

94 symbols | 38 files | Cohesion: 53%

## When to Use

- Working with code in `src/`
- Understanding how writeAuditEventToDestinations, writeAuditEventToInfluxdb, initAuditInfluxDestination work
- Modifying influxdb-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/lib/audit-destinations/influxdb/buffer.js` | getAuditDestinationEnabled, getAuditInfluxConfig, stopFlushTimer, ensureFlushTimer, requestFlush (+11) |
| `src/lib/post-to-new-relic.js` | postButlerSOSUptimeToNewRelic, sendNRLogEventYesNo, postLogEventToNewRelic, getFormattedTime, postHealthMetricsToNewRelic (+2) |
| `src/lib/audit-destinations/influxdb/init.js` | isAuditApiEnabled, isAuditDestinationEnabled, getAuditInfluxConfig, initAuditInfluxDestination, ensureInfluxV1DatabaseExists (+1) |
| `src/lib/influxdb/index.js` | postButlerSOSMemoryUsageToInfluxdb, postHealthMetricsToInfluxdb, setupUdpQueueMetricsStorage, postProxySessionsToInfluxdb, postUserEventToInfluxdb |
| `src/lib/audit-screenshots.js` | generateXrfkey, createQlikMutualTlsAgent, requestQpsTicket, deleteQpsSession, debugLog |
| `src/lib/proxysessionmetrics.js` | prepUserSessionMetrics, setupUserSessionsTimer, getProxySessionStatsFromSense |
| `src/lib/telemetry.js` | safeGetConfig, safeGetProperty, callRemoteURL |
| `src/lib/prom-client.js` | saveHealthMetricsToPrometheus, setupPromClient, saveUserSessionMetricsToPrometheus |
| `src/lib/influxdb/factory.js` | storeEventCountInfluxDB, postUserEventQueueMetricsToInfluxdb, postLogEventQueueMetricsToInfluxdb |
| `src/lib/udp-event.js` | getLogEvents, getUserEvents, addUserEvent |

## Entry Points

Start here when exploring this area:

- **`writeAuditEventToDestinations`** (Function) — `src/lib/audit-destinations/index.js:16`
- **`writeAuditEventToInfluxdb`** (Function) — `src/lib/audit-destinations/influxdb/index.js:13`
- **`initAuditInfluxDestination`** (Function) — `src/lib/audit-destinations/influxdb/init.js:203`
- **`bufferAuditParquetEvent`** (Function) — `src/lib/audit-destinations/parquet/index.js:97`
- **`writeAuditEventToParquet`** (Function) — `src/lib/audit-destinations/parquet/index.js:108`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `writeAuditEventToDestinations` | Function | `src/lib/audit-destinations/index.js` | 16 |
| `writeAuditEventToInfluxdb` | Function | `src/lib/audit-destinations/influxdb/index.js` | 13 |
| `initAuditInfluxDestination` | Function | `src/lib/audit-destinations/influxdb/init.js` | 203 |
| `bufferAuditParquetEvent` | Function | `src/lib/audit-destinations/parquet/index.js` | 97 |
| `writeAuditEventToParquet` | Function | `src/lib/audit-destinations/parquet/index.js` | 108 |
| `bufferAuditQvdEvent` | Function | `src/lib/audit-destinations/qvd/index.js` | 95 |
| `writeAuditEventToQvd` | Function | `src/lib/audit-destinations/qvd/index.js` | 106 |
| `postButlerSOSMemoryUsageToInfluxdb` | Function | `src/lib/influxdb/index.js` | 48 |
| `applyTagsToPoint3` | Function | `src/lib/influxdb/shared/utils.js` | 189 |
| `validateUnsignedField` | Function | `src/lib/influxdb/shared/utils.js` | 368 |
| `postButlerSOSUptimeToNewRelic` | Function | `src/lib/post-to-new-relic.js` | 556 |
| `postLogEventToNewRelic` | Function | `src/lib/post-to-new-relic.js` | 1010 |
| `serviceUptimeStart` | Function | `src/lib/service_uptime.js` | 37 |
| `callRemoteURL` | Function | `src/lib/telemetry.js` | 58 |
| `createCertificateOptions` | Function | `src/lib/cert-utils.js` | 20 |
| `getCertificates` | Function | `src/lib/cert-utils.js` | 63 |
| `getHealthStatsFromSense` | Function | `src/lib/healthmetrics.js` | 31 |
| `postHealthMetricsToInfluxdb` | Function | `src/lib/influxdb/index.js` | 28 |
| `postHealthMetricsToNewRelic` | Function | `src/lib/post-to-new-relic.js` | 69 |
| `saveHealthMetricsToPrometheus` | Function | `src/lib/prom-client.js` | 255 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `WriteAuditEventToParquet → GetErrorMessage` | cross_community | 7 |
| `WriteAuditEventToQvd → GetErrorMessage` | cross_community | 7 |
| `WriteAuditEventToDestinations → StopFlushTimer` | cross_community | 6 |
| `WriteAuditEventToDestinations → AsObject` | cross_community | 6 |
| `WriteAuditEventToDestinations → ReadString` | cross_community | 6 |
| `SetupHealthMetricsTimer → GetErrorStats` | cross_community | 6 |
| `SetupHealthMetricsTimer → IsSea` | cross_community | 6 |
| `SetupUserSessionsTimer → GetErrorStats` | cross_community | 6 |
| `SetupUserSessionsTimer → IsSea` | cross_community | 6 |
| `WriteAuditEventToParquet → Has` | cross_community | 6 |

## Connected Areas

| Area | Connections |
|------|-------------|
| V2 | 44 calls |
| Globals | 38 calls |
| Cluster_35 | 11 calls |
| V1 | 6 calls |
| Cluster_13 | 4 calls |
| Cluster_50 | 3 calls |
| Cluster_52 | 2 calls |
| Cluster_16 | 2 calls |

## How to Explore

1. `gitnexus_context({name: "writeAuditEventToDestinations"})` — see callers and callees
2. `gitnexus_query({query: "influxdb"})` — find related execution flows
3. Read key files listed above for implementation details
