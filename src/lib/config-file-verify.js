import { load } from 'js-yaml';
import fs from 'fs/promises';
import { default as Ajv } from 'ajv';

import configFileSchema from './config-file-schema.js';
import { verifyHost } from './host-utils.js';
import { getConfigArray } from './util/config-utils.js';

/**
 * Creates a modified schema that only validates sections when their associated features are enabled.
 *
 * @param {object} parsedConfig - The parsed configuration object
 * @param {object} baseSchema - The base schema to modify
 * @returns {object} Modified schema with conditional validation
 */
function createConditionalSchema(parsedConfig, baseSchema) {
    // Deep clone the base schema to avoid modifying the original
    const schema = JSON.parse(JSON.stringify(baseSchema));

    // Get the Butler-SOS configuration section
    const butlerConfig = parsedConfig['Butler-SOS'];
    if (!butlerConfig) {
        return schema; // Return original schema if no Butler-SOS section
    }

    const butlerSchema = schema.properties['Butler-SOS'];

    // Helper function to create conditional validation for a feature
    /**
     * Creates conditional validation for a feature based on its enable status
     *
     * @param {string} featureName - The name of the feature to make conditional
     * @param {string} enablePropertyName - The name of the property that enables the feature (default: 'enable')
     */
    const makeFeatureConditional = (featureName, enablePropertyName = 'enable') => {
        const featureSchema = butlerSchema.properties[featureName];
        if (!featureSchema) return;

        // Store the original schema
        const originalSchema = JSON.parse(JSON.stringify(featureSchema));

        // Create conditional schema using if/then/else
        butlerSchema.properties[featureName] = {
            type: 'object',
            properties: {
                [enablePropertyName]: { type: 'boolean' },
            },
            required: [enablePropertyName],
            if: {
                type: 'object',
                properties: { [enablePropertyName]: { const: true } },
                required: [enablePropertyName],
            },
            then: originalSchema,
            else: {
                type: 'object',
                properties: {
                    [enablePropertyName]: { type: 'boolean' },
                },
                required: [enablePropertyName],
                additionalProperties: true, // Allow any additional properties when disabled
            },
        };
    };

    // Apply conditional validation to features with enable flags
    makeFeatureConditional('crashFile');
    makeFeatureConditional('errorTracking');
    makeFeatureConditional('mqttConfig');
    makeFeatureConditional('newRelic');
    // auditEvents is intentionally NOT wrapped: when the section is present the full
    // schema always applies regardless of enable. When absent, it passes (not in root required).
    makeFeatureConditional('userEvents');
    makeFeatureConditional('prometheus');
    makeFeatureConditional('influxdbConfig');
    makeFeatureConditional('configVisualisation');
    makeFeatureConditional('heartbeat');
    makeFeatureConditional('dockerHealthCheck');
    makeFeatureConditional('uptimeMonitor');
    makeFeatureConditional('appNames', 'enableAppNameExtract');
    makeFeatureConditional('userSessions', 'enableSessionExtract');

    return schema;
}

/**
 * Verifies that the config file has the correct format.
 * Use yaml-validator to validate the config file
 *
 * @param {string} configFile path to the config file to verify
 * @returns {Promise<boolean>} true if the config file is valid, false otherwise
 */
