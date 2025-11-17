# UDP Message Queue Handling Improvements

## Overview

Butler SOS receives continuous streams of UDP messages from Qlik Sense Enterprise on Windows (QSEoW) containing log events and user activity information. During high-usage periods or when Sense experiences issues, these message rates can spike significantly, potentially overwhelming Butler SOS and downstream systems.

This document describes the new UDP message queue handling features that provide protection against message flooding, enable better monitoring of message processing, and ensure Butler SOS remains stable under high load conditions.

### Key Features

- **Always-On Message Queuing**: All UDP messages flow through managed queues with configurable concurrency limits
- **Optional Rate Limiting**: Protect against DoS conditions by limiting messages per minute
- **Message Size Validation**: Automatically reject oversized messages
- **Backpressure Detection**: Warnings when queue utilization exceeds thresholds
- **Comprehensive Metrics**: Track queue health, dropped messages, and processing performance
- **InfluxDB Integration**: Store queue metrics for monitoring and alerting

## Architecture

### Message Flow

```
UDP Socket → Size Validation → Rate Limit Check → Input Sanitization → Message Queue → Concurrent Processing → Destinations
                    ↓                  ↓                                      ↓
              Drop (size)      Drop (rate limit)                      Drop (queue full)
```

### Components

1. **UdpQueueManager**: Core class managing queuing, rate limiting, and metrics
2. **Circular Buffer**: Tracks last 1000 processing times for percentile calculations
3. **Rate Limiter**: Fixed-window counter (resets per minute)
4. **Metrics Collector**: Thread-safe counters and timing data
5. **InfluxDB Writer**: Periodic metrics storage (configurable interval)

### Queue Behavior

- Messages are processed with controlled concurrency (default: 10 concurrent)
- Queue has maximum size limit (default: 200 messages)
- When queue is full, messages are dropped using configured strategy (oldest/newest)
- Backpressure warnings trigger at configurable utilization threshold (default: 80%)
- Processing times are tracked in circular buffer for performance analysis

## Configuration Reference

### User Events Queue Configuration

```yaml
Butler-SOS:
    userEvents:
        udpServerConfig:
            serverHost: <IP or FQDN>
            portUserActivityEvents: 9997

            # Message queue settings
            messageQueue:
                maxConcurrent: 10 # Max concurrent message processing
                maxSize: 200 # Max queue size before rejecting
                backpressureThreshold: 80 # Warn at this % utilization

            # Rate limiting (optional)
            rateLimit:
                enable: false # Enable rate limiting
                maxMessagesPerMinute: 600 # ~10 messages/second

            # Message size validation
            maxMessageSize: 65507 # UDP maximum datagram size

            # Queue metrics storage
            queueMetrics:
                influxdb:
                    enable: false # Store metrics in InfluxDB
                    writeFrequency: 20000 # Write interval (ms)
                    measurementName: user_events_queue
                    tags:
                        - name: env
                          value: prod
```

### Log Events Queue Configuration

```yaml
Butler-SOS:
    logEvents:
        udpServerConfig:
            serverHost: <IP or FQDN>
            portLogEvents: 9996

            # Same structure as userEvents.udpServerConfig
            messageQueue:
                maxConcurrent: 10
                maxSize: 200
                backpressureThreshold: 80

            rateLimit:
                enable: false
                maxMessagesPerMinute: 600

            maxMessageSize: 65507

            queueMetrics:
                influxdb:
                    enable: false
                    writeFrequency: 20000
                    measurementName: log_events_queue
                    tags: []
```

### Configuration Properties Explained

#### messageQueue

- **maxConcurrent** (default: 10): Number of messages processed simultaneously. Higher values = more throughput but more CPU/memory usage. Recommended: 5-20 depending on server capacity.

- **maxSize** (default: 200): Maximum queue size. When exceeded, new messages are rejected and dropped. Higher values provide more buffer during spikes but use more memory. Recommended: 100-500. Note: Queue size only counts pending messages (not currently processing), so total capacity is maxSize + maxConcurrent.

- **backpressureThreshold** (default: 80): Queue utilization percentage that triggers warnings. Recommended: 70-90%.

#### rateLimit

- **enable** (default: false): Enable rate limiting to prevent message flooding.

- **maxMessagesPerMinute** (default: 600): Maximum messages allowed per minute (~10/second). Uses fixed-window counter that resets each minute. Recommended values:
    - Light usage: 300 (5/sec)
    - Normal usage: 600 (10/sec)
    - Heavy usage: 1200 (20/sec)

