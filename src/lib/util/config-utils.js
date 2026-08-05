/**
 * Helpers for reading config values whose shape the schema allows to be absent.
 *
 * Butler SOS's config schema marks ~40 fields as `['array', 'null']`, and
 * `production_template.yaml` ships many of them with every entry commented out — which YAML
 * parses as `null`, not as an empty list. Code that iterated such a value threw
 * `TypeError: X is not iterable` during startup. That is issue #1450, and it was the third
 * time this shape broke startup: #276 hit it in `globals.js` in 2021, and it returned in
 * `config-file-verify.js`.
 *
 * The fix is {@link normalizeNullableArrays}, applied once when the config is loaded, so no
 * read site anywhere in the codebase can observe `null` for one of these fields. Guarding
 * individual read sites was tried first and is the wrong depth: it leaves every future read
 * of any nullable path depending on the author remembering to guard it.
 */

/**
 * Schema keywords whose subschemas describe the *same* value as their parent.
 *
 * The schema uses `if`/`then` eleven times (the InfluxDB v1/v2/v3 and QPS shapes) and `allOf`
 * in a few places. A nullable list declared inside one of those branches describes the same
 * config node as the branch's parent, so the walk has to follow them or that list is silently
 * exempt from normalisation forever.
 */
const SAME_VALUE_BRANCH_KEYWORDS = ['allOf', 'anyOf', 'oneOf', 'if', 'then', 'else'];

/**
 * Tests whether a schema node declares a value that may be either an array or null.
 *
 * @param {object} node - Schema node.
 * @returns {boolean} True when the node's type includes both 'array' and 'null'.
 */
function isNullableArraySchema(node) {
    return (
        !!node &&
        Array.isArray(node.type) &&
        node.type.includes('array') &&
        node.type.includes('null')
    );
}

/**
 * Walks a config value and its schema together, calling `visit` at every position the schema
 * declares as a nullable array.
 *
 * Walking the two side by side — rather than collecting dotted paths from the schema and then
 * resolving each against the config — is what makes `items` work. Seven nullable lists live
 * inside array elements (`logEvents.enginePerformanceMonitor.monitorFilter.appSpecific.app[]`
 * and its `objectType`/`appObject`/`method` sub-objects), and a path-based walk cannot express
 * "the `include` field of every element of this array" without inventing an index syntax.
 *
 * @param {*} value - Config value at this position.
 * @param {object} node - Schema node describing that value.
 * @param {string} path - Dotted path, for reporting.
 * @param {(owner: object, key: string, path: string) => void} visit - Called for each nullable
 *   array position that exists in the config.
 * @param {Set<object>} seen - Schema nodes already visited on this branch, so a cyclic schema
 *   cannot recurse forever.
 * @returns {void}
 */
function walkNullableArrays(value, node, path, visit, seen) {
    if (!node || typeof node !== 'object' || seen.has(node)) return;
    seen.add(node);

    // Branch keywords describe the same value, so recurse without moving in the config.
    for (const keyword of SAME_VALUE_BRANCH_KEYWORDS) {
        const branch = node[keyword];
        if (Array.isArray(branch)) {
            for (const child of branch) walkNullableArrays(value, child, path, visit, seen);
        } else if (branch && typeof branch === 'object') {
            walkNullableArrays(value, branch, path, visit, seen);
        }
    }

    if (node.properties && value && typeof value === 'object' && !Array.isArray(value)) {
        for (const [key, child] of Object.entries(node.properties)) {
            // Object.hasOwn, not `in`: a config key called `__proto__` or `constructor` must not
            // send the walk onto Object.prototype.
            if (!Object.hasOwn(value, key)) continue;

            const childPath = path ? `${path}.${key}` : key;

            if (isNullableArraySchema(child)) {
                visit(value, key, childPath);
                // Deliberately NO `continue` here. A nullable array can be populated, and its
                // element schema can declare further nullable lists — appSpecific.app is itself
                // ['array', 'null'] and each element holds seven of them. An earlier version
                // treated the nullable array as a leaf and stopped, which left exactly those
                // seven lists un-normalised; the recursion below is the only route to
                // node.items. (visit may have just replaced null with [], in which case the
                // recursion re-reads value[key] and finds nothing to iterate.)
            }

            walkNullableArrays(value[key], child, childPath, visit, new Set(seen));
        }
    }

    if (node.items && Array.isArray(value)) {
        value.forEach((element, index) => {
            walkNullableArrays(element, node.items, `${path}[${index}]`, visit, new Set(seen));
        });
    }

    seen.delete(node);
}

