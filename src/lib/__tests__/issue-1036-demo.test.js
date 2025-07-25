/**
 * Demonstrate the fix for issue #1036: Conditional config validation based on enable flags
 */

import { jest } from '@jest/globals';
import { dump } from 'js-yaml';
import fs from 'fs/promises';
import { verifyConfigFileSchema } from '../config-file-verify.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Issue #1036: Conditional Config Validation', () => {
    let tempConfigPath;

    afterEach(async () => {
        if (tempConfigPath) {
            try {
                await fs.unlink(tempConfigPath);
            } catch (err) {
                // Ignore if file doesn't exist
            }
            tempConfigPath = null;
        }
    });

    async function createTempConfig(configObject) {
        const tempDir = path.join(__dirname, '../../../tmp');
        await fs.mkdir(tempDir, { recursive: true });
        tempConfigPath = path.join(tempDir, `test-config-${Date.now()}.yaml`);
        const yamlContent = dump(configObject);
        await fs.writeFile(tempConfigPath, yamlContent);
        return tempConfigPath;
    }

    /**
     * This test demonstrates the main issue and its resolution:
     * Users should be able to leave sample/placeholder values in the config file
     * for features that are disabled, without getting validation errors.
     */
    test('should accept invalid config values when feature is disabled', async () => {
        const config = {
            'Butler-SOS': {
                // Basic required settings
                logLevel: 'info',
                fileLogging: true,
                logDirectory: 'log',
                anonTelemetry: true,

                // Features with enable flags - all disabled with placeholder/invalid values
                configVisualisation: {
                    enable: false,
                    host: 'localhost',
                    port: 3100,
                    obfuscate: true,
                },
                heartbeat: {
                    enable: false,
                    remoteURL: 'http://my.monitoring.server/some/path/', // Placeholder from template
                    frequency: 'every 1 hour',
                },
                dockerHealthCheck: {
                    enable: false,
                    port: 12398,
                },
                mqttConfig: {
                    enable: false,
                    brokerHost: '<IP of MQTT broker/server>', // Placeholder - invalid hostname
                    brokerPort: 1883,
                    baseTopic: 'butler-sos/',
                },
                newRelic: {
                    enable: false,
                    event: {
                        url: 'https://insights-collector.eu01.nr-data.net',
                        header: [],
                        attribute: {
                            static: [],
                            dynamic: {
                                butlerSosVersion: { enable: true },
                            },
                        },
                    },
                    metric: {
                        destinationAccount: [],
                        url: 'https://insights-collector.eu01.nr-data.net/metric/v1',
                        header: [],
                        dynamic: {
                            engine: {
                                memory: { enable: true },
                                cpu: { enable: true },
                                calls: { enable: true },
                                selections: { enable: true },
                                sessions: { enable: true },
                                users: { enable: true },
                                saturated: { enable: true },
                            },
                            apps: {
                                docCount: { enable: true },
                                activeDocs: { enable: true },
                                loadedDocs: { enable: true },
                                inMemoryDocs: { enable: true },
                            },
                            cache: {
                                cache: { enable: true },
                            },
                            proxy: {
                                sessions: { enable: true },
                            },
                        },
                        attribute: {
                            static: [],
                            dynamic: {
                                butlerSosVersion: { enable: true },
                            },
                        },
                    },
                },
                prometheus: {
                    enable: false,
                    host: 'localhost',
                    port: 9842,
                },
                influxdbConfig: {
                    enable: false,
                    host: 'localhost',
                    port: 8086,
                    version: 2,
                    v2Config: {
                        org: 'org',
                        bucket: 'bucket',
                        description: 'description',
                        token: 'token',
                        retentionDuration: '30d',
                    },
                    v1Config: {
                        auth: {
                            enable: false,
                            username: 'user',
                            password: 'pass',
                        },
                        dbName: 'butler-sos',
                        retentionPolicy: {
                            name: 'autogen',
                            duration: '30d',
                        },
                    },
                    includeFields: {
                        activeDocs: true,
                        loadedDocs: true,
                        inMemoryDocs: true,
                    },
                },

                // Required sections with minimal valid config
                uptimeMonitor: {
                    enable: true,
                    frequency: 'every 15 minutes',
                    logLevel: 'verbose',
                    storeInInfluxdb: {
                        butlerSOSMemoryUsage: true,
                        instanceTag: 'DEV',
                    },
                    storeNewRelic: {
                        enable: false,
                        destinationAccount: [],
                        metric: {
                            dynamic: {
                                butlerMemoryUsage: { enable: true },
                                butlerUptime: { enable: true },
                            },
                        },
                        attribute: {
                            static: [],
                            dynamic: {
                                butlerVersion: { enable: true },
                            },
                        },
                    },
                },
                thirdPartyToolsCredentials: {
                    newRelic: [],
                },
                qlikSenseEvents: {
                    influxdb: {
                        enable: false,
                        writeFrequency: 20000,
                    },
                    eventCount: {
                        enable: false,
                        influxdb: {
                            measurementName: 'event_count',
                            tags: [],
                        },
                    },
                    rejectedEventCount: {
                        enable: false,
                        influxdb: {
                            measurementName: 'rejected_event_count',
                        },
                    },
                },
                userEvents: {
                    enable: false,
                    excludeUser: [],
                    udpServerConfig: {
                        serverHost: 'localhost',
                        portUserActivityEvents: 9997,
                    },
                    tags: [],
                    sendToMQTT: {
                        enable: false,
                        postTo: {
                            everythingTopic: { enable: true, topic: 'test' },
                            sessionStartTopic: { enable: true, topic: 'test' },
                            sessionStopTopic: { enable: true, topic: 'test' },
                            connectionOpenTopic: { enable: true, topic: 'test' },
                            connectionCloseTopic: { enable: true, topic: 'test' },
                        },
                    },
                    sendToInfluxdb: { enable: true },
                    sendToNewRelic: {
                        enable: false,
                        destinationAccount: [],
                        scramble: true,
                    },
                },
                logEvents: {
                    udpServerConfig: {
                        serverHost: 'localhost',
                        portLogEvents: 9996,
                    },
                    tags: [],
                    source: {
                        engine: { enable: false },
                        proxy: { enable: false },
                        repository: { enable: false },
                        scheduler: { enable: false },
                        qixPerf: { enable: true },
                    },
                    categorise: {
                        enable: false,
                        ruleDefault: {
                            enable: false,
                            category: [],
                        },
                        rules: [],
                    },
                    appNameLookup: {
                        enable: true,
                    },
                    sendToMQTT: {
                        enable: false,
                        baseTopic: 'qliksense/logevent',
                        postTo: {
                            baseTopic: true,
                            subsystemTopics: true,
                        },
                    },
                    sendToInfluxdb: { enable: false },
                    sendToNewRelic: {
                        enable: false,
                        destinationAccount: [],
                        source: {
                            engine: {
                                enable: true,
                                logLevel: { error: true, warn: true },
                            },
                            proxy: {
                                enable: true,
                                logLevel: { error: true, warn: true },
                            },
                            repository: {
                                enable: true,
                                logLevel: { error: true, warn: true },
                            },
                            scheduler: {
                                enable: true,
                                logLevel: { error: true, warn: true },
                            },
                        },
                    },
                },
                cert: {
                    clientCert: '/path/to/cert',
                    clientCertKey: '/path/to/key',
                    clientCertCA: '/path/to/ca',
                    clientCertPassphrase: '',
                },
                appNames: {
                    enableAppNameExtract: true,
                    extractInterval: 30000,
                    hostIP: 'localhost',
                    enableAppNameLookup: true,
                    lookupFrequency: 30000,
                },
                userSessions: {
                    enableSessionExtract: true,
                    pollingInterval: 30000,
                    excludeUser: [],
                },
                serversToMonitor: {
                    pollingInterval: 30000,
                    rejectUnauthorized: true,
                    serverTagsDefinition: [],
                    servers: [],
                },
            },
        };

        const configPath = await createTempConfig(config);
        const result = await verifyConfigFileSchema(configPath);

        // Before the fix, this would fail because MQTT validation would reject '<IP of MQTT broker/server>'
        // After the fix, this should pass because MQTT is disabled
        expect(result).toBe(true);
    });

    test('should still validate enabled features properly', async () => {
        const config = {
            'Butler-SOS': {
                logLevel: 'info',
                fileLogging: true,
                logDirectory: 'log',
                anonTelemetry: true,
                configVisualisation: {
                    enable: false,
                    host: 'localhost',
                    port: 3100,
                    obfuscate: true,
                },
                heartbeat: {
                    enable: false,
                    remoteURL: 'http://example.com',
                    frequency: 'every 1 hour',
                },
                dockerHealthCheck: {
                    enable: false,
                    port: 12398,
                },
                mqttConfig: {
                    enable: true, // Enabled with invalid config
                    brokerHost: '<INVALID>', // Invalid hostname format
                    brokerPort: 1883,
                    baseTopic: 'butler-sos/',
                },
                newRelic: {
                    enable: false,
                    event: {
                        url: 'https://insights-collector.eu01.nr-data.net',
                        header: [],
                        attribute: {
                            static: [],
                            dynamic: {
                                butlerSosVersion: { enable: true },
                            },
                        },
                    },
                    metric: {
                        destinationAccount: [],
                        url: 'https://insights-collector.eu01.nr-data.net/metric/v1',
                        header: [],
                        dynamic: {
                            engine: {
                                memory: { enable: true },
                                cpu: { enable: true },
                                calls: { enable: true },
                                selections: { enable: true },
                                sessions: { enable: true },
                                users: { enable: true },
                                saturated: { enable: true },
                            },
                            apps: {
                                docCount: { enable: true },
                                activeDocs: { enable: true },
                                loadedDocs: { enable: true },
                                inMemoryDocs: { enable: true },
                            },
                            cache: {
                                cache: { enable: true },
                            },
                            proxy: {
                                sessions: { enable: true },
                            },
                        },
                        attribute: {
                            static: [],
                            dynamic: {
                                butlerSosVersion: { enable: true },
                            },
                        },
                    },
                },
                prometheus: {
                    enable: false,
                    host: 'localhost',
                    port: 9842,
                },
                influxdbConfig: {
                    enable: false,
                    host: 'localhost',
                    port: 8086,
                    version: 2,
                    v2Config: {
                        org: 'org',
                        bucket: 'bucket',
                        description: 'description',
                        token: 'token',
                        retentionDuration: '30d',
                    },
                    v1Config: {
                        auth: {
                            enable: false,
                            username: 'user',
                            password: 'pass',
                        },
                        dbName: 'butler-sos',
                        retentionPolicy: {
                            name: 'autogen',
                            duration: '30d',
                        },
                    },
                    includeFields: {
                        activeDocs: true,
                        loadedDocs: true,
                        inMemoryDocs: true,
                    },
                },
                uptimeMonitor: {
                    enable: true,
                    frequency: 'every 15 minutes',
                    logLevel: 'verbose',
                    storeInInfluxdb: {
                        butlerSOSMemoryUsage: true,
                        instanceTag: 'DEV',
                    },
                    storeNewRelic: {
                        enable: false,
                        destinationAccount: [],
                        metric: {
                            dynamic: {
                                butlerMemoryUsage: { enable: true },
                                butlerUptime: { enable: true },
                            },
                        },
                        attribute: {
                            static: [],
                            dynamic: {
                                butlerVersion: { enable: true },
                            },
                        },
                    },
                },
                thirdPartyToolsCredentials: {
                    newRelic: [],
                },
                qlikSenseEvents: {
                    influxdb: {
                        enable: false,
                        writeFrequency: 20000,
                    },
                    eventCount: {
                        enable: false,
                        influxdb: {
                            measurementName: 'event_count',
                            tags: [],
                        },
                    },
                    rejectedEventCount: {
                        enable: false,
                        influxdb: {
                            measurementName: 'rejected_event_count',
                        },
                    },
                },
                userEvents: {
                    enable: false,
                    excludeUser: [],
                    udpServerConfig: {
                        serverHost: 'localhost',
                        portUserActivityEvents: 9997,
                    },
                    tags: [],
                    sendToMQTT: {
                        enable: false,
                        postTo: {
                            everythingTopic: { enable: true, topic: 'test' },
                            sessionStartTopic: { enable: true, topic: 'test' },
                            sessionStopTopic: { enable: true, topic: 'test' },
                            connectionOpenTopic: { enable: true, topic: 'test' },
                            connectionCloseTopic: { enable: true, topic: 'test' },
                        },
                    },
                    sendToInfluxdb: { enable: true },
                    sendToNewRelic: {
                        enable: false,
                        destinationAccount: [],
                        scramble: true,
                    },
                },
                logEvents: {
                    udpServerConfig: {
                        serverHost: 'localhost',
                        portLogEvents: 9996,
                    },
                    tags: [],
                    source: {
                        engine: { enable: false },
                        proxy: { enable: false },
                        repository: { enable: false },
                        scheduler: { enable: false },
                        qixPerf: { enable: true },
                    },
                    categorise: {
                        enable: false,
                        ruleDefault: {
                            enable: false,
                            category: [],
                        },
                        rules: [],
                    },
                    appNameLookup: {
                        enable: true,
                    },
                    sendToMQTT: {
                        enable: false,
                        baseTopic: 'qliksense/logevent',
                        postTo: {
                            baseTopic: true,
                            subsystemTopics: true,
                        },
                    },
                    sendToInfluxdb: { enable: false },
                    sendToNewRelic: {
                        enable: false,
                        destinationAccount: [],
                        source: {
                            engine: {
                                enable: true,
                                logLevel: { error: true, warn: true },
                            },
                            proxy: {
                                enable: true,
                                logLevel: { error: true, warn: true },
                            },
                            repository: {
                                enable: true,
                                logLevel: { error: true, warn: true },
                            },
                            scheduler: {
                                enable: true,
                                logLevel: { error: true, warn: true },
                            },
                        },
                    },
                },
                cert: {
                    clientCert: '/path/to/cert',
                    clientCertKey: '/path/to/key',
                    clientCertCA: '/path/to/ca',
                    clientCertPassphrase: '',
                },
                appNames: {
                    enableAppNameExtract: true,
                    extractInterval: 30000,
                    hostIP: 'localhost',
                    enableAppNameLookup: true,
                    lookupFrequency: 30000,
                },
                userSessions: {
                    enableSessionExtract: true,
                    pollingInterval: 30000,
                    excludeUser: [],
                },
                serversToMonitor: {
                    pollingInterval: 30000,
                    rejectUnauthorized: true,
                    serverTagsDefinition: [],
                    servers: [],
                },
            },
        };

        const configPath = await createTempConfig(config);
        const result = await verifyConfigFileSchema(configPath);

        // This should fail because MQTT is enabled with invalid hostname
        expect(result).toBe(false);
    });
});
