# Node.js Security Update in the Docker Image

The Butler SOS Docker image now runs on Node.js 24.22.1. Earlier images ran on 24.21.0. Node.js
24.22.1 is a security release from 2026-10-20. Nothing changes in how you run or configure the
container.

Most installations need to do nothing. There is one change you might notice: Node.js now rejects
certificates issued through eight intermediate certificate authorities of eMudhra (emSign), whose
private keys were reported compromised in October 2026. If a server that Butler SOS connects to
has a certificate issued through one of those eight, that connection now fails. Other emSign
certificates are still trusted.

---

## What the update fixes

- **Certificate trust.** Node.js now carries a blocklist of the eight compromised emSign
  intermediates. Certificates issued through them could have been forged. Other intermediates
  under the same emSign roots are not affected.
- **Compressed data.** A flaw in Brotli decompression (CVE-2026-111497) could let a malicious
  server run code inside the container.
- **Server name checks.** Two flaws let a secure (TLS) connection accept a certificate that was
  issued for a different server name.

---

## Who might be affected by the certificate change

Node.js checks the blocklist on every secure connection Butler SOS makes. That includes
connections whose certificates you trust through your own CA files. So a connection can be
affected whichever way you trust it.

What matters is whether the server's certificate chain passes through one of the eight blocked
intermediates:

- **Connections to servers with certificates from your own private CA**, such as the Qlik Sense
  server certificates you give Butler SOS, are not affected. A private CA is not part of the
  emSign hierarchy.
- **Connections to servers with publicly issued certificates** can be affected, if the certificate
  was issued by emSign. Typical examples are InfluxDB (a cloud service, or a server with a public
  certificate), MQTT brokers reached over TLS, New Relic, and webhooks or other HTTPS endpoints
  you have configured. The same applies if you have added an emSign certificate to a CA file of
  your own.

Few public servers use emSign certificates, so most installations will see no difference.

---

## How to check a server's certificate

Run this from any machine with OpenSSL. Replace the host name and port with those of the server
Butler SOS connects to:

```bash
openssl s_client -connect influxdb.example.com:443 -showcerts </dev/null 2>/dev/null | grep -E '^ *(s|i):'
```

The `i:` lines show who issued each certificate in the chain:

- **No line mentions emSign or eMudhra:** the connection is not affected.
- **A line mentions emSign or eMudhra:** the connection might be affected, but this alone does not
  prove it, because only eight of emSign's intermediates are blocked. Confirm it in one of two
  ways:
    - Run the new Butler SOS release in a test environment against that server, and look for the
      error described below.
    - Ask whoever runs the server, or emSign, whether the certificate was issued through one of the
      intermediates distrusted in October 2026.

---

## What you see if a connection is affected

Butler SOS logs an error for that connection, because the certificate can no longer be verified.
The error says that the certificate has been revoked (`CERT_REVOKED`). Other connections keep
working.

---

## What to do

If a connection is affected, ask whoever runs that server to replace its certificate with one that
does not chain through a blocked intermediate. A certificate that emSign reissues through one of
its unaffected intermediates works too. Certificates that only look similar, for example other
emSign certificates, do not need replacing.

Do not work around the failure by turning off certificate checking for that connection. These
eight intermediates were blocked because certificates issued through them can no longer be relied
on.
