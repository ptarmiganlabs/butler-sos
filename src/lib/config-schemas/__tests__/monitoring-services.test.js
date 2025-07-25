import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import Ajv from 'ajv';
import addKeywords from 'ajv-keywords';
import addFormats from 'ajv-formats';
import { monitoringServicesSchema } from '../monitoring-services.js';

describe('monitoring-services schema', () => {
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
        expect(monitoringServicesSchema).toBeDefined();
        expect(typeof monitoringServicesSchema).toBe('object');
        expect(monitoringServicesSchema.configVisualisation).toBeDefined();
        expect(monitoringServicesSchema.heartbeat).toBeDefined();
        expect(monitoringServicesSchema.dockerHealthCheck).toBeDefined();
        expect(monitoringServicesSchema.uptimeMonitor).toBeDefined();
    });

    describe('configVisualisation property', () => {
        test('should accept valid config visualisation configuration', () => {
            const schema = {
                type: 'object',
                properties: { configVisualisation: monitoringServicesSchema.configVisualisation },
            };

            const validate = ajv.compile(schema);

            const validConfig = {
                configVisualisation: {
                    enable: true,
                    host: 'localhost',
                    port: 8080,
                    obfuscate: true,
                },
            };

            expect(validate(validConfig)).toBe(true);
        });

        test('should reject config visualisation missing required properties', () => {
            const schema = {
                type: 'object',
                properties: { configVisualisation: monitoringServicesSchema.configVisualisation },
            };

            const validate = ajv.compile(schema);

            const invalidConfig = {
                configVisualisation: {
                    enable: true,
                    host: 'localhost',
                    // missing port and obfuscate
                },
            };

            expect(validate(invalidConfig)).toBe(false);
        });

        test('should validate host as hostname format', () => {
            const schema = {
                type: 'object',
                properties: { configVisualisation: monitoringServicesSchema.configVisualisation },
            };

            const validate = ajv.compile(schema);

            const validConfig = {
                configVisualisation: {
                    enable: true,
                    host: 'example.com',
                    port: 8080,
                    obfuscate: false,
                },
            };

            expect(validate(validConfig)).toBe(true);
        });
    });

    describe('heartbeat property', () => {
        test('should accept valid heartbeat configuration', () => {
            const schema = {
                type: 'object',
                properties: { heartbeat: monitoringServicesSchema.heartbeat },
            };

            const validate = ajv.compile(schema);

            const validConfig = {
                heartbeat: {
                    enable: true,
                    remoteURL: 'https://example.com/heartbeat',
                    frequency: '30 seconds',
                },
            };

            expect(validate(validConfig)).toBe(true);
        });

        test('should validate remoteURL as URI format', () => {
            const schema = {
                type: 'object',
                properties: { heartbeat: monitoringServicesSchema.heartbeat },
            };

            const validate = ajv.compile(schema);

            const invalidConfig = {
                heartbeat: {
                    enable: true,
                    remoteURL: 'not a valid url',
                    frequency: '30 seconds',
                },
            };

            expect(validate(invalidConfig)).toBe(false);
        });

        test('should reject additional properties', () => {
            const schema = {
                type: 'object',
                properties: { heartbeat: monitoringServicesSchema.heartbeat },
            };

            const validate = ajv.compile(schema);

            const invalidConfig = {
                heartbeat: {
                    enable: true,
                    remoteURL: 'https://example.com/heartbeat',
                    frequency: '30 seconds',
                    extraProperty: 'not allowed',
                },
            };

            expect(validate(invalidConfig)).toBe(false);
        });
    });

    describe('dockerHealthCheck property', () => {
        test('should accept valid docker health check configuration', () => {
            const schema = {
                type: 'object',
                properties: { dockerHealthCheck: monitoringServicesSchema.dockerHealthCheck },
            };

            const validate = ajv.compile(schema);

            const validConfig = {
                dockerHealthCheck: {
                    enable: true,
                    port: 12398,
                },
            };

            expect(validate(validConfig)).toBe(true);
        });

        test('should reject non-numeric port', () => {
            const schema = {
                type: 'object',
                properties: { dockerHealthCheck: monitoringServicesSchema.dockerHealthCheck },
            };

            const validate = ajv.compile(schema);

            const invalidConfig = {
                dockerHealthCheck: {
                    enable: true,
                    port: 'not a number',
                },
            };

            expect(validate(invalidConfig)).toBe(false);
        });
    });

    describe('uptimeMonitor property', () => {
        test('should accept valid uptime monitor configuration', () => {
            const schema = {
                type: 'object',
                properties: { uptimeMonitor: monitoringServicesSchema.uptimeMonitor },
            };

            const validate = ajv.compile(schema);

            const validConfig = {
                uptimeMonitor: {
                    enable: true,
                    frequency: '30 seconds',
                    logLevel: 'info',
                    storeInInfluxdb: {
                        butlerSOSMemoryUsage: true,
                        instanceTag: 'production',
                    },
                    storeNewRelic: {
                        enable: true,
                        destinationAccount: ['account1', 'account2'],
                        metric: {
                            dynamic: {
                                butlerMemoryUsage: {
                                    enable: true,
                                },
                                butlerUptime: {
                                    enable: true,
                                },
                            },
                        },
                        attribute: {
                            static: [
                                {
                                    name: 'environment',
                                    value: 'production',
                                },
                            ],
                            dynamic: {
                                butlerVersion: {
                                    enable: true,
                                },
                            },
                        },
                    },
                },
            };

            expect(validate(validConfig)).toBe(true);
        });

        test('should accept null destinationAccount', () => {
            const schema = {
                type: 'object',
                properties: { uptimeMonitor: monitoringServicesSchema.uptimeMonitor },
            };

            const validate = ajv.compile(schema);

            const validConfig = {
                uptimeMonitor: {
                    enable: false,
                    frequency: '30 seconds',
                    logLevel: 'info',
                    storeInInfluxdb: {
                        butlerSOSMemoryUsage: false,
                        instanceTag: 'test',
                    },
                    storeNewRelic: {
                        enable: false,
                        destinationAccount: null,
                        metric: {
                            dynamic: {
                                butlerMemoryUsage: {
                                    enable: false,
                                },
                                butlerUptime: {
                                    enable: false,
                                },
                            },
                        },
                        attribute: {
                            static: [],
                            dynamic: {
                                butlerVersion: {
                                    enable: false,
                                },
                            },
                        },
                    },
                },
            };

            expect(validate(validConfig)).toBe(true);
        });

        test('should validate logLevel enum values', () => {
            const schema = {
                type: 'object',
                properties: { uptimeMonitor: monitoringServicesSchema.uptimeMonitor },
            };

            const validate = ajv.compile(schema);

            const validLogLevels = ['error', 'warn', 'info', 'verbose', 'debug', 'silly'];

            validLogLevels.forEach((logLevel) => {
                const config = {
                    uptimeMonitor: {
                        enable: true,
                        frequency: '30 seconds',
                        logLevel,
                        storeInInfluxdb: {
                            butlerSOSMemoryUsage: true,
                            instanceTag: 'test',
                        },
                        storeNewRelic: {
                            enable: false,
                            destinationAccount: null,
                            metric: {
                                dynamic: {
                                    butlerMemoryUsage: { enable: false },
                                    butlerUptime: { enable: false },
                                },
                            },
                            attribute: {
                                static: [],
                                dynamic: {
                                    butlerVersion: { enable: false },
                                },
                            },
                        },
                    },
                };

                expect(validate(config)).toBe(true);
            });
        });

        test('should reject invalid logLevel', () => {
            const schema = {
                type: 'object',
                properties: { uptimeMonitor: monitoringServicesSchema.uptimeMonitor },
            };

            const validate = ajv.compile(schema);

            const invalidConfig = {
                uptimeMonitor: {
                    enable: true,
                    frequency: '30 seconds',
                    logLevel: 'invalid',
                    storeInInfluxdb: {
                        butlerSOSMemoryUsage: true,
                        instanceTag: 'test',
                    },
                    storeNewRelic: {
                        enable: false,
                        destinationAccount: null,
                        metric: {
                            dynamic: {
                                butlerMemoryUsage: { enable: false },
                                butlerUptime: { enable: false },
                            },
                        },
                        attribute: {
                            static: [],
                            dynamic: {
                                butlerVersion: { enable: false },
                            },
                        },
                    },
                },
            };

            expect(validate(invalidConfig)).toBe(false);
        });
    });

    test('should validate complete monitoring services object', () => {
        const schema = {
            type: 'object',
            properties: monitoringServicesSchema,
            required: ['configVisualisation', 'heartbeat', 'dockerHealthCheck', 'uptimeMonitor'],
        };

        const validate = ajv.compile(schema);

        const validConfig = {
            configVisualisation: {
                enable: false,
                host: 'localhost',
                port: 8080,
                obfuscate: true,
            },
            heartbeat: {
                enable: false,
                remoteURL: 'https://example.com/heartbeat',
                frequency: '30 seconds',
            },
            dockerHealthCheck: {
                enable: false,
                port: 12398,
            },
            uptimeMonitor: {
                enable: false,
                frequency: '30 seconds',
                logLevel: 'info',
                storeInInfluxdb: {
                    butlerSOSMemoryUsage: false,
                    instanceTag: 'test',
                },
                storeNewRelic: {
                    enable: false,
                    destinationAccount: null,
                    metric: {
                        dynamic: {
                            butlerMemoryUsage: { enable: false },
                            butlerUptime: { enable: false },
                        },
                    },
                    attribute: {
                        static: [],
                        dynamic: {
                            butlerVersion: { enable: false },
                        },
                    },
                },
            },
        };

        expect(validate(validConfig)).toBe(true);
    });
});
