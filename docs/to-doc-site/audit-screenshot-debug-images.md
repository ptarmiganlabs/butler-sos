# Audit Screenshots: Debug Images Now Require Debug Logging

Butler SOS no longer writes screenshot debug images to disk unless the log level is set to
`debug`. Previously it wrote them at **every** log level, including the default.

If you have an `audit-events/debug` folder that has been quietly filling with PNG files, this
is why it has stopped growing. Nothing is broken, and no configuration change is needed.

---

## What was happening before

When Butler SOS downloads a screenshot for an audit event, it sometimes has to trim the image.
The Qlik Sense Printing Service renders whole rows of a table, so a table that is partly
scrolled out of view — a pivot table, for example — comes back taller than what the user
actually saw on screen. Butler SOS crops it to match.

While doing that trimming, Butler SOS also produced diagnostic output intended for
troubleshooting that process:

- **PNG files written to `audit-events/debug`**, inside the Butler SOS working directory. One
  file per cropped screenshot, sometimes three, named after the image dimensions.
- **Log entries** at `info` level describing the internal trim geometry.
- **A full scan of every pixel** in the image, done solely to produce one number that appears
  in one diagnostic log line.

All three were meant to happen only while diagnosing a problem. Because of a faulty check they
happened all the time, on every cropped screenshot, no matter how the log level was set.

For a busy Qlik Sense environment this meant three things worth knowing about:

- **Disk consumption grew unbounded.** Nothing ever removed those files.
- **Every screenshot cost more CPU than it needed to**, because of the full-image pixel scan
  whose only output was a log line nobody would see at the default log level.
- **Log lines described internal image geometry at `info` level**, which is not information an
  operator has any use for during normal running.

---

## What happens now

All of it is tied to the log level:

| Log level | Debug images written | Trim geometry logged |
|-----------|---------------------|----------------------|
| `error`, `warn`, `info`, `verbose` | No | No |
| `debug`, `silly` | Yes | Yes, at `debug` level |

Screenshot capture, trimming and storage are **completely unchanged**. The images Butler SOS
stores in your configured screenshot locations are exactly the same as before. Only the extra
diagnostic copies are affected.

The diagnostic log entries have also moved from `info` to `debug`. If you have log searches or
alerts matching phrases such as `Scroll composite`, `Overflow composite` or
`Saved pre-crop debug image`, they will no longer match at the default log level. Those
messages describe internal image geometry and were never intended as operational signals.

---

## What you should do

**In most cases, nothing.** This is the behaviour you would have expected all along.

**Clean up the old files.** Any PNGs already written are still there. Look for an
`audit-events/debug` folder inside the directory Butler SOS runs from, check how large it has
grown, and delete the contents — nothing reads them. On a long-running installation handling
many screenshots this can be a substantial amount of space.

**If you were relying on those images for troubleshooting**, set `Butler-SOS.logLevel` to
`debug` and they will be written again exactly as before.

```yaml
Butler-SOS:
    logLevel: debug # Only while investigating. Produces a lot of output.
```

Remember to set it back afterwards. `debug` is verbose across the whole of Butler SOS, not just
screenshot handling, and turning it on also re-enables the unbounded growth of the debug image
folder.

---

## A note on where the files go

The debug image folder is always `audit-events/debug`, relative to the directory Butler SOS is
started from. It does not follow your configured screenshot storage locations and is not
configurable.

This matters most in Docker, where the working directory belongs to the container: unless it is
on a mounted volume, the files disappear when the container is replaced — and if the container
user cannot write there, Butler SOS carries on regardless without reporting a problem, since
these images are diagnostic only.

---

## Related settings

- `Butler-SOS.logLevel` — controls whether these diagnostics are produced at all. See the
  logging configuration page.
- `Butler-SOS.auditEvents.*` — audit event and screenshot configuration, including where
  captured screenshots are stored.
