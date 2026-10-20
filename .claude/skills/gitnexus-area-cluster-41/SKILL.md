---
name: gitnexus-area-cluster-41
description: "Skill for the Cluster_41 area of butler-sos. 8 symbols across 1 files."
---

# Cluster_41

8 symbols | 1 files | Cohesion: 86%

## When to Use

- Working with code in `src/`
- Understanding how _isInfluxDbErrorTrackingEnabled, _logRunningSummary, _rollOverDay work
- Modifying cluster_41-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/lib/error-tracker.js` | isLogSummaryEnabled, _isInfluxDbErrorTrackingEnabled, _logRunningSummary, _rollOverDay, getErrorStats (+3) |

## Entry Points

Start here when exploring this area:

- **`_isInfluxDbErrorTrackingEnabled`** (Method) — `src/lib/error-tracker.js:233`
- **`_logRunningSummary`** (Method) — `src/lib/error-tracker.js:197`
- **`_rollOverDay`** (Method) — `src/lib/error-tracker.js:404`
- **`getErrorStats`** (Method) — `src/lib/error-tracker.js:425`
- **`incrementError`** (Method) — `src/lib/error-tracker.js:86`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `_isInfluxDbErrorTrackingEnabled` | Method | `src/lib/error-tracker.js` | 233 |
| `_logRunningSummary` | Method | `src/lib/error-tracker.js` | 197 |
| `_rollOverDay` | Method | `src/lib/error-tracker.js` | 404 |
| `getErrorStats` | Method | `src/lib/error-tracker.js` | 425 |
| `incrementError` | Method | `src/lib/error-tracker.js` | 86 |
| `logErrorSummary` | Method | `src/lib/error-tracker.js` | 457 |
| `resetCounters` | Method | `src/lib/error-tracker.js` | 387 |
| `isLogSummaryEnabled` | Function | `src/lib/error-tracker.js` | 20 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `IncrementError → GetErrorStats` | intra_community | 4 |
| `IncrementError → GetErrorCategory` | cross_community | 4 |
| `IncrementError → IsLogSummaryEnabled` | intra_community | 3 |
| `IncrementError → ResetCounters` | intra_community | 3 |
| `IncrementError → ErrorEventContext` | cross_community | 3 |
| `IncrementError → GetInfluxDbVersion` | cross_community | 3 |
| `IncrementError → R` | cross_community | 3 |

## How to Explore

1. `context({name: "_isInfluxDbErrorTrackingEnabled"})` — see callers and callees
2. `query({search_query: "cluster_41"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
