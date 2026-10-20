---
name: gitnexus-area-cluster-1
description: "Skill for the Cluster_1 area of butler-sos. 6 symbols across 1 files."
---

# Cluster_1

6 symbols | 1 files | Cohesion: 80%

## When to Use

- Working with code in `src/`
- Understanding how assertDecodable, PngNotDecodedError work
- Modifying cluster_1-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/lib/audit-screenshot-metadata-image.js` | PngNotDecodedError, assertDecodable, assertInterlacedDataFits, assertValidPalette, interlacedDataSize (+1) |

## Entry Points

Start here when exploring this area:

- **`assertDecodable`** (Function) — `src/lib/audit-screenshot-metadata-image.js:432`
- **`PngNotDecodedError`** (Class) — `src/lib/audit-screenshot-metadata-image.js:193`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `PngNotDecodedError` | Class | `src/lib/audit-screenshot-metadata-image.js` | 193 |
| `assertDecodable` | Function | `src/lib/audit-screenshot-metadata-image.js` | 432 |
| `assertInterlacedDataFits` | Function | `src/lib/audit-screenshot-metadata-image.js` | 375 |
| `assertValidPalette` | Function | `src/lib/audit-screenshot-metadata-image.js` | 306 |
| `interlacedDataSize` | Function | `src/lib/audit-screenshot-metadata-image.js` | 267 |
| `measureImageData` | Function | `src/lib/audit-screenshot-metadata-image.js` | 331 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `AddTextHeaderToPng → PngNotDecodedError` | cross_community | 5 |
| `AddTextHeaderToPng → InterlacedDataSize` | cross_community | 4 |
| `AddTextHeaderToPng → ReadPngHeader` | cross_community | 3 |

## How to Explore

1. `context({name: "assertDecodable"})` — see callers and callees
2. `query({search_query: "cluster_1"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
