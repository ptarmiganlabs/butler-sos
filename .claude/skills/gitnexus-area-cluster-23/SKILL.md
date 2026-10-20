---
name: gitnexus-area-cluster-23
description: "Skill for the Cluster_23 area of butler-sos. 8 symbols across 1 files."
---

# Cluster_23

8 symbols | 1 files | Cohesion: 83%

## When to Use

- Working with code in `src/`
- Understanding how addTextHeaderToPng work
- Modifying cluster_23-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/lib/audit-screenshot-metadata-image.js` | addTextHeaderToPng, capValue, drawChar, drawText, fillRect (+3) |

## Entry Points

Start here when exploring this area:

- **`addTextHeaderToPng`** (Function) — `src/lib/audit-screenshot-metadata-image.js:596`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `addTextHeaderToPng` | Function | `src/lib/audit-screenshot-metadata-image.js` | 596 |
| `capValue` | Function | `src/lib/audit-screenshot-metadata-image.js` | 150 |
| `drawChar` | Function | `src/lib/audit-screenshot-metadata-image.js` | 528 |
| `drawText` | Function | `src/lib/audit-screenshot-metadata-image.js` | 551 |
| `fillRect` | Function | `src/lib/audit-screenshot-metadata-image.js` | 503 |
| `measureTextWidthPx` | Function | `src/lib/audit-screenshot-metadata-image.js` | 565 |
| `normalizeToRenderableAscii` | Function | `src/lib/audit-screenshot-metadata-image.js` | 122 |
| `setPixel` | Function | `src/lib/audit-screenshot-metadata-image.js` | 481 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `AddTextHeaderToPng → PngNotDecodedError` | cross_community | 5 |
| `AddTextHeaderToPng → InterlacedDataSize` | cross_community | 4 |
| `AddTextHeaderToPng → ReadPngHeader` | cross_community | 3 |
| `AddTextHeaderToPng → NormalizeToRenderableAscii` | intra_community | 3 |

## How to Explore

1. `context({name: "addTextHeaderToPng"})` — see callers and callees
2. `query({search_query: "cluster_23"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
