#!/usr/bin/env node
/**
 * QSEoW session monitor: polls every proxy and virtual proxy plus the licence usage records,
 * and alerts when a user nears the limit of parallel sessions. Read-only towards Sense.
 *
 * Usage: node src/index.js [--config config.yaml] [--once]
 *        node src/index.js --simulate 300        (a made-up site of 300 users, no Sense needed)
 */
import { parseArgs } from 'node:util';
import { loadConfig } from './config.js';
import { SenseClient, explain } from './sense.js';
import { discover, snapshot, licenceOverview, AllocationCache } from './collect.js';
import { Tracker } from './model.js';
import { consoleOutput } from './outputs/console.js';
import { webOutput } from './outputs/web.js';
import { webhookOutput } from './outputs/webhook.js';
import { mqttOutput } from './outputs/mqtt.js';
import { SimulatedSite } from './simulate.js';

const { values: args } = parseArgs({
    options: {
        config: { type: 'string', short: 'c', default: 'config.yaml' },
        once: { type: 'boolean', default: false },
        simulate: { type: 'string' },
    },
});

const simulateUsers = args.simulate ? Number(args.simulate) : 0;
if (args.simulate && !(simulateUsers > 0))
    throw new Error('--simulate needs a number of users, e.g. --simulate 300');
let cfg;
try {
    cfg = loadConfig(args.config, { simulate: simulateUsers > 0 });
} catch (err) {
    console.error(`\n${err.message}\n`);
    process.exit(1);
}
const client = simulateUsers ? null : new SenseClient(cfg.sense, cfg.poll.requestTimeoutSeconds);
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
const allocationCache = new AllocationCache(cfg.poll.licenceOverviewSeconds * 1000);
// Usage records older than this can neither hold a slot nor appear on the timeline.
const recordsSinceMs =
    Math.max(cfg.limit.windowSeconds * 1000, cfg.outputs.web.timelineMinutes * 60000) + 60000;
let licencesAt = 0;
let stopping = false;
let timer = null;

async function tick() {
    if (site) return publish(site.step(Date.now(), recordsSinceMs));
    if (Date.now() - discoveredAt > cfg.poll.discoveryIntervalSeconds * 1000 || !targets.length) {
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
    const snap = await snapshot(client, targets, { allocationCache, recordsSinceMs });
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
    if (stopping) return;
    stopping = true;
    clearTimeout(timer);
    await Promise.all(outputs.map((out) => out.close?.()));
    client?.close();
    process.exit(0);
}

process.on('SIGINT', stop);
process.on('SIGTERM', stop);

log(
    `starting: limit ${cfg.limit.sessions} sessions per ${cfg.limit.windowSeconds} s, warn at ${cfg.limit.warnAt}, critical at ${cfg.limit.criticalAt}, poll every ${cfg.poll.intervalSeconds} s; outputs: ${outputs.map((x) => x.name).join(', ')}`
);
await Promise.all(outputs.map((out) => out.ready));
if (site) {
    // Give the simulated site a past: run its last half hour quickly, feeding only the web page,
    // so the timelines and the feed have something to show from the start.
    log(`simulating a site with ${simulateUsers} users`);
    const web = outputs.filter((x) => x.name === 'web');
    const step = cfg.poll.intervalSeconds * 1000;
    for (let at = Date.now() - cfg.outputs.web.timelineMinutes * 60000; at < Date.now(); at += step)
        await publish(site.step(at, recordsSinceMs), web);
}
if (args.once) {
    o.console.table = true;
    await tick();
    await stop();
} else {
    loop();
}
