---
name: gitnexus-area-cluster-39
description: "Skill for the Cluster_39 area of butler-sos. 8 symbols across 2 files."
---

# Cluster_39

8 symbols | 2 files | Cohesion: 74%

## When to Use

- Working with code in `src/`
- Understanding how writeCrashDump, buildSecretJsonPairRegex, buildSecretKeyValueRegex work
- Modifying cluster_39-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/lib/crash-dump.js` | buildSafeConfig, safeGet, buildTimestampForFilename, sanitizeStackTrace, writeCrashDump |
| `src/lib/secret-patterns.js` | buildSecretJsonPairRegex, buildSecretKeyValueRegex, redactSensitivePatterns |

## Entry Points

Start here when exploring this area:

- **`writeCrashDump`** (Function) — `src/lib/crash-dump.js:187`
- **`buildSecretJsonPairRegex`** (Function) — `src/lib/secret-patterns.js:88`
- **`buildSecretKeyValueRegex`** (Function) — `src/lib/secret-patterns.js:77`
- **`redactSensitivePatterns`** (Function) — `src/lib/secret-patterns.js:109`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `writeCrashDump` | Function | `src/lib/crash-dump.js` | 187 |
| `buildSecretJsonPairRegex` | Function | `src/lib/secret-patterns.js` | 88 |
| `buildSecretKeyValueRegex` | Function | `src/lib/secret-patterns.js` | 77 |
| `redactSensitivePatterns` | Function | `src/lib/secret-patterns.js` | 109 |
| `buildSafeConfig` | Function | `src/lib/crash-dump.js` | 103 |
| `safeGet` | Function | `src/lib/crash-dump.js` | 116 |
| `buildTimestampForFilename` | Function | `src/lib/crash-dump.js` | 55 |
| `sanitizeStackTrace` | Function | `src/lib/crash-dump.js` | 76 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `HandleUncaughtException → SafeGet` | cross_community | 4 |
| `HandleUncaughtException → BuildSecretJsonPairRegex` | cross_community | 4 |
| `HandleUncaughtException → BuildSecretKeyValueRegex` | cross_community | 4 |
| `HandleUnhandledRejection → BuildSecretJsonPairRegex` | cross_community | 4 |
| `HandleUnhandledRejection → BuildSecretKeyValueRegex` | cross_community | 4 |
| `HandleUncaughtException → SanitizeStackTrace` | cross_community | 3 |

## How to Explore

1. `context({name: "writeCrashDump"})` — see callers and callees
2. `query({search_query: "cluster_39"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
