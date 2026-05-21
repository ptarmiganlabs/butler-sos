# Audit.qs Version Compatibility

> **Audience:** Butler SOS administrators who operate the Audit Events API and need to understand version compatibility with the Audit.qs browser extension.  
> **Applies to:** Butler SOS 15.0.0 and later.

---

## What is version compatibility?

Butler SOS and the Audit.qs browser extension are developed and released independently. To prevent situations where an incompatible combination is deployed, Butler SOS maintains a built-in compatibility matrix that tracks which Audit.qs versions are supported by each Butler SOS release.

When Audit.qs connects to Butler SOS, it sends its version number in the `X-Audit-QS-Version` header (and inside the event envelope). Butler SOS checks this version against its matrix and responds accordingly.

---

## How it works

### Connection test (`GET /api/v1/test-connection`)

When a user clicks the **Test Connection** button in the Audit.qs property panel, Butler SOS receives the Audit.qs version and checks compatibility immediately. The response includes:

- `butlerSosVersion` — the Butler SOS version string
- `auditQsVersion` — the Audit.qs version received (or `null` if absent)
- `compatible` — `true` if the versions are compatible, `false` otherwise

If the versions are incompatible, Audit.qs shows a warning dialog with both version numbers and advises the user to update.

### Audit event ingestion (`POST /api/v1/audit-event`)

Every audit event sent by Audit.qs carries the version in the `X-Audit-QS-Version` header (with a fallback to `source.version` inside the envelope).

Butler SOS checks compatibility **before** processing the event:

- **Compatible** — the event is accepted and processed normally (`202 Accepted`).
- **Incompatible** — the event is dropped with `422 Unprocessable Content` and a warning is logged.
- **No version provided** — for backward compatibility with older Audit.qs clients, Butler SOS accepts the event but logs a warning encouraging an upgrade.

---

## Compatibility matrix

The matrix uses **semver ranges** so that patch and minor releases are matched automatically. You only need to pay attention when a major version boundary is crossed.

| Butler SOS version range | Compatible Audit.qs version range |
| ------------------------ | --------------------------------- |
| `>=15.0.0 <16.0.0`       | `>=0.3.0 <0.4.0`                  |

This means:

- Butler SOS `15.0.0`, `15.0.1`, `15.1.0` are all covered by the same row.
- Audit.qs `0.3.0`, `0.3.1`, `0.3.5` are all covered by the same row.
- Only a **major** version change (e.g. Butler SOS 16.x or Audit.qs 0.4.x) requires a matrix update.

---

## What to do when you see a compatibility warning

### In the Butler SOS logs

If you see a log message like this:

```
AUDIT API: Dropped audit event from incompatible Audit.qs version ...
```

It means an Audit.qs instance is sending events with a version that does not match the Butler SOS compatibility matrix.

**Recommended actions:**

1. Check the version numbers in the log message.
2. Upgrade Audit.qs to a version within the compatible range.
3. If Butler SOS is significantly older, upgrade Butler SOS instead.
4. If both are current and the warning persists, verify that the correct Audit.qs extension is deployed (not an old zip file from a previous release).

### In the Audit.qs property panel

If the **Test Connection** button shows a warning dialog with version information, the administrator should:

1. Note both version numbers shown in the dialog.
2. Check the compatibility matrix above.
3. Upgrade the component that is out of date.

---

## Backward compatibility

Older Audit.qs clients that do not send the `X-Audit-QS-Version` header are still accepted. Butler SOS logs a warning recommending an upgrade, but events are not dropped. This allows a graceful transition period while users update their browser extensions.
