---
name: gitnexus-area-cluster-38
description: "Skill for the Cluster_38 area of butler-sos. 7 symbols across 3 files."
---

# Cluster_38

7 symbols | 3 files | Cohesion: 46%

## When to Use

- Working with code in `src/`
- Understanding how setupConfigVisServer, compileTemplate, getFileContent work
- Modifying cluster_38-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/lib/file-prep.js` | compileTemplate, getFileContent, isBinaryFile, prepareFile |
| `src/lib/config-visualise.js` | serve404Page, setupConfigVisServer |
| `src/lib/log-error.js` | logError |

## Entry Points

Start here when exploring this area:

- **`setupConfigVisServer`** (Function) — `src/lib/config-visualise.js:69`
- **`compileTemplate`** (Function) — `src/lib/file-prep.js:114`
- **`getFileContent`** (Function) — `src/lib/file-prep.js:131`
- **`prepareFile`** (Function) — `src/lib/file-prep.js:42`
- **`logError`** (Function) — `src/lib/log-error.js:91`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `setupConfigVisServer` | Function | `src/lib/config-visualise.js` | 69 |
| `compileTemplate` | Function | `src/lib/file-prep.js` | 114 |
| `getFileContent` | Function | `src/lib/file-prep.js` | 131 |
| `prepareFile` | Function | `src/lib/file-prep.js` | 42 |
| `logError` | Function | `src/lib/log-error.js` | 91 |
| `serve404Page` | Function | `src/lib/config-visualise.js` | 19 |
| `isBinaryFile` | Function | `src/lib/file-prep.js` | 29 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `UdpInitUserActivityServer → IsRunningInDocker` | cross_community | 8 |
| `SetupConfigVisServer → IsRunningInDocker` | cross_community | 7 |
| `SetupHealthMetricsTimer → IsRunningInDocker` | cross_community | 7 |
| `SetupUserSessionsTimer → IsRunningInDocker` | cross_community | 7 |
| `UdpInitLogEventServer → IsRunningInDocker` | cross_community | 5 |
| `SetupConfigVisServer → IsBinaryFile` | intra_community | 4 |

## How to Explore

1. `context({name: "setupConfigVisServer"})` — see callers and callees
2. `query({search_query: "cluster_38"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
