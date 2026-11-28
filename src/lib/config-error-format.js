/**
 * Turns config file problems into plain-language messages an administrator can act on.
 *
 * Every problem found in a config file - a schema violation reported by AJV, a YAML syntax error,
 * or a relationship between settings that `verifyAppConfig` rejects - ends up here as one
 * structured entry, `{ path, line, column, message }`, and is printed through
 * {@link renderConfigReport}. Nothing in this module does I/O or exits the process: the caller
 * decides what to do with the result.
 *
 * The wording is derived from the schema AJV reports against (run it with `verbose: true`), never
 * from a table of known settings, so settings added to the schema later - including settings a
 * build contributes through the extension seam - get the same messages without changes here.
 *
 * The report goes to the console and from there into service and container logs, so it never
 * shows the value of a setting that holds a credential, and never shows the values in an excerpt
 * of the file: see {@link holdsSecret} and {@link yamlSyntaxProblem}.
 */

import { parseDocument, LineCounter, isMap, isSeq, isAlias, isScalar } from 'yaml';

import { isSecretConfigPath } from './secret-patterns.js';

/**
 * One problem in a config file.
 *
 * @typedef {object} ConfigProblem
 * @property {string|null} path - The setting, as a dotted path in the YAML's own terms
 *     (`Butler-SOS.influxdbConfig.port`, `Butler-SOS.serversToMonitor.servers[0].host`), or `null`
 *     when the problem is with the file as a whole.
 * @property {number|null} line - 1-based line in the config file, or `null` when not known.
 * @property {number|null} column - 1-based column in the config file, or `null` when not known.
 * @property {string} message - What is wrong and what is allowed, as one or more sentences.
 * @property {string} [snippet] - Optional excerpt of the file around the problem, for YAML
 *     syntax errors. Values are left out of it.
 */

/**
 * Finds where a setting is in the config file.
 *
 * @callback Locator
 * @param {Array<string|number>} segments - The setting's segments; numbers are list indexes.
 * @returns {{line: number, column: number}|null} The 1-based line and column, or `null` when the
 *     setting is not in the file.
 */

/** What is shown in place of a value that must not be printed. */
const HIDDEN_VALUE = 'a secret value (not shown)';

/** What is shown in place of each value in an excerpt of the file. */
const EXCERPT_VALUE = '...';

/**
 * Finds the line and column of settings in a YAML text.
 *
 * Parsing for positions is separate from loading the config: the values Butler SOS checks and runs
 * on come from the same parser node-config uses, and this parse only answers "where in the file is
 * this setting". It never throws; where the text cannot be parsed, or the setting is not in it, the
 * position is `null`.
 *
 * @param {string} [text] - The config file's contents.
 * @returns {Locator} Gives the position of the setting at `segments`: the position of its key
 *     for a mapping entry, or of the item for a list entry. An empty `segments` (the whole file)
 *     has no position.
 */
export function createPositionLocator(text) {
    if (typeof text !== 'string') {
        return () => null;
    }

    let doc;
    const lineCounter = new LineCounter();
    try {
        doc = parseDocument(text, { lineCounter, merge: true, uniqueKeys: false });
    } catch {
        return () => null;
    }

    /**
     * Turns an offset into the text into a line and column.
     *
     * @param {number|undefined} offset - Character offset.
     * @returns {{line: number, column: number}|null} The 1-based position.
     */
    const toPosition = (offset) => {
        if (typeof offset !== 'number') return null;
        const { line, col } = lineCounter.linePos(offset);
        return { line, column: col };
    };

    return (segments) => {
        if (!segments || segments.length === 0) return null;

        let node = doc.contents;
        let offset = null;

        for (const segment of segments) {
            if (isAlias(node)) node = node.resolve(doc);

            if (isMap(node)) {
                const pair = node.items.find(
                    (item) => isScalar(item.key) && item.key.toString() === String(segment)
                );
                if (!pair) return null;
                offset = pair.key.range?.[0];
                node = pair.value;
            } else if (isSeq(node)) {
                const item = node.items[Number(segment)];
                if (item === undefined || item === null) return null;
                offset = item.range?.[0];
                node = item;
            } else {
                return null;
            }
        }

        return toPosition(offset);
    };
}

