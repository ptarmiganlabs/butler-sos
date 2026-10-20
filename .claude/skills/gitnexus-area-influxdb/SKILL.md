---
name: gitnexus-area-influxdb
description: "Skill for the Influxdb area of butler-sos. 174 symbols across 63 files."
---

# Influxdb

174 symbols | 63 files | Cohesion: 62%

## When to Use

- Working with code in `src/`
- Understanding how flushBuffer, initHostInfo, initInfluxDB work
- Modifying influxdb-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/lib/influxdb/shared/utils.js` | applyTagsToPoint3, getFormattedTime, getInfluxDbVersion, isInfluxDbEnabled, nextPointTimestamp (+13) |
| `src/lib/audit-destinations/influxdb/buffer.js` | requestFlush, run, _resetState, bufferAuditInfluxEvent, ensureAuditInfluxBucketV2 (+11) |
| `src/lib/influxdb/index.js` | storeEventCountInfluxDB, storeRejectedEventCountInfluxDB, postButlerSOSMemoryUsageToInfluxdb, postLogEventToInfluxdb, postUserEventToInfluxdb (+6) |
| `src/lib/influxdb/factory.js` | postButlerSOSMemoryUsageToInfluxdb, postHealthMetricsToInfluxdb, postLogEventToInfluxdb, postProxySessionsToInfluxdb, postUserEventToInfluxdb (+5) |
| `src/lib/post-to-new-relic.js` | postButlerSOSUptimeToNewRelic, postLogEventToNewRelic, postUserEventToNewRelic, sendNRLogEventYesNo, getFormattedTime (+2) |
| `src/lib/audit-destinations/influxdb/init.js` | ensureInfluxV1DatabaseExists, ensureInfluxV2BucketExists, getAuditInfluxConfig, initAuditInfluxDestination, isAuditApiEnabled (+1) |
| `src/lib/influxdb/v1/queue-metrics.js` | buildPointV1, storeQueueMetricsV1, storeAuditEventQueueMetricsV1, storeLogEventQueueMetricsV1, storeUserEventQueueMetricsV1 |
| `src/lib/influxdb/v2/queue-metrics.js` | buildPointV2, storeQueueMetricsV2, storeAuditEventQueueMetricsV2, storeLogEventQueueMetricsV2, storeUserEventQueueMetricsV2 |
| `src/lib/influxdb/v3/queue-metrics.js` | buildPointV3, postQueueMetricsToInfluxdbV3, postAuditEventQueueMetricsToInfluxdbV3, postLogEventQueueMetricsToInfluxdbV3, postUserEventQueueMetricsToInfluxdbV3 |
| `src/lib/udp-event.js` | intervalId, addLogEvent, addRejectedLogEvent, addUserEvent, setupUdpEventsStorage |

## Entry Points

Start here when exploring this area:

- **`flushBuffer`** (Function) — `src/lib/audit-destinations/shared/base.js:117`
- **`initHostInfo`** (Function) — `src/lib/globals/host-info.js:10`
- **`initInfluxDB`** (Function) — `src/lib/globals/influxdb.js:426`
- **`initInfluxDBClient`** (Function) — `src/lib/globals/influxdb.js:15`
- **`setupHeartbeatTimer`** (Function) — `src/lib/heartbeat.js:34`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `flushBuffer` | Function | `src/lib/audit-destinations/shared/base.js` | 117 |
| `initHostInfo` | Function | `src/lib/globals/host-info.js` | 10 |
| `initInfluxDB` | Function | `src/lib/globals/influxdb.js` | 426 |
| `initInfluxDBClient` | Function | `src/lib/globals/influxdb.js` | 15 |
| `setupHeartbeatTimer` | Function | `src/lib/heartbeat.js` | 34 |
| `t` | Function | `src/lib/heartbeat.js` | 43 |
| `postButlerSOSMemoryUsageToInfluxdb` | Function | `src/lib/influxdb/factory.js` | 95 |
| `postHealthMetricsToInfluxdb` | Function | `src/lib/influxdb/factory.js` | 49 |
| `postLogEventToInfluxdb` | Function | `src/lib/influxdb/factory.js` | 275 |
| `postProxySessionsToInfluxdb` | Function | `src/lib/influxdb/factory.js` | 72 |
| `postUserEventToInfluxdb` | Function | `src/lib/influxdb/factory.js` | 118 |
| `storeEventCountInfluxDB` | Function | `src/lib/influxdb/factory.js` | 140 |
| `storeRejectedEventCountInfluxDB` | Function | `src/lib/influxdb/factory.js` | 162 |
| `storeEventCountInfluxDB` | Function | `src/lib/influxdb/index.js` | 79 |
| `storeRejectedEventCountInfluxDB` | Function | `src/lib/influxdb/index.js` | 90 |
| `buildHealthMetricDatapoints` | Function | `src/lib/influxdb/shared/health-metrics-builder.js` | 29 |
| `prepareQueueMetricData` | Function | `src/lib/influxdb/shared/queue-metrics-builder.js` | 113 |
| `applyTagsToPoint3` | Function | `src/lib/influxdb/shared/utils.js` | 209 |
| `getFormattedTime` | Function | `src/lib/influxdb/shared/utils.js` | 14 |
| `getInfluxDbVersion` | Function | `src/lib/influxdb/shared/utils.js` | 174 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `MainScript → IsInfluxUnreachableError` | cross_community | 10 |
| `MainScript → TransientHttpStatus` | cross_community | 10 |
| `MainScript → Noop` | cross_community | 10 |
| `MainScript → IsRetryableWriteError` | cross_community | 10 |
| `MainScript → RetryAfterMs` | cross_community | 10 |
| `MainScript → TrackFailedInfluxWrite` | cross_community | 10 |
| `SetupUdpQueueMetricsStorage → IsInfluxUnreachableError` | cross_community | 10 |
| `SetupUdpQueueMetricsStorage → TransientHttpStatus` | cross_community | 10 |
| `SetupUdpQueueMetricsStorage → Noop` | cross_community | 10 |
| `SetupUdpQueueMetricsStorage → IsRetryableWriteError` | cross_community | 10 |

## How to Explore

1. `context({name: "flushBuffer"})` — see callers and callees
2. `query({search_query: "influxdb"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
