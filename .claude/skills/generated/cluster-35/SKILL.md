---
name: cluster-35
description: "Skill for the Cluster_35 area of butler-sos. 8 symbols across 4 files."
---

# Cluster_35

8 symbols | 4 files | Cohesion: 49%

## When to Use

- Working with code in `src/`
- Understanding how setupConfigVisServer, prepareFile, compileTemplate work
- Modifying cluster_35-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/lib/file-prep.js` | isBinaryFile, prepareFile, compileTemplate, getFileContent |
| `src/lib/config-visualise.js` | serve404Page, setupConfigVisServer |
| `src/lib/config-obfuscate.js` | configObfuscate |
| `src/lib/log-error.js` | logError |

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
| `PostProxySessionsToNewRelic → IsSea` | cross_community | 4 |
| `PostUserEventToNewRelic → IsSea` | cross_community | 4 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Globals | 3 calls |
| V2 | 2 calls |
| Log | 1 calls |

## How to Explore

1. `gitnexus_context({name: "setupConfigVisServer"})` — see callers and callees
2. `gitnexus_query({query: "cluster_35"})` — find related execution flows
3. Read key files listed above for implementation details
