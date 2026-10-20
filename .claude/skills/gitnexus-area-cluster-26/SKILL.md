---
name: gitnexus-area-cluster-26
description: "Skill for the Cluster_26 area of butler-sos. 6 symbols across 1 files."
---

# Cluster_26

6 symbols | 1 files | Cohesion: 63%

## When to Use

- Working with code in `src/`
- Understanding how clearScreenshotSessionCache, getCachedScreenshotSession, setCachedScreenshotSession work
- Modifying cluster_26-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/lib/audit-screenshot-session-cache.js` | clearScreenshotSessionCache, getCachedScreenshotSession, getOrCreateSessionCache, sanitizeQpsForCache, setCachedScreenshotSession (+1) |

## Entry Points

Start here when exploring this area:

- **`clearScreenshotSessionCache`** (Function) — `src/lib/audit-screenshot-session-cache.js:205`
- **`getCachedScreenshotSession`** (Function) — `src/lib/audit-screenshot-session-cache.js:117`
- **`setCachedScreenshotSession`** (Function) — `src/lib/audit-screenshot-session-cache.js:148`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `clearScreenshotSessionCache` | Function | `src/lib/audit-screenshot-session-cache.js` | 205 |
| `getCachedScreenshotSession` | Function | `src/lib/audit-screenshot-session-cache.js` | 117 |
| `setCachedScreenshotSession` | Function | `src/lib/audit-screenshot-session-cache.js` | 148 |
| `getOrCreateSessionCache` | Function | `src/lib/audit-screenshot-session-cache.js` | 238 |
| `sanitizeQpsForCache` | Function | `src/lib/audit-screenshot-session-cache.js` | 296 |
| `toTtlMs` | Function | `src/lib/audit-screenshot-session-cache.js` | 342 |

## How to Explore

1. `context({name: "clearScreenshotSessionCache"})` — see callers and callees
2. `query({search_query: "cluster_26"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