/**
 * Splits an AJV `instancePath` (a JSON Pointer) into its segments, decoding `~1` and `~0`.
 *
 * @param {string} instancePath - For example `/Butler-SOS/influxdbConfig/port`.
 * @returns {string[]} For example `['Butler-SOS', 'influxdbConfig', 'port']`.
 */
export function pointerToSegments(instancePath) {
    if (!instancePath) return [];
    return instancePath
        .split('/')
        .slice(1)
        .map((segment) => segment.replaceAll('~1', '/').replaceAll('~0', '~'));
}

/**
 * Writes setting segments as the dotted path an administrator sees in the YAML.
 *
 * A segment is written as a list index (`[0]`) when it is a number, or when the parsed config shows
 * that the value it indexes into is a list.
 *
 * @param {Array<string|number>} segments - The setting's segments.
 * @param {unknown} [data] - The parsed config, used to tell list indexes from mapping keys.
 * @returns {string|null} For example `Butler-SOS.serversToMonitor.servers[0].host`, or `null` for
 *     the whole file.
 */
export function toDottedPath(segments, data) {
    if (!segments || segments.length === 0) return null;

    let path = '';
    let current = data;

    for (const segment of segments) {
        const isIndex = typeof segment === 'number' || Array.isArray(current);
        if (isIndex) {
            path += `[${segment}]`;
        } else {
            path += path === '' ? String(segment) : `.${segment}`;
        }
        current = current !== null && typeof current === 'object' ? current[segment] : undefined;
    }

    return path;
}

/**
 * Tells whether a setting's value must be left out of the report.
 *
 * The report reaches the console and the service or container log, so a credential with a typo in
 * it must not be printed there. A setting is treated as one when its name, or the name of a section
 * it is in, looks like a credential, or its path is one the config visualisation page masks
 * ({@link isSecretConfigPath}), or when its schema says so with `format: 'password'` or
 * `writeOnly: true`. The last two let a setting contributed through the extension seam be hidden
 * whatever it is called.
 *
 * @param {string|null} path - The setting's dotted path.
 * @param {object} [schema] - The setting's schema.
 * @returns {boolean} True when the value must not be shown.
 */
function holdsSecret(path, schema) {
    return schema?.format === 'password' || schema?.writeOnly === true || isSecretConfigPath(path);
}

/**
 * Describes a value as found in the config file.
 *
 * @param {unknown} value - The value.
 * @param {boolean} [secret] - Whether the value must not be shown.
 * @returns {string} The value in words: strings quoted, numbers and booleans as written.
 */
function describeValue(value, secret = false) {
    if (value === undefined) return 'missing';
    if (value === null) return 'empty';
    if (Array.isArray(value)) return 'a list';
    if (typeof value === 'object') return 'a section of settings';
    if (secret) return HIDDEN_VALUE;
    if (typeof value === 'string') return JSON.stringify(value);
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
        return String(value);
    }
    return typeof value;
}

/**
 * Writes an allowed value the way it would be typed in the YAML file.
 *
 * @param {unknown} value - The value.
 * @returns {string} The value, strings quoted.
 */
function showValue(value) {
    if (value === null) return 'null (empty)';
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
        return String(value);
    }
    return JSON.stringify(value) ?? typeof value;
}

const TYPE_WORDS = {
    integer: 'a whole number',
    number: 'a number',
    string: 'text',
    boolean: 'true or false',
    object: 'a section of settings',
    array: 'a list',
    null: 'empty',
};

// Each format in words, and an example. The example is left out where several alternatives are
// listed in one sentence. The example addresses are from the ranges reserved for documentation
// (RFC 5737 and RFC 3849), so they can never be a real host.
const FORMAT_WORDS = {
    hostname: ['a host name', 'qlik.example.com'],
    ipv4: ['an IPv4 address', '192.0.2.10'],
    ipv6: ['an IPv6 address', '2001:db8::10'],
    uri: ['a full URL', 'https://example.com/path'],
    'uri-reference': ['a URL or a path', null],
    email: ['an email address', null],
    'date-time': ['a date and time', '2026-01-31T12:00:00Z'],
    date: ['a date', '2026-01-31'],
    time: ['a time', '12:00:00Z'],
};