export async function verifyConfigFileSchema(configFile) {
    try {
        const ajv = new Ajv({
            strict: true,
            async: true,
            allErrors: true,
        });

        // Dynamically import ajv-keywords
        const ajvKeywords = await import('ajv-keywords');

        // Add keywords to ajv instance
        ajvKeywords.default(ajv);

        // Dynamically import ajv-formats
        const ajvFormats = await import('ajv-formats');

        // Add formats to ajv instance
        ajvFormats.default(ajv);

        // Load the YAML schema file, identified by configFile, from file
        const fileContent = await fs.readFile(configFile, 'utf8');

        // Parse the YAML file
        let parsedFileContent;
        try {
            parsedFileContent = load(fileContent);
        } catch (err) {
            console.error(`VERIFY CONFIG FILE: Error parsing YAML file: ${err}`);
            return false;
        }

        // Create a conditional schema based on enabled features
        const conditionalSchema = createConditionalSchema(parsedFileContent, configFileSchema);

        // Log the schema modification for debugging (in development)
        if (process.env.NODE_ENV === 'development' || process.env.DEBUG_CONFIG_VALIDATION) {
            console.debug(
                'VERIFY CONFIG FILE: Created conditional schema based on enabled features'
            );
        }

        // Validate the parsed YAML file against the conditional schema
        const validate = ajv.compile(conditionalSchema);
        const valid = await validate(parsedFileContent);

        if (!valid) {
            // Log the errors in validate.errors[] and exit
            // Each object in the error array has the following properties:
            // - instancePath: Textual path to the part of the data that triggered the error
            // - schemaPath: A JSON Pointer to the part of the schema that triggered the error
            // - keyword: The validation keyword that failed
            // - params: The parameters for the keyword
            // - message: The error message

            for (const error of validate.errors) {
                console.error(`VERIFY CONFIG FILE ERROR: ${error.instancePath} : ${error.message}`);
            }

            process.exit(1);
        }

        console.info(
            `VERIFY CONFIG FILE: Your config file at ${configFile} is correctly formatted, good work!`
        );

        return true;
    } catch (err) {
        console.error(`VERIFY CONFIG FILE: ${err}`);

        return false;
    }
}

// Function to do verification of app specific settings and relationships between settings
/**
 * Verifies application-specific settings and relationships between configuration settings.
 *
 * This function performs validation beyond simple schema validation, checking:
 * 1. If InfluxDB is enabled, verifies that version is valid (must be 1 or 2)
 * 2. Validates server tag configuration:
 *    - All tags defined in serverTagsDefinition must be set for each server
 *    - All tags specified for each server must be present in serverTagsDefinition
 *
 * @param {object} cfg - The configuration object to verify
 * @returns {Promise<boolean>} A promise that resolves to true if all checks pass, false otherwise
 */
