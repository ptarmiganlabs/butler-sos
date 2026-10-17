# Error Tracking: Failed Error-Event Writes and the Running Error Summary

Butler SOS counts the errors it runs into: failed calls to Qlik Sense APIs, and failed
writes to destinations such as InfluxDB. If `Butler-SOS.errorTracking.influxdb.enable` is
`true`, each error is also written to InfluxDB as an **error event**: one data point in the
`butler_sos_errors` measurement, or whatever name `measurementName` is set to.

This page describes two changes to error tracking:

- what happens when an error event itself cannot be written to InfluxDB
- how often the running error summary is written to the Butler SOS log

Neither change adds or renames a configuration setting.

---

## Failed error-event writes are no longer tracked as new errors

### The problem this fixes

Writing an error event to InfluxDB can fail just like any other InfluxDB write. This is
most likely when InfluxDB is down or unreachable, or when it rejects the error-event data,
for example because of a permissions problem, a missing bucket or database, or a field type
conflict in the error measurement.

Before this fix, such a failure was counted as a new InfluxDB write error. Counting it
started another error-event write, which failed in the same way and was counted again.
Each failed write could start several more, so the number of writes grew very quickly.
Symptoms included:

- the log filling up with `INFLUXDB ... WRITE`, `RETRY` and `BATCH` warnings and errors
  whose message contains `Error event:`
- climbing CPU and memory use by the Butler SOS process, which could end with the process
  running out of memory
- InfluxDB write error counts that kept growing long after the original problem

Error events are written to InfluxDB by default (`influxdb.enable: true` in the
configuration file template), so this could affect any installation that uses InfluxDB.

### What happens now

When an error event cannot be written to InfluxDB:

- the failure is still logged, so you can see it and act on it
- it is **not** counted as a new error, and **no** new error event is written for it

Failures of ordinary data writes (health metrics, user sessions, user and log events,
queue metrics and so on) are tracked exactly as before. They are counted, included in the
error summary, and written to InfluxDB as error events.

As a result, the `INFLUXDB_V1_WRITE`, `INFLUXDB_V2_WRITE` and `INFLUXDB_V3_WRITE` error
counts now cover failed **data** writes only. Failed error-event writes are no longer
included.

### What you will see in the log

A failed error-event write is easy to recognise: the message contains `Error event:`
followed by the error type and server name of the error that was being recorded. For
example, an InfluxDB v2 server rejecting the error event for a failed health check:

```
warn: INFLUXDB V2 WRITE: Error event: HEALTH_API/sense1 (chunk 1/1, points 0-0) - Non-retryable error (HttpError), not retrying: ...
error: INFLUXDB V2 BATCH: Error event: HEALTH_API/sense1 - Chunk 1 of 1 (points 0-0) failed: ...
```

If InfluxDB cannot be reached at all, Butler SOS retries the write a few times before
giving up:

```
warn: INFLUXDB V2 RETRY: Error event: HEALTH_API/sense1 (chunk 1/1, points 0-0) - Retryable error (Error) on attempt 1/4, retrying in 1000ms...
error: INFLUXDB V2 RETRY: Error event: HEALTH_API/sense1 (chunk 1/1, points 0-0) - All 4 attempts failed. Last error: connect ECONNREFUSED ...
```

A single failed error event can produce several such lines. That number is fixed; it no
longer grows over time.

As an extra safeguard, Butler SOS never starts a new error-event write from inside
another one. If that safeguard is ever triggered, this message is logged at `debug` level:

```
debug: ERROR TRACKER: Not writing error event INFLUXDB_V2_WRITE/sense1 to InfluxDB, as it was raised while writing another error event
```

The error is still counted in that case. It is just not written to InfluxDB.

### What to do if you see these messages

The messages mean Butler SOS cannot store error events in InfluxDB. Check that:

- InfluxDB is running and reachable from the Butler SOS server
- the database (InfluxDB v1 and v3) or the organisation and bucket (InfluxDB v2) set in
  `Butler-SOS.influxdbConfig` exist
- the credentials Butler SOS uses are allowed to write to them

If you do not need error events in InfluxDB, turn them off:

```yaml
Butler-SOS:
    errorTracking:
        influxdb:
            enable: false
```

---

## The running error summary is now logged at most once a minute

### Before

With `Butler-SOS.errorTracking.logSummary.enable: true`, Butler SOS wrote a summary of
the day's error counts to the log **every time an error occurred**. During an outage this
could mean many identical-looking lines per second, each one longer than the last.

### Now

The summary has the same format as before:

```
info: ERROR TRACKER: Error counts today (UTC): Total=3, Details={"PROXY_API":{"total":2,"servers":{"sense1":2}},"HEALTH_API":{"total":1,"servers":{"sense1":1}}}
```

It is now written:

- **at once** for the first error after a quiet minute, so a new problem shows up in the
  log straight away
- **at most once a minute** while errors keep occurring. Errors that occur in between are
  counted, and the next summary line includes them. When errors stop, one last running
  summary is written once the minute is up, provided Butler SOS is still running then.
- **once at midnight UTC**, as the final summary for the day, just before the counters are
  reset. It includes every error counted that day, including any that were still waiting
  for a running summary line.

The first error after midnight is logged at once, as the first error of the new day.

Midnight works the same way when Butler SOS is busy at that moment. If an error arrives in
the first moments after midnight, before the midnight reset has run, that error triggers
the previous day's final summary and the reset, and is then counted as the new day's first
error. Either way, each day's final summary is logged exactly once, and it contains only
that day's errors.

> **Note:** If Butler SOS stops or restarts less than a minute after the last running
> summary line (for example a service restart, `docker stop`, or an exit after a crash),
> the errors counted since that line do not appear in a summary line. The counts are kept
> in memory only, so a restart also starts them from zero, as it always has. The warnings
> and errors logged when each failure happened are not affected.

The `Details` part is grouped by error type, then by server. Errors that have no server
context are counted under `_no_server_context`.

### `logSummary.enable: false` now also turns off the midnight summary

Before this change, the midnight summary was logged even when `logSummary.enable` was
`false`. Now `logSummary.enable` controls all summary lines. When it is `false`, no summary
is logged at any time. The counters are still kept and still reset at midnight UTC, and
error events are still written to InfluxDB if that is enabled.

### Configuration

The setting itself is unchanged. Only its description in the configuration file template
has been updated:

```yaml
Butler-SOS:
    errorTracking:
        enable: true # Master switch for error tracking
        logSummary:
            enable: true # Log error counts to console: running totals at most once a minute while errors occur, and a final daily summary at midnight UTC
        influxdb:
            enable: true # Write individual error events to InfluxDB
            measurementName: butler_sos_errors # Name of InfluxDB measurement for error events
```

| Key | Default | Description |
|-----|---------|-------------|
| `logSummary.enable` | `true` | Log the running error totals (at most once a minute while errors occur) and a final daily summary at midnight UTC. When `false`, no summary is logged. |

---

## Upgrading

No action is needed. Existing configuration files keep working without changes.

If you had `logSummary.enable: false` but relied on the midnight summary, set it to `true`
to get the midnight summary back. You will then also get the running summary, at most once
a minute.
