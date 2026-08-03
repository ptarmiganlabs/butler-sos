import globals from '../globals.js';
import { SECRET_KEY_NAME_REGEX } from './secret-patterns.js';

/**
 * Keys whose values are credentials and must never be shown, at any depth in the config.
 *
 * This is deliberately a fail-safe rule rather than a list of known paths: a secret added
 * to the config schema in future is redacted without anyone remembering to update this file.
 * The keyword list is shared with `crash-dump.js` via `secret-patterns.js` so the two places
 * that recognise secrets cannot drift apart.
 *
 * The rule covers the key *name* only. Paths whose key name gives no hint that the value is
 * a credential are listed in {@link FULL_MASK_PATHS} instead.
 */
const SECRET_KEY_REGEX = SECRET_KEY_NAME_REGEX;

/**
 * Paths that must be fully masked even though their key name looks innocuous.
 *
 * `newRelic.event.header[]` and `newRelic.metric.header[]` are the documented place to put
 * the New Relic ingest `Api-Key` (see `production_template.yaml`, and the consumption at
 * `post-to-new-relic.js`), but the entries are `{name, value}` pairs — so the credential
 * lives under the key `value`, which {@link SECRET_KEY_REGEX} cannot recognise.
 *
 * These must be matched by path, not by shape: `newRelic.event.attribute.static[]` uses the
 * identical `{name, value}` shape but holds non-sensitive dimensions, so masking every
 * `value` in a `{name, value}` pair would over-mask.
 */
const FULL_MASK_PATHS = new Set([
    'newRelic.event.header[].value',
    'newRelic.metric.header[].value',
]);

/** Replacement used for fully masked values. */
const MASK = '*'.repeat(10);

/**
 * Partial-masking rules, keyed by config path relative to the `Butler-SOS` root.
 *
 * These values are not secrets — they are hostnames, topics, ids and file paths that are
 * useful to see when eyeballing a config, but which reveal more about the environment than
 * is wanted in a shared screenshot. Each keeps a short prefix and masks the rest.
 *
 * Paths use `[]` to denote "every element of this array".
 */
const PARTIAL_MASK_RULES = new Map([
    ['configVisualisation.host', 3],
    ['heartbeat.remoteURL', 10],
    ['thirdPartyToolsCredentials.newRelic[].accountId', 3],
    ['userEvents.udpServerConfig.serverHost', 3],
    ['userEvents.sendToMQTT.postTo.everythingTopic.topic', 10],
    ['userEvents.sendToMQTT.postTo.sessionStartTopic.topic', 10],
    ['userEvents.sendToMQTT.postTo.sessionStopTopic.topic', 10],
    ['userEvents.sendToMQTT.postTo.connectionOpenTopic.topic', 10],
    ['userEvents.sendToMQTT.postTo.connectionCloseTopic.topic', 10],
    ['logEvents.udpServerConfig.serverHost', 3],
    ['logEvents.sendToMQTT.baseTopic', 10],
    ['logEvents.enginePerformanceMonitor.monitorFilter.appSpecific.app[].include[].appId', 5],
    ['logEvents.enginePerformanceMonitor.monitorFilter.appSpecific.app[].include[].appName', 5],
    ['cert.clientCert', 10],
    ['cert.clientCertKey', 10],
    ['cert.clientCertCA', 10],
    ['mqttConfig.brokerHost', 3],
    ['prometheus.host', 3],
    ['influxdbConfig.host', 3],
    ['influxdbConfig.v2Config.org', 3],
    ['influxdbConfig.v2Config.bucket', 3],
    ['influxdbConfig.v1Config.auth.username', 3],
    ['prometheus.nodeMetricsHost', 3],
    ['appNames.hostIP', 3],
    ['serversToMonitor.servers[].host', 3],
    ['serversToMonitor.servers[].userSessions.host', 3],
    ['serversToMonitor.servers[].userSessions.virtualProxies[].virtualProxy', 3],
    ['serversToMonitor.servers[].headers.*', 5],
]);

/**
 * Masks a value, keeping the first `keepChars` characters.
 *
 * Non-string values are coerced to string first so numeric ids (e.g. New Relic accountId)
 * are handled the same way. Nullish values are returned untouched — an absent optional
 * setting should stay absent rather than become a row of asterisks.
 *
 * @param {*} value - The value to mask.
 * @param {number} keepChars - Number of leading characters to preserve.
 * @returns {*} The masked value, or the original value when nullish.
 */
function maskPartially(value, keepChars) {
    if (value === undefined || value === null) return value;

    return String(value).substring(0, keepChars) + MASK;
}

/**
 * Builds the lookup path for a child, using `[]` for array elements.
 *
 * @param {string} parentPath - Path of the containing object, '' at the root.
 * @param {string|number} key - Property name, or array index.
 * @param {boolean} isArrayElement - True when the parent is an array.
 * @returns {string} Path used to match against {@link PARTIAL_MASK_RULES}.
 */
function buildPath(parentPath, key, isArrayElement) {
    if (isArrayElement) return `${parentPath}[]`;
    return parentPath ? `${parentPath}.${key}` : String(key);
}

