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

Butler SOS unpacks screenshots of up to **20 million pixels**. An image stored with 16 bits per
colour channel, rather than the usual 8, counts double, because unpacking it takes twice the
memory. For comparison:

| Image                 | Pixels       |
| --------------------- | ------------ |
| Full HD (1920 x 1080) | 2.1 million  |
| A whole 4K screen     | 8.3 million  |
| A whole 5K screen     | 14.7 million |

Screenshots of ordinary sheets and objects are far below the limit. At the limit, unpacking
takes about 0.2 seconds and roughly 320 MB of extra memory; writing the `_metadata` copy as
well takes about 0.8 seconds and roughly 470 MB. A 16-bit image at the limit (10 million
pixels, counted as 20 million) takes about the same memory but about 0.5 seconds. These
figures were measured on Node.js 24.

Some files are never unpacked, whatever their size, because they are not normal screenshots
and unpacking them could use unbounded memory: images with a width or height of zero, images
with more than one header, images whose header describes a format PNG does not allow, images
with more than one colour palette or a palette of more than 256 colours, and images split into
more than 100,000 pieces (chunks). Real screenshots use a few thousand at
most.
Interlaced images are unpacked only after Butler SOS has checked that their data does not
unpack to more than their header says.

---

## What happens to a screenshot over the limit

- The screenshot is stored exactly as downloaded, without trimming.
- The separate `_metadata` copy is not written.
- The audit event itself is stored as normal, in every destination.

Butler SOS checks a screenshot only when it has to unpack it: to trim it, to write the
`_metadata` copy, or because it is logging at debug level. A screenshot that needs none of
these is stored as downloaded without being unpacked, and nothing is logged, whatever its size.

When an unpack is refused, Butler SOS logs one warning naming the reason. When the screenshot
needed trimming, or Butler SOS is logging at debug level, it looks like this (the words "and
without its \_metadata copy" appear only when the metadata header is switched on):

```text
AUDIT API: Screenshot stored as downloaded, untrimmed and without its _metadata copy: image is 800x1800354 (1440283200 pixels), above the decode budget of 20000000 pixels; not decoded. selectionTxnId=... eventId=...
```

When the screenshot needed no trimming but the metadata header is switched on, the warning
reads instead:

```text
AUDIT API: Screenshot _metadata copy not written: image is 800x1800354 (1440283200 pixels), above the decode budget of 20000000 pixels; not decoded. selectionTxnId=... eventId=...
```

The same `_metadata copy not written` warning appears for a screenshot within the limit whose
metadata copy would exceed it, because a long header line makes a narrow image much wider:
`output would be 1012x199106 (201495272 pixels), above the decode budget of 20000000 pixels;
not built`.

The files that are never unpacked give one of these reasons instead of the size:
`PNG header gives 0x...`, `PNG has a second IHDR chunk`,
`PNG colour type ... with bit depth ... is not a valid combination`,
`interlaced PNG data unpacks to more than its ... header allows`,
`PNG has more than one palette chunk`, `PNG palette chunk is ... bytes`,
`PNG has more than 100000 chunks`, `not a PNG` or
`PNG header chunk has the wrong length`.

None of these is an error. A warning that starts `AUDIT API: Failed to crop screenshot PNG` or
`AUDIT API: Failed to add metadata header to screenshot PNG` is different: it means the image
could not be processed at all, for example because the file is damaged.

---

## Do I need to do anything?

No. There is no new or changed configuration setting.

A warning like this usually means Qlik Sense was asked for an image much taller than the
screen, for example of a table scrolled far down. The audit event is complete; only its
screenshot is untrimmed. If the warnings name images you would expect to be small, note the
event IDs and check which client sent them.