/**
 * Lists every position in a config object that the schema declares as a nullable array.
 *
 * Positions, not schema paths: an entry is returned for each element of each array, so
 * `…appSpecific.app[0].include` and `…app[1].include` are separate results. Only positions that
 * actually exist in the given config are reported, which is what lets a test set each one to
 * `null` and know the write landed.
 *
 * @param {object} config - A config object (or any parsed config tree).
 * @param {object} schema - The config file JSON schema.
 * @returns {string[]} Dotted paths of every nullable-array position present in `config`.
 */
export function findNullableArrayPositions(config, schema) {
    if (!config || typeof config !== 'object' || !schema) return [];

    const positions = [];
    walkNullableArrays(config, schema, '', (_owner, _key, path) => positions.push(path), new Set());
    return positions;
}

/**
 * Replaces `null` with `[]` for every schema field declared `['array', 'null']`.
 *
 * This is the single point that makes the whole `null`-list problem class disappear: after it
 * runs, no read site anywhere can observe `null` for one of these settings, so the bug cannot
 * come back through a read somebody forgot to guard.
 *
 * Must run **before the first `config.get()` call**. That is not because of node-config's
 * immutability — Butler SOS sets `ALLOW_CONFIG_MUTATIONS` in `butler-sos.js` before loading
 * `globals.js`, which disables the freeze entirely — but because a reader that runs first would
 * see the un-normalised value. `config-loader.js` calls this immediately after loading the
 * config and before `verifyAppConfig`, the first reader.
 *
 * Mutates in place rather than returning a copy, because node-config hands out a singleton that
 * the rest of Butler SOS reaches through `globals.config`.
 *
 * @param {object} config - The loaded node-config object.
 * @param {object} schema - The config file JSON schema.
 * @returns {string[]} Paths that were actually changed, for logging and testing.
 */
export function normalizeNullableArrays(config, schema) {
    if (!config || typeof config !== 'object' || !schema) return [];

    const changed = [];
    walkNullableArrays(
        config,
        schema,
        '',
        (owner, key, path) => {
            if (owner[key] === null) {
                owner[key] = [];
                changed.push(path);
            }
        },
        new Set()
    );
    return changed;
}

/**
 * Config settings whose schema-declared default is applied (and enforced) at load time.
 *
 * Deliberately an explicit short list rather than "every field with a `default`". The schema
 * declares 81 defaults, and nothing has ever applied them — ajv validates a throwaway copy of
 * the parsed YAML, not the node-config object, so `useDefaults` there would not reach the
 * running config either. Switching all 81 on at once would change behaviour across audit
 * events, queue sizing and screenshot handling in ways this change cannot verify.
 *
 * A setting earns a place here when a missing or malformed value breaks something at runtime.
 * `maxBatchSize` is read bare — `config.get(...)` with no fallback — by 24 modules; an absent
 * path makes node-config throw, and a non-numeric or below-minimum value makes the InfluxDB
 * batch writers silently discard every write (the progressive-retry ladder filters against the
 * configured value, and `[...].filter((s) => s <= NaN)` is empty).
 *
 * File verification rejects such values when it runs, but three routes bypass it entirely:
 * `--skip-config-verification`, node-config merge layers (`local.yaml`, `NODE_CONFIG`) that the
 * file validator never sees, and configs where the owning feature is disabled — the conditional
 * schema stops validating a section once its enable flag is false.
 *
 * `enabledPath` gates the whole treatment: when the feature is off its readers never run, no
 * default is needed, and emitting messages about an unused setting would only add noise.
 *
 * Do not list `['array', 'null']` paths here: {@link normalizeNullableArrays} runs first and
 * turns their `null` into `[]`, so a default would never apply.
 */