/**
 * Says in words what a format expects.
 *
 * @param {string} format - The format's name.
 * @param {boolean} withExample - Whether to add an example.
 * @returns {string} For example "an IPv4 address, for example 192.0.2.10".
 */
function formatWords(format, withExample) {
    const known = FORMAT_WORDS[format];
    if (!known) return `in the "${format}" format`;
    const [words, example] = known;
    return withExample && example ? `${words}, for example ${example}` : words;
}

/**
 * Says in words what a pattern expects.
 *
 * A regular expression means little to most readers. Where a pattern is one of the alternatives
 * of an `anyOf` or `oneOf`, the alternative can say what it means with a `description`, for
 * example `anyOf: [{ format: 'ipv4' }, { pattern: '...', description: 'a host name' }]`. Only
 * an alternative's own description is used: on a setting, `description` describes the setting,
 * not its pattern. Without one, a short pattern is shown as it is and a long one is not shown.
 *
 * @param {object} error - The AJV `pattern` error, from a validator compiled with `verbose: true`.
 * @param {boolean} [isAlternative] - Whether the pattern is directly one alternative of an
 *     `anyOf` or `oneOf`.
 * @returns {string} For example "a host name".
 */
function patternWords(error, isAlternative = false) {
    const description = isAlternative ? error.parentSchema?.description : undefined;
    if (typeof description === 'string' && description.trim() !== '') return description.trim();
    const { pattern } = error.params;
    return pattern.length <= 40 ? `text of the form ${pattern}` : 'text in the expected form';
}

/**
 * Joins alternatives as "a, b or c".
 *
 * @param {string[]} items - The alternatives.
 * @param {string} [word] - The joining word.
 * @returns {string} The joined text.
 */
function joinAlternatives(items, word = 'or') {
    if (items.length <= 1) return items.join('');
    return `${items.slice(0, -1).join(', ')} ${word} ${items.at(-1)}`;
}

/**
 * Reads the types a `type` error expects, and says them in words.
 *
 * @param {object} params - The error's `params`.
 * @returns {{types: string[], words: string}} The types, and for example "a list or empty".
 */
function typeWords(params) {
    const types = Array.isArray(params.type) ? params.type : String(params.type).split(',');
    return { types, words: joinAlternatives(types.map((t) => TYPE_WORDS[t] ?? t)) };
}

/**
 * Says in words what one keyword expects, for use where several alternatives are listed.
 *
 * @param {object} error - An AJV error object.
 * @param {boolean} isAlternative - Whether the error comes directly from one alternative.
 * @returns {string|null} For example "an IPv4 address", or `null` when it cannot be put in words.
 */
function expectation(error, isAlternative) {
    const { keyword, params } = error;
    switch (keyword) {
        case 'type':
            return typeWords(params).words;
        case 'format':
            return formatWords(params.format, false);
        case 'pattern':
            return patternWords(error, isAlternative);
        case 'enum':
            return `one of ${params.allowedValues.map(showValue).join(', ')}`;
        case 'const':
            return showValue(params.allowedValue);
        case 'minimum':
        case 'maximum':
        case 'exclusiveMinimum':
        case 'exclusiveMaximum':
            return `${comparisonWords(params.comparison)} ${params.limit}`;
        default:
            return null;
    }
}

/**
 * Puts an AJV comparison operator into words.
 *
 * @param {string} comparison - One of `>=`, `>`, `<=`, `<`.
 * @returns {string} The comparison in words.
 */
function comparisonWords(comparison) {
    return (
        {
            '>=': 'at least',
            '>': 'greater than',
            '<=': 'at most',
            '<': 'less than',
        }[comparison] ?? comparison
    );
}

/**
 * Levenshtein distance between two strings.
 *
 * @param {string} a - First string.
 * @param {string} b - Second string.
 * @returns {number} The number of single-character edits that turn `a` into `b`.
 */
function editDistance(a, b) {
    let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        const current = [i];
        for (let j = 1; j <= b.length; j++) {
            current[j] = Math.min(
                previous[j] + 1,
                current[j - 1] + 1,
                previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
            );
        }
        previous = current;
    }
    return previous[b.length];
}

