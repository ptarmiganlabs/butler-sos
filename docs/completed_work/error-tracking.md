# Error Tracking in Butler SOS

## Overview

Butler SOS tracks errors that occur when communicating with Qlik Sense servers and when writing data to destination systems (InfluxDB, MQTT, New Relic), and when processing incoming UDP events.

The `ErrorTracker` class provides a single, unified mechanism for:

- **In-memory cumulative error counting** with daily UTC reset
- **Optional InfluxDB time-series logging** of individual error events
- **Console summary logging** (optional) at midnight UTC

## Master Switch

`Butler-SOS.errorTracking.enable: false` disables **all** error tracking — in-memory counting, daily summary logging, and InfluxDB writes are all skipped. When set to `true` (the default), individual feature flags (`logSummary.enable`, `influxdb.enable`) control each sub-feature independently.

## How It Works

1. **Error detection**: When any operation fails, catch blocks call:

   ```javascript
   await globals.errorTracker.incrementError(apiType, serverName, metadata, err)
   ```

   All four parameters are accepted:
   - `apiType` — string code identifying the error category (e.g. `'HEALTH_API'`)
   - `serverName` — name of the Qlik Sense server involved, or `''` if not applicable
   - `metadata` — optional object with additional context: `{ host, virtualProxy, destinationHost, module }`
   - `err` — optional original `Error` object; used to derive `error_category` for InfluxDB

2. **In-memory tracking**: The ErrorTracker increments its counter and maintains error statistics grouped by API type and server.

3. **Daily summary**: At midnight UTC, the tracker logs a summary and resets counters (if `logSummary.enable` is true).

4. **InfluxDB write (optional)**: If `errorTracking.influxdb.enable` is true, each error generates a single data point in InfluxDB with tags identifying the error type, server, host, virtual proxy, destination host, and originating module, plus an `error_category` field derived from the error object.

## Configuration

```yaml
Butler-SOS:
  errorTracking:
    enable: true                          # Master switch — disables all tracking when false
    logSummary:
      enable: true                        # Log daily error summary to console
    influxdb:
      enable: true                        # Write individual error events to InfluxDB
      measurementName: butler_sos_errors  # InfluxDB measurement name
```

## Error Types

| Error Type | Description | Source Module(s) |
|------------|-------------|-----------------|
| `HEALTH_API` | Health check API failures | `healthmetrics.js` |
| `PROXY_API` | Proxy session API failures | `proxysessionmetrics.js` |
| `APP_NAMES_EXTRACT` | App name extraction failures | `appnamesextract.js` |
| `INFLUXDB_V1_WRITE` | InfluxDB v1 write failures | `influxdb/v1/*.js` |
| `INFLUXDB_V2_WRITE` | InfluxDB v2 write failures | `influxdb/v2/*.js` via `writeToInfluxWithRetry` |
| `INFLUXDB_V3_WRITE` | InfluxDB v3 write failures | `influxdb/v3/*.js` |
| `MQTT_PUBLISH` | MQTT publish failures | `post-to-mqtt.js` |
| `NEW_RELIC_POST` | New Relic API post failures | `post-to-new-relic.js` |
| `UDP_USER_EVENT` | UDP user event processing failures | `udp_handlers/user_events/message-event.js` |
| `UDP_LOG_EVENT` | UDP log event processing failures | `udp_handlers/log_events/message-event.js` |

## Module Context Values

The `module` field in the `metadata` argument identifies which part of Butler SOS generated the error. This is stored as the `module` tag in InfluxDB.

| Module value | Description |
|---|---|
| `HEALTH_METRICS` | Qlik Sense engine health data write |
| `PROXY_SESSIONS` | Qlik Sense proxy session data write |
| `LOG_EVENTS` | Log event data write |
| `USER_EVENTS` | User event data write |
| `EVENT_COUNTS` | Event count metrics write |
| `REJECTED_EVENT_COUNTS` | Rejected event count metrics write |
| `QUEUE_METRICS` | Queue metrics write |
| `BUTLER_MEMORY` | Butler SOS own memory usage write |
| `HEALTH_METRICS_MQTT` | MQTT publish for health metrics |
| `PROXY_SESSIONS_MQTT` | MQTT publish for proxy sessions |
| `USER_EVENTS_MQTT` | MQTT publish for user events |
| `LOG_EVENTS_MQTT` | MQTT publish for log events |
| `HEALTH_METRICS_NEW_RELIC` | New Relic post for health metrics |
| `PROXY_SESSIONS_NEW_RELIC` | New Relic post for proxy sessions |
| `UDP_USER_EVENTS` | UDP handler for user events |
| `UDP_LOG_EVENTS` | UDP handler for log events |

## InfluxDB Data Model

Every error event written to InfluxDB produces one data point with a mix of **tags** (indexed, for filtering/grouping) and **fields** (values, for querying/alerting).

### Tags

