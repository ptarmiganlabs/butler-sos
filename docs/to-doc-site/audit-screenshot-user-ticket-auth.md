# Audit Screenshot Downloads with End-User QPS Tickets

Butler SOS can download Audit.qs screenshot URLs using a Qlik Proxy Service ticket created for the end user who triggered the audit event. This is useful for self-hosted Qlik Sense deployments where screenshot URLs are scoped to the browser user and fixed service-account downloads can return blank or incorrect images.

## When to Use

Use `auth.mode: userTicket` when:

- Audit.qs runs in Qlik Sense Enterprise on Windows/client-managed.
- `payload.context.user` contains a parseable Qlik identity such as `UserDirectory=LAB; UserId=john.doe`, `LAB; UserId=john.doe`, or `LAB\john.doe`.
- Butler SOS has the Qlik certificates needed for mutual TLS to QPS.
- Butler SOS can resolve the correct virtual proxy for the user/session.

Do not use this mode for Qlik Cloud identities that only resolve to email addresses. Butler SOS preserves those identities as `user`, but cannot create a QPS ticket without both `userDirectory` and `userId`.

## Payload Contract

Audit.qs sends the full identity in `payload.context.user`:

```json
{
  "payload": {
    "context": {
      "user": "UserDirectory=LAB; UserId=john.doe",
      "virtualProxyPrefix": "/analytics"
    },
    "event": {
      "type": "screenshot",
      "screenshotUrl": "https://qlik.example.com/analytics/tempcontent/abc/screenshot.png"
    }
  }
}
```

Naming matters:

- `user` is the full identity string from Qlik Sense.
- `userDirectory` is the parsed directory component, for example `LAB`.
- `userId` is the parsed user-id component, for example `john.doe`.

## Configuration

```yaml
Butler-SOS:
  auditEvents:
    destination:
      screenshots:
        auth:
          mode: userTicket
          qps:
            host: qlik.example.com
            port: 4243
            ticketTimeoutMs: 5000

            # Used when the event/URL does not identify a virtual proxy.
            defaultVirtualProxy: analytics

            # Optional mapping used after event/URL resolution.
            userDirectoryMappings:
              - userDirectory: LAB
                virtualProxy: analytics

          sessionCache:
            enable: true
            ttlSeconds: 120
            maxEntries: 100
```

Virtual proxy resolution order:

1. `payload.context.virtualProxyPrefix`
2. `payload.context.virtualProxy`
3. Virtual proxy inferred from the screenshot URL path
4. `qps.userDirectoryMappings[]`
5. `qps.defaultVirtualProxy`

An empty virtual proxy means the default Qlik Sense proxy, using `/qps/ticket`.

## Session Cache

`auth.sessionCache` works with both `userTicket` and `qpsTicket`.

QPS tickets are one-use and are never cached. Butler SOS only caches the redeemed Qlik session cookie returned by the screenshot download response. On a cache hit, Butler SOS downloads the original screenshot URL with a `Cookie` header instead of requesting a new ticket.

Cache entries are separated by auth mode, QPS host/port, virtual proxy, user directory and user id. For `userTicket`, each end user therefore has a separate cached session.

```yaml
auth:
  mode: userTicket
  qps:
    host: qlik.example.com
    port: 4243
    ticketTimeoutMs: 5000
  sessionCache:
    enable: true
    ttlSeconds: 120
    maxEntries: 100
```

When a cached session expires or is evicted, Butler SOS deletes the QPS session on a best-effort basis. If Qlik Sense rejects a cached session with HTTP 401 or 403, Butler SOS removes it from memory and retries the download with a fresh QPS ticket.

## Runtime Flow

1. Butler SOS receives a `screenshot.url.received` event.
2. It parses `payload.context.user` into `userDirectory` and `userId`.
3. It checks for a cached Qlik session for the auth mode, virtual proxy and user.
4. On a cache miss, it requests a ticket from `POST /qps/{virtualProxy}/ticket` using mutual TLS.
5. It appends `qlikTicket=<ticket>` to the screenshot URL for ticket redemption, or sends the cached session as a `Cookie` header on a cache hit.
6. It downloads the screenshot and writes it to enabled storage targets.
7. It stores the returned session cookie when caching is enabled, otherwise it deletes the QPS session created by ticket redemption.

No fallback to fixed `qpsTicket` credentials is performed when `userTicket` cannot parse the payload user. Butler SOS logs a warning and skips that screenshot download.

## Destination Fields

Audit event destinations now keep the full identity and parsed fields separate:

```json
{
  "user": "UserDirectory=LAB; UserId=john.doe",
  "userDirectory": "LAB",
  "userId": "john.doe"
}
```

InfluxDB writes these as tags when available. JSON, Parquet, and QVD write them as event metadata fields.
