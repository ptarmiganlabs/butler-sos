---
name: cluster-37
description: "Skill for the Cluster_37 area of butler-sos. 10 symbols across 6 files."
---

# Cluster_37

10 symbols | 6 files | Cohesion: 50%

## When to Use

- Working with code in `src/`
- Understanding how setupConfigVisServer, prepareFile, compileTemplate work
- Modifying cluster_37-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/lib/file-prep.js` | isBinaryFile, prepareFile, compileTemplate, getFileContent |
| `src/lib/config-visualise.js` | serve404Page, setupConfigVisServer |
| `src/lib/config-obfuscate.js` | configObfuscate |
| `src/lib/log-error.js` | logError |
| `src/lib/log-event-categorise.js` | categoriseLogEvent |
| `src/lib/post-to-new-relic.js` | postUserEventToNewRelic |

## Entry Points

Start here when exploring this area:

- **`setupConfigVisServer`** (Function) — `src/lib/config-visualise.js:69`
- **`prepareFile`** (Function) — `src/lib/file-prep.js:42`
- **`compileTemplate`** (Function) — `src/lib/file-prep.js:114`
- **`getFileContent`** (Function) — `src/lib/file-prep.js:131`
- **`logError`** (Function) — `src/lib/log-error.js:89`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `setupConfigVisServer` | Function | `src/lib/config-visualise.js` | 69 |
| `prepareFile` | Function | `src/lib/file-prep.js` | 42 |
| `compileTemplate` | Function | `src/lib/file-prep.js` | 114 |
| `getFileContent` | Function | `src/lib/file-prep.js` | 131 |
| `logError` | Function | `src/lib/log-error.js` | 89 |
| `categoriseLogEvent` | Function | `src/lib/log-event-categorise.js` | 27 |
| `postUserEventToNewRelic` | Function | `src/lib/post-to-new-relic.js` | 730 |
| `configObfuscate` | Function | `src/lib/config-obfuscate.js` | 24 |
| `serve404Page` | Function | `src/lib/config-visualise.js` | 19 |
| `isBinaryFile` | Function | `src/lib/file-prep.js` | 29 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `SetupConfigVisServer → IsSea` | cross_community | 6 |
| `SetupHealthMetricsTimer → IsSea` | cross_community | 6 |
| `SetupUserSessionsTimer → IsSea` | cross_community | 6 |
| `ServiceUptimeStart → IsSea` | cross_community | 5 |
| `SetupConfigVisServer → IsBinaryFile` | intra_community | 4 |
| `SetupConfigVisServer → GetAsset` | cross_community | 4 |
| `UdpInitLogEventServer → IsSea` | cross_community | 4 |
| `UdpInitUserActivityServer → IsSea` | cross_community | 4 |
| `PostUserEventToNewRelic → GetErrorStats` | cross_community | 4 |
| `PostUserEventToNewRelic → IsSea` | cross_community | 4 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Globals | 5 calls |
| V2 | 3 calls |
| Log | 1 calls |
| Influxdb | 1 calls |

## How to Explore

1. `gitnexus_context({name: "setupConfigVisServer"})` — see callers and callees
2. `gitnexus_query({query: "cluster_37"})` — find related execution flows
3. Read key files listed above for implementation details
