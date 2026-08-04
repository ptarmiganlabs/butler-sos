# Screenshot Session Cache: Fractional `ttlSeconds` Values

When Butler SOS downloads screenshots for audit events, it can reuse a Qlik Sense session
across several downloads instead of requesting a new session ticket every time. How long a
reused session stays valid is controlled by `ttlSeconds`.

Certain `ttlSeconds` values used to stop screenshot capture completely. This page explains
which values were affected, how to recognise the problem in your logs, and what has changed.

---

## The setting

Session caching lives under
`Butler-SOS.auditEvents.destination.screenshots.auth.sessionCache`:

```yaml
Butler-SOS:
    auditEvents:
        destination:
            screenshots:
                auth:
                    mode: userTicket   # Caching applies to userTicket and qpsTicket only
                    sessionCache:
                        enable: true   # Default false
                        ttlSeconds: 120  # Default 120. Minimum 1.
                        maxEntries: 100  # Default 100. Minimum 1.
```

| Key | Default | Description |
|-----|---------|-------------|
| `enable` | `false` | When `true`, a Qlik Sense session obtained for one screenshot can be reused for later screenshots for the same user and virtual proxy. |
| `ttlSeconds` | `120` | How long a cached session may be reused, in seconds. Must be at least 1. Decimal values are allowed. |
| `maxEntries` | `100` | Maximum number of cached sessions held at once. Must be a whole number of at least 1. |

Session caching only applies when the screenshot authentication mode is `userTicket` or
`qpsTicket`. It is ignored when the mode is `none`.

---

## The problem

`ttlSeconds` accepts decimal values, so `1.5` (one and a half seconds) has always been a
valid setting. Internally the value is converted from seconds to milliseconds, and the
component that enforces the expiry time only accepts whole milliseconds.

Any `ttlSeconds` value with **more than three decimal places** does not convert to a whole
number of milliseconds. For example, `1.0005` seconds is 1000.5 milliseconds. Such values
were rejected outright.

The effect was severe and easy to misread:

- Every screenshot download attempt failed, including all automatic retries.
- No screenshots were captured at all for as long as the setting was in place.
- Butler SOS itself kept running normally, and everything unrelated to screenshots was
  unaffected, so the problem looked like a Qlik Sense connectivity issue rather than a
  configuration issue.

The error text written to the Butler SOS log for each failed attempt was:

```
ttl must be a positive integer if specified
```

That message does not mention `ttlSeconds`, session caching, or screenshots, which made the
cause very hard to find.

Values with up to three decimal places — `1`, `30`, `1.5`, `2.25`, `120.125` — were never
affected and behaved correctly.

---

## What has changed

Butler SOS now converts `ttlSeconds` to the nearest whole millisecond before applying it.

- `ttlSeconds: 1.0005` is treated as 1001 milliseconds instead of failing.
- `ttlSeconds: 2.33333` is treated as 2333 milliseconds instead of failing.
- A value so small that it would round down to zero is treated as 1 millisecond, so a
  cached session can never be given an unlimited lifetime by accident.

Values that already worked are unchanged: `120` still means exactly 120 seconds, and `1.5`
still means exactly 1500 milliseconds. No configuration change is required when upgrading,
and no setting has been renamed, removed or re-defaulted.

---

## What to do

If screenshot capture has been failing in your environment and the log contains
`ttl must be a positive integer if specified`, the cause was this issue. After upgrading,
screenshot capture resumes with no configuration change.

If you would rather not rely on rounding, set `ttlSeconds` to a whole number of seconds.
For most environments a value between 60 and 300 seconds is a reasonable choice: long
enough that a burst of screenshots reuses one Qlik Sense session, short enough that a
session is not held long after it stops being useful.
