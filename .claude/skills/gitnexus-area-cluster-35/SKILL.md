---
name: gitnexus-area-cluster-35
description: "Skill for the Cluster_35 area of butler-sos. 6 symbols across 2 files."
---

# Cluster_35

6 symbols | 2 files | Cohesion: 67%

## When to Use

- Working with code in `src/`
- Understanding how verifyAppConfig, isValidHostname, resolvesToIpAddress work
- Modifying cluster_35-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/lib/host-utils.js` | isValidHostname, resolvesToIpAddress, cleanup, verifyHost, cleanup |
| `src/lib/config-file-verify.js` | verifyAppConfig |

## Entry Points

Start here when exploring this area:

- **`verifyAppConfig`** (Function) — `src/lib/config-file-verify.js:179`
- **`isValidHostname`** (Function) — `src/lib/host-utils.js:14`
- **`resolvesToIpAddress`** (Function) — `src/lib/host-utils.js:28`
- **`cleanup`** (Function) — `src/lib/host-utils.js:90`
- **`verifyHost`** (Function) — `src/lib/host-utils.js:123`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `verifyAppConfig` | Function | `src/lib/config-file-verify.js` | 179 |
| `isValidHostname` | Function | `src/lib/host-utils.js` | 14 |
| `resolvesToIpAddress` | Function | `src/lib/host-utils.js` | 28 |
| `cleanup` | Function | `src/lib/host-utils.js` | 90 |
| `verifyHost` | Function | `src/lib/host-utils.js` | 123 |
| `cleanup` | Function | `src/lib/host-utils.js` | 180 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `InitConfig → IsValidHostname` | cross_community | 4 |
| `VerifyAppConfig → Cleanup` | intra_community | 3 |

## How to Explore

1. `context({name: "verifyAppConfig"})` — see callers and callees
2. `query({search_query: "cluster_35"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
