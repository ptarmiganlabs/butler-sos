#!/usr/bin/env node
/**
 * QSEoW session monitor: polls every proxy and virtual proxy plus the licence usage records,
 * and alerts when a user nears the limit of parallel sessions. Read-only towards Sense.
 *
 * Usage: node src/index.js [--config config.yaml] [--host server --certs folder] [--once]
 *        node src/index.js --simulate 300        (a made-up site of 300 users, no Sense needed)
 * The single-executable build takes the same options.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';
import pkg from '../package.json' with { type: 'json' };
import { isBinary } from './assets.js';
import { loadConfig } from './config.js';
import { findLocalSense } from './local.js';
import { SenseClient, explain } from './sense.js';
import { discover, snapshot, licenceOverview, AllocationCache } from './collect.js';
import { Tracker } from './model.js';
import { consoleOutput } from './outputs/console.js';
import { webOutput } from './outputs/web.js';
import { webhookOutput } from './outputs/webhook.js';
import { mqttOutput } from './outputs/mqtt.js';
import { SimulatedSite } from './simulate.js';

const DEMO_USERS = 300;
// How the person running this starts things, in the words that fit how it was started.
const me = isBinary() ? path.basename(process.execPath) : 'node src/index.js';
const demoHint = isBinary() ? `${me} --simulate ${DEMO_USERS}` : 'npm run demo';
const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);

/**
 * Prints the message and exits. The binary started by a double-click on Windows has a console
 * window of its own, which would close before the message could be read: there, wait for Enter.
 *
 * @param {string} msg What went wrong, and what to do about it.
 */
async function fail(msg) {
    console.error(`\n${msg}\n`);
    if (isBinary() && process.platform === 'win32' && interactive) {
        const rl = createInterface({ input: process.stdin, output: process.stdout });
        await rl.question('Press Enter to close.');
        rl.close();
    }
    process.exit(1);
}

const HELP = `Qlik Sense session monitor ${pkg.version}: a live view of who is connected and how close
each user is to Qlik Sense's limit of five parallel sessions. It reads Sense's APIs and changes nothing.

Usage: ${me} [options]

  --host <server>     The central Sense server, as named in its certificates.
  --certs <folder>    The folder with client.pem, client_key.pem and root.pem, exported from
                      the QMC (Certificates > Export, "Platform independent PEM-format").
  -c, --config <file> A configuration file (default: config.yaml here or next to the program).
  --simulate <users>  A made-up site with this many users, to try the page without Sense.
  --port <number>     The web page's port (default 3939).
  --no-open           Don't open the page in a browser.
  --once              Poll once, print a table and exit.
  -v, --version       Print the version.
  -h, --help          Print this.

Run on a Sense server with nothing else, it finds the server and its certificates by itself.
More: https://github.com/ptarmiganlabs/butler-sos/tree/master/tools/session-monitor`;

