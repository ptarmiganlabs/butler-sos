import { describe, expect, jest, test } from '@jest/globals';
import pngjs from 'pngjs';
import crypto from 'crypto';
import zlib from 'zlib';

import {
    addTextHeaderToPng,
    assertDecodable,
    MAX_DECODED_PIXELS,
    MAX_PNG_CHUNKS,
    PngNotDecodedError,
    readPngHeader,
} from '../audit-screenshot-metadata-image.js';

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

/**
 * Returns a copy of a PNG whose IHDR claims different dimensions. The chunk CRC is left as it
 * was, so a decode of the result fails; only code that reads the header before decoding can
 * tell what it claims.
 *
 * @param {Buffer} png - Encoded PNG.
 * @param {number} width - Width to write into the header.
 * @param {number} height - Height to write into the header.
 * @returns {Buffer} PNG bytes with the header dimensions replaced.
 */
function withHeaderDimensions(png, width, height) {
    const copy = Buffer.from(png);
    copy.writeUInt32BE(width, 16);
    copy.writeUInt32BE(height, 20);
    return copy;
}

const LINES = [
    { key: 'Event', value: 'sheet-viewed' },
    { key: 'User', value: 'LAB\\alice' },
    { key: 'App', value: 'Sales dashboard' },
];

// Band = paddingTop(8) + lines * (fontHeight 7 + lineSpacing 3) + paddingBottom(8).
const BAND_FOR_3_LINES = 46;

describe('addTextHeaderToPng', () => {
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

/**
 * Builds a valid, interlaced 8-bit RGBA PNG of a single grey colour, with correct CRCs.
 *
 * @param {number} width - Image width.
 * @param {number} height - Image height.
 * @param {Buffer} extra - Bytes appended to the image data before compressing it, to make it
 *   unpack to more than the header allows.
 * @returns {Buffer} Encoded PNG.
 */
function makeInterlacedPng(width, height, extra) {
    const passes = [
        [0, 0, 8, 8],
        [4, 0, 8, 8],
        [0, 4, 4, 8],
        [2, 0, 4, 4],
        [0, 2, 2, 4],
        [1, 0, 2, 2],
        [0, 1, 1, 2],
    ];
    const rows = [];
    for (const [x0, y0, dx, dy] of passes) {
        const w = width > x0 ? Math.ceil((width - x0) / dx) : 0;
        const h = height > y0 ? Math.ceil((height - y0) / dy) : 0;
        if (w === 0 || h === 0) continue;
        for (let y = 0; y < h; y++) {
            // Filter byte 0, then opaque mid-grey pixels.
            const row = Buffer.alloc(1 + w * 4, 128);
            row[0] = 0;
            for (let x = 0; x < w; x++) row[1 + x * 4 + 3] = 255;
            rows.push(row);
        }
    }
    const chunk = (type, data) => {
        const head = Buffer.alloc(8);
        head.writeUInt32BE(data.length, 0);
        head.write(type, 4, 'ascii');
        const crc = Buffer.alloc(4);
        crc.writeUInt32BE(zlib.crc32(Buffer.concat([head.subarray(4), data])), 0);
        return Buffer.concat([head, data, crc]);
    };
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 6; // RGBA
    ihdr[12] = 1; // Adam7
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', ihdr),
        chunk('IDAT', zlib.deflateSync(Buffer.concat([...rows, extra]))),
        chunk('IEND', Buffer.alloc(0)),
    ]);
}

