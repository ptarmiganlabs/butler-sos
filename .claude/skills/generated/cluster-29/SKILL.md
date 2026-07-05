---
name: cluster-29
description: "Skill for the Cluster_29 area of butler-sos. 21 symbols across 1 files."
---

# Cluster_29

21 symbols | 1 files | Cohesion: 65%

## When to Use

- Working with code in `src/`
- Understanding how downloadScreenshot work
- Modifying cluster_29-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/lib/audit-screenshots.js` | withQlikTicket, extractAuditContext, readString, readNumber, formatContextForLog (+16) |

## Entry Points

Start here when exploring this area:

- **`downloadScreenshot`** (Function) — `src/lib/audit-screenshots.js:1219`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `downloadScreenshot` | Function | `src/lib/audit-screenshots.js` | 1219 |
| `withQlikTicket` | Function | `src/lib/audit-screenshots.js` | 265 |
| `extractAuditContext` | Function | `src/lib/audit-screenshots.js` | 351 |
| `readString` | Function | `src/lib/audit-screenshots.js` | 367 |
| `readNumber` | Function | `src/lib/audit-screenshots.js` | 380 |
| `formatContextForLog` | Function | `src/lib/audit-screenshots.js` | 436 |
| `isRetryableHttpStatus` | Function | `src/lib/audit-screenshots.js` | 453 |
| `isCachedSessionAuthFailure` | Function | `src/lib/audit-screenshots.js` | 463 |
| `sleep` | Function | `src/lib/audit-screenshots.js` | 473 |
| `formatAxiosError` | Function | `src/lib/audit-screenshots.js` | 483 |
| `redactQlikTicketInUrl` | Function | `src/lib/audit-screenshots.js` | 518 |
| `summarizeUrlForDebug` | Function | `src/lib/audit-screenshots.js` | 536 |
| `countSetCookieHeaders` | Function | `src/lib/audit-screenshots.js` | 569 |
| `getHeaderValue` | Function | `src/lib/audit-screenshots.js` | 582 |
| `normalizeAllowedScreenshotHosts` | Function | `src/lib/audit-screenshots.js` | 602 |
| `isScreenshotDownloadHostAllowed` | Function | `src/lib/audit-screenshots.js` | 621 |
| `isRedirectHttpStatus` | Function | `src/lib/audit-screenshots.js` | 638 |
| `resolveRedirectUrl` | Function | `src/lib/audit-screenshots.js` | 649 |
| `mergeCookieHeader` | Function | `src/lib/audit-screenshots.js` | 661 |
| `buildMetadataFilename` | Function | `src/lib/audit-screenshots.js` | 850 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `DownloadScreenshot → ReadString` | intra_community | 3 |
| `DownloadScreenshot → ReadNumber` | intra_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Util | 6 calls |
| Cluster_25 | 3 calls |
| Cluster_31 | 3 calls |
| Influxdb | 2 calls |
| Cluster_30 | 2 calls |
| Cluster_32 | 2 calls |
| Globals | 1 calls |
| Cluster_24 | 1 calls |

## How to Explore

1. `gitnexus_context({name: "downloadScreenshot"})` — see callers and callees
2. `gitnexus_query({query: "cluster_29"})` — find related execution flows
3. Read key files listed above for implementation details
