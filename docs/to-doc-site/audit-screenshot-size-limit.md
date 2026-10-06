# Screenshot Events: the Size Limit

When Butler SOS downloads a screenshot for an audit event, it may trim the image to what the
user saw on screen, and it may write a copy with a metadata header (the `_metadata` file). Both
mean unpacking the image in memory. Butler SOS versions after 15.0.1 check a screenshot before
unpacking it, and leave very large images as they are.

---

## Why there is a limit

Unpacking a screenshot happens all at once, and Butler SOS does nothing else while it runs. It
also needs far more memory than the file takes on disk: a mostly white table image of a few
hundred kilobytes can unpack to gigabytes. Earlier versions unpacked every screenshot whatever
its size, so a single very large one could stall Butler SOS for seconds or exhaust its memory.

---

## The limit

Butler SOS unpacks screenshots of up to **20 million pixels**. For comparison:

| Image                 | Pixels       |
| --------------------- | ------------ |
| Full HD (1920 x 1080) | 2.1 million  |
| A whole 4K screen     | 8.3 million  |
| A whole 5K screen     | 14.7 million |

Screenshots of ordinary sheets and objects are far below the limit. At the limit, unpacking
takes about 0.2 seconds and roughly 320 MB of extra memory; writing the `_metadata` copy as
well takes about 0.8 seconds and roughly 470 MB. These figures were measured on Node.js 24.

Some files are never unpacked, whatever their size, because they are not normal screenshots
and unpacking them could use unbounded memory: images with a width or height of zero,
interlaced images, and images with more than one header.

---

## What happens to a screenshot over the limit

- The screenshot is stored exactly as downloaded, without trimming.
- The separate `_metadata` copy is not written.
- The audit event itself is stored as normal, in every destination.

Butler SOS logs a warning that names the image size. When the screenshot needed trimming, or
Butler SOS is logging at debug level, the warning looks like this:

```text
AUDIT API: Failed to crop screenshot PNG. selectionTxnId=... error=Error message='cropPngBuffer: image is 800x1800354 (1440283200 pixels), above the decode budget of 20000000 pixels; not decoded' ...
```

When the metadata header is switched on, there is also a warning starting
`AUDIT API: Failed to add metadata header to screenshot PNG.`, with the same size text. A
screenshot within the limit whose metadata copy would exceed it, because a long header line
makes a narrow image much wider, gives this instead:

```text
... message='addTextHeaderToPng: output would be 1012x199106 (201495272 pixels), above the decode budget of 20000000 pixels; not built' ...
```

The files that are never unpacked give one of these instead of the size text:
`PNG header gives 0x...`, `interlaced PNG`, `PNG has a second IHDR chunk`, `not a PNG` or
`PNG header chunk has the wrong length`.

---

## Do I need to do anything?

No. There is no new or changed configuration setting.

A warning like this usually means Qlik Sense was asked for an image much taller than the
screen, for example of a table scrolled far down. The audit event is complete; only its
screenshot is untrimmed. If the warnings name images you would expect to be small, note the
event IDs and check which client sent them.
