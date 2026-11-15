import fs from 'node:fs';
import sea from 'node:sea';

/**
 * Where the web page's files come from. Run with Node, they are read from src/web/. Built into a
 * single executable (scripts/build-binary.mjs), they are assets inside the executable, under the
 * same relative names with a `web/` prefix.
 */
const inBinary = sea.isSea();

/** @returns {boolean} True when running as the single-executable build. */
export const isBinary = () => inBinary;

const cache = new Map();

/**
 * Reads one of the page's files.
 *
 * @param {string} rel Path below src/web/, such as `index.html` or `brand/x.svg`.
 * @returns {Buffer} The file's contents.
 */
export function readWebFile(rel) {
    // Inside the binary the files never change, and getAsset copies them on every call: once is enough.
    if (inBinary) {
        if (!cache.has(rel)) cache.set(rel, Buffer.from(sea.getAsset(`web/${rel}`)));
        return cache.get(rel);
    }
    return fs.readFileSync(new URL(`./web/${rel}`, import.meta.url));
}
