# Audit Events API — HTTP Status Codes and Error Handling

Butler SOS exposes an HTTP endpoint for receiving audit events from Qlik Sense. This page documents all possible HTTP status codes returned by the audit events API and explains what each response means.

---

## POST /api/v1/audit-event

### 200/204 — CORS Preflight (OPTIONS)

**When it occurs:** Browser-based clients send an `OPTIONS` request to check CORS headers before making the actual `POST`.

**What happens:** No authentication is required or performed on `OPTIONS` requests. The response includes CORS headers (`Access-Control-Allow-*`) and returns `204` (or `200` depending on the CORS plugin configuration).

---

### 400 — Bad Request (schema validation failure)

**When it occurs:** The incoming JSON envelope fails Fastify's JSON schema validation. This includes:

- Missing required fields (`schemaVersion`, `eventId`, `timestamp`, `type`, or `payload`)
- Wrong data types (e.g., `eventId` is not a string)
- Invalid `source.kind` value — only `qlik-sense-extension` is allowed
- Invalid `source.name` value — only `audit-qs` is allowed
- Invalid `timestamp` format — must be an ISO 8601 date-time string

**Response body:**

```json
{
  "status": "error",
  "receivedAt": "2025-01-15T10:30:00.000Z",
  "outcome": "dropped",
  "reason": "Schema validation failed",
  "details": {
    "errors": [
      {
        "instancePath": "/eventId",
        "message": "must have required property 'eventId'",
        "params": {}
      }
    ]
  }
}
```

**What happens:** The event is not stored or forwarded to any destination. The client must fix the request before retrying.

---

### 401 — Unauthorized

**When it occurs:** Butler SOS is configured with an API token (`Butler-SOS.auditEvents.apiToken`) and the request either:

- Does not include an `Authorization: Bearer <token>` header, or
- The provided token does not match the configured secret

**Response body:**

```json
{
  "status": "error",
  "receivedAt": "2025-01-15T10:30:00.000Z",
  "outcome": "dropped",
  "reason": "Unauthorized"
}
```

**What happens:** The event is rejected. No data is stored or forwarded.

---

### 422 — Unprocessable Content

**When it occurs:** The JSON envelope is structurally valid (passes schema validation) but the content violates semantic constraints or the per-type payload schema. The event was received but cannot be processed.

Specific constraint violations:
- `eventId` is not a valid UUID (format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)
- `correlationId` exceeds 64 characters
- `payload.context.appId` is not a valid UUID
- `type` is not a recognised event type (must be one of the known types or match `event.{value}` pattern)

Payload validation failures (per-type schema mismatch):
- Missing required fields in `payload.event` (e.g., `selectionTxnId` for `selection.state.changed`)
- Field length exceeded (e.g., `appName` > 64 characters)
- Array size exceeded (e.g., `details` array > 500 items for `selection.state.changed`)
- Invalid UUID format for `selectionTxnId`

**Response body:**

```json
{
  "status": "error",
  "receivedAt": "2025-01-15T10:30:00.000Z",
  "outcome": "dropped",
  "reason": "One or more constraint violations",
  "details": {
    "errors": [
      { "message": "eventId is not a valid UUID (\"not-a-uuid\")" },
      { "message": "type is not a recognised event type (\"unknown.type\")" }
    ]
  }
}
```

**What happens:** The event is not stored or forwarded to any destination. The client must fix the request before retrying.

---

### 429 — Too Many Requests

**When it occurs:** The client has exceeded the per-IP rate limit for the audit events API. The limit is configured via `Butler-SOS.auditEvents.rateLimit.maxPerMinute` (default: 300 requests per minute per IP address).

**Response body:**

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

**What happens:** The event is not stored or forwarded. The client should retry after the indicated `retryAfter` seconds (60 seconds).

---

### 500 — Internal Server Error

**When it occurs:** Butler SOS encountered an unexpected error while processing the event. This is a server-side problem, not a problem with the event itself.

**Response body:**

```json
{
  "status": "error",
  "receivedAt": "2025-01-15T10:30:00.000Z",
  "outcome": "error",
  "reason": "Internal error while processing event"
}
```

**What happens:** The event may or may not have been partially processed. The client should retry after a delay (e.g., 30-60 seconds). No error details are returned to the client for security reasons — all error details are logged server-side.

---

### 503 — Service Unavailable

**When it occurs:** Butler SOS's internal event queue is full. The event was received but dropped because processing cannot keep up with the incoming rate.

**Response body:**

```json
{
  "status": "error",
  "receivedAt": "2025-01-15T10:30:00.000Z",
  "outcome": "dropped",
  "reason": "Event queue is full"
}
```

**What happens:** The event is not stored or forwarded. The client should retry after a delay (e.g., 30 seconds). If this persists, the Butler SOS administrator should investigate queue capacity.

---

### 202 — Accepted (event processed)

**When it occurs:** The request passed all validation, authentication, and was successfully processed or queued for asynchronous processing.

**Response body:**

```json
{
  "status": "accepted",
  "receivedAt": "2025-01-15T10:30:00.000Z",
  "outcome": "processed"
}
```

**What happens:** The event has been accepted for processing. If a queue manager is configured, the event is queued and processed asynchronously. If no queue manager is configured, the event is processed inline before the response is returned.

---

## GET /api/v1/test-connection

### 200 — OK

**When it occurs:** The endpoint is reached with a valid API token (if configured).

**Response body:**

```json
{
  "status": "ok",
  "message": "Butler SOS Audit API is reachable",
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

### 401 — Unauthorized

**When it occurs:** Same as for `POST /api/v1/audit-event` — missing or incorrect bearer token.

---

## Summary Table

| Status | Meaning | Retry? | Client Action |
|--------|---------|--------|--------------|
| 200/204 | CORS preflight | No | Proceed with actual request |
| 202 | Event processed | No | Event accepted, no further action needed |
| 400 | Schema validation failure | No | Fix request format before retrying |
| 401 | Auth failure | No | Fix API token before retrying |
| 422 | Constraint or payload validation failure | No | Fix event content before retrying |
| 429 | Rate limit exceeded | Yes (after delay) | Retry after `retryAfter` seconds |
| 500 | Internal server error | Yes (after delay) | Retry after 30-60 seconds |
| 503 | Queue full | Yes (after delay) | Retry after 30 seconds |

---

## Response Body Format

All responses share this structure:

```json
{
  "status": "accepted | error",
  "receivedAt": "2025-01-15T10:30:00.000Z",
  "outcome": "processed | dropped | error",
  "reason": "optional human-readable string",
  "details": { }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | `"accepted"` for 2xx responses, `"error"` for 4xx/5xx responses |
| `receivedAt` | string | ISO 8601 timestamp of when the server received the request |
| `outcome` | string | `"processed"` = event was processed; `"dropped"` = event was discarded; `"error"` = server error occurred |
| `reason` | string | Human-readable explanation. Always present on error responses. |
| `details` | object | Additional structured data. Only present when relevant (e.g., `errors` array for 400/422, `retryAfter` for 429). |

---

## Security Note

Error responses (400, 401, 422, 429, 500, 503) never include internal implementation details, stack traces, or sensitive configuration information. All error details are logged server-side only.