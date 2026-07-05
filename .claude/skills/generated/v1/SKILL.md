---
name: v1
description: "Skill for the V1 area of butler-sos. 14 symbols across 7 files."
---

# V1

14 symbols | 7 files | Cohesion: 58%

## When to Use

- Working with code in `src/`
- Understanding how clearScreenshotSessionCache, postAuditEventQueueMetricsToInfluxdb, prepareQueueMetricData work
- Modifying v1-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/lib/influxdb/v1/queue-metrics.js` | buildPointV1, storeQueueMetricsV1, storeAuditEventQueueMetricsV1 |
| `src/lib/influxdb/v2/queue-metrics.js` | buildPointV2, storeQueueMetricsV2, storeAuditEventQueueMetricsV2 |
| `src/lib/influxdb/v3/queue-metrics.js` | buildPointV3, postQueueMetricsToInfluxdbV3, postAuditEventQueueMetricsToInfluxdbV3 |
| `src/lib/udp-queue-manager.js` | clear, clearMetrics |
| `src/lib/audit-screenshot-session-cache.js` | clearScreenshotSessionCache |
| `src/lib/influxdb/factory.js` | postAuditEventQueueMetricsToInfluxdb |
| `src/lib/influxdb/shared/queue-metrics-builder.js` | prepareQueueMetricData |

## Entry Points

Start here when exploring this area:

- **`clearScreenshotSessionCache`** (Function) — `src/lib/audit-screenshot-session-cache.js:201`
- **`postAuditEventQueueMetricsToInfluxdb`** (Function) — `src/lib/influxdb/factory.js:244`
- **`prepareQueueMetricData`** (Function) — `src/lib/influxdb/shared/queue-metrics-builder.js:113`
- **`storeAuditEventQueueMetricsV1`** (Function) — `src/lib/influxdb/v1/queue-metrics.js:127`
- **`storeAuditEventQueueMetricsV2`** (Function) — `src/lib/influxdb/v2/queue-metrics.js:122`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `clearScreenshotSessionCache` | Function | `src/lib/audit-screenshot-session-cache.js` | 201 |
| `postAuditEventQueueMetricsToInfluxdb` | Function | `src/lib/influxdb/factory.js` | 244 |
| `prepareQueueMetricData` | Function | `src/lib/influxdb/shared/queue-metrics-builder.js` | 113 |
| `storeAuditEventQueueMetricsV1` | Function | `src/lib/influxdb/v1/queue-metrics.js` | 127 |
| `storeAuditEventQueueMetricsV2` | Function | `src/lib/influxdb/v2/queue-metrics.js` | 122 |
| `postAuditEventQueueMetricsToInfluxdbV3` | Function | `src/lib/influxdb/v3/queue-metrics.js` | 121 |
| `clearMetrics` | Method | `src/lib/udp-queue-manager.js` | 457 |
| `buildPointV1` | Function | `src/lib/influxdb/v1/queue-metrics.js` | 10 |
| `storeQueueMetricsV1` | Function | `src/lib/influxdb/v1/queue-metrics.js` | 51 |
| `buildPointV2` | Function | `src/lib/influxdb/v2/queue-metrics.js` | 12 |
| `storeQueueMetricsV2` | Function | `src/lib/influxdb/v2/queue-metrics.js` | 42 |
| `buildPointV3` | Function | `src/lib/influxdb/v3/queue-metrics.js` | 11 |
| `postQueueMetricsToInfluxdbV3` | Function | `src/lib/influxdb/v3/queue-metrics.js` | 47 |
| `clear` | Method | `src/lib/udp-queue-manager.js` | 96 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `PostUserEventQueueMetricsToInfluxdb → Has` | cross_community | 5 |
| `PostUserEventQueueMetricsToInfluxdb → Get` | cross_community | 5 |
| `PostUserEventQueueMetricsToInfluxdb → IsInfluxDbEnabled` | cross_community | 5 |
| `PostUserEventQueueMetricsToInfluxdb → ChunkArray` | cross_community | 5 |
| `PostUserEventQueueMetricsToInfluxdb → GetErrorMessage` | cross_community | 5 |
| `PostLogEventQueueMetricsToInfluxdb → Has` | cross_community | 5 |
| `PostLogEventQueueMetricsToInfluxdb → Get` | cross_community | 5 |
| `PostLogEventQueueMetricsToInfluxdb → IsInfluxDbEnabled` | cross_community | 5 |
| `PostLogEventQueueMetricsToInfluxdb → ChunkArray` | cross_community | 5 |
| `PostLogEventQueueMetricsToInfluxdb → GetErrorMessage` | cross_community | 5 |

## Connected Areas

| Area | Connections |
|------|-------------|
| V2 | 12 calls |
| Globals | 4 calls |
| Influxdb | 1 calls |
| Get | 1 calls |

## How to Explore

1. `gitnexus_context({name: "clearScreenshotSessionCache"})` — see callers and callees
2. `gitnexus_query({query: "v1"})` — find related execution flows
3. Read key files listed above for implementation details
