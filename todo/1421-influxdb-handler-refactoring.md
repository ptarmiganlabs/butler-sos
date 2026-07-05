# InfluxDB Handler Refactoring - Log Events & User Events

> **GitHub Issue**: [#1421 - Duplicate Code: InfluxDB Version Handler Pattern](https://github.com/ptarmiganlabs/butler-sos/issues/1421)
> **Status**: Planned (not started)
> **Estimated Effort**: 18.5-28.5 hours

## Table of Contents

1. [Overview](#1-overview)
2. [Current State Analysis](#2-current-state-analysis)
3. [Proposed Architecture](#3-proposed-architecture)
4. [Builder Contract](#4-builder-contract)
5. [Responsibility Matrix](#5-responsibility-matrix)
6. [Implementation Phases](#6-implementation-phases)
6.1. [Known Inconsistencies in Current Code](#61-known-inconsistencies-in-current-code)
6.2. [Behavioral Changes Summary](#62-behavioral-changes-summary)
7. [Incidental Bug Fixes](#7-incidental-bug-fixes)
8. [Cleanup](#8-cleanup)
9. [Test Coverage](#9-test-coverage)
10. [Effort Estimate](#10-effort-estimate)
11. [Risks & Mitigations](#11-risks--mitigations)
12. [Acceptance Criteria](#12-acceptance-criteria)
13. [Implementation Checklist](#13-implementation-checklist)

---

## 1. Overview

Issue #1421 identified that seven nearly identical handler modules exist across three InfluxDB versions (v1, v2, v3), totaling ~3,159 lines of duplicated code. Each version implements the same business logic with only minor API-specific differences.

This plan covers the **two most complex handlers** where the duplication is most impactful:

- **log-events.js** - 718 lines across 3 versions, 5 source types with different tag/field mappings
- **user-events.js** - 344 lines across 3 versions, single event type with optional fields

The goal is to extract shared business logic into version-agnostic **builders** and reduce each version-specific handler to a thin **adapter** that only handles InfluxDB API differences.

---

## 2. Current State Analysis

### 2.1 Log Events (718 lines total)

| Version | File | Lines | Key Characteristics |
|---------|------|-------|---------------------|
| v1 | `src/lib/influxdb/v1/log-events.js` | 216 | Plain objects, 5 source types, throws errors |
| v2 | `src/lib/influxdb/v2/log-events.js` | 209 | `Point` class, typed fields, `_field` suffix for conflicts, throws errors |
| v3 | `src/lib/influxdb/v3/log-events.js` | 293 | `Point3` class, tag sanitization, NaN validation, default values, newline stripping, catches errors |

### 2.2 User Events (344 lines total)

| Version | File | Lines | Key Characteristics |
|---------|------|-------|---------------------|
| v1 | `src/lib/influxdb/v1/user-events.js` | 114 | Plain objects |
| v2 | `src/lib/influxdb/v2/user-events.js` | 100 | `Point` class |
| v3 | `src/lib/influxdb/v3/user-events.js` | 130 | `Point3` class, tag sanitization, catches errors |

### 2.3 What's Already Shared

- `shared/utils.js` - Validation (`validateRequiredFields`), retry logic (`writeToInfluxWithRetry`), batch writing (`writeBatchToInfluxV1/V2/V3`), tag sanitization (`sanitizeInfluxTagValue`)
- `shared/health-metrics-builder.js` - Health metrics business logic
- `shared/queue-metrics-builder.js` - Queue metrics business logic
- `factory.js` - Version routing
- `v2/utils.js` - `applyInfluxTags` helper for v2 config tags

### 2.4 What's Still Duplicated

- Source validation logic (5 source types checked identically in all 3 versions)
- Tag/field building logic per source type (engine, proxy, scheduler, repository, qix-perf)
- Conditional tag handling (`msg?.field?.length > 0` pattern repeated 3x per tag per version)
- Category tag processing (`msg.category` loop)
- Config-based custom tag application (`Butler-SOS.logEvents.tags`)
- User event: required field validation, tag building, optional field handling

### 2.5 Version-Specific Differences (Critical for Adapter Design)

These differences are the reason version-specific adapters are still needed:

| Difference | v1 | v2 | v3 |
|-----------|----|----|-----|
| Data format | Plain `{measurement, tags, fields}` objects | `Point` class from `@influxdata/influxdb-client` | `Point3` class from `@influxdata/influxdb3-client` |
| Tag/field name conflicts | Allowed (tags and fields are separate objects) | NOT allowed - uses `_field` suffix (e.g., `result_code_field`) | NOT allowed - uses `_field` suffix |
| Tag sanitization | None | None | `sanitizeInfluxTagValue()` on all tag values |
| qix-perf default values | Raw values (empty strings pass through) | Raw values | `'Unknown'` for string tags, `'-1'` for numeric tags, `'n/a'` for subsystem |
| NaN validation | None (writes raw values) | None (writes `parseFloat` result directly, may produce NaN) | Skip field entirely if `parseFloat`/`parseInt` returns NaN, log debug message |
| `raw_event` newline stripping | None | None | Strip `\n\r` from `raw_event` field value (line protocol limitation) |
| Error handling | `throw err` | `throw err` | `catch` and log (does not rethrow) |
| Config tags | Manual loop | `applyInfluxTags()` from `v2/utils.js` | Manual loop with `sanitizeInfluxTagValue()` |

---

## 3. Proposed Architecture

### 3.1 New File Structure

```
src/lib/influxdb/
├── shared/
│   ├── log-event-builder.js          (NEW ~200 lines)
│   ├── user-event-builder.js         (NEW ~100 lines)
│   ├── utils.js                      (existing, unchanged)
│   ├── health-metrics-builder.js     (existing, unchanged)
│   └── queue-metrics-builder.js      (existing, unchanged)
├── v1/
│   ├── log-events.js                 (REDUCED from 216 to ~50 lines)
│   └── user-events.js                (REDUCED from 114 to ~40 lines)
├── v2/
│   ├── log-events.js                 (REDUCED from 209 to ~60 lines)
│   ├── user-events.js                (REDUCED from 100 to ~40 lines)
│   └── utils.js                      (KEPT - still used by event-counts.js, queue-metrics.js)
└── v3/
    ├── log-events.js                 (REDUCED from 293 to ~90 lines)
    └── user-events.js                (REDUCED from 130 to ~60 lines)
```

### 3.2 Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                    Version-Specific Adapters                      │
├──────────────────┬──────────────────┬────────────────────────────┤
│  v1/log-events   │  v2/log-events   │  v3/log-events             │
│  (plain objects) │  (Point class)   │  (Point3 + sanitize +      │
│  no suffix       │  _field suffix   │   defaults + NaN check +   │
│                  │                  │   newline strip)           │
└────────┬─────────┴────────┬─────────┴──────────────┬─────────────┘
         │                  │                         │
         └──────────────────┼─────────────────────────┘
                            │
               ┌────────────▼────────────┐
               │ shared/log-event-builder │
               │                          │
               │ - validateLogEventSource │
               │ - buildLogEventModel()   │
               │                          │
               │ Returns canonical model: │
               │ { measurement,           │
               │   tags: {...},           │
               │   fields: [              │
               │     { name, value,       │
               │       type,              │
               │       conflictsWithTag } │
               │   ]                      │
               │ }                        │
               └──────────────────────────┘
```

---

## 4. Builder Contract

### 4.1 Return Type

The builder returns a **version-agnostic canonical model** with typed fields and explicit conflict metadata:

```javascript
{
  measurement: 'log_event',       // string - InfluxDB measurement name
  tags: {                          // object - key/value pairs, only non-empty conditional tags included
    host: 'server1',
    level: 'INFO',
    source: 'qseow-engine',
    // ... conditional tags only present if non-empty
    // ... category tags if msg.category present
    // ... config tags if Butler-SOS.logEvents.tags configured
  },
  fields: [                        // array of typed field definitions
    {
      name: 'result_code',         // string - canonical field name (NO _field suffix)
      value: '0',                  // any - raw value, or parsed number, or null if unparseable
      type: 'string',              // 'string' | 'float' | 'int'
      conflictsWithTag: true       // boolean - true if same name exists as a tag
    },
    // ...
  ]
}
```

### 4.2 What the Builder Handles

- Source validation (5 log event sources)
- Required field validation (user events)
- Tag/field value extraction per source type
- Conditional tags (`msg?.field?.length > 0` checks)
- Category tags from `msg.category`
- Config-based custom tags from `Butler-SOS.logEvents.tags`
- Field type metadata (`string`, `float`, `int`)
- `conflictsWithTag` flag for each field
- Numeric parsing (`parseFloat`/`parseInt`) for qix-perf fields; returns `null` for invalid values

### 4.3 What the Builder Does NOT Handle (Adapter Concerns)

| Concern | Which Adapter(s) |
|---------|-------------------|
| `_field` suffix for name conflicts | v2, v3 (v1 allows tag/field name overlap) |
| Tag sanitization via `sanitizeInfluxTagValue()` | v3 only |
| qix-perf default values (`'Unknown'`, `'-1'`) and scheduler subsystem default (`'n/a'`) | v3 only |
| NaN validation (skip field if value is `null`) | v3 only |
| `raw_event` newline stripping (`\n\r` removal) | v3 only |
| Error handling pattern (throw vs catch) | Each adapter keeps its current pattern |

---

## 5. Responsibility Matrix

| Concern | Builder | v1 Adapter | v2 Adapter | v3 Adapter |
|---------|---------|-----------|-----------|-----------|
| Source validation | **YES** | - | - | - |
| Required field validation | **YES** | - | - | - |
| Tag/field value extraction | **YES** | - | - | - |
| Conditional tags (`?.length > 0`) | **YES** | - | - | - |
| Category tags | **YES** | - | - | - |
| Config tags | **YES** | - | - | - |
| Field type metadata | **YES** | - | - | - |
| `conflictsWithTag` flag | **YES** | - | - | - |
| Numeric parsing (parseFloat/Int) | **YES** | - | - | - |
| `_field` suffix for conflicts | - | NO (v1 allows overlap) | **YES** (if flag) | **YES** (if flag) |
| Tag sanitization | - | NO | NO | **YES** (`sanitizeInfluxTagValue`) |
| qix-perf default values | - | NO (raw values) | NO (raw values) | **YES** (`'Unknown'`, `'-1'` for qix-perf; `'n/a'` for scheduler subsystem only) |
| NaN validation (skip if null) | - | NO (writes raw) | NO (writes NaN) | **YES** (skip field) |
| `raw_event` newline stripping | - | NO | NO | **YES** (all sources) |
| Error handling pattern | - | throw | throw | catch (keep as-is) |

---

## 6. Implementation Phases

### Phase 1: Shared Log Event Builder

**File**: `src/lib/influxdb/shared/log-event-builder.js` (~200 lines)

**Exports**:
- `LOG_EVENT_SOURCES` - Constant array of valid source strings
- `validateLogEventSource(msg, logPrefix)` - Returns boolean
- `buildLogEventModel(msg, logPrefix)` - Returns canonical model or `null` if source invalid

**Internal helpers**:
- `addIfNonEmpty(tags, name, value)` - Add tag only if value is non-empty string
- `parseFloatOrNull(value)` - Parse float or return null
- `parseIntOrNull(value)` - Parse int or return null

**Source-specific field definitions**:

#### qseow-engine
**Tags**: host, level, source, log_row, subsystem (always) + user_full, user_directory, user_id, result_code, windows_user, task_id, task_name, app_id, app_name, engine_exe_version (conditional)
**Fields**:
| Name | Type | conflictsWithTag |
|------|------|-----------------|
| message | string | false |
| exception_message | string | false |
| command | string | false |
| result_code | string | **true** (tag exists) |
| origin | string | false |
| context | string | false |
| session_id | string | false |
| raw_event | string | false |

#### qseow-proxy / qseow-repository
**Tags**: host, level, source, log_row, subsystem (always) + user_full, user_directory, user_id, result_code (conditional)
**Fields**:
| Name | Type | conflictsWithTag |
|------|------|-----------------|
| message | string | false |
| exception_message | string | false |
| command | string | false |
| result_code | string | **true** (tag exists) |
| origin | string | false |
| context | string | false |
| raw_event | string | false |

#### qseow-scheduler
**Tags**: host, level, source, log_row, subsystem (always) + user_full, user_directory, user_id, task_id, task_name (conditional)
**Fields**:
| Name | Type | conflictsWithTag | Notes |
|------|------|-----------------|-------|
| message | string | false | |
| exception_message | string | false | |
| app_name | string | **false** | No conflict (no conditional tag for app_name) |
| app_id | string | **false** | No conflict (no conditional tag for app_id) |
| execution_id | string | false | |
| raw_event | string | false | |

**IMPORTANT**: Current v3 code incorrectly uses `_field` suffix for `app_name` and `app_id` in scheduler (see [Known Inconsistencies](#61-known-inconsistencies-in-current-code)). The refactored code should use `conflictsWithTag: false` to match v1/v2 behavior.

#### qseow-qix-perf
**Tags**: host, level, source, log_row, subsystem, method, object_type, proxy_session_id, session_id, event_activity_source (always, builder uses raw values) + user_full, user_directory, user_id, app_id, app_name, object_id (conditional)
**Fields**:
| Name | Type | conflictsWithTag | Notes |
|------|------|-----------------|-------|
| app_id | string | **true** (conditional tag) | |
| process_time | float | false | Parsed via parseFloatOrNull |
| work_time | float | false | Parsed via parseFloatOrNull |
| lock_time | float | false | Parsed via parseFloatOrNull |
| validate_time | float | false | Parsed via parseFloatOrNull |
| traverse_time | float | false | Parsed via parseFloatOrNull |
| handle | int | false | Parsed via parseIntOrNull |
| net_ram | int | false | Parsed via parseIntOrNull |
| peak_ram | int | false | Parsed via parseIntOrNull |
| raw_event | string | false | |

### Phase 2: Shared User Event Builder

**File**: `src/lib/influxdb/shared/user-event-builder.js` (~100 lines)

**Exports**:
- `validateUserEvent(msg, logPrefix)` - Returns boolean (wraps `validateRequiredFields`)
- `buildUserEventModel(msg, logPrefix)` - Returns canonical model

**Field definitions**:
| Name | Type | conflictsWithTag | Notes |
|------|------|-----------------|-------|
| userFull | string | **true** | Always present |
| userId | string | **true** | Always present |
| appId | string | **true** | Only if msg.appId present |
| appName | string | **true** | Only if msg.appName present |

### Phase 3: Migrate v1 Handlers

v1 is the simplest adapter because:
- Plain objects (no `Point` class)
- Tags and fields are separate objects, so name conflicts are allowed
- No `_field` suffix needed
- Just convert the `fields` array to a plain object

**Pattern**:
```javascript
export async function storeLogEventV1(msg) {
    globals.logger.debug(`LOG EVENT V1: ${JSON.stringify(msg)}`);
    if (!isInfluxDbEnabled()) return;

    const model = buildLogEventModel(msg, 'LOG EVENT V1');
    if (!model) return;

    try {
        const fieldsObj = {};
        for (const f of model.fields) {
            fieldsObj[f.name] = f.value;
        }

        const datapoint = [{
            measurement: model.measurement,
            tags: model.tags,
            fields: fieldsObj,
        }];

        globals.logger.silly(`LOG EVENT V1: Datapoint: ${JSON.stringify(datapoint, null, 2)}`);

        await writeBatchToInfluxV1(
            datapoint,
            `Log event from ${msg.source}`,
            msg.host,
            globals.config.get('Butler-SOS.influxdbConfig.maxBatchSize')
        );

        globals.logger.verbose('LOG EVENT V1: Sent log event data to InfluxDB');
    } catch (err) {
        await globals.errorTracker.incrementError('INFLUXDB_V1_WRITE', msg.host, { module: 'LOG_EVENTS' }, err);
        globals.logger.error(`LOG EVENT V1: Error saving log event: ${globals.getErrorMessage(err)}`);
        throw err;
    }
}
```

### Phase 4: Migrate v2 Handlers

v2 adapter must:
- Convert model to `Point` class
- Apply `_field` suffix when `conflictsWithTag` is `true`
- Use typed field methods (`stringField`, `floatField`, `intField`)
- Skip fields with `null` values (from unparseable numeric fields)

**Pattern**:
```javascript
export async function storeLogEventV2(msg) {
    globals.logger.debug(`LOG EVENT V2: ${JSON.stringify(msg)}`);
    if (!isInfluxDbEnabled()) return;

    const model = buildLogEventModel(msg, 'LOG EVENT V2');
    if (!model) return;

    const org = globals.config.get('Butler-SOS.influxdbConfig.v2Config.org');
    const bucketName = globals.config.get('Butler-SOS.influxdbConfig.v2Config.bucket');

    const point = new Point(model.measurement);

    for (const [k, v] of Object.entries(model.tags)) {
        if (v !== undefined && v !== null) point.tag(k, String(v));
    }

    for (const f of model.fields) {
        if (f.value === null || f.value === undefined) continue;
        const fieldName = f.conflictsWithTag ? `${f.name}_field` : f.name;

        if (f.type === 'float') {
            point.floatField(fieldName, f.value);
        } else if (f.type === 'int') {
            point.intField(fieldName, f.value);
        } else {
            point.stringField(fieldName, String(f.value ?? ''));
        }
    }

    globals.logger.silly(`LOG EVENT V2: Datapoint: ${JSON.stringify(point, null, 2)}`);

    await writeBatchToInfluxV2(
        [point], org, bucketName,
        `Log event for ${msg.host}`, msg.host,
        globals.config.get('Butler-SOS.influxdbConfig.maxBatchSize')
    );

    globals.logger.verbose('LOG EVENT V2: Sent log event data to InfluxDB');
}
```

### Phase 5: Migrate v3 Handlers

v3 is the most complex adapter. In addition to `_field` suffix and typed fields, it must:

1. **Apply default values for qix-perf empty tags**:
   - String tags (`host`, `level`, `source`, `subsystem`, `method`, `object_type`, `event_activity_source`): default to `'Unknown'`
   - Numeric tags (`log_row`, `proxy_session_id`, `session_id`): default to `'-1'`

2. **Apply subsystem default for scheduler only**:
   - `subsystem`: defaults to `'n/a'` (only for `qseow-scheduler`, NOT for engine/proxy/repository)

3. **Sanitize all tag values** via `sanitizeInfluxTagValue()`

4. **NaN validation**: Skip fields where builder returned `null` (unparseable numeric value), log debug message

5. **Strip newlines** from `raw_event` field value (`\n\r` removal) — applied to ALL sources (behavioral change from current code which only does this for qix-perf)

6. **Error handling**: Catch and log, do NOT rethrow

7. **Use `msg.host` as errorCategory** (not `'log-events'`) — standardized with other handlers

**Pattern**:
```javascript
export async function postLogEventToInfluxdbV3(msg) {
    globals.logger.debug(`LOG EVENT INFLUXDB V3: ${JSON.stringify(msg)}`);

    if (!isInfluxDbEnabled()) return;

    const model = buildLogEventModel(msg, 'LOG EVENT INFLUXDB V3');
    if (!model) return;

    const database = globals.config.get('Butler-SOS.influxdbConfig.v3Config.database');

    const point = new Point3(model.measurement);

    // V3-SPECIFIC: Apply default values for empty tags
    // NOTE: Only scheduler gets 'n/a' default for subsystem (matches current behavior)
    // qix-perf gets 'Unknown'/'-1' defaults for specific tags
    const resolvedTags = { ...model.tags };
    if (msg.source === 'qseow-qix-perf') {
        const stringDefaultTags = ['host', 'level', 'source', 'subsystem', 'method', 'object_type', 'event_activity_source'];
        const numericDefaultTags = ['log_row', 'proxy_session_id', 'session_id'];

        for (const key of stringDefaultTags) {
            if (!resolvedTags[key] || resolvedTags[key].length === 0) {
                resolvedTags[key] = 'Unknown';
            }
        }
        for (const key of numericDefaultTags) {
            if (!resolvedTags[key] || resolvedTags[key].length === 0) {
                resolvedTags[key] = '-1';
            }
        }
    } else if (msg.source === 'qseow-scheduler') {
        // Only scheduler gets 'n/a' default for subsystem (matches current v3 behavior)
        if (!resolvedTags.subsystem || resolvedTags.subsystem.length === 0) {
            resolvedTags.subsystem = 'n/a';
        }
    }
    // NOTE: engine/proxy/repository do NOT get subsystem default (matches current v3 behavior)

    // Add tags with sanitization
    for (const [k, v] of Object.entries(resolvedTags)) {
        if (v !== undefined && v !== null) {
            point.setTag(k, sanitizeInfluxTagValue(v));
        }
    }

    // Add fields
    for (const f of model.fields) {
        // V3-SPECIFIC: Skip fields with null values (unparseable numerics)
        if (f.value === null || f.value === undefined) {
            globals.logger.debug(`LOG EVENT INFLUXDB V3: Invalid ${f.name} value: ${msg[f.name]}`);
            continue;
        }

        const fieldName = f.conflictsWithTag ? `${f.name}_field` : f.name;

        // V3-SPECIFIC: Strip newlines from raw_event (applied to ALL sources, not just qix-perf)
        // This is a defensive fix to prevent line protocol parsing issues
        let value = f.value;
        if (f.name === 'raw_event' && typeof value === 'string') {
            value = value.replace(/[\n\r]/g, '');
        }

        if (f.type === 'float') {
            point.setFloatField(fieldName, value);
        } else if (f.type === 'int') {
            point.setIntegerField(fieldName, value);
        } else {
            point.setStringField(fieldName, String(value));
        }
    }

    globals.logger.silly(`LOG EVENT INFLUXDB V3: Datapoint: ${JSON.stringify(point, null, 2)}`);

    try {
        await writeBatchToInfluxV3(
            [point],
            database,
            `Log event for ${msg.host}`,
            msg.host,  // NOTE: Changed from 'log-events' to msg.host for consistency with v1/v2
            globals.config.get('Butler-SOS.influxdbConfig.maxBatchSize')
        );
        globals.logger.debug('LOG EVENT INFLUXDB V3: Wrote data to InfluxDB v3');
    } catch (err) {
        await globals.errorTracker.incrementError('INFLUXDB_V3_WRITE', msg.host, { module: 'LOG_EVENTS' }, err);
        globals.logger.error(`LOG EVENT INFLUXDB V3: Error saving log event: ${globals.getErrorMessage(err)}`);
    }

    globals.logger.verbose('LOG EVENT INFLUXDB V3: Sent log event data to InfluxDB');
}
```

### Phase 6: Migration Order

1. Create `shared/log-event-builder.js` (no existing code changes)
2. Create `shared/user-event-builder.js` (no existing code changes)
3. Write unit tests for both builders
4. Migrate v1 handlers (log-events + user-events) - simplest adapter
5. Run tests to verify v1 works
6. Migrate v2 handlers (log-events + user-events) - Point class + `_field` suffix
7. Standardize v2 user-events to use `writeBatchToInfluxV2`
8. Run tests to verify v2 works
9. Migrate v3 handlers (log-events + user-events) - most complex adapter
10. Fix v3/user-events.js line 25 bug
11. Fix v3 scheduler `_field` suffix bug
12. Run tests to verify v3 works (except intentional behavioral changes)
13. Run full test suite + lint

### Phase 7: User-Events Adapter Examples

#### v1 User Events Adapter

```javascript
export async function storeUserEventV1(msg) {
    globals.logger.debug(`USER EVENT V1: ${JSON.stringify(msg)}`);
    if (!isInfluxDbEnabled()) return;
    if (!validateUserEvent(msg, 'USER EVENT V1')) return;

    try {
        const model = buildUserEventModel(msg, 'USER EVENT V1');

        const fieldsObj = {};
        for (const f of model.fields) {
            fieldsObj[f.name] = f.value;
        }

        const datapoint = [{
            measurement: model.measurement,
            tags: model.tags,
            fields: fieldsObj,
        }];

        globals.logger.silly(`USER EVENT V1: Datapoint: ${JSON.stringify(datapoint, null, 2)}`);

        await writeBatchToInfluxV1(
            datapoint,
            'User event',
            msg.host,
            globals.config.get('Butler-SOS.influxdbConfig.maxBatchSize')
        );

        globals.logger.verbose('USER EVENT V1: Sent user event data to InfluxDB');
    } catch (err) {
        await globals.errorTracker.incrementError('INFLUXDB_V1_WRITE', msg.host, { module: 'USER_EVENTS' }, err);
        globals.logger.error(`USER EVENT V1: Error saving user event: ${globals.getErrorMessage(err)}`);
        throw err;
    }
}
```

#### v2 User Events Adapter

```javascript
export async function storeUserEventV2(msg) {
    globals.logger.debug(`USER EVENT V2: ${JSON.stringify(msg)}`);
    if (!isInfluxDbEnabled()) return;
    if (!validateUserEvent(msg, 'USER EVENT V2')) return;

    const org = globals.config.get('Butler-SOS.influxdbConfig.v2Config.org');
    const bucketName = globals.config.get('Butler-SOS.influxdbConfig.v2Config.bucket');

    const model = buildUserEventModel(msg, 'USER EVENT V2');

    const point = new Point(model.measurement);

    for (const [k, v] of Object.entries(model.tags)) {
        if (v !== undefined && v !== null) point.tag(k, String(v));
    }

    for (const f of model.fields) {
        if (f.value === null || f.value === undefined) continue;
        const fieldName = f.conflictsWithTag ? `${f.name}_field` : f.name;
        point.stringField(fieldName, String(f.value));
    }

    globals.logger.silly(`USER EVENT V2: Datapoint: ${JSON.stringify(point, null, 2)}`);

    await writeToInfluxWithRetry(
        () => writePointsToInfluxV2(globals.influx, org, bucketName, point),
        `User event for ${msg.host}`,
        'v2',
        msg.host,
        { module: 'USER_EVENTS' }
    );

    globals.logger.verbose('USER EVENT V2: Sent user event data to InfluxDB');
}
```

#### v3 User Events Adapter

```javascript
export async function postUserEventToInfluxdbV3(msg) {
    globals.logger.debug(`USER EVENT INFLUXDB V3: ${JSON.stringify(msg)}`);
    if (!isInfluxDbEnabled()) return;
    if (!validateUserEvent(msg, 'USER EVENT INFLUXDB V3')) return;

    const database = globals.config.get('Butler-SOS.influxdbConfig.v3Config.database');

    const model = buildUserEventModel(msg, 'USER EVENT INFLUXDB V3');

    const point = new Point3(model.measurement);

    for (const [k, v] of Object.entries(model.tags)) {
        if (v !== undefined && v !== null) {
            point.setTag(k, sanitizeInfluxTagValue(v));
        }
    }

    for (const f of model.fields) {
        if (f.value === null || f.value === undefined) continue;
        const fieldName = f.conflictsWithTag ? `${f.name}_field` : f.name;
        point.setStringField(fieldName, String(f.value));
    }

    globals.logger.silly(`USER EVENT INFLUXDB V3: Datapoint: ${JSON.stringify(point, null, 2)}`);

    try {
        await writeBatchToInfluxV3(
            [point],
            database,
            `User event for ${msg.host}`,
            msg.host,
            globals.config.get('Butler-SOS.influxdbConfig.maxBatchSize')
        );
        globals.logger.debug('USER EVENT INFLUXDB V3: Wrote data to InfluxDB v3');
    } catch (err) {
        await globals.errorTracker.incrementError('INFLUXDB_V3_WRITE', '', { module: 'USER_EVENTS' }, err);
        globals.logger.error(`USER EVENT INFLUXDB V3: Error saving user event: ${globals.getErrorMessage(err)}`);
    }

    globals.logger.verbose('USER EVENT INFLUXDB V3: Sent user event data to InfluxDB');
}
```

### Phase 8: Write Function Standardization

**Current inconsistency**: v2 handlers use different write patterns:
- `v2/log-events.js` uses `writeBatchToInfluxV2` (progressive batch retry with chunking)
- `v2/user-events.js` uses `writeToInfluxWithRetry` + `writePointsToInfluxV2` (single write with retry)

**Decision needed**: Standardize on one pattern for all v2 handlers.

**Recommendation**: Use `writeBatchToInfluxV2` for all v2 handlers (and `writeBatchToInfluxV3` for all v3 handlers) because:
- Progressive batch retry is more robust for large payloads
- Consistent with v1 pattern (`writeBatchToInfluxV1`)
- Already used by log-events and queue-metrics

**Action**: Update v2/user-events.js to use `writeBatchToInfluxV3` pattern during migration.

### Phase 9: Write Function Parameter Conventions

**Current inconsistency**: Write function parameters differ between handlers:

| Handler | Write Function | context | errorCategory |
|---------|---------------|---------|---------------|
| v1/log-events | `writeBatchToInfluxV1` | `` `Log event from ${msg.source}` `` | `msg.host` |
| v1/user-events | `writeBatchToInfluxV1` | `'User event'` | `msg.host` |
| v2/log-events | `writeBatchToInfluxV2` | `` `Log event for ${msg.host}` `` | `msg.host` |
| v2/user-events | `writeToInfluxWithRetry` | `` `User event for ${msg.host}` `` | `msg.host` |
| v3/log-events | `writeBatchToInfluxV3` | `` `Log event for ${msg.host}` `` | `'log-events'` |
| v3/user-events | `writeBatchToInfluxV3` | `` `User event for ${msg.host}` `` | `msg.host` |

**Decision needed**: Standardize `context` and `errorCategory` parameters.

**Recommendation**:
- `context`: Use `` `${description} for ${msg.host}` `` pattern (already used by most handlers)
- `errorCategory`: Use `msg.host` consistently (matches v1/v2 behavior, more useful for error tracking)

**Action**: Fix v3/log-events.js to use `msg.host` instead of `'log-events'` during migration.

---

## 6.1 Known Inconsistencies in Current Code

These issues exist in the current codebase and should be addressed during refactoring:

### Issue 1: v3 Scheduler `_field` Suffix Bug

**Location**: `src/lib/influxdb/v3/log-events.js` lines 118-131

**Problem**: v3 scheduler uses `_field` suffix for `app_name` and `app_id`:
```javascript
.setStringField('app_name_field', msg.app_name || '')
.setStringField('app_id_field', msg.app_id || '')
```

The comment says "to avoid conflict with conditional tags" but scheduler has NO conditional tags for `app_name` or `app_id`. This is inconsistent with v1 and v2 which use plain names.

**Impact**: InfluxDB field names differ between v3 and v1/v2 for scheduler log events.

**Decision needed during implementation**:
- **Option A**: Fix v3 to match v1/v2 (use `app_name`, `app_id` without suffix) — **breaking change** for existing InfluxDB data
- **Option B**: Keep v3 behavior for backward compatibility — perpetuates inconsistency

**Recommendation**: Option A (fix it). The inconsistency is a bug, and field name changes are acceptable during a refactoring release if documented in changelog.

### Issue 2: v3 Newline Stripping Only in qix-perf

**Location**: `src/lib/influxdb/v3/log-events.js` line 233

**Problem**: Current v3 code only strips `\n\r` from `raw_event` for `qseow-qix-perf` source, not for other sources.

**Impact**: If refactored code strips newlines for ALL sources, this is a behavioral change.

**Decision needed during implementation**:
- **Option A**: Strip newlines for all sources (safer, prevents line protocol issues)
- **Option B**: Only strip for qix-perf (match current behavior exactly)

**Recommendation**: Option A. Newlines in line protocol field values can cause parsing issues regardless of source. This is a defensive fix.

### Issue 3: v3 Subsystem Default Only for Scheduler

**Location**: `src/lib/influxdb/v3/log-events.js`

**Problem**: 
- Scheduler: `msg.subsystem || 'n/a'` (line 125)
- Engine/proxy/repository: `msg.subsystem` (no default, lines 63, 100)

**Impact**: If refactored code applies `'n/a'` default to all non-qix-perf sources, this is a behavioral change for engine/proxy/repository.

**Decision needed during implementation**:
- **Option A**: Apply `'n/a'` default to all non-qix-perf sources (more consistent)
- **Option B**: Only apply to scheduler (match current behavior exactly)

**Recommendation**: Option B. Match current behavior exactly to avoid unexpected changes. Document this as a known inconsistency that could be addressed in a future release.

### Issue 4: v3 errorCategory Inconsistency

**Location**: `src/lib/influxdb/v3/log-events.js` line 275 vs `v3/user-events.js` line 104

**Problem**:
- log-events: `errorCategory = 'log-events'` (string literal)
- user-events: `errorCategory = msg.host` (dynamic value)

**Impact**: Error tracking categorization differs between handlers.

**Decision needed during implementation**:
- **Option A**: Use `msg.host` consistently (matches v1/v2, more useful for error tracking)
- **Option B**: Use descriptive string consistently (e.g., `'log-events'`, `'user-events'`)

**Recommendation**: Option A. Use `msg.host` consistently across all handlers and versions. This matches v1/v2 behavior and provides more actionable error information.

---

## 6.2 Behavioral Changes Summary

The following behavioral changes will be introduced by the refactoring. Each should be explicitly approved during implementation:

| Change | Current Behavior | New Behavior | Risk | Recommendation |
|--------|------------------|--------------|------|----------------|
| v3 scheduler field names | `app_name_field`, `app_id_field` | `app_name`, `app_id` | Breaking change for existing data | **Fix** (Option A) |
| v3 newline stripping | Only qix-perf | All sources | Low risk, defensive fix | **Expand** (Option A) |
| v3 subsystem default | Only scheduler gets `'n/a'` | Keep current (only scheduler) | Low risk | **Keep current** (Option B) |
| v3 errorCategory | `'log-events'` for log events | `msg.host` for all | Low risk, better error tracking | **Standardize** (Option A) |
| v2 write function | Mixed patterns | `writeBatchToInfluxV2` for all | Low risk, more robust | **Standardize** |

---

## 7. Incidental Bug Fixes

| File | Line | Bug | Fix |
|------|------|-----|-----|
| `v3/user-events.js` | 25 | Malformed log message: `` `USER EVENT INFLUXDB V3: ${msg})` `` has stray `)` and missing `JSON.stringify` | Fix to `` `USER EVENT INFLUXDB V3: ${JSON.stringify(msg)}` `` |

---

## 8. Cleanup

| File | Action | Condition |
|------|--------|-----------|
| `src/lib/influxdb/v2/utils.js` | **KEEP** | Still imported by `v2/event-counts.js` and `v2/queue-metrics.js` which are outside the scope of this refactoring. Do NOT remove. |

---

## 9. Test Coverage

### 9.1 New Test Files

- `src/lib/influxdb/shared/__tests__/log-event-builder.test.js`
- `src/lib/influxdb/shared/__tests__/user-event-builder.test.js`

### 9.2 Log Event Builder Test Scenarios

- [ ] All 5 source types produce correct tags
- [ ] All 5 source types produce correct fields with correct types
- [ ] `conflictsWithTag` is `true` for: `result_code` (engine, proxy, repository), `app_id` (qix-perf)
- [ ] `conflictsWithTag` is `false` for: `app_name`/`app_id` (scheduler — no conditional tags for these), and all other fields
- [ ] Conditional tags are added when value is non-empty string
- [ ] Conditional tags are omitted when value is empty string, undefined, or null
- [ ] Category tags from `msg.category` are applied correctly
- [ ] Config-based tags from `Butler-SOS.logEvents.tags` are applied correctly
- [ ] Invalid source returns `null` and logs warning
- [ ] qix-perf numeric fields: valid values parsed correctly
- [ ] qix-perf numeric fields: invalid values return `null` (not NaN)
- [ ] Edge case: empty `msg` object
- [ ] Edge case: `msg.category` is empty array
- [ ] Edge case: config has no `Butler-SOS.logEvents.tags` key

### 9.3 User Event Builder Test Scenarios

- [ ] Required fields validation (all present -> passes)
- [ ] Required fields validation (missing field -> fails)
- [ ] All tags built correctly from msg properties
- [ ] Optional fields (appId, appName) included when present
- [ ] Optional fields omitted when absent
- [ ] User agent tags parsed correctly (browser name, version, OS name, version)
- [ ] `conflictsWithTag` is `true` for userFull, userId, appId, appName
- [ ] Config-based tags applied correctly

### 9.4 Adapter Test Updates

Existing v1/v2/v3 handler tests should be updated to:
- Mock the shared builders (or test integration without mocking)
- Verify `_field` suffix is applied correctly in v2/v3
- Verify v3 sanitization, defaults, NaN skipping, newline stripping
- Verify error handling patterns preserved (v1/v2 throw, v3 catches)
- Verify v3 scheduler uses `app_name`/`app_id` WITHOUT `_field` suffix (bug fix)
- Verify v3 newline stripping applied to ALL sources (not just qix-perf)
- Verify v3 subsystem default only applied to scheduler (not engine/proxy/repository)
- Verify write function parameters standardized (errorCategory = msg.host)
- Verify v2 user-events uses `writeBatchToInfluxV2` (standardized write pattern)

### 9.5 Verification

```bash
npm run lint:fix
npm run test:unit
```

---

## 10. Effort Estimate

| Task | Hours | Notes |
|------|-------|-------|
| `shared/log-event-builder.js` | 4-5 | 5 source types, typed fields, conflict flags |
| `shared/user-event-builder.js` | 2-3 | Simpler, single event type |
| Migrate v1 handlers (log + user) | 1-2 | Plain objects, simplest adapter |
| Migrate v2 handlers (log + user) | 2-3 | Point class + `_field` suffix logic |
| Migrate v3 handlers (log + user) | 3-4 | Defaults + sanitization + NaN + newlines |
| Unit tests for builders | 3-4 | All 5 sources, conditional tags, edge cases |
| Update existing tests | 2-3 | Mock builders, verify integration, test behavioral changes |
| Bug fix (v3/user-events.js line 25) | 0.5 | Trivial |
| Fix v3 scheduler `_field` suffix bug | 0.5 | Breaking change, needs changelog entry |
| Standardize write functions + parameters | 1-2 | Update v2 user-events, v3 log-events |
| **Total** | **18.5-28.5** | |

---

## 11. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Field name conflicts handled inconsistently | High | Builder provides `conflictsWithTag` flag; each adapter applies its own suffix rules deterministically |
| Numeric field types lost without explicit metadata | High | Builder returns typed field definitions (`string`/`float`/`int`); adapters use type to call correct method |
| v3 default values diverge from current behavior | Medium | Adapter applies defaults AFTER builder returns raw values; test each source type explicitly |
| v3 scheduler `_field` suffix fix is breaking change | Medium | Document in CHANGELOG; field names will change from `app_name_field`/`app_id_field` to `app_name`/`app_id` |
| v3 newline stripping expanded to all sources | Low | Defensive fix; test all sources to ensure no regressions |
| NaN validation behavior changes | Medium | Builder returns `null` for unparseable values; v3 adapter skips `null` fields (same as current behavior) |
| `raw_event` newline stripping only in v3 | Low | Adapter handles this; builder returns raw `JSON.stringify(msg)` |
| Breaking existing behavior | High | Comprehensive test coverage before/after; migrate one version at a time; run full test suite after each phase |
| Error handling differences (v1/v2 throw, v3 catches) | Low | Keep version-specific error handling in adapters; builder is not concerned with error propagation |
| `v2/utils.js` still imported by other code | Low | Confirmed: `event-counts.js` and `queue-metrics.js` still import `applyInfluxTags`. File must be kept. |
| Write function standardization changes behavior | Low | `writeBatchToInfluxV2` is more robust than `writeToInfluxWithRetry`; test thoroughly |

---

## 12. Acceptance Criteria

- [ ] All existing tests pass (no unintended behavioral changes)
- [ ] New unit tests for `log-event-builder.js` cover all 5 source types
- [ ] New unit tests for `user-event-builder.js` cover required/optional fields
- [ ] Tests verify `conflictsWithTag` flags are correct for each source
- [ ] v3 adapter tests verify: sanitization, defaults, NaN skipping, newline stripping
- [ ] v3 adapter tests verify: scheduler `app_name`/`app_id` use NO `_field` suffix (bug fix)
- [ ] v3 adapter tests verify: subsystem `'n/a'` default only for scheduler
- [ ] v3 adapter tests verify: newline stripping for ALL sources (not just qix-perf)
- [ ] v2 adapter tests verify: `_field` suffix applied only when `conflictsWithTag` is true
- [ ] v1 adapter tests verify: no suffix, raw field names used
- [ ] v2 user-events uses `writeBatchToInfluxV2` (standardized write pattern)
- [ ] All handlers use `msg.host` as `errorCategory` (standardized parameter)
- [ ] `v2/utils.js` kept (still used by `event-counts.js` and `queue-metrics.js`)
- [ ] v3/user-events.js line 25 bug fixed
- [ ] No functional changes to `factory.js` or `index.js`
- [ ] Behavioral changes documented in CHANGELOG
- [ ] `npm run lint:fix` passes
- [ ] `npm run test:unit` passes

---

## 13. Implementation Checklist

- [ ] Create `src/lib/influxdb/shared/log-event-builder.js`
- [ ] Create `src/lib/influxdb/shared/user-event-builder.js`
- [ ] Create `src/lib/influxdb/shared/__tests__/log-event-builder.test.js`
- [ ] Create `src/lib/influxdb/shared/__tests__/user-event-builder.test.js`
- [ ] Migrate `src/lib/influxdb/v1/log-events.js` to use builder
- [ ] Migrate `src/lib/influxdb/v1/user-events.js` to use builder
- [ ] Run tests, verify v1 unchanged
- [ ] Migrate `src/lib/influxdb/v2/log-events.js` to use builder
- [ ] Migrate `src/lib/influxdb/v2/user-events.js` to use builder
- [ ] Standardize v2 user-events to use `writeBatchToInfluxV2`
- [ ] Run tests, verify v2 unchanged
- [ ] Migrate `src/lib/influxdb/v3/log-events.js` to use builder
- [ ] Migrate `src/lib/influxdb/v3/user-events.js` to use builder
- [ ] Fix v3/user-events.js line 25 bug
- [ ] Fix v3 scheduler `_field` suffix bug (use `app_name`/`app_id` without suffix)
- [ ] Apply newline stripping to ALL sources in v3 (not just qix-perf)
- [ ] Apply subsystem `'n/a'` default only to scheduler in v3 (not engine/proxy/repository)
- [ ] Standardize v3 log-events `errorCategory` to `msg.host` (not `'log-events'`)
- [ ] Run tests, verify v3 unchanged (except intentional behavioral changes)
- [ ] Verify `v2/utils.js` (`applyInfluxTags`) still needed by `event-counts.js` and `queue-metrics.js` — confirmed, KEEP file
- [ ] Run full test suite
- [ ] Run `npm run lint:fix`
- [ ] Add behavioral changes to CHANGELOG
- [ ] Manual testing with InfluxDB v1 (if available)
- [ ] Manual testing with InfluxDB v2 (if available)
- [ ] Manual testing with InfluxDB v3 (if available)
