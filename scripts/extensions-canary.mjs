#!/usr/bin/env node
// Platform: Cross-platform (macOS, Linux, Windows)
// Requires: Node.js, the npm dependencies (npm ci); codesign on macOS

/**
 * Does the `#extensions` build-time override still work once the binary has been packaged?
 *
 * Butler SOS ships SEA binaries for three platforms, and the failure this guards against is the
 * kind that "works everywhere except inside the packaged binary": the override is an esbuild alias,
 * and `scripts/bundle.mjs` hands it an absolute path - a `C:\` path with backslashes on Windows.
 * Nothing but a packaged binary shows whether that still resolves.
 *
 * What it asserts, on whichever platform it runs:
 *
 *   1. A binary built WITH a throw-away extensions module registers what the module describes: a
 *      command-line option, a config setting that is verified like core's own, and a `beforeStart`
 *      hook that is given core's loaded config. The hook refuses to start, as an ordinary failure,
 *      and the binary must report that as one line, exit 1, and write no crash dump - and with
 *      file logging on, the line must reach the log file.
 *   2. A binary built WITHOUT one is unchanged: `--version` prints the bare version, and nothing the
 *      module would have added is there.
 *
 * Signing is deliberately not part of this. The question is packaging and module resolution.
 *
 * Usage, from the repository root:
 *   node scripts/extensions-canary.mjs
 */

