import { jest } from '@jest/globals';

/**
 * Stand-in for the globals `getErrorMessage` method.
 *
 * @param {Error} err - The error to format.
 * @returns {string} The error message.
 */
function fakeGetErrorMessage(err) {
    return err.message;
}

jest.unstable_mockModule('../../globals.js', () => ({
    default: {
        logger: { error: jest.fn() },
        getErrorMessage: fakeGetErrorMessage,
    },
}));

const configObfuscate = (await import('../config-obfuscate.js')).default;
// Enter the schema module graph via config-file-schema.js, not config-schemas/index.js.
// There is a real import cycle (config-schemas/app-sessions.js -> host-utils.js -> globals.js
// -> globals/config-loader.js -> config-file-verify.js -> config-file-schema.js), and only
// this entry point resolves it. Importing config-schemas/index.js directly throws
// "Cannot access 'configFileSchema' before initialization".
const configFileSchema = (await import('../config-file-schema.js')).default;

/**
 * Config paths that are intentionally left readable in the config visualisation UI.
 *
 * This list is the point of the whole test file. Every string-valued leaf in the config
 * schema must be either masked by `config-obfuscate.js` or named here — so adding a field to
 * the schema fails CI until somebody decides which it is. The previous approach, a
 * hand-maintained list of paths to mask, silently drifted from the schema and leaked the
 * InfluxDB v3 token, the audit TLS passphrase, the New Relic ingest key and the Qlik virtual
 * proxy names.
 *
 * Being on this list is a deliberate decision that the value is not sensitive enough to hide
 * from someone who can already reach the config UI. Some entries are judgement calls rather
 * than obvious — they are grouped and annotated below so the choice stays reviewable.
 */
