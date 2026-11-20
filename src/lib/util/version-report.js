/**
 * What `--version` and the startup log's version line report.
 *
 * A stock build reports its version alone, exactly as it always has: `15.1.3`. Scripts and the
 * Windows release smoke test read that line, and nothing about it changes here.
 *
 * A variant build - one that bundled its own extensions module behind `#extensions` - reports more,
 * because it was otherwise indistinguishable from a stock binary at run time. Somebody filing an
 * issue from one had no way to say so, and the first sign was a report about a setting that does
 * not exist in this repository. So it reports which variant it is, core's version, the variant's own
 * version, and when it was built:
 *
 *     butler-sos 15.2.0 (acme)
 *       core    15.2.0
 *       acme    2.1.0
 *       built   2027-01-14
 *
 * The variant's own version is derived at build time, not declared: a description cannot know its
 * own version without hard-coding a number that goes stale silently, so `scripts/bundle.mjs` reads
 * it from that module's nearest `package.json`.
 */

/**
 * When this binary was built, injected at bundle time.
 *
 * Declared with a `typeof` guard rather than read directly, because esbuild's `define` substitutes a
 * bare identifier: in a source run the identifier simply does not exist, and referencing it would be
 * a ReferenceError rather than `undefined`.
 */
export const BUILD_DATE =
    typeof __BUTLER_SOS_BUILD_DATE__ === 'undefined' ? undefined : __BUTLER_SOS_BUILD_DATE__;

/** The version of the extensions module this binary bundled, injected at bundle time. */
export const EXTENSIONS_VERSION =
    typeof __BUTLER_SOS_EXTENSIONS_VERSION__ === 'undefined'
        ? undefined
        : __BUTLER_SOS_EXTENSIONS_VERSION__;

/**
 * Narrowest the detail label column gets, so short labels keep a readable gutter.
 *
 * A floor rather than a fixed width: `padEnd` does not truncate, so a fixed width would run label
 * and value together the moment a variant is named something as long as the column.
 */
const MIN_LABEL_WIDTH = 8;

/**
 * Render what `--version` prints.
 *
 * Pure, and takes every input rather than reading the injected constants itself, so the shape can be
 * asserted without a build.
 *
 * @param {object} options - What this binary knows about itself.
 * @param {string} options.name - The program name.
 * @param {string} options.version - The version from `package.json`, which is core's.
 * @param {string} [options.variant] - Short name for a variant build, from its description.
 * @param {string} [options.variantVersion] - That variant's own version, injected at bundle time.
 * @param {string} [options.buildDate] - When this binary was built, injected at bundle time.
 *
 * @returns {string} The bare version for a stock build; a headline and indented detail lines for a
 *     variant build.
 */
export const describeVersion = ({ name, version, variant, variantVersion, buildDate }) => {
    if (!variant) {
        return version;
    }

    const details = [
        ['core', version],
        ...(variantVersion ? [[variant, variantVersion]] : []),
        ...(buildDate ? [['built', buildDate]] : []),
    ];

    // Derived from the labels actually present, never assumed: a variant is named by whoever built
    // it, so the longest label is not knowable in advance. `+ 1` keeps at least one space after it.
    const width = Math.max(MIN_LABEL_WIDTH, ...details.map(([label]) => label.length + 1));
    const lines = details.map(([label, value]) => `  ${label.padEnd(width)}${value}`);

    return [`${name} ${version} (${variant})`, ...lines].join('\n');
};

/**
 * Fold what `--version` reports into one line, for the startup log.
 *
 * @param {string} described - What {@link describeVersion} returned.
 *
 * @returns {string} One line: the bare version for a stock build, e.g.
 *     `butler-sos 15.2.0 (acme) - core 15.2.0, acme 2.1.0, built 2027-01-14` for a variant.
 */
export const versionStampLine = (described) => {
    const [headline, ...details] = described.split('\n');

    if (details.length === 0) {
        return headline;
    }

    return `${headline} - ${details.map((line) => line.trim().replace(/\s+/, ' ')).join(', ')}`;
};