const SCHEMA_DEFAULT_ENTRIES = [
    {
        path: 'Butler-SOS.influxdbConfig.maxBatchSize',
        enabledPath: 'Butler-SOS.influxdbConfig.enable',
    },
];

/**
 * Schema branch keywords followed when resolving the node for a config path.
 *
 * `if` is deliberately excluded, unlike in {@link SAME_VALUE_BRANCH_KEYWORDS}: an `if`
 * subschema describes a condition to test, not the value's shape, so a `default`, `minimum` or
 * `const` found inside one means something entirely different and must never be read as the
 * setting's declaration. `then`/`else` are the branches that carry real shape.
 */
const RESOLVE_BRANCH_KEYWORDS = ['allOf', 'anyOf', 'oneOf', 'then', 'else'];

/**
 * Resolves the schema node describing a dotted config path.
 *
 * Follows `then`/`else` branches, because the InfluxDB v1/v2/v3 shapes are expressed with
 * `if`/`then` and a field declared inside one would otherwise not be found.
 *
 * @param {object} node - Schema node to search from.
 * @param {string[]} segments - Remaining path segments.
 * @param {Set<object>} seen - Nodes already visited, guarding against a cyclic schema.
 * @returns {object|null} The schema node for the path, or null if the schema does not describe it.
 */
function resolveSchemaNode(node, segments, seen = new Set()) {
    if (!node || typeof node !== 'object') return null;
    // Base case before the cycle guard: a node that IS the target must resolve even if it was
    // already stepped through on the way here.
    if (segments.length === 0) return node;
    if (seen.has(node)) return null;
    seen.add(node);

    const [head, ...rest] = segments;

    if (node.properties && Object.hasOwn(node.properties, head)) {
        const found = resolveSchemaNode(node.properties[head], rest, new Set(seen));
        if (found) return found;
    }

    for (const keyword of RESOLVE_BRANCH_KEYWORDS) {
        const branch = node[keyword];
        const children = Array.isArray(branch) ? branch : branch ? [branch] : [];
        for (const child of children) {
            const found = resolveSchemaNode(child, segments, new Set(seen));
            if (found) return found;
        }
    }

    return null;
}

/**
 * Walks to the object owning the last segment of a dotted path.
 *
 * `Object.hasOwn` keeps a config key named `__proto__` from sending the walk onto
 * Object.prototype, and arrays are rejected outright: a section that YAML parsed as a list
 * where a map was expected is malformed, and writing a named key onto it would silently create
 * an expando property no reader would find.
 *
 * @param {object} config - Root object.
 * @param {string[]} segments - Full dotted path, split; the last segment is the leaf.
 * @returns {object|null} The owner of the leaf segment, or null if unreachable.
 */
function resolveOwner(config, segments) {
    let owner = config;
    for (const segment of segments.slice(0, -1)) {
        if (
            !owner ||
            typeof owner !== 'object' ||
            Array.isArray(owner) ||
            !Object.hasOwn(owner, segment)
        ) {
            return null;
        }
        owner = owner[segment];
    }
    if (!owner || typeof owner !== 'object' || Array.isArray(owner)) return null;
    return owner;
}

/**
 * Type checks this defaulting mechanism knows how to perform.
 *
 * The value check runs BEFORE the bounds checks, so bounds comparisons only ever see genuine
 * numbers — never the JS string/NaN coercion of `'abc' < 1`. Anything not in this map makes
 * {@link applySchemaDefaults} refuse the entry loudly rather than validate nothing: an earlier
 * version silently returned "valid" for every type it did not implement, which would have
 * recreated the exact silent-passthrough failure this mechanism exists to stop the day a
 * non-numeric entry was added.
 */
