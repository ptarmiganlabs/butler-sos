import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import Ajv from 'ajv';
import addKeywords from 'ajv-keywords';
import addFormats from 'ajv-formats';
import { destinationsSchema } from '../destinations.js';

describe('destinations schema', () => {
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

    test('should export a valid schema object', () => {
        expect(destinationsSchema).toBeDefined();
        expect(typeof destinationsSchema).toBe('object');
        expect(destinationsSchema.mqttConfig).toBeDefined();
        expect(destinationsSchema.newRelic).toBeDefined();
        expect(destinationsSchema.prometheus).toBeDefined();
        expect(destinationsSchema.influxdbConfig).toBeDefined();
    });

    describe('mqttConfig property', () => {
        test('should accept valid MQTT configuration', () => {
            const schema = {
                type: 'object',
                properties: { mqttConfig: destinationsSchema.mqttConfig },
            };

            const validate = ajv.compile(schema);

            const validConfig = {
                mqttConfig: {
                    enable: true,
                    brokerHost: 'mqtt.example.com',
                    brokerPort: 1883,
                    baseTopic: 'butler-sos',
                },
            };

            expect(validate(validConfig)).toBe(true);
        });

        test('should reject MQTT configuration missing required properties', () => {
            const schema = {
                type: 'object',
                properties: { mqttConfig: destinationsSchema.mqttConfig },
            };

            const validate = ajv.compile(schema);

            const invalidConfigs = [
                {
                    mqttConfig: {
                        brokerHost: 'mqtt.example.com',
                        brokerPort: 1883,
                        baseTopic: 'butler-sos',
                        // missing enable
                    },
                },
                {
                    mqttConfig: {
                        enable: true,
                        brokerPort: 1883,
                        baseTopic: 'butler-sos',
                        // missing brokerHost
                    },
                },
            ];

            invalidConfigs.forEach((config) => {
                expect(validate(config)).toBe(false);
            });
        });

        test('should validate brokerHost as hostname format', () => {
            const schema = {
                type: 'object',
                properties: { mqttConfig: destinationsSchema.mqttConfig },
            };

            const validate = ajv.compile(schema);

            const validHosts = ['localhost', 'mqtt.example.com', '192.168.1.100'];
            const invalidHosts = ['not a host name!', 'host with spaces'];

            validHosts.forEach((host) => {
                const config = {
                    mqttConfig: {
                        enable: true,
                        brokerHost: host,
                        brokerPort: 1883,
                        baseTopic: 'butler-sos',
                    },
                };
                expect(validate(config)).toBe(true);
            });

            invalidHosts.forEach((host) => {
                const config = {
                    mqttConfig: {
                        enable: true,
                        brokerHost: host,
                        brokerPort: 1883,
                        baseTopic: 'butler-sos',
                    },
                };
                expect(validate(config)).toBe(false);
            });
        });

        test('should reject additional properties', () => {
            const schema = {
                type: 'object',
                properties: { mqttConfig: destinationsSchema.mqttConfig },
            };

            const validate = ajv.compile(schema);

            const invalidConfig = {
                mqttConfig: {
                    enable: true,
                    brokerHost: 'mqtt.example.com',
                    brokerPort: 1883,
                    baseTopic: 'butler-sos',
                    extraProperty: 'not allowed',
                },
            };

            expect(validate(invalidConfig)).toBe(false);
        });
    });

    describe('newRelic property', () => {
        test('should accept valid New Relic configuration with enable false', () => {
            const schema = {
                type: 'object',
                properties: { newRelic: destinationsSchema.newRelic },
            };

            const validate = ajv.compile(schema);

            const validConfig = {
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
            };

            const isValid = validate(validConfig);
            if (!isValid) {
                console.error('New Relic validation errors:', validate.errors);
            }
            expect(isValid).toBe(true);
        });

        test('should accept complete New Relic configuration', () => {
            const schema = {
                type: 'object',
                properties: { newRelic: destinationsSchema.newRelic },
            };

            const validate = ajv.compile(schema);

            // This test might need adjustment based on the actual schema structure
            const validConfig = {
                newRelic: {
                    enable: true,
                    event: {
                        url: 'https://insights-collector.newrelic.com/v1/accounts/YOUR_ACCOUNT_ID/events',
                        header: [
                            {
                                name: 'Content-Type',
                                value: 'application/json',
                            },
                        ],
                        attribute: {
                            static: [],
                            dynamic: {
                                butlerSosVersion: {
                                    enable: true,
                                },
                            },
                        },
                    },
                    metric: {
                        destinationAccount: ['test-account'],
                        url: 'https://metric-api.newrelic.com/metric/v1',
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
                            static: null,
                            dynamic: {
                                butlerSosVersion: {
                                    enable: true,
                                },
                            },
                        },
                    },
                },
            };

            const isValid = validate(validConfig);
            if (!isValid) {
                console.error('Complete New Relic validation errors:', validate.errors);
            }
            expect(isValid).toBe(true);
        });
    });

    describe('prometheus property', () => {
        test('should accept valid Prometheus configuration', () => {
            const schema = {
                type: 'object',
                properties: { prometheus: destinationsSchema.prometheus },
            };

            const validate = ajv.compile(schema);

            const validConfig = {
                prometheus: {
                    enable: false,
                    port: 9842,
                },
            };

            expect(validate(validConfig)).toBe(true);
        });
    });

    describe('influxdbConfig property', () => {
        test('should accept valid InfluxDB configuration with enable false', () => {
            const schema = {
                type: 'object',
                properties: { influxdbConfig: destinationsSchema.influxdbConfig },
            };

            const validate = ajv.compile(schema);

            const validConfig = {
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
            };

            expect(validate(validConfig)).toBe(true);
        });
    });

    test('should validate complete destinations object', () => {
        const schema = {
            type: 'object',
            properties: destinationsSchema,
            required: ['mqttConfig', 'newRelic', 'prometheus', 'influxdbConfig'],
        };

        const validate = ajv.compile(schema);

        const validConfig = {
            mqttConfig: {
                enable: false,
                brokerHost: 'localhost',
                brokerPort: 1883,
                baseTopic: 'butler-sos',
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
        };

        expect(validate(validConfig)).toBe(true);
    });
});