#### maxMessageSize

- **value** (default: 65507): Maximum UDP message size in bytes. The default is the UDP maximum datagram size. Messages exceeding this size are rejected.

#### queueMetrics.influxdb

- **enable** (default: false): Store queue metrics in InfluxDB for monitoring.

- **writeFrequency** (default: 20000): How often to write metrics in milliseconds. Lower values = more frequent updates but more InfluxDB writes.

- **measurementName**: InfluxDB measurement name. Defaults: `user_events_queue` or `log_events_queue`.

- **tags**: Optional tags added to all queue metrics points.

## Breaking Changes

### YAML Configuration Structure

**Breaking Change**: New required sections under `udpServerConfig` for both `userEvents` and `logEvents`:

- `messageQueue` (required)
- `rateLimit` (required)
- `maxMessageSize` (required)
- `queueMetrics` (required)

**Impact**: Existing Butler SOS v13.x configuration files will fail validation without these new sections.

### Migration Guide

1. **Backup your current config file**:

    ```bash
    cp config/production.yaml config/production.yaml.backup
    ```

2. **Add new sections** to your config file under both `userEvents.udpServerConfig` and `logEvents.udpServerConfig`:

    ```yaml
    # Add to userEvents.udpServerConfig:
    messageQueue:
        maxConcurrent: 10
        maxSize: 200
        backpressureThreshold: 80
    rateLimit:
        enable: false
        maxMessagesPerMinute: 600
    maxMessageSize: 65507
    queueMetrics:
        influxdb:
            enable: false
            writeFrequency: 20000
            measurementName: user_events_queue
            tags: []
    # Add same structure to logEvents.udpServerConfig with measurementName: log_events_queue
    ```

3. **Validate your config**:

    ```bash
    node src/butler-sos.js --configfile config/production.yaml --check-config
    ```

4. **Test with defaults first**: The default values are conservative and safe for most environments. Adjust after monitoring queue metrics.

### Default Behavior

- **Queues are always enabled**: Cannot be disabled, ensures message processing stability
- **Rate limiting is disabled**: Must be explicitly enabled if needed
- **Queue metrics storage is disabled**: Must be explicitly enabled to store metrics in InfluxDB
- **All messages flow through queues**: Even with rate limiting disabled, messages are queued and processed with controlled concurrency

## InfluxDB Queue Metrics Schema

### Measurements

Two separate measurements for the two UDP servers:

- `user_events_queue` (configurable via `userEvents.udpServerConfig.queueMetrics.influxdb.measurementName`)
- `log_events_queue` (configurable via `logEvents.udpServerConfig.queueMetrics.influxdb.measurementName`)

### Tags

| Tag          | Type   | Description              | Example                     |
| ------------ | ------ | ------------------------ | --------------------------- |
| `queue_type` | string | Queue identifier         | `user_events`, `log_events` |
| `host`       | string | Butler SOS hostname      | `butler-sos-prod`           |
| Custom tags  | string | From config `tags` array | `env=prod`                  |

### Fields

#### Queue Status Fields

| Field                   | Type    | Description                          |
| ----------------------- | ------- | ------------------------------------ |
| `queue_size`            | integer | Current number of messages in queue  |
| `queue_max_size`        | integer | Maximum queue capacity               |
| `queue_utilization_pct` | float   | Queue utilization percentage (0-100) |
| `queue_pending`         | integer | Messages currently being processed   |

#### Message Counter Fields

| Field                | Type    | Description                                |
| -------------------- | ------- | ------------------------------------------ |
| `messages_received`  | integer | Total messages received (since last write) |
| `messages_queued`    | integer | Messages added to queue                    |
| `messages_processed` | integer | Messages successfully processed            |
| `messages_failed`    | integer | Messages that failed processing            |

#### Dropped Message Fields

| Field                         | Type    | Description                    |
| ----------------------------- | ------- | ------------------------------ |
| `messages_dropped_total`      | integer | Total dropped messages         |
| `messages_dropped_rate_limit` | integer | Dropped due to rate limit      |
| `messages_dropped_queue_full` | integer | Dropped due to full queue      |
| `messages_dropped_size`       | integer | Dropped due to size validation |

#### Performance Fields

| Field                    | Type  | Description                            |
| ------------------------ | ----- | -------------------------------------- |
| `processing_time_avg_ms` | float | Average processing time (milliseconds) |
| `processing_time_p95_ms` | float | 95th percentile processing time        |
| `processing_time_max_ms` | float | Maximum processing time                |

