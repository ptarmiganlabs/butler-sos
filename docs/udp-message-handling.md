# UDP Message Handling

Butler SOS receives UDP messages from Qlik Sense Enterprise on Windows (QSEoW) for two types of events:

1. **User Events**: Session start/stop and connection open/close events from the Qlik Sense Proxy service
2. **Log Events**: Warnings, errors, and performance metrics from various Qlik Sense services (Engine, Proxy, Repository, Scheduler)

## Message Queue and Rate Limiting

To handle high-volume scenarios and prevent resource exhaustion, Butler SOS implements robust UDP message handling with:

### Message Queuing

UDP messages are queued with configurable concurrency limits. This prevents overwhelming Butler SOS and downstream services during traffic spikes.

**Configuration:**
```yaml
Butler-SOS:
  userEvents:
    udpServerConfig:
      messageQueue:
        maxConcurrent: 5      # Max messages processing simultaneously
        maxSize: 100          # Max queued messages before dropping
        dropStrategy: oldest  # Drop 'oldest' or 'newest' when full
```

**How it works:**
- Messages are processed with a maximum of `maxConcurrent` operations at once
- Additional messages are queued up to `maxSize`
- When the queue is full, incoming messages are dropped (current implementation drops the incoming message; the `dropStrategy` setting is validated but not yet fully implemented due to limitations of the underlying p-queue library)
- Dropped messages are logged and counted in metrics

**Note on dropStrategy:** Due to the architecture of the p-queue library, the full oldest/newest drop strategy is not currently implemented. When the queue is full, the current incoming message is dropped. The `dropStrategy` configuration is validated and logged for future enhancement when a custom queue implementation can be used.

### Rate Limiting

Rate limiting prevents message flooding from overwhelming Butler SOS.

**Configuration:**
```yaml
Butler-SOS:
  userEvents:
    udpServerConfig:
      rateLimit:
        enable: true                  # Enable rate limiting
        maxMessagesPerMinute: 300     # Max messages per minute (~5/sec)
        violationLogThrottle: 60      # Log violations once per N seconds
```

**How it works:**
- Butler SOS tracks messages received per minute
- Messages exceeding the limit are immediately dropped
- Rate limit violations are logged (throttled to prevent log spam)
- Dropped messages are counted in metrics

### Message Size Validation

Messages exceeding the maximum UDP datagram size are rejected.

**Configuration:**
```yaml
Butler-SOS:
  userEvents:
    udpServerConfig:
      maxMessageSize: 65507  # Max UDP datagram size in bytes
```

**How it works:**
- Messages larger than `maxMessageSize` are dropped
- Oversized messages are logged with their size
- This prevents issues with malformed or attack messages

### Backpressure Detection

Butler SOS monitors queue utilization and warns when approaching capacity.

**Configuration:**
```yaml
Butler-SOS:
  userEvents:
    udpServerConfig:
      backpressure:
        threshold: 80  # Warning at N% queue utilization
```

**How it works:**
- Queue utilization is calculated as `(current_size / max_size) * 100`
- When utilization exceeds `threshold`, a warning is logged
- When utilization drops below `threshold`, an info message is logged
- This helps identify capacity issues before message loss occurs

## Metrics and Monitoring

UDP message handling metrics are automatically stored to InfluxDB (when InfluxDB and event counting are enabled).

### Metrics Available

The following metrics are tracked for both user events and log events queues:

#### Queue Status
- `queue_size`: Current number of messages in queue
- `queue_max_size`: Maximum queue capacity
- `queue_utilization_pct`: Queue utilization percentage
- `queue_pending`: Number of messages currently being processed

#### Message Counts
- `messages_received`: Total messages received
- `messages_queued`: Total messages added to queue
- `messages_processed`: Total messages successfully processed
- `messages_failed`: Total messages that failed processing

#### Dropped Messages
- `messages_dropped_total`: Total messages dropped
- `messages_dropped_rate_limit`: Messages dropped due to rate limiting
- `messages_dropped_queue_full`: Messages dropped due to full queue
- `messages_dropped_size`: Messages dropped due to size limit

#### Processing Performance
- `processing_time_avg_ms`: Average processing time in milliseconds
- `processing_time_p95_ms`: 95th percentile processing time
- `processing_time_max_ms`: Maximum processing time

#### Rate Limiting
- `rate_limit_current`: Current messages per minute

#### Backpressure
- `backpressure_active`: Whether backpressure is currently active (0 or 1)

### InfluxDB Measurement

Metrics are stored in InfluxDB with the measurement name:
```
{measurementName}_queue
```

Where `{measurementName}` is configured at:
```yaml
Butler-SOS:
  qlikSenseEvents:
    eventCount:
      influxdb:
        measurementName: qlik_sense_events
```

