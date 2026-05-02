# Track Failed Polls from Qlik Sense Servers

## Overview

Butler SOS periodically polls Qlik Sense servers via three API endpoints:

| API | Module | Frequency |
|-----|--------|-----------|
| Engine health check (`/engine/healthcheck`) | `healthmetrics.js` | `serversToMonitor.pollingInterval` |
| Proxy user sessions (`/qps/<vp>/session`) | `proxysessionmetrics.js` | `userSessions.pollingInterval` |
| App name extraction (QRS `/app`) | `appnamesextract.js` | `appNames.extractInterval` |

When any of these polls fail (due to network timeouts, server overload, certificate issues, etc.) Butler SOS now tracks the failure as a time-series data point in InfluxDB. This enables monitoring dashboards to detect trends in API reliability and be alerted when Qlik Sense becomes unreachable.

---

## How It Works

1. **Error detection**: When a poll throws an error, the existing `catch` block in each module calls `globals.errorTracker.incrementError(...)` (cumulative counter, unaffected by this feature) **and** now also calls `postFailedPollToInfluxdb(failedPollData)`.

2. **InfluxDB routing**: `postFailedPollToInfluxdb` in `src/lib/influxdb/error-metrics.js` checks whether:
   - `Butler-SOS.influxdbConfig.enable` is `true`
   - `Butler-SOS.influxdbConfig.failedPollsTracking.enable` is `true`

   If both conditions are met, it routes to the appropriate version-specific implementation (`v1/`, `v2/`, `v3/`).

3. **Data point written**: One data point is written to InfluxDB per failed poll event.

---

## Data Model

| Element | Value |
|---------|-------|
| Measurement | Configurable via `measurementName` (default: `sense_failed_polls`) |
| Tag: `host` | Hostname/IP of the Qlik Sense server (e.g. `sense1.company.com:4747`) |
| Tag: `server_name` | Configured server name (e.g. `Sense1`) |
| Tag: `error_type` | One of: `HEALTH_API`, `PROXY_API`, `APP_NAMES_EXTRACT` |
| Tag: `virtual_proxy` | Virtual proxy prefix (only present for `PROXY_API` errors) |
| Field: `error_count` | Integer, always `1` per event |

Example InfluxDB line protocol entry:
```
sense_failed_polls,host=sense1.company.com:4747,server_name=Sense1,error_type=HEALTH_API error_count=1i
```

---

## Configuration

Add the following section to the `influxdbConfig` block in your Butler SOS YAML config file:

```yaml
Butler-SOS:
  influxdbConfig:
    enable: true
    # ... existing host/port/version/etc. settings ...

    failedPollsTracking:
      enable: true                        # Set to false to disable this feature
      measurementName: sense_failed_polls # InfluxDB measurement name for failed poll events
```

The feature is **per-InfluxDB-version** — it works with InfluxDB v1, v2, and v3.

---

## Files Changed

### New files

| File | Description |
|------|-------------|
| `src/lib/influxdb/v1/failed-polls.js` | Writes a failed-poll data point to InfluxDB v1 |
| `src/lib/influxdb/v2/failed-polls.js` | Writes a failed-poll data point to InfluxDB v2 |
| `src/lib/influxdb/v3/failed-polls.js` | Writes a failed-poll data point to InfluxDB v3 |
| `src/lib/influxdb/__tests__/v1-failed-polls.test.js` | Unit tests for v1 implementation |
| `src/lib/influxdb/__tests__/v2-failed-polls.test.js` | Unit tests for v2 implementation |
| `src/lib/influxdb/__tests__/v3-failed-polls.test.js` | Unit tests for v3 implementation |

### Modified files

| File | Change |
|------|--------|
| `src/lib/influxdb/error-metrics.js` | Implemented `postFailedPollToInfluxdb` routing function; `postErrorMetricsToInfluxdb` kept as no-op |
| `src/lib/influxdb/__tests__/error-metrics.test.js` | Added tests for `postFailedPollToInfluxdb` routing |
| `src/lib/healthmetrics.js` | Calls `postFailedPollToInfluxdb` when health check poll fails |
| `src/lib/proxysessionmetrics.js` | Calls `postFailedPollToInfluxdb` when proxy session poll fails |
| `src/lib/appnamesextract.js` | Calls `postFailedPollToInfluxdb` when app name extraction fails |
| `src/lib/config-schemas/destinations.js` | Added `failedPollsTracking` to `influxdbConfig` schema |
| `src/config/production_template.yaml` | Added `failedPollsTracking` config example |
| `src/lib/__tests__/healthmetrics.test.js` | Added mock for new `error-metrics.js` import |
| `src/lib/__tests__/proxysessionmetrics.test.js` | Added mock for new `error-metrics.js` import |

---

## Grafana Usage Examples

### Rate of health check failures per server (InfluxDB v2 / Flux)

```flux
from(bucket: "mybucket")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "sense_failed_polls")
  |> filter(fn: (r) => r.error_type == "HEALTH_API")
  |> filter(fn: (r) => r._field == "error_count")
  |> aggregateWindow(every: 5m, fn: sum, createEmpty: false)
  |> group(columns: ["server_name"])
```

### Total failed polls by type (InfluxQL / InfluxDB v1)

```sql
SELECT SUM("error_count") FROM "sense_failed_polls"
WHERE time > NOW() - 1h
GROUP BY "error_type", "server_name" FILL(0)
```

---

## Testing

Unit tests are located alongside the production code:

```
src/lib/influxdb/__tests__/v1-failed-polls.test.js   (100% coverage)
src/lib/influxdb/__tests__/v2-failed-polls.test.js   (100% coverage)
src/lib/influxdb/__tests__/v3-failed-polls.test.js   (100% coverage)
src/lib/influxdb/__tests__/error-metrics.test.js     (routing + legacy no-op tests)
```

Each test file covers:
- Early return when InfluxDB is disabled
- Early return when `failedPollsTracking.enable` is `false`
- Early return when the config key is missing
- Correct measurement name, tags, and fields for `HEALTH_API`, `PROXY_API`, and `APP_NAMES_EXTRACT` error types
- `virtual_proxy` tag is included only for `PROXY_API` errors
- Custom measurement names
- Error resilience (no throw when the InfluxDB write itself fails)

Run with:
```bash
npm run test
```