const SAFE_PATHS = new Set([
    // Operational settings with no bearing on security.
    'logLevel',
    'logDirectory',
    'crashFile.crashFileDirectory',
    'heartbeat.frequency',
    'uptimeMonitor.frequency',
    'uptimeMonitor.logLevel',
    'uptimeMonitor.storeInInfluxdb.instanceTag',
    'errorTracking.influxdb.measurementName',

    // InfluxDB / MQTT schema names and retention policy. Names of the destination objects,
    // not credentials; the tokens and passwords beside them are masked.
    'mqttConfig.baseTopic',
    'influxdbConfig.v3Config.database',
    'influxdbConfig.v3Config.description',
    'influxdbConfig.v3Config.retentionDuration',
    'influxdbConfig.v2Config.description',
    'influxdbConfig.v2Config.retentionDuration',
    'influxdbConfig.v1Config.dbName',
    'influxdbConfig.v1Config.retentionPolicy.name',
    'influxdbConfig.v1Config.retentionPolicy.duration',
    'qlikSenseEvents.eventCount.influxdb.measurementName',
    'qlikSenseEvents.rejectedEventCount.influxdb.measurementName',
    'userEvents.udpServerConfig.queueMetrics.influxdb.measurementName',
    'logEvents.udpServerConfig.queueMetrics.influxdb.measurementName',
    'auditEvents.queue.queueMetrics.influxdb.measurementName',

    // Operator-authored tag/attribute names and values attached to emitted metrics. These are
    // written into InfluxDB/New Relic in cleartext anyway, so hiding them here buys nothing.
    'qlikSenseEvents.eventCount.influxdb.tags[].name',
    'qlikSenseEvents.eventCount.influxdb.tags[].value',
    'userEvents.udpServerConfig.queueMetrics.influxdb.tags[].name',
    'userEvents.udpServerConfig.queueMetrics.influxdb.tags[].value',
    'userEvents.tags[].name',
    'userEvents.tags[].value',
    'logEvents.udpServerConfig.queueMetrics.influxdb.tags[].name',
    'logEvents.udpServerConfig.queueMetrics.influxdb.tags[].value',
    'logEvents.tags[].name',
    'logEvents.tags[].value',
    'logEvents.enginePerformanceMonitor.trackRejectedEvents.tags[].name',
    'logEvents.enginePerformanceMonitor.trackRejectedEvents.tags[].value',
    'auditEvents.queue.queueMetrics.influxdb.tags[].name',
    'auditEvents.queue.queueMetrics.influxdb.tags[].value',
    'uptimeMonitor.storeNewRelic.attribute.static[].name',
    'uptimeMonitor.storeNewRelic.attribute.static[].value',
    'newRelic.event.attribute.static[].name',
    'newRelic.event.attribute.static[].value',
    'newRelic.metric.attribute.static[].name',
    'newRelic.metric.attribute.static[].value',
    'auditEvents.destination.influxdb.metadata.staticTags[].name',
    'auditEvents.destination.influxdb.metadata.staticTags[].value',
    'auditEvents.destination.influxdb.objectdata.staticTags[].name',
    'auditEvents.destination.influxdb.objectdata.staticTags[].value',
    'auditEvents.destination.parquet.metadata.staticTags[].name',
    'auditEvents.destination.parquet.metadata.staticTags[].value',
    'auditEvents.destination.parquet.objectdata.staticTags[].name',
    'auditEvents.destination.parquet.objectdata.staticTags[].value',
    'auditEvents.destination.qvd.metadata.staticTags[].name',
    'auditEvents.destination.qvd.metadata.staticTags[].value',
    'auditEvents.destination.qvd.objectdata.staticTags[].name',
    'auditEvents.destination.qvd.objectdata.staticTags[].value',
    'auditEvents.destination.json.objectdata.staticTags[].name',
    'auditEvents.destination.json.objectdata.staticTags[].value',

    // New Relic account selectors and public ingest endpoints. The ingest key itself lives in
    // `newRelic.*.header[].value`, which is fully masked; the header *name* is not secret.
    'thirdPartyToolsCredentials.newRelic[].accountName',
    'uptimeMonitor.storeNewRelic.destinationAccount[]',
    'userEvents.sendToNewRelic.destinationAccount[]',
    'logEvents.sendToNewRelic.destinationAccount[]',
    'newRelic.metric.destinationAccount[]',
    'newRelic.event.url',
    'newRelic.event.header[].name',
    'newRelic.metric.url',
    'newRelic.metric.header[].name',

    // Log categorisation and engine-performance filter rules. Operator-authored matching
    // logic; verbose, and needed in readable form to debug why an event was filtered.
    'logEvents.categorise.rules[].description',
    'logEvents.categorise.rules[].logLevel[]',
    'logEvents.categorise.rules[].action',
    'logEvents.categorise.rules[].category[].name',
    'logEvents.categorise.rules[].category[].value',
    'logEvents.categorise.rules[].filter[].type',
    'logEvents.categorise.rules[].filter[].value',
    'logEvents.categorise.ruleDefault.category[].name',
    'logEvents.categorise.ruleDefault.category[].value',
    'logEvents.enginePerformanceMonitor.monitorFilter.allApps.appExclude[].appId',
    'logEvents.enginePerformanceMonitor.monitorFilter.allApps.appExclude[].appName',
    'logEvents.enginePerformanceMonitor.monitorFilter.allApps.objectType.allObjectTypesExclude[]',
    'logEvents.enginePerformanceMonitor.monitorFilter.allApps.objectType.someObjectTypesInclude[]',
    'logEvents.enginePerformanceMonitor.monitorFilter.allApps.method.allMethodsExclude[]',
    'logEvents.enginePerformanceMonitor.monitorFilter.allApps.method.someMethodsInclude[]',
    'logEvents.enginePerformanceMonitor.monitorFilter.appSpecific.app[].objectType.allObjectTypesExclude[]',
    'logEvents.enginePerformanceMonitor.monitorFilter.appSpecific.app[].objectType.someObjectTypesInclude[]',
    'logEvents.enginePerformanceMonitor.monitorFilter.appSpecific.app[].appObject.allAppObjectsExclude[]',
    'logEvents.enginePerformanceMonitor.monitorFilter.appSpecific.app[].appObject.someAppObjectsInclude[]',
    'logEvents.enginePerformanceMonitor.monitorFilter.appSpecific.app[].method.allMethodsExclude[]',
    'logEvents.enginePerformanceMonitor.monitorFilter.appSpecific.app[].method.someMethodsInclude[]',

    // JUDGEMENT CALL — Qlik user identities in exclude lists, and server tag values. These do
    // name real accounts and real infrastructure. They are left readable because the config UI
    // is an operator troubleshooting tool and an exclude list is unusable when masked. Note
    // `serversToMonitor.servers[].headers` values ARE masked, because those carry auth.
    'userEvents.excludeUser[].directory',
    'userEvents.excludeUser[].userId',
    'userSessions.excludeUser[].directory',
    'userSessions.excludeUser[].userId',
    'serversToMonitor.serverTagsDefinition[]',
    'serversToMonitor.servers[].serverName',
    'serversToMonitor.servers[].serverDescription',

    // JUDGEMENT CALL — UDP source allow-lists and CORS origins. Access-control configuration
    // rather than credentials; readable form is what makes a misconfiguration diagnosable.
    'userEvents.udpServerConfig.allowedSources[]',
    'logEvents.udpServerConfig.allowedSources[]',
    'auditEvents.cors.allowedOrigins[]',
    'auditEvents.destination.screenshots.allowedImageDownloadHosts[]',

    // JUDGEMENT CALL — audit events destination hosts, schema names and on-disk export dirs.
    // Environment topology, not credentials; every token/password under these paths is masked.
    // Inconsistent with the top-level influxdbConfig equivalents, which keep a masked prefix —
    // if that inconsistency is ever resolved, it should be by adding partial rules here.
    'auditEvents.host',
    'auditEvents.destination.type',
    'auditEvents.destination.influxdb.metadata.host',
    'auditEvents.destination.influxdb.metadata.measurementName',
    'auditEvents.destination.influxdb.metadata.auditEventSchemaVersion',
    'auditEvents.destination.influxdb.metadata.v3Config.database',
    'auditEvents.destination.influxdb.metadata.v3Config.description',
    'auditEvents.destination.influxdb.metadata.v3Config.retentionDuration',
    'auditEvents.destination.influxdb.metadata.v2Config.org',
    'auditEvents.destination.influxdb.metadata.v2Config.bucket',
    'auditEvents.destination.influxdb.metadata.v2Config.description',
    'auditEvents.destination.influxdb.metadata.v2Config.retentionDuration',
    'auditEvents.destination.influxdb.metadata.v1Config.auth.username',
    'auditEvents.destination.influxdb.metadata.v1Config.dbName',
    'auditEvents.destination.influxdb.metadata.v1Config.retentionPolicy.name',
    'auditEvents.destination.influxdb.metadata.v1Config.retentionPolicy.duration',
    'auditEvents.destination.influxdb.objectdata.exportDirectory',
    'auditEvents.destination.parquet.metadata.exportDirectory',
    'auditEvents.destination.parquet.objectdata.exportDirectory',
    'auditEvents.destination.qvd.metadata.exportDirectory',
    'auditEvents.destination.qvd.objectdata.exportDirectory',
    'auditEvents.destination.json.objectdata.exportDirectory',
    'auditEvents.destination.screenshots.storageTargets[].type',
    'auditEvents.destination.screenshots.storageTargets[].directory',

    // JUDGEMENT CALL — QPS service-account identity used to mint screenshot tickets, and the
    // audit TLS certificate file paths. No secret material: authentication is by mutual TLS,
    // and `auditEvents.tls.passphrase` (the one secret here) is masked.
    'auditEvents.destination.screenshots.auth.mode',
    'auditEvents.destination.screenshots.auth.qps.host',
    'auditEvents.destination.screenshots.auth.qps.userDirectory',
    'auditEvents.destination.screenshots.auth.qps.userId',
    'auditEvents.destination.screenshots.auth.qps.virtualProxy',
    'auditEvents.tls.cert',
    'auditEvents.tls.key',
    'auditEvents.tls.ca',
]);