export async function verifyAppConfig(cfg) {
    // Verify values of specific config entries

    if (cfg.get('Butler-SOS.appNames.enableAppNameExtract') === true) {
        const appNamesHost = cfg.get('Butler-SOS.appNames.hostIP');

        const { resolvesToIp, tcpReachable } = await verifyHost(appNamesHost, 4242);

        if (!resolvesToIp) {
            console.error(
                `VERIFY CONFIG FILE ERROR: Butler-SOS.appNames.hostIP="${appNamesHost}" is invalid. It must be an IPv4 address or a hostname that resolves to an IPv4 address. Exiting.`
            );
            return false;
        }

        if (tcpReachable === false) {
            console.warn(
                `VERIFY CONFIG FILE WARNING: Butler-SOS.appNames.hostIP="${appNamesHost}" resolves to an IPv4 address, but Butler SOS could not reach ${appNamesHost}:4242 during startup. Continuing startup anyway.`
            );
        }
    }

    // If InfluxDB is enabled, check if the version is valid
    // Valid values: 1, 2, and 3
    if (cfg.get('Butler-SOS.influxdbConfig.enable') === true) {
        const influxdbVersion = cfg.get('Butler-SOS.influxdbConfig.version');
        if (influxdbVersion !== 1 && influxdbVersion !== 2 && influxdbVersion !== 3) {
            console.error(
                `VERIFY CONFIG FILE ERROR: Butler-SOS.influxdbConfig.enable (=InfluxDB version) ${influxdbVersion} is invalid. Exiting.`
            );
            return false;
        }

        // maxBatchSize validation and defaulting happens in config-loader.js, at load time.
        // It used to be here and called cfg.set(), which node-config does not implement. It
        // also belongs at load time because invalid values reach startup through routes this
        // function never sees: --skipConfigVerification skips it entirely, node-config merges
        // extra layers (local.yaml, NODE_CONFIG) that file verification never validates, and
        // the conditional schema stops checking this section once influxdbConfig.enable is
        // false.
    }

    // Verify that telemetry and system info settings are compatible
    // If telemetry is enabled but system info gathering is disabled, this creates an incompatibility
    // because telemetry relies on detailed system information for proper functionality
    const anonTelemetryEnabled = cfg.get('Butler-SOS.anonTelemetry');
    const systemInfoEnabled = cfg.get('Butler-SOS.systemInfo.enable');

    if (anonTelemetryEnabled === true && systemInfoEnabled === false) {
        console.error(
            'VERIFY CONFIG FILE ERROR: Anonymous telemetry is enabled (Butler-SOS.anonTelemetry=true) but system information gathering is disabled (Butler-SOS.systemInfo.enable=false). Telemetry requires system information to function properly. Either disable telemetry by setting Butler-SOS.anonTelemetry=false or enable system info gathering by setting Butler-SOS.systemInfo.enable=true. Exiting.'
        );
        return false;
    }

    // Warn about settings that leave a feature switched on but with nothing to act on.
    //
    // These used to announce themselves by crashing: iterating a null list threw, the caller
    // logged an error, and the administrator at least had something to search for. Now that a
    // null list is read as an empty list, the same configurations run quietly and simply
    // produce no data — which is harder to diagnose, not easier. These warnings replace the
    // signal that the crash used to provide.
    // An empty servers list is legitimate — Butler SOS can run purely as a UDP sink for Qlik
    // Sense log and user events — so it is not automatically a problem, and there is no
    // reliable "server polling intended" signal to gate on: health-metrics polling has no
    // enable flag of its own (it simply polls whatever servers are listed), and an earlier
    // gate on pollingInterval was vacuous because the schema requires that key to exist.
    //
    // So, two levels. Session extraction explicitly enabled with no servers is a feature
    // switched on with nothing to act on — warn, like the New Relic checks below. Otherwise
    // just state the fact at info level, for the administrator wondering where their server
    // data went, without training UDP-only operators to ignore warnings.
    if (getConfigArray(cfg, 'Butler-SOS.serversToMonitor.servers').length === 0) {
        const sessionExtractEnabled =
            cfg.has('Butler-SOS.userSessions.enableSessionExtract') &&
            cfg.get('Butler-SOS.userSessions.enableSessionExtract') === true;

        if (sessionExtractEnabled) {
            console.warn(
                'VERIFY CONFIG FILE WARNING: Butler-SOS.userSessions.enableSessionExtract is true, but Butler-SOS.serversToMonitor.servers is empty. No user sessions will be collected and no Qlik Sense servers will be monitored.'
            );
        } else {
            console.info(
                'VERIFY CONFIG FILE INFO: Butler-SOS.serversToMonitor.servers is empty. No Qlik Sense servers will be monitored.'
            );
        }
    }

    // Each destination-account list is keyed to the enable flags that actually cause it to be
    // READ, not to the flag that shares its name. Those are not the same thing:
    // `userEvents.sendToNewRelic.destinationAccount` is read by three functions, and only one of
    // them is gated on `userEvents.sendToNewRelic.enable` —
    //   - postUserEventToNewRelic       gated on userEvents.sendToNewRelic.enable
    //   - postHealthMetricsToNewRelic   gated on newRelic.enable (healthmetrics.js)
    //   - postProxySessionsToNewRelic   gated on newRelic.enable + metric.dynamic.proxy.sessions
    // An earlier version of this warning keyed it to the matching name only, so the two largest
    // consumers stayed silent — exactly the case the warning exists to catch.
    //
    // Note also that `Butler-SOS.newRelic.metric.destinationAccount` is required by the schema
    // and read by no production code; health and proxy metrics use the userEvents list instead.
    // That routing looks wrong but predates this change, so it is left alone here rather than
    // silently rerouted under anyone's running configuration.
    for (const { enablePaths, accountPath, label } of [
        {
            enablePaths: [
                'Butler-SOS.userEvents.sendToNewRelic.enable',
                'Butler-SOS.newRelic.enable',
            ],
            accountPath: 'Butler-SOS.userEvents.sendToNewRelic.destinationAccount',
            label: 'User events, health metrics and/or proxy sessions',
        },
        {
            enablePaths: ['Butler-SOS.logEvents.sendToNewRelic.enable'],
            accountPath: 'Butler-SOS.logEvents.sendToNewRelic.destinationAccount',
            label: 'Log events',
        },
        {
            enablePaths: ['Butler-SOS.uptimeMonitor.storeNewRelic.enable'],
            accountPath: 'Butler-SOS.uptimeMonitor.storeNewRelic.destinationAccount',
            label: 'Uptime monitor data',
        },
    ]) {
        const anyEnabled = enablePaths.some(
            (enablePath) => cfg.has(enablePath) && cfg.get(enablePath) === true
        );

        if (anyEnabled && getConfigArray(cfg, accountPath).length === 0) {
            console.warn(
                `VERIFY CONFIG FILE WARNING: ${label} are set to be sent to New Relic, but ${accountPath} is empty. No data will be sent to New Relic.`
            );
        }
    }

    // Verify that server tags are correctly defined
    // In the config file section `Butler-SOS.serversToMonitor.serverTagsDefinition` it's possible to define zero or more tags that can be set for each server that is to be monitored.
    // When Butler SOS is started, do the following checks:
    // 1. All tags present in `Butler-SOS.serversToMonitor.serverTagsDefinition` must be set for each server in `SOS.serversToMonitor.servers[]`
    // 2. The tags specified for each server in `SOS.serversToMonitor.servers[].serverTags` must be present in `Butler-SOS.serversToMonitor.serverTagsDefinition`
    // If either of the conditions above is false, an error should be logged and Butler SOS should not start.
    try {
        // Both of these are declared as ['array', 'null'] in the schema, and the shipped
        // production_template.yaml leaves serverTagsDefinition with every entry commented out
        // — which YAML parses as null. Reading them through getConfigArray() means "no tags
        // defined" is an empty list rather than a TypeError. See issue #1450, and #276 before
        // it.
        const serverTagsDefinition = getConfigArray(
            cfg,
            'Butler-SOS.serversToMonitor.serverTagsDefinition'
        );
        const servers = getConfigArray(cfg, 'Butler-SOS.serversToMonitor.servers');

        // 1. Every tag in serverTagsDefinition must be set on every monitored server
        for (const tag of serverTagsDefinition) {
            for (const server of servers) {
                const serverTags = server?.serverTags ?? {};

                // Test for presence, not truthiness. Tag values are unconstrained by the
                // schema (serverTags is additionalProperties: true), so `false`, `0` and ``
                // are all legitimate values — every InfluxDB version stringifies them — and a
                // truthiness test rejected them with "is not defined", refusing to start on a
                // schema-valid config.
                //
                // Object.hasOwn, not `in`: `in` walks the prototype chain, so a tag named
                // `constructor`, `toString` or `valueOf` would pass this check on a server that
                // does not define it. getServerTags builds the tag set from Object.entries —
                // own enumerable keys only — so such a tag would be declared, accepted here,
                // and then silently missing from every data point. Check 2 below uses for...in,
                // which is also own-enumerable, so this keeps the two checks in agreement.
                if (!Object.hasOwn(serverTags, tag)) {
                    console.error(
                        `VERIFY CONFIG FILE: Server tag "${tag}" is not defined for server "${server?.serverName}". Exiting.`
                    );
                    return false;
                }

                // A tag key present with no value (`myTag:` and nothing after it) parses as
                // null, and the InfluxDB versions disagree about what that means: v1 writes the
                // literal string "null", while v2 and v3 drop the tag entirely. That is a
                // config typo rather than an intent, so reject it here instead of writing
                // different data depending on which InfluxDB version is configured.
                if (serverTags[tag] === null) {
                    console.error(
                        `VERIFY CONFIG FILE: Server tag "${tag}" for server "${server?.serverName}" has no value. Give it a value or remove it. Exiting.`
                    );
                    return false;
                }
            }
        }

        // 2. Every tag set on a server must exist in serverTagsDefinition
        for (const server of servers) {
            for (const tag in server?.serverTags) {
                if (!serverTagsDefinition.includes(tag)) {
                    console.error(
                        `VERIFY CONFIG FILE: Server tag "${tag}" for server "${server?.serverName}" is not defined in Butler-SOS.serversToMonitor.serverTagsDefinition. Exiting.`
                    );
                    return false;
                }
            }
        }

        return true;
    } catch (err) {
        // Reaching here means an unanticipated shape in the serversToMonitor section. Name the
        // section being checked: the previous message reported a bare TypeError immediately
        // after telling the user their config was "correctly formatted, good work!", which
        // gave an administrator nothing to act on.
        console.error(
            `VERIFY CONFIG FILE: Server tags verification failed while checking Butler-SOS.serversToMonitor. ${err}`
        );
        return false;
    }
}
