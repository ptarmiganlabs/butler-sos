import { describe, expect, jest, test } from '@jest/globals';
import pngjs from 'pngjs';
import crypto from 'crypto';

import { addTextHeaderToPng } from '../audit-screenshot-metadata-image.js';

const { PNG } = pngjs;

/**
 * Builds a deterministic, non-uniform source image.
 *
 * @param {number} w - Width.
 * @param {number} h - Height.
 * @param {boolean} [varyAlpha] - Give pixels varying transparency instead of full opacity.
 * @returns {Buffer} Encoded PNG.
 */
function makeSourcePng(w, h, varyAlpha = false) {
    const png = new PNG({ width: w, height: h });
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            png.data[i] = (x * 5 + y * 3) % 256;
            png.data[i + 1] = (x * 9 + y * 11) % 256;
            png.data[i + 2] = (x * 13 + y * 2) % 256;
            png.data[i + 3] = varyAlpha ? (x * 7 + y * 19) % 256 : 255;
        }
    }
    return PNG.sync.write(png);
}

const LINES = [
    { key: 'Event', value: 'sheet-viewed' },
    { key: 'User', value: 'LAB\\alice' },
    { key: 'App', value: 'Sales dashboard' },
];

describe('addTextHeaderToPng', () => {
    // Band = paddingTop(8) + lines * (fontHeight 7 + lineSpacing 3) + paddingBottom(8).
    const BAND_FOR_3_LINES = 46;

    test('adds a header band of exactly the documented height', () => {
        const source = makeSourcePng(120, 40);

        const out = PNG.sync.read(addTextHeaderToPng(source, LINES));

        // Asserted exactly, not as "taller than". `toBeGreaterThanOrEqual(120)` on the width
        // was unfalsifiable, since outWidth is Math.max(src.width, ...) — and a band 20px
        // short, clipping the last line and the separator, passed every other test here.
        expect(out.height).toBe(40 + BAND_FOR_3_LINES);
        // 120px cannot fit three rendered lines, so the canvas widens to the text.
        expect(out.width).toBe(136);
    });

    test('does not shrink a source wider than the header text', () => {
        // The other side of Math.max: a wide screenshot keeps its own width.
        const out = PNG.sync.read(addTextHeaderToPng(makeSourcePng(400, 40), LINES));

        expect(out.width).toBe(400);
    });

    test('copies the source pixels unchanged below the header', () => {
        // The whole point of the function is to annotate without altering the screenshot.
        const src = PNG.sync.read(makeSourcePng(60, 30));
        const out = PNG.sync.read(addTextHeaderToPng(PNG.sync.write(src), LINES));

        // Fixed, not derived from `out`: `out.height - src.height` self-adjusts to whatever
        // the function produced, so it could never detect a wrong band height.
        const headerHeight = BAND_FOR_3_LINES;
        expect(out.height).toBe(src.height + headerHeight);
        let mismatches = 0;
        for (let y = 0; y < src.height; y++) {
            for (let x = 0; x < src.width; x++) {
                const s = (y * src.width + x) * 4;
                const d = ((y + headerHeight) * out.width + x) * 4;
                if (
                    src.data[s] !== out.data[d] ||
                    src.data[s + 1] !== out.data[d + 1] ||
                    src.data[s + 2] !== out.data[d + 2]
                ) {
                    mismatches++;
                }
            }
        }

        expect(mismatches).toBe(0);
    });

    test('preserves the alpha channel', () => {
        // Separate from the RGB comparison above, which deliberately ignores index +3, and from
        // the pinned baseline, whose fixture is fully opaque. Between them nothing in this file
        // could see the alpha channel: hardcoding `out.data[dstIdx + 3] = 255` in the blit
        // passed every other test here while silently flattening any transparent screenshot.
        const src = PNG.sync.read(makeSourcePng(40, 24, true));
        const out = PNG.sync.read(addTextHeaderToPng(PNG.sync.write(src), LINES));

        const headerHeight = out.height - src.height;
        const alphaMismatches = [];
        for (let y = 0; y < src.height; y++) {
            for (let x = 0; x < src.width; x++) {
                const s = (y * src.width + x) * 4 + 3;
                const d = ((y + headerHeight) * out.width + x) * 4 + 3;
                if (src.data[s] !== out.data[d]) alphaMismatches.push({ x, y });
            }
        }

        expect(alphaMismatches).toEqual([]);
        // The fixture must actually contain transparency, or the assertion above is vacuous.
        expect(src.data.some((v, i) => i % 4 === 3 && v !== 255)).toBe(true);
    });

    test('reuses a supplied decoded image instead of decoding again', () => {
        // cropPngBuffer hands its already-decoded pixels across so the pipeline stops encoding
        // an image and immediately decoding the same bytes back. Spying on the decoder is the
        // only way to see that: the output is identical either way.
        const source = makeSourcePng(50, 30);
        const decoded = PNG.sync.read(source);

        const readSpy = jest.spyOn(PNG.sync, 'read');
        try {
            const withHandoff = addTextHeaderToPng(source, LINES, { decoded });
            expect(readSpy).not.toHaveBeenCalled();

            readSpy.mockClear();
            const withoutHandoff = addTextHeaderToPng(source, LINES);
            expect(readSpy).toHaveBeenCalledTimes(1);

            // Same pixels in, same bytes out — the handoff is an optimisation, not a variant.
            expect(Buffer.compare(withHandoff, withoutHandoff)).toBe(0);
        } finally {
            readSpy.mockRestore();
        }
    });

    test('output bytes match the captured baseline', () => {
        // A plain regression pin: any change to the header band's layout, font rendering or
        // encoder settings has to be deliberate enough to re-capture the hash.
        //
        // Like the hashes in audit-screenshots-byte-identity.test.js, this depends on the zlib
        // build inside Node as much as on pngjs — see the header comment there before
        // re-capturing.
        const out = addTextHeaderToPng(makeSourcePng(80, 40), LINES);

        expect({
            bytes: out.length,
            hash: crypto.createHash('sha256').update(out).digest('hex'),
        }).toEqual({
            bytes: 5573,
            hash: 'b1dfa00b6fa3b34793a69b1f3007682aeda480db199c8e501638e2d00e713223',
        });
    });

    test('returns a Buffer synchronously', () => {
        // The async decode this briefly used was reverted: pngjs surfaces decode failures on
        // internal streams a caller cannot reach without private fields, and a PNG whose IHDR
        // overstated its height killed the process instead of producing an image. Asserting
        // the concrete return type here means a future re-attempt has to update this test
        // rather than silently changing the contract.
        const result = addTextHeaderToPng(makeSourcePng(20, 20), LINES);

        expect(Buffer.isBuffer(result)).toBe(true);
    });

    test.each([
        ['a truncated PNG', (buf) => buf.subarray(0, 30)],
        ['a non-PNG buffer', () => Buffer.from('not a png at all')],
    ])('throws on %s', (_label, mangle) => {
        expect(() => addTextHeaderToPng(mangle(makeSourcePng(20, 20)), LINES)).toThrow();
    });

    test('rejects a decoded image whose dimensions disagree with the buffer', () => {
        // Once `decoded` is accepted, `pngBuffer` is never read again — the whole output is
        // built from it — so a mismatched pair would silently render one image while the
        // caller writes the other to disk under a single event's name. Caught from the
        // 24-byte header, which costs nothing.
        const source = makeSourcePng(200, 100);
        const wrong = PNG.sync.read(makeSourcePng(40, 20));

        expect(() => addTextHeaderToPng(source, LINES, { decoded: wrong })).toThrow(
            /options\.decoded is 40x20 but pngBuffer is 200x100/
        );
    });

    test('rejects a non-PNG buffer even when there are no lines to render', () => {
        // The empty-line short-circuit returns the caller's buffer before any decode, so
        // without an explicit header check a non-PNG body — an HTML error page served as
        // image/png — came straight back out and was written to the audit store.
        expect(() => addTextHeaderToPng(Buffer.from('<html>502 Bad Gateway</html>'), [])).toThrow(
            /not a valid PNG/
        );
    });

    test('bounds the canvas for values that expand under NFKD normalisation', () => {
        // valueMaxChars counts RENDERED characters. The width measurement and the glyph
        // renderer both normalise first, and one code point can expand to 18 (U+FDFA), so
        // counting raw code units left the canvas effectively unbounded — 160 of these
        // produced a 17050px-wide, 15.4MB image from a user-supplied app name.
        const expanding = { key: 'App', value: '\uFDFA'.repeat(160) };

        const out = PNG.sync.read(addTextHeaderToPng(makeSourcePng(120, 40), [expanding]));

        // 160 rendered chars at 6px advance, plus the "APP: " prefix and 8px padding either
        // side, is comfortably under 1200px; the unbounded form was over 17000.
        expect(out.width).toBeLessThan(1200);
    });

    test('returns the source untouched when the line list is empty', () => {
        // No lines means no header band, and the function hands back the caller's own buffer.
        // Asserted by identity, not by contents: a re-encode of an unmodified image can
        // round-trip to the very same bytes, so `toEqual` would pass while the wasted encode
        // — the whole thing this change set is about — went unnoticed. Neither the decode nor
        // the encode runs on this path; only the 24-byte header check does.
        const source = makeSourcePng(40, 20);

        const out = addTextHeaderToPng(source, []);

        expect(out).toBe(source);
    });
});
