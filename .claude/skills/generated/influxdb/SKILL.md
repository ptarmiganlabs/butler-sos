---
name: influxdb
description: "Skill for the Influxdb area of butler-sos. 82 symbols across 32 files."
---

# Influxdb

82 symbols | 32 files | Cohesion: 52%

## When to Use

- Working with code in `src/`
- Understanding how writeAuditEventToDestinations, writeAuditEventToInfluxdb, initAuditInfluxDestination work
- Modifying influxdb-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/lib/audit-destinations/influxdb/buffer.js` | getAuditDestinationEnabled, getAuditInfluxConfig, stopFlushTimer, ensureFlushTimer, requestFlush (+11) |
| `src/lib/audit-destinations/influxdb/init.js` | isAuditApiEnabled, isAuditDestinationEnabled, getAuditInfluxConfig, initAuditInfluxDestination, ensureInfluxV1DatabaseExists (+1) |
| `src/lib/post-to-new-relic.js` | postButlerSOSUptimeToNewRelic, sendNRLogEventYesNo, postLogEventToNewRelic, getFormattedTime, postHealthMetricsToNewRelic (+1) |
| `src/lib/influxdb/index.js` | postButlerSOSMemoryUsageToInfluxdb, setupUdpQueueMetricsStorage, postHealthMetricsToInfluxdb, postProxySessionsToInfluxdb |
| `src/lib/influxdb/shared/utils.js` | getFormattedTime, processAppDocuments, applyTagsToPoint3, validateUnsignedField |
| `src/lib/telemetry.js` | safeGetConfig, safeGetProperty, callRemoteURL |
| `src/lib/prom-client.js` | setupPromClient, saveHealthMetricsToPrometheus, saveUserSessionMetricsToPrometheus |
| `src/lib/proxysessionmetrics.js` | setupUserSessionsTimer, prepUserSessionMetrics, getProxySessionStatsFromSense |
| `src/lib/influxdb/factory.js` | postHealthMetricsToInfluxdb, postUserEventQueueMetricsToInfluxdb, postLogEventQueueMetricsToInfluxdb |
| `src/lib/audit-destinations/influxdb/shared/client.js` | getConfigKey, getAuditInfluxConfig, getAuditInfluxClient |

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
| `postButlerSOSUptimeToNewRelic` | Function | `src/lib/post-to-new-relic.js` | 556 |
| `postLogEventToNewRelic` | Function | `src/lib/post-to-new-relic.js` | 1010 |
| `serviceUptimeStart` | Function | `src/lib/service_uptime.js` | 37 |
| `callRemoteURL` | Function | `src/lib/telemetry.js` | 58 |
| `setupHealthMetricsTimer` | Function | `src/lib/healthmetrics.js` | 130 |
| `setupUdpQueueMetricsStorage` | Function | `src/lib/influxdb/index.js` | 129 |
| `setupPromClient` | Function | `src/lib/prom-client.js` | 51 |
| `setupUserSessionsTimer` | Function | `src/lib/proxysessionmetrics.js` | 383 |
| `getServerHeaders` | Function | `src/lib/serverheaders.js` | 15 |
| `getServerTags` | Function | `src/lib/servertags.js` | 20 |
| `bufferAuditInfluxEvent` | Function | `src/lib/audit-destinations/influxdb/buffer.js` | 495 |
| `_resetState` | Function | `src/lib/audit-destinations/influxdb/buffer.js` | 549 |

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
| Globals | 35 calls |
| V2 | 34 calls |
| Cluster_37 | 8 calls |
| V1 | 6 calls |
| Cluster_13 | 4 calls |
| Cluster_51 | 2 calls |
| Cluster_16 | 2 calls |
| Cluster_20 | 1 calls |

## How to Explore

1. `gitnexus_context({name: "writeAuditEventToDestinations"})` — see callers and callees
2. `gitnexus_query({query: "influxdb"})` — find related execution flows
3. Read key files listed above for implementation details
