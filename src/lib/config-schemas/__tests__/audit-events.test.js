import { jest, describe, test, expect } from '@jest/globals';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import addKeywords from 'ajv-keywords';

import { auditEventsSchema } from '../audit-events.js';

describe('auditEvents schema', () => {
    test('should accept valid auditEvents configuration', () => {
        const ajv = new Ajv({ allErrors: true });
        addFormats(ajv);
        addKeywords(ajv);

        const schema = {
            type: 'object',
            properties: { auditEvents: auditEventsSchema.auditEvents },
            required: ['auditEvents'],
            additionalProperties: false,
        };

        const validate = ajv.compile(schema);

        const validConfig = {
            auditEvents: {
                enable: false,
                host: '0.0.0.0',
                port: 8181,
                apiToken: 'test-token',
                destination: {
                    enable: false,
                    type: 'influxdb',
                    influxdb: {
                        host: 'localhost',
                        port: 8086,
                        version: 2,
                        maxBatchSize: 1000,
                        writeFrequency: 20000,
                        measurementName: 'audit_event',
                        auditEventSchemaVersion: '1',
                        staticTags: [],
                        v3Config: {
                            database: 'butler_audit',
                            token: 'test-token',
                            retentionDuration: '0s',
                        },
                        v2Config: {
                            org: 'test-org',
                            bucket: 'test-bucket',
                            description: 'Audit events bucket',
                            token: 'test-token',
                            retentionDuration: '0s',
                        },
                        v1Config: {
                            auth: {
                                enable: false,
                                username: '',
                                password: '',
                            },
                            dbName: 'butler_audit',
                            retentionPolicy: {
                                name: 'autogen',
                                duration: '0s',
                            },
                        },
                    },
                },
                queue: {
                    messageQueue: {
                        maxConcurrent: 10,
                        maxSize: 200,
                        backpressureThreshold: 80,
                    },
                    rateLimit: {
                        enable: false,
                        maxMessagesPerMinute: 600,
                    },
                    queueMetrics: {
                        influxdb: {
                            enable: false,
                            writeFrequency: 20000,
                            measurementName: 'audit_events_queue',
                            tags: [],
                        },
                    },
                },
                screenshots: {
                    enable: false,
                    downloadTimeoutMs: 15000,
                    auth: {
                        mode: 'none',
                    },
                    storageTargets: null,
                },
                cors: {
                    allowedOrigins: ['https://qliksense.company.com'],
                },
            },
        };

        const ok = validate(validConfig);
        if (!ok) {
            // Helpful during failures
            // eslint-disable-next-line no-console
            console.error(validate.errors);
        }
        expect(ok).toBe(true);
    });

    test('should accept qpsTicket screenshot auth configuration', () => {
        const ajv = new Ajv({ allErrors: true });
        addFormats(ajv);
        addKeywords(ajv);

        const schema = {
            type: 'object',
            properties: { auditEvents: auditEventsSchema.auditEvents },
            required: ['auditEvents'],
            additionalProperties: false,
        };

        const validate = ajv.compile(schema);

        const validConfig = {
            auditEvents: {
                enable: true,
                host: '0.0.0.0',
                port: 8181,
                apiToken: 'test-token',
                destination: {
                    enable: true,
                    type: 'influxdb',
                    influxdb: {
                        host: 'localhost',
                        port: 8086,
                        version: 2,
                        maxBatchSize: 1000,
                        writeFrequency: 20000,
                        measurementName: 'audit_event',
                        auditEventSchemaVersion: '1',
                        staticTags: [],
                        v3Config: {
                            database: 'butler_audit',
                            token: 'test-token',
                            retentionDuration: '0s',
                        },
                        v2Config: {
                            org: 'test-org',
                            bucket: 'test-bucket',
                            description: 'Audit events bucket',
                            token: 'test-token',
                            retentionDuration: '0s',
                        },
                        v1Config: {
                            auth: {
                                enable: false,
                                username: '',
                                password: '',
                            },
                            dbName: 'butler_audit',
                            retentionPolicy: {
                                name: 'autogen',
                                duration: '0s',
                            },
                        },
                    },
                },
                queue: {
                    messageQueue: {
                        maxConcurrent: 10,
                        maxSize: 200,
                        backpressureThreshold: 80,
                    },
                    rateLimit: {
                        enable: false,
                        maxMessagesPerMinute: 600,
                    },
                    queueMetrics: {
                        influxdb: {
                            enable: false,
                            writeFrequency: 20000,
                            measurementName: 'audit_events_queue',
                            tags: [],
                        },
                    },
                },
                screenshots: {
                    enable: true,
                    downloadTimeoutMs: 15000,
                    auth: {
                        mode: 'qpsTicket',
                        qps: {
                            host: 'qlik.example.com',
                            port: 4243,
                            userDirectory: 'LAB',
                            userId: 'butler-sos',
                            ticketTimeoutMs: 5000,
                        },
                    },
                    storageTargets: null,
                },
                cors: {
                    allowedOrigins: ['https://qliksense.company.com'],
                },
            },
        };

        const ok = validate(validConfig);
        if (!ok) {
            // eslint-disable-next-line no-console
            console.error(validate.errors);
        }
        expect(ok).toBe(true);
    });

    test('should reject audit v3 queryTimeout (not supported)', () => {
        const ajv = new Ajv({ allErrors: true });
        addFormats(ajv);
        addKeywords(ajv);

        const schema = {
            type: 'object',
            properties: { auditEvents: auditEventsSchema.auditEvents },
            required: ['auditEvents'],
            additionalProperties: false,
        };

        const validate = ajv.compile(schema);

        const invalidConfig = {
            auditEvents: {
                enable: true,
                host: '0.0.0.0',
                port: 8181,
                apiToken: 'test-token',
                destination: {
                    enable: true,
                    type: 'influxdb',
                    influxdb: {
                        host: 'localhost',
                        port: 8086,
                        version: 3,
                        maxBatchSize: 1000,
                        writeFrequency: 20000,
                        measurementName: 'audit_event',
                        auditEventSchemaVersion: '1',
                        staticTags: [],
                        v3Config: {
                            database: 'butler_audit',
                            description: 'Audit events database',
                            token: 'test-token',
                            retentionDuration: '0s',
                            queryTimeout: 60000,
                        },
                        v2Config: {
                            org: 'test-org',
                            bucket: 'test-bucket',
                            description: 'Audit events bucket',
                            token: 'test-token',
                            retentionDuration: '0s',
                        },
                        v1Config: {
                            auth: {
                                enable: false,
                                username: '',
                                password: '',
                            },
                            dbName: 'butler_audit',
                            retentionPolicy: {
                                name: 'autogen',
                                duration: '0s',
                            },
                        },
                    },
                },
                queue: {
                    messageQueue: {
                        maxConcurrent: 10,
                        maxSize: 200,
                        backpressureThreshold: 80,
                    },
                    rateLimit: {
                        enable: false,
                        maxMessagesPerMinute: 600,
                    },
                    queueMetrics: {
                        influxdb: {
                            enable: false,
                            writeFrequency: 20000,
                            measurementName: 'audit_events_queue',
                            tags: [],
                        },
                    },
                },
                screenshots: {
                    enable: false,
                    downloadTimeoutMs: 15000,
                    auth: {
                        mode: 'none',
                    },
                    storageTargets: null,
                },
                cors: {
                    allowedOrigins: ['https://qliksense.company.com'],
                },
            },
        };

        const ok = validate(invalidConfig);
        expect(ok).toBe(false);
    });

    test('should reject qpsTicket auth when qps block is missing', () => {
        const ajv = new Ajv({ allErrors: true });
        addFormats(ajv);
        addKeywords(ajv);

        const schema = {
            type: 'object',
            properties: { auditEvents: auditEventsSchema.auditEvents },
            required: ['auditEvents'],
            additionalProperties: false,
        };

        const validate = ajv.compile(schema);

        const invalidConfig = {
            auditEvents: {
                enable: true,
                host: '0.0.0.0',
                port: 8181,
                apiToken: 'test-token',
                queue: {
                    messageQueue: {
                        maxConcurrent: 10,
                        maxSize: 200,
                        backpressureThreshold: 80,
                    },
                    rateLimit: {
                        enable: false,
                        maxMessagesPerMinute: 600,
                    },
                    queueMetrics: {
                        influxdb: {
                            enable: false,
                            writeFrequency: 20000,
                            measurementName: 'audit_events_queue',
                            tags: [],
                        },
                    },
                },
                screenshots: {
                    enable: true,
                    downloadTimeoutMs: 15000,
                    auth: {
                        mode: 'qpsTicket',
                    },
                    storageTargets: null,
                },
                cors: {
                    allowedOrigins: ['https://qliksense.company.com'],
                },
            },
        };

        expect(validate(invalidConfig)).toBe(false);
    });

    test('should require v3Config when destination influxdb version=3', () => {
        const ajv = new Ajv({ allErrors: true });
        addFormats(ajv);
        addKeywords(ajv);

        const schema = {
            type: 'object',
            properties: { auditEvents: auditEventsSchema.auditEvents },
            required: ['auditEvents'],
            additionalProperties: false,
        };

        const validate = ajv.compile(schema);

        const invalidConfig = {
            auditEvents: {
                enable: true,
                host: '0.0.0.0',
                port: 8181,
                apiToken: 'test-token',
                destination: {
                    enable: true,
                    type: 'influxdb',
                    influxdb: {
                        host: 'localhost',
                        port: 8086,
                        version: 3,
                        measurementName: 'audit_event',
                        auditEventSchemaVersion: '1',
                        staticTags: [],
                        v2Config: {
                            org: 'test-org',
                            bucket: 'test-bucket',
                            token: 'test-token',
                            retentionDuration: '0s',
                        },
                        v1Config: {
                            auth: {
                                enable: false,
                                username: '',
                                password: '',
                            },
                            dbName: 'butler_audit',
                            retentionPolicy: {
                                name: 'autogen',
                                duration: '0s',
                            },
                        },
                    },
                },
                queue: {
                    messageQueue: {
                        maxConcurrent: 10,
                        maxSize: 200,
                        backpressureThreshold: 80,
                    },
                    rateLimit: {
                        enable: false,
                        maxMessagesPerMinute: 600,
                    },
                    queueMetrics: {
                        influxdb: {
                            enable: false,
                            writeFrequency: 20000,
                            measurementName: 'audit_events_queue',
                            tags: [],
                        },
                    },
                },
                screenshots: {
                    enable: false,
                    downloadTimeoutMs: 15000,
                    auth: {
                        mode: 'none',
                    },
                    storageTargets: null,
                },
                cors: {
                    allowedOrigins: ['https://qliksense.company.com'],
                },
            },
        };

        expect(validate(invalidConfig)).toBe(false);
    });

    test('should reject missing required properties', () => {
        const ajv = new Ajv({ allErrors: true });
        addFormats(ajv);
        addKeywords(ajv);

        const schema = {
            type: 'object',
            properties: { auditEvents: auditEventsSchema.auditEvents },
            required: ['auditEvents'],
            additionalProperties: false,
        };

        const validate = ajv.compile(schema);

        const invalidConfig = {
            auditEvents: {
                enable: true,
            },
        };

        expect(validate(invalidConfig)).toBe(false);
    });

    test('should require audit v3Config.description when destination enabled and version=3', () => {
        const ajv = new Ajv({ allErrors: true });
        addFormats(ajv);
        addKeywords(ajv);

        const schema = {
            type: 'object',
            properties: { auditEvents: auditEventsSchema.auditEvents },
            required: ['auditEvents'],
            additionalProperties: false,
        };

        const validate = ajv.compile(schema);

        const invalidConfig = {
            auditEvents: {
                enable: true,
                host: '0.0.0.0',
                port: 8181,
                apiToken: 'test-token',
                destination: {
                    enable: true,
                    type: 'influxdb',
                    influxdb: {
                        host: 'localhost',
                        port: 8086,
                        version: 3,
                        maxBatchSize: 1000,
                        writeFrequency: 20000,
                        measurementName: 'audit_event',
                        auditEventSchemaVersion: '1',
                        staticTags: [],
                        v3Config: {
                            database: 'butler_audit',
                            token: 'test-token',
                            retentionDuration: '0s',
                        },
                        v2Config: {
                            org: 'test-org',
                            bucket: 'test-bucket',
                            description: 'Audit events bucket',
                            token: 'test-token',
                            retentionDuration: '0s',
                        },
                        v1Config: {
                            auth: {
                                enable: false,
                                username: '',
                                password: '',
                            },
                            dbName: 'butler_audit',
                            retentionPolicy: {
                                name: 'autogen',
                                duration: '0s',
                            },
                        },
                    },
                },
                queue: {
                    messageQueue: {
                        maxConcurrent: 10,
                        maxSize: 200,
                        backpressureThreshold: 80,
                    },
                    rateLimit: {
                        enable: false,
                        maxMessagesPerMinute: 600,
                    },
                    queueMetrics: {
                        influxdb: {
                            enable: false,
                            writeFrequency: 20000,
                            measurementName: 'audit_events_queue',
                            tags: [],
                        },
                    },
                },
                screenshots: {
                    enable: false,
                    downloadTimeoutMs: 15000,
                    auth: {
                        mode: 'none',
                    },
                    storageTargets: null,
                },
                cors: {
                    allowedOrigins: ['https://qliksense.company.com'],
                },
            },
        };

        expect(validate(invalidConfig)).toBe(false);
    });

    test('should require audit v2Config.description when destination enabled and version=2', () => {
        const ajv = new Ajv({ allErrors: true });
        addFormats(ajv);
        addKeywords(ajv);

        const schema = {
            type: 'object',
            properties: { auditEvents: auditEventsSchema.auditEvents },
            required: ['auditEvents'],
            additionalProperties: false,
        };

        const validate = ajv.compile(schema);

        const invalidConfig = {
            auditEvents: {
                enable: true,
                host: '0.0.0.0',
                port: 8181,
                apiToken: 'test-token',
                destination: {
                    enable: true,
                    type: 'influxdb',
                    influxdb: {
                        host: 'localhost',
                        port: 8086,
                        version: 2,
                        maxBatchSize: 1000,
                        writeFrequency: 20000,
                        measurementName: 'audit_event',
                        auditEventSchemaVersion: '1',
                        staticTags: [],
                        v3Config: {
                            database: 'butler_audit',
                            token: 'test-token',
                            retentionDuration: '0s',
                        },
                        v2Config: {
                            org: 'test-org',
                            bucket: 'test-bucket',
                            token: 'test-token',
                            retentionDuration: '0s',
                        },
                        v1Config: {
                            auth: {
                                enable: false,
                                username: '',
                                password: '',
                            },
                            dbName: 'butler_audit',
                            retentionPolicy: {
                                name: 'autogen',
                                duration: '0s',
                            },
                        },
                    },
                },
                queue: {
                    messageQueue: {
                        maxConcurrent: 10,
                        maxSize: 200,
                        backpressureThreshold: 80,
                    },
                    rateLimit: {
                        enable: false,
                        maxMessagesPerMinute: 600,
                    },
                    queueMetrics: {
                        influxdb: {
                            enable: false,
                            writeFrequency: 20000,
                            measurementName: 'audit_events_queue',
                            tags: [],
                        },
                    },
                },
                screenshots: {
                    enable: false,
                    downloadTimeoutMs: 15000,
                    auth: {
                        mode: 'none',
                    },
                    storageTargets: null,
                },
                cors: {
                    allowedOrigins: ['https://qliksense.company.com'],
                },
            },
        };

        expect(validate(invalidConfig)).toBe(false);
    });
});
