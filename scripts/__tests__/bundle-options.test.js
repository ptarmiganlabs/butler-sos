import { describe, test, expect } from '@jest/globals';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { BUNDLE_OPTIONS, BLOB, OUTFILE, SENTINEL_FUSE } from '../lib/bundle-options.mjs';

/**
 * Guards the single definition of the bundle and inject steps.
 *
 * Both used to be written out in nine build scripts. They now live in scripts/bundle.mjs, with
 * the values in scripts/lib/bundle-options.mjs. These tests fail if the values drift from what
 * the SEA config expects, or if a build script starts calling esbuild or postject directly again.
 */

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const scriptsDir = join(repoRoot, 'scripts');

const BUILD_SCRIPTS = readdirSync(scriptsDir).filter((name) =>
    /^(build-binary|insider-build|release)-.*\.(sh|ps1)$/.test(name)
);

describe('the bundle options', () => {
    test('are the flags every build script passed before bundle.mjs existed', () => {
        expect(BUNDLE_OPTIONS).toEqual({
            entryPoints: ['src/bundle.js'],
            bundle: true,
            outfile: 'build.cjs',
            format: 'cjs',
            platform: 'node',
            target: 'node22',
            inject: ['./src/lib/import-meta-url.js'],
            define: { 'import.meta.url': 'import_meta_url' },
        });
    });

    test('cannot be changed by whoever imports them', () => {
        expect(Object.isFrozen(BUNDLE_OPTIONS)).toBe(true);
    });

    test('write the file the SEA config reads, and inject the blob it writes', () => {
        const seaConfig = JSON.parse(
            readFileSync(join(repoRoot, 'src', 'sea-config.json'), 'utf8')
        );

        expect(seaConfig.main).toBe(OUTFILE);
        expect(seaConfig.output).toBe(BLOB);
    });

    test('use the fuse Node looks for', () => {
        expect(SENTINEL_FUSE).toBe('NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2');
    });
});

describe('the build scripts', () => {
    test('are all found', () => {
        expect(BUILD_SCRIPTS.sort()).toEqual([
            'build-binary-linux.sh',
            'build-binary-macos.sh',
            'build-binary-win.ps1',
            'insider-build-linux.sh',
            'insider-build-mac.sh',
            'insider-build-win.ps1',
            'release-linux.sh',
            'release-macos.sh',
            'release-win.ps1',
        ]);
    });

    test.each(BUILD_SCRIPTS)('%s bundles and injects through bundle.mjs', (name) => {
        const source = readFileSync(join(scriptsDir, name), 'utf8');

        expect(source).toContain('node scripts/bundle.mjs bundle');
        expect(source).toMatch(/node scripts\/bundle\.mjs inject /);
    });

    test.each(BUILD_SCRIPTS)('%s runs neither esbuild nor postject itself', (name) => {
        const source = readFileSync(join(scriptsDir, name), 'utf8');

        expect(source).not.toMatch(
            /node_modules[\\/]\.bin[\\/]esbuild|\bnpx\b.*\b(esbuild|postject)\b/
        );
        expect(source).not.toContain(SENTINEL_FUSE);
    });
});
