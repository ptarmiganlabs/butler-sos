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
| `ttlSeconds` | `120` | How long a cached session may be reused, in seconds. Must be between 1 and 2147483 (about 24 days). Decimal values are allowed. |
| `maxEntries` | `100` | Maximum number of cached sessions held at once. Must be a whole number of at least 1. |

Session caching only applies when the screenshot authentication mode is `userTicket` or
`qpsTicket`. It is ignored when the mode is `none`.

---

## The problem

`ttlSeconds` accepts decimal values, so `1.5` (one and a half seconds) has always been a
valid setting. Internally the value is converted from seconds to milliseconds, and the
component that enforces the expiry time only accepts whole milliseconds.

Not every decimal value converts to a whole number of milliseconds, and such values were
rejected outright.

The obvious case is a setting with more precision than a millisecond: `1.0005` seconds is
1000.5 milliseconds, which is not a whole number.

The more common case is far less obvious. Computers store decimal numbers in binary, and
most decimal fractions have no exact binary equivalent — in the same way that one third has
no exact decimal form. `16.1` cannot be stored exactly, so multiplying it by 1000 gives
16100.000000000002 rather than 16100, and that is not a whole number either.

**This is why the problem could not be predicted from how a value was written.** Perfectly
ordinary-looking settings were affected: `16.1`, `32.2`, `32.3`, `32.7` and `64.1` all
failed, while `1.5`, `2.25` and `120.125` all worked. There is no rule of thumb — such as
counting decimal places — that separates the two groups. Whole numbers like `60`, `120` and
`300` were always safe.

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

---

## What has changed

Butler SOS now converts `ttlSeconds` to the nearest whole millisecond before applying it.

- `ttlSeconds: 16.1` is treated as 16100 milliseconds instead of failing.
- `ttlSeconds: 1.0005` is treated as 1001 milliseconds instead of failing.
- A value so small that it would round down to zero is treated as 1 millisecond, so a
  cached session can never be given an unlimited lifetime by accident.

Values that already worked are unchanged: `120` still means exactly 120 seconds, and `1.5`
still means exactly 1500 milliseconds. No configuration change is required when upgrading,
and no setting has been renamed or removed, and no default has changed.

## A new upper limit on `ttlSeconds`

`ttlSeconds` now has a maximum of 2147483 seconds, about 24 days. This is the longest
expiry that Butler SOS can actually schedule.

Previously the setting had no upper limit, and a larger value did not do what it looked
like it did. The expiry could not be scheduled, so cached sessions never expired at all,
and Butler SOS spent a continuous slice of CPU rescheduling the expiry it could not
perform, writing a warning to the log each time.

A value above the maximum is now rejected when Butler SOS starts, with a message naming the
setting, rather than being accepted and quietly misbehaving. **If your configuration
contains a `ttlSeconds` larger than 2147483, Butler SOS will refuse to start after
upgrading until you lower it.** Such a value was never working as intended, so lowering it
to a realistic session lifetime is the correct fix in any case. Defaults and all realistic
values are far below this limit, so almost no installation is affected.

---

## What to do

If screenshot capture has been failing in your environment and the log contains
`ttl must be a positive integer if specified`, the cause was this issue. After upgrading,
screenshot capture resumes with no configuration change.

Check whether your `ttlSeconds` is larger than 2147483, since that value now prevents
Butler SOS from starting. Lower it to a realistic session lifetime.

Otherwise, if you would rather not rely on rounding, set `ttlSeconds` to a whole number of
seconds. For most environments a value between 60 and 300 seconds is a reasonable choice:
long enough that a burst of screenshots reuses one Qlik Sense session, short enough that a
session is not held long after it stops being useful.