describe('decode budget', () => {
    // Every refusal below has to come from the header walk, before any decode: the fixtures keep
    // their original IDAT and a stale IHDR CRC, so a decode attempt would fail with a different
    // message, and the dimensions stay small enough that such an attempt is affordable.

    /**
     * Returns a copy of a PNG with an extra, well-formed IHDR chunk after the first one.
     *
     * @param {Buffer} png - Encoded PNG.
     * @returns {Buffer} PNG bytes with a second IHDR.
     */
    function withSecondIhdr(png) {
        const firstIhdrEnd = 8 + 8 + 13 + 4;
        const chunk = Buffer.alloc(12 + 13);
        chunk.writeUInt32BE(13, 0);
        chunk.write('IHDR', 4, 'ascii');
        chunk.writeUInt32BE(5000, 8);
        chunk.writeUInt32BE(5000, 12);
        chunk[16] = 8; // bit depth
        chunk[17] = 6; // RGBA
        return Buffer.concat([png.subarray(0, firstIhdrEnd), chunk, png.subarray(firstIhdrEnd)]);
    }

    test('allows exactly MAX_DECODED_PIXELS and refuses one pixel row more', () => {
        // 5000 x 4000 is exactly 20 million pixels.
        expect(MAX_DECODED_PIXELS).toBe(5000 * 4000);
        const png = makeSourcePng(4, 4);

        expect(() => assertDecodable(withHeaderDimensions(png, 5000, 4000), 'test')).not.toThrow();
        expect(() => assertDecodable(withHeaderDimensions(png, 5000, 4001), 'test')).toThrow(
            /test: image is 5000x4001 \(20005000 pixels\), above the decode budget/
        );
    });

    test.each([
        ['zero width', 0, 20],
        ['zero height', 20, 0],
    ])('refuses a header with %s', (_label, width, height) => {
        // A zero dimension makes the pixel count 0, yet pngjs still sizes its inflate limit
        // from the other dimension: a 0 x 4294967295 header ran Node out of memory.
        const png = withHeaderDimensions(makeSourcePng(4, 4), width, height);

        expect(() => assertDecodable(png, 'test')).toThrow(
            `test: PNG header gives ${width}x${height}; not decoded`
        );
    });

    test('refuses an IHDR chunk whose length is not 13', () => {
        // The walk to the next chunk starts after a 13-byte IHDR; any other length would
        // misalign it.
        const png = Buffer.from(makeSourcePng(4, 4));
        png.writeUInt32BE(14, 8);

        expect(() => assertDecodable(png, 'test')).toThrow(
            'test: PNG header chunk has the wrong length; not decoded'
        );
    });

    test('decodes a small interlaced PNG', () => {
        // Interlaced images are valid PNGs, so they are decoded once their data is shown to
        // unpack to no more than the header allows.
        const png = makeInterlacedPng(10, 7, Buffer.alloc(0));

        expect(assertDecodable(png, 'test')).toMatchObject({ width: 10, height: 7, interlace: 1 });
        const out = PNG.sync.read(addTextHeaderToPng(png, LINES));
        expect(out.height).toBe(7 + BAND_FOR_3_LINES);
    });

    test('refuses interlaced data that unpacks to more than its header allows', () => {
        // pngjs inflates interlaced data with no output limit: a 10 x 10 header followed by
        // 256 MB of deflated zeros took gigabytes to decode.
        const png = makeInterlacedPng(10, 10, Buffer.alloc(8 * 1024 * 1024));

        expect(() => assertDecodable(png, 'test')).toThrow(
            'test: interlaced PNG data unpacks to more than its 10x10 header allows; not decoded'
        );
    });

    test('allows MAX_PNG_CHUNKS chunks and refuses one more, without keeping any per chunk', () => {
        // pngjs keeps a Buffer per IDAT chunk while decoding: a 48 MB file of four million empty
        // IDAT chunks took over 500 MB of heap just to list. IHDR and IEND count too.
        expect(MAX_PNG_CHUNKS).toBe(100000);
        const png = makeSourcePng(4, 4);
        const ihdrEnd = 8 + 8 + 13 + 4;
        const emptyIdat = Buffer.from([0, 0, 0, 0, 0x49, 0x44, 0x41, 0x54, 0x35, 0xaf, 0x06, 0x1e]);
        const iend = png.subarray(png.length - 12);
        const withEmptyChunks = (count) =>
            Buffer.concat([
                png.subarray(0, ihdrEnd),
                Buffer.concat(Array(count).fill(emptyIdat)),
                png.subarray(ihdrEnd, png.length - 12),
                iend,
            ]);
        // The 4 x 4 source has one IDAT of its own, so IHDR + IDAT + IEND is 3 chunks.
        expect(() => assertDecodable(withEmptyChunks(MAX_PNG_CHUNKS - 3), 'test')).not.toThrow();
        expect(() => assertDecodable(withEmptyChunks(MAX_PNG_CHUNKS - 2), 'test')).toThrow(
            'test: PNG has more than 100000 chunks; not decoded'
        );
    });

    test('counts a 16-bit image double', () => {
        // pngjs holds 16-bit pixels in a 16-bit array before scaling them down: at 20 million
        // pixels that measured 672 MB against 366 MB for 8-bit.
        const png = Buffer.from(makeSourcePng(4, 4));
        png[24] = 16;

        expect(() => assertDecodable(withHeaderDimensions(png, 5000, 2000), 'test')).not.toThrow();
        expect(() => assertDecodable(withHeaderDimensions(png, 5000, 2001), 'test')).toThrow(
            'test: image is 5000x2001 at 16 bits per channel (counts as 20010000 pixels), above the decode budget of 20000000 pixels; not decoded'
        );
    });

    test.each([
        ['an RGBA image with 4-bit channels', 6, 4],
        ['a palette image with 16-bit indexes', 3, 16],
        ['an undefined colour type', 5, 8],
    ])('refuses %s', (_label, colorType, bitDepth) => {
        const png = Buffer.from(makeSourcePng(4, 4));
        png[24] = bitDepth;
        png[25] = colorType;

        expect(() => assertDecodable(png, 'test')).toThrow(
            `test: PNG colour type ${colorType} with bit depth ${bitDepth} is not a valid combination; not decoded`
        );
    });

    test('refuses with a PngNotDecodedError that carries the reason', () => {
        const png = withHeaderDimensions(makeSourcePng(4, 4), 0, 20);

        let caught;
        try {
            assertDecodable(png, 'test');
        } catch (err) {
            caught = err;
        }

        expect(caught).toBeInstanceOf(PngNotDecodedError);
        expect(caught.reason).toBe('PNG header gives 0x20; not decoded');
    });

    test('readPngHeader returns the header fields, and null for anything else', () => {
        expect(readPngHeader(makeSourcePng(40, 20))).toEqual({
            length: 13,
            width: 40,
            height: 20,
            bitDepth: 8,
            colorType: 6,
            interlace: 0,
        });
        expect(readPngHeader(Buffer.from('<html>502 Bad Gateway</html>'))).toBeNull();
        expect(readPngHeader(makeSourcePng(4, 4).subarray(0, 30))).toBeNull();
    });

    test('refuses a PNG with a second IHDR chunk', () => {
        // pngjs lets a later IHDR replace the first, so the size checked would not be the size
        // decoded: a 143-byte file with a 10 x 10 header decoded to 10000 x 10000.
        const png = withSecondIhdr(makeSourcePng(4, 4));

        expect(() => assertDecodable(png, 'test')).toThrow(
            'test: PNG has a second IHDR chunk; not decoded'
        );
    });

    test.each([
        ['an HTML body', Buffer.from('<html>502 Bad Gateway</html>')],
        ['a PNG cut off inside its header chunk', makeSourcePng(4, 4).subarray(0, 30)],
    ])('refuses %s', (_label, buffer) => {
        expect(() => assertDecodable(buffer, 'test')).toThrow('test: not a PNG; not decoded');
    });

    test('accepts an ordinary PNG', () => {
        expect(() => assertDecodable(makeSourcePng(40, 20), 'test')).not.toThrow();
    });

    test('addTextHeaderToPng refuses an oversized image before decoding it', () => {
        // A flat render compresses far below the 50 MB download cap yet decodes to gigabytes.
        const oversized = withHeaderDimensions(makeSourcePng(4, 4), 5000, 4001);

        expect(() => addTextHeaderToPng(oversized, LINES)).toThrow(
            /addTextHeaderToPng: image is 5000x4001 .* above the decode budget/
        );
    });

    test('addTextHeaderToPng refuses an output the text would widen past the budget', () => {
        // 10 x 1,999,000 is within the budget, but the header text widens the output to over
        // 100 px, and that output would be ten times the budget.
        const narrow = withHeaderDimensions(makeSourcePng(4, 4), 10, 1999000);

        expect(() => addTextHeaderToPng(narrow, LINES)).toThrow(
            /addTextHeaderToPng: output would be \d+x1999046 .* above the decode budget .*; not built/
        );
    });
});
