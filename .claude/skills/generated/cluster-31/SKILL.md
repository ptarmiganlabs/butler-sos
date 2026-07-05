---
name: cluster-31
description: "Skill for the Cluster_31 area of butler-sos. 6 symbols across 1 files."
---

# Cluster_31

6 symbols | 1 files | Cohesion: 77%

## When to Use

- Working with code in `src/`
- Understanding how buildScreenshotFilename work
- Modifying cluster_31-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/lib/audit-screenshots.js` | sanitizeFilenameComponent, formatTimestampForFilename, pad, extensionFromContentType, extensionFromUrl (+1) |

## Entry Points

Start here when exploring this area:

- **`buildScreenshotFilename`** (Function) — `src/lib/audit-screenshots.js:909`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `buildScreenshotFilename` | Function | `src/lib/audit-screenshots.js` | 909 |
| `sanitizeFilenameComponent` | Function | `src/lib/audit-screenshots.js` | 689 |
| `formatTimestampForFilename` | Function | `src/lib/audit-screenshots.js` | 703 |
| `pad` | Function | `src/lib/audit-screenshots.js` | 714 |
| `extensionFromContentType` | Function | `src/lib/audit-screenshots.js` | 735 |
| `extensionFromUrl` | Function | `src/lib/audit-screenshots.js` | 870 |

## How to Explore

1. `gitnexus_context({name: "buildScreenshotFilename"})` — see callers and callees
2. `gitnexus_query({query: "cluster_31"})` — find related execution flows
3. Read key files listed above for implementation details
