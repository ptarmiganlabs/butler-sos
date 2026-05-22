# Audit Screenshot Redirects and Allowed Hosts

Butler SOS can follow HTTP redirects when downloading Audit.qs screenshots. This is useful in Qlik Sense environments where the screenshot URL points at a reverse proxy, load balancer, or public entry point that redirects the request before the image is returned.

Redirect handling is intentionally strict. Butler SOS does not let the HTTP client follow redirects automatically. Instead, it checks each redirect response, validates the `Location` header, and only then decides whether to continue.

## Allowed Hosts

All intermediate redirect hosts must be present in `allowedImageDownloadHosts` setting in config file.

For a screenshot download to be allowed, the original screenshot URL hostname and every redirected hostname in the chain must be allowed. Butler SOS validates each hop before following it.

For example, if the browser receives this screenshot URL:

```text
https://qlik.example.com/screenshot.png
```

and the download is redirected like this:

```text
https://qlik.example.com/screenshot.png
  -> https://proxy.example.com/redirected/screenshot.png
  -> https://node1.example.com/tempcontent/screenshot.png
```

then the config must include all three hostnames:

```yaml
Butler-SOS:
  auditEvents:
    destination:
      screenshots:
        allowedImageDownloadHosts:
          - qlik.example.com
          - proxy.example.com
          - node1.example.com
```

If a redirect uses a relative path, such as `/redirected/screenshot.png`, it is resolved against the current URL. In that case the hostname does not change, so no additional hostname is needed.

The allow-list contains hostnames only. Do not include full URLs, paths, schemes, or ports.

## What Butler SOS Allows

Butler SOS follows a redirect only when all of these are true:

- The HTTP status is `301`, `302`, `303`, `307`, or `308`.
- The response includes a valid `Location` header.
- The resolved redirect URL uses `http:` or `https:`.
- The redirected hostname is listed in `allowedImageDownloadHosts`.
- The redirect chain has not exceeded the maximum redirect count.

If any check fails, Butler SOS blocks the screenshot download and logs a warning explaining why the redirect was rejected.

## Why Redirects Are Checked Manually

Screenshot URLs come from audit event payloads. Because Butler SOS downloads those URLs from the server side, redirects must be treated as security-sensitive. Without validation, a redirect could send Butler SOS to an internal service, local address, cloud metadata endpoint, or another host that should not be contacted.

Manual redirect handling keeps the same security boundary for the original URL and every redirect target.

## Qlik Session Cookies During Redirects

When screenshot authentication uses `qpsTicket` or `userTicket`, the first request may redeem a QPS ticket and receive a Qlik session cookie named `X-Qlik-Session-*`.

If that happens during a redirect response, Butler SOS carries the session cookie forward to the next redirected request. This matters because QPS tickets are single-use. The redirected request should continue with the redeemed Qlik session cookie, not try to reuse the ticket.

When session caching is enabled, the cached Qlik session cookie is sent from the first request and is also carried across allowed redirects.

For `userTicket`, the QPS virtual proxy is derived from the original screenshot URL. Redirect targets are checked for allowed hosts, but they are not used to choose a different QPS ticket endpoint.

## Common Configuration Pattern

For environments with a reverse proxy in front of Qlik Sense, include every hostname that can appear in the screenshot redirect chain:

```yaml
Butler-SOS:
  auditEvents:
    destination:
      screenshots:
        enable: true
        allowedImageDownloadHosts:
          - qlik.example.com
          - qlik-proxy.example.com
          - qlik-node-1.example.com
          - qlik-node-2.example.com
```

If downloads are blocked with warnings such as `redirect blocked reason=host-not-allowed`, check the hostname in the logged redirect `Location` value and add that hostname to `allowedImageDownloadHosts` if it is a legitimate Qlik Sense or reverse proxy host.