#### Rate Limit Fields

| Field                 | Type    | Description                                |
| --------------------- | ------- | ------------------------------------------ |
| `rate_limit_current`  | integer | Current message rate (messages/minute)     |
| `backpressure_active` | integer | Backpressure status (0=inactive, 1=active) |

### Example Grafana Queries

**Queue Utilization Over Time**:

```flux
from(bucket: "butler-sos")
  |> range(start: -1h)
  |> filter(fn: (r) => r["_measurement"] == "user_events_queue" or r["_measurement"] == "log_events_queue")
  |> filter(fn: (r) => r["_field"] == "queue_utilization_pct")
```

**Messages Dropped by Reason**:

```flux
from(bucket: "butler-sos")
  |> range(start: -1h)
  |> filter(fn: (r) => r["_measurement"] == "user_events_queue")
  |> filter(fn: (r) => r["_field"] =~ /messages_dropped_/)
  |> aggregateWindow(every: 1m, fn: sum)
```

**Processing Time Percentiles**:

```flux
from(bucket: "butler-sos")
  |> range(start: -1h)
  |> filter(fn: (r) => r["_measurement"] == "log_events_queue")
  |> filter(fn: (r) => r["_field"] == "processing_time_p95_ms" or r["_field"] == "processing_time_avg_ms")
```

**Backpressure Events**:

```flux
from(bucket: "butler-sos")
  |> range(start: -24h)
  |> filter(fn: (r) => r["_field"] == "backpressure_active")
  |> filter(fn: (r) => r["_value"] == 1)
```

## Performance Tuning

### Sizing Guidelines

#### Small Environment (< 50 users, < 10 apps)

```yaml
messageQueue:
    maxConcurrent: 5
    maxSize: 100
rateLimit:
    enable: false
```

#### Medium Environment (50-200 users, 10-50 apps)

```yaml
messageQueue:
    maxConcurrent: 10
    maxSize: 200
rateLimit:
    enable: false # Enable if experiencing issues
    maxMessagesPerMinute: 600
```

#### Large Environment (200+ users, 50+ apps)

```yaml
messageQueue:
    maxConcurrent: 20
    maxSize: 500
rateLimit:
    enable: true
    maxMessagesPerMinute: 1200
```

### Tuning Based on Metrics

Monitor these metrics to adjust configuration:

1. **High Queue Utilization** (consistently > 80%):
    - Increase `maxConcurrent` (more parallel processing)
    - Increase `maxSize` (more buffer capacity)
    - Check if downstream systems (InfluxDB, MQTT) are bottleneck

2. **Frequent Dropped Messages** (`messages_dropped_queue_full` > 0):
    - Increase `maxSize`
    - Increase `maxConcurrent`
    - Consider enabling rate limiting at Sense side

3. **High Processing Times** (p95 > 1000ms):
    - Decrease `maxConcurrent` (reduce resource contention)
    - Check downstream system performance
    - Review network latency

4. **Rate Limit Violations** (`messages_dropped_rate_limit` > 0):
    - Increase `maxMessagesPerMinute` if capacity allows
    - Investigate why Sense is sending excessive messages
    - Consider this normal during high-activity periods

### Resource Considerations

**Memory Usage**:

- Each queued message: ~1-5 KB
- `maxSize: 200` ≈ 200-1000 KB per queue
- Two queues (user + log events) ≈ 400-2000 KB total
- Circular buffer: ~50 KB per queue

**CPU Usage**:

- Higher `maxConcurrent` = more CPU cores utilized
- Recommended: Set `maxConcurrent` ≤ number of CPU cores
- Rate limiting has minimal CPU overhead

**InfluxDB Load**:

- Each queue writes metrics at `writeFrequency` interval
- Default 20 seconds = 3 writes/minute per queue = 6 writes/minute total
- Consider increasing interval if InfluxDB is under load

## SEA (Single Executable Application) Compatibility

The `p-queue` package (v8.0.1) used for message queuing is fully compatible with Node.js Single Executable Applications (SEA). Butler SOS can be packaged as a standalone executable without issues.

### Verified Compatibility

- ✅ p-queue v8.0.1 works with Node.js SEA
- ✅ All queue manager features functional in SEA mode
- ✅ No dynamic imports or eval() usage
- ✅ No native dependencies beyond Node.js built-ins

## Troubleshooting

### Issue: Backpressure Warnings

**Symptom**: Log messages like:

