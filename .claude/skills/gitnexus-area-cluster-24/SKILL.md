---
name: gitnexus-area-cluster-24
description: "Skill for the Cluster_24 area of butler-sos. 7 symbols across 2 files."
---

# Cluster_24

7 symbols | 2 files | Cohesion: 75%

## When to Use

- Working with code in `src/`
- Understanding how readPngHeader work
- Modifying cluster_24-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/lib/audit-screenshots.js` | cropPngBuffer, encodedCurrent, setSrc, isDebugEnabled, normalizeCrop (+1) |
| `src/lib/audit-screenshot-metadata-image.js` | readPngHeader |

## Entry Points

Start here when exploring this area:

- **`readPngHeader`** (Function) — `src/lib/audit-screenshot-metadata-image.js:218`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `readPngHeader` | Function | `src/lib/audit-screenshot-metadata-image.js` | 218 |
| `cropPngBuffer` | Function | `src/lib/audit-screenshots.js` | 1001 |
| `encodedCurrent` | Function | `src/lib/audit-screenshots.js` | 1108 |
| `setSrc` | Function | `src/lib/audit-screenshots.js` | 1094 |
| `isDebugEnabled` | Function | `src/lib/audit-screenshots.js` | 531 |
| `normalizeCrop` | Function | `src/lib/audit-screenshots.js` | 551 |
| `toPixels` | Function | `src/lib/audit-screenshots.js` | 558 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `AddTextHeaderToPng → ReadPngHeader` | cross_community | 3 |

## How to Explore

1. `context({name: "readPngHeader"})` — see callers and callees
2. `query({search_query: "cluster_24"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
