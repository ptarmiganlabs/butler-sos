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

/**
 * @param {string} rel Path below src/web/, such as `index.html` or `brand/x.svg`.
 * @returns {Buffer} The file's contents.
 */
export function readWebFile(rel) {
    if (inBinary) return Buffer.from(sea.getAsset(`web/${rel}`));
    return fs.readFileSync(new URL(`./web/${rel}`, import.meta.url));
}
