# UDP Source Host Validation for Butler SOS

## Overview

Butler SOS now supports an approved source hosts list for its UDP endpoints. This security feature allows administrators to restrict which Qlik Sense servers (by IP address or hostname) are permitted to send UDP log messages to Butler SOS.

When enabled, any UDP message received from a source IP not in the approved list is silently rejected and a warning is logged. When disabled (the default), all sources are accepted as before.

---

## Why This Feature Was Added

Butler SOS listens on UDP ports for log events and user activity events sent by Qlik Sense log appenders. Because UDP has no connection handshake, any host on the network could theoretically send messages to these ports.

This feature provides a lightweight first line of defence: only messages from known Qlik Sense servers are processed.

---

## Affected UDP Endpoints

Two independent UDP servers benefit from this feature:

| Server | Config section | Default port |
|---|---|---|
| User activity events | `Butler-SOS.userEvents.udpServerConfig` | 9997 |
| Log events | `Butler-SOS.logEvents.udpServerConfig` | 9996 |

Each server has its own independent source validation configuration.

---

## New Configuration Settings

Two new settings are added inside each `udpServerConfig` section. Both are **optional** — existing config files that do not include them will continue to work without changes (validation defaults to disabled).

```yaml
udpServerConfig:
  # … existing settings …

  # Source IP validation for incoming UDP messages
  enableSourceValidation: false   # Set to true to enable IP allow-listing
  allowedSources:                 # List of allowed IPv4 addresses or hostnames
    # - 192.168.1.100
    # - sense-server-01.mydomain.com
```

### `enableSourceValidation` (boolean)

| Value | Behaviour |
|---|---|
| `false` (default) | All UDP sources are accepted; `allowedSources` is ignored |
| `true` | Only sources whose IP address resolves to an entry in `allowedSources` are accepted |

### `allowedSources` (array of strings)

A list of allowed source hosts. Each entry may be either:
- A **literal IPv4 address** (e.g. `192.168.1.100`), or
- A **hostname** (e.g. `sense-server-01.domain.com`) that Butler SOS will resolve via DNS at startup.

---

## Startup Behaviour

When `enableSourceValidation: true` and `allowedSources` contains at least one entry:

1. Butler SOS resolves all hostnames to IPv4 addresses using DNS at startup.
2. Successfully resolved IPs are stored in memory.
3. A log message records how many IPs were loaded, e.g.:
   ```
   [UDP User Activity] SOURCE VALIDATION: Enabled, 3 IP(s) loaded
   ```

Edge cases:

- **No entries in `allowedSources`**: A warning is logged and **all messages will be rejected** (enabled validation with an empty list is a deny-all). Set `enableSourceValidation: false` if you do not want to restrict sources.
- **Some entries unresolvable**: Per-entry errors are logged, but validation **stays enabled** using the IPs that were successfully resolved. A summary warning lists how many were skipped.
- **All entries unresolvable**: Source validation is **automatically disabled** to avoid silently blocking all traffic due to a DNS misconfiguration. An error is logged.
- **DNS resolution throws at startup**: Source validation is disabled and an error is logged.

---

## Runtime Behaviour

For every incoming UDP message:

1. If source validation is disabled: the message is processed normally.
2. If source validation is enabled:
   - The source IP (`remote.address`) is checked against the in-memory list of allowed IPs.
   - If the IP **is** in the list: the message is processed normally.
   - If the IP **is not** in the list (including when the list is empty): a warning is logged and the message is discarded.

Example warning log:
```
[UDP Log Events] SOURCE VALIDATION: Rejected message from unauthorized source 10.99.0.1:45678
```

---

## Important Behavioral Detail: Empty Allow-list

> **Note for doc site:** This behavior is intentionally strict and differs from some other systems.

When `enableSourceValidation: true` and `allowedSources` is empty (or all entries fail DNS resolution at startup):

