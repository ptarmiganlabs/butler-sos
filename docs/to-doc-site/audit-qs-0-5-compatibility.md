# Audit.qs 0.5 is accepted

Butler SOS checks the version of every Audit.qs extension that sends it audit events, and
refuses versions it has not been checked against. From Butler SOS **15.1.0**, Audit.qs
**0.5.x** is accepted, alongside 0.3.x and 0.4.x.

Butler SOS 15.0.0 and 15.0.1 do **not** accept Audit.qs 0.5.x. If Audit.qs is upgraded to
0.5 while Butler SOS is still on one of those versions, no audit events are stored until
Butler SOS is upgraded too.

---

## Which versions work together

| Butler SOS                     | Accepted Audit.qs versions |
| ------------------------------ | -------------------------- |
| 15.0.0                         | 0.3.x                      |
| 15.0.1                         | 0.3.x, 0.4.x               |
| 15.1.0 and later 15.x releases | 0.3.x, 0.4.x, 0.5.x        |

Audit.qs 0.6 and later are not accepted by any of these releases. Each new Audit.qs minor
version is added to Butler SOS deliberately, once it has been checked against it.

Pre-release builds of Audit.qs (for example `0.5.0-rc.1`) are refused even when their
version falls inside an accepted range.

## Upgrade order

**Upgrade Butler SOS first, then Audit.qs.** A Butler SOS release that accepts Audit.qs 0.5
still accepts 0.3 and 0.4, so once Butler SOS has been upgraded, the new extension can be
imported in the QMC whenever it suits you. Importing it replaces the extension for every app
at once.

The other order leaves a gap: between the Audit.qs upgrade and the Butler SOS upgrade, every
audit event sent by Audit.qs 0.5 is refused and lost. Audit.qs does not keep refused events
to send again later.

Audit.qs 0.5 also refuses to send anything to a Butler SOS address that starts with
`http://`, unless Butler SOS runs on the same machine as the browser. Before importing
Audit.qs 0.5, make sure the Butler SOS audit events API is served over HTTPS
(`Butler-SOS.auditEvents.tls.enable: true` in the Butler SOS config file) and that the
Butler SOS address in the Audit.qs property panel starts with `https://`.

## What a version mismatch looks like

When Audit.qs 0.5 talks to Butler SOS 15.0.0 or 15.0.1:

- **In Qlik Sense:** the **Test Connection** button in the Audit.qs property panel opens a
  **Version Mismatch Detected** dialog that lists both version numbers.
- **For every audit event:** Butler SOS answers with HTTP status **422** and the reason
  `Incompatible Audit.qs version`, and does not store the event.
- **In the Butler SOS log:** one warning per refused event, for example:

    ```text
    warn: AUDIT API: Dropped audit event from incompatible Audit.qs version type=screenshot.url.received eventId=... ip=10.0.0.12 butlerSosVersion=15.0.1 auditQsVersion=0.5.0 message=Butler SOS 15.0.1 is not compatible with Audit.qs 0.5.0. Compatible Audit.qs versions: >=0.3.0 <0.5.0.
    ```

    and, for a connection test:

    ```text
    warn: AUDIT API: Connection test from incompatible Audit.qs version ip=10.0.0.12 origin=https://qliksense.example.com butlerSosVersion=15.0.1 auditQsVersion=0.5.0 message=Butler SOS 15.0.1 is not compatible with Audit.qs 0.5.0. Compatible Audit.qs versions: >=0.3.0 <0.5.0.
    ```

    On Butler SOS 15.0.0 the end of the message reads
    `Compatible Audit.qs versions: >=0.3.0 <0.4.0.` instead.

After upgrading Butler SOS, the same connection test logs `Connection test successful`, and
the property panel shows **Connection Successful** instead of the warning.

## Checking a Butler SOS server by hand

The connection test can also be run without Qlik Sense, from a bash or zsh shell. Replace
the host and port with those of your Butler SOS audit events API, and the version with the
Audit.qs version you plan to deploy:

```bash
printf 'Butler SOS API token: '; read -rs TOKEN; echo
printf 'header = "Authorization: Bearer %s"\n' "$TOKEN" | curl -sS -K - -H "X-Audit-QS-Version: 0.5.0" https://butler-sos.example.com:9090/api/v1/test-connection
unset TOKEN
```

The first line asks for the API token from the Butler SOS config file without showing it as
you type; if no API token is configured, just press Enter. The token is handed to `curl` on
its standard input rather than on the command line, so it does not end up in your shell
history or in the process list while `curl` runs.

An answer with status 401 and the reason `Unauthorized` means the token is missing or wrong;
it says nothing about whether the versions are compatible.

The answer includes `"compatible": true` when that Audit.qs version is accepted:

```json
{
    "status": "ok",
    "message": "Butler SOS Audit API is reachable",
    "timestamp": "2026-10-05T09:15:42.118Z",
    "butlerSosVersion": "15.1.0",
    "auditQsVersion": "0.5.0",
    "compatible": true
}
```

The `butlerSosVersion` field shows the version of the Butler SOS server that answered.
