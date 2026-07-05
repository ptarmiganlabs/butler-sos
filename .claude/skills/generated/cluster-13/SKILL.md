---
name: cluster-13
description: "Skill for the Cluster_13 area of butler-sos. 5 symbols across 1 files."
---

# Cluster_13

5 symbols | 1 files | Cohesion: 53%

## When to Use

- Working with code in `src/`
- Understanding how buildAuditInfluxPointModel work
- Modifying cluster_13-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `src/lib/audit-destinations/influxdb/shared/mapping.js` | readString, readNumber, readBoolean, asObject, buildAuditInfluxPointModel |

## Entry Points

Start here when exploring this area:

- **`buildAuditInfluxPointModel`** (Function) — `src/lib/audit-destinations/influxdb/shared/mapping.js:53`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `buildAuditInfluxPointModel` | Function | `src/lib/audit-destinations/influxdb/shared/mapping.js` | 53 |
| `readString` | Function | `src/lib/audit-destinations/influxdb/shared/mapping.js` | 12 |
| `readNumber` | Function | `src/lib/audit-destinations/influxdb/shared/mapping.js` | 22 |
| `readBoolean` | Function | `src/lib/audit-destinations/influxdb/shared/mapping.js` | 32 |
| `asObject` | Function | `src/lib/audit-destinations/influxdb/shared/mapping.js` | 42 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `WriteAuditEventToInfluxdbFactory → AsObject` | cross_community | 4 |
| `WriteAuditEventToInfluxdbFactory → Get` | cross_community | 4 |
| `WriteAuditEventToInfluxdbFactory → ReadString` | cross_community | 4 |
| `WriteAuditEventInfluxV2 → ReadNonEmptyString` | cross_community | 4 |
| `WriteAuditEventInfluxV1 → ReadNonEmptyString` | cross_community | 4 |
| `WriteAuditEventInfluxV3 → ReadNonEmptyString` | cross_community | 4 |
| `WriteAuditEventInfluxV2 → ReadString` | cross_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Util | 1 calls |
| Globals | 1 calls |
| Influxdb | 1 calls |

## How to Explore

1. `gitnexus_context({name: "buildAuditInfluxPointModel"})` — see callers and callees
2. `gitnexus_query({query: "cluster_13"})` — find related execution flows
3. Read key files listed above for implementation details
