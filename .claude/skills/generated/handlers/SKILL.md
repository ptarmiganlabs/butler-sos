---
name: handlers
description: "Skill for the Handlers area of butler-sos. 14 symbols across 11 files."
---

# Handlers

14 symbols | 11 files | Cohesion: 79%

## When to Use

- Working with code in `src/`
- Understanding how sanitizeField, processEngineEvent, processProxyEvent work
- Modifying handlers-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/lib/udp-event.js` | addLogEvent, addUserEvent, addRejectedLogEvent |
| `src/lib/udp_handlers/log_events/utils/common-utils.js` | formatUserFields, processGenericLogEvent |
| `src/lib/udp-queue-manager.js` | sanitizeField |
| `src/lib/udp_handlers/log_events/handlers/engine-handler.js` | processEngineEvent |
| `src/lib/udp_handlers/log_events/handlers/proxy-handler.js` | processProxyEvent |
| `src/lib/udp_handlers/log_events/handlers/qix-perf-handler.js` | processQixPerfEvent |
| `src/lib/udp_handlers/log_events/handlers/repository-handler.js` | processRepositoryEvent |
| `src/lib/udp_handlers/log_events/handlers/scheduler-handler.js` | processSchedulerEvent |
| `src/lib/udp_handlers/log_events/message-event.js` | messageEventHandler |
| `src/lib/udp_handlers/user_events/message-event.js` | messageEventHandler |

## Entry Points

Start here when exploring this area:

- **`sanitizeField`** (Function) — `src/lib/udp-queue-manager.js:171`
- **`processEngineEvent`** (Function) — `src/lib/udp_handlers/log_events/handlers/engine-handler.js:35`
- **`processProxyEvent`** (Function) — `src/lib/udp_handlers/log_events/handlers/proxy-handler.js:15`
- **`processQixPerfEvent`** (Function) — `src/lib/udp_handlers/log_events/handlers/qix-perf-handler.js:43`
- **`processRepositoryEvent`** (Function) — `src/lib/udp_handlers/log_events/handlers/repository-handler.js:15`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `sanitizeField` | Function | `src/lib/udp-queue-manager.js` | 171 |
| `processEngineEvent` | Function | `src/lib/udp_handlers/log_events/handlers/engine-handler.js` | 35 |
| `processProxyEvent` | Function | `src/lib/udp_handlers/log_events/handlers/proxy-handler.js` | 15 |
| `processQixPerfEvent` | Function | `src/lib/udp_handlers/log_events/handlers/qix-perf-handler.js` | 43 |
| `processRepositoryEvent` | Function | `src/lib/udp_handlers/log_events/handlers/repository-handler.js` | 15 |
| `processSchedulerEvent` | Function | `src/lib/udp_handlers/log_events/handlers/scheduler-handler.js` | 34 |
| `messageEventHandler` | Function | `src/lib/udp_handlers/log_events/message-event.js` | 34 |
| `formatUserFields` | Function | `src/lib/udp_handlers/log_events/utils/common-utils.js` | 52 |
| `processGenericLogEvent` | Function | `src/lib/udp_handlers/log_events/utils/common-utils.js` | 103 |
| `messageEventHandler` | Function | `src/lib/udp_handlers/user_events/message-event.js` | 34 |
| `publishToDestinations` | Function | `src/lib/udp_handlers/utils/event-publisher.js` | 17 |
| `addLogEvent` | Method | `src/lib/udp-event.js` | 54 |
| `addUserEvent` | Method | `src/lib/udp-event.js` | 161 |
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
| Globals | 4 calls |
| Cluster_37 | 3 calls |
| Filters | 2 calls |
| V2 | 2 calls |

## How to Explore

1. `gitnexus_context({name: "sanitizeField"})` — see callers and callees
2. `gitnexus_query({query: "handlers"})` — find related execution flows
3. Read key files listed above for implementation details