- **Messages from all sources are rejected**, not accepted.
- This is the "deny by default" or "fail-closed" approach: if you explicitly turn on validation but provide no allowed sources, the system blocks everything rather than silently allowing everything.

This ensures that a misconfigured or partially-deployed allow-list cannot accidentally create an open endpoint. To accept all sources, set `enableSourceValidation: false`.

---

## Example Configuration

### Allow a single Sense server by IP address

```yaml
Butler-SOS:
  userEvents:
    udpServerConfig:
      enableSourceValidation: true
      allowedSources:
        - 192.168.10.50
  logEvents:
    udpServerConfig:
      enableSourceValidation: true
      allowedSources:
        - 192.168.10.50
```

### Allow multiple Sense servers by hostname

```yaml
Butler-SOS:
  userEvents:
    udpServerConfig:
      enableSourceValidation: true
      allowedSources:
        - qlik-sense-1.company.internal
        - qlik-sense-2.company.internal
  logEvents:
    udpServerConfig:
      enableSourceValidation: true
      allowedSources:
        - qlik-sense-1.company.internal
        - qlik-sense-2.company.internal
```

### Disable source validation (default / backward-compatible)

```yaml
Butler-SOS:
  userEvents:
    udpServerConfig:
      enableSourceValidation: false
      allowedSources:
  logEvents:
    udpServerConfig:
      enableSourceValidation: false
      allowedSources:
```

---

## Implementation Details

A new utility module `src/lib/udp-ip-validator.js` provides three helper functions:

| Function | Description |
|---|---|
| `isIPv4(ip)` | Returns `true` if the string is a valid IPv4 address |
| `parseAllowedSources(sources)` | Resolves hostnames to IPs; returns `{ allowedIPs, errors }` |
| `isIpAllowed(ip, allowedIPs, validationEnabled)` | Returns `true` if `ip` is in `allowedIPs` (when enabled), or always `true` when validation is disabled |

The `isIpAllowed` function accepts an explicit `validationEnabled` boolean:
- `validationEnabled = false` → always allow (no restriction)
- `validationEnabled = true` + non-empty list → allow only listed IPs
- `validationEnabled = true` + empty/null list → deny all (fail-closed)

The validation check is performed at the top of each UDP `message` event handler, before any rate limiting, queue management, or message processing.

---

## Security Notes

- UDP does not authenticate the source. Source IP spoofing is theoretically possible but uncommon on trusted internal networks.
- This feature is intended as a defence-in-depth measure, not as a primary security control.
- For production deployments, consider also using network-layer controls (firewalls, VLANs) to restrict UDP traffic to the Butler SOS ports (default: 9996, 9997).
- If `allowedSources` is populated but `enableSourceValidation` is `false`, the list has no effect.

---

## Files Changed

| File | Change |
|---|---|
| `src/lib/udp-ip-validator.js` | New utility module for IP validation |
| `src/lib/udp_handlers_log_events.js` | Added source validation at startup and per-message check |
| `src/lib/udp_handlers_user_activity.js` | Added source validation at startup and per-message check |
| `src/lib/globals/udp-servers.js` | Reads `enableSourceValidation` and `allowedSources` from config (with fallback defaults for backward compat) |
| `src/butler-sos.js` | Updated to `await` the now-async UDP init functions |
| `src/config/production_template.yaml` | Added `enableSourceValidation` and `allowedSources` to both UDP server config sections |
| `src/lib/config-schemas/user-events.js` | Added optional schema definitions for new fields |
| `src/lib/config-schemas/log-events.js` | Added optional schema definitions for new fields |
| `src/lib/__tests__/udp-ip-validator.test.js` | New unit tests for the IP validator module (100% coverage) |
| `src/lib/__tests__/udp_handlers.test.js` | Extended with source validation test cases (100% coverage) |
| `src/lib/__tests__/config-file-schema.test.js` | Updated config fixtures to include new optional fields |
