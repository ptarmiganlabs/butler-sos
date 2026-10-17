# Butler SOS Now Timestamps Its Own Data Points

Every data point Butler SOS writes to InfluxDB now carries a timestamp set by Butler SOS,
**once, just before the point is first written**. A retried write sends exactly the same
points again instead of new ones, so a retry can no longer store data twice.

This applies to InfluxDB v1, v2 and v3, and to all metrics: health metrics, user sessions,
user events, log events, event counts, queue metrics, Butler SOS memory usage and error events.

---

## What was wrong

A data point in InfluxDB is identified by its measurement, its tags and its timestamp. Write
the same point twice with the same timestamp, and InfluxDB keeps one. Write it twice with
different timestamps, and InfluxDB keeps two.

Until now Butler SOS sent its data points without a timestamp:

- With **InfluxDB v2 and v3**, the InfluxDB client library inside Butler SOS stamped each point
  with the current time **every time it tried to write it**.
- With **InfluxDB v1**, the InfluxDB server stamped each point with the time it received it.

Either way, a retry produced points with a new time. That matters because a write can reach
InfluxDB and be stored, yet still look failed to Butler SOS — most often when the reply takes
longer than the timeout. Butler SOS then retried, and InfluxDB stored every point in that write
a second time.

The result was quietly inflated numbers on dashboards that add things up — event counts, user
event counts, session counts — after any period of slow or unstable InfluxDB connections.

---

## What happens now

Butler SOS gives every point its timestamp before the first write attempt, and keeps it for
every retry. If an earlier attempt did reach InfluxDB, the retry overwrites the same points
instead of adding copies.

Each timestamp is the time on the Butler SOS server, to the millisecond, when the write
started. The finer digits of the timestamp hold a counter that goes up with every point, so
that every point gets a different timestamp. That way two identical events in the same
millisecond — one user opening the same app in two browser tabs at once, for example — are
still stored as two points, rather than one overwriting the other. The same holds when the
server's clock is set back and a millisecond comes round a second time.

---

## What you may notice

### InfluxDB v1: times now come from the Butler SOS server's clock

With InfluxDB v1, data points used to get their time from the **InfluxDB server's** clock. They
now get it from the **Butler SOS server's** clock. With InfluxDB v2 and v3 this was already the
case.

If the two servers' clocks agree, nothing changes. If they differ, data written after the
upgrade is shifted by the difference — a Butler SOS server running two minutes fast puts new
data two minutes ahead of where it used to land, which can look like a small gap or overlap on
a dashboard at the moment of the upgrade.

**Keep the Butler SOS server's clock synchronised** — with NTP, or with the Windows Time service
on a domain-joined Windows server. That was already needed for InfluxDB v2 and v3.

### Log events keep the time Butler SOS received them

Log events are stamped with the time Butler SOS processes them, as before — not the time
written in the Qlik Sense log file row. Dashboards built on log events see no change.

### Raw timestamps have non-zero final digits

If you look at raw timestamps in nanoseconds, the last six digits are not zeros: points
written one after another look like `1792231788937000412`, `1792231788937000413`,
`1792231788941000414`. That is the counter described above. It is far below anything a
dashboard shows.

### Fewer inflated counts after connection problems

After a period of slow or unstable connections to InfluxDB, sums and counts no longer jump
because of retried writes. Compared with before the upgrade, those numbers can come out lower.
The new numbers are the correct ones.

---

## What has not changed

- **Audit events** written to InfluxDB use their own write path. Where an audit event carries its
  own time, that time is used, as before.
- **How often Butler SOS retries**, and what happens when InfluxDB cannot be reached at all.
- **No configuration is needed.** There are no new settings.

---

## Related settings

None. The behaviour applies to every InfluxDB version Butler SOS supports.
