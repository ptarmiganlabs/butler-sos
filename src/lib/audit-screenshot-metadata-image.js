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
 *   valueMaxChars?: number
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
    if (value.length <= maxChars) return value;
    if (maxChars <= 3) return value.slice(0, maxChars);
    return `${value.slice(0, maxChars - 3)}...`;
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
 * @returns {Buffer} New PNG bytes with header.
 * @throws {Error} If the input buffer is not a valid PNG or encoding fails.
 */
export function addTextHeaderToPng(pngBuffer, lines, options = {}) {
    const valueMaxChars =
        typeof options.valueMaxChars === 'number' && options.valueMaxChars > 0
            ? options.valueMaxChars
            : 160;

    const src = PNG.sync.read(pngBuffer);

    const renderedLines = (Array.isArray(lines) ? lines : [])
        .filter((l) => l && typeof l.key === 'string')
        .map((l) => {
            const safeValue = capValue(l.value, valueMaxChars);
            return `${l.key}: ${safeValue}`;
        });

    if (renderedLines.length === 0) {
        return pngBuffer;
    }

    const lineHeight = FONT_HEIGHT + LINE_SPACING;
    const headerHeight =
        DEFAULT_PADDING_TOP + renderedLines.length * lineHeight + DEFAULT_PADDING_BOTTOM;

    let requiredWidth = 0;
    for (const line of renderedLines) {
        requiredWidth = Math.max(requiredWidth, measureTextWidthPx(line));
    }

    const outWidth = Math.max(src.width, DEFAULT_PADDING_X * 2 + requiredWidth);
    const outHeight = src.height + headerHeight;

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
