---
name: v2
description: "Skill for the V2 area of butler-sos. 46 symbols across 24 files."
---

# V2

46 symbols | 24 files | Cohesion: 74%

## When to Use

- Working with code in `src/`
- Understanding how getErrorCategory, getErrorMetadata, postProxySessionsToInfluxdb work
- Modifying v2-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/lib/influxdb/shared/utils.js` | isInfluxDbEnabled, validateRequiredFields, getInfluxDbVersion, sanitizeInfluxTagValue, writeToInfluxWithRetry (+5) |
| `src/lib/influxdb/factory.js` | postProxySessionsToInfluxdb, postButlerSOSMemoryUsageToInfluxdb, postUserEventToInfluxdb, storeEventCountInfluxDB, storeRejectedEventCountInfluxDB (+1) |
| `src/lib/error-tracker.js` | incrementError, _isInfluxDbErrorTrackingEnabled, _writeErrorToInfluxDB |
| `src/lib/udp-event.js` | getLogEvents, getRejectedLogEvents, getUserEvents |
| `src/lib/error-categorizer.js` | getErrorCategory, getErrorMetadata |
| `src/lib/influxdb/v1/event-counts.js` | storeEventCountV1, storeRejectedEventCountV1 |
| `src/lib/influxdb/v2/event-counts.js` | storeEventCountV2, storeRejectedEventCountV2 |
| `src/lib/influxdb/v3/event-counts.js` | storeEventCountInfluxDBV3, storeRejectedEventCountInfluxDBV3 |
| `src/globals.js` | getErrorMessage |
| `src/lib/influxdb/v1/butler-memory.js` | storeButlerMemoryV1 |

## Entry Points

Start here when exploring this area:

- **`getErrorCategory`** (Function) — `src/lib/error-categorizer.js:13`
- **`getErrorMetadata`** (Function) — `src/lib/error-categorizer.js:71`
- **`postProxySessionsToInfluxdb`** (Function) — `src/lib/influxdb/factory.js:72`
- **`postButlerSOSMemoryUsageToInfluxdb`** (Function) — `src/lib/influxdb/factory.js:95`
- **`postUserEventToInfluxdb`** (Function) — `src/lib/influxdb/factory.js:118`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `getErrorCategory` | Function | `src/lib/error-categorizer.js` | 13 |
| `getErrorMetadata` | Function | `src/lib/error-categorizer.js` | 71 |
| `postProxySessionsToInfluxdb` | Function | `src/lib/influxdb/factory.js` | 72 |
| `postButlerSOSMemoryUsageToInfluxdb` | Function | `src/lib/influxdb/factory.js` | 95 |
| `postUserEventToInfluxdb` | Function | `src/lib/influxdb/factory.js` | 118 |
| `storeEventCountInfluxDB` | Function | `src/lib/influxdb/factory.js` | 140 |
| `storeRejectedEventCountInfluxDB` | Function | `src/lib/influxdb/factory.js` | 162 |
| `postLogEventToInfluxdb` | Function | `src/lib/influxdb/factory.js` | 275 |
| `isInfluxDbEnabled` | Function | `src/lib/influxdb/shared/utils.js` | 139 |
| `validateRequiredFields` | Function | `src/lib/influxdb/shared/utils.js` | 158 |
| `getInfluxDbVersion` | Function | `src/lib/influxdb/shared/utils.js` | 174 |
| `sanitizeInfluxTagValue` | Function | `src/lib/influxdb/shared/utils.js` | 192 |
| `writeToInfluxWithRetry` | Function | `src/lib/influxdb/shared/utils.js` | 245 |
| `chunkArray` | Function | `src/lib/influxdb/shared/utils.js` | 361 |
| `writeBatchToInfluxV1` | Function | `src/lib/influxdb/shared/utils.js` | 428 |
| `writePointsToInfluxV2` | Function | `src/lib/influxdb/shared/utils.js` | 504 |
| `writeBatchToInfluxV2` | Function | `src/lib/influxdb/shared/utils.js` | 536 |
| `writeBatchToInfluxV3` | Function | `src/lib/influxdb/shared/utils.js` | 630 |
| `storeButlerMemoryV1` | Function | `src/lib/influxdb/v1/butler-memory.js` | 17 |
| `storeEventCountV1` | Function | `src/lib/influxdb/v1/event-counts.js` | 14 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `WriteAuditEventToParquet → GetErrorMessage` | cross_community | 7 |
| `WriteAuditEventToQvd → GetErrorMessage` | cross_community | 7 |
| `PostHealthMetricsToInfluxdbV1 → GetErrorStats` | cross_community | 6 |
| `StoreLogEventV1 → GetErrorStats` | cross_community | 6 |
| `StoreLogEventV2 → GetErrorStats` | cross_community | 6 |
| `SetupHealthMetricsTimer → GetErrorStats` | cross_community | 6 |
| `StoreButlerMemoryV1 → GetErrorStats` | cross_community | 6 |
| `StoreSessionsV1 → GetErrorStats` | cross_community | 6 |
| `StoreButlerMemoryV2 → GetErrorStats` | cross_community | 6 |
| `PostButlerSOSMemoryUsageToInfluxdbV3 → GetErrorStats` | cross_community | 6 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Globals | 24 calls |
| Influxdb | 12 calls |
| Cluster_41 | 2 calls |

## How to Explore

1. `gitnexus_context({name: "getErrorCategory"})` — see callers and callees
2. `gitnexus_query({query: "v2"})` — find related execution flows
3. Read key files listed above for implementation details
