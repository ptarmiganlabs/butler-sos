/**
 * Test suite for conditional configuration validation based on feature enable flags.
 *
 * Tests that Butler SOS only validates configuration sections when the associated feature is enabled.
 * When a feature is disabled, its detailed configuration should not be validated.
 */

import { jest } from '@jest/globals';
import { load, dump } from 'js-yaml';
import fs from 'fs/promises';
import { verifyConfigFileSchema } from '../config-file-verify.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Conditional Configuration Validation', () => {
    let tempConfigPath;

    // Clean up temp files after each test
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

    /**
     * Helper function to create a temporary config file for testing
     */
    async function createTempConfig(configObject) {
        const tempDir = path.join(__dirname, '../../../tmp');
        await fs.mkdir(tempDir, { recursive: true });
        tempConfigPath = path.join(tempDir, `test-config-${Date.now()}.yaml`);
        const yamlContent = dump(configObject);
        await fs.writeFile(tempConfigPath, yamlContent);
        return tempConfigPath;
    }

    /**
     * Base valid configuration that all tests can extend
     */
    const baseValidConfig = {
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
                    rules: [],
                },
                appNameLookup: {
                    enable: true,
                },
                appAccess: {
                    enable: false,
                    influxdb: {
                        enable: false,
                        measurementName: 'app_access',
                    },
                    rejectedEventCount: {
                        enable: false,
                        influxdb: {
                            measurementName: 'rejected_app_access',
                        },
                    },
                    allApps: {
                        enable: false,
                        appsInclude: [],
                        appsExclude: [],
                    },
                    someApps: {
                        enable: false,
                        appsInclude: [],
                    },
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
            mqttConfig: {
                enable: false,
                brokerHost: 'localhost',
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
                enable: true,
                version: 2,
                hostIP: 'localhost',
                hostPort: 8086,
                auth: {
                    enable: false,
                    username: '',
                    password: '',
                },
                dbName: 'butler-sos',
                instanceTag: 'DEV',
                v1Config: {
                    host: 'localhost',
                    port: 8086,
                    database: 'butler-sos',
                    retentionPolicy: 'autogen',
                },
                v2Config: {
                    url: 'http://localhost:8086',
                    token: 'token',
                    org: 'org',
                    bucket: 'bucket',
                },
                writeSchedule: {
                    frequency: 10000,
                    tags: [],
                },
            },
            appNames: {
                enableAppNameLookup: true,
                lookupFrequency: 30000,
                influxdb: {
                    enable: true,
                },
                newRelic: {
                    enable: true,
                    destinationAccount: [],
                    metric: {
                        dynamic: {
                            butlerSosVersion: { enable: true },
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
            userSessions: {
                enableSessionExtract: true,
                pollingFrequency: 30000,
                excludeUser: [],
                influxdb: {
                    enable: true,
                },
                newRelic: {
                    enable: false,
                    destinationAccount: [],
                    metric: {
                        dynamic: {
                            butlerSosVersion: { enable: true },
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
            serversToMonitor: {
                pollingFrequency: 30000,
                serverTagsDefinition: [],
                servers: [],
            },
        },
    };

    test('should pass validation with minimal config when MQTT is disabled', async () => {
        // Start with a minimal, working config from the template
        const minimalConfig = {
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
                        ruleDefault: { enable: false },
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
                mqttConfig: {
                    enable: false,
                    brokerHost: 'INVALID_HOST_FORMAT', // This should be ignored when disabled
                    brokerPort: 'INVALID_PORT', // This should be ignored when disabled
                    baseTopic: '', // This should be ignored when disabled
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
                appNames: {
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

        const configPath = await createTempConfig(minimalConfig);

        // This should pass validation since MQTT is disabled
        const result = await verifyConfigFileSchema(configPath);
        expect(result).toBe(true);
    });

    test('should fail validation when MQTT is enabled but has invalid config', async () => {
        const config = JSON.parse(JSON.stringify(baseValidConfig));
        config['Butler-SOS'].mqttConfig = {
            enable: true,
            brokerHost: 'INVALID_HOST_FORMAT', // This should cause validation to fail
            brokerPort: 'INVALID_PORT', // This should cause validation to fail
            baseTopic: '', // This should cause validation to fail
        };

        const configPath = await createTempConfig(config);

        // This should fail validation since MQTT is enabled with invalid config
        const result = await verifyConfigFileSchema(configPath);
        expect(result).toBe(false);
    });

    test('should pass validation when New Relic is disabled with invalid config', async () => {
        const config = JSON.parse(JSON.stringify(baseValidConfig));
        config['Butler-SOS'].newRelic = {
            enable: false,
            event: {
                url: 'INVALID_URL', // This should be ignored when disabled
                header: 'INVALID_HEADER', // This should be ignored when disabled
                attribute: 'INVALID_ATTRIBUTE', // This should be ignored when disabled
            },
            // Missing required 'metric' property - should be ignored when disabled
        };

        const configPath = await createTempConfig(config);

        // This should pass validation since New Relic is disabled
        const result = await verifyConfigFileSchema(configPath);
        expect(result).toBe(true);
    });

    test('should pass validation when user events are disabled with minimal config', async () => {
        const config = JSON.parse(JSON.stringify(baseValidConfig));
        config['Butler-SOS'].userEvents = {
            enable: false,
            // Missing required properties like udpServerConfig - should be ignored when disabled
        };

        const configPath = await createTempConfig(config);

        // This should pass validation since user events are disabled
        const result = await verifyConfigFileSchema(configPath);
        expect(result).toBe(true);
    });
});
