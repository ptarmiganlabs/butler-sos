// Platform: Cross-platform (macOS, Linux, Windows)
// Requires: Node.js

/**
 * The optional step `scripts/bundle.mjs` runs on the bundle after esbuild has written it.
 *
 * It lets a variant build change the bundle, after esbuild and before the SEA blob is made from it,
 * without a step added to every build script and without a diff in `bundle.mjs`. Minifying the
 * bundle, or stamping something into it, are what it is for.
 *
 * A module of its own so that it can be tested: `bundle.mjs` runs its command line as soon as it is
 * loaded, so nothing in it can be imported by a test.
 *
 * Unset, nothing happens: the bundle is byte for byte what esbuild wrote. Set, every failure stops
 * the build rather than packaging the untransformed bundle, because that mistake would surface only
 * inside a packaged binary.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** The environment variable that names the transform module. */
export const BUNDLE_TRANSFORM_ENV = 'BUNDLE_TRANSFORM_MODULE';

/**
 * The transform module a build was asked to run, if any.
 *
 * An empty value means unset, and a relative path is resolved against the directory the build runs
 * in, which is the repository root.
 *
 * @param {object} [env] - The environment to read.
 *
 * @returns {string|undefined} The module's absolute path, or undefined when none is named.
 */
export const bundleTransformModuleFrom = (env = process.env) =>
    env[BUNDLE_TRANSFORM_ENV] ? resolve(env[BUNDLE_TRANSFORM_ENV]) : undefined;

/**
 * Run the transform module over the bundle, and write back what it returns.
 *
 * The module's default export is called as `(code, { outfile })` and may be async. It must return
 * the text to package: a non-empty string.
 *
 * @param {string} outfile - The bundle esbuild wrote.
 * @param {string|undefined} modulePath - The transform module, from {@link bundleTransformModuleFrom}.
 *
 * @returns {Promise<boolean>} True when the bundle was transformed, false when no module was named.
 *
 * @throws {Error} When the module cannot be loaded, has no default export function, throws, or
 *     returns anything other than a non-empty string. The bundle is left as esbuild wrote it, and the
 *     build stops.
 */
export const applyBundleTransform = async (outfile, modulePath) => {
    if (!modulePath) {
        return false;
    }

    let transform;

    try {
        ({ default: transform } = await import(pathToFileURL(modulePath).href));
    } catch (err) {
        throw new Error(
            `${BUNDLE_TRANSFORM_ENV} names ${modulePath}, which could not be loaded: ${err.message}`,
            { cause: err }
        );
    }

    if (typeof transform !== 'function') {
        throw new Error(
            `${BUNDLE_TRANSFORM_ENV} names ${modulePath}, whose default export is not a function. It must export one that takes the bundle's text and returns the text to package.`
        );
    }

    const code = readFileSync(outfile, 'utf8');
    let transformed;

    try {
        transformed = await transform(code, { outfile });
    } catch (err) {
        throw new Error(`The bundle transform in ${modulePath} failed: ${err.message}`, {
            cause: err,
        });
    }

    if (typeof transformed !== 'string' || transformed === '') {
        throw new Error(
            `The bundle transform in ${modulePath} returned ${
                typeof transformed === 'string' ? 'an empty string' : typeof transformed
            }, not the text to package. The bundle was left as esbuild wrote it, and the build stops here.`
        );
    }

    writeFileSync(outfile, transformed);

    return true;
};
