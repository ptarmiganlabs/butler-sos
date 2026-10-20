---
name: gitnexus-area-cluster-77
description: "Skill for the Cluster_77 area of butler-sos. 6 symbols across 1 files."
---

# Cluster_77

6 symbols | 1 files | Cohesion: 77%

## When to Use

- Working with code in `src/`
- Understanding how addToQueue, checkBackpressure, handleRateLimitDrop work
- Modifying cluster_77-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/lib/udp-queue-manager.js` | add, addToQueue, checkBackpressure, handleRateLimitDrop, handleSizeDrop (+1) |

## Entry Points

Start here when exploring this area:

- **`addToQueue`** (Method) — `src/lib/udp-queue-manager.js:324`
- **`checkBackpressure`** (Method) — `src/lib/udp-queue-manager.js:275`
- **`handleRateLimitDrop`** (Method) — `src/lib/udp-queue-manager.js:389`
- **`handleSizeDrop`** (Method) — `src/lib/udp-queue-manager.js:407`
- **`logDroppedMessages`** (Method) — `src/lib/udp-queue-manager.js:307`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `addToQueue` | Method | `src/lib/udp-queue-manager.js` | 324 |
| `checkBackpressure` | Method | `src/lib/udp-queue-manager.js` | 275 |
| `handleRateLimitDrop` | Method | `src/lib/udp-queue-manager.js` | 389 |
| `handleSizeDrop` | Method | `src/lib/udp-queue-manager.js` | 407 |
| `logDroppedMessages` | Method | `src/lib/udp-queue-manager.js` | 307 |
| `add` | Method | `src/lib/udp-queue-manager.js` | 31 |

## How to Explore

1. `context({name: "addToQueue"})` — see callers and callees
2. `query({search_query: "cluster_77"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
