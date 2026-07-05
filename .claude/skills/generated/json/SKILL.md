---
name: json
description: "Skill for the Json area of butler-sos. 10 symbols across 1 files."
---

# Json

10 symbols | 1 files | Cohesion: 72%

## When to Use

- Working with code in `src/`
- Understanding how writeAuditEventToJson work
- Modifying json-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/lib/audit-destinations/json/index.js` | readString, readNumber, readBoolean, asObject, sanitizeFilenameComponent (+5) |

## Entry Points

Start here when exploring this area:

- **`writeAuditEventToJson`** (Function) — `src/lib/audit-destinations/json/index.js:128`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `writeAuditEventToJson` | Function | `src/lib/audit-destinations/json/index.js` | 128 |
| `readString` | Function | `src/lib/audit-destinations/json/index.js` | 11 |
| `readNumber` | Function | `src/lib/audit-destinations/json/index.js` | 21 |
| `readBoolean` | Function | `src/lib/audit-destinations/json/index.js` | 31 |
| `asObject` | Function | `src/lib/audit-destinations/json/index.js` | 41 |
| `sanitizeFilenameComponent` | Function | `src/lib/audit-destinations/json/index.js` | 52 |
| `formatTimestampForFilename` | Function | `src/lib/audit-destinations/json/index.js` | 64 |
| `pad` | Function | `src/lib/audit-destinations/json/index.js` | 75 |
| `getJsonObjectdataConfig` | Function | `src/lib/audit-destinations/json/index.js` | 93 |
| `verboseLog` | Function | `src/lib/audit-destinations/json/index.js` | 109 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `WriteAuditEventToJson → Has` | cross_community | 3 |
| `WriteAuditEventToJson → Get` | cross_community | 3 |
| `WriteAuditEventToJson → ReadNonEmptyString` | cross_community | 3 |
| `WriteAuditEventToJson → Pad` | intra_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Influxdb | 2 calls |
| Globals | 2 calls |
| Util | 1 calls |
| V2 | 1 calls |

## How to Explore

1. `gitnexus_context({name: "writeAuditEventToJson"})` — see callers and callees
2. `gitnexus_query({query: "json"})` — find related execution flows
3. Read key files listed above for implementation details
