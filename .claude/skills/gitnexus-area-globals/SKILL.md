---
name: gitnexus-area-globals
description: "Skill for the Globals area of butler-sos. 30 symbols across 13 files."
---

# Globals

30 symbols | 13 files | Cohesion: 72%

## When to Use

- Working with code in `src/`
- Understanding how getErrorMessage, isRunningInDocker, shouldLogStackTraces work
- Modifying globals-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/lib/log-error.js` | logDebug, logErrorWithLevel, logFatal, logInfo, logVerbose (+1) |
| `src/lib/globals/command-line.js` | formatErrorBlock, style, initCommandLine, missingConfigFileMessage, quoteShellArgument |
| `src/lib/globals/utils.js` | getErrorMessage, isRunningInDocker, shouldLogStackTraces |
| `src/lib/error-tracker.js` | ErrorTracker, setupErrorCounterReset, scheduleNextReset |
| `src/lib/config-file-verify.js` | createConditionalSchema, makeFeatureConditional, verifyConfigFileSchema |
| `src/lib/globals/logging.js` | initLogging, getLogDirectory |
| `src/globals.js` | init, initHostInfo |
| `src/lib/udp-event.js` | UdpEvents |
| `src/lib/udp-queue-manager.js` | UdpQueueManager |
| `src/lib/globals/udp-servers.js` | initUdp |

## Entry Points

Start here when exploring this area:

- **`getErrorMessage`** (Function) — `src/lib/globals/utils.js:34`
- **`isRunningInDocker`** (Function) — `src/lib/globals/utils.js:75`
- **`shouldLogStackTraces`** (Function) — `src/lib/globals/utils.js:16`
- **`logDebug`** (Function) — `src/lib/log-error.js:135`
- **`logFatal`** (Function) — `src/lib/log-error.js:161`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `ErrorTracker` | Class | `src/lib/error-tracker.js` | 49 |
| `UdpEvents` | Class | `src/lib/udp-event.js` | 13 |
| `UdpQueueManager` | Class | `src/lib/udp-queue-manager.js` | 185 |
| `getErrorMessage` | Function | `src/lib/globals/utils.js` | 34 |
| `isRunningInDocker` | Function | `src/lib/globals/utils.js` | 75 |
| `shouldLogStackTraces` | Function | `src/lib/globals/utils.js` | 16 |
| `logDebug` | Function | `src/lib/log-error.js` | 135 |
| `logFatal` | Function | `src/lib/log-error.js` | 161 |
| `logInfo` | Function | `src/lib/log-error.js` | 113 |
| `logVerbose` | Function | `src/lib/log-error.js` | 124 |
| `logWarn` | Function | `src/lib/log-error.js` | 102 |
| `setupErrorCounterReset` | Function | `src/lib/error-tracker.js` | 499 |
| `scheduleNextReset` | Function | `src/lib/error-tracker.js` | 503 |
| `initUdp` | Function | `src/lib/globals/udp-servers.js` | 10 |
| `initAppInfo` | Function | `src/lib/globals/app-info.js` | 10 |
| `initLogging` | Function | `src/lib/globals/logging.js` | 10 |
| `getLogDirectory` | Function | `src/lib/globals/logging.js` | 38 |
| `resolveConfiguredDir` | Function | `src/lib/resolve-configured-dir.js` | 13 |
| `formatErrorBlock` | Function | `src/lib/globals/command-line.js` | 82 |
| `style` | Function | `src/lib/globals/command-line.js` | 96 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `UdpInitUserActivityServer → IsRunningInDocker` | cross_community | 8 |
| `SetupConfigVisServer → IsRunningInDocker` | cross_community | 7 |
| `SetupHealthMetricsTimer → IsRunningInDocker` | cross_community | 7 |
| `SetupUserSessionsTimer → IsRunningInDocker` | cross_community | 7 |
| `Init → MakeFeatureConditional` | cross_community | 5 |
| `Init → IsNullableArraySchema` | cross_community | 5 |
| `UdpInitLogEventServer → IsRunningInDocker` | cross_community | 5 |
| `InitConfig → IsValidHostname` | cross_community | 4 |
| `Init → Style` | cross_community | 4 |
| `Init → QuoteShellArgument` | cross_community | 4 |

## How to Explore

1. `context({name: "getErrorMessage"})` — see callers and callees
2. `query({search_query: "globals"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
