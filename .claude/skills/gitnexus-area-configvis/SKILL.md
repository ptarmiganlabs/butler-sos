---
name: gitnexus-area-configvis
description: "Skill for the Configvis area of butler-sos. 98 symbols across 2 files."
---

# Configvis

98 symbols | 2 files | Cohesion: 92%

## When to Use

- Working with code in `static/`
- Understanding how M, a, c work
- Modifying configvis-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `static/configvis/jsontree.js` | M, a, c, closeAll, d (+79) |
| `static/configvis/prism.js` | DFS, clone, encode, i, s (+9) |

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `M` | Function | `static/configvis/jsontree.js` | 1691 |
| `a` | Function | `static/configvis/jsontree.js` | 814 |
| `c` | Function | `static/configvis/jsontree.js` | 916 |
| `closeAll` | Function | `static/configvis/jsontree.js` | 1740 |
| `d` | Function | `static/configvis/jsontree.js` | 922 |
| `destroy` | Function | `static/configvis/jsontree.js` | 1773 |
| `destroyAll` | Function | `static/configvis/jsontree.js` | 1781 |
| `f` | Function | `static/configvis/jsontree.js` | 928 |
| `g` | Function | `static/configvis/jsontree.js` | 935 |
| `i` | Function | `static/configvis/jsontree.js` | 787 |
| `l` | Function | `static/configvis/jsontree.js` | 767 |
| `openAll` | Function | `static/configvis/jsontree.js` | 1734 |
| `p` | Function | `static/configvis/jsontree.js` | 952 |
| `refresh` | Function | `static/configvis/jsontree.js` | 1706 |
| `refreshAll` | Function | `static/configvis/jsontree.js` | 1714 |
| `render` | Function | `static/configvis/jsontree.js` | 1724 |
| `s` | Function | `static/configvis/jsontree.js` | 895 |
| `setJson` | Function | `static/configvis/jsontree.js` | 1746 |
| `u` | Function | `static/configvis/jsontree.js` | 902 |
| `w` | Function | `static/configvis/jsontree.js` | 956 |

## How to Explore

1. `context({name: "M"})` — see callers and callees
2. `query({search_query: "configvis"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
