---
name: handlers
description: "Skill for the Handlers area of butler-sos. 13 symbols across 11 files."
---

# Handlers

13 symbols | 11 files | Cohesion: 76%

## When to Use

- Working with code in `src/`
- Understanding how postLogEventToInfluxdb, categoriseLogEvent, sanitizeField work
- Modifying handlers-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/lib/udp-event.js` | addLogEvent, addRejectedLogEvent |
| `src/lib/udp_handlers/log_events/utils/common-utils.js` | formatUserFields, processGenericLogEvent |
| `src/lib/influxdb/index.js` | postLogEventToInfluxdb |
| `src/lib/log-event-categorise.js` | categoriseLogEvent |
| `src/lib/udp-queue-manager.js` | sanitizeField |
| `src/lib/udp_handlers/log_events/handlers/engine-handler.js` | processEngineEvent |
| `src/lib/udp_handlers/log_events/handlers/proxy-handler.js` | processProxyEvent |
| `src/lib/udp_handlers/log_events/handlers/qix-perf-handler.js` | processQixPerfEvent |
| `src/lib/udp_handlers/log_events/handlers/repository-handler.js` | processRepositoryEvent |
| `src/lib/udp_handlers/log_events/handlers/scheduler-handler.js` | processSchedulerEvent |

## Entry Points

Start here when exploring this area:

- **`postLogEventToInfluxdb`** (Function) — `src/lib/influxdb/index.js:68`
- **`categoriseLogEvent`** (Function) — `src/lib/log-event-categorise.js:27`
- **`sanitizeField`** (Function) — `src/lib/udp-queue-manager.js:171`
- **`processEngineEvent`** (Function) — `src/lib/udp_handlers/log_events/handlers/engine-handler.js:35`
- **`processProxyEvent`** (Function) — `src/lib/udp_handlers/log_events/handlers/proxy-handler.js:15`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `postLogEventToInfluxdb` | Function | `src/lib/influxdb/index.js` | 68 |
| `categoriseLogEvent` | Function | `src/lib/log-event-categorise.js` | 27 |
| `sanitizeField` | Function | `src/lib/udp-queue-manager.js` | 171 |
| `processEngineEvent` | Function | `src/lib/udp_handlers/log_events/handlers/engine-handler.js` | 35 |
| `processProxyEvent` | Function | `src/lib/udp_handlers/log_events/handlers/proxy-handler.js` | 15 |
| `processQixPerfEvent` | Function | `src/lib/udp_handlers/log_events/handlers/qix-perf-handler.js` | 43 |
| `processRepositoryEvent` | Function | `src/lib/udp_handlers/log_events/handlers/repository-handler.js` | 15 |
| `processSchedulerEvent` | Function | `src/lib/udp_handlers/log_events/handlers/scheduler-handler.js` | 34 |
| `messageEventHandler` | Function | `src/lib/udp_handlers/log_events/message-event.js` | 33 |
| `formatUserFields` | Function | `src/lib/udp_handlers/log_events/utils/common-utils.js` | 52 |
| `processGenericLogEvent` | Function | `src/lib/udp_handlers/log_events/utils/common-utils.js` | 103 |
| `addLogEvent` | Method | `src/lib/udp-event.js` | 54 |
| `addRejectedLogEvent` | Method | `src/lib/udp-event.js` | 268 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `MessageEventHandler → SanitizeField` | intra_community | 4 |
| `MessageEventHandler → FormatUserFields` | intra_community | 4 |
| `ProcessQixPerfEvent → ProcessObjectIdFilters` | cross_community | 3 |
| `ProcessQixPerfEvent → ProcessMethodFilters` | cross_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Globals | 3 calls |
| Cluster_35 | 2 calls |
| Filters | 2 calls |
| Cluster_50 | 1 calls |
| Influxdb | 1 calls |
| V2 | 1 calls |

## How to Explore

1. `gitnexus_context({name: "postLogEventToInfluxdb"})` — see callers and callees
2. `gitnexus_query({query: "handlers"})` — find related execution flows
3. Read key files listed above for implementation details
