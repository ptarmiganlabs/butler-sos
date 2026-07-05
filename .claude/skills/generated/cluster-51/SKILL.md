---
name: cluster-51
description: "Skill for the Cluster_51 area of butler-sos. 16 symbols across 4 files."
---

# Cluster_51

16 symbols | 4 files | Cohesion: 85%

## When to Use

- Working with code in `src/`
- Understanding how isIPv4, parseAllowedSources, isIpAllowed work
- Modifying cluster_51-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/lib/udp-queue-manager.js` | add, checkLimit, validateMessageSize, checkRateLimit, checkBackpressure (+4) |
| `src/lib/udp-ip-validator.js` | isIPv4, resolveHostname, parseAllowedSources, isIpAllowed, logRejection |
| `src/lib/udp_handlers_log_events.js` | udpInitLogEventServer |
| `src/lib/udp_handlers_user_activity.js` | udpInitUserActivityServer |

## Entry Points

Start here when exploring this area:

- **`isIPv4`** (Function) — `src/lib/udp-ip-validator.js:12`
- **`parseAllowedSources`** (Function) — `src/lib/udp-ip-validator.js:41`
- **`isIpAllowed`** (Function) — `src/lib/udp-ip-validator.js:83`
- **`udpInitLogEventServer`** (Function) — `src/lib/udp_handlers_log_events.js:22`
- **`udpInitUserActivityServer`** (Function) — `src/lib/udp_handlers_user_activity.js:22`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `isIPv4` | Function | `src/lib/udp-ip-validator.js` | 12 |
| `parseAllowedSources` | Function | `src/lib/udp-ip-validator.js` | 41 |
| `isIpAllowed` | Function | `src/lib/udp-ip-validator.js` | 83 |
| `udpInitLogEventServer` | Function | `src/lib/udp_handlers_log_events.js` | 22 |
| `udpInitUserActivityServer` | Function | `src/lib/udp_handlers_user_activity.js` | 22 |
| `logRejection` | Method | `src/lib/udp-ip-validator.js` | 119 |
| `validateMessageSize` | Method | `src/lib/udp-queue-manager.js` | 254 |
| `checkRateLimit` | Method | `src/lib/udp-queue-manager.js` | 264 |
| `checkBackpressure` | Method | `src/lib/udp-queue-manager.js` | 275 |
| `logDroppedMessages` | Method | `src/lib/udp-queue-manager.js` | 307 |
| `addToQueue` | Method | `src/lib/udp-queue-manager.js` | 324 |
| `handleRateLimitDrop` | Method | `src/lib/udp-queue-manager.js` | 389 |
| `handleSizeDrop` | Method | `src/lib/udp-queue-manager.js` | 407 |
| `resolveHostname` | Function | `src/lib/udp-ip-validator.js` | 22 |
| `add` | Method | `src/lib/udp-queue-manager.js` | 31 |
| `checkLimit` | Method | `src/lib/udp-queue-manager.js` | 123 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `UdpInitLogEventServer → IsSea` | cross_community | 4 |
| `UdpInitUserActivityServer → IsSea` | cross_community | 4 |
| `UdpInitLogEventServer → IsIPv4` | intra_community | 3 |
| `UdpInitLogEventServer → ResolveHostname` | intra_community | 3 |
| `UdpInitUserActivityServer → IsIPv4` | intra_community | 3 |
| `UdpInitUserActivityServer → ResolveHostname` | intra_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Cluster_37 | 2 calls |
| Handlers | 2 calls |

## How to Explore

1. `gitnexus_context({name: "isIPv4"})` — see callers and callees
2. `gitnexus_query({query: "cluster_51"})` — find related execution flows
3. Read key files listed above for implementation details
