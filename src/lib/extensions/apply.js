/**
 * Applies what an extensions module describes to Butler SOS.
 *
 * The module behind `#extensions` exports a plain value, not code that reaches into Butler SOS
 * itself. That is deliberate: core stays in control of what is registered and when, the description
 * can be inspected in a test without a running service, and the committed default can be a literal -
 * which is what lets the ordinary test suite cover the every-run path.
 *
 * A description reaches core at three points, in this order, each once per process:
 *
 * 1. **Command line.** {@link applyOptions} adds its options to the root command before it is parsed.
 * 2. **Config file.** {@link applyConfigSchema} merges its settings into the schema the config file
 *    is verified, normalised and defaulted against.
 * 3. **Startup.** {@link runBeforeStart} awaits its `beforeStart` hook once the config is loaded and
 *    logging is up, and before Butler SOS opens a UDP port, connects to InfluxDB or MQTT, or starts
 *    any service. The hook gets the settings core already resolved ({@link createStartContext}).
 *
 * This module imports nothing from the rest of Butler SOS, so it can be used while the globals
 * singleton is still being built.
 */

/**
 * What a build contributes to Butler SOS beyond what core declares itself.
 *
 * @typedef {object} SeamDescription
 * @property {number} seamVersion - The contract version this description targets.
 * @property {string} [variant] - Optional short name for this build, e.g. `'acme'`. When present,
 *     `--version` and the startup log name it and report the extensions module's own version and the
 *     build date alongside core's; when absent - which is what the committed stub does - both are
 *     unchanged.
 * @property {OptionContribution[]} options - Command-line options to add to the root command.
 * @property {{[name: string]: object}} configSchema - JSON Schema properties to add under `Butler-SOS`
 *     in the config file, keyed by setting name. A key core already defines is refused.
 * @property {SeamHooks} hooks - Hooks, all of them optional.
 */

/**
 * @typedef {object} OptionContribution
 * @property {import('commander').Option} option - A fully built Commander option, added to the root
 *     command. Butler SOS has no subcommands, so there is nothing else to aim at.
 */

/**
 * @typedef {object} SeamHooks
 * @property {BeforeStart} [beforeStart] - Runs once at startup, after the config is loaded and
 *     before any service starts. It must be idempotent.
 */

/**
 * A hook core awaits once at startup.
 *
 * A throw stops startup. An error carrying `expected: true` is reported as its message alone, as an
 * ordinary failure with exit code 1; any other error is reported as a crash.
 *
 * @callback BeforeStart
 * @param {StartContext} context - The settings core has resolved.
 * @returns {void|Promise<void>}
 */

/**
 * The settings core has resolved by the time `beforeStart` runs, handed over so an extension reads
 * them rather than parsing the config file again.
 *
 * @typedef {object} StartContext
 * @property {ReadOnlyConfig} config - The whole loaded config: the file as verified, with defaults
 *     applied and command-line overrides folded in, including any contributed settings.
 * @property {{clientCert: string, clientCertKey: string, clientCertCA: string}} certificates - The
 *     absolute paths core resolved for the client certificates, so an extension does not repeat
 *     the path rules for source, SEA and Docker runs.
 * @property {object} logger - Core's winston logger, so an extension's lines share its format,
 *     level and destinations.
 * @property {object} options - The parsed command line, including contributed options.
 * @property {string} appVersion - Butler SOS's version.
 * @property {boolean} isSea - Whether this is a packaged single-executable build.
 */

/**
 * A read-only view of the loaded config.
 *
 * @typedef {object} ReadOnlyConfig
 * @property {(path: string) => unknown} get - The value at a dotted path, e.g.
 *     `'Butler-SOS.influxdbConfig.enable'`, as a copy: changing it changes nothing in core. Throws
 *     for a path that is not set, as `config.get` does.
 * @property {(path: string) => boolean} has - Whether a dotted path is set.
 */

/**
 * The keys of {@link StartContext}, in the order {@link createStartContext} builds them.
 *
 * A test asserts the built context against this list, so a key cannot be added to or dropped from
 * the context without the contract - and this list - saying so.
 */
export const START_CONTEXT_KEYS = Object.freeze([
    'config',
    'certificates',
    'logger',
    'options',
    'appVersion',
    'isSea',
]);

/**
 * Check the two mistakes in a description that would otherwise be silent.
 *
 * The description is trusted rather than schema-validated. It is a value written by whoever built
 * the binary, and it was checked against {@link import('./version.js').SEAM_VERSION} when the bundle
 * was made. What is caught here is a hook that is not a function - which would otherwise surface
 * only at the moment core calls it - and an option that is not an option.
 *
 * @param {SeamDescription|undefined|null} extensions - The description.
 *
 * @returns {void} Nothing. Returns normally for a usable description, including an empty one.
 *
 * @throws {Error} When a hook is not a function, or an option contribution carries no option.
 */