```
WARN: [UDP Queue] Backpressure detected for user_events: Queue utilization 85.5% (threshold: 80%)
```

**Causes**:

- Message rate exceeds processing capacity
- Downstream systems (InfluxDB/MQTT) slow to respond
- Insufficient `maxConcurrent` setting

**Solutions**:

1. Monitor queue metrics to identify pattern
2. Increase `maxConcurrent` if CPU/memory available
3. Increase `maxSize` for more buffer capacity
4. Check downstream system performance
5. Enable rate limiting if messages coming too fast

### Issue: Messages Being Dropped

**Symptom**: `messages_dropped_*` counters increasing

**Dropped due to queue full** (`messages_dropped_queue_full`):

- Queue size too small for message bursts
- Increase `maxSize`
- Increase `maxConcurrent` for faster processing

**Dropped due to rate limit** (`messages_dropped_rate_limit`):

- Rate limit too restrictive
- Increase `maxMessagesPerMinute`
- Disable rate limiting if appropriate
- Investigate why Sense is sending so many messages

**Dropped due to size** (`messages_dropped_size`):

- Messages exceed UDP datagram size
- Usually indicates malformed messages from Sense
- Check Sense log appender configuration

### Issue: High Processing Times

**Symptom**: `processing_time_p95_ms` > 1000ms

**Causes**:

- Downstream systems slow (InfluxDB write latency, MQTT broker delays)
- Network latency
- Too many concurrent operations causing resource contention

**Solutions**:

1. Check InfluxDB query performance
2. Check MQTT broker responsiveness
3. Reduce `maxConcurrent` to decrease resource contention
4. Review network latency between Butler SOS and destinations

### Issue: Config Validation Errors

**Symptom**: Butler SOS fails to start with config validation errors

**Cause**: Missing required queue configuration sections

**Solution**: Follow migration guide above to add all required sections to config file

### Issue: No Queue Metrics in InfluxDB

**Symptom**: Queue metrics not appearing in InfluxDB

**Checklist**:

1. ✅ `queueMetrics.influxdb.enable: true` in config?
2. ✅ `Butler-SOS.influxdbConfig.enable: true`?
3. ✅ InfluxDB connection working (check logs)?
4. ✅ Correct measurement name configured?
5. ✅ Wait for `writeFrequency` interval to elapse

### Debug Logging

Enable verbose logging to troubleshoot queue issues:

```yaml
Butler-SOS:
    logLevel: verbose # or 'debug' for even more detail
```

Look for log messages with these prefixes:

- `[UDP Queue]` - Queue operations and status
- `UDP QUEUE METRICS INFLUXDB` - Metrics storage operations
- `USER EVENT QUEUE METRICS` / `LOG EVENT QUEUE METRICS` - Per-queue status

## Monitoring Best Practices

### Essential Alerts

1. **Queue Full Alert**: Trigger when `queue_utilization_pct > 90` for >5 minutes
2. **Dropped Messages Alert**: Trigger when `messages_dropped_total > 100` per minute
3. **Backpressure Alert**: Trigger when `backpressure_active = 1` for >10 minutes
4. **Processing Degradation**: Trigger when `processing_time_p95_ms > 2000`

### Recommended Dashboard Panels

1. Queue utilization percentage (line chart, both queues)
2. Messages received vs processed (line chart)
3. Dropped messages by reason (stacked area chart)
4. Processing time percentiles (line chart: avg, p95, max)
5. Backpressure status (state timeline)
6. Current queue size (gauge)

### Proactive Monitoring

- Review queue metrics weekly during normal operations
- Establish baseline processing times for your environment
- Set alerts based on your baseline + margin
- Test queue behavior during peak usage periods
- Adjust thresholds after observing patterns

## Additional Resources

- [Butler SOS Documentation](https://butler-sos.ptarmiganlabs.com/)
- [QSEoW Log Appender Configuration](https://help.qlik.com/en-US/sense/Subsystems/Hub/Content/Sense_Hub/Introduction/configure-log-appender.htm)
- [InfluxDB Best Practices](https://docs.influxdata.com/influxdb/v2.0/write-data/best-practices/)
- [Grafana Dashboard Creation](https://grafana.com/docs/grafana/latest/dashboards/)

## Support

For issues, questions, or feature requests related to UDP queue handling:

- GitHub Issues: https://github.com/ptarmiganlabs/butler-sos/issues
- Discussion Forum: https://github.com/ptarmiganlabs/butler-sos/discussions
- Email: info@ptarmiganlabs.com