So metrics would be stored in `qlik_sense_events_queue`.

### Grafana Dashboard

You can create Grafana dashboards to visualize these metrics:

**Example queries:**

Queue utilization:
```flux
from(bucket: "mybucket")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "qlik_sense_events_queue")
  |> filter(fn: (r) => r._field == "queue_utilization_pct")
  |> filter(fn: (r) => r.queue_name == "UserEvents")
```

Messages processed vs dropped:
```flux
from(bucket: "mybucket")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "qlik_sense_events_queue")
  |> filter(fn: (r) => r._field == "messages_processed" or r._field == "messages_dropped_total")
  |> filter(fn: (r) => r.queue_name == "LogEvents")
```

Processing time percentiles:
```flux
from(bucket: "mybucket")
  |> range(start: -1h)
  |> filter(fn: (r) => r._measurement == "qlik_sense_events_queue")
  |> filter(fn: (r) => r._field == "processing_time_avg_ms" or r._field == "processing_time_p95_ms")
```

## Error Handling

UDP sockets now have proper error and close handlers:

- **Socket errors**: Logged with error level, includes error message
- **Socket close**: Logged with warning level
- **Message processing errors**: Logged and counted in `messages_failed` metric
- **Queue timeouts**: Messages have a 30-second timeout for processing

## Complete Configuration Example

```yaml
Butler-SOS:
  userEvents:
    enable: true
    udpServerConfig:
      serverHost: 10.11.12.13
      portUserActivityEvents: 9997
      messageQueue:
        maxConcurrent: 5
        maxSize: 100
        dropStrategy: oldest
      rateLimit:
        enable: true
        maxMessagesPerMinute: 300
        violationLogThrottle: 60
      maxMessageSize: 65507
      backpressure:
        threshold: 80

  logEvents:
    udpServerConfig:
      serverHost: 10.11.12.13
      portLogEvents: 9996
      messageQueue:
        maxConcurrent: 5
        maxSize: 100
        dropStrategy: oldest
      rateLimit:
        enable: true
        maxMessagesPerMinute: 300
        violationLogThrottle: 60
      maxMessageSize: 65507
      backpressure:
        threshold: 80
```

## Tuning Recommendations

### High-Volume Environments (500+ users)

Increase concurrency and queue size:
```yaml
messageQueue:
  maxConcurrent: 10
  maxSize: 500
rateLimit:
  maxMessagesPerMinute: 1000
```

### Resource-Constrained Environments

Lower concurrency to reduce CPU/memory usage:
```yaml
messageQueue:
  maxConcurrent: 2
  maxSize: 50
rateLimit:
  maxMessagesPerMinute: 100
```

### Development/Testing

Disable rate limiting for easier testing:
```yaml
rateLimit:
  enable: false
```

## Troubleshooting

### Messages Being Dropped

**Check queue utilization:**
- Look for "Backpressure detected" warnings in logs
- Review `queue_utilization_pct` metric in InfluxDB
- Consider increasing `maxSize` or `maxConcurrent`

**Check rate limiting:**
- Look for "Rate limit exceeded" warnings in logs
- Review `messages_dropped_rate_limit` metric
- Consider increasing `maxMessagesPerMinute`

**Check processing performance:**
- Review `processing_time_p95_ms` metric
- If processing times are high, investigate:
  - Network latency to InfluxDB/New Relic/MQTT
  - QRS API performance (for user events with app name lookup)
  - Disk I/O (for file logging)

### High Memory Usage

If Butler SOS memory usage is high:
1. Reduce `maxConcurrent` to limit parallel operations
2. Reduce `maxSize` to limit queued messages
3. Enable rate limiting to prevent spikes
4. Check for memory leaks in custom integrations

### No Metrics Appearing

Verify configuration:
```yaml
Butler-SOS:
  influxdbConfig:
    enable: true
  qlikSenseEvents:
    eventCount:
      enable: true
    influxdb:
      enable: true
```

Check logs for errors:
```
grep "UDP QUEUE METRICS INFLUXDB" /path/to/butler-sos.log
```

## Migration from Previous Versions

Previous versions of Butler SOS had no message queuing or rate limiting. The new configuration options are **required** in the config file.

If you have an existing configuration, add the new sections to `userEvents.udpServerConfig` and `logEvents.udpServerConfig`:

```yaml
messageQueue:
  maxConcurrent: 5
  maxSize: 100
  dropStrategy: oldest
rateLimit:
  enable: true
  maxMessagesPerMinute: 300
  violationLogThrottle: 60
maxMessageSize: 65507
backpressure:
  threshold: 80
```

These default values work well for most environments.
