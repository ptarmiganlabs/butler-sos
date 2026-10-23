# Node.js Security Update in the Docker Image

The Butler SOS Docker image now runs on Node.js 24.22.1. Earlier images ran on 24.21.0. Node.js
24.22.1 is a security release from 2026-10-20. Nothing changes in how you run or configure the
container.

Most installations need to do nothing. There is one change you might notice: Node.js no longer
trusts certificates issued through the eMudhra (emSign) certificate authority. If a server that
Butler SOS connects to uses such a certificate, that connection now fails.

---

## What the update fixes

- **Certificate trust.** Certificate authorities that belong to eMudhra's emSign hierarchy are
  distrusted after they were compromised. A certificate issued through them could have been
  forged.
- **Compressed data.** A flaw in Brotli decompression (CVE-2026-111497) could let a malicious
  server run code inside the container.
- **Server name checks.** Two flaws let a secure (TLS) connection accept a certificate that was
  issued for a different server name.

---

## Who might be affected by the certificate change

The change affects only servers whose certificates Butler SOS checks against the standard list
of public certificate authorities. Servers whose certificates you trust through your own CA
files, such as the Qlik Sense server certificates you give Butler SOS, are not affected by this
change.

Connections that typically use public certificates:

- InfluxDB, when it is a cloud service or has a publicly issued certificate
- MQTT brokers reached over TLS
- New Relic
- Webhooks and other HTTPS endpoints you have configured

Few public servers use emSign certificates, so most installations will see no difference.

---

## How to check a server's certificate

Run this from any machine with OpenSSL. Replace the host name and port with those of the server
Butler SOS connects to:

```bash
openssl s_client -connect influxdb.example.com:443 -showcerts </dev/null 2>/dev/null | grep -E '^ *(s|i):'
```

The `i:` lines show who issued each certificate in the chain. If any of them mentions **emSign**
or **eMudhra**, that connection fails after you upgrade.

---

## What you see if a connection is affected

Butler SOS logs an error for that connection, because the certificate can no longer be verified.
The error usually says that the certificate has been revoked or that its issuer is untrusted.
Other connections keep working.

---

## What to do

Ask whoever runs that server to replace its certificate with one from a different certificate
authority. Do not work around the failure by turning off certificate checking for that
connection. The certificate authority was distrusted because certificates issued through it can
no longer be relied on.