const assertDescription = (extensions) => {
    const { options = [], hooks = {} } = extensions ?? {};

    for (const [name, hook] of Object.entries(hooks)) {
        if (hook !== undefined && typeof hook !== 'function') {
            throw new Error(
                `Extension hook '${name}' must be a function, but the description carries a ${typeof hook}.`
            );
        }
    }

    for (const contribution of options) {
        if (typeof contribution?.option?.attributeName !== 'function') {
            throw new Error(
                'Extension option contributions must each carry a Commander Option as `option`.'
            );
        }
    }
};

/**
 * Add a description's command-line options to the root command.
 *
 * Called by `initCommandLine` before `program.parse`, which is the first time core reads the
 * description, so the description's shape is checked here too. An empty description adds nothing,
 * so a build with no extensions behaves exactly as it would if this function were never called.
 *
 * @param {import('commander').Command} program - The root command, with core's own options added.
 * @param {SeamDescription|undefined|null} extensions - What to add. Describing nothing is normal.
 *
 * @returns {void} Nothing. The command is modified in place.
 *
 * @throws {Error} When the description is malformed (see {@link assertDescription}), or when an
 *     option clashes with one core declares: Commander refuses a second option of the same name.
 */
export const applyOptions = (program, extensions) => {
    assertDescription(extensions);

    for (const { option } of extensions?.options ?? []) {
        program.addOption(option);
    }
};

/**
 * The config file schema with a description's settings merged in.
 *
 * Core verifies the config file, and fills in its defaults, against one schema. Contributed settings
 * go into that same schema, under `Butler-SOS`, so they are verified and defaulted exactly as core's
 * own are. A build without the description ignores such a setting, as it ignores any key under
 * `Butler-SOS` it does not know.
 *
 * Pure: the base schema is not modified. With an empty description the result equals the base.
 *
 * @param {object} baseSchema - Core's config file schema.
 * @param {SeamDescription|undefined|null} extensions - The description.
 *
 * @returns {object} The schema to verify against: a copy of the base when anything is contributed,
 *     the base itself when nothing is.
 *
 * @throws {Error} When a contributed setting has a name core already uses. Core's settings are never
 *     replaced or widened by a description.
 */
export const applyConfigSchema = (baseSchema, extensions) => {
    const contributed = Object.entries(extensions?.configSchema ?? {});

    if (contributed.length === 0) {
        return baseSchema;
    }

    const schema = structuredClone(baseSchema);
    const properties = schema.properties['Butler-SOS'].properties;

    for (const [name, fragment] of contributed) {
        if (Object.hasOwn(properties, name)) {
            throw new Error(
                `Extension config setting 'Butler-SOS.${name}' is already defined by Butler SOS. A description may add settings, never replace one.`
            );
        }

        properties[name] = structuredClone(fragment);
    }

    return schema;
};

/**
 * A read-only view of a loaded config object.
 *
 * Read-only so that a hook cannot change what core then connects to. `get` returns a copy rather
 * than the live value, because node-config's objects are mutable while Butler SOS starts up.
 *
 * @param {{get: (path: string) => unknown, has: (path: string) => boolean}} config - The loaded
 *     config, as `globals.config` holds it.
 *
 * @returns {ReadOnlyConfig} The view.
 */
export const readOnlyConfig = (config) =>
    Object.freeze({
        /**
         * The value at a dotted path, as a copy.
         *
         * @param {string} path - A dotted path, e.g. `'Butler-SOS.influxdbConfig.enable'`.
         * @returns {unknown} A copy of the value.
         */
        get: (path) => structuredClone(config.get(path)),
        /**
         * Whether a dotted path is set.
         *
         * @param {string} path - A dotted path.
         * @returns {boolean} True when it is set.
         */
        has: (path) => config.has(path),
    });

/**
 * Build the context `beforeStart` gets, from the settings singleton as it stands at that point.
 *
 * @param {object} settings - The globals singleton, part way through `init()`: config loaded,
 *     logging up, certificate paths resolved.
 *
 * @returns {StartContext} The context, frozen.
 */
export const createStartContext = (settings) =>
    Object.freeze({
        config: readOnlyConfig(settings.config),
        certificates: Object.freeze({
            clientCert: settings.certPath,
            clientCertKey: settings.keyPath,
            clientCertCA: settings.caPath,
        }),
        logger: settings.logger,
        options: Object.freeze({ ...settings.options }),
        appVersion: settings.appVersion,
        isSea: settings.isSea === true,
    });

/**
 * Run a description's `beforeStart` hook, if it has one.
 *
 * @param {SeamDescription|undefined|null} extensions - The description, which may describe no
 *     hooks at all.
 * @param {StartContext} context - What core has resolved, from {@link createStartContext}.
 *
 * @returns {Promise<void>} Resolves when the hook has finished, at once when there is none - the
 *     committed default's case.
 */
export const runBeforeStart = async (extensions, context) => {
    await extensions?.hooks?.beforeStart?.(context);
};

/**
 * Whether an error is an ordinary failure, to be reported as its message alone.
 *
 * Duck-typed on `expected === true` rather than on a class, because an extensions module cannot
 * import one of core's: it is a separate package, built into the bundle, not a dependency of it.
 *
 * @param {unknown} err - What was thrown.
 *
 * @returns {boolean} True for an error that says it is expected.
 */
export const isExpectedFailure = (err) => err?.expected === true;
