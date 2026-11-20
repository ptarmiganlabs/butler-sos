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
 * The esbuild options for every build.
 *
 * The `inject` + `define` pair rewrites `import.meta.url`, which has no meaning once the ESM
 * sources are flattened into CJS.
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
