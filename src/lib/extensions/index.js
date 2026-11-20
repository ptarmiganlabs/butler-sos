/**
 * What this build adds to Butler SOS beyond what core declares itself.
 *
 * This is the committed default, and it describes nothing: no command-line options, no config
 * settings, no hooks. That is a real, correct implementation of "there is nothing to add" rather
 * than a placeholder - it is what every build in this repository bundles, and what `npm test`
 * exercises. A throw, a warning or a `null` here would all mean the normal path is the untested one.
 *
 * A variant build replaces this module by pointing `EXTENSIONS_MODULE` at its own, which
 * `scripts/bundle.mjs` turns into an esbuild alias for the `#extensions` specifier. Nothing is
 * discovered at runtime: the module is chosen when the bundle is built, so it is compiled into the
 * binary or it is not present at all.
 *
 * The shape is documented as `SeamDescription` in `apply.js`, which is the only consumer.
 *
 * @type {import('./apply.js').SeamDescription}
 */
export const extensions = { seamVersion: 1, options: [], configSchema: {}, hooks: {} };