/**
 * Marker written into every string leaf so masking can be detected by comparison.
 *
 * @param {number} index - Position of the leaf, making each sentinel unique.
 * @returns {string} The sentinel value for that leaf.
 */
function SENTINEL(index) {
    return `SENTINEL${index}VALUE`;
}

/** Full mask emitted by config-obfuscate.js. */
const MASK = '*'.repeat(10);

/**
 * Collects every string-typed leaf path from a JSON schema.
 *
 * Array membership is denoted `[]`, matching the path syntax config-obfuscate.js uses.
 *
 * @param {object} node - Current schema node.
 * @param {string} path - Path accumulated so far.
 * @param {string[]} out - Collected leaf paths.
 * @returns {string[]} All string-typed leaf paths.
 */
function collectStringLeaves(node, path, out = []) {
    if (!node || typeof node !== 'object') return out;

    if (node.properties) {
        for (const [key, child] of Object.entries(node.properties)) {
            collectStringLeaves(child, path ? `${path}.${key}` : key, out);
        }
        return out;
    }

    if (node.items) {
        collectStringLeaves(node.items, `${path}[]`, out);
        return out;
    }

    const types = Array.isArray(node.type) ? node.type : [node.type];
    if (types.includes('string')) out.push(path);

    return out;
}

/**
 * Writes a value at a `[]`-aware path, creating intermediate objects and arrays.
 *
 * @param {object} root - Object to write into.
 * @param {string} path - Target path.
 * @param {string} value - Value to set.
 * @returns {void}
 */
