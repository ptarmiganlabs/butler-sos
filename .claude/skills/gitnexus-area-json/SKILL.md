---
name: gitnexus-area-json
description: "Skill for the Json area of butler-sos. 10 symbols across 1 files."
---

# Json

10 symbols | 1 files | Cohesion: 78%

## When to Use

- Working with code in `src/`
- Understanding how writeAuditEventToJson work
- Modifying json-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/lib/audit-destinations/json/index.js` | asObject, formatTimestampForFilename, pad, getJsonObjectdataConfig, readBoolean (+5) |

## Entry Points

Start here when exploring this area:

- **`writeAuditEventToJson`** (Function) — `src/lib/audit-destinations/json/index.js:128`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `writeAuditEventToJson` | Function | `src/lib/audit-destinations/json/index.js` | 128 |
| `asObject` | Function | `src/lib/audit-destinations/json/index.js` | 41 |
| `formatTimestampForFilename` | Function | `src/lib/audit-destinations/json/index.js` | 64 |
| `pad` | Function | `src/lib/audit-destinations/json/index.js` | 75 |
| `getJsonObjectdataConfig` | Function | `src/lib/audit-destinations/json/index.js` | 93 |
| `readBoolean` | Function | `src/lib/audit-destinations/json/index.js` | 31 |
| `readNumber` | Function | `src/lib/audit-destinations/json/index.js` | 21 |
| `readString` | Function | `src/lib/audit-destinations/json/index.js` | 11 |
| `sanitizeFilenameComponent` | Function | `src/lib/audit-destinations/json/index.js` | 52 |
| `verboseLog` | Function | `src/lib/audit-destinations/json/index.js` | 109 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `WriteAuditEventToJson → Pad` | intra_community | 3 |
| `WriteAuditEventToJson → ReadNonEmptyString` | cross_community | 3 |

## How to Explore

1. `context({name: "writeAuditEventToJson"})` — see callers and callees
2. `query({search_query: "json"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
