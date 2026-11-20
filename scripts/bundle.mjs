#!/usr/bin/env node
// Platform: Cross-platform (macOS, Linux, Windows)
// Requires: Node.js, the npm dependencies (npm ci)

/**
 * The two SEA packaging steps that every build shares, defined once.
 *
 * Bundling and blob injection used to be written out in full in nine places - the local build,
 * insider and release scripts for three platforms - in a mix of bash and PowerShell. The flag sets
 * were identical, which is exactly the problem: a flag changed in eight of them and missed in the
 * ninth produces a binary that differs on one platform or one channel only, and that difference
 * surfaces inside the packaged SEA binary rather than in any test.
 *
 * Being a Node script rather than a shell library is deliberate: it removes the bash-vs-PowerShell
 * split rather than centralising each half separately, and it lets the one genuinely
 * platform-specific argument - macOS's `--macho-segment-name` - be derived from `process.platform`
 * instead of depending on which file the caller happens to be in.
 *
 * Run it from the repository root, as every build script does:
 *   node scripts/bundle.mjs bundle
 *   node scripts/bundle.mjs inject <binary path>
 *
 * `bundle` writes `build.cjs`, which `src/sea-config.json` turns into `sea-prep.blob`. `inject`
 * puts that blob into a copy of the Node executable.
 *
 * One optional environment variable lets a variant build change the result, and every build in this
 * repository leaves it unset: `BUNDLE_TRANSFORM_MODULE` post-processes the bundle once esbuild has
 * written it. `scripts/lib/bundle-transform.mjs` has the rules.
 */

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

import { BUNDLE_OPTIONS, BLOB, SENTINEL_FUSE, MACHO_SEGMENT_NAME } from './lib/bundle-options.mjs';
import { applyBundleTransform, bundleTransformModuleFrom } from './lib/bundle-transform.mjs';

const require = createRequire(import.meta.url);

/**
 * Set by a variant build to post-process the bundle before it is packaged. Unset for every build
 * in this repository, which leaves the bundle byte for byte as esbuild wrote it.
 */
const transformModule = bundleTransformModuleFrom(process.env);

/**
 * Bundle Butler SOS into a single CJS file for the SEA blob.
 *
 * `format: 'cjs'` is not a preference: Node's SEA blob takes one CommonJS file. It is also why
 * top-level `await` cannot be used anywhere in the bundle - esbuild rejects it for this format,
 * while plain `node` accepts it, so it would pass the test suite and fail the release build.
 *
 * @returns {Promise<void>} Resolves when the bundle has been written.
 */
const bundle = async () => {
    await build(BUNDLE_OPTIONS);

    // After esbuild, so a transform sees exactly the text that is about to be packaged. A failure
    // throws, and the build stops before the SEA blob is made from an untransformed bundle.
    if (await applyBundleTransform(BUNDLE_OPTIONS.outfile, transformModule)) {
        console.log(`Bundle transformed by ${transformModule}`);
    }
};

/**
 * Inject the SEA blob into a copy of the Node executable.
 *
 * postject is invoked through its own CLI entry point with `node`, rather than through `npx`, so
 * there is no dependence on npx cache state and no `.cmd` special case on Windows. It is a pinned
 * devDependency.
 *
 * The caller must strip the executable's existing signature first: postject rewrites the binary,
 * which invalidates any signature already on it.
 *
 * @param {string} binaryPath - The Node executable copy to inject into.
 *
 * @returns {void}
 *
 * @throws {Error} When postject exits non-zero, so the build stops rather than shipping an
 *     executable with no blob in it.
 */
const inject = (binaryPath) => {
    const args = [
        require.resolve('postject/dist/cli.js'),
        binaryPath,
        'NODE_SEA_BLOB',
        BLOB,
        '--sentinel-fuse',
        SENTINEL_FUSE,
    ];

    if (process.platform === 'darwin') {
        args.push('--macho-segment-name', MACHO_SEGMENT_NAME);
    }

    const result = spawnSync(process.execPath, args, { stdio: 'inherit' });

    if (result.error) {
        throw result.error;
    }

    if (result.status !== 0) {
        throw new Error(`postject exited with status ${result.status}`);
    }
};

const [step, target] = process.argv.slice(2);

if (step === 'bundle') {
    await bundle();
} else if (step === 'inject') {
    if (!target) {
        console.error('Usage: node scripts/bundle.mjs inject <binary path>');
        process.exit(1);
    }
    inject(target);
} else {
    console.error('Usage: node scripts/bundle.mjs <bundle|inject> [binary path]');
    process.exit(1);
}
