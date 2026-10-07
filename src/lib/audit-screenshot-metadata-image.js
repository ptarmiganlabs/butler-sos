import zlib from 'node:zlib';

import pngjs from 'pngjs';

const { PNG } = pngjs;

/**
 * RGBA color.
 *
 * @typedef {{ r: number, g: number, b: number, a: number }} RgbaColor
 */

/**
 * A decoded PNG as used by `pngjs`.
 *
 * @typedef {import('pngjs').PNG} PngImage
 */

/**
 * Key/value metadata line to render in the header.
 *
 * Note: Text rendering is ASCII-only and will be uppercased.
 *
 * @typedef {{ key: string, value: string }} MetadataLine
 */

/**
 * Rendering options for {@link addTextHeaderToPng}.
 *
 * @typedef {{
 *   valueMaxChars?: number,
 *   decoded?: { width: number, height: number, data: Buffer }
 * }} AddTextHeaderOptions
 */

const FONT_WIDTH = 5;
const FONT_HEIGHT = 7;
const CHAR_SPACING = 1;
const LINE_SPACING = 3;

const DEFAULT_PADDING_X = 8;
const DEFAULT_PADDING_TOP = 8;
const DEFAULT_PADDING_BOTTOM = 8;

/** @type {RgbaColor} */
const COLOR_WHITE = { r: 255, g: 255, b: 255, a: 255 };
/** @type {RgbaColor} */
const COLOR_BLACK = { r: 0, g: 0, b: 0, a: 255 };
/** @type {RgbaColor} */
const COLOR_SEPARATOR = { r: 200, g: 200, b: 200, a: 255 };

/**
 * A minimal 5x7 bitmap font.
 *
 * Glyph rows are 5-bit masks (MSB on the left).
 * Unsupported characters render as '?' and input is typically uppercased.
 */
