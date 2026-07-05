---
name: cluster-16
description: "Skill for the Cluster_16 area of butler-sos. 7 symbols across 2 files."
---

# Cluster_16

7 symbols | 2 files | Cohesion: 70%

## When to Use

- Working with code in `src/`
- Understanding how stopFlushTimer, ensureFlushTimer, requestFlush work
- Modifying cluster_16-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/lib/audit-destinations/shared/base.js` | stopFlushTimer, ensureFlushTimer, requestFlush, flushBuffer, bufferEvent (+1) |
| `src/lib/audit-destinations/shared/helpers.js` | getAuditDestinationEnabled |

## Entry Points

Start here when exploring this area:

- **`stopFlushTimer`** (Function) — `src/lib/audit-destinations/shared/base.js:56`
- **`ensureFlushTimer`** (Function) — `src/lib/audit-destinations/shared/base.js:69`
- **`requestFlush`** (Function) — `src/lib/audit-destinations/shared/base.js:90`
- **`flushBuffer`** (Function) — `src/lib/audit-destinations/shared/base.js:117`
- **`bufferEvent`** (Function) — `src/lib/audit-destinations/shared/base.js:174`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `stopFlushTimer` | Function | `src/lib/audit-destinations/shared/base.js` | 56 |
| `ensureFlushTimer` | Function | `src/lib/audit-destinations/shared/base.js` | 69 |
| `requestFlush` | Function | `src/lib/audit-destinations/shared/base.js` | 90 |
| `flushBuffer` | Function | `src/lib/audit-destinations/shared/base.js` | 117 |
| `bufferEvent` | Function | `src/lib/audit-destinations/shared/base.js` | 174 |
| `_resetState` | Function | `src/lib/audit-destinations/shared/base.js` | 207 |
| `getAuditDestinationEnabled` | Function | `src/lib/audit-destinations/shared/helpers.js` | 55 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `WriteAuditEventToParquet → GetErrorMessage` | cross_community | 7 |
| `WriteAuditEventToQvd → GetErrorMessage` | cross_community | 7 |
| `WriteAuditEventToDestinations → StopFlushTimer` | cross_community | 6 |
| `WriteAuditEventToDestinations → AsObject` | cross_community | 6 |
| `WriteAuditEventToDestinations → ReadString` | cross_community | 6 |
| `WriteAuditEventToParquet → Has` | cross_community | 6 |
| `WriteAuditEventToParquet → Get` | cross_community | 6 |
| `WriteAuditEventToParquet → ReadNonEmptyString` | cross_community | 6 |
| `WriteAuditEventToQvd → Has` | cross_community | 6 |
| `WriteAuditEventToQvd → Get` | cross_community | 6 |

## Connected Areas

| Area | Connections |
|------|-------------|
| V2 | 1 calls |
| Util | 1 calls |
| Influxdb | 1 calls |
| Globals | 1 calls |

## How to Explore

1. `gitnexus_context({name: "stopFlushTimer"})` — see callers and callees
2. `gitnexus_query({query: "cluster_16"})` — find related execution flows
3. Read key files listed above for implementation details