const IMPLEMENTED_TYPE_CHECKS = {
    /**
     * Tests for a genuine integer; rejects NaN, strings and booleans in one call.
     *
     * @param {*} value - Configured value.
     * @returns {boolean} True when the value is an integer.
     */
    integer: (value) => Number.isInteger(value),

    /**
     * Tests for a genuine finite-or-infinite number, rejecting NaN and non-numbers.
     *
     * @param {*} value - Configured value.
     * @returns {boolean} True when the value is a non-NaN number.
     */
    number: (value) => typeof value === 'number' && !Number.isNaN(value),
};

/**
 * Extracts the single non-null scalar type a schema node declares.
 *
 * Handles both spellings the schema uses: a plain string (`type: 'integer'`) and the
 * nullable-union array (`type: ['integer', 'null']`). A union of two real types returns
 * undefined — this mechanism has no way to validate against alternatives.
 *
 * @param {object} node - Schema node.
 * @returns {string|undefined} The scalar type, or undefined if none or ambiguous.
 */
function declaredScalarType(node) {
    const types = Array.isArray(node.type) ? node.type.filter((t) => t !== 'null') : [node.type];
    return types.length === 1 ? types[0] : undefined;
}

/**
 * Applies schema-declared defaults for {@link SCHEMA_DEFAULT_ENTRIES}, replacing missing or
 * invalid values with the schema's default.
 *
 * Every value used here — the default, the type, the bounds — is read from the schema node
 * itself. An earlier version hardcoded `1000`, `1` and `10000` in JavaScript alongside a schema
 * that already declared all three, which is the drift hazard `secret-patterns.js` exists to
 * prevent.
 *
 * Invalid values are **replaced, with a warning**, not passed through. A previous revision only
 * reported them, reasoning that the schema validator would have rejected them and overriding a
 * deliberately-set value under `--skip-config-verification` inverts that flag. Both halves of
 * that reasoning failed review: unvalidated values also arrive through node-config merge layers
 * and enable-flag-conditional sections with verification fully on, and passing them through is
 * not neutral — a NaN or string `maxBatchSize` empties the batch writers' retry ladder, so
 * every InfluxDB write silently discards its data while reporting success. A replaced value
 * plus a warning is recoverable; silently lost data is not.
 *
 * This runs at load time rather than in `verifyAppConfig` because applying a default means
 * writing to the config and node-config exposes no `set()` (calling it threw
 * `TypeError`, hidden for years by a test mock that supplied a `set` the real object lacks),
 * and because `verifyAppConfig` is itself skipped by `--skip-config-verification`.
 *
 * @param {object} config - The loaded node-config object, mutated in place.
 * @param {object} schema - The config file JSON schema.
 * @returns {Array<{level: 'info'|'warn', message: string}>} What was changed and why. `info`
 *   for a default filling an absent value, `warn` for an invalid value that was replaced.
 */
