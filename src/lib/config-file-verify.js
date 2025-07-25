import { load } from 'js-yaml';
import fs from 'fs/promises';
import { default as Ajv } from 'ajv';

import configFileSchema from './config-file-schema.js';

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
    const makeFeatureConditional = (featureName) => {
        const featureSchema = butlerSchema.properties[featureName];
        if (!featureSchema) return;
        
        // Store the original schema
        const originalSchema = JSON.parse(JSON.stringify(featureSchema));
        
        // Create conditional schema using if/then/else
        butlerSchema.properties[featureName] = {
            type: 'object',
            properties: {
                enable: { type: 'boolean' }
            },
            required: ['enable'],
            if: {
                properties: { enable: { const: true } }
            },
            then: originalSchema,
            else: {
                type: 'object',
                properties: {
                    enable: { type: 'boolean' }
                },
                required: ['enable'],
                additionalProperties: true // Allow any additional properties when disabled
            }
        };
    };
    
    // Apply conditional validation to features with enable flags
    makeFeatureConditional('mqttConfig');
    makeFeatureConditional('newRelic');
    makeFeatureConditional('userEvents');
    makeFeatureConditional('prometheus');
    makeFeatureConditional('influxdbConfig');
    makeFeatureConditional('configVisualisation');
    makeFeatureConditional('heartbeat');
    makeFeatureConditional('dockerHealthCheck');
    
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
            console.debug('VERIFY CONFIG FILE: Created conditional schema based on enabled features');
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

    // If InfluxDB is enabled, check if the version is valid
    // Valid values: 1 and 2
    if (cfg.get('Butler-SOS.influxdbConfig.enable') === true) {
        const influxdbVersion = cfg.get('Butler-SOS.influxdbConfig.version');
        if (influxdbVersion !== 1 && influxdbVersion !== 2) {
            console.error(
                `VERIFY CONFIG FILE ERROR: Butler-SOS.influxdbConfig.enable (=InfluxDB version) ${influxdbVersion} is invalid. Exiting.`
            );
            return false;
        }
    }

    // Verify that server tags are correctly defined
    // In the config file section `Butler-SOS.serversToMonitor.serverTagsDefinition` it's possible to define zero or more tags that can be set for each server that is to be monitored.
    // When Butler SOS is started, do the following checks:
    // 1. All tags present in `Butler-SOS.serversToMonitor.serverTagsDefinition` must be set for each server in `SOS.serversToMonitor.servers[]`
    // 2. The tags specified for each server in `SOS.serversToMonitor.servers[].serverTags` must be present in `Butler-SOS.serversToMonitor.serverTagsDefinition`
    // If either of the conditions above is false, an error should be logged and Butler SOS should not start.
    try {
        // Loop over all defined server tags
        const serverTagsDefinition = cfg.get('Butler-SOS.serversToMonitor.serverTagsDefinition');
        for (const tag of serverTagsDefinition) {
            // Check that all servers have this tag
            const servers = cfg.get('Butler-SOS.serversToMonitor.servers');
            for (const server of servers) {
                // Check if server.serverTags.tag is defined
                if (server?.serverTags === null || !server?.serverTags[tag]) {
                    console.error(
                        `VERIFY CONFIG FILE: Server tag "${tag}" is not defined for server "${server.serverName}". Exiting.`
                    );
                    return false;
                } else {
                    // The tag is defined for this server
                }
            }
        }

        // Now ensure that the tags defined for each server are valid and that there are no extra tags there
        const servers = cfg.get('Butler-SOS.serversToMonitor.servers');
        for (const server of servers) {
            for (const tag in server.serverTags) {
                if (!serverTagsDefinition.includes(tag)) {
                    console.error(
                        `VERIFY CONFIG FILE: Server tag "${tag}" for server "${server.serverName}" is not defined in Butler-SOS.serversToMonitor.serverTagsDefinition. Exiting.`
                    );
                    return false;
                } else {
                    // The tag is defined in Butler-SOS.serversToMonitor.serverTagsDefinition
                }
            }
        }

        return true;
    } catch (err) {
        console.error(`VERIFY CONFIG FILE: Server tags verification failed. ${err}`);
        return false;
    }
}
