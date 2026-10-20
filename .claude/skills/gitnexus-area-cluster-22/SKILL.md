---
name: gitnexus-area-cluster-22
description: "Skill for the Cluster_22 area of butler-sos. 20 symbols across 2 files."
---

# Cluster_22

20 symbols | 2 files | Cohesion: 80%

## When to Use

- Working with code in `src/`
- Understanding how checkCompatibility work
- Modifying cluster_22-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/lib/audit-events-api.js` | handleAppModelValidated, handleObjectViewDuration, handleScreenshotUrlReceived, handleSelectionStateChanged, pickSelectionDetailsForLog (+14) |
| `src/lib/audit-qs-compatibility.js` | checkCompatibility |

## Entry Points

Start here when exploring this area:

- **`checkCompatibility`** (Function) — `src/lib/audit-qs-compatibility.js:41`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `checkCompatibility` | Function | `src/lib/audit-qs-compatibility.js` | 41 |
| `handleAppModelValidated` | Function | `src/lib/audit-events-api.js` | 484 |
| `handleObjectViewDuration` | Function | `src/lib/audit-events-api.js` | 704 |
| `handleScreenshotUrlReceived` | Function | `src/lib/audit-events-api.js` | 505 |
| `handleSelectionStateChanged` | Function | `src/lib/audit-events-api.js` | 458 |
| `pickSelectionDetailsForLog` | Function | `src/lib/audit-events-api.js` | 437 |
| `safeJsonForLog` | Function | `src/lib/audit-events-api.js` | 420 |
| `debugLog` | Function | `src/lib/audit-events-api.js` | 322 |
| `normalizeHeaderToSingleValue` | Function | `src/lib/audit-events-api.js` | 77 |
| `cleanupMissingAuditQsVersionWarnState` | Function | `src/lib/audit-events-api.js` | 1180 |
| `handleAuditEventPost` | Function | `src/lib/audit-events-api.js` | 1356 |
| `handleTestConnectionGet` | Function | `src/lib/audit-events-api.js` | 1512 |
| `logMissingAuditQsVersion` | Function | `src/lib/audit-events-api.js` | 1311 |
| `processAuditEventEnvelope` | Function | `src/lib/audit-events-api.js` | 1242 |
| `validatePayload` | Function | `src/lib/audit-events-api.js` | 1202 |
| `summarizeKeysForDebug` | Function | `src/lib/audit-events-api.js` | 369 |
| `summarizeScreenshotConfigForDebug` | Function | `src/lib/audit-events-api.js` | 381 |
| `summarizeUrlForDebug` | Function | `src/lib/audit-events-api.js` | 349 |
| `validateEnvelopeConstraints` | Function | `src/lib/audit-events-api.js` | 137 |
| `verboseLog` | Function | `src/lib/audit-events-api.js` | 334 |

## How to Explore

1. `context({name: "checkCompatibility"})` — see callers and callees
2. `query({search_query: "cluster_22"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