| Tag | Always present | Value |
|-----|---------------|-------|
| `error_type` | Yes | One of the error type codes (e.g. `HEALTH_API`, `INFLUXDB_V3_WRITE`) |
| `server_name` | Yes | Configured Qlik Sense server name, or `''` if not applicable |
| `host` | When provided | Hostname/IP of the Qlik Sense server or MQTT broker |
| `virtual_proxy` | `PROXY_API`, `PROXY_SESSIONS_MQTT` only | Virtual proxy prefix (e.g. `/`, `/hdr`) |
| `destination_host` | Destination write errors | Target URL for InfluxDB, New Relic etc. |
| `module` | When provided | Butler SOS subsystem (see Module Context Values table) |

### Fields

| Field | Type | Always present | Description |
|-------|------|---------------|-------------|
| `error_count` | integer | Yes | Always `1` — one point per error event |
| `error_category` | string | Yes | Human-readable category (see Error Categorization below) |
| `error_code` | string | When present | OS/library error code (e.g. `ECONNREFUSED`, `ETIMEDOUT`) |
| `http_status` | integer | HTTP errors only | HTTP response status code (e.g. `401`, `503`) |
| `request_url` | string | Axios errors only | Sanitized request URL — scheme + host + path, **query string stripped** |
| `request_timeout_ms` | integer | Axios errors with timeout | Configured Axios timeout in milliseconds (e.g. `5000`) |
| `remote_address` | string | TCP connection errors | Remote IP that was dialled (from `err.cause.address`) |
| `remote_port` | integer | TCP connection errors | Remote port that was dialled (from `err.cause.port`) |
| `syscall` | string | TCP connection errors | OS syscall that failed (e.g. `connect`) |

> `request_url` has query parameters stripped to avoid leaking secrets (e.g. `Xrfkey` values) into InfluxDB.

### Example line protocol entries

```text
# ECONNREFUSED dialling Qlik Sense proxy
butler_sos_errors,error_type=PROXY_API,server_name=sense2,host=pro2-win2.lab.ptarmiganlabs.net,virtual_proxy=/ error_count=1i,error_category="connection_refused",error_code="ECONNREFUSED",request_url="https://pro2-win2.lab.ptarmiganlabs.net:4243/qps/session",request_timeout_ms=5000i,remote_address="192.168.100.110",remote_port=4243i,syscall="connect"

# Timeout calling Qlik Sense health API
butler_sos_errors,error_type=HEALTH_API,server_name=sense1,host=sense1.example.com error_count=1i,error_category="timeout",error_code="ECONNABORTED",request_url="https://sense1.example.com:4747/engine/healthcheck",request_timeout_ms=5000i

# HTTP 401 from New Relic
butler_sos_errors,error_type=NEW_RELIC_POST,server_name=,module=HEALTH_METRICS_NEW_RELIC,destination_host=https://metric-api.newrelic.com error_count=1i,error_category="auth_error",http_status=401i,error_code=""

# InfluxDB v3 write failure (non-network)
butler_sos_errors,error_type=INFLUXDB_V3_WRITE,server_name=sense1,module=HEALTH_METRICS error_count=1i,error_category="unknown",error_code=""

# UDP event processing failure
butler_sos_errors,error_type=UDP_USER_EVENT,server_name=,module=UDP_USER_EVENTS error_count=1i,error_category="unknown",error_code=""
```

## Error Categorization

The `error_category` field is derived by `getErrorCategory()` in [src/lib/error-categorizer.js](../../src/lib/error-categorizer.js) from the original `Error` object passed to `incrementError`.

`getErrorMetadata()` in the same file additionally extracts Axios-specific fields (`request_url`, `request_timeout_ms`) and network-level fields from `err.cause` (`remote_address`, `remote_port`, `syscall`).

### Categories

| Category | Trigger condition |
|---|---|
| `timeout` | `err.code === 'ETIMEDOUT'` or `'ECONNABORTED'`, message contains `'timeout'`, or `err.name === 'RequestTimedOutError'` |
| `connection_refused` | `err.code === 'ECONNREFUSED'` |
| `host_not_found` | `err.code === 'ENOTFOUND'` |
| `connection_reset` | `err.code === 'ECONNRESET'` |
| `auth_error` | HTTP status 401 or 403 |
| `not_found` | HTTP status 404 |
| `rate_limited` | HTTP status 429 |
| `http_5xx` | HTTP status ≥ 500 |
| `http_4xx` | HTTP status 400–499 (other than 401, 403, 404, 429) |
| `certificate_error` | Error message contains `'cert'`, `'TLS'`, or `'SSL'` |
| `mqtt_error` | Error message contains `'mqtt'` |
| `new_relic_error` | Error message contains `'new relic'` |
| `unknown` | No `err` object passed, or none of the above matched |

### Axios errors (ECONNREFUSED, ETIMEDOUT etc.)

For Axios-originated errors, `err.code` reflects the outer Axios wrapper (`ECONNREFUSED`, `ECONNABORTED`, `ETIMEDOUT`). The actual TCP-level cause is in `err.cause`, which holds the raw `Error` from Node's net layer with `.address`, `.port`, and `.syscall` properties. Both levels are captured.

## Console Logging

### Per-error summary (on every error)

When `Butler-SOS.errorTracking.logSummary.enable: true` (the default), every call to `incrementError` logs a running cumulative total at `info` level:

```
2026-05-03T16:10:09.420Z info: ERROR TRACKER: Error counts today (UTC): Total=3, Details={"PROXY_API":{"total":2,"servers":{"sense1":2}},"HEALTH_API":{"total":1,"servers":{"sense1":1}}}
```

The `Details` JSON is grouped by error type → `{ total, servers: { serverName: count } }`. For errors with no server context the key `_no_server_context` is used.

### Daily midnight reset

At midnight UTC the tracker logs a final summary then resets all counters:

```
ERROR TRACKER: Midnight UTC reached, resetting error counters
ERROR TRACKER: Error counts today (UTC): Total=47, Details={...}
ERROR TRACKER: Reset all error counters
ERROR TRACKER: Scheduled next error counter reset at 2026-05-04T00:00:00.000Z (in 1440 minutes)
```

### Debug-level messages

At `debug` log level, individual counter increments are also logged:

```
ERROR TRACKER: Adding first error count for PROXY_API/sense1
ERROR TRACKER: Incremented error count for PROXY_API/sense1, new count: 2
ERROR TRACKER: Date changed from 2026-05-03 to 2026-05-04, resetting counters
ERROR TRACKER: Error writing error event to InfluxDB: <message>   ← only on InfluxDB write failure
```

### InfluxDB write failures (non-blocking)

InfluxDB writes are dispatched via `setImmediate` so they never block the error tracking path. Failures are logged at `debug` level only and do not affect in-memory counting or console summary logging.

## Usage Examples

### In Catch Blocks (Qlik Sense API Calls)

```javascript
} catch (err) {
    await globals.errorTracker.incrementError(
        'HEALTH_API',
        serverName,
        { host, module: 'HEALTH_METRICS' },
        err
    );
    logError('HEALTH METRICS: Failed polling server', err);
}
```

### In Catch Blocks (Destination Write Errors)

```javascript
} catch (err) {
    await globals.errorTracker.incrementError(
        'INFLUXDB_V3_WRITE',
        serverName,
        { module: 'HEALTH_METRICS' },
        err
    );
    logError('HEALTH METRICS V3: Error saving health data', err);
}
```

### Via writeToInfluxWithRetry (v2 modules)

```javascript
await writeToInfluxWithRetry(
    () => writePointsToInfluxV2(globals.influx, org, bucket, points),
    `Health metrics from ${serverName}`,
    'v2',
    serverName,
    { module: 'HEALTH_METRICS' }  // metadata passed through to incrementError on failure
);
```

## Grafana Usage Examples

### Rate of errors by type and module (InfluxDB v2 / Flux)

```flux
from(bucket: "mybucket")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "butler_sos_errors")
  |> filter(fn: (r) => r._field == "error_count")
  |> aggregateWindow(every: 5m, fn: sum, createEmpty: false)
  |> group(columns: ["error_type", "module"])
```

### Health check failures per server (InfluxDB v2 / Flux)

```flux
from(bucket: "mybucket")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "butler_sos_errors")
  |> filter(fn: (r) => r.error_type == "HEALTH_API")
  |> filter(fn: (r) => r._field == "error_count")
  |> aggregateWindow(every: 5m, fn: sum, createEmpty: false)
  |> group(columns: ["server_name"])
```

### Errors broken down by category (InfluxDB v2 / Flux)

```flux
from(bucket: "mybucket")
  |> range(start: -24h)
  |> filter(fn: (r) => r._measurement == "butler_sos_errors")
  |> filter(fn: (r) => r._field == "error_count")
  |> group(columns: ["error_category"])
  |> sum()
```

### Remote addresses that caused connection errors (InfluxDB v2 / Flux)

```flux
from(bucket: "mybucket")
  |> range(start: -24h)
  |> filter(fn: (r) => r._measurement == "butler_sos_errors")
  |> filter(fn: (r) => r._field == "remote_address")
  |> group(columns: ["server_name", "error_type"])
  |> last()
```

### Errors with request URL detail (InfluxDB v2 / Flux)

Useful for confirming which endpoint is being called when errors occur:

```flux
from(bucket: "mybucket")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "butler_sos_errors")
  |> filter(fn: (r) => r._field == "request_url")
  |> group(columns: ["error_type", "server_name"])
  |> last()
```

### Total errors by type (InfluxQL / InfluxDB v1)

```sql
SELECT SUM("error_count") FROM "butler_sos_errors"
WHERE time > NOW() - 1h
GROUP BY "error_type", "server_name", "module" FILL(0)
```

### Connection error detail (InfluxQL / InfluxDB v1)

```sql
SELECT "remote_address", "remote_port", "request_url", "error_category"
FROM "butler_sos_errors"
WHERE "error_type" = 'PROXY_API' AND time > NOW() - 1h
ORDER BY time DESC
```

### InfluxDB v3 / SQL

```sql
SELECT error_type, server_name, error_category, error_code,
       remote_address, remote_port, request_url, request_timeout_ms
FROM butler_sos_errors
WHERE time > now() - interval '1 hour'
ORDER BY time DESC
```
