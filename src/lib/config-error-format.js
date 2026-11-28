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
 */

import { parseDocument, LineCounter, isMap, isSeq, isAlias, isScalar } from 'yaml';

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
 *     syntax errors.
 */

/**
 * Finds where a setting is in the config file.
 *
 * @callback Locator
 * @param {Array<string|number>} segments - The setting's segments; numbers are list indexes.
 * @returns {{line: number, column: number}|null} The 1-based line and column, or `null` when the
 *     setting is not in the file.
 */

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
                    (item) => isScalar(item.key) && String(item.key.value) === String(segment)
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
        .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'));
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
 * Describes a value as found in the config file.
 *
 * @param {unknown} value - The value.
 * @returns {string} The value in words: strings quoted, numbers and booleans as written.
 */
function describeValue(value) {
    if (value === undefined) return 'missing';
    if (value === null) return 'empty';
    if (Array.isArray(value)) return 'a list';
    if (typeof value === 'object') return 'a section of settings';
    if (typeof value === 'string') return JSON.stringify(value);
    return String(value);
}

/**
 * Writes an allowed value the way it would be typed in the YAML file.
 *
 * @param {unknown} value - The value.
 * @returns {string} The value, strings quoted.
 */
function showValue(value) {
    if (value === null) return 'null (empty)';
    if (typeof value === 'string') return JSON.stringify(value);
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
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
 * A regular expression means little to most readers, so a schema can say what its pattern means
 * with a `description` next to it, for example `{ pattern: '...', description: 'a host name' }`.
 * Without one, a short pattern is shown as it is and a long one is not shown at all.
 *
 * @param {object} error - The AJV `pattern` error, from a validator compiled with `verbose: true`.
 * @returns {string} For example "a host name".
 */
function patternWords(error) {
    const description = error.parentSchema?.description;
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
    return `${items.slice(0, -1).join(', ')} ${word} ${items[items.length - 1]}`;
}

/**
 * Says in words what one keyword expects, for use where several alternatives are listed.
 *
 * @param {object} error - An AJV error object.
 * @returns {string|null} For example "an IPv4 address", or `null` when it cannot be put in words.
 */
function expectation(error) {
    const { keyword, params } = error;
    switch (keyword) {
        case 'type': {
            const types = Array.isArray(params.type) ? params.type : String(params.type).split(',');
            return joinAlternatives(types.map((t) => TYPE_WORDS[t] ?? t));
        }
        case 'format':
            return formatWords(params.format, false);
        case 'pattern':
            return patternWords(error);
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
    const threshold = Math.max(2, Math.floor(Math.max(name.length, best.length) / 3));
    return bestDistance <= threshold ? best : null;
}

/**
 * Says in words what an AJV error means for the setting it is about.
 *
 * @param {object} error - An AJV error object, from a validator compiled with `verbose: true`.
 * @returns {string} The message, without the setting's path.
 */
function describeError(error) {
    const { keyword, params, data, parentSchema } = error;
    const found = describeValue(data);

    switch (keyword) {
        case 'type': {
            const types = Array.isArray(params.type) ? params.type : String(params.type).split(',');
            let message = `is ${found}, but must be ${joinAlternatives(types.map((t) => TYPE_WORDS[t] ?? t))}`;

            const example = parentSchema?.default;
            if (example !== undefined && (example === null || typeof example !== 'object')) {
                message += `, for example ${showValue(example)}`;
            }
            message += '.';

            if (typeof data === 'string') {
                const numeric = types.includes('number') || types.includes('integer');
                if (
                    (numeric && data.trim() !== '' && Number.isFinite(Number(data))) ||
                    (types.includes('boolean') && (data === 'true' || data === 'false'))
                ) {
                    message += ' Remove the quotes around it.';
                }
            }
            return message;
        }

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
            /**
             * Counts entries in words.
             *
             * @param {number} n - The count.
             * @returns {string} For example "1 entry" or "3 entries".
             */
            const entries = (n) => `${n} ${n === 1 ? 'entry' : 'entries'}`;
            return `has ${entries(count)}, but must have ${limitWord} ${entries(params.limit)}.`;
        }

        case 'format':
            return `is ${found}, but must be ${formatWords(params.format, true)}.`;

        case 'pattern':
            return `is ${found}, but must be ${patternWords(error)}.`;

        default:
            // Keywords without wording of their own, including any a build adds to the schema,
            // keep AJV's message. They still get the setting's path, line and column.
            return `${error.message}.`;
    }
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
 *
 * @param {object[]} errors - AJV's `validate.errors`, from a validator compiled with `verbose: true`.
 * @param {object} [options] - Options.
 * @param {unknown} [options.data] - The parsed config that was validated.
 * @param {Locator} [options.locate] - Position lookup, from {@link createPositionLocator}.
 * @returns {ConfigProblem[]} The problems, sorted by line.
 */
export function formatAjvErrors(errors, { data, locate = () => null } = {}) {
    let remaining = (errors ?? []).filter((error) => error.keyword !== 'if');

    // Fold the branches of each anyOf/oneOf into the anyOf/oneOf error itself.
    const branchGroups = remaining.filter((e) => e.keyword === 'anyOf' || e.keyword === 'oneOf');
    const branchErrors = new Map();
    for (const group of branchGroups) {
        const prefix = `${group.schemaPath}/`;
        branchErrors.set(
            group,
            remaining.filter((e) => e.schemaPath.startsWith(prefix))
        );
    }
    const folded = new Set([...branchErrors.values()].flat());
    remaining = remaining.filter((error) => !folded.has(error));

    // Drop exact duplicates.
    const seen = new Set();
    remaining = remaining.filter((error) => {
        const key = `${error.instancePath}\u0000${error.keyword}\u0000${JSON.stringify(error.params)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    // Missing required settings, by the instancePath of the section they belong in, so that a
    // misspelt setting and the missing one it was meant to be become one message.
    const missingBySection = new Map();
    for (const error of remaining) {
        if (error.keyword === 'required') {
            const missing = missingBySection.get(error.instancePath) ?? new Map();
            missing.set(error.params.missingProperty, error);
            missingBySection.set(error.instancePath, missing);
        }
    }

    // The closest allowed setting for each one that is not allowed, worked out before any message
    // is written, so that a missing setting it accounts for is left out wherever it comes in the
    // list.
    const suggestions = new Map();
    const merged = new Set();
    for (const error of remaining) {
        if (error.keyword !== 'additionalProperties') continue;
        const present = error.data && typeof error.data === 'object' ? error.data : {};
        const candidates = Object.keys(error.parentSchema?.properties ?? {}).filter(
            (candidate) => !Object.hasOwn(present, candidate)
        );
        const suggestion = closestSetting(error.params.additionalProperty, candidates);
        const missing = suggestion && missingBySection.get(error.instancePath)?.get(suggestion);
        if (missing && !merged.has(missing)) {
            merged.add(missing);
            suggestions.set(error, { suggestion, required: true });
        } else {
            suggestions.set(error, { suggestion, required: false });
        }
    }

    const entries = [];
    for (const error of remaining) {
        if (merged.has(error)) continue;

        const sectionSegments = pointerToSegments(error.instancePath);
        let segments = sectionSegments;
        let message;

        if (error.keyword === 'additionalProperties') {
            segments = [...sectionSegments, error.params.additionalProperty];
            const { suggestion, required } = suggestions.get(error);

            message = 'is not a known setting.';
            if (suggestion) {
                message += ` Did you mean "${suggestion}"?`;
                if (required) message += ` "${suggestion}" is required.`;
            } else {
                message += ' Check the spelling, or remove it.';
            }
        } else if (error.keyword === 'required') {
            const name = error.params.missingProperty;
            segments = [...sectionSegments, name];
            const section = toDottedPath(sectionSegments, data);
            message = section
                ? `is missing. Add it under ${section}.`
                : 'is missing. Add it at the top level of the file.';
        } else if (error.keyword === 'anyOf' || error.keyword === 'oneOf') {
            const found = describeValue(error.data);
            if (error.keyword === 'oneOf' && Array.isArray(error.params?.passingSchemas)) {
                message = `is ${found}, which matches more than one of the allowed forms. It must match exactly one.`;
            } else {
                const alternatives = [
                    ...new Set(
                        branchErrors
                            .get(error)
                            .filter((branch) => branch.instancePath === error.instancePath)
                            .map(expectation)
                            .filter(Boolean)
                    ),
                ];
                message =
                    alternatives.length > 0
                        ? `is ${found}, but must be ${joinAlternatives(alternatives)}.`
                        : `is ${found}, which matches none of the allowed forms.`;
            }
        } else {
            message = describeError(error);
        }

        entries.push({ segments, message });
    }

    return groupBySetting(entries, { data, locate });
}

/**
 * Joins messages about the same setting into one problem, adds positions and sorts by line.
 *
 * @param {Array<{segments: Array<string|number>, message: string}>} entries - Messages with the
 *     setting each is about.
 * @param {object} options - Options.
 * @param {unknown} [options.data] - The parsed config, used to write list indexes.
 * @param {Locator} options.locate - Position lookup.
 * @returns {ConfigProblem[]} The problems.
 */
function groupBySetting(entries, { data, locate }) {
    const bySetting = new Map();

    for (const { segments, message } of entries) {
        const path = toDottedPath(segments, data);
        const key = path ?? '';
        const existing = bySetting.get(key);
        if (existing) {
            if (!existing.messages.includes(message)) existing.messages.push(message);
        } else {
            bySetting.set(key, { path, segments, messages: [message] });
        }
    }

    const problems = [...bySetting.values()].map(({ path, segments, messages }) => {
        const position = locate(segments) ?? locate(segments.slice(0, -1));
        let message = messages.join(' ');
        if (path === null) message = `The top level of the file ${message}`;
        return {
            path,
            line: position?.line ?? null,
            column: position?.column ?? null,
            message,
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
 * Turns a YAML parse error into one problem with its line and column.
 *
 * @param {Error & {reason?: string, mark?: {line: number, column: number, snippet?: string}}} err -
 *     The error js-yaml threw.
 * @returns {ConfigProblem} The problem.
 */
export function yamlSyntaxProblem(err) {
    const mark = err?.mark;
    const reason = err?.reason ?? err?.message ?? String(err);
    const problem = {
        path: null,
        line: typeof mark?.line === 'number' ? mark.line + 1 : null,
        column: typeof mark?.column === 'number' ? mark.column + 1 : null,
        message: `The file is not valid YAML: ${reason}.`,
    };
    if (mark?.snippet) problem.snippet = mark.snippet;
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
            lines.push(`  ${label}${problem.path}`);
            lines.push(`${indent}${problem.message}`);
        } else {
            lines.push(`  ${label}${problem.message}`);
        }
        if (problem.snippet) {
            for (const snippetLine of problem.snippet.split('\n')) {
                if (snippetLine.trim() !== '') lines.push(`${indent}${snippetLine}`);
            }
        }
        lines.push('');
    });

    lines.push(
        `Fix ${count === 1 ? 'this' : 'these'} and start Butler SOS again. Run with --help for the command-line options.`
    );
    return lines.join('\n');
}
