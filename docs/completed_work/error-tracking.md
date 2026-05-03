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

| Element | Value |
|---------|-------|
| Measurement | Configurable via `errorTracking.influxdb.measurementName` (default: `butler_sos_errors`) |
| Tag: `error_type` | One of the error type codes listed above |
| Tag: `server_name` | Configured Qlik Sense server name (empty string if not applicable) |
| Tag: `host` | Hostname/IP of the Qlik Sense server or MQTT broker where the error occurred (present when provided) |
| Tag: `virtual_proxy` | Virtual proxy prefix (present for `PROXY_API` and `PROXY_SESSIONS_MQTT` errors) |
| Tag: `destination_host` | Target URL/host for outbound write failures (InfluxDB, New Relic, etc.) |
| Tag: `module` | Butler SOS subsystem that generated the error (see Module Context Values above) |
| Field: `error_count` | Integer, always `1` per event |
| Field: `error_category` | String derived from the error object (e.g. `timeout`, `connection_refused`, `auth_error`, `http_error`, `unknown`) |

Example InfluxDB line protocol entries:

```text
# Health API failure for a Qlik Sense server
butler_sos_errors,error_type=HEALTH_API,server_name=Sense1,host=sense1.example.com:4747,module=HEALTH_METRICS error_count=1i,error_category="connection_refused"

# InfluxDB v1 write failure
butler_sos_errors,error_type=INFLUXDB_V1_WRITE,server_name=Sense1,module=HEALTH_METRICS error_count=1i,error_category="timeout"

# MQTT publish failure
butler_sos_errors,error_type=MQTT_PUBLISH,server_name=Sense1,host=mqtt.example.com,module=HEALTH_METRICS_MQTT error_count=1i,error_category="connection_refused"

# UDP event processing failure
butler_sos_errors,error_type=UDP_USER_EVENT,server_name=,module=UDP_USER_EVENTS error_count=1i,error_category="unknown"
```

## Error Categorization

The `error_category` field is derived by `error-categorizer.js` from the original `Error` object. Categories are:

| Category | Condition |
|---|---|
| `timeout` | ETIMEDOUT, ESOCKETTIMEDOUT, request timed out |
| `connection_refused` | ECONNREFUSED |
| `connection_reset` | ECONNRESET |
| `not_found` | ENOTFOUND, 404 HTTP |
| `auth_error` | 401, 403 HTTP |
| `rate_limit` | 429 HTTP |
| `server_error` | 5xx HTTP |
| `http_error` | Other HTTP error codes |
| `unknown` | No `err` object passed, or unrecognized error |

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

## Migration from Legacy `failedPollsTracking`

The previous `influxdbConfig.failedPollsTracking` config has been consolidated into `errorTracking`. The new system:

- **Tracks ALL error types** (not just Qlik Sense API polls)
- **Uses a single `incrementError()` call** with metadata and error object support
- **Provides consistent error tracking** across all Butler SOS operations

### Config Migration

**Old config:**

```yaml
Butler-SOS:
  influxdbConfig:
    failedPollsTracking:
      enable: true
      measurementName: sense_failed_polls
```

**New config:**

```yaml
Butler-SOS:
  errorTracking:
    enable: true
    influxdb:
      enable: true
      measurementName: butler_sos_errors
```

## Grafana Usage Examples

### Rate of errors by module (InfluxDB v2 / Flux)

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

### Errors by category (InfluxDB v2 / Flux)

```flux
from(bucket: "mybucket")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "butler_sos_errors")
  |> filter(fn: (r) => r._field == "error_category")
  |> group(columns: ["error_category"])
  |> count()
```

### Total errors by type (InfluxQL / InfluxDB v1)

```sql
SELECT SUM("error_count") FROM "butler_sos_errors"
WHERE time > NOW() - 1h
GROUP BY "error_type", "server_name", "module" FILL(0)
```

## Testing

Unit tests for the ErrorTracker are located at:

- `src/lib/__tests__/error-tracker.test.js` - Core ErrorTracker functionality

Run tests with:

```bash
npm run test
```