function setAtPath(root, path, value) {
    const parts = path.split('.');
    let cursor = root;

    for (let i = 0; i < parts.length; i++) {
        const isArray = parts[i].endsWith('[]');
        const key = isArray ? parts[i].slice(0, -2) : parts[i];
        const isLast = i === parts.length - 1;

        // Paths come from the config schema, not user input, so this cannot be reached with
        // a hostile key today. Guarded anyway: assigning down an unvalidated property chain
        // is the prototype-pollution pattern, and a helper that walks arbitrary paths should
        // not be the thing that makes it reachable later.
        // Written as explicit comparisons rather than a Set lookup: CodeQL's
        // js/prototype-pollution-utility query only recognises the guard in this form.
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') return;

        if (isLast && !isArray) {
            cursor[key] = value;
            return;
        }

        if (isArray) {
            if (!Array.isArray(cursor[key])) cursor[key] = [{}];
            if (isLast) {
                cursor[key] = [value];
                return;
            }
            if (typeof cursor[key][0] !== 'object' || cursor[key][0] === null) {
                cursor[key][0] = {};
            }
            cursor = cursor[key][0];
        } else {
            if (typeof cursor[key] !== 'object' || cursor[key] === null) cursor[key] = {};
            cursor = cursor[key];
        }
    }
}

/**
 * Reads the value at a `[]`-aware path.
 *
 * @param {object} root - Object to read from.
 * @param {string} path - Target path.
 * @returns {*} The value, or undefined when any segment is missing.
 */
function getAtPath(root, path) {
    let cursor = root;

    for (const part of path.split('.')) {
        if (cursor === undefined || cursor === null) return undefined;

        const isArray = part.endsWith('[]');
        const key = isArray ? part.slice(0, -2) : part;
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') return undefined;
        cursor = cursor[key];

        if (isArray) {
            if (!Array.isArray(cursor)) return undefined;
            cursor = cursor[0];
        }
    }

    return cursor;
}

describe('config obfuscation covers the whole config schema', () => {
    const leaves = collectStringLeaves(configFileSchema.properties['Butler-SOS'], '');

    /**
     * Builds a config with a unique sentinel at every string leaf, and obfuscates it.
     *
     * @returns {{ leaves: string[], obfuscated: object }} Leaf paths and the obfuscated tree.
     */
    function obfuscateSentinelConfig() {
        const config = {};
        leaves.forEach((leafPath, index) => setAtPath(config, leafPath, SENTINEL(index)));
        return { leaves, obfuscated: configObfuscate({ 'Butler-SOS': config })['Butler-SOS'] };
    }

    test('the schema walk finds a plausible number of string leaves', () => {
        // Guards against the walk silently breaking (e.g. a schema refactor changing shape)
        // and turning every assertion below into a vacuous pass.
        expect(leaves.length).toBeGreaterThan(150);
        expect(leaves).toContain('influxdbConfig.v3Config.token');
        expect(leaves).toContain('newRelic.event.header[].value');
    });

    // The core guard. A new sensitive field added to the schema fails here until someone
    // either gives it a masking rule or consciously adds it to SAFE_PATHS.
    test('every string leaf is either masked or explicitly classified as safe', () => {
        const { obfuscated } = obfuscateSentinelConfig();

        const unclassified = leaves.filter((leafPath, index) => {
            const value = getAtPath(obfuscated, leafPath);
            if (value === undefined) return false; // not reachable in the built shape
            const isUnmasked = value === SENTINEL(index);
            return isUnmasked && !SAFE_PATHS.has(leafPath);
        });

        expect(unclassified).toEqual([]);
    });

    test('SAFE_PATHS contains no stale entries', () => {
        const { obfuscated } = obfuscateSentinelConfig();

        const nowMasked = [...SAFE_PATHS].filter((leafPath) => {
            const index = leaves.indexOf(leafPath);
            if (index === -1) return true; // path no longer exists in the schema
            const value = getAtPath(obfuscated, leafPath);
            return value !== undefined && value !== SENTINEL(index);
        });

        expect(nowMasked).toEqual([]);
    });

    test('known credential paths are fully masked', () => {
        const { obfuscated } = obfuscateSentinelConfig();

        const mustBeFullyMasked = [
            'influxdbConfig.v3Config.token',
            'influxdbConfig.v2Config.token',
            'influxdbConfig.v1Config.auth.password',
            'cert.clientCertPassphrase',
            'auditEvents.apiToken',
            'auditEvents.tls.passphrase',
            'auditEvents.destination.influxdb.metadata.v3Config.token',
            'auditEvents.destination.influxdb.metadata.v2Config.token',
            'auditEvents.destination.influxdb.metadata.v1Config.auth.password',
            'thirdPartyToolsCredentials.newRelic[].insertApiKey',
            'newRelic.event.header[].value',
            'newRelic.metric.header[].value',
        ];

        for (const leafPath of mustBeFullyMasked) {
            expect(leaves).toContain(leafPath);
            expect(getAtPath(obfuscated, leafPath)).toBe(MASK);
        }
    });
});
