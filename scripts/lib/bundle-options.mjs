// Platform: Cross-platform (macOS, Linux, Windows)
// Requires: Node.js

/**
 * What `scripts/bundle.mjs` hands to esbuild and postject, as data.
 *
 * A module of its own so that it can be tested: `bundle.mjs` runs its command line as soon as it
 * is loaded, so nothing in it can be imported by a test. The values are the ones the build scripts
 * passed on the esbuild and postject command lines before `bundle.mjs` existed.
 */

/** The bundle esbuild writes, and `src/sea-config.json`'s `main`. */
export const OUTFILE = 'build.cjs';

/** The blob `node --experimental-sea-config src/sea-config.json` writes, and postject injects. */
export const BLOB = 'sea-prep.blob';

/** Must match the fuse Node itself looks for. Changing it breaks every binary. */
export const SENTINEL_FUSE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';

/** Mach-O only. `bundle.mjs` adds it on macOS. */
export const MACHO_SEGMENT_NAME = 'NODE_SEA';

/**
 * The esbuild options every build starts from.
 *
 * The `inject` + `define` pair rewrites `import.meta.url`, which has no meaning once the ESM
 * sources are flattened into CJS. {@link bundleOptionsFor} adds what differs from build to build.
 */
export const BUNDLE_OPTIONS = Object.freeze({
    entryPoints: ['src/bundle.js'],
    bundle: true,
    outfile: OUTFILE,
    format: 'cjs',
    platform: 'node',
    target: 'node22',
    inject: ['./src/lib/import-meta-url.js'],
    define: { 'import.meta.url': 'import_meta_url' },
});

/**
 * The esbuild options for one build.
 *
 * Pure, so a test can assert what a stock build and a variant build hand to esbuild without
 * running it.
 *
 * - **The build date** is always defined, as `__BUTLER_SOS_BUILD_DATE__`. `--version` reports it
 *   for a variant build.
 * - **An extensions module**, when a variant build names one, replaces the committed stub behind
 *   `#extensions`. Core's own Commander is aliased in beside it, so exactly one copy is bundled:
 *   without that, a module outside this tree resolves `commander` from its own `node_modules`, and
 *   an option built by one copy and added to a command owned by the other fails at run time,
 *   inside the packaged binary, after a build that reported success.
 * - **That module's version**, when one was found, is defined as `__BUTLER_SOS_EXTENSIONS_VERSION__`.
 *   `JSON.stringify(undefined)` is not a string, so a stock build leaves the identifier undeclared,
 *   exactly as in a source run.
 *
 * @param {object} build - What differs for this build.
 * @param {string} build.buildDate - The date to stamp, yyyy-mm-dd.
 * @param {string} [build.extensionsModule] - Absolute path of a variant build's extensions module.
 * @param {string} [build.extensionsVersion] - That module's version.
 * @param {string} [build.commanderEntry] - Core's resolved Commander entry point.
 *
 * @returns {object} The options to pass to esbuild's `build`.
 */
export const bundleOptionsFor = ({
    buildDate,
    extensionsModule,
    extensionsVersion,
    commanderEntry,
}) => ({
    ...BUNDLE_OPTIONS,
    define: {
        ...BUNDLE_OPTIONS.define,
        __BUTLER_SOS_BUILD_DATE__: JSON.stringify(buildDate),
        ...(extensionsVersion === undefined
            ? {}
            : { __BUTLER_SOS_EXTENSIONS_VERSION__: JSON.stringify(extensionsVersion) }),
    },
    ...(extensionsModule
        ? { alias: { '#extensions': extensionsModule, commander: commanderEntry } }
        : {}),
});
