/**
 * Schema definition for Butler SOS audit events API.
 *
 * This schema defines configuration for the HTTP endpoint that receives audit events
 * from the Qlik Sense audit extension.
 */
export const auditEventsSchema = {
    auditEvents: {
        type: 'object',
        properties: {
            enable: { type: 'boolean' },
            host: { type: 'string' },
            port: { type: 'number' },
            apiToken: { type: 'string' },
            tls: {
                type: 'object',
                properties: {
                    enable: { type: 'boolean', default: false },
                    cert: { type: 'string', minLength: 1 },
                    key: { type: 'string', minLength: 1 },
                    ca: { type: 'string' },
                    passphrase: { type: 'string' },
                },
                required: ['enable'],
                additionalProperties: false,
                allOf: [
                    {
                        if: {
                            properties: {
                                enable: { const: true },
                            },
                            required: ['enable'],
                        },
                        then: {
                            properties: {
                                cert: { type: 'string', minLength: 1 },
                                key: { type: 'string', minLength: 1 },
                            },
                            required: ['cert', 'key'],
                        },
                    },
                ],
            },
            queue: {
                type: 'object',
                properties: {
                    messageQueue: {
                        type: 'object',
                        properties: {
                            maxConcurrent: { type: 'number', default: 10 },
                            maxSize: { type: 'number', default: 200 },
                            backpressureThreshold: { type: 'number', default: 80 },
                        },
                        required: ['maxConcurrent', 'maxSize', 'backpressureThreshold'],
                        additionalProperties: false,
                    },
                    rateLimit: {
                        type: 'object',
                        properties: {
                            enable: { type: 'boolean', default: false },
                            maxMessagesPerMinute: { type: 'number', default: 600 },
                        },
                        required: ['enable', 'maxMessagesPerMinute'],
                        additionalProperties: false,
                    },
                    queueMetrics: {
                        type: 'object',
                        properties: {
                            influxdb: {
                                type: 'object',
                                properties: {
                                    enable: { type: 'boolean', default: false },
                                    writeFrequency: { type: 'number', default: 20000 },
                                    measurementName: {
                                        type: 'string',
                                        default: 'audit_events_queue',
                                    },
                                    tags: {
                                        type: ['array', 'null'],
                                        items: {
                                            type: 'object',
                                            properties: {
                                                name: { type: 'string' },
                                                value: { type: 'string' },
                                            },
                                            required: ['name', 'value'],
                                            additionalProperties: false,
                                        },
                                    },
                                },
                                required: ['enable', 'writeFrequency', 'measurementName', 'tags'],
                                additionalProperties: false,
                            },
                        },
                        required: ['influxdb'],
                        additionalProperties: false,
                    },
                },
                required: ['messageQueue', 'rateLimit', 'queueMetrics'],
                additionalProperties: false,
            },
            screenshots: {
                type: 'object',
                properties: {
                    enable: { type: 'boolean', default: false },
                    downloadTimeoutMs: { type: 'number', default: 15000 },
                    addInImageMetadata: {
                        type: 'object',
                        properties: {
                            date: { type: 'boolean', default: false },
                            eventId: { type: 'boolean', default: false },
                            correlationId: { type: 'boolean', default: false },
                            userId: { type: 'boolean', default: false },
                            appId: { type: 'boolean', default: false },
                            appName: { type: 'boolean', default: false },
                            sheetName: { type: 'boolean', default: false },
                        },
                        additionalProperties: false,
                    },
                    auth: {
                        type: 'object',
                        properties: {
                            mode: {
                                type: 'string',
                                enum: ['none', 'qpsTicket'],
                                default: 'none',
                            },
                            qps: {
                                type: 'object',
                                properties: {
                                    host: { type: 'string', minLength: 1 },
                                    port: { type: 'number', default: 4243 },
                                    userDirectory: { type: 'string', minLength: 1 },
                                    userId: { type: 'string', minLength: 1 },
                                    ticketTimeoutMs: { type: 'number', default: 5000 },
                                },
                                required: [
                                    'host',
                                    'port',
                                    'userDirectory',
                                    'userId',
                                    'ticketTimeoutMs',
                                ],
                                additionalProperties: false,
                            },
                        },
                        required: ['mode'],
                        additionalProperties: false,
                        allOf: [
                            {
                                if: {
                                    properties: {
                                        mode: { const: 'qpsTicket' },
                                    },
                                    required: ['mode'],
                                },
                                then: {
                                    properties: {
                                        qps: { type: 'object' },
                                    },
                                    required: ['qps'],
                                },
                            },
                        ],
                    },
                    storageTargets: {
                        type: ['array', 'null'],
                        items: {
                            type: 'object',
                            properties: {
                                enable: { type: 'boolean', default: false },
                                type: {
                                    type: 'string',
                                    enum: ['flat'],
                                    default: 'flat',
                                },
                                directory: { type: 'string' },
                            },
                            required: ['enable', 'type', 'directory'],
                            additionalProperties: false,
                        },
                    },
                },
                required: ['enable', 'downloadTimeoutMs', 'storageTargets'],
                additionalProperties: false,
            },
            cors: {
                type: 'object',
                properties: {
                    allowedOrigins: {
                        type: 'array',
                        items: { type: 'string' },
                    },
                },
                required: ['allowedOrigins'],
                additionalProperties: false,
            },
        },
        required: ['enable', 'host', 'port', 'apiToken', 'queue', 'cors'],
        additionalProperties: false,
    },
};
