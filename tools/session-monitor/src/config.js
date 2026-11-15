import fs from 'node:fs';
import path from 'node:path';
import { load as loadYaml } from 'js-yaml';

const DEFAULTS = {
    sense: {
        repositoryPort: 4242,
        apiUser: { userDirectory: 'INTERNAL', userId: 'sa_api' },
        virtualProxies: [],
    },
    poll: {
        intervalSeconds: 15,
        discoveryIntervalSeconds: 600,
        licenceOverviewSeconds: 60,
        requestTimeoutSeconds: 10,
    },
    limit: {
        sessions: 5,
        windowSeconds: 360,
        warnAt: 4,
        criticalAt: 5,
        refusalGraceSeconds: 20,
        excludeUsers: [
            'INTERNAL\\sa_api',
            'INTERNAL\\sa_proxy',
            'INTERNAL\\sa_repository',
            'INTERNAL\\sa_scheduler',
            'INTERNAL\\sa_engine',
        ],
    },
    outputs: {
        console: { enable: true, table: false },
        web: { enable: true, host: '127.0.0.1', port: 3939, timelineMinutes: 30, title: '' },
        webhook: { enable: false },
        mqtt: { enable: false, topicRoot: 'qliksense/sessionmonitor', publishUserState: true },
    },
};

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * Deep-merges `over` onto `base`. Arrays and scalars in `over` replace those in `base`.
 *
 * @param {object} base Defaults.
 * @param {object} over Values from the config file.
 * @returns {object} The merged object.
 */
function merge(base, over) {
    const out = { ...base };
    for (const [k, v] of Object.entries(over || {})) {
        out[k] = isObject(v) && isObject(base[k]) ? merge(base[k], v) : v;
    }
    return out;
}

/**
 * Checks the settings the monitor cannot run without. Throws one error listing every problem.
 *
 * @param {object} c Merged configuration.
 */
function validate(c, simulate) {
    const errors = [];
    const need = (cond, msg) => cond || errors.push(msg);
    if (!simulate) {
        need(
            c.sense.repositoryHost,
            'The Sense server is missing: pass --host, or set sense.host in config.yaml, to the name of your central Sense server.'
        );
        const missing = ['certFile', 'keyFile', 'caFile'].filter(
            (f) => !c.sense[f] || !fs.existsSync(c.sense[f])
        );
        need(
            !missing.length,
            `Certificate files not found: ${missing.map((f) => c.sense[f] || f).join(', ')}.\n    Export them from the QMC (Certificates > Export, "Platform independent PEM-format") and pass the folder holding client.pem, client_key.pem and root.pem with --certs, or set it as sense.certDir in config.yaml.`
        );
    }
    const l = c.limit;
    need(
        Number.isInteger(l.sessions) && l.sessions > 0,
        'limit.sessions must be a positive integer'
    );
    need(l.windowSeconds > 0, 'limit.windowSeconds must be > 0');
    need(l.warnAt <= l.criticalAt, 'limit.warnAt must not be above limit.criticalAt');
    need(c.poll.intervalSeconds >= 5, 'poll.intervalSeconds must be at least 5');
    need(
        l.refusalGraceSeconds >= c.poll.intervalSeconds,
        'limit.refusalGraceSeconds must be at least poll.intervalSeconds'
    );
    const o = c.outputs;
    if (o.webhook.enable) need(o.webhook.url, 'outputs.webhook.url is required');
    if (o.mqtt.enable) need(o.mqtt.url, 'outputs.mqtt.url is required');
    if (errors.length) throw new Error(`Invalid configuration:\n  - ${errors.join('\n  - ')}`);
}

/**
 * Reads, merges and validates the configuration: the defaults, then the YAML file if there is one,
 * then `overrides` (from the command line, or found on the Sense server itself).
 *
 * @param {string | null} file Path to the YAML file, or null for none.
 * @param {object} [opts] Options.
 * @param {boolean} [opts.simulate] No Sense connection is needed (a simulated site).
 * @param {object} [opts.overrides] Settings that win over the file's.
 * @param {string} [opts.demoHint] How to start the demo, for the error when nothing is configured.
 * @returns {object} The configuration.
 */
export function loadConfig(
    file,
    { simulate = false, overrides = {}, demoHint = 'npm run demo' } = {}
) {
    // A file that was asked for must be there: running on defaults instead could, say, open the
    // web page that file would have turned off.
    if (file && !fs.existsSync(file)) throw new Error(`No configuration file found at ${file}.`);
    const haveFile = Boolean(file);
    // A simulated site, or a server named on the command line, needs no configuration file.
    if (!simulate && !haveFile && !overrides.sense?.host) {
        throw new Error(
            'Nothing to connect to.\n' +
                '    Copy config.example.yaml to config.yaml and set sense.host and sense.certDir, then start again,\n' +
                '    or name the server on the command line: --host <server> --certs <folder>.\n' +
                `    To try the page without a Sense server: ${demoHint}`
        );
    }
    // The demo without a config file keeps the terminal quiet: the page is what it's for.
    const raw = haveFile
        ? loadYaml(fs.readFileSync(file, 'utf8')) || {}
        : simulate
          ? { outputs: { console: { enable: false } } }
          : {};
    // Relative certificate paths in the file are relative to the file, not to wherever the program
    // was started from: a config.yaml next to the binary can name a certs folder next to it too.
    if (haveFile && isObject(raw.sense)) {
        const base = path.dirname(path.resolve(file));
        for (const k of ['certDir', 'certFile', 'keyFile', 'caFile'])
            if (typeof raw.sense[k] === 'string' && raw.sense[k] && !path.isAbsolute(raw.sense[k]))
                raw.sense[k] = path.resolve(base, raw.sense[k]);
    }
    const c = merge(merge(DEFAULTS, raw), overrides);
    // Friendlier names: sense.host for the server, sense.certDir for the folder the QMC export made.
    c.sense.repositoryHost = overrides.sense?.host ?? c.sense.repositoryHost ?? c.sense.host;
    // A certificate folder given on the command line (or found on the server) wins over any
    // certificate files the configuration file names.
    if (overrides.sense?.certDir) {
        delete c.sense.certFile;
        delete c.sense.keyFile;
        delete c.sense.caFile;
    }
    if (c.sense.certDir) {
        c.sense.certFile ??= path.join(c.sense.certDir, 'client.pem');
        c.sense.keyFile ??= path.join(c.sense.certDir, 'client_key.pem');
        c.sense.caFile ??= path.join(c.sense.certDir, 'root.pem');
    }
    c.limit.excludeUsers = (c.limit.excludeUsers || []).map((u) => String(u).toLowerCase());
    c.sense.virtualProxies = (c.sense.virtualProxies || []).map((p) =>
        String(p).replace(/^\/+|\/+$/g, '')
    );
    validate(c, simulate);
    return c;
}
