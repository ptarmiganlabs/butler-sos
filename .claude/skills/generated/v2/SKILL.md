---
name: v2
description: "Skill for the V2 area of butler-sos. 44 symbols across 26 files."
---

# V2

44 symbols | 26 files | Cohesion: 70%

## When to Use

- Working with code in `src/`
- Understanding how getErrorCategory, getErrorMetadata, postHealthMetricsToInfluxdb work
- Modifying v2-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/lib/influxdb/shared/utils.js` | getFormattedTime, processAppDocuments, isInfluxDbEnabled, getInfluxDbVersion, sanitizeInfluxTagValue (+6) |
| `src/lib/influxdb/factory.js` | postHealthMetricsToInfluxdb, postProxySessionsToInfluxdb, postButlerSOSMemoryUsageToInfluxdb, postUserEventToInfluxdb, storeRejectedEventCountInfluxDB (+1) |
| `src/lib/error-tracker.js` | incrementError, _isInfluxDbErrorTrackingEnabled, _writeErrorToInfluxDB |
| `src/lib/error-categorizer.js` | getErrorCategory, getErrorMetadata |
| `src/globals.js` | getErrorMessage |
| `src/lib/influxdb/shared/health-metrics-builder.js` | buildHealthMetricDatapoints |
| `src/lib/influxdb/v1/butler-memory.js` | storeButlerMemoryV1 |
| `src/lib/influxdb/v1/event-counts.js` | storeRejectedEventCountV1 |
| `src/lib/influxdb/v1/health-metrics.js` | postHealthMetricsToInfluxdbV1 |
| `src/lib/influxdb/v1/log-events.js` | storeLogEventV1 |

## Entry Points

Start here when exploring this area:

- **`getErrorCategory`** (Function) — `src/lib/error-categorizer.js:13`
- **`getErrorMetadata`** (Function) — `src/lib/error-categorizer.js:71`
- **`postHealthMetricsToInfluxdb`** (Function) — `src/lib/influxdb/factory.js:49`
- **`postProxySessionsToInfluxdb`** (Function) — `src/lib/influxdb/factory.js:72`
- **`postButlerSOSMemoryUsageToInfluxdb`** (Function) — `src/lib/influxdb/factory.js:95`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `getErrorCategory` | Function | `src/lib/error-categorizer.js` | 13 |
| `getErrorMetadata` | Function | `src/lib/error-categorizer.js` | 71 |
| `postHealthMetricsToInfluxdb` | Function | `src/lib/influxdb/factory.js` | 49 |
| `postProxySessionsToInfluxdb` | Function | `src/lib/influxdb/factory.js` | 72 |
| `postButlerSOSMemoryUsageToInfluxdb` | Function | `src/lib/influxdb/factory.js` | 95 |
| `postUserEventToInfluxdb` | Function | `src/lib/influxdb/factory.js` | 118 |
| `storeRejectedEventCountInfluxDB` | Function | `src/lib/influxdb/factory.js` | 162 |
| `postLogEventToInfluxdb` | Function | `src/lib/influxdb/factory.js` | 275 |
| `buildHealthMetricDatapoints` | Function | `src/lib/influxdb/shared/health-metrics-builder.js` | 29 |
| `getFormattedTime` | Function | `src/lib/influxdb/shared/utils.js` | 14 |
| `processAppDocuments` | Function | `src/lib/influxdb/shared/utils.js` | 86 |
| `isInfluxDbEnabled` | Function | `src/lib/influxdb/shared/utils.js` | 139 |
| `getInfluxDbVersion` | Function | `src/lib/influxdb/shared/utils.js` | 154 |
| `sanitizeInfluxTagValue` | Function | `src/lib/influxdb/shared/utils.js` | 172 |
| `writeToInfluxWithRetry` | Function | `src/lib/influxdb/shared/utils.js` | 225 |
| `chunkArray` | Function | `src/lib/influxdb/shared/utils.js` | 341 |
| `writeBatchToInfluxV1` | Function | `src/lib/influxdb/shared/utils.js` | 408 |
| `writePointsToInfluxV2` | Function | `src/lib/influxdb/shared/utils.js` | 484 |
| `writeBatchToInfluxV2` | Function | `src/lib/influxdb/shared/utils.js` | 516 |
| `writeBatchToInfluxV3` | Function | `src/lib/influxdb/shared/utils.js` | 610 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `WriteAuditEventToParquet → GetErrorMessage` | cross_community | 7 |
| `WriteAuditEventToQvd → GetErrorMessage` | cross_community | 7 |
| `PostHealthMetricsToInfluxdbV1 → GetErrorStats` | cross_community | 6 |
| `StoreLogEventV1 → GetErrorStats` | cross_community | 6 |
| `StoreUserEventV1 → GetErrorStats` | cross_community | 6 |
| `SetupHealthMetricsTimer → GetErrorStats` | cross_community | 6 |
| `StoreButlerMemoryV1 → GetErrorStats` | cross_community | 6 |
| `StoreSessionsV1 → GetErrorStats` | cross_community | 6 |
| `PostButlerSOSMemoryUsageToInfluxdbV3 → GetErrorStats` | cross_community | 6 |
| `PostProxySessionsToInfluxdbV3 → GetErrorStats` | cross_community | 6 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Globals | 23 calls |
| Influxdb | 10 calls |
| Cluster_39 | 2 calls |

## How to Explore

1. `gitnexus_context({name: "getErrorCategory"})` — see callers and callees
2. `gitnexus_query({query: "v2"})` — find related execution flows
3. Read key files listed above for implementation details
