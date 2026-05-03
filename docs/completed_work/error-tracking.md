# Error Tracking in Butler SOS

## Overview

Butler SOS tracks errors that occur when communicating with Qlik Sense servers and when writing data to destination systems (InfluxDB, MQTT, New Relic).

The `ErrorTracker` class provides a single, unified mechanism for:
- **In-memory cumulative error counting** with daily UTC reset
- **Optional InfluxDB time-series logging** of individual error events  
- **Console summary logging** (optional) at midnight UTC

## How It Works

1. **Error detection**: When any operation fails, catch blocks call:
   ```javascript
   globals.errorTracker.incrementError(apiType, serverName, metadata)
   ```

2. **In-memory tracking**: The ErrorTracker increments its counter and maintains error statistics grouped by API type and server.

3. **Daily summary**: At midnight UTC, the tracker logs a summary and resets counters (if `logSummary.enable` is true).

4. **InfluxDB write (optional)**: If `errorTracking.influxdb.enable` is true, each error generates a single data point in InfluxDB with tags identifying the error type, host, server, and any additional context.

## Configuration

```yaml
Butler-SOS:
  errorTracking:
    enable: true                          # Master switch for error tracking
    logSummary:
      enable: true                        # Log daily error summary to console
    influxdb:
      enable: true                        # Write errors to InfluxDB
      measurementName: sense_errors         # InfluxDB measurement name
```

## Error Types

| Error Type | Description | Source Module |
|------------|-------------|---------------|
| `HEALTH_API` | Health check API failures | `healthmetrics.js` |
| `PROXY_API` | Proxy session API failures | `proxysessionmetrics.js` |
| `APP_NAMES_EXTRACT` | App name extraction failures | `appnamesextract.js` |
| `INFLUXDB_V1_WRITE` | InfluxDB v1 write failures | `influxdb/v1/*.js` |
| `INFLUXDB_V2_WRITE` | InfluxDB v2 write failures | `influxdb/v2/*.js` |
| `INFLUXDB_V3_WRITE` | InfluxDB v3 write failures | `influxdb/v3/*.js` |
| `MQTT_PUBLISH` | MQTT publish failures | `post-to-mqtt.js` |
| `NEW_RELIC_POST` | New Relic post failures | `post-to-new-relic.js` |

## InfluxDB Data Model

| Element | Value |
|---------|-------|
| Measurement | Configurable via `errorTracking.influxdb.measurementName` (default: `sense_errors`) |
| Tag: `error_type` | One of the error types listed above |
| Tag: `host` | Hostname/IP of the server where error occurred |
| Tag: `server_name` | Configured server name |
| Tag: `virtual_proxy` | Virtual proxy prefix (only present for `PROXY_API` errors) |
| Field: `error_count` | Integer, always `1` per event |

Example InfluxDB line protocol entry:
```
sense_errors,host=sense1.example.com:4747,server_name=Sense1,error_type=HEALTH_API error_count=1i
```

## Usage Examples

### In Catch Blocks (Qlik Sense API Calls)

**Single call pattern:**
```javascript
} catch (err) {
    globals.errorTracker.incrementError('HEALTH_API', serverName, { host });
    logError(...);
}
```

### In Catch Blocks (Destination Write Errors)

```javascript
} catch (err) {
    globals.errorTracker.incrementError('INFLUXDB_V3_WRITE', '', {
        destinationHost: 'influxdb.example.com'
    });
    logError(...);
}
```

## Migration from Legacy `failedPollsTracking`

The previous `influxdbConfig.failedPollsTracking` config has been consolidated into `errorTracking`. The new system:

- **Tracks ALL error types** (not just Qlik Sense API polls)
- **Uses a single `incrementError()` call** with metadata support
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
      measurementName: sense_errors
```

## Files Changed

### Core Changes

| File | Change |
|------|--------|
| `src/lib/error-tracker.js` | Enhanced with InfluxDB write capability, added metadata parameter to `incrementError()` |
| `src/lib/config-schemas/destinations.js` | Added `errorTracking` schema, removed `failedPollsTracking` |
| `src/config/production_template.yaml` | Added `errorTracking` config section, removed `failedPollsTracking` |

### Removed Files

| File | Reason |
|------|--------|
| `src/lib/influxdb/v1/failed-polls.js` | Functionality moved to ErrorTracker |
| `src/lib/influxdb/v2/failed-polls.js` | Functionality moved to ErrorTracker |
| `src/lib/influxdb/v3/failed-polls.js` | Functionality moved to ErrorTracker |

### Modified Call Sites

| File | Change |
|------|--------|
| `src/lib/healthmetrics.js` | Single `incrementError()` call with metadata |
| `src/lib/proxysessionmetrics.js` | Single `incrementError()` call with metadata |
| `src/lib/appnamesextract.js` | Single `incrementError()` call with metadata |
| `src/lib/influxdb/error-metrics.js` | Deleted - ErrorTracker handles all InfluxDB writes directly |

## Grafana Usage Examples

### Rate of health check failures per server (InfluxDB v2 / Flux)

```flux
from(bucket: "mybucket")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "sense_errors")
  |> filter(fn: (r) => r.error_type == "HEALTH_API")
  |> filter(fn: (r) => r._field == "error_count")
  |> aggregateWindow(every: 5m, fn: sum, createEmpty: false)
  |> group(columns: ["server_name"])
```

### Total errors by type (InfluxQL / InfluxDB v1)

```sql
SELECT SUM("error_count") FROM "sense_errors"
WHERE time > NOW() - 1h
GROUP BY "error_type", "server_name" FILL(0)
```

## Testing

Unit tests for the ErrorTracker are located at:
- `src/lib/__tests__/error-tracker.test.js` - Core ErrorTracker functionality

Run tests with:
```bash
npm run test
```