// One async function rather than top-level await, so that the single-executable build, which
// bundles this into CommonJS, can run it too.
async function main() {
    let args;
    try {
        ({ values: args } = parseArgs({
            allowNegative: true,
            options: {
                config: { type: 'string', short: 'c' },
                host: { type: 'string' },
                certs: { type: 'string' },
                port: { type: 'string' },
                open: { type: 'boolean', default: true },
                once: { type: 'boolean', default: false },
                simulate: { type: 'string' },
                version: { type: 'boolean', short: 'v' },
                help: { type: 'boolean', short: 'h' },
            },
        }));
    } catch (err) {
        await fail(`${err.message}\n\n${HELP}`);
    }
    if (args.version) {
        console.log(pkg.version);
        process.exit(0);
    }
    if (args.help) {
        console.log(HELP);
        process.exit(0);
    }

    let simulateUsers = args.simulate ? Number(args.simulate) : 0;
    const port = args.port === undefined ? undefined : Number(args.port);
    if (port !== undefined && !(Number.isInteger(port) && port > 0 && port < 65536))
        await fail('--port needs a port number between 1 and 65535, e.g. --port 3940');
    if (args.simulate && !(simulateUsers > 0))
        await fail(`--simulate needs a number of users, e.g. --simulate ${DEMO_USERS}`);

    /**
     * Where the settings come from, first match wins: --config; else config.yaml in the current folder
     * or next to the binary; plus --host/--certs over either. With none of those, Sense on this very
     * machine; and with no Sense here either, an offer of the demo.
     */
    async function resolveSettings() {
        const candidates = args.config
            ? [args.config]
            : [
                  path.resolve('config.yaml'),
                  ...(isBinary() ? [path.join(path.dirname(process.execPath), 'config.yaml')] : []),
              ];
        const file = candidates.find((f) => fs.existsSync(f)) ?? (args.config || null);
        const haveFile = Boolean(file && fs.existsSync(file));
        // --host and --certs override the file's settings, or stand in for a file altogether.
        const overrides = {};
        if (args.host || args.certs)
            overrides.sense = {
                ...(args.host && { host: args.host }),
                ...(args.certs && { certDir: path.resolve(args.certs) }),
            };
        if (!simulateUsers && !haveFile && !args.config) {
            if (args.certs && !args.host)
                await fail('--certs needs --host as well: the server to connect to.');
            if (args.host && !args.certs)
                await fail(
                    '--host needs --certs as well: the folder with client.pem, client_key.pem and root.pem,\n' +
                        '    exported from the QMC (Certificates > Export, "Platform independent PEM-format").'
                );
        }
        if (simulateUsers || args.config || args.host || haveFile) return { file, overrides };

        const local = findLocalSense();
        if (local) {
            if (local.missing.length || local.unreadable.length) {
                const which = [...local.missing, ...local.unreadable].join(', ');
                await fail(
                    `This is the Qlik Sense server ${local.host}, but its certificates can't be read (${which} in ${local.certDir}).\n` +
                        (local.unreadable.length
                            ? '    Reading them needs administrator rights: run this as an administrator.'
                            : '    Export them in the QMC (Certificates > Export) and pass the folder with --certs.')
                );
            }
            console.log(
                `Found Qlik Sense on this server: ${local.host}, certificates in ${local.certDir}`
            );
            return {
                file: null,
                overrides: { sense: { host: local.host, certDir: local.certDir } },
            };
        }

        // Nothing to connect to. Someone who started this by hand gets the demo offered.
        if (interactive) {
            console.log(
                '\nNo Qlik Sense server to watch: no config.yaml, no --host, and this is not a Sense server.\n' +
                    '  - On a Sense server, run this there: it finds the server by itself.\n' +
                    '  - Elsewhere: --host <server> --certs <folder with client.pem, client_key.pem, root.pem>.\n'
            );
            const rl = createInterface({ input: process.stdin, output: process.stdout });
            const answer = await rl.question(
                `Start the demo instead, a made-up site with ${DEMO_USERS} users? [Y/n] `
            );
            rl.close();
            if (/^\s*(y|yes)?\s*$/i.test(answer)) {
                simulateUsers = DEMO_USERS;
                return { file: null, overrides: {} };
            }
            process.exit(0);
        }
        return { file, overrides };
    }

    const settings = await resolveSettings();
    let cfg;
    try {
        cfg = loadConfig(settings.file, {
            simulate: simulateUsers > 0,
            overrides: port
                ? { ...settings.overrides, outputs: { web: { port } } }
                : settings.overrides,
            demoHint,
        });
    } catch (err) {
        await fail(err.message);
    }
    const client = simulateUsers
        ? null
        : new SenseClient(cfg.sense, cfg.poll.requestTimeoutSeconds);
    const site = simulateUsers ? new SimulatedSite(simulateUsers, cfg.limit) : null;
    const tracker = new Tracker(cfg.limit, cfg.poll.intervalSeconds, {
        timelineMinutes: cfg.outputs.web.timelineMinutes,
    });

    const o = cfg.outputs;
    const outputs = [
        o.console.enable && consoleOutput(o.console),
        o.web.enable &&
            !args.once &&
            webOutput(
                o.web,
                simulateUsers ? `Simulated site, ${simulateUsers} users` : cfg.sense.repositoryHost,
                cfg.poll.intervalSeconds
            ),
        o.webhook.enable && webhookOutput(o.webhook),
        o.mqtt.enable && mqttOutput(o.mqtt),
    ].filter(Boolean);

    const log = (msg) => console.log(`${new Date().toISOString()} ${msg}`);
    let targets = [];
    let discoveredAt = 0;
    let licences = null;
    const sessionCache = new Map();
    const allocationCache = new AllocationCache(cfg.poll.licenceOverviewSeconds * 1000);
    // Usage records older than this can neither hold a slot nor appear on the timeline.
    const recordsSinceMs =
        Math.max(cfg.limit.windowSeconds * 1000, cfg.outputs.web.timelineMinutes * 60000) + 60000;
    let licencesAt = 0;
    let stopping = false;
    let timer = null;

    async function tick() {
        if (site) return publish(site.step(Date.now(), recordsSinceMs));
        if (
            Date.now() - discoveredAt > cfg.poll.discoveryIntervalSeconds * 1000 ||
            !targets.length
        ) {
            try {
                const found = await discover(client, cfg.sense.virtualProxies);
                const desc = found.map((t) => `${t.host}/${t.prefix}`).join(', ');
                if (desc !== targets.map((t) => `${t.host}/${t.prefix}`).join(', '))
                    log(`polling ${found.length} proxy/virtual proxy pairs: ${desc}`);
                targets = found;
                discoveredAt = Date.now();
            } catch (err) {
                log(`cannot read the Sense server: ${explain(err, cfg.sense)}`);
                if (!targets.length) return;
            }
        }
        const snap = await snapshot(client, targets, {
            allocationCache,
            recordsSinceMs,
            sessionCache,
        });
        if (Date.now() - licencesAt > cfg.poll.licenceOverviewSeconds * 1000) {
            try {
                licences = await licenceOverview(client);
                licencesAt = Date.now();
            } catch (err) {
                snap.errors.push(`QRS licence overview: ${err.message}`);
            }
        }
        snap.licenceOverview = licences;
        return publish(snap);
    }

    async function publish(snap, only) {
        const result = tracker.update(snap);
        for (const out of only || outputs) {
            try {
                await out.handle(result);
            } catch (err) {
                log(`output ${out.name} failed: ${err.message}`);
            }
        }
        return result;
    }

    async function loop() {
        const started = Date.now();
        try {
            await tick();
        } catch (err) {
            log(`poll failed: ${err.message}`);
        }
        if (stopping) return;
        const wait = Math.max(0, cfg.poll.intervalSeconds * 1000 - (Date.now() - started));
        timer = setTimeout(loop, wait);
    }

    async function stop() {
        // A second Ctrl+C stops at once, whatever is still being closed.
        if (stopping) process.exit(130);
        stopping = true;
        clearTimeout(timer);
        log('stopping…');
        // Give the outputs up to 6 s to close cleanly (the webhook flushes for up to 5 s), then exit anyway.
        const deadline = new Promise((resolve) => setTimeout(resolve, 6000).unref());
        await Promise.race([Promise.allSettled(outputs.map((out) => out.close?.())), deadline]);
        client?.close();
        process.exit(0);
    }

    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);

    log(
        `starting: limit ${cfg.limit.sessions} sessions per ${cfg.limit.windowSeconds} s, warn at ${cfg.limit.warnAt}, critical at ${cfg.limit.criticalAt}, poll every ${cfg.poll.intervalSeconds} s; outputs: ${outputs.map((x) => x.name).join(', ')}`
    );
    // An output that can't start (the web page's port in use, say) ends it here, through fail().
    await Promise.all(outputs.map((out) => out.ready));
    const page = outputs.find((x) => x.name === 'web');
    if (page && args.open && !args.once) openBrowser(page.url);
    if (site) {
        // Give the simulated site a past: run its last half hour quickly, feeding only the web page,
        // so the timelines and the feed have something to show from the start.
        log(`simulating a site with ${simulateUsers} users`);
        const web = outputs.filter((x) => x.name === 'web');
        const step = cfg.poll.intervalSeconds * 1000;
        for (
            let at = Date.now() - cfg.outputs.web.timelineMinutes * 60000;
            at < Date.now();
            at += step
        )
            await publish(site.step(at, recordsSinceMs), web);
    }
    if (args.once) {
        o.console.table = true;
        await tick();
        await stop();
    } else {
        loop();
    }
}

/**
 * Opens the page in the default browser. Best effort: on a server without a desktop there may be
 * none, and the address printed above is enough.
 *
 * @param {string} url The page.
 */
function openBrowser(url) {
    const [cmd, cmdArgs] =
        process.platform === 'win32'
            ? ['rundll32', ['url.dll,FileProtocolHandler', url]]
            : process.platform === 'darwin'
              ? ['open', [url]]
              : ['xdg-open', [url]];
    try {
        const child = spawn(cmd, cmdArgs, { stdio: 'ignore', detached: true });
        child.on('error', () => {});
        child.unref();
    } catch {
        // No browser to open: the address is on the screen.
    }
}

// Anything that goes wrong while starting ends through fail(), so that a double-clicked binary
// on Windows still shows the message before its window closes.
main().catch((err) => fail(err?.message || String(err)));
