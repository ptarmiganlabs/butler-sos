# Butler SOS PR 1345 summary: JSON destination and Audit.qs compatibility

This change set improves how Butler SOS handles Audit Events, with focus on safer JSON destination configuration and clearer compatibility behavior with the Audit.qs extension.

## What changed

### 1) JSON objectdata destination config is stricter

For `auditEvents` JSON destinations that use `objectdata`, buffering settings are no longer accepted in config:

- `maxBatchSize`
- `writeFrequency`

This prevents unsupported buffering options from being used in this destination type.

### 2) Audit.qs version compatibility checks were added

Butler SOS now checks client version compatibility between:

- Butler SOS version
- Audit.qs version (from request header or payload source info)

Compatibility is validated using semver ranges and applied to:

- `POST /api/v1/audit-event`
- `GET /api/v1/test-connection`

If versions are incompatible, events are rejected with clear status/message output.

### 3) Missing Audit.qs version logging is now controlled

When an audit event arrives without Audit.qs version info:

- Each event is logged at `DEBUG` level
- `WARN` logs are rate-limited to once per IP per minute
- The warning includes an aggregated `missingVersionCount` counter

This keeps operational visibility while reducing warning noise in high-volume environments.

### 4) Reliability hardening around rate-limit state

The per-IP warning state now has safeguards to avoid unbounded growth and unnecessary CPU use:

- Stale IP entries are evicted after a TTL window
- Cleanup is rate-limited (not run on every single missing-version event)

### 5) Header normalization for duplicated version headers

If `x-audit-qs-version` appears multiple times, Butler SOS now normalizes it to a single value before compatibility checks.  
This avoids false incompatibility due to array-valued headers.

## What administrators should do

1. Review any Audit Events JSON destination config and remove `maxBatchSize` / `writeFrequency` from `objectdata` destinations.
2. Ensure Audit.qs clients send version information (`x-audit-qs-version`) consistently.
3. Use `GET /api/v1/test-connection` to validate compatibility behavior before production rollout.
4. If troubleshooting missing-version events, check `DEBUG` logs for per-event details and `WARN` logs for periodic aggregated counters.

## Expected outcome

- Cleaner, more predictable Audit Events configuration
- Better compatibility diagnostics between Butler SOS and Audit.qs
- Lower risk of log flooding from missing-version warnings
- Better resilience under high-cardinality source IP traffic
