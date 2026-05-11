# Audit Events API — HTTP Rate Limiting

The audit events API has built-in rate limiting to protect Butler SOS from excessive request loads. This page explains how the HTTP rate limiting works and how to configure it.

---

## Overview

The audit events API (`POST /api/v1/audit-event` and `GET /api/v1/test-connection`) enforces a per-IP request rate limit. Each client IP address is allowed a maximum number of requests per minute. Requests beyond this limit receive an HTTP `429 Too Many Requests` response.

This rate limit is applied at the HTTP transport layer — before authentication, before schema validation, and before any queue processing. It is designed to prevent abuse and accidental overload of the audit API.

---

## Configuration

The HTTP rate limit is configured via YAML:

```yaml
Butler-SOS:
  auditEvents:
    rateLimit:
      enable: true            # Enable or disable HTTP rate limiting (default: true)
      maxPerMinute: 300       # Max requests per IP address per minute (default: 300)
```

| Setting | YAML path | Default | Description |
|---------|-----------|---------|-------------|
| `enable` | `Butler-SOS.auditEvents.rateLimit.enable` | `true` | Whether rate limiting is active |
| `maxPerMinute` | `Butler-SOS.auditEvents.rateLimit.maxPerMinute` | `300` | Maximum requests per IP per minute |

---

## What happens when the limit is exceeded

When a client exceeds their rate limit, the API returns HTTP `429 Too Many Requests`:

```json
{
  "status": "error",
  "receivedAt": "2025-01-15T10:30:00.000Z",
  "outcome": "dropped",
  "reason": "Rate limit exceeded",
  "details": {
    "retryAfter": 60
  }
}
```

The `retryAfter` field indicates how many seconds the client should wait before retrying (always 60 seconds, matching the 1-minute time window).

The response also includes rate limit headers on all responses while the window is active:

| Header | Description |
|--------|-------------|
| `x-ratelimit-limit` | The configured max requests per minute (e.g., `300`) |
| `x-ratelimit-remaining` | Requests remaining in the current window for this IP |
| `x-ratelimit-reset` | Unix timestamp when the window resets |
| `retry-after` | Seconds until the rate limit window resets (only on 429 responses) |

---

## How per-IP rate limiting works

The rate limit is tracked per client IP address. Different IP addresses have independent rate limit counters — if one client IP is rate limited, other clients are unaffected.

For example, with `maxPerMinute: 300`:

- Client A sends 300 requests in 1 minute → 301st request gets `429`
- Client B sends their first request → gets `200` (separate counter)

The IP address is determined from the TCP connection. Proxies and load balancers may affect the apparent IP address depending on how the request is forwarded.

---

## Relationship to the queue rate limiter

The HTTP rate limiter (Level 1) is distinct from Butler SOS's **queue rate limiter** (Level 2), which controls how fast audit events are processed internally:

| Level | Mechanism | Config path | Purpose |
|-------|-----------|-------------|---------|
| **Level 1** (HTTP) | `@fastify/rate-limit` plugin | `Butler-SOS.auditEvents.rateLimit` | Protects against HTTP-level abuse, applied per IP |
| **Level 2** (Queue) | `UdpQueueManager.RateLimiter` | `Butler-SOS.auditEvents.queue.rateLimit` | Controls event processing throughput, global |

When a `POST /api/v1/audit-event` request arrives:

1. **Level 1** — HTTP rate limit check (per IP)
2. **Auth** — Bearer token validation
3. **Schema validation** — Envelope structure check
4. **Level 2** — Queue rate limit check (global)
5. **Queue** — Event queued for async processing
6. **Destinations** — Written to InfluxDB, Parquet, QVD, etc.

Both rate limiters log their actions at `WARN` level when they drop a request.

---

## Disabling rate limiting

To disable HTTP rate limiting entirely, set `enable: false`:

```yaml
Butler-SOS:
  auditEvents:
    rateLimit:
      enable: false
      maxPerMinute: 300
```

**Not recommended for production.** Disabling rate limiting leaves Butler SOS vulnerable to accidental or deliberate overload from clients sending excessive requests.

---

## Tuning guidance

The default of 300 requests per minute per IP is sufficient for typical usage patterns where a single browser-based client (Audit.qs extension) sends audit events.

Increase `maxPerMinute` if:

- Multiple browser tabs or users share the same IP address
- Automated clients send bursts of events
- You see frequent `429` responses despite legitimate usage

Decrease `maxPerMinute` if:

- You need stricter abuse protection
- Resource usage from the audit API is a concern

The time window is fixed at 1 minute and cannot be configured via YAML.