---
name: gitnexus-area-cluster-29
description: "Skill for the Cluster_29 area of butler-sos. 6 symbols across 1 files."
---

# Cluster_29

6 symbols | 1 files | Cohesion: 77%

## When to Use

- Working with code in `src/`
- Understanding how buildScreenshotFilename work
- Modifying cluster_29-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/lib/audit-screenshots.js` | buildScreenshotFilename, extensionFromContentType, extensionFromUrl, formatTimestampForFilename, pad (+1) |

## Entry Points

Start here when exploring this area:

- **`buildScreenshotFilename`** (Function) — `src/lib/audit-screenshots.js:970`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `buildScreenshotFilename` | Function | `src/lib/audit-screenshots.js` | 970 |
| `extensionFromContentType` | Function | `src/lib/audit-screenshots.js` | 796 |
| `extensionFromUrl` | Function | `src/lib/audit-screenshots.js` | 931 |
| `formatTimestampForFilename` | Function | `src/lib/audit-screenshots.js` | 764 |
| `pad` | Function | `src/lib/audit-screenshots.js` | 775 |
| `sanitizeFilenameComponent` | Function | `src/lib/audit-screenshots.js` | 750 |

## How to Explore

1. `context({name: "buildScreenshotFilename"})` — see callers and callees
2. `query({search_query: "cluster_29"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
