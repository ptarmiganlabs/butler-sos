import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import Ajv from 'ajv';
import addKeywords from 'ajv-keywords';
import addFormats from 'ajv-formats';
import configFileSchema from '../config-file-schema.js';

describe('config-file-schema', () => {
    let ajv;

    beforeEach(() => {
        ajv = new Ajv({
            strict: true,
            allErrors: true,
            allowUnionTypes: true,
        });
        addKeywords(ajv, ['transform']);
        addFormats(ajv);
    });

    test('should export a valid JSON schema object', () => {
        expect(configFileSchema).toBeDefined();
        expect(typeof configFileSchema).toBe('object');
        expect(configFileSchema.type).toBe('object');
        expect(configFileSchema.properties).toBeDefined();
        expect(configFileSchema.properties['Butler-SOS']).toBeDefined();
    });

    test('should validate against a minimal valid configuration', () => {
        const minimalConfig = {
            'Butler-SOS': {
                logLevel: 'info',
                fileLogging: true,
                logDirectory: './log',
                anonTelemetry: false,
                systemInfo: {
                    enable: true,
                },
                configVisualisation: {
                    enable: false,
                    host: 'localhost',
                    port: 3000,
                    obfuscate: false,
                },
                heartbeat: {
                    enable: false,
                    remoteURL: 'http://localhost:3001/ping',
                    frequency: '60s',
                },
                dockerHealthCheck: {
                    enable: false,
                    port: 12398,
                },
                uptimeMonitor: {
                    enable: false,
                    frequency: '60s',
                    logLevel: 'info',
                    storeInInfluxdb: {
                        butlerSOSMemoryUsage: false,
                        instanceTag: 'DEV',
                    },
                    storeNewRelic: {
                        enable: false,
                    },
                },
                thirdPartyToolsCredentials: {
                    newRelic: [],
                },
                qlikSenseEvents: {
                    influxdb: {
                        enable: false,
                        writeFrequency: 5000,
                    },
                    eventCount: {
                        enable: false,
                        influxdb: {
                            measurementName: 'qlik_sense_events',
                            tags: [],
                        },
                    },
                    rejectedEventCount: {
                        enable: false,
                        influxdb: {
                            measurementName: 'qlik_sense_events_rejected',
                        },
                    },
                },
                userEvents: {
                    enable: false,
                    excludeUser: [],
                    udpServerConfig: {
                        serverHost: 'localhost',
                        portUserActivityEvents: 9999,
                        messageQueue: {
                            maxConcurrent: 10,
                            maxSize: 200,
                            backpressureThreshold: 80,
                        },
                        rateLimit: {
                            enable: false,
                            maxMessagesPerMinute: 600,
                        },
                        maxMessageSize: 65507,
                        queueMetrics: {
                            influxdb: {
                                enable: false,
                                writeFrequency: 20000,
                                measurementName: 'user_events_queue',
                                tags: [],
                            },
                        },
                    },
                    tags: null,
                },
                logEvents: {
                    tags: null,
                    categorise: {
                        enable: false,
                        rules: [],
                        ruleDefault: {
                            enable: false,
                            category: null,
                        },
                    },
                    udpServerConfig: {
                        serverHost: 'localhost',
                        portLogEvents: 9998,
                        messageQueue: {
                            maxConcurrent: 10,
                            maxSize: 200,
                            backpressureThreshold: 80,
                        },
                        rateLimit: {
                            enable: false,
                            maxMessagesPerMinute: 600,
                        },
                        maxMessageSize: 65507,
                        queueMetrics: {
                            influxdb: {
                                enable: false,
                                writeFrequency: 20000,
                                measurementName: 'log_events_queue',
                                tags: [],
                            },
                        },
                    },
                    source: {
                        engine: {
                            enable: false,
                        },
                        proxy: {
                            enable: false,
                        },
                        repository: {
                            enable: false,
                        },
                        scheduler: {
                            enable: false,
                        },
                        qixPerf: {
                            enable: false,
                        },
                    },
                },
                cert: {
                    clientCert: '/path/to/cert.pem',
                    clientCertKey: '/path/to/key.pem',
                    clientCertCA: '/path/to/ca.pem',
                },
                mqttConfig: {
                    enable: false,
                    brokerHost: 'localhost',
                    brokerPort: 1883,
                    baseTopic: 'butlersos',
                },
                newRelic: {
                    enable: false,
                    event: {
                        url: 'https://insights-collector.newrelic.com/v1/accounts/YOUR_ACCOUNT_ID/events',
                        header: null,
                        attribute: {
                            static: null,
                            dynamic: {
                                butlerSosVersion: {
                                    enable: false,
                                },
                            },
                        },
                    },
                    metric: {
                        destinationAccount: null,
                        url: 'https://metric-api.newrelic.com/metric/v1',
                        header: null,
                        dynamic: {
                            engine: {
                                memory: { enable: false },
                                cpu: { enable: false },
                                calls: { enable: false },
                                selections: { enable: false },
                                sessions: { enable: false },
                                users: { enable: false },
                                saturated: { enable: false },
                            },
                            apps: {
                                docCount: { enable: false },
                                activeDocs: { enable: false },
                                loadedDocs: { enable: false },
                                inMemoryDocs: { enable: false },
                            },
                            cache: {
                                cache: { enable: false },
                            },
                            proxy: {
                                sessions: { enable: false },
                            },
                        },
                        attribute: {
                            static: null,
                            dynamic: {
                                butlerSosVersion: {
                                    enable: false,
                                },
                            },
                        },
                    },
                },
                prometheus: {
                    enable: false,
                    port: 9842,
                },
                influxdbConfig: {
                    enable: false,
                    host: 'localhost',
                    port: 8086,
                    version: 2,
                    v2Config: {
                        org: 'myorg',
                        bucket: 'mybucket',
                        description: 'My bucket',
                        token: 'mytoken',
                        retentionDuration: '30d',
                    },
                    v1Config: {
                        auth: {
                            enable: false,
                            username: 'user',
                            password: 'pass',
                        },
                        dbName: 'mydb',
                        retentionPolicy: {
                            name: 'mypolicy',
                            duration: '30d',
                        },
                    },
                    includeFields: {
                        activeDocs: false,
                        loadedDocs: false,
                        inMemoryDocs: false,
                    },
                },
                appNames: {
                    enableAppNameExtract: false,
                    extractInterval: 21600000,
                    hostIP: '127.0.0.1',
                },
                userSessions: {
                    enableSessionExtract: false,
                    pollingInterval: 60000,
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

        const validate = ajv.compile(configFileSchema);
        const isValid = validate(minimalConfig);

        if (!isValid) {
            console.error('Validation errors:', validate.errors);
        }

        expect(isValid).toBe(true);
    });

    test('should reject configuration missing required Butler-SOS property', () => {
        const invalidConfig = {
            notButlerSOS: {},
        };

        const validate = ajv.compile(configFileSchema);
        const isValid = validate(invalidConfig);

        expect(isValid).toBe(false);
        expect(validate.errors).toContainEqual(
            expect.objectContaining({
                instancePath: '',
                keyword: 'required',
                params: { missingProperty: 'Butler-SOS' },
            })
        );
    });

    test('should reject configuration with additional properties at root level', () => {
        const invalidConfig = {
            'Butler-SOS': {
                logLevel: 'info',
                fileLogging: true,
                logDirectory: './log',
                anonTelemetry: false,
            },
            extraProperty: 'not allowed',
        };

        const validate = ajv.compile(configFileSchema);
        const isValid = validate(invalidConfig);

        expect(isValid).toBe(false);
        expect(validate.errors).toContainEqual(
            expect.objectContaining({
                keyword: 'additionalProperties',
                params: { additionalProperty: 'extraProperty' },
            })
        );
    });

    test('should validate logLevel enum values', () => {
        const validLogLevels = ['error', 'warn', 'info', 'verbose', 'debug', 'silly'];

        validLogLevels.forEach((logLevel) => {
            const config = {
                'Butler-SOS': {
                    logLevel,
                    // Add minimal required properties for testing
                    fileLogging: true,
                    logDirectory: './log',
                    anonTelemetry: false,
                },
            };

            const validate = ajv.compile(configFileSchema);
            const isValid = validate(config);

            if (!isValid) {
                console.error(`Failed for logLevel ${logLevel}:`, validate.errors);
            }

            // Note: This will fail because other required properties are missing
            // but we're specifically testing that logLevel validation passes
            const logLevelErrors = validate.errors?.filter(
                (error) => error.instancePath === '/Butler-SOS/logLevel'
            );
            expect(logLevelErrors || []).toHaveLength(0);
        });
    });

    test('should reject invalid logLevel values', () => {
        const config = {
            'Butler-SOS': {
                logLevel: 'invalid',
                fileLogging: true,
                logDirectory: './log',
                anonTelemetry: false,
            },
        };

        const validate = ajv.compile(configFileSchema);
        const isValid = validate(config);

        expect(isValid).toBe(false);
        expect(validate.errors).toContainEqual(
            expect.objectContaining({
                instancePath: '/Butler-SOS/logLevel',
                keyword: 'enum',
            })
        );
    });

    test('should have all required properties defined in schema', () => {
        const requiredProperties = [
            'logLevel',
            'fileLogging',
            'logDirectory',
            'anonTelemetry',
            'configVisualisation',
            'heartbeat',
            'dockerHealthCheck',
            'uptimeMonitor',
            'thirdPartyToolsCredentials',
            'qlikSenseEvents',
            'userEvents',
            'logEvents',
            'cert',
            'mqttConfig',
            'newRelic',
            'prometheus',
            'influxdbConfig',
            'appNames',
            'userSessions',
            'serversToMonitor',
        ];

        const schemaRequired = configFileSchema.properties['Butler-SOS'].required;

        requiredProperties.forEach((prop) => {
            expect(schemaRequired).toContain(prop);
        });
    });

    test('should have properties defined for all required fields', () => {
        const requiredProperties = configFileSchema.properties['Butler-SOS'].required;
        const schemaProperties = configFileSchema.properties['Butler-SOS'].properties;

        requiredProperties.forEach((prop) => {
            expect(schemaProperties[prop]).toBeDefined();
        });
    });
});
