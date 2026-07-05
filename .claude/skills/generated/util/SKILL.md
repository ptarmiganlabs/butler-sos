---
name: util
description: "Skill for the Util area of butler-sos. 7 symbols across 3 files."
---

# Util

7 symbols | 3 files | Cohesion: 67%

## When to Use

- Working with code in `src/`
- Understanding how extractAuditEventFields, readString, readBoolean work
- Modifying util-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/lib/audit-destinations/shared/helpers.js` | readString, readBoolean, asObject |
| `src/lib/audit-destinations/shared/extract-fields.js` | readIntegerBigInt, extractAuditEventFields |
| `src/lib/util/user-identity.js` | readNonEmptyString, parseQlikUserIdentity |

## Entry Points

Start here when exploring this area:

- **`extractAuditEventFields`** (Function) — `src/lib/audit-destinations/shared/extract-fields.js:46`
- **`readString`** (Function) — `src/lib/audit-destinations/shared/helpers.js:16`
- **`readBoolean`** (Function) — `src/lib/audit-destinations/shared/helpers.js:36`
- **`asObject`** (Function) — `src/lib/audit-destinations/shared/helpers.js:46`
- **`parseQlikUserIdentity`** (Function) — `src/lib/util/user-identity.js:31`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `extractAuditEventFields` | Function | `src/lib/audit-destinations/shared/extract-fields.js` | 46 |
| `readString` | Function | `src/lib/audit-destinations/shared/helpers.js` | 16 |
| `readBoolean` | Function | `src/lib/audit-destinations/shared/helpers.js` | 36 |
| `asObject` | Function | `src/lib/audit-destinations/shared/helpers.js` | 46 |
| `parseQlikUserIdentity` | Function | `src/lib/util/user-identity.js` | 31 |
| `readIntegerBigInt` | Function | `src/lib/audit-destinations/shared/extract-fields.js` | 22 |
| `readNonEmptyString` | Function | `src/lib/util/user-identity.js` | 10 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `WriteAuditEventToDestinations → AsObject` | cross_community | 6 |
| `WriteAuditEventToDestinations → ReadString` | cross_community | 6 |
| `WriteAuditEventToParquet → ReadNonEmptyString` | cross_community | 6 |
| `WriteAuditEventToQvd → ReadNonEmptyString` | cross_community | 6 |
| `WriteAuditEventToParquet → ReadIntegerBigInt` | cross_community | 5 |
| `WriteAuditEventToQvd → AsObject` | cross_community | 5 |
| `WriteAuditEventToQvd → ReadString` | cross_community | 5 |
| `WriteAuditEventToQvd → ReadIntegerBigInt` | cross_community | 5 |
| `WriteAuditEventInfluxV2 → ReadNonEmptyString` | cross_community | 4 |
| `WriteAuditEventInfluxV1 → ReadNonEmptyString` | cross_community | 4 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Influxdb | 1 calls |
| Globals | 1 calls |

## How to Explore

1. `gitnexus_context({name: "extractAuditEventFields"})` — see callers and callees
2. `gitnexus_query({query: "util"})` — find related execution flows
3. Read key files listed above for implementation details
