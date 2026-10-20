---
name: gitnexus-area-cluster-28
description: "Skill for the Cluster_28 area of butler-sos. 20 symbols across 1 files."
---

# Cluster_28

20 symbols | 1 files | Cohesion: 64%

## When to Use

- Working with code in `src/`
- Understanding how downloadScreenshot work
- Modifying cluster_28-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/lib/audit-screenshots.js` | buildMetadataFilename, countSetCookieHeaders, downloadScreenshot, extractAuditContext, readNumber (+15) |

## Entry Points

Start here when exploring this area:

- **`downloadScreenshot`** (Function) — `src/lib/audit-screenshots.js:1433`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `downloadScreenshot` | Function | `src/lib/audit-screenshots.js` | 1433 |
| `buildMetadataFilename` | Function | `src/lib/audit-screenshots.js` | 911 |
| `countSetCookieHeaders` | Function | `src/lib/audit-screenshots.js` | 630 |
| `extractAuditContext` | Function | `src/lib/audit-screenshots.js` | 356 |
| `readNumber` | Function | `src/lib/audit-screenshots.js` | 385 |
| `readString` | Function | `src/lib/audit-screenshots.js` | 372 |
| `formatAxiosError` | Function | `src/lib/audit-screenshots.js` | 488 |
| `formatContextForLog` | Function | `src/lib/audit-screenshots.js` | 441 |
| `getHeaderValue` | Function | `src/lib/audit-screenshots.js` | 643 |
| `isCachedSessionAuthFailure` | Function | `src/lib/audit-screenshots.js` | 468 |
| `isRedirectHttpStatus` | Function | `src/lib/audit-screenshots.js` | 699 |
| `isRetryableHttpStatus` | Function | `src/lib/audit-screenshots.js` | 458 |
| `isScreenshotDownloadHostAllowed` | Function | `src/lib/audit-screenshots.js` | 682 |
| `mergeCookieHeader` | Function | `src/lib/audit-screenshots.js` | 722 |
| `normalizeAllowedScreenshotHosts` | Function | `src/lib/audit-screenshots.js` | 663 |
| `redactQlikTicketInUrl` | Function | `src/lib/audit-screenshots.js` | 579 |
| `resolveRedirectUrl` | Function | `src/lib/audit-screenshots.js` | 710 |
| `sleep` | Function | `src/lib/audit-screenshots.js` | 478 |
| `summarizeUrlForDebug` | Function | `src/lib/audit-screenshots.js` | 597 |
| `withQlikTicket` | Function | `src/lib/audit-screenshots.js` | 270 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `DownloadScreenshot → ReadString` | intra_community | 3 |

## How to Explore

1. `context({name: "downloadScreenshot"})` — see callers and callees
2. `query({search_query: "cluster_28"})` — find related execution flows
3. Read key files listed above for implementation details
4. `explain({target: "<file or symbol>"})` — persisted taint findings (source→sink data flows), when indexed with `--pdg`
