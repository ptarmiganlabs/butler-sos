---
name: cluster-25
description: "Skill for the Cluster_25 area of butler-sos. 8 symbols across 1 files."
---

# Cluster_25

8 symbols | 1 files | Cohesion: 74%

## When to Use

- Working with code in `src/`
- Understanding how buildScreenshotSessionCacheKey, getCachedScreenshotSession, setCachedScreenshotSession work
- Modifying cluster_25-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/lib/audit-screenshot-session-cache.js` | buildScreenshotSessionCacheKey, getCachedScreenshotSession, setCachedScreenshotSession, deleteCachedScreenshotSession, getOrCreateSessionCache (+3) |

## Entry Points

Start here when exploring this area:

- **`buildScreenshotSessionCacheKey`** (Function) — `src/lib/audit-screenshot-session-cache.js:94`
- **`getCachedScreenshotSession`** (Function) — `src/lib/audit-screenshot-session-cache.js:113`
- **`setCachedScreenshotSession`** (Function) — `src/lib/audit-screenshot-session-cache.js:144`
- **`deleteCachedScreenshotSession`** (Function) — `src/lib/audit-screenshot-session-cache.js:180`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `buildScreenshotSessionCacheKey` | Function | `src/lib/audit-screenshot-session-cache.js` | 94 |
| `getCachedScreenshotSession` | Function | `src/lib/audit-screenshot-session-cache.js` | 113 |
| `setCachedScreenshotSession` | Function | `src/lib/audit-screenshot-session-cache.js` | 144 |
| `deleteCachedScreenshotSession` | Function | `src/lib/audit-screenshot-session-cache.js` | 180 |
| `getOrCreateSessionCache` | Function | `src/lib/audit-screenshot-session-cache.js` | 234 |
| `sanitizeQpsForCache` | Function | `src/lib/audit-screenshot-session-cache.js` | 292 |
| `normalizeKeyPart` | Function | `src/lib/audit-screenshot-session-cache.js` | 308 |
| `normalizeVirtualProxyForKey` | Function | `src/lib/audit-screenshot-session-cache.js` | 319 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Cluster_24 | 2 calls |
| Globals | 1 calls |
| V1 | 1 calls |

## How to Explore

1. `gitnexus_context({name: "buildScreenshotSessionCacheKey"})` — see callers and callees
2. `gitnexus_query({query: "cluster_25"})` — find related execution flows
3. Read key files listed above for implementation details
