---
name: gitnexus-area-parquet
description: "Skill for the Parquet area of butler-sos. 14 symbols across 6 files."
---

# Parquet

14 symbols | 6 files | Cohesion: 67%

## When to Use

- Working with code in `src/`
- Understanding how _resetState, _resetState, _resetState work
- Modifying parquet-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/lib/audit-destinations/shared/base.js` | _resetState, bufferEvent, ensureFlushTimer, requestFlush, stopFlushTimer |
| `src/lib/audit-destinations/parquet/index.js` | _resetState, bufferAuditParquetEvent, writeAuditEventToParquet |
| `src/lib/audit-destinations/qvd/index.js` | _resetState, bufferAuditQvdEvent, writeAuditEventToQvd |
| `src/lib/audit-destinations/shared/helpers.js` | getAuditDestinationEnabled |
| `src/lib/audit-destinations/index.js` | writeAuditEventToDestinations |
| `src/lib/audit-destinations/influxdb/index.js` | writeAuditEventToInfluxdb |

## Entry Points

Start here when exploring this area:

- **`_resetState`** (Function) — `src/lib/audit-destinations/parquet/index.js:125`
- **`_resetState`** (Function) — `src/lib/audit-destinations/qvd/index.js:123`
- **`_resetState`** (Function) — `src/lib/audit-destinations/shared/base.js:207`
- **`bufferEvent`** (Function) — `src/lib/audit-destinations/shared/base.js:174`
- **`ensureFlushTimer`** (Function) — `src/lib/audit-destinations/shared/base.js:69`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `_resetState` | Function | `src/lib/audit-destinations/parquet/index.js` | 125 |
| `_resetState` | Function | `src/lib/audit-destinations/qvd/index.js` | 123 |
| `_resetState` | Function | `src/lib/audit-destinations/shared/base.js` | 207 |
| `bufferEvent` | Function | `src/lib/audit-destinations/shared/base.js` | 174 |
| `ensureFlushTimer` | Function | `src/lib/audit-destinations/shared/base.js` | 69 |
| `requestFlush` | Function | `src/lib/audit-destinations/shared/base.js` | 90 |
| `stopFlushTimer` | Function | `src/lib/audit-destinations/shared/base.js` | 56 |
| `getAuditDestinationEnabled` | Function | `src/lib/audit-destinations/shared/helpers.js` | 55 |
| `writeAuditEventToDestinations` | Function | `src/lib/audit-destinations/index.js` | 16 |
| `writeAuditEventToInfluxdb` | Function | `src/lib/audit-destinations/influxdb/index.js` | 13 |
| `bufferAuditParquetEvent` | Function | `src/lib/audit-destinations/parquet/index.js` | 97 |
| `writeAuditEventToParquet` | Function | `src/lib/audit-destinations/parquet/index.js` | 108 |
| `bufferAuditQvdEvent` | Function | `src/lib/audit-destinations/qvd/index.js` | 95 |
| `writeAuditEventToQvd` | Function | `src/lib/audit-destinations/qvd/index.js` | 106 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `WriteAuditEventToDestinations → GetErrorMessage` | cross_community | 8 |
| `WriteAuditEventToDestinations → GetErrorMessage` | cross_community | 8 |
| `WriteAuditEventToDestinations → Noop` | cross_community | 8 |
| `WriteAuditEventToDestinations → ReadNonEmptyString` | cross_community | 7 |
| `WriteAuditEventToDestinations → StopFlushTimer` | cross_community | 6 |
| `WriteAuditEventToDestinations → GetAuditDestinationEnabled` | cross_community | 6 |
| `WriteAuditEventToDestinations → AsObject` | cross_community | 6 |
| `WriteAuditEventToDestinations → ReadString` | cross_community | 6 |
| `WriteAuditEventToDestinations → GetAuditDestinationEnabled` | cross_community | 4 |
| `WriteAuditEventToDestinations → GetAuditInfluxConfig` | cross_community | 4 |

## How to Explore

1. `context({name: "_resetState"})` — see callers and callees
2. `query({search_query: "parquet"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