/**
 * Finds the known setting closest to a misspelt one.
 *
 * Up to one edit in three counts as a misspelling, with at least one allowed. So `remoteUrll` is
 * taken for `remoteURL` and `enabel` for `enable`, but `host` is not taken for `port`.
 *
 * @param {string} name - The setting found in the file.
 * @param {string[]} candidates - The settings allowed at that place.
 * @returns {string|null} The closest candidate, or `null` when none is close enough to be a
 *     plausible misspelling.
 */
export function closestSetting(name, candidates) {
    const lowerName = name.toLowerCase();
    let best = null;
    let bestDistance = Infinity;

    for (const candidate of candidates) {
        const distance = editDistance(lowerName, candidate.toLowerCase());
        if (distance < bestDistance) {
            best = candidate;
            bestDistance = distance;
        }
    }

    if (best === null) return null;
    const threshold = Math.max(1, Math.floor(Math.max(name.length, best.length) / 3));
    return bestDistance <= threshold ? best : null;
}

/**
 * Says what is wrong with a value of the wrong type.
 *
 * @param {object} error - The AJV `type` error.
 * @param {string} found - The value found, in words.
 * @param {boolean} secret - Whether the value must not be shown.
 * @returns {string} For example `is "8086", but must be a number. Remove the quotes around it.`
 */
function typeMessage(error, found, secret) {
    const { params, data, parentSchema } = error;
    const { types, words } = typeWords(params);

    const example = secret ? undefined : parentSchema?.default;
    const hasExample = example !== undefined && (example === null || typeof example !== 'object');
    const exampleText = hasExample ? `, for example ${showValue(example)}` : '';

    return `is ${found}, but must be ${words}${exampleText}.${quotedValueHint(data, types)}`;
}

/**
 * Points out a number or a true/false value that was written in quotes, which YAML reads as text.
 *
 * @param {unknown} data - The value found.
 * @param {string[]} types - The types expected.
 * @returns {string} The hint, with a leading space, or an empty string.
 */
function quotedValueHint(data, types) {
    if (typeof data !== 'string') return '';
    const numeric =
        (types.includes('number') || types.includes('integer')) &&
        data.trim() !== '' &&
        Number.isFinite(Number(data));
    const boolean = types.includes('boolean') && (data === 'true' || data === 'false');
    return numeric || boolean ? ' Remove the quotes around it.' : '';
}

/**
 * Counts entries in words.
 *
 * @param {number} n - The count.
 * @returns {string} For example "1 entry" or "3 entries".
 */
function entriesWords(n) {
    return `${n} ${n === 1 ? 'entry' : 'entries'}`;
}

/**
 * Says what failed when a keyword has no message of its own.
 *
 * @param {string} keyword - The keyword that failed.
 * @returns {string} For example `does not pass the "myKeyword" check`.
 */
function fallbackMessage(keyword) {
    return `does not pass the "${keyword}" check`;
}

/**
 * Says in words what an AJV error means for the setting it is about.
 *
 * @param {object} error - An AJV error object, from a validator compiled with `verbose: true`.
 * @param {string} found - The value found, in words.
 * @param {boolean} secret - Whether the value must not be shown.
 * @returns {string} The message, without the setting's path.
 */
function describeError(error, found, secret) {
    const { keyword, params, data } = error;

    switch (keyword) {
        case 'type':
            return typeMessage(error, found, secret);

        case 'enum':
            return `is ${found}, but must be one of: ${params.allowedValues.map(showValue).join(', ')}.`;

        case 'const':
            return `is ${found}, but must be ${showValue(params.allowedValue)}.`;

        case 'minimum':
        case 'maximum':
        case 'exclusiveMinimum':
        case 'exclusiveMaximum':
            return `is ${found}, but must be ${comparisonWords(params.comparison)} ${params.limit}.`;

        case 'minLength':
            return params.limit === 1
                ? 'is empty, but must have a value.'
                : `is ${found}, but must be at least ${params.limit} characters long.`;

        case 'maxLength':
            return `is ${found}, but must be at most ${params.limit} characters long.`;

        case 'minItems':
        case 'maxItems': {
            const count = Array.isArray(data) ? data.length : 0;
            const limitWord = keyword === 'minItems' ? 'at least' : 'at most';
            return `has ${entriesWords(count)}, but must have ${limitWord} ${entriesWords(params.limit)}.`;
        }

        case 'format':
            return `is ${found}, but must be ${formatWords(params.format, true)}.`;

        case 'pattern':
            return `is ${found}, but must be ${patternWords(error)}.`;

        default:
            // Keywords without wording of their own, including any a build adds to the schema,
            // keep AJV's message. They still get the setting's path, line and column.
            return `${error.message ?? fallbackMessage(keyword)}.`;
    }
}

