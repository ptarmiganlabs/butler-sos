# Butler SOS UDP Payload Format Documentation

## Overview

Butler SOS exposes two UDP endpoints for receiving real-time events from Qlik Sense Enterprise on Windows (QSEoW):

1. **User Events UDP Server** - Default port 9997
2. **Log Events UDP Server** - Default port 9996

Both servers use UDPv4 (`udp4`) with `reuseAddr: false` and are implemented in `src/lib/globals/udp-servers.js`.

---

## Table of Contents

1. [User Events UDP Payload](#user-events-udp-payload)
2. [Log Events UDP Payload](#log-events-udp-payload)
   - [Engine Events](#engine-events-qseow-engine)
   - [Proxy Events](#proxy-events-qseow-proxy)
   - [Repository Events](#repository-events-qseow-repository)
   - [Scheduler Events](#scheduler-events-qseow-scheduler)
   - [QIX Performance Events](#qix-performance-events-qseow-qix-perf)
3. [Message Processing and Validation](#message-processing-and-validation)
4. [Field Sanitization](#field-sanitization)
5. [Configuration Reference](#configuration-reference)

---

## User Events UDP Payload

**Handler:** `src/lib/udp_handlers/user_events/message-event.js`  
**Accepted Message Types:** `/qseow-proxy-connection/`, `/qseow-proxy-session/`

### Message Format

UDP messages are semicolon-separated text strings with 8 fields. The 8th field (message) can contain semicolons and requires special handling.

```text
<message_type>;<host>;<command>;<user_directory>;<user_id>;<origin>;<context>;<message>
```

### Field Specification

| Field | Index | Name | Type | Max Length | Description |
|-------|-------|------|------|------------|-------------|
| 0 | Message Type | String | 100 chars | `/qseow-proxy-connection/` or `/qseow-proxy-session/` (leading/trailing slashes removed during processing) |
| 1 | Host | String | 100 chars | Hostname where the event occurred |
| 2 | Command | String | 100 chars | `Start session`, `Stop session`, `Open connection`, `Close connection` |
| 3 | User Directory | String | 100 chars | QSEoW user directory (e.g., `LAB`) |
| 4 | User ID | String | 100 chars | QSEoW user ID (e.g., `goran`) |
| 5 | Origin | String | 200 chars | Origin of the event |
| 6 | Context | String | 500 chars | Context where event occurred. May contain `/app/<guid>` for app ID extraction |
| 7 | Message | String | 1000 chars | Can contain semicolons and single quotes. May contain UserAgent information |

### Special Processing

1. **Field 7 (Message) Handling:**
   - First 7 fields are split by `;`
   - Field 8 is extracted by joining all remaining parts after the 7th semicolon
   - This preserves semicolons within the message field

2. **App ID Extraction:**
   - If `context` field starts with `/app/<guid>`, the app ID is extracted
   - App ID must pass UUID validation (using `uuid` library)
   - Example: `/app/e7af59a0-c243-480d-9571-08727551a66f?someparam` → app ID: `e7af59a0-c243-480d-9571-08727551a66f`

3. **App Name Lookup:**
   - If app ID is found, Butler SOS looks up the app name from its internal app list
   - If not found, app name is set to `<unknown app name>`

4. **User Agent Parsing:**
   - If message contains `UserAgent:`, the user agent string is extracted
   - Leading/trailing spaces and single quotes are removed
   - Parsed using `ua-parser-js` into structured object:

     ```javascript
     msgObj.ua = {
       browser: { name, version },
       cpu: { architecture },
       device: { type, model, vendor },
       engine: { name, version },
       os: { name, version },
       ua: string
     }
     ```

5. **User Full Name:**
   - Combined field `user_full` is created: `<user_directory>\<user_id>`
   - Example: `LAB\goran`

6. **User Blacklist:**
   - Config: `Butler-SOS.userEvents.excludeUser`
   - If user matches blacklist (directory + userId), event is skipped

### Example Payloads

```text
/qseow-proxy-session/;server1.domain.com;Start session;LAB;goran;https://sense.domain.com;app/e7af59a0-c243-480d-9571-08727551a66f;UserAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
```

```text
/qseow-proxy-connection/;server2.domain.com;Open connection;LAB;jdoe;https://sense.domain.com;hub;Connection established
```

---

## Log Events UDP Payload

**Handler:** `src/lib/udp_handlers/log_events/message-event.js`

Butler SOS supports 5 types of log events from QSEoW services. Each has a different payload structure.

### Common Validations

- **Source validation:** Only process if message type matches enabled sources in config
- **Date validation:** ISO8601 timestamps validated with regex
- **UUID validation:** UUID fields validated with regex
- **Field sanitization:** All string fields sanitized (control chars removed, length limited)

---

### Engine Events (`/qseow-engine/`)

**Handler:** `src/lib/udp_handlers/log_events/handlers/engine-handler.js`  
**Fields:** 19 (indices 0-18)

#### Field Specification

| Index | Name | Type | Max Length | Validation | Description |
|-------|------|------|------------|-------------|-------------|
| 0 | source | String | 100 | - | Always `/qseow-engine/` |
| 1 | log_row | Integer | - | Must be integer > 0, else -1 | Row number in log |
| 2 | ts_iso | String | 50 | ISO8601 regex | Compact format: `20211109T153726.028+0200` |
| 3 | ts_local | String | 50 | Local timestamp regex | `2021-11-09 15:37:26,028` |
| 4 | level | String | 20 | - | `WARN`, `ERROR`, `FATAL` |
| 5 | host | String | 100 | - | Hostname |
| 6 | subsystem | String | 200 | - | QSEoW subsystem |
| 7 | windows_user | String | 100 | - | `DOMAIN\qlikservice` |
| 8 | message | String | 1000 | - | Log message (may contain `;` and `'`) |
| 9 | proxy_session_id | UUID | - | UUID regex | Proxy session ID |
| 10 | user_directory | String | 100 | - | QSEoW user directory |
| 11 | user_id | String | 100 | - | QSEoW user ID |
| 12 | engine_ts | String | 50 | - | Engine timestamp (ISO8601) |
| 13 | process_id | UUID | - | UUID regex | Engine process ID |
| 14 | engine_exe_version | String | 50 | - | Engine version |
| 15 | server_started | String | 50 | - | Server start time (ISO8601) |
| 16 | entry_type | String | 50 | - | Entry type |
| 17 | session_id | UUID | - | UUID regex | Session ID |
| 18 | app_id | UUID | - | UUID regex | App ID |

#### Date Formats Accepted

- **Compact ISO8601:** `20211109T153726.028+0200` (regex: `^\d{8}T\d{6}\.\d{3}\+\d{4}$`)
- **Hyphenated ISO8601:** `2021-11-09T15:37:26.028+0200` (regex: `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}\+\d{4}$`)
- **Local timestamp:** `2021-11-09 15:37:26,028` (regex: `^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3}$`)

---

### Proxy Events (`/qseow-proxy/`)

**Handler:** `src/lib/udp_handlers/log_events/handlers/proxy-handler.js` (uses generic handler)  
**Fields:** 16 (indices 0-15)

#### Field Specification

| Index | Name | Type | Max Length | Validation | Description |
|-------|------|------|------------|-------------|-------------|
| 0 | source | String | 100 | - | Always `/qseow-proxy/` |
| 1 | log_row | Integer | - | Must be integer > 0, else -1 | Row number |
| 2 | ts_iso | String | 50 | ISO8601 regex | ISO8601 timestamp |
| 3 | ts_local | String | 50 | Local timestamp regex | Local timestamp |
| 4 | level | String | 20 | - | `WARN`, `ERROR`, `FATAL` |
| 5 | host | String | 100 | - | Hostname |
| 6 | subsystem | String | 200 | - | QSEoW subsystem |
| 7 | windows_user | String | 100 | - | `DOMAIN\qlikservice` |
| 8 | message | String | 1000 | - | Log message |
| 9 | exception_message | String | 1000 | - | Exception message (empty if none) |
| 10 | user_directory | String | 100 | - | QSEoW user directory |
| 11 | user_id | String | 100 | - | QSEoW user ID |
| 12 | command | String | 200 | - | Command carried out |
| 13 | result_code | String | 50 | - | Result code |
| 14 | origin | String | 200 | - | Origin of log event |
| 15 | context | String | 200 | - | Context where event occurred |

---

### Repository Events (`/qseow-repository/`)

**Handler:** `src/lib/udp_handlers/log_events/handlers/repository-handler.js` (uses generic handler)  
**Fields:** 16 (same as Proxy Events)

Identical field structure to Proxy Events. The generic handler `processGenericLogEvent()` in `src/lib/udp_handlers/log_events/utils/common-utils.js` processes both.

---

### Scheduler Events (`/qseow-scheduler/`)

**Handler:** `src/lib/udp_handlers/log_events/handlers/scheduler-handler.js`  
**Fields:** 18 (indices 0-17)

#### Field Specification

| Index | Name | Type | Max Length | Validation | Description |
|-------|------|------|------------|-------------|-------------|
| 0 | source | String | 100 | - | Always `/qseow-scheduler/` |
| 1 | log_row | Integer | - | Must be integer > 0, else -1 | Row number |
| 2 | ts_iso | String | 50 | ISO8601 regex | ISO8601 timestamp |
| 3 | ts_local | String | 50 | Local timestamp regex | Local timestamp |
| 4 | level | String | 20 | - | `WARN`, `ERROR`, `FATAL` |
| 5 | host | String | 100 | - | Hostname |
| 6 | subsystem | String | 200 | - | QSEoW subsystem |
| 7 | windows_user | String | 100 | - | `DOMAIN\qlikservice` |
| 8 | message | String | 1000 | - | Log message |
| 9 | exception_message | String | 1000 | - | Exception message |
| 10 | user_directory | String | 100 | - | QSEoW user directory |
| 11 | user_id | String | 100 | - | QSEoW user ID |
| 12 | user_full | String | 200 | - | `DOMAIN\user` format |
| 13 | task_name | String | 200 | - | Task name |
| 14 | app_name | String | 200 | - | App name |
| 15 | task_id | UUID | - | UUID regex | Task ID |
| 16 | app_id | UUID | - | UUID regex | App ID |
| 17 | execution_id | UUID | - | UUID regex | Execution ID |

---

### QIX Performance Events (`/qseow-qix-perf/`)

**Handler:** `src/lib/udp_handlers/log_events/handlers/qix-perf-handler.js`  
**Fields:** 26 (indices 0-25)  
**Special:** Requires `Butler-SOS.logEvents.enginePerformanceMonitor.enable: true`

#### Field Specification

| Index | Name | Type | Max Length | Validation | Description |
|-------|------|------|------------|-------------|-------------|
| 0 | source | String | 100 | - | Always `/qseow-qix-perf/` |
| 1 | log_row | Integer | - | Must be integer > 0, else -1 | Row number |
| 2 | ts_iso | String | 50 | - | ISO8601 timestamp |
| 3 | ts_local | String | 50 | - | Local timestamp |
| 4 | level | String | 20 | - | `WARN`, `ERROR`, `FATAL` |
| 5 | host | String | 100 | - | Hostname |
| 6 | subsystem | String | 200 | - | QSEoW subsystem |
| 7 | windows_user | String | 100 | - | `DOMAIN\qlikservice` |
| 8 | proxy_session_id | UUID | - | UUID regex | If '0', non-user activity |
| 9 | user_directory | String | 100 | - | QSEoW user directory |
| 10 | user_id | String | 100 | - | QSEoW user ID |
| 11 | engine_ts | String | 50 | - | Engine timestamp |
| 12 | session_id | UUID | - | UUID regex | Session ID |
| 13 | app_id | UUID | - | UUID regex | Document/app ID |
| 14 | request_id | Integer | - | Must be integer >= 0, else -99 | Request ID |
| 15 | method | String | 100 | - | e.g., `Global::OpenApp`, `Doc::GetAppLayout` |
| 16 | process_time | Float | - | - | Milliseconds |
| 17 | work_time | Float | - | - | Milliseconds |
| 18 | lock_time | Float | - | - | Milliseconds |
| 19 | validate_time | Float | - | - | Milliseconds |
| 20 | traverse_time | Float | - | - | Milliseconds |
| 21 | handle | Integer | - | Must be integer >= 0, else -99 | Handle (-1 or number) |
| 22 | object_id | String | 100 | - | UUID or string like `rwPjBk` |
| 23 | net_ram | Integer | - | Must be integer >= 0, else -1 | Bytes |
| 24 | peak_ram | Integer | - | Must be integer >= 0, else -1 | Bytes |
| 25 | object_type | String | 100 | - | e.g., `AppPropsList`, `linechart`, `barchart` |

#### Special Processing

1. **Event Activity Source:**
   - Determined by `proxy_session_id`
   - If `proxy_session_id === '0'`: `event_activity_source = 'non-user'` (e.g., scheduled reload)
   - Otherwise: `event_activity_source = 'user'`

2. **App Name Lookup:**
   - If `Butler-SOS.logEvents.enginePerformanceMonitor.appNameLookup.enable: true`
   - Looks up app name from internal app list using `app_id`

3. **Filtering:**
   - Two levels of filters in `Butler-SOS.logEvents.enginePerformanceMonitor.monitorFilter`:
     - **App-specific filters:** `monitorFilter.appSpecific` - filter by app ID, app name, object, method
     - **All-apps filters:** `monitorFilter.allApps` - filter across all apps
   - Events not matching filters are skipped (can be tracked via rejected events counter)
   - If app-specific filter matches, all-apps filter is NOT applied

4. **Rejected Events Tracking:**
   - If `Butler-SOS.logEvents.enginePerformanceMonitor.trackRejectedEvents.enable: true`
   - Rejected events counted in `globals.rejectedEvents`

---

## Message Processing and Validation

### Processing Flow

```
UDP Socket Receive
       ↓
Message Size Validation (maxMessageSize)
       ↓
Rate Limit Check (if enabled)
       ↓
Add to Queue (UdpQueueManager)
       ↓
Process Message (concurrent, maxConcurrent)
       ↓
Parse & Validate Fields
       ↓
Apply Business Logic (filters, blacklists, etc.)
       ↓
Forward to Destinations (MQTT, InfluxDB, New Relic)
```

### Validations and Restrictions

#### 1. Message Size Validation

- **Config:** `maxMessageSize` (default: 65507 bytes, UDP maximum)
- **Code:** `src/lib/udp-queue-manager.js` → `validateMessageSize()`
- **Action:** Messages exceeding limit are dropped, counted in `messages_dropped_size`

#### 2. Rate Limiting (Optional)

- **Config:** `rateLimit.enable` (default: false), `rateLimit.maxMessagesPerMinute` (default: 600)
- **Code:** `src/lib/udp-queue-manager.js` → `RateLimiter` class
- **Type:** Fixed-window (1-minute window, resets each minute)
- **Action:** Messages exceeding rate are dropped, counted in `messages_dropped_rate_limit`

#### 3. Queue Management

- **Config:**
  - `messageQueue.maxConcurrent` (default: 10) - Max concurrent processing
  - `messageQueue.maxSize` (default: 200) - Max queue size before dropping
  - `messageQueue.backpressureThreshold` (default: 80) - Warning threshold %
- **Code:** `src/lib/udp-queue-manager.js` → `UdpQueueManager` class (uses `p-queue`)
- **Action:** When queue is full, messages are dropped, counted in `messages_dropped_queue_full`

#### 4. Source/Type Validation

- **User Events:** Only `/qseow-proxy-connection/` and `/qseow-proxy-session/` are valid
- **Log Events:** Must match enabled sources in config (`Butler-SOS.logEvents.source.<type>.enable`)

#### 5. UUID Validation

- **Regex:** `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/`
- **Invalid UUIDs:** Set to empty string `''`
- **Fields validated:** `proxy_session_id`, `process_id`, `session_id`, `app_id`, `task_id`, `execution_id`, `request_id`

#### 6. Date Validation

- **ISO8601 Compact Regex:** `/^\d{8}T\d{6}\.\d{3}\+\d{4}$/`
- **ISO8601 Hyphenated Regex:** `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}\+\d{4}$/`
- **Local Timestamp Regex:** `/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3}$/`
- **Invalid dates:** Set to empty string `''`

#### 7. Numeric Validation

- **log_row:** Must be integer > 0, else -1
- **request_id:** Must be integer >= 0, else -99
- **handle:** Must be integer >= 0, else -99
- **net_ram, peak_ram:** Must be integer >= 0, else -1
- **Time fields (process_time, work_time, etc.):** Parsed as floats

---

## Field Sanitization

**Function:** `sanitizeField(field, maxLength)` in `src/lib/udp-queue-manager.js`

### Process

1. **Type check:** If not string, convert to string
2. **Remove control characters:** Strip ASCII 0x00-0x1F and 0x7F using regex `/[\x00-\x1F\x7F]/g`
3. **Truncate:** Limit to `maxLength` characters (default: 500 if not specified)

### Applied To
All string fields in all UDP message types. Each handler specifies appropriate max lengths for each field.

---

## Configuration Reference

### UDP Server Configuration (YAML)

```yaml
Butler-SOS:
    userEvents:
        enable: true
        udpServerConfig:
            serverHost: '<IP or FQDN>'
            portUserActivityEvents: 9997
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

    logEvents:
        enable: true
        udpServerConfig:
            serverHost: '<IP or FQDN>'
            portLogEvents: 9996
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
        source:
            engine:
                enable: false
            proxy:
                enable: false
            repository:
                enable: false
            scheduler:
                enable: false
            qixPerf:
                enable: true
```

### Log Event Source Enables

Each log source must be explicitly enabled:

```yaml
Butler-SOS:
    logEvents:
        source:
            engine:
                enable: true  # Process /qseow-engine/ messages
            proxy:
                enable: true  # Process /qseow-proxy/ messages
            repository:
                enable: true  # Process /qseow-repository/ messages
            scheduler:
                enable: true  # Process /qseow-scheduler/ messages
            qixPerf:
                enable: true  # Process /qseow-qix-perf/ messages
                enginePerformanceMonitor:
                    enable: true
                    appNameLookup:
                        enable: true
                    monitorFilter:
                        appSpecific: []
                        allApps: []
                    trackRejectedEvents:
                        enable: false
```

---

## Summary of Code Files

| File | Purpose |
|------|---------|
| `src/lib/globals/udp-servers.js` | Initialize UDP servers, queue managers, error tracking |
| `src/lib/udp-queue-manager.js` | Queue management, rate limiting, validation, sanitization |
| `src/lib/udp-event.js` | Event counting (UdpEvents class) |
| `src/lib/udp_handlers/user_events/message-event.js` | User event handler |
| `src/lib/udp_handlers/log_events/message-event.js` | Log event router |
| `src/lib/udp_handlers/log_events/handlers/engine-handler.js` | Engine event processor |
| `src/lib/udp_handlers/log_events/handlers/proxy-handler.js` | Proxy event processor |
| `src/lib/udp_handlers/log_events/handlers/repository-handler.js` | Repository event processor |
| `src/lib/udp_handlers/log_events/handlers/scheduler-handler.js` | Scheduler event processor |
| `src/lib/udp_handlers/log_events/handlers/qix-perf-handler.js` | QIX performance event processor |
| `src/lib/udp_handlers/log_events/utils/common-utils.js` | Shared utilities, generic log processor |
| `src/lib/udp_handlers/log_events/filters/qix-perf-filters.js` | QIX performance filters |
| `src/config/production_template.yaml` | Configuration template |

---

## Important Notes

1. **UDP is connectionless:** No delivery guarantees. Messages may be lost, duplicated, or arrive out of order.

2. **Message size limit:** Default 65507 bytes (UDP maximum). Can be reduced via `maxMessageSize` config.

3. **Semicolons in fields:** User event field 7 (message) and log event field 8 (message) may contain semicolons. Special handling preserves these.

4. **Single quotes in fields:** Message fields may contain single quotes, which are handled during processing.

5. **Queue is always on:** Unlike earlier versions, all messages now flow through managed queues. Cannot be disabled.

6. **Rate limiting is optional:** Disabled by default. Enable if experiencing message flooding.

7. **UUID validation:** Invalid UUIDs are set to empty string, not rejected. This allows partial processing of malformed messages.

8. **Date validation:** Invalid dates are set to empty string. Both compact and hyphenated ISO8601 formats are accepted for engine events.

9. **App ID in context:** User events can extract app ID from context field if it matches `/app/<guid>` pattern.

10. **User agent parsing:** User events can parse UserAgent strings from message field using `ua-parser-js`.
