import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
    applyBundleTransform,
    BUNDLE_TRANSFORM_ENV,
    bundleTransformModuleFrom,
} from '../lib/bundle-transform.mjs';

// The optional post-processing step scripts/bundle.mjs runs on the bundle after esbuild. Unset, the
// bundle is untouched; set, the transform's output is what gets packaged; and any failure stops the
// build instead of packaging the bundle untransformed.

/** What esbuild would have written: content that is easy to recognise byte for byte. */
const ESBUILD_OUTPUT = '"use strict";\nconsole.log("bundled");\n';

let dir;
let counter = 0;

beforeAll(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), 'bundle-transform-'));
});

afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
});

/**
 * A fresh bundle file holding {@link ESBUILD_OUTPUT}.
 *
 * @returns {string} Its path.
 */
const bundleFile = () => {
    const file = path.join(dir, `build-${(counter += 1)}.cjs`);

    writeFileSync(file, ESBUILD_OUTPUT);

    return file;
};

/**
 * A transform module with the given source, under a name no other test uses, so no import is
 * served from the module cache.
 *
 * @param {string} source - The module's source.
 *
 * @returns {string} Its path.
 */
const transformModule = (source) => {
    const file = path.join(dir, `transform-${(counter += 1)}.mjs`);

    writeFileSync(file, source);

    return file;
};

describe('which transform module a build names', () => {
    test('none, when the variable is unset or empty', () => {
        expect(bundleTransformModuleFrom({})).toBeUndefined();
        expect(bundleTransformModuleFrom({ [BUNDLE_TRANSFORM_ENV]: '' })).toBeUndefined();
    });

    test('an absolute path, resolved against the directory the build runs in', () => {
        expect(bundleTransformModuleFrom({ [BUNDLE_TRANSFORM_ENV]: 'tools/t.mjs' })).toBe(
            path.resolve('tools/t.mjs')
        );
    });
});

describe('with no transform module', () => {
    test('leaves the bundle byte for byte as esbuild wrote it', async () => {
        const outfile = bundleFile();

        await expect(applyBundleTransform(outfile, undefined)).resolves.toBe(false);
        expect(readFileSync(outfile, 'utf8')).toBe(ESBUILD_OUTPUT);
    });
});

describe('with a working transform module', () => {
    test('packages what it returns, and tells it which file it is transforming', async () => {
        const outfile = bundleFile();
        const module = transformModule(
            'export default (code, { outfile }) => `/* ${outfile} */\\n${code}`;\n'
        );

        await expect(applyBundleTransform(outfile, module)).resolves.toBe(true);
        expect(readFileSync(outfile, 'utf8')).toBe(`/* ${outfile} */\n${ESBUILD_OUTPUT}`);
    });

    test('may be async', async () => {
        const outfile = bundleFile();
        const module = transformModule(
            'export default async (code) => { await new Promise((r) => setTimeout(r, 1)); return code.toUpperCase(); };\n'
        );

        await applyBundleTransform(outfile, module);

        expect(readFileSync(outfile, 'utf8')).toBe(ESBUILD_OUTPUT.toUpperCase());
    });
});

// Every one of these would otherwise package the bundle untransformed, and the mistake would show
// only inside a binary. So each stops the build, and the bundle is left as esbuild wrote it.
describe('with a broken transform module', () => {
    test.each([
        ['a module that does not exist', null, 'could not be loaded'],
        ['a module that does not parse', 'export default (code => code;\n', 'could not be loaded'],
        ['no default export', 'export const transform = (code) => code;\n', 'is not a function'],
        [
            'a transform that throws',
            "export default () => { throw new Error('boom'); };\n",
            'failed: boom',
        ],
        ['a transform that returns nothing', 'export default () => undefined;\n', 'undefined'],
        ['a transform that returns an empty string', "export default () => '';\n", 'empty string'],
        [
            'a transform that returns a buffer',
            'export default (code) => Buffer.from(code);\n',
            'object',
        ],
    ])('stops the build for %s', async (_name, source, message) => {
        const outfile = bundleFile();
        const module =
            source === null ? path.join(dir, 'no-such-transform.mjs') : transformModule(source);

        await expect(applyBundleTransform(outfile, module)).rejects.toThrow(message);
        expect(readFileSync(outfile, 'utf8')).toBe(ESBUILD_OUTPUT);
    });

    test('names the variable when the module cannot be loaded', async () => {
        await expect(
            applyBundleTransform(bundleFile(), path.join(dir, 'missing.mjs'))
        ).rejects.toThrow(BUNDLE_TRANSFORM_ENV);
    });
});
