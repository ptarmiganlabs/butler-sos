#!/usr/bin/env node
/**
 * Builds the session monitor into one executable for the platform this runs on: a copy of the
 * Node.js running this script, carrying the bundled monitor and its web page (Node's single
 * executable applications). It is unsigned; the release workflow signs it.
 *
 *   npm run build:binary              # dist/qseow-session-monitor(.exe)
 *   npm run build:binary -- --no-adhoc   # macOS: leave it unsigned, for the release workflow
 *
 * Then: dist/qseow-session-monitor --simulate 300
 *
 * Windows needs signtool.exe (Windows SDK) to strip node.exe's own signature first: left in place,
 * it no longer matches after the blob is added, and Windows reports the file as tampered with.
 */
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { inject } from 'postject';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const NAME = 'qseow-session-monitor';
const FUSE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';
const adhoc = !process.argv.includes('--no-adhoc');
const win = process.platform === 'win32';
const mac = process.platform === 'darwin';

const dist = path.join(root, 'dist');
const work = path.join(dist, 'build');
const binary = path.join(dist, win ? `${NAME}.exe` : NAME);
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(work, { recursive: true });
const run = (cmd, args) => execFileSync(cmd, args, { stdio: 'inherit' });

// 1. One CommonJS file, the form a Node 24 single executable runs.
console.log('bundling…');
await build({
    entryPoints: [path.join(root, 'src/index.js')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node24',
    outfile: path.join(work, 'main.cjs'),
    // Only reached outside the binary (assets.js reads src/web/ there), never inside it.
    define: { 'import.meta.url': 'undefined' },
    logLevel: 'warning',
});

// 2. The blob: the bundle plus every file of the web page, as assets named web/<path>.
const webDir = path.join(root, 'src/web');
const assets = {};
for (const entry of fs.readdirSync(webDir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || entry.name.endsWith('.md')) continue;
    const abs = path.join(entry.parentPath, entry.name);
    assets[`web/${path.relative(webDir, abs).split(path.sep).join('/')}`] = abs;
}
const seaConfig = path.join(work, 'sea-config.json');
fs.writeFileSync(
    seaConfig,
    JSON.stringify(
        {
            main: path.join(work, 'main.cjs'),
            output: path.join(work, 'sea-prep.blob'),
            disableExperimentalSEAWarning: true,
            assets,
        },
        null,
        2
    )
);
console.log(`blob: the bundle and ${Object.keys(assets).length} web files`);
run(process.execPath, ['--experimental-sea-config', seaConfig]);

// 3. A copy of this Node.js, without its own signature, carrying the blob.
fs.copyFileSync(process.execPath, binary);
fs.chmodSync(binary, 0o755);
if (mac) run('codesign', ['--remove-signature', binary]);
if (win) {
    const kits = path.join(
        process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)',
        'Windows Kits/10/bin'
    );
    const signtool = fs.existsSync(kits)
        ? fs
              .readdirSync(kits)
              .sort()
              .reverse()
              .map((v) => path.join(kits, v, 'x64', 'signtool.exe'))
              .find((f) => fs.existsSync(f))
        : null;
    if (!signtool)
        throw new Error('signtool.exe not found: install the signing tools from the Windows SDK.');
    run(signtool, ['remove', '/s', binary]);
}
await inject(binary, 'NODE_SEA_BLOB', fs.readFileSync(path.join(work, 'sea-prep.blob')), {
    sentinelFuse: FUSE,
    ...(mac && { machoSegmentName: 'NODE_SEA' }),
});
// Apple silicon runs nothing unsigned: an ad-hoc signature for local use. A release signs it properly.
if (mac && adhoc) run('codesign', ['--sign', '-', binary]);

// 4. Smoke test: a binary that can't start isn't worth signing.
const reported = execFileSync(binary, ['--version'], { encoding: 'utf8' }).trim();
if (reported !== pkg.version)
    throw new Error(`the binary reports version '${reported}', expected '${pkg.version}'`);

const hash = crypto.createHash('sha256').update(fs.readFileSync(binary)).digest('hex');
fs.writeFileSync(`${binary}.sha256`, `${hash}\n`);
fs.rmSync(work, { recursive: true, force: true });
console.log(
    `\nbuilt ${path.relative(process.cwd(), binary)} (${pkg.version}, ${(fs.statSync(binary).size / 1e6).toFixed(0)} MB)\nsha256 ${hash}`
);
