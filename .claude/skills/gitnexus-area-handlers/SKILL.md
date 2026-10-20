---
name: gitnexus-area-handlers
description: "Skill for the Handlers area of butler-sos. 11 symbols across 10 files."
---

# Handlers

11 symbols | 10 files | Cohesion: 73%

## When to Use

- Working with code in `src/`
- Understanding how categoriseLogEvent, sanitizeField, processEngineEvent work
- Modifying handlers-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/lib/udp_handlers/log_events/utils/common-utils.js` | formatUserFields, processGenericLogEvent |
| `src/lib/log-event-categorise.js` | categoriseLogEvent |
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

- **`categoriseLogEvent`** (Function) — `src/lib/log-event-categorise.js:28`
- **`sanitizeField`** (Function) — `src/lib/udp-queue-manager.js:171`
- **`processEngineEvent`** (Function) — `src/lib/udp_handlers/log_events/handlers/engine-handler.js:35`
- **`processProxyEvent`** (Function) — `src/lib/udp_handlers/log_events/handlers/proxy-handler.js:15`
- **`processQixPerfEvent`** (Function) — `src/lib/udp_handlers/log_events/handlers/qix-perf-handler.js:43`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `categoriseLogEvent` | Function | `src/lib/log-event-categorise.js` | 28 |
| `sanitizeField` | Function | `src/lib/udp-queue-manager.js` | 171 |
| `processEngineEvent` | Function | `src/lib/udp_handlers/log_events/handlers/engine-handler.js` | 35 |
| `processProxyEvent` | Function | `src/lib/udp_handlers/log_events/handlers/proxy-handler.js` | 15 |
| `processQixPerfEvent` | Function | `src/lib/udp_handlers/log_events/handlers/qix-perf-handler.js` | 43 |
| `processRepositoryEvent` | Function | `src/lib/udp_handlers/log_events/handlers/repository-handler.js` | 15 |
| `processSchedulerEvent` | Function | `src/lib/udp_handlers/log_events/handlers/scheduler-handler.js` | 34 |
| `messageEventHandler` | Function | `src/lib/udp_handlers/log_events/message-event.js` | 34 |
| `formatUserFields` | Function | `src/lib/udp_handlers/log_events/utils/common-utils.js` | 52 |
| `processGenericLogEvent` | Function | `src/lib/udp_handlers/log_events/utils/common-utils.js` | 103 |
| `messageEventHandler` | Function | `src/lib/udp_handlers/user_events/message-event.js` | 35 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `MessageEventHandler → IsRetryableWriteError` | cross_community | 10 |
| `MessageEventHandler → NextPointTimestamp` | cross_community | 9 |
| `MessageEventHandler → CountPoints` | cross_community | 9 |
| `UdpInitUserActivityServer → IsRunningInDocker` | cross_community | 8 |
| `MessageEventHandler → Noop` | cross_community | 7 |
| `MessageEventHandler → GetConfigArray` | cross_community | 6 |
| `UdpInitLogEventServer → SanitizeField` | cross_community | 5 |
| `UdpInitLogEventServer → FormatUserFields` | cross_community | 5 |
| `UdpInitUserActivityServer → PublishAsync` | cross_community | 5 |
| `UdpInitUserActivityServer → GetConfigArray` | cross_community | 5 |

## How to Explore

1. `context({name: "categoriseLogEvent"})` — see callers and callees
2. `query({search_query: "handlers"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