/**
 * Replaces every primitive leaf in a value with {@link MASK}, preserving structure.
 *
 * Used when a key is identified as a credential. Masking the whole subtree — rather than
 * only a scalar value — is what makes the fail-safe rule actually fail safe: a credential
 * held in an array (`apiTokens: ['a', 'b']`) or an object (`secretStore: { value: 'x' }`)
 * is masked too. An earlier version skipped the mask whenever the value was not a scalar,
 * so both of those shapes were served in plaintext.
 *
 * Structure is preserved rather than collapsed to a single string so the rendered config
 * still shows the operator how many entries exist and how they are nested.
 *
 * Nullish leaves are returned untouched — an unset optional secret should read as unset,
 * not as a mask implying a value is present.
 *
 * @param {*} value - The value to mask.
 * @returns {*} A masked copy of the value.
 */
function maskSubtree(value) {
    if (value === undefined || value === null) return value;

    if (Array.isArray(value)) return value.map(maskSubtree);

    if (typeof value === 'object') {
        const masked = {};
        for (const [key, child] of Object.entries(value)) {
            if (key === '__proto__') continue;
            masked[key] = maskSubtree(child);
        }
        return masked;
    }

    return MASK;
}

/**
 * Recursively obfuscates a config subtree in place.
 *
 * Order matters: the credential rules are checked before the partial rules so a key such as
 * `apiToken` is always fully masked.
 *
 * A value is fully masked when either its key name matches {@link SECRET_KEY_REGEX} or its
 * path is listed in {@link FULL_MASK_PATHS}. In both cases the entire subtree is masked via
 * {@link maskSubtree}, so credentials in arrays and objects are covered, not just scalars.
 *
 * @param {*} node - The current node (object or array).
 * @param {string} path - Path of `node` relative to the `Butler-SOS` root.
 * @returns {void}
 */
function obfuscateNode(node, path) {
    if (node === null || typeof node !== 'object') return;

    const isArray = Array.isArray(node);

    // Wildcard rule for objects whose keys are operator-defined and so cannot be listed
    // ahead of time — currently `serversToMonitor.servers[].headers`. Resolved from the
    // parent path rather than by string-splitting the child path, so keys containing dots
    // (legal in HTTP header names) still match.
    const wildcardKeepChars = PARTIAL_MASK_RULES.get(`${path}.*`);

    for (const [key, value] of Object.entries(node)) {
        if (key === '__proto__') continue;

        const childPath = buildPath(path, key, isArray);

        // Full mask for anything that looks like a credential, at any depth. The key-name
        // check is skipped for array elements, whose keys are meaningless numeric indices —
        // an array under a secret-named key is already handled by maskSubtree at the parent.
        const isCredential =
            (!isArray && SECRET_KEY_REGEX.test(key)) || FULL_MASK_PATHS.has(childPath);

        if (isCredential) {
            node[key] = maskSubtree(value);
            continue;
        }

        if (value !== null && typeof value === 'object') {
            obfuscateNode(value, childPath);
            continue;
        }

        const keepChars = PARTIAL_MASK_RULES.get(childPath) ?? wildcardKeepChars;
        if (keepChars !== undefined) {
            node[key] = maskPartially(value, keepChars);
        }
    }
}

/**
 * Obfuscates sensitive information in the Butler SOS configuration object.
 *
 * Returns a deep copy — the input is never mutated, so this is safe to call on the live
 * config object.
 *
 * Three rules are applied:
 * 1. Any key whose name matches {@link SECRET_KEY_REGEX} (password, passwd, pwd, secret,
 *    token, apiKey, apiToken, accessKey, passphrase, clientSecret) has its entire subtree
 *    masked, wherever it appears in the tree. This is the fail-safe default: new secrets are
 *    protected without changing this file. The keyword list lives in `secret-patterns.js`,
 *    shared with `crash-dump.js`.
 * 2. Paths listed in {@link FULL_MASK_PATHS} are fully masked despite an innocuous key name.
 * 3. Paths listed in {@link PARTIAL_MASK_RULES} keep a short prefix and mask the rest.
 *    These are environment details (hosts, MQTT topics, cert paths, app ids) rather than
 *    credentials, and remain partly readable so a config stays recognisable.
 *
 * The JSON round-trip both deep-copies and strips any prototype (`globals.config` is a
 * node-config instance whose accessors must not survive into `yaml.dump`), so callers do
 * not need to pre-copy.
 *
 * @param {object} config - The original configuration object to obfuscate.
 * @returns {object} A new configuration object with sensitive information masked.
 * @throws {Error} If there's an error during the obfuscation process.
 */
function configObfuscate(config) {
    try {
        const obfuscatedConfig = JSON.parse(JSON.stringify(config));

        // All rules are expressed relative to the Butler-SOS root. Tolerate its absence so
        // a partial or malformed config cannot turn the config UI into a 500.
        if (
            obfuscatedConfig?.['Butler-SOS'] &&
            typeof obfuscatedConfig['Butler-SOS'] === 'object'
        ) {
            obfuscateNode(obfuscatedConfig['Butler-SOS'], '');
        }

        return obfuscatedConfig;
    } catch (err) {
        globals.logger.error(
            `CONFIG OBFUSCATE: Error obfuscating config: ${globals.getErrorMessage(err)}`
        );
        throw err;
    }
}

export default configObfuscate;
