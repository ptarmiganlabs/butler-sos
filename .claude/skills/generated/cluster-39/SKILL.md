---
name: cluster-39
description: "Skill for the Cluster_39 area of butler-sos. 7 symbols across 1 files."
---

# Cluster_39

7 symbols | 1 files | Cohesion: 71%

## When to Use

- Working with code in `src/`
- Understanding how writeCrashDump work
- Modifying cluster_39-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/lib/crash-dump.js` | buildTimestampForFilename, sanitizeStackTrace, redactSensitivePatterns, buildSafeConfig, safeGet (+2) |

## Entry Points

Start here when exploring this area:

- **`writeCrashDump`** (Function) — `src/lib/crash-dump.js:237`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `writeCrashDump` | Function | `src/lib/crash-dump.js` | 237 |
| `buildTimestampForFilename` | Function | `src/lib/crash-dump.js` | 53 |
| `sanitizeStackTrace` | Function | `src/lib/crash-dump.js` | 74 |
| `redactSensitivePatterns` | Function | `src/lib/crash-dump.js` | 102 |
| `buildSafeConfig` | Function | `src/lib/crash-dump.js` | 137 |
| `safeGet` | Function | `src/lib/crash-dump.js` | 150 |
| `resolveCrashDir` | Function | `src/lib/crash-dump.js` | 205 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Influxdb | 2 calls |
| Globals | 2 calls |

## How to Explore

1. `gitnexus_context({name: "writeCrashDump"})` — see callers and callees
2. `gitnexus_query({query: "cluster_39"})` — find related execution flows
3. Read key files listed above for implementation details
