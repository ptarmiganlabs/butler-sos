# Prometheus: the Node.js Metrics Endpoint

When Prometheus support is enabled, Butler SOS starts **two** HTTP endpoints, not one:

1. The **Butler SOS metrics endpoint** — the Qlik Sense metrics you enabled Butler SOS to
   collect. This is the one you configure with `Butler-SOS.prometheus.host` and `port`.
2. The **Node.js metrics endpoint** — internal health figures for the Butler SOS process
   itself.

The second endpoint has always existed, but until now it was fixed in place and undocumented.
It did not appear in the config file template and could not be changed. Two new optional
settings, `nodeMetricsHost` and `nodeMetricsPort`, now put it under your control.

This page describes what that second endpoint serves, where it listens, and the one thing about
it that most often catches administrators out.

---

## What the two endpoints serve

| | Butler SOS metrics endpoint | Node.js metrics endpoint |
|---|---|---|
| **Configured by** | `prometheus.host` / `prometheus.port` | `prometheus.nodeMetricsHost` / `nodeMetricsPort` |
| **Default** | `0.0.0.0`, port `9842` | `0.0.0.0`, port `9001` |
| **What it tells you** | How your Qlik Sense environment is doing | How the Butler SOS process itself is doing |
| **Typical content** | Engine CPU and memory, session and app counts, cache hit rates, user activity | Memory (heap) usage, event loop lag, garbage collection, open handles and file descriptors |
| **Who usually cares** | Everyone monitoring Qlik Sense | Whoever operates Butler SOS |

The Node.js metrics endpoint answers questions about Butler SOS as a piece of software: is it
leaking memory, is it struggling to keep up with the volume of events being sent to it, is it
holding open more connections than expected. It says nothing about Qlik Sense.

If Butler SOS is behaving itself, you can safely ignore this endpoint. It becomes valuable when
Butler SOS is using more memory than you expect, is slow to respond, or is being investigated
for a suspected problem — and it is also useful to scrape continuously so you have history to
look back on when that day comes.

---

## Configuration

```yaml
Butler-SOS:
    prometheus:
        enable: false # Default false
        host: <IP or FQDN where Butler SOS is running> # Default 0.0.0.0, i.e. all available IPs
        port: 9842 # Port for Prometheus endpoint. Default 9842
        # Butler SOS exposes a SECOND endpoint alongside the one above, serving Node.js
        # internal process metrics (heap, event loop lag, GC, handles).
        # Both settings below are optional and default to 0.0.0.0:9001, i.e. all available
        # IPs on port 9001. That is the address this endpoint has always used, so leaving
        # them commented out keeps the existing behaviour.
        # Note this endpoint does NOT follow the `host` setting above. If you restrict
        # `host` and want the Node.js metrics restricted too, set nodeMetricsHost explicitly.
        # nodeMetricsHost: 127.0.0.1 # Optional. Default 0.0.0.0 (all available IPs)
        # nodeMetricsPort: 9001 # Optional. Default 9001
```

| Key | Required | Default | Description |
|-----|----------|---------|-------------|
| `nodeMetricsHost` | No | `0.0.0.0` | IP address the Node.js metrics endpoint listens on. `0.0.0.0` means every network interface on the server. |
| `nodeMetricsPort` | No | `9001` | Port the Node.js metrics endpoint listens on. |

Both settings only take effect when `prometheus.enable` is `true`. If Prometheus support is
switched off, neither endpoint starts.

### Upgrading changes nothing

The defaults are exactly the address this endpoint has always used. If you leave both settings
out of your config file — or leave them commented out, as in the template above — Butler SOS
behaves after the upgrade exactly as it did before. Any existing Prometheus scrape job pointed
at port 9001 keeps working untouched.

---

## The one thing that catches people out

**The Node.js metrics endpoint does not follow the `host` setting.**

It is easy to assume that restricting `prometheus.host` restricts everything Prometheus-related.
It does not. The two endpoints are configured independently, and setting `host` has no effect
whatsoever on where the Node.js metrics endpoint listens.

So if you have done this, expecting to limit Prometheus to the loopback interface:

```yaml
Butler-SOS:
    prometheus:
        enable: true
        host: 127.0.0.1 # Only reachable from the server itself
        port: 9842
```

…then the Butler SOS metrics on port 9842 are indeed restricted — but the Node.js metrics on
port 9001 are still listening on **every** network interface, reachable by anyone who can route
to the server. To restrict both, you must say so explicitly:

```yaml
Butler-SOS:
    prometheus:
        enable: true
        host: 127.0.0.1
        port: 9842
        nodeMetricsHost: 127.0.0.1 # Now restricted too
        nodeMetricsPort: 9001
```

### Why it works this way

This is deliberate, not an oversight. Making the Node.js endpoint inherit `host` would have
caused two problems for existing installations:

- **It would silently move an established endpoint on upgrade.** Anyone who had set `host` to a
  specific address would find their port 9001 scrape job quietly stop working, with no warning
  and nothing in the config file to explain why.
- **It would turn a working setup into a startup failure.** `host` is quite often set to a
  cluster name, load-balancer address or virtual IP that is not an actual local network
  interface. That works fine for the main endpoint, but Butler SOS cannot bind a listener to an
  address the server does not hold — so inheriting it would stop Butler SOS from starting at
  all.

Requiring an explicit setting means nothing changes until you decide it should.

---

## Deciding what to set

**Leave both unset** if Butler SOS runs on a server that only trusted operators and your
monitoring system can reach. This is the existing behaviour and is fine for most installations.

**Set `nodeMetricsHost`** when the server is reachable from a wider network than you would like,
and you want the process-internal figures visible only to specific systems. Set it to the
address of the interface your Prometheus server scrapes over, or to `127.0.0.1` if Prometheus
runs on the same host.

**Set `nodeMetricsPort`** when port 9001 is already taken on that server by something else. If
you change it, remember to update your Prometheus scrape configuration to match.

### A note on sensitivity

Neither endpoint requires authentication, so treat the ability to reach them as the only access
control there is. The Node.js metrics contain no Qlik Sense data, no user names and no
credentials — they are counters and gauges about the Butler SOS process. They do, however,
confirm that Butler SOS is running on that host and reveal something about its size and load,
which is more than you may wish to publish on an untrusted network.

---

## Confirming it works

After starting Butler SOS with Prometheus enabled, the log records both endpoints, each on its
own line, naming the address and port each one bound to. Check the log first — if a line is
missing, or reports an address you did not expect, that is your answer.

To test the endpoint directly, request the `/metrics` path on the Node.js metrics address and
port from a machine that should be able to reach it. A successful request returns plain text:
many lines of metric names and numbers. If the request is refused or times out, the usual causes
are, in order of likelihood:

- Prometheus support is not enabled (`prometheus.enable` is `false`), so neither endpoint exists
- a firewall between you and the Butler SOS server is blocking the port
- `nodeMetricsHost` has been set to an address that does not include the interface you are
  connecting over — for example `127.0.0.1` while you are connecting from another machine
- something else on the server is already using the port

If Butler SOS did not start at all, check the log for an error naming the Node.js metrics
address and port. Butler SOS treats an unbindable metrics endpoint as a fatal startup error
rather than carrying on without it — the most common cause is an address the server does not
actually hold, or a port already in use.

---

## Related settings

- `Butler-SOS.prometheus.enable` — the master switch for both endpoints.
- `Butler-SOS.prometheus.host` and `port` — the Butler SOS (Qlik Sense) metrics endpoint. See
  the main Prometheus configuration page.
