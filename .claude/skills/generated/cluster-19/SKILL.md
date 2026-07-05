---
name: cluster-19
description: "Skill for the Cluster_19 area of butler-sos. 20 symbols across 2 files."
---

# Cluster_19

20 symbols | 2 files | Cohesion: 80%

## When to Use

- Working with code in `src/`
- Understanding how checkCompatibility work
- Modifying cluster_19-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/lib/audit-events-api.js` | normalizeHeaderToSingleValue, validateEnvelopeConstraints, debugLog, verboseLog, summarizeUrlForDebug (+14) |
| `src/lib/audit-qs-compatibility.js` | checkCompatibility |

## Entry Points

Start here when exploring this area:

- **`checkCompatibility`** (Function) — `src/lib/audit-qs-compatibility.js:35`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `checkCompatibility` | Function | `src/lib/audit-qs-compatibility.js` | 35 |
| `normalizeHeaderToSingleValue` | Function | `src/lib/audit-events-api.js` | 77 |
| `validateEnvelopeConstraints` | Function | `src/lib/audit-events-api.js` | 137 |
| `debugLog` | Function | `src/lib/audit-events-api.js` | 322 |
| `verboseLog` | Function | `src/lib/audit-events-api.js` | 334 |
| `summarizeUrlForDebug` | Function | `src/lib/audit-events-api.js` | 349 |
| `summarizeKeysForDebug` | Function | `src/lib/audit-events-api.js` | 369 |
| `summarizeScreenshotConfigForDebug` | Function | `src/lib/audit-events-api.js` | 381 |
| `safeJsonForLog` | Function | `src/lib/audit-events-api.js` | 420 |
| `pickSelectionDetailsForLog` | Function | `src/lib/audit-events-api.js` | 437 |
| `handleSelectionStateChanged` | Function | `src/lib/audit-events-api.js` | 458 |
| `handleAppModelValidated` | Function | `src/lib/audit-events-api.js` | 484 |
| `handleScreenshotUrlReceived` | Function | `src/lib/audit-events-api.js` | 505 |
| `handleObjectViewDuration` | Function | `src/lib/audit-events-api.js` | 704 |
| `cleanupMissingAuditQsVersionWarnState` | Function | `src/lib/audit-events-api.js` | 1099 |
| `validatePayload` | Function | `src/lib/audit-events-api.js` | 1121 |
| `processAuditEventEnvelope` | Function | `src/lib/audit-events-api.js` | 1161 |
| `logMissingAuditQsVersion` | Function | `src/lib/audit-events-api.js` | 1230 |
| `handleAuditEventPost` | Function | `src/lib/audit-events-api.js` | 1275 |
| `handleTestConnectionGet` | Function | `src/lib/audit-events-api.js` | 1431 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `ProcessAuditEventEnvelope → Has` | cross_community | 6 |
| `ProcessAuditEventEnvelope → Get` | cross_community | 6 |
| `ProcessAuditEventEnvelope → StopFlushTimer` | cross_community | 5 |
| `ProcessAuditEventEnvelope → GetConfigKey` | cross_community | 5 |
| `HandleAuditEventPost → Has` | cross_community | 3 |
| `HandleScreenshotUrlReceived → Get` | cross_community | 3 |
| `HandleScreenshotUrlReceived → Has` | cross_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Influxdb | 4 calls |
| Globals | 3 calls |
| Cluster_51 | 2 calls |
| Cluster_29 | 1 calls |
| Cluster_20 | 1 calls |
| V2 | 1 calls |

## How to Explore

1. `gitnexus_context({name: "checkCompatibility"})` — see callers and callees
2. `gitnexus_query({query: "cluster_19"})` — find related execution flows
3. Read key files listed above for implementation details
