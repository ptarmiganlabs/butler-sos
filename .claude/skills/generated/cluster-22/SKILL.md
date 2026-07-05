---
name: cluster-22
description: "Skill for the Cluster_22 area of butler-sos. 7 symbols across 1 files."
---

# Cluster_22

7 symbols | 1 files | Cohesion: 94%

## When to Use

- Working with code in `src/`
- Understanding how addTextHeaderToPng work
- Modifying cluster_22-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/lib/audit-screenshot-metadata-image.js` | normalizeToRenderableAscii, setPixel, fillRect, drawChar, drawText (+2) |

## Entry Points

Start here when exploring this area:

- **`addTextHeaderToPng`** (Function) — `src/lib/audit-screenshot-metadata-image.js:275`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `addTextHeaderToPng` | Function | `src/lib/audit-screenshot-metadata-image.js` | 275 |
| `normalizeToRenderableAscii` | Function | `src/lib/audit-screenshot-metadata-image.js` | 119 |
| `setPixel` | Function | `src/lib/audit-screenshot-metadata-image.js` | 165 |
| `fillRect` | Function | `src/lib/audit-screenshot-metadata-image.js` | 187 |
| `drawChar` | Function | `src/lib/audit-screenshot-metadata-image.js` | 212 |
| `drawText` | Function | `src/lib/audit-screenshot-metadata-image.js` | 235 |
| `measureTextWidthPx` | Function | `src/lib/audit-screenshot-metadata-image.js` | 249 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `AddTextHeaderToPng → SetPixel` | intra_community | 4 |

## How to Explore

1. `gitnexus_context({name: "addTextHeaderToPng"})` — see callers and callees
2. `gitnexus_query({query: "cluster_22"})` — find related execution flows
3. Read key files listed above for implementation details
