---
name: gitnexus-area-cluster-20
description: "Skill for the Cluster_20 area of butler-sos. 7 symbols across 1 files."
---

# Cluster_20

7 symbols | 1 files | Cohesion: 57%

## When to Use

- Working with code in `src/`
- Understanding how setupAuditEventsApiServer work
- Modifying cluster_20-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/lib/audit-events-api.js` | buildAuditResponse, getBearerToken, loadAuditEventsTlsOptions, auditEventAuthPreHandler, safeStringEqual (+2) |

## Entry Points

Start here when exploring this area:

- **`setupAuditEventsApiServer`** (Function) — `src/lib/audit-events-api.js:1608`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `setupAuditEventsApiServer` | Function | `src/lib/audit-events-api.js` | 1608 |
| `buildAuditResponse` | Function | `src/lib/audit-events-api.js` | 112 |
| `getBearerToken` | Function | `src/lib/audit-events-api.js` | 265 |
| `loadAuditEventsTlsOptions` | Function | `src/lib/audit-events-api.js` | 281 |
| `auditEventAuthPreHandler` | Function | `src/lib/audit-events-api.js` | 1149 |
| `safeStringEqual` | Function | `src/lib/audit-events-api.js` | 56 |
| `warnIfRateLimitsLookInconsistent` | Function | `src/lib/audit-events-api.js` | 1569 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `SetupAuditEventsApiServer → BuildCorsOptions` | cross_community | 3 |
| `SetupAuditEventsApiServer → CreatePayloadValidators` | cross_community | 3 |
| `SetupAuditEventsApiServer → CreateTypeHandlers` | cross_community | 3 |
| `SetupAuditEventsApiServer → GetAuditEventSchema` | cross_community | 3 |

## How to Explore

1. `context({name: "setupAuditEventsApiServer"})` — see callers and callees
2. `query({search_query: "cluster_20"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
