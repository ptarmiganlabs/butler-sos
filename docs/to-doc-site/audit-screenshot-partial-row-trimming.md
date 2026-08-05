# Screenshot trimming now works on colour-coded table rows

## What changed

When Butler SOS stores a screenshot of a Qlik Sense sheet, it trims away the partially-visible
bottom row that the rendering service sometimes includes — the sliver of a row that the user
could not actually see on screen. To find where to cut, Butler SOS looks for the horizontal grid
line beneath the last fully-visible row.

That search used to examine only the red component of each pixel. On tables where the row above
the grid line is colour-coded — heat maps, conditional background colours, alternating themed
fills — the colours can differ from one another while sharing the same amount of red. Butler SOS
read those rows as blank, concluded it had not found a real grid line, and stored the screenshot
untrimmed.

The search now compares all three colour components. Grid lines beneath colour-coded rows are
found correctly, and the partial row is trimmed as intended.

## What you will notice

Screenshots of sheets containing colour-coded tables may be slightly shorter than before, because
the partial bottom row is now removed. This affects the stored image only — nothing changes about
which events are captured, where files are written, or how they are named.

Screenshots of sheets without colour-coded tables are unchanged.

## Do I need to do anything?

No. There is no new or changed configuration setting, and no action is required when upgrading.

If you keep screenshots from before and after the upgrade side by side, expect the newer ones to
be a few pixels shorter for the affected sheets. That is the fix working, not a fault.

## If a screenshot looks wrong

Trimming is driven by information the Butler SOS browser extension sends alongside each event. If
a stored screenshot appears to be missing a row it should have kept, or is still including a row
it should have trimmed, enable debug logging for Butler SOS and reproduce the event.

Debug logging writes intermediate copies of the image to an `audit-events/debug` folder beneath
the working directory, which show what the trimming step actually did. Note that debug logging
makes screenshot processing noticeably slower, so turn it on only while investigating and off
again afterwards.