/**
 * Folds the errors of each `anyOf` or `oneOf` branch into the `anyOf` or `oneOf` error itself.
 *
 * @param {object[]} errors - AJV errors.
 * @returns {{remaining: object[], branchErrors: Map<object, object[]>}} The errors left, and the
 *     branch errors of each `anyOf`/`oneOf` error.
 */
function foldBranches(errors) {
    const branchErrors = new Map();
    for (const group of errors) {
        if (group.keyword !== 'anyOf' && group.keyword !== 'oneOf') continue;
        const prefix = `${group.schemaPath}/`;
        branchErrors.set(
            group,
            errors.filter((error) => error.schemaPath.startsWith(prefix))
        );
    }

    const folded = new Set([...branchErrors.values()].flat());
    return { remaining: errors.filter((error) => !folded.has(error)), branchErrors };
}

/**
 * Drops exact duplicates: the same keyword, with the same parameters, at the same place.
 *
 * @param {object[]} errors - AJV errors.
 * @returns {object[]} The errors, each once.
 */
function withoutDuplicates(errors) {
    const seen = new Set();
    return errors.filter((error) => {
        const key = `${error.instancePath}\u0000${error.keyword}\u0000${JSON.stringify(error.params)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

/**
 * Finds the closest allowed setting for each setting that is not allowed.
 *
 * This is worked out before any message is written, so that a missing required setting a
 * misspelling accounts for is left out wherever it comes in the list.
 *
 * @param {object[]} errors - AJV errors.
 * @returns {{suggestions: Map<object, {suggestion: string|null, required: boolean}>, merged:
 *     Set<object>}} The suggestion for each `additionalProperties` error, and the `required`
 *     errors folded into one.
 */
function findMisspellings(errors) {
    const missingBySection = new Map();
    for (const error of errors) {
        if (error.keyword !== 'required') continue;
        const missing = missingBySection.get(error.instancePath) ?? new Map();
        missing.set(error.params.missingProperty, error);
        missingBySection.set(error.instancePath, missing);
    }

    const suggestions = new Map();
    const merged = new Set();
    for (const error of errors) {
        if (error.keyword !== 'additionalProperties') continue;
        const present = error.data && typeof error.data === 'object' ? error.data : {};
        const candidates = Object.keys(error.parentSchema?.properties ?? {}).filter(
            (candidate) => !Object.hasOwn(present, candidate)
        );
        const suggestion = closestSetting(error.params.additionalProperty, candidates);
        const missing = suggestion && missingBySection.get(error.instancePath)?.get(suggestion);
        const required = Boolean(missing) && !merged.has(missing);
        if (required) merged.add(missing);
        suggestions.set(error, { suggestion, required });
    }

    return { suggestions, merged };
}

/**
 * Says what is wrong with a setting that is not allowed.
 *
 * @param {{suggestion: string|null, required: boolean}} misspelling - The closest allowed setting.
 * @returns {string} The message.
 */
function unknownSettingMessage({ suggestion, required }) {
    if (!suggestion) return 'is not a known setting. Check the spelling, or remove it.';
    const requiredText = required ? ` "${suggestion}" is required.` : '';
    return `is not a known setting. Did you mean "${suggestion}"?${requiredText}`;
}

/**
 * Says what is wrong with a value that matches none, or more than one, of an `anyOf`/`oneOf`'s
 * alternatives.
 *
 * @param {object} error - The AJV `anyOf` or `oneOf` error.
 * @param {string} found - The value found, in words.
 * @param {object[]} branches - The errors of its alternatives.
 * @returns {string} The message.
 */
function alternativesMessage(error, found, branches) {
    if (error.keyword === 'oneOf' && Array.isArray(error.params?.passingSchemas)) {
        return `is ${found}, which matches more than one of the allowed forms. It must match exactly one.`;
    }

    const prefix = `${error.schemaPath}/`;
    const alternatives = [
        ...new Set(
            branches
                .filter((branch) => branch.instancePath === error.instancePath)
                .map((branch) =>
                    expectation(branch, /^\d+\/[^/]+$/.test(branch.schemaPath.slice(prefix.length)))
                )
                .filter(Boolean)
        ),
    ];

    return alternatives.length > 0
        ? `is ${found}, but must be ${joinAlternatives(alternatives)}.`
        : `is ${found}, which matches none of the allowed forms.`;
}

/**
 * Writes the message for one AJV error.
 *
 * @param {object} error - An AJV error object.
 * @param {object} context - What the message is written from.
 * @param {unknown} context.data - The parsed config.
 * @param {Map<object, object[]>} context.branchErrors - From {@link foldBranches}.
 * @param {Map<object, object>} context.suggestions - From {@link findMisspellings}.
 * @returns {{segments: string[], path: string|null, message: string, found: string|null}} The
 *     setting the message is about, the message, and the value found in words, if it was used.
 */
function messageFor(error, { data, branchErrors, suggestions }) {
    const section = pointerToSegments(error.instancePath);

    if (error.keyword === 'additionalProperties') {
        const segments = [...section, error.params.additionalProperty];
        const message = unknownSettingMessage(suggestions.get(error));
        return { segments, path: toDottedPath(segments, data), message, found: null };
    }

    if (error.keyword === 'required') {
        const segments = [...section, error.params.missingProperty];
        const sectionPath = toDottedPath(section, data);
        const message = sectionPath
            ? `is missing. Add it under ${sectionPath}.`
            : 'is missing. Add it at the top level of the file.';
        return { segments, path: toDottedPath(segments, data), message, found: null };
    }

    const path = toDottedPath(section, data);
    const secret = holdsSecret(path, error.parentSchema);
    const found = describeValue(error.data, secret);
    const message =
        error.keyword === 'anyOf' || error.keyword === 'oneOf'
            ? alternativesMessage(error, found, branchErrors.get(error))
            : describeError(error, found, secret);
    return { segments: section, path, message, found };
}

/**
 * Turns AJV's errors into one plain-language problem per setting.
 *
 * - `if` errors are dropped: each comes with the errors of the `then` schema that failed, which say
 *   what is actually wrong.
 * - The errors of an `anyOf` or `oneOf` branch are folded into a single message for the setting,
 *   listing what each branch accepts.
 * - Exact duplicates are dropped.
 * - A setting that is not allowed (`additionalProperties`) is named, with the closest allowed one
 *   suggested; if that one is also reported missing, the two become one message.
 * - Messages about the same setting are joined.
 * - The value of a setting that holds a credential is not shown.
 *
 * @param {object[]} errors - AJV's `validate.errors`, from a validator compiled with `verbose: true`.
 * @param {object} [options] - Options.
 * @param {unknown} [options.data] - The parsed config that was validated.
 * @param {Locator} [options.locate] - Position lookup, from {@link createPositionLocator}.
 * @returns {ConfigProblem[]} The problems, sorted by line.
 */
export function formatAjvErrors(errors, { data, locate = () => null } = {}) {
    const { remaining, branchErrors } = foldBranches(
        (errors ?? []).filter((error) => error.keyword !== 'if')
    );
    const distinct = withoutDuplicates(remaining);
    const { suggestions, merged } = findMisspellings(distinct);

    const entries = distinct
        .filter((error) => !merged.has(error))
        .map((error) => messageFor(error, { data, branchErrors, suggestions }));

    return groupBySetting(entries, locate);
}

/**
 * Joins several messages about one setting into one.
 *
 * Messages that start the same way, `is <value>, but ...`, share that start:
 * `is "A", but must be at least 3 characters long, and must be text of the form ^[a-z]+$.`
 *
 * @param {string[]} messages - The messages, at least one.
 * @param {string|null} found - The value found, in words, as the messages give it.
 * @returns {string} One message.
 */
function joinMessages(messages, found) {
    const prefix = found === null ? null : `is ${found}, but `;

    let text = messages[0] ?? '';
    for (const next of messages.slice(1)) {
        const shareStart = prefix !== null && text.startsWith(prefix) && next.startsWith(prefix);
        // Only a single sentence can take ", and ...": a hint after it would end up in between.
        if (shareStart && !text.slice(prefix.length).includes('. ')) {
            text = `${text.slice(0, -1)}, and ${next.slice(prefix.length)}`;
        } else {
            text = `${text} Also, it ${next}`;
        }
    }
    return text;
}

/**
 * Joins messages about the same setting into one problem, adds positions and sorts by line.
 *
 * @param {Array<{segments: string[], path: string|null, message: string, found: string|null}>}
 *     entries - Messages with the setting each is about.
 * @param {Locator} locate - Position lookup.
 * @returns {ConfigProblem[]} The problems.
 */
function groupBySetting(entries, locate) {
    const bySetting = new Map();

    for (const { segments, path, message, found } of entries) {
        const key = path ?? '';
        const existing = bySetting.get(key);
        if (!existing) {
            bySetting.set(key, { path, segments, found, messages: [message] });
        } else if (!existing.messages.includes(message)) {
            existing.messages.push(message);
            existing.found ??= found;
        }
    }

    const problems = [...bySetting.values()].map(({ path, segments, found, messages }) => {
        const position = locate(segments) ?? locate(segments.slice(0, -1));
        const message = joinMessages(messages, found);
        return {
            path,
            line: position?.line ?? null,
            column: position?.column ?? null,
            message: path === null ? `The top level of the file ${message}` : message,
        };
    });

    return sortConfigProblems(problems);
}

/**
 * Sorts problems by line, then by setting. Problems with no line, which are about the file as a
 * whole or a whole section, come first.
 *
 * @param {ConfigProblem[]} problems - The problems.
 * @returns {ConfigProblem[]} The same problems, sorted.
 */
export function sortConfigProblems(problems) {
    return [...problems].sort((a, b) => {
        const lineA = a.line ?? 0;
        const lineB = b.line ?? 0;
        if (lineA !== lineB) return lineA - lineB;
        return (a.path ?? '').localeCompare(b.path ?? '');
    });
}

/**
 * Builds a problem about one setting, for checks made outside the schema.
 *
 * @param {Array<string|number>} segments - The setting's segments; numbers are list indexes.
 * @param {string} message - What is wrong and what to do, without the setting's path.
 * @param {Locator} [locate] - Position lookup, from {@link createPositionLocator}.
 * @returns {ConfigProblem} The problem.
 */
export function settingProblem(segments, message, locate = () => null) {
    const position = locate(segments) ?? locate(segments.slice(0, -1));
    return {
        path: toDottedPath(segments),
        line: position?.line ?? null,
        column: position?.column ?? null,
        message,
    };
}

/**
 * Writes one line of the file for an excerpt, with its value left out.
 *
 * Keys, list dashes and indentation stay, because they are what a YAML syntax error is usually
 * about. Values go, because the file may hold passwords and the excerpt goes to the log.
 *
 * @param {string} line - A line of the file.
 * @returns {string} The line without its value.
 */
function withoutValue(line) {
    // Plain string scanning rather than one regular expression, which would have to backtrack
    // over the whole line to find where a key ends.
    let rest = line.trimStart();
    let prefix = line.slice(0, line.length - rest.length);

    if (rest.startsWith('#')) return `${prefix}# ${EXCERPT_VALUE}`;

    if (rest === '-' || rest.startsWith('- ')) {
        const afterDash = rest.slice(1).trimStart();
        prefix += rest.slice(0, rest.length - afterDash.length);
        rest = afterDash;
    }
    if (rest.trim() === '') return line.trimEnd();

    const colon = keySeparator(rest);
    if (colon > 0 && !rest.slice(0, colon).includes('#')) {
        const value = rest.slice(colon + 1).trim();
        return value === '' ? line.trimEnd() : `${prefix}${rest.slice(0, colon)}: ${EXCERPT_VALUE}`;
    }
    return `${prefix}${EXCERPT_VALUE}`;
}

/**
 * Finds the colon that ends a mapping key: the first one followed by a space, a tab or the end of
 * the line. A colon inside a value such as `http://host` is followed by neither.
 *
 * @param {string} text - A line's content, after its indentation and any list dash.
 * @returns {number} The colon's index, or -1 when the text has no key.
 */
function keySeparator(text) {
    let index = text.indexOf(':');
    while (index !== -1) {
        const after = text[index + 1];
        if (after === undefined || after === ' ' || after === '\t') return index;
        index = text.indexOf(':', index + 1);
    }
    return -1;
}

/**
 * Builds an excerpt of the file around a position, with the values left out.
 *
 * @param {string} text - The file's contents.
 * @param {number} line - 1-based line of the problem.
 * @param {number|null} column - 1-based column of the problem.
 * @returns {string} Two lines before the problem, its line with a marker under the column, and one
 *     line after, then a note that values are left out.
 */
function excerpt(text, line, column) {
    const lines = text.split(/\r?\n/);
    // A file that ends with a newline has no empty last line to show.
    if (lines.at(-1) === '') lines.pop();
    const first = Math.max(1, line - 2);
    const last = Math.min(lines.length, line + 1);
    const width = String(last).length;

    const out = [];
    for (let n = first; n <= last; n++) {
        out.push(`${String(n).padStart(width)} | ${withoutValue(lines[n - 1])}`);
        if (n === line && column) out.push(`${' '.repeat(width)} | ${' '.repeat(column - 1)}^`);
    }
    out.push('(Values are left out, because the file may hold passwords.)');
    return out.join('\n');
}

/**
 * Turns a YAML parse error into one problem with its line and column.
 *
 * The problem carries an excerpt of the file around the position, built from the file itself
 * rather than taken from the parser, so that every value can be left out of it.
 *
 * @param {Error & {reason?: string, mark?: {line: number, column: number}}} err - The error
 *     js-yaml threw.
 * @param {string} [text] - The file's contents, for the excerpt.
 * @returns {ConfigProblem} The problem.
 */
export function yamlSyntaxProblem(err, text) {
    const mark = err?.mark;
    const reason = err?.reason ?? err?.message ?? String(err);
    const line = typeof mark?.line === 'number' ? mark.line + 1 : null;
    const column = typeof mark?.column === 'number' ? mark.column + 1 : null;

    const problem = { path: null, line, column, message: `The file is not valid YAML: ${reason}.` };
    if (line !== null && typeof text === 'string') problem.snippet = excerpt(text, line, column);
    return problem;
}

/**
 * Writes the problems as the text printed at startup.
 *
 * ```
 * Config file /opt/butler-sos/config/production.yaml has 2 problems:
 *
 *   line 17, col 9   Butler-SOS.heartbeat.remoteUrll
 *                    is not a known setting. Did you mean "remoteURL"?
 *
 * Fix these and start Butler SOS again. Run with --help for the command-line options.
 * ```
 *
 * @param {string|null} configFile - Path of the config file, or `null` when not known.
 * @param {ConfigProblem[]} problems - The problems; at least one.
 * @returns {string} The report, as lines joined with newlines.
 */
export function renderConfigReport(configFile, problems) {
    const count = problems.length;
    const noun = count === 1 ? 'problem' : 'problems';
    const subject = configFile ? `Config file ${configFile}` : 'The config';
    const lines = [`${subject} has ${count} ${noun}:`, ''];

    const labels = problems.map((p) => {
        if (p.line === null || p.line === undefined) return '';
        return p.column ? `line ${p.line}, col ${p.column}` : `line ${p.line}`;
    });
    const width = Math.max(0, ...labels.map((label) => label.length));
    const indent = ' '.repeat(2 + width + (width > 0 ? 2 : 0));

    problems.forEach((problem, i) => {
        const label = width > 0 ? `${labels[i].padEnd(width)}  ` : '';
        if (problem.path) {
            lines.push(`  ${label}${problem.path}`, `${indent}${problem.message}`);
        } else {
            lines.push(`  ${label}${problem.message}`);
        }
        const snippetLines = (problem.snippet ?? '').split('\n').filter((l) => l.trim() !== '');
        lines.push(...snippetLines.map((snippetLine) => `${indent}${snippetLine}`), '');
    });

    lines.push(
        `Fix ${count === 1 ? 'this' : 'these'} and start Butler SOS again. Run with --help for the command-line options.`
    );
    return lines.join('\n');
}
