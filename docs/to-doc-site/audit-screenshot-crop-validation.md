# Screenshot Events: Checking the Crop Information

When the Audit.qs browser extension reports a screenshot of a Qlik Sense chart or table, it
usually sends some extra information along with the screenshot link: the size of the object
as the user saw it on screen, and how far the user had scrolled inside it. Butler SOS calls
this the **crop information**. It uses it to trim the image it downloads from Qlik Sense so
that the stored screenshot shows exactly what the user saw, no more and no less.

Butler SOS versions after 15.0.1 check the crop information before accepting a screenshot
event. Earlier versions accepted whatever the extension sent. This page explains what is
checked, what is accepted, and how to recognise an event that was refused.

---

## Why the check exists

The crop information arrives from the user's web browser, so Butler SOS cannot simply trust
it. Absurd values — negative sizes, or a size of billions of pixels — never come from a real
screenshot, but they could be sent deliberately to make Butler SOS waste time and memory
processing an image. The check stops such values before any image work is done.

---

## What is accepted

Every kind of crop information a real Audit.qs installation sends is accepted. This page covers
the crop information only: an event can still be refused for other reasons, and the
`Payload validation failed` log line names the field that caused it.

- **Crop information sent as `null`** (`"crop": null`). Audit.qs sends this when the
  screenshot was taken by one of its fallback methods rather than its normal one. When that
  fallback produced a screenshot link, the screenshot is stored untrimmed.
- **Fractional values**, such as a scroll position of 1234.5 pixels. Browsers that are zoomed
  to something other than 100%, and screens with fractional scaling, report scroll positions
  like this. Butler SOS rounds them down to whole pixels before trimming.
- **Very large scroll positions.** A Qlik Sense table (the newer type, not the legacy one)
  scrolls through all of its rows at once, so a table with tens of thousands of rows can
  report a scroll position of more than a million pixels: about 1.8 million for a table of
  72,000 rows, scrolled to the bottom. These are accepted. Audit.qs asks Qlik Sense for an
  image taller by the scroll position, so a deep scroll usually produces a screenshot too
  large for Butler SOS to unpack. It is then stored as downloaded, without trimming; see
  [Screenshot events: the size limit](audit-screenshot-size-limit.md).
- **No `crop` field at all.** Audit.qs always includes the field, but other clients posting
  to the audit API may leave it out. The screenshot is then stored untrimmed, as with `null`.

---

## What is refused

A screenshot event is refused when its crop information contains any of the following:

| Problem                                                                                 | Example                   |
| --------------------------------------------------------------------------------------- | ------------------------- |
| A negative size, position or scroll value                                               | `"top": -1`               |
| A width or height of zero                                                               | `"width": 0`              |
| A size or position larger than 32,767 pixels, the largest image a browser can draw      | `"height": 40000`         |
| A scroll position larger than 33,554,432 pixels, the largest page a browser can lay out | `"scrollTop": 50000000`   |
| A value that is not a number                                                            | `"width": "800"`          |
| No width, or no height                                                                  | `{ "top": 0, "left": 0 }` |
| An empty set of values, which has no width or height                                    | `"crop": {}`              |
| Crop information that is neither a set of values nor `null`                             | `"crop": "full"`          |

Audit.qs does not send any of these when it is working normally.

---

## What happens to a refused event

The **whole event is dropped**, not just the crop information. Nothing is written to any
audit destination for it (JSON, Parquet, QVD or InfluxDB), and no screenshot is downloaded.

The sender receives HTTP status **422** with a response body like this:

```json
{
    "status": "error",
    "receivedAt": "2026-10-06T09:15:02.118Z",
    "outcome": "dropped",
    "reason": "Payload validation failed",
    "details": {
        "errors": [
            {
                "instancePath": "/event/crop/top",
                "schemaPath": "#/properties/event/properties/crop/properties/top/minimum",
                "keyword": "minimum",
                "params": { "comparison": ">=", "limit": 0 },
                "message": "must be >= 0"
            }
        ]
    }
}
```

Butler SOS also writes a warning to its log. The `instancePath` names the offending value:

```text
AUDIT API: Payload validation failed type=screenshot.url.received eventId=... errors=[{"instancePath":"/event/crop/top", ... "message":"must be >= 0"}]
```

---

## Do I need to do anything?

No. There is no new or changed configuration setting, and no action is needed when upgrading.

If you see `Payload validation failed` warnings that mention `/event/crop`, note the event IDs
and check which client is posting to the Butler SOS audit API. An unmodified Audit.qs extension
is not expected to send crop information that fails these checks, so a steady stream of such
warnings is worth investigating, and reporting if Audit.qs turns out to be the sender.