export function applySchemaDefaults(config, schema) {
    if (!config || typeof config !== 'object' || !schema) return [];

    const messages = [];

    for (const { path, enabledPath } of SCHEMA_DEFAULT_ENTRIES) {
        // Feature gate: when the owning feature is off, its readers never run and the setting
        // is irrelevant — apply nothing, report nothing.
        const enabledSegments = enabledPath.split('.');
        const enabledOwner = resolveOwner(config, enabledSegments);
        if (!enabledOwner || enabledOwner[enabledSegments.at(-1)] !== true) continue;

        const segments = path.split('.');
        const leaf = segments.at(-1);

        // The next three checks catch mistakes in SCHEMA_DEFAULT_ENTRIES itself — an entry
        // whose path no longer exists in the schema, whose node declares no default, or whose
        // type this mechanism cannot validate. Each is a developer error, and each fails LOUD:
        // an earlier version silently skipped these, so a schema rename or an unsupported type
        // would have quietly disabled the whole treatment with every test staying green.
        const schemaNode = resolveSchemaNode(schema, segments);
        if (!schemaNode) {
            messages.push({
                level: 'warn',
                message: `${path} is listed for schema defaulting but was not found in the config schema. The setting was NOT checked or defaulted.`,
            });
            continue;
        }

        if (schemaNode.default === undefined) {
            messages.push({
                level: 'warn',
                message: `${path} is listed for schema defaulting but its schema declares no default. The setting was NOT checked or defaulted.`,
            });
            continue;
        }

        const scalarType = declaredScalarType(schemaNode);
        const typeCheck = IMPLEMENTED_TYPE_CHECKS[scalarType];
        if (!typeCheck) {
            messages.push({
                level: 'warn',
                message: `${path} has schema type ${JSON.stringify(schemaNode.type)}, which schema defaulting does not support. The setting was NOT checked or defaulted.`,
            });
            continue;
        }

        const owner = resolveOwner(config, segments);
        if (!owner) continue;

        const current = Object.hasOwn(owner, leaf) ? owner[leaf] : undefined;

        if (current === undefined || current === null) {
            owner[leaf] = schemaNode.default;
            messages.push({
                level: 'info',
                message: `${path} not specified. Using default value ${schemaNode.default}.`,
            });
            continue;
        }

        const satisfiesSchema =
            typeCheck(current) &&
            (typeof schemaNode.minimum !== 'number' || current >= schemaNode.minimum) &&
            (typeof schemaNode.maximum !== 'number' || current <= schemaNode.maximum);

        if (!satisfiesSchema) {
            owner[leaf] = schemaNode.default;
            const typeWord = scalarType === 'integer' ? 'an integer' : `a ${scalarType}`;
            const bounds =
                typeof schemaNode.minimum === 'number' && typeof schemaNode.maximum === 'number'
                    ? ` between ${schemaNode.minimum} and ${schemaNode.maximum}`
                    : '';
            messages.push({
                level: 'warn',
                message: `${path}=${current} is invalid. Must be ${typeWord}${bounds}. Using default value ${schemaNode.default}.`,
            });
        }
    }

    return messages;
}

/**
 * Reads a config path that the schema declares as `['array', 'null']`, always returning an array.
 *
 * With {@link normalizeNullableArrays} running at load time, production code never sees `null`
 * here — this is a convenience accessor and a second line of defence, not the fix. It still
 * earns its place in two situations the normalisation does not cover: unit tests that build a
 * config object directly rather than going through the loader, and a config object that failed
 * to load at all (which SEA mode tolerates).
 *
 * Two node-config behaviours make the `has()` call mandatory rather than defensive, both
 * verified against the installed `config` package:
 * - For an explicitly-null value, `has()` returns **true** and `get()` returns `null`.
 * - For a path that is absent entirely, `has()` returns **false** and `get()` **throws**
 *   `Configuration property "x" is not defined`.
 *
 * So `get()` alone cannot distinguish "configured as null" from "not configured", and calling
 * it unguarded on an absent path swaps one crash for another.
 *
 * A null list means an *empty* list, never "feature disabled" — callers decide whether a
 * feature is on by reading its own `enable` flag.
 *
 * @param {object} cfg - node-config instance (or anything exposing `has`/`get`). Passed in
 *   rather than imported from `globals.js` because `config-file-verify.js`, one of the main
 *   callers, sits inside a real import cycle with it.
 * @param {string} path - Dotted config path, e.g. `Butler-SOS.logEvents.tags`.
 * @returns {Array<any>} The configured array, or `[]` when the value is null, absent, or not
 *   an array.
 */
export function getConfigArray(cfg, path) {
    if (!cfg || typeof cfg.has !== 'function' || typeof cfg.get !== 'function') return [];
    if (!cfg.has(path)) return [];

    const value = cfg.get(path);
    return Array.isArray(value) ? value : [];
}