/** @type {Record<string, number[]>} */
const GLYPHS_5X7 = {
    ' ': [0, 0, 0, 0, 0, 0, 0],
    '?': [0b01110, 0b10001, 0b00010, 0b00100, 0b00100, 0b00000, 0b00100],
    '.': [0, 0, 0, 0, 0, 0b00100, 0b00100],
    ',': [0, 0, 0, 0, 0, 0b00100, 0b01000],
    ':': [0, 0b00100, 0b00100, 0, 0b00100, 0b00100, 0],
    '=': [0, 0, 0b11111, 0, 0b11111, 0, 0],
    '-': [0, 0, 0, 0b11111, 0, 0, 0],
    _: [0, 0, 0, 0, 0, 0, 0b11111],
    '/': [0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0, 0],
    '\\': [0b10000, 0b01000, 0b00100, 0b00010, 0b00001, 0, 0],
    '(': [0b00010, 0b00100, 0b01000, 0b01000, 0b01000, 0b00100, 0b00010],
    ')': [0b01000, 0b00100, 0b00010, 0b00010, 0b00010, 0b00100, 0b01000],
    '#': [0b01010, 0b01010, 0b11111, 0b01010, 0b11111, 0b01010, 0b01010],

    0: [0b01110, 0b10001, 0b10011, 0b10101, 0b11001, 0b10001, 0b01110],
    1: [0b00100, 0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
    2: [0b01110, 0b10001, 0b00001, 0b00010, 0b00100, 0b01000, 0b11111],
    3: [0b11110, 0b00001, 0b00001, 0b01110, 0b00001, 0b00001, 0b11110],
    4: [0b00010, 0b00110, 0b01010, 0b10010, 0b11111, 0b00010, 0b00010],
    5: [0b11111, 0b10000, 0b10000, 0b11110, 0b00001, 0b00001, 0b11110],
    6: [0b00110, 0b01000, 0b10000, 0b11110, 0b10001, 0b10001, 0b01110],
    7: [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b01000, 0b01000],
    8: [0b01110, 0b10001, 0b10001, 0b01110, 0b10001, 0b10001, 0b01110],
    9: [0b01110, 0b10001, 0b10001, 0b01111, 0b00001, 0b00010, 0b01100],

    A: [0b01110, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
    B: [0b11110, 0b10001, 0b10001, 0b11110, 0b10001, 0b10001, 0b11110],
    C: [0b01110, 0b10001, 0b10000, 0b10000, 0b10000, 0b10001, 0b01110],
    D: [0b11110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b11110],
    E: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11111],
    F: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b10000],
    G: [0b01110, 0b10001, 0b10000, 0b10111, 0b10001, 0b10001, 0b01110],
    H: [0b10001, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
    I: [0b01110, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
    J: [0b00111, 0b00010, 0b00010, 0b00010, 0b00010, 0b10010, 0b01100],
    K: [0b10001, 0b10010, 0b10100, 0b11000, 0b10100, 0b10010, 0b10001],
    L: [0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b11111],
    M: [0b10001, 0b11011, 0b10101, 0b10101, 0b10001, 0b10001, 0b10001],
    N: [0b10001, 0b11001, 0b10101, 0b10011, 0b10001, 0b10001, 0b10001],
    O: [0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
    P: [0b11110, 0b10001, 0b10001, 0b11110, 0b10000, 0b10000, 0b10000],
    Q: [0b01110, 0b10001, 0b10001, 0b10001, 0b10101, 0b10010, 0b01101],
    R: [0b11110, 0b10001, 0b10001, 0b11110, 0b10100, 0b10010, 0b10001],
    S: [0b01111, 0b10000, 0b10000, 0b01110, 0b00001, 0b00001, 0b11110],
    T: [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100],
    U: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
    V: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01010, 0b00100],
    W: [0b10001, 0b10001, 0b10001, 0b10101, 0b10101, 0b10101, 0b01010],
    X: [0b10001, 0b10001, 0b01010, 0b00100, 0b01010, 0b10001, 0b10001],
    Y: [0b10001, 0b10001, 0b01010, 0b00100, 0b00100, 0b00100, 0b00100],
    Z: [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0b11111],
};

/**
 * Normalizes a string so it can be rendered using the built-in bitmap font.
 *
 * - Converts to printable ASCII only.
 * - Uppercases and trims.
 * - Replaces unsupported characters with `?`.
 *
 * @param {unknown} text Input text.
 * @returns {string} Normalized ASCII text suitable for rendering.
 */
function normalizeToRenderableAscii(text) {
    if (typeof text !== 'string') return '';
    const deAccented = text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
    return (
        deAccented
            // Normalize common backslash variants to ASCII reverse solidus.
            // - U+2216 "∖" (SET MINUS)
            // - U+29F5 "⧵" (REVERSE SOLIDUS OPERATOR)
            // - U+FF3C "＼" (FULLWIDTH REVERSE SOLIDUS)
            .replace(/[∖⧵＼]/g, '\\')
            // Normalize common separators to spaces to keep the header readable.
            .replace(/;/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .toUpperCase()
            .replace(/[^\x20-\x7E]/g, '?')
    );
}

/**
 * Caps the displayed value to a max length.
 *
 * This is value-only; the `key` portion is not truncated.
 *
 * @param {unknown} value Value to cap.
 * @param {number} [maxChars] Maximum number of characters to return. Defaults to 160.
 * @returns {string} Capped value, using `...` when truncation occurs.
 */
function capValue(value, maxChars = 160) {
    if (typeof value !== 'string') return 'N/A';

    // Capped on the RENDERED form, not the raw one. Both the width measurement and the glyph
    // renderer run normalizeToRenderableAscii first, and NFKD can expand a single code point
    // into as many as 18 (U+FDFA), so bounding raw code units left the output canvas
    // effectively unbounded: a 160-character app name of U+FDFA produced a 17050px-wide,
    // 15.4 MB image and ~140 ms of synchronous encoding. These values come from user-supplied
    // app and sheet names, so the bound has to hold for arbitrary input.
    const rendered = normalizeToRenderableAscii(value);
    if (rendered.length <= maxChars) return value;
    if (maxChars <= 3) return rendered.slice(0, maxChars);
    return `${rendered.slice(0, maxChars - 3)}...`;
}

/**
 * Largest image, in pixels, that the screenshot pipeline decodes or builds. A 16-bit image
 * counts double, because pngjs holds its pixels in a 16-bit array before scaling them down.
 *
 * A pngjs decode runs synchronously on the event loop and peaks at roughly four times the
 * decoded RGBA size, because the inflated, unfiltered and final buffers are alive together.
 * Measured on Node 24 with pngjs 7, from a baseline of about 50 MB:
 * - 1920 x 1080: 22 ms, 95 MB;
 * - 20 million pixels, 8-bit: 170 ms, 366 MB (802 ms and 521 MB with the metadata header);
 * - 20 million pixels, 16-bit: 953 ms, 672 MB, which is why it counts double;
 * - 10 million pixels, 16-bit (counted as 20 million): 482 ms, 403 MB.
 * The compressed size says little about any of this: a flat table render compresses so well
 * that the 50 MB download cap admits images that decode to gigabytes.
 *
 * Audit.qs asks the Printing service for an object at its on-screen size, plus at most about
 * 150 px of scroll for legacy tables and pivots (measured), so real screenshots sit far below
 * the budget: a whole 4K screen is 8.3 million pixels, 5K 14.7 million. What exceeds it is a
 * render Audit.qs made taller by an sn-table's absolute scroll offset (measured at about
 * 1.8 million px for 71,923 rows), or a crafted file.
 */
export const MAX_DECODED_PIXELS = 20 * 1000 * 1000;

/**
 * Thrown when a PNG is refused before decoding, or an output image before building it.
 *
 * Callers tell it apart from a real failure: it is a deliberate decision, and the screenshot
 * is still stored as downloaded.
 */
export class PngNotDecodedError extends Error {
    /**
     * Creates the error, with the caller's name in front of the reason in its message.
     *
     * @param {string} caller Name of the function that refused the image.
     * @param {string} reason What was refused and why, for the log.
     */
    constructor(caller, reason) {
        super(`${caller}: ${reason}`);
        this.name = 'PngNotDecodedError';
        this.reason = reason;
    }
}

/**
 * Reads a PNG's IHDR fields without decoding any pixels.
 *
 * The one header reader for the screenshot pipeline: both the crop fast path and
 * assertDecodable use it. It checks only that the buffer starts like a PNG and returns every
 * field as stored, zero dimensions included; each caller decides what it accepts.
 *
 * @param {Buffer} buffer Candidate PNG bytes.
 * @returns {{ length: number, width: number, height: number, bitDepth: number, colorType: number, interlace: number } | null}
 *   The IHDR fields, or null if the buffer does not start with a PNG signature and IHDR chunk.
 */
export function readPngHeader(buffer) {
    // Signature (8) + IHDR length and type (8) + IHDR data (13) + CRC (4).
    if (!Buffer.isBuffer(buffer) || buffer.length < 33) return null;
    if (buffer.readUInt32BE(0) !== 0x89504e47 || buffer.readUInt32BE(4) !== 0x0d0a1a0a) {
        return null;
    }
    if (buffer.toString('ascii', 12, 16) !== 'IHDR') return null;
    return {
        length: buffer.readUInt32BE(8),
        width: buffer.readUInt32BE(16),
        height: buffer.readUInt32BE(20),
        bitDepth: buffer[24],
        colorType: buffer[25],
        interlace: buffer[28],
    };
}

/** Channels per pixel for each PNG colour type. */
const CHANNELS_BY_COLOR_TYPE = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

/** Bit depths the PNG specification allows for each colour type. */
const BIT_DEPTHS_BY_COLOR_TYPE = {
    0: [1, 2, 4, 8, 16],
    2: [8, 16],
    3: [1, 2, 4, 8],
    4: [8, 16],
    6: [8, 16],
};

/** The seven Adam7 interlace passes: [x start, y start, x step, y step]. */
const ADAM7_PASSES = [
    [0, 0, 8, 8],
    [4, 0, 8, 8],
    [0, 4, 4, 8],
    [2, 0, 4, 4],
    [0, 2, 2, 4],
    [1, 0, 2, 2],
    [0, 1, 1, 2],
];

/**
 * Size in bytes of an interlaced image's data once inflated: every Adam7 pass, each row with
 * its filter byte.
 *
 * @param {number} width Image width.
 * @param {number} height Image height.
 * @param {number} bitsPerPixel Channels times bit depth.
 * @returns {number} Expected inflated size.
 */
function interlacedDataSize(width, height, bitsPerPixel) {
    let size = 0;
    for (const [x0, y0, dx, dy] of ADAM7_PASSES) {
        const passWidth = width > x0 ? Math.ceil((width - x0) / dx) : 0;
        const passHeight = height > y0 ? Math.ceil((height - y0) / dy) : 0;
        if (passWidth > 0 && passHeight > 0) {
            size += passHeight * (1 + Math.ceil((passWidth * bitsPerPixel) / 8));
        }
    }
    return size;
}

/**
 * Throws unless a PNG can be decoded within MAX_DECODED_PIXELS, and returns its header.
 *
 * Reads chunk headers, never pixel data, so it is cheap to run before every decode. It refuses
 * what pngjs would otherwise trust to size its work:
 * - a zero width or height, which passes a pixel count while pngjs still sizes its inflate
 *   limit from the other dimension (a 16 KB file with a 0 x 4294967295 header ran Node out of
 *   memory);
 * - a colour type and bit depth the PNG specification does not allow together;
 * - a second IHDR chunk, which pngjs lets replace the first, so the size checked here would
 *   not be the size decoded;
 * - more than MAX_DECODED_PIXELS pixels, a 16-bit image counting double.
 *
 * pngjs inflates an interlaced image with no output limit at all, so for one of those the
 * image data is inflated here first, limited to the size its header allows, and refused if it
 * would unpack to more. That inflate is the one place this check reads pixel data, and it
 * costs one extra inflate for interlaced images only.
 *
 * @param {Buffer} buffer Candidate PNG bytes.
 * @param {string} caller Name of the calling function, for the error message.
 * @returns {{ length: number, width: number, height: number, bitDepth: number, colorType: number, interlace: number }}
 *   The PNG header.
 * @throws {PngNotDecodedError} If the buffer is not a PNG this pipeline will decode.
 */
export function assertDecodable(buffer, caller) {
    const header = readPngHeader(buffer);
    if (header === null) {
        throw new PngNotDecodedError(caller, 'not a PNG; not decoded');
    }
    if (header.length !== 13) {
        throw new PngNotDecodedError(caller, 'PNG header chunk has the wrong length; not decoded');
    }
    const { width, height, bitDepth, colorType, interlace } = header;
    if (width < 1 || height < 1) {
        throw new PngNotDecodedError(caller, `PNG header gives ${width}x${height}; not decoded`);
    }
    const channels = CHANNELS_BY_COLOR_TYPE[colorType];
    if (channels === undefined || !BIT_DEPTHS_BY_COLOR_TYPE[colorType].includes(bitDepth)) {
        throw new PngNotDecodedError(
            caller,
            `PNG colour type ${colorType} with bit depth ${bitDepth} is not a valid combination; not decoded`
        );
    }
    // Every chunk is length (4), type (4), data, CRC (4). A length that runs past the end just
    // ends the walk; pngjs reports the truncation itself.
    const imageData = [];
    for (let offset = 33; offset + 8 <= buffer.length;) {
        const length = buffer.readUInt32BE(offset);
        const type = buffer.toString('ascii', offset + 4, offset + 8);
        if (type === 'IHDR') {
            throw new PngNotDecodedError(caller, 'PNG has a second IHDR chunk; not decoded');
        }
        if (type === 'IEND') break;
        if (type === 'IDAT') {
            imageData.push(
                buffer.subarray(offset + 8, Math.min(offset + 8 + length, buffer.length))
            );
        }
        offset += 12 + length;
    }
    const pixels = width * height * (bitDepth === 16 ? 2 : 1);
    if (pixels > MAX_DECODED_PIXELS) {
        const size =
            bitDepth === 16
                ? `${width}x${height} at 16 bits per channel (counts as ${pixels} pixels)`
                : `${width}x${height} (${pixels} pixels)`;
        throw new PngNotDecodedError(
            caller,
            `image is ${size}, above the decode budget of ${MAX_DECODED_PIXELS} pixels; not decoded`
        );
    }
    if (interlace !== 0) {
        const expected = interlacedDataSize(width, height, channels * bitDepth);
        try {
            zlib.inflateSync(Buffer.concat(imageData), { maxOutputLength: expected });
        } catch (err) {
            if (err && err.code === 'ERR_BUFFER_TOO_LARGE') {
                throw new PngNotDecodedError(
                    caller,
                    `interlaced PNG data unpacks to more than its ${width}x${height} header allows; not decoded`
                );
            }
            // Corrupt data: pngjs stops at the same point and reports it.
        }
    }
    return header;
}

/**
 * Sets a single pixel in the PNG buffer.
 *
 * This is bounds-checked and will no-op if the coordinate is outside the image.
 *
 * @param {PngImage} png Destination image.
 * @param {number} x X coordinate (0-based).
 * @param {number} y Y coordinate (0-based).
 * @param {RgbaColor} color RGBA color.
 * @returns {void}
 */
function setPixel(png, x, y, color) {
    if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
    const idx = (png.width * y + x) << 2;
    png.data[idx] = color.r;
    png.data[idx + 1] = color.g;
    png.data[idx + 2] = color.b;
    png.data[idx + 3] = color.a;
}

/**
 * Fills a rectangle with a solid color.
 *
 * Coordinates are clamped to image bounds.
 *
 * @param {PngImage} png Destination image.
 * @param {number} x Left coordinate.
 * @param {number} y Top coordinate.
 * @param {number} w Rectangle width.
 * @param {number} h Rectangle height.
 * @param {RgbaColor} color RGBA color.
 * @returns {void}
 */
function fillRect(png, x, y, w, h, color) {
    const x0 = Math.max(0, x);
    const y0 = Math.max(0, y);
    const x1 = Math.min(png.width, x + w);
    const y1 = Math.min(png.height, y + h);

    for (let yy = y0; yy < y1; yy += 1) {
        for (let xx = x0; xx < x1; xx += 1) {
            setPixel(png, xx, yy, color);
        }
    }
}

/**
 * Draws a single character using the built-in 5x7 bitmap font.
 *
 * Unsupported glyphs render as `?`.
 *
 * @param {PngImage} png Destination image.
 * @param {number} x Left coordinate.
 * @param {number} y Top coordinate.
 * @param {string} ch Character to draw.
 * @param {RgbaColor} color RGBA color.
 * @returns {void}
 */
function drawChar(png, x, y, ch, color) {
    const glyph = GLYPHS_5X7[ch] || GLYPHS_5X7['?'];
    for (let row = 0; row < FONT_HEIGHT; row += 1) {
        const mask = glyph[row] || 0;
        for (let col = 0; col < FONT_WIDTH; col += 1) {
            const bit = (mask >> (FONT_WIDTH - 1 - col)) & 1;
            if (bit) setPixel(png, x + col, y + row, color);
        }
    }
}

/**
 * Draws a string on the image using the built-in 5x7 bitmap font.
 *
 * The text is normalized to printable ASCII, trimmed, and uppercased.
 *
 * @param {PngImage} png Destination image.
 * @param {number} x Left coordinate.
 * @param {number} y Top coordinate.
 * @param {string} text Text to draw.
 * @param {RgbaColor} color RGBA color.
 * @returns {void}
 */
function drawText(png, x, y, text, color) {
    const t = normalizeToRenderableAscii(text);
    const advance = FONT_WIDTH + CHAR_SPACING;
    for (let i = 0; i < t.length; i += 1) {
        drawChar(png, x + i * advance, y, t[i], color);
    }
}

/**
 * Measures the pixel width required to render a string.
 *
 * @param {string} text Text to measure.
 * @returns {number} Required width in pixels (includes character spacing).
 */
function measureTextWidthPx(text) {
    const t = normalizeToRenderableAscii(text);
    const advance = FONT_WIDTH + CHAR_SPACING;
    return t.length * advance;
}

/**
 * Builds a new PNG that contains the original screenshot with a text header above it.
 *
 * Behavior:
 * - The header is rendered into pixels (white background, black text).
 * - Output height grows to fit the header.
 * - Output width may expand to fit the longest rendered line.
 * - Values are capped to `options.valueMaxChars` characters (default 160).
 * - Rendering is ASCII-only (input is uppercased; unsupported characters become `?`).
 *
 * Notes:
 * - This function is synchronous.
 * - It does not modify the original input buffer.
 *
 * @param {Buffer} pngBuffer Original PNG bytes.
 * @param {MetadataLine[]} lines Key/value lines to render.
 * @param {AddTextHeaderOptions} [options] Rendering options.
 * @param {{ width: number, height: number, data: Buffer }} [options.decoded] Already-decoded
 *   form of `pngBuffer`, to skip a redundant decode. Its dimensions are cross-checked against
 *   `pngBuffer`'s header. Typed structurally because `PNG.sync.read` returns pngjs's plain
 *   metaData object, not a `PNG` instance.
 * @returns {Buffer} New PNG bytes with header.
 * @throws {Error} If the input buffer is not a valid PNG, if `options.decoded` does not match
 *   its dimensions, or if encoding fails.
 */
export function addTextHeaderToPng(pngBuffer, lines, options = {}) {
    const valueMaxChars =
        typeof options.valueMaxChars === 'number' && options.valueMaxChars > 0
            ? options.valueMaxChars
            : 160;

    const renderedLines = (Array.isArray(lines) ? lines : [])
        .filter((l) => l && typeof l.key === 'string')
        .map((l) => {
            const safeValue = capValue(l.value, valueMaxChars);
            return `${l.key}: ${safeValue}`;
        });

    // Validated from the 24-byte header rather than by decoding, so this still costs nothing
    // — but it keeps the `@throws` contract true on every path. Moving the decode below the
    // short-circuit had quietly removed the only check on the empty-lines path, so a non-PNG
    // buffer (an HTML error page served as image/png, say) came straight back out.
    if (readPngHeader(pngBuffer) === null) {
        throw new Error('addTextHeaderToPng: input buffer is not a valid PNG');
    }

    if (renderedLines.length === 0) {
        return pngBuffer;
    }

    // `options.decoded` lets the caller hand over pixels it already has. The screenshot
    // pipeline runs this immediately after cropPngBuffer, which had the very same image
    // decoded a moment earlier and encoded it purely to return a Buffer — decoding those
    // bytes straight back cost a measured 30 ms (flat) to 60 ms (incompressible) at
    // 1920x1080, and 76-232 ms at 4K, all of it blocking the event loop that also serves the
    // health-metric and user-session timers.
    //
    // Cross-checked against the header above. Once `decoded` is accepted, `pngBuffer` is never
    // read again — the whole output is built from `src` — so a mismatched pair would silently
    // render one image while the caller writes the other to disk under a single event's name.
    //
    // assertDecodable runs even when pixels are handed over: those came from a buffer that
    // passed the same check in cropPngBuffer, so here it only re-reads chunk headers.
    const header = assertDecodable(pngBuffer, 'addTextHeaderToPng');
    if (
        options.decoded &&
        (options.decoded.width !== header.width || options.decoded.height !== header.height)
    ) {
        throw new Error(
            `addTextHeaderToPng: options.decoded is ${options.decoded.width}x${options.decoded.height} but pngBuffer is ${header.width}x${header.height}`
        );
    }

    const lineHeight = FONT_HEIGHT + LINE_SPACING;
    const headerHeight =
        DEFAULT_PADDING_TOP + renderedLines.length * lineHeight + DEFAULT_PADDING_BOTTOM;

    let requiredWidth = 0;
    for (const line of renderedLines) {
        requiredWidth = Math.max(requiredWidth, measureTextWidthPx(line));
    }

    // Sized from the header, which matches any handed-over pixels (checked above), so an output
    // too large to build is refused before the decode. The text can widen a narrow image far
    // past its own size: a 100 x 400,000 image within a 40-million budget became 1012 x 400,096.
    const outWidth = Math.max(header.width, DEFAULT_PADDING_X * 2 + requiredWidth);
    const outHeight = header.height + headerHeight;
    if (outWidth * outHeight > MAX_DECODED_PIXELS) {
        throw new PngNotDecodedError(
            'addTextHeaderToPng',
            `output would be ${outWidth}x${outHeight} (${outWidth * outHeight} pixels), above the decode budget of ${MAX_DECODED_PIXELS} pixels; not built`
        );
    }

    const src = options.decoded ?? PNG.sync.read(pngBuffer);

    const out = new PNG({ width: outWidth, height: outHeight });

    // Fill entire output with white (covers header + any extra right-side padding in screenshot area).
    fillRect(out, 0, 0, outWidth, outHeight, COLOR_WHITE);

    // Separator line between header and screenshot.
    fillRect(out, 0, headerHeight - 1, outWidth, 1, COLOR_SEPARATOR);

    // Draw header text.
    let y = DEFAULT_PADDING_TOP;
    for (const line of renderedLines) {
        drawText(out, DEFAULT_PADDING_X, y, line, COLOR_BLACK);
        y += lineHeight;
    }

    // Blit source PNG below header.
    for (let yy = 0; yy < src.height; yy += 1) {
        for (let xx = 0; xx < src.width; xx += 1) {
            const srcIdx = (src.width * yy + xx) << 2;
            const dstIdx = (out.width * (yy + headerHeight) + xx) << 2;

            out.data[dstIdx] = src.data[srcIdx];
            out.data[dstIdx + 1] = src.data[srcIdx + 1];
            out.data[dstIdx + 2] = src.data[srcIdx + 2];
            out.data[dstIdx + 3] = src.data[srcIdx + 3];
        }
    }

    return PNG.sync.write(out);
}
