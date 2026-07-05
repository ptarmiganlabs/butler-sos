---
name: configvis
description: "Skill for the Configvis area of butler-sos. 77 symbols across 5 files."
---

# Configvis

77 symbols | 5 files | Cohesion: 86%

## When to Use

- Working with code in `static/`
- Understanding how initHostInfo, cleanup work
- Modifying configvis-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `static/configvis/jsontree.js` | m, getFixedDecimalPlacesValue, getFunctionName, getObjectFromMap, getArrayFromSet (+45) |
| `static/configvis/prism.js` | encode, getLanguage, setLanguage, highlightAll, highlightAllUnder (+19) |
| `src/lib/globals/host-info.js` | initHostInfo |
| `src/lib/audit-screenshot-session-cache.js` | disposeCachedScreenshotSession |
| `src/lib/host-utils.js` | cleanup |

## Entry Points

Start here when exploring this area:

- **`initHostInfo`** (Function) — `src/lib/globals/host-info.js:10`
- **`cleanup`** (Function) — `src/lib/host-utils.js:90`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `initHostInfo` | Function | `src/lib/globals/host-info.js` | 10 |
| `cleanup` | Function | `src/lib/host-utils.js` | 90 |
| `m` | Function | `static/configvis/jsontree.js` | 87 |
| `getFixedDecimalPlacesValue` | Function | `static/configvis/jsontree.js` | 147 |
| `getFunctionName` | Function | `static/configvis/jsontree.js` | 152 |
| `getObjectFromMap` | Function | `static/configvis/jsontree.js` | 199 |
| `getArrayFromSet` | Function | `static/configvis/jsontree.js` | 204 |
| `b` | Function | `static/configvis/jsontree.js` | 973 |
| `y` | Function | `static/configvis/jsontree.js` | 1020 |
| `D` | Function | `static/configvis/jsontree.js` | 1048 |
| `T` | Function | `static/configvis/jsontree.js` | 1062 |
| `v` | Function | `static/configvis/jsontree.js` | 1082 |
| `E` | Function | `static/configvis/jsontree.js` | 1525 |
| `S` | Function | `static/configvis/jsontree.js` | 1542 |
| `A` | Function | `static/configvis/jsontree.js` | 1593 |
| `B` | Function | `static/configvis/jsontree.js` | 1600 |
| `I` | Function | `static/configvis/jsontree.js` | 1603 |
| `_` | Function | `static/configvis/jsontree.js` | 1616 |
| `O` | Function | `static/configvis/jsontree.js` | 1635 |
| `t` | Function | `static/configvis/jsontree.js` | 7 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `U → GetObjectFromString` | cross_community | 7 |
| `U → B` | cross_community | 6 |
| `U → I` | cross_community | 6 |
| `V → B` | cross_community | 6 |
| `V → I` | cross_community | 6 |
| `U → GetArrayFromSet` | cross_community | 5 |
| `U → E` | cross_community | 5 |
| `V → GetArrayFromSet` | cross_community | 5 |
| `V → E` | cross_community | 5 |
| `T → Type` | cross_community | 4 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Globals | 2 calls |

## How to Explore

1. `gitnexus_context({name: "initHostInfo"})` — see callers and callees
2. `gitnexus_query({query: "configvis"})` — find related execution flows
3. Read key files listed above for implementation details
