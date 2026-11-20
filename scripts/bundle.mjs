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
 * Two optional environment variables let a variant build change the result, and every build in
 * this repository leaves both unset: `EXTENSIONS_MODULE` changes what is bundled behind the
 * `#extensions` specifier (see `src/lib/extensions/`), and `BUNDLE_TRANSFORM_MODULE` post-processes
 * the bundle once esbuild has written it (see `scripts/lib/bundle-transform.mjs`).
 *
 * Every bundle is stamped with its build date, which `scripts/lib/build-date.mjs` derives from
 * `SOURCE_DATE_EPOCH` or the commit rather than the clock, so a rebuild of a commit is identical.
 */

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

import {
    BLOB,
    MACHO_SEGMENT_NAME,
    OUTFILE,
    SENTINEL_FUSE,
    bundleOptionsFor,
} from './lib/bundle-options.mjs';
import { applyBundleTransform, bundleTransformModuleFrom } from './lib/bundle-transform.mjs';
import { buildDate } from './lib/build-date.mjs';

const require = createRequire(import.meta.url);

/**
 * Set by a variant build to substitute the module behind the `#extensions` specifier. Unset for
 * every build in this repository, which is what makes the committed stub the bundled one.
 */
const extensionsModule = process.env.EXTENSIONS_MODULE
    ? resolve(process.env.EXTENSIONS_MODULE)
    : undefined;

/**
 * Set by a variant build to post-process the bundle before it is packaged. Unset for every build
 * in this repository, which leaves the bundle byte for byte as esbuild wrote it.
 */
const transformModule = bundleTransformModuleFrom(process.env);

/**
 * Stop a build whose extensions module targets a different contract version than this source tree.
 *
 * Both halves are always built together, so a mismatch belongs to the build rather than to the
 * machine the binary later runs on - which is why this is checked here and asserted nowhere at
 * runtime.
 *
 * @returns {Promise<void>} Resolves when the two versions agree; rejects otherwise, so the build
 *     stops before esbuild has produced anything.
 */
const checkExtensionsVersion = async () => {
    const { assertSeamVersion } = await import(
        new URL('../src/lib/extensions/version.js', import.meta.url).href
    );
    const { extensions } = await import(pathToFileURL(extensionsModule).href);

    assertSeamVersion(extensions, extensionsModule);
};

/**
 * The version of Commander that a given file resolves.
 *
 * @param {string|URL} fromFile - The file to resolve from.
 *
 * @returns {string|undefined} The version, or undefined when it cannot be determined.
 */
const commanderVersionFrom = (fromFile) => {
    try {
        const entry = createRequire(fromFile).resolve('commander');

        // `commander/package.json` is not listed in the package's `exports`, so requiring it as a
        // subpath fails with ERR_PACKAGE_PATH_NOT_EXPORTED. Read from the package root instead.
        return JSON.parse(readFileSync(join(dirname(entry), 'package.json'), 'utf8')).version;
    } catch {
        return undefined;
    }
};

/**
 * Stop a build whose extensions module was written against a different major of Commander.
 *
 * The alias in `bundleOptionsFor` guarantees one Commander in the bundle. What an alias cannot do is
 * make code written against one major work against another, and that failure would land inside the
 * packaged binary. Comparing the two here turns it into a build failure.
 *
 * Best effort by design: when either version cannot be determined the build proceeds rather than
 * being blocked by a guard that is itself unsure.
 *
 * @returns {void} Nothing. Returns normally when the majors agree or cannot be compared.
 *
 * @throws {Error} When the two majors differ, so the build stops before esbuild runs.
 */
const checkCommanderMatch = () => {
    const core = commanderVersionFrom(import.meta.url);
    const variant = commanderVersionFrom(pathToFileURL(extensionsModule));

    if (!core || !variant || core.split('.')[0] === variant.split('.')[0]) {
        return;
    }

    throw new Error(
        `Commander mismatch: ${extensionsModule} resolves commander ${variant}, this source tree uses ${core}. Only core's copy is bundled, so a description built against a different major would fail at run time rather than here. Align the extensions module on commander ${core}.`
    );
};

/**
 * The version declared by the nearest `package.json` above a file.
 *
 * Used to stamp a variant build with the version of the extensions module it bundled, so that
 * `--version` can report it. Walks up rather than assuming the module sits beside its manifest.
 *
 * @param {string} fromFile - Absolute path to the module.
 *
 * @returns {string|undefined} The version, or undefined when no manifest declares one.
 */
const packageVersionAbove = (fromFile) => {
    let directory = dirname(fromFile);

    for (;;) {
        try {
            const { version } = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'));

            if (typeof version === 'string' && version !== '') {
                return version;
            }
        } catch {
            // No manifest here, or an unreadable one. Keep walking.
        }

        const parent = dirname(directory);

        if (parent === directory) {
            return undefined;
        }

        directory = parent;
    }
};

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
    if (extensionsModule) {
        await checkExtensionsVersion();
        checkCommanderMatch();
    }

    await build(
        bundleOptionsFor({
            buildDate: buildDate(),
            extensionsModule,
            extensionsVersion: extensionsModule ? packageVersionAbove(extensionsModule) : undefined,
            commanderEntry: extensionsModule ? require.resolve('commander') : undefined,
        })
    );

    // After esbuild, so a transform sees exactly the text that is about to be packaged. A failure
    // throws, and the build stops before the SEA blob is made from an untransformed bundle.
    if (await applyBundleTransform(OUTFILE, transformModule)) {
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