import { spawnSync } from 'node:child_process';
import {
    chmodSync,
    copyFileSync,
    existsSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { dump, load } from 'js-yaml';

/**
 * Where everything this writes goes. Already git-ignored.
 *
 * The throw-away module is written under the repository root rather than a system temp directory:
 * it imports `commander`, and only under the repository root does a bare `commander` resolve to the
 * same copy core uses, which `scripts/bundle.mjs` checks.
 */
const BUILD_DIR = 'build';
const MODULE_PATH = join(BUILD_DIR, 'canary-extensions.mjs');
const CONFIG_PATH = join(BUILD_DIR, 'canary-config.yaml');
const BAD_CONFIG_PATH = join(BUILD_DIR, 'canary-config-bad.yaml');
const FILE_LOG_CONFIG_PATH = join(BUILD_DIR, 'canary-config-file-log.yaml');

/** Named for what it is, so nobody finds it in a process list and wonders. */
const BINARY_PATH = join(
    BUILD_DIR,
    process.platform === 'win32' ? 'butler-sos-canary.exe' : 'butler-sos-canary'
);

/** What `scripts/bundle.mjs bundle` and the SEA config write in the repository root. */
const INTERMEDIATES = ['build.cjs', 'sea-prep.blob'];

/**
 * The working directory the binaries run in. Its own, under build/, because Butler SOS writes
 * crash dumps to `./crash_dumps` by default, and the canary must neither read nor delete a
 * developer's real ones in the repository root.
 */
const RUN_DIR = join(BUILD_DIR, 'canary-run');

/** Where the safety net writes a crash dump: relative to the binary's working directory. */
const CRASH_DUMP_DIR = join(RUN_DIR, 'crash_dumps');

/** Markers the throw-away module prints, matched below. */
const HOOK_MARKER = 'CANARY_HOOK_RAN';
const REFUSAL_MARKER = 'CANARY_REFUSED_TO_START';

const EXTENSIONS_MODULE_SOURCE = `import { Option } from 'commander';

export const extensions = {
    seamVersion: 1,
    variant: 'canary',
    options: [{ option: new Option('--canary-note <text>', 'Canary: a contributed option.') }],
    configSchema: {
        canary: {
            type: 'object',
            properties: { label: { type: 'string' } },
            required: ['label'],
            additionalProperties: false,
        },
    },
    hooks: {
        beforeStart: (context) => {
            context.logger.info(
                '${HOOK_MARKER} ' +
                    JSON.stringify({
                        label: context.config.get('Butler-SOS.canary.label'),
                        logLevel: context.config.get('Butler-SOS.logLevel'),
                        note: context.options.canaryNote ?? null,
                        certificates: Object.keys(context.certificates),
                        isSea: context.isSea,
                    })
            );

            // Stopping startup deliberately, the way the contract says to: throw, and mark the
            // error so it is reported as an ordinary failure rather than as a crash.
            throw Object.assign(new Error('${REFUSAL_MARKER}'), { expected: true });
        },
    },
};
`;

/**
 * Run a build step, failing the canary if it does not succeed.
 *
 * @param {string} label - What this step is, for the failure message.
 * @param {string} command - Executable to run.
 * @param {string[]} args - Arguments.
 * @param {object} [env] - Extra environment variables.
 *
 * @returns {void} Nothing.
 *
 * @throws {Error} When the command exits non-zero, so a failed build is not mistaken for a passed
 *     assertion further down.
 */
const run = (label, command, args, env = {}) => {
    console.log(`\n--- ${label}`);

    const result = spawnSync(command, args, {
        stdio: 'inherit',
        env: { ...process.env, ...env },
        shell: false,
    });

    if (result.error) {
        throw result.error;
    }

    if (result.status !== 0) {
        throw new Error(`${label} failed with status ${result.status}`);
    }
};

/** Assertions that failed, collected so one run reports every problem rather than the first. */
const failures = [];

/**
 * Record whether one expectation held.
 *
 * @param {string} description - What was expected.
 * @param {boolean} passed - Whether it held.
 * @param {string} [detail] - Extra context shown when it did not.
 *
 * @returns {void} Nothing.
 */
const check = (description, passed, detail = '') => {
    console.log(`  ${passed ? 'ok  ' : 'FAIL'}  ${description}`);

    if (!passed) {
        failures.push(`${description}${detail ? ` - ${detail}` : ''}`);
    }
};

/**
 * Run the packaged binary and return what it printed and how it exited.
 *
 * stdout and stderr are joined: Commander writes help to stdout and errors to stderr, and the
 * logger writes to the console.
 *
 * @param {string[]} args - Arguments to pass to the binary.
 *
 * @returns {{output: string, status: number}} What it printed, and how it exited.
 */
const runBinary = (args) => {
    const result = spawnSync(resolve(BINARY_PATH), args, {
        cwd: RUN_DIR,
        encoding: 'utf8',
        shell: false,
        timeout: 60_000,
    });

    if (result.error) {
        throw result.error;
    }

    return { output: `${result.stdout ?? ''}${result.stderr ?? ''}`, status: result.status };
};

/**
 * Bundle, package and inject a SEA binary from the current source tree.
 *
 * Mirrors what the build scripts do, minus code signing. macOS gets an ad-hoc signature, as
 * `scripts/build-binary-macos.sh` gives it, because arm64 macOS refuses to run an unsigned binary.
 *
 * @param {string} [extensionsModule] - Value for `EXTENSIONS_MODULE`, or undefined for a stock
 *     build.
 *
 * @returns {void} Nothing. Leaves the binary at `BINARY_PATH`.
 */
const buildBinary = (extensionsModule) => {
    // Set to the empty string rather than omitted for a stock build, so an EXTENSIONS_MODULE
    // exported in the surrounding shell cannot reach the build that is supposed to have none.
    // bundle.mjs treats an empty value as absent.
    const env = { EXTENSIONS_MODULE: extensionsModule ?? '' };

    run('bundle', process.execPath, ['scripts/bundle.mjs', 'bundle'], env);
    run('SEA blob', process.execPath, ['--experimental-sea-config', 'src/sea-config.json']);

    rmSync(BINARY_PATH, { force: true });
    copyFileSync(process.execPath, BINARY_PATH);

    if (process.platform !== 'win32') {
        chmodSync(BINARY_PATH, 0o755);
    }

    if (process.platform === 'darwin') {
        run('strip signature', 'codesign', ['--remove-signature', BINARY_PATH]);
    }

    run('inject', process.execPath, ['scripts/bundle.mjs', 'inject', BINARY_PATH]);

    if (process.platform === 'darwin') {
        run('ad-hoc sign', 'codesign', ['--sign', '-', BINARY_PATH]);
    }
};

/**
 * Write a config file: the shipped template, with the canary's setting added under Butler-SOS.
 *
 * @param {string} path - Where to write it.
 * @param {unknown} label - The value of `Butler-SOS.canary.label`.
 * @param {boolean} [fileLogging] - Whether to log to a file too, in `log/` under {@link RUN_DIR}.
 *
 * @returns {void} Nothing.
 */
const writeConfig = (path, label, fileLogging = false) => {
    const config = load(readFileSync('src/config/production_template.yaml', 'utf8'));

    config['Butler-SOS'].canary = { label };
    config['Butler-SOS'].fileLogging = fileLogging;
    // Absolute, because a relative log directory starts from the executable's directory.
    config['Butler-SOS'].logDirectory = resolve(RUN_DIR, 'log');
    // The template's placeholders for these two are not valid addresses, and verification
    // rightly refuses them. Nothing is contacted: the canary's hook stops startup first.
    config['Butler-SOS'].logEvents.udpServerConfig.serverHost = 'localhost';
    config['Butler-SOS'].appNames.hostIP = '127.0.0.1';

    writeFileSync(path, dump(config));
};

const expectedVersion = JSON.parse(readFileSync('package.json', 'utf8')).version;
const packageJson = readFileSync('package.json');

console.log(`extensions canary - ${process.platform}/${process.arch}, node ${process.version}`);

rmSync(RUN_DIR, { recursive: true, force: true });
mkdirSync(RUN_DIR, { recursive: true });
writeFileSync(MODULE_PATH, EXTENSIONS_MODULE_SOURCE);
writeConfig(CONFIG_PATH, 'from the config file');
writeConfig(BAD_CONFIG_PATH, 42);
writeConfig(FILE_LOG_CONFIG_PATH, 'from the config file', true);
try {
    // -----------------------------------------------------------------------------------------
    // A binary built WITH an extensions module
    // -----------------------------------------------------------------------------------------
    buildBinary(MODULE_PATH);

    console.log('\n=== with an extensions module ===');

    const version = runBinary(['--version']);
    const [headline, ...details] = version.output.trim().split(/\r?\n/);

    check('--version exits 0', version.status === 0, `exit status ${version.status}`);
    check(
        '--version names the variant',
        headline === `butler-sos ${expectedVersion} (canary)`,
        headline
    );
    check(
        "--version lists core's version and the build date",
        details.some((line) => line.trim() === `core    ${expectedVersion}`) &&
            details.some((line) => /^\s*built\s+\d{4}-\d{2}-\d{2}$/.test(line)),
        details.join(' | ')
    );

    const help = runBinary(['--help']);

    check('--help lists the contributed option', help.output.includes('--canary-note <text>'));

    const refused = runBinary([
        '-c',
        resolve(CONFIG_PATH),
        '--canary-note',
        'from the command line',
    ]);
    const hookLine = refused.output.split(/\r?\n/).find((line) => line.includes(HOOK_MARKER));
    const seen = hookLine ? JSON.parse(hookLine.slice(hookLine.indexOf('{'))) : {};

    check('the beforeStart hook runs', Boolean(hookLine), refused.output.trim().slice(-2000));
    check(
        'the hook reads its own setting and core settings from the loaded config',
        seen.label === 'from the config file' && typeof seen.logLevel === 'string',
        JSON.stringify(seen)
    );
    check(
        'the hook sees the contributed option',
        seen.note === 'from the command line',
        JSON.stringify(seen)
    );
    check(
        'the hook is given the certificate paths and knows it is packaged',
        JSON.stringify(seen.certificates) ===
            JSON.stringify(['clientCert', 'clientCertKey', 'clientCertCA']) && seen.isSea === true,
        JSON.stringify(seen)
    );
    check('a refusal to start exits 1', refused.status === 1, `exit status ${refused.status}`);
    check('the refusal is reported', refused.output.includes(REFUSAL_MARKER));
    check(
        'as an ordinary failure, not a crash',
        !refused.output.includes('FATAL') && !existsSync(CRASH_DUMP_DIR),
        refused.output.trim().slice(-2000)
    );
    check(
        'and before Butler SOS starts anything',
        !refused.output.includes('Starting Butler SOS'),
        refused.output.trim().slice(-2000)
    );

    const fileLogged = runBinary(['-c', resolve(FILE_LOG_CONFIG_PATH)]);
    const logDir = join(RUN_DIR, 'log');
    const logged = existsSync(logDir)
        ? readdirSync(logDir)
              .map((name) => readFileSync(join(logDir, name), 'utf8'))
              .join('\n')
        : '';

    check(
        'with file logging on, the refusal reaches the log file before the process exits',
        fileLogged.status === 1 && logged.includes(REFUSAL_MARKER),
        `exit status ${fileLogged.status}, log ${logged.length} characters`
    );

    const invalid = runBinary(['-c', resolve(BAD_CONFIG_PATH)]);

    check(
        'a contributed setting is verified like a core one',
        invalid.status === 1 &&
            invalid.output.includes('/Butler-SOS/canary/label') &&
            !invalid.output.includes(HOOK_MARKER),
        `exit status ${invalid.status}: ${invalid.output.trim().slice(-2000)}`
    );

    // -----------------------------------------------------------------------------------------
    // A binary built WITHOUT one
    // -----------------------------------------------------------------------------------------
    buildBinary(undefined);

    console.log('\n=== stock ===');

    const stockVersion = runBinary(['--version']);

    check('--version exits 0', stockVersion.status === 0, `exit status ${stockVersion.status}`);
    check(
        '--version prints the bare version, as it always has',
        stockVersion.output.trim() === expectedVersion,
        stockVersion.output.trim()
    );

    const stockHelp = runBinary(['--help']);

    check('--help carries no contributed option', !stockHelp.output.includes('--canary-note'));
} finally {
    for (const path of [
        ...INTERMEDIATES,
        BINARY_PATH,
        MODULE_PATH,
        CONFIG_PATH,
        BAD_CONFIG_PATH,
        FILE_LOG_CONFIG_PATH,
    ]) {
        rmSync(path, { force: true });
    }

    rmSync(RUN_DIR, { recursive: true, force: true });

    // The bundle reads package.json; make sure the canary never leaves it changed.
    if (!readFileSync('package.json').equals(packageJson)) {
        writeFileSync('package.json', packageJson);
    }
}

if (failures.length > 0) {
    console.error(`\n${failures.length} canary check(s) failed:\n  ${failures.join('\n  ')}`);
    process.exit(1);
}

console.log('\nAll canary checks passed.');
