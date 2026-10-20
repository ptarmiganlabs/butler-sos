---
name: gitnexus-area-util
description: "Skill for the Util area of butler-sos. 22 symbols across 7 files."
---

# Util

22 symbols | 7 files | Cohesion: 74%

## When to Use

- Working with code in `src/`
- Understanding how extractAuditEventFields, asObject, readBoolean work
- Modifying util-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/lib/util/config-utils.js` | applySchemaDefaults, declaredScalarType, resolveOwner, resolveSchemaNode, findNullableArrayPositions (+3) |
| `src/lib/audit-screenshots.js` | createQlikMutualTlsAgent, debugLog, deleteQpsSession, generateXrfkey, requestQpsTicket |
| `src/lib/audit-destinations/shared/helpers.js` | asObject, readBoolean, readString |
| `src/lib/audit-destinations/shared/extract-fields.js` | extractAuditEventFields, readIntegerBigInt |
| `src/lib/util/user-identity.js` | parseQlikUserIdentity, readNonEmptyString |
| `src/lib/cert-utils.js` | createCertificateOptions |
| `src/lib/util/qlik-session-utils.js` | extractVirtualProxyFromSessionCookieName |

## Entry Points

Start here when exploring this area:

- **`extractAuditEventFields`** (Function) — `src/lib/audit-destinations/shared/extract-fields.js:46`
- **`asObject`** (Function) — `src/lib/audit-destinations/shared/helpers.js:46`
- **`readBoolean`** (Function) — `src/lib/audit-destinations/shared/helpers.js:36`
- **`readString`** (Function) — `src/lib/audit-destinations/shared/helpers.js:16`
- **`parseQlikUserIdentity`** (Function) — `src/lib/util/user-identity.js:31`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `extractAuditEventFields` | Function | `src/lib/audit-destinations/shared/extract-fields.js` | 46 |
| `asObject` | Function | `src/lib/audit-destinations/shared/helpers.js` | 46 |
| `readBoolean` | Function | `src/lib/audit-destinations/shared/helpers.js` | 36 |
| `readString` | Function | `src/lib/audit-destinations/shared/helpers.js` | 16 |
| `parseQlikUserIdentity` | Function | `src/lib/util/user-identity.js` | 31 |
| `createCertificateOptions` | Function | `src/lib/cert-utils.js` | 67 |
| `extractVirtualProxyFromSessionCookieName` | Function | `src/lib/util/qlik-session-utils.js` | 12 |
| `applySchemaDefaults` | Function | `src/lib/util/config-utils.js` | 346 |
| `findNullableArrayPositions` | Function | `src/lib/util/config-utils.js` | 118 |
| `normalizeNullableArrays` | Function | `src/lib/util/config-utils.js` | 146 |
| `readIntegerBigInt` | Function | `src/lib/audit-destinations/shared/extract-fields.js` | 22 |
| `readNonEmptyString` | Function | `src/lib/util/user-identity.js` | 10 |
| `createQlikMutualTlsAgent` | Function | `src/lib/audit-screenshots.js` | 128 |
| `debugLog` | Function | `src/lib/audit-screenshots.js` | 511 |
| `deleteQpsSession` | Function | `src/lib/audit-screenshots.js` | 216 |
| `generateXrfkey` | Function | `src/lib/audit-screenshots.js` | 117 |
| `requestQpsTicket` | Function | `src/lib/audit-screenshots.js` | 151 |
| `declaredScalarType` | Function | `src/lib/util/config-utils.js` | 313 |
| `resolveOwner` | Function | `src/lib/util/config-utils.js` | 258 |
| `resolveSchemaNode` | Function | `src/lib/util/config-utils.js` | 219 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `WriteAuditEventToDestinations → ReadNonEmptyString` | cross_community | 7 |
| `WriteAuditEventToDestinations → AsObject` | cross_community | 6 |
| `WriteAuditEventToDestinations → ReadString` | cross_community | 6 |
| `Init → IsNullableArraySchema` | cross_community | 5 |
| `WriteAuditEventToInfluxdbFactory → ReadNonEmptyString` | cross_community | 5 |
| `WriteAuditEventInfluxV2 → ReadNonEmptyString` | cross_community | 4 |
| `InitConfig → DeclaredScalarType` | cross_community | 3 |
| `InitConfig → ResolveOwner` | cross_community | 3 |
| `InitConfig → ResolveSchemaNode` | cross_community | 3 |
| `SetupHealthMetricsTimer → CreateCertificateOptions` | cross_community | 3 |

## How to Explore

1. `context({name: "extractAuditEventFields"})` — see callers and callees
2. `query({search_query: "util"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
