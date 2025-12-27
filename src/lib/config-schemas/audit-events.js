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
            destination: {
                type: 'object',
                properties: {
                    enable: { type: 'boolean', default: false },
                    type: {
                        type: 'string',
                        enum: ['influxdb'],
                        default: 'influxdb',
                    },
                    influxdb: {
                        type: 'object',
                        properties: {
                            host: {
                                type: 'string',
                                format: 'hostname',
                            },
                            port: { type: 'number' },
                            version: {
                                type: 'number',
                                enum: [1, 2, 3],
                            },
                            maxBatchSize: {
                                type: 'number',
                                default: 1000,
                                minimum: 1,
                                maximum: 10000,
                            },
                            writeFrequency: {
                                type: 'number',
                                default: 20000,
                                minimum: 0,
                            },
                            measurementName: {
                                type: 'string',
                                default: 'audit_event',
                            },
                            auditEventSchemaVersion: {
                                type: 'string',
                                default: '1',
                            },
                            staticTags: {
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
                                default: null,
                            },
                            v3Config: {
                                type: 'object',
                                properties: {
                                    database: { type: 'string' },
                                    description: { type: 'string' },
                                    token: { type: 'string' },
                                    retentionDuration: { type: 'string' },
                                    writeTimeout: {
                                        type: 'number',
                                        default: 10000,
                                        minimum: 1000,
                                    },
                                },
                                required: ['database', 'token', 'retentionDuration'],
                                additionalProperties: false,
                            },
                            v2Config: {
                                type: 'object',
                                properties: {
                                    org: { type: 'string' },
                                    bucket: { type: 'string' },
                                    description: { type: 'string' },
                                    token: { type: 'string' },
                                    retentionDuration: { type: 'string' },
                                },
                                required: ['org', 'bucket', 'token', 'retentionDuration'],
                                additionalProperties: false,
                            },
                            v1Config: {
                                type: 'object',
                                properties: {
                                    auth: {
                                        type: 'object',
                                        properties: {
                                            enable: { type: 'boolean' },
                                            username: { type: 'string' },
                                            password: {
                                                type: 'string',
                                                format: 'password',
                                            },
                                        },
                                        required: ['enable', 'username', 'password'],
                                        additionalProperties: false,
                                    },
                                    dbName: { type: 'string' },
                                    retentionPolicy: {
                                        type: 'object',
                                        properties: {
                                            name: { type: 'string' },
                                            duration: { type: 'string' },
                                        },
                                        required: ['name', 'duration'],
                                        additionalProperties: false,
                                    },
                                },
                                required: ['auth', 'dbName', 'retentionPolicy'],
                                additionalProperties: false,
                            },
                        },
                        required: [
                            'host',
                            'port',
                            'version',
                            'maxBatchSize',
                            'writeFrequency',
                            'measurementName',
                            'auditEventSchemaVersion',
                            'staticTags',
                            'v2Config',
                            'v1Config',
                        ],
                        additionalProperties: false,
                        allOf: [
                            {
                                if: {
                                    type: 'object',
                                    properties: {
                                        version: { const: 3 },
                                    },
                                    required: ['version'],
                                },
                                then: {
                                    type: 'object',
                                    properties: {
                                        v3Config: { type: 'object' },
                                    },
                                    required: ['v3Config'],
                                },
                            },
                        ],
                    },
                },
                required: ['enable', 'type', 'influxdb'],
                additionalProperties: false,
                allOf: [
                    {
                        if: {
                            type: 'object',
                            properties: {
                                enable: { const: true },
                                influxdb: {
                                    type: 'object',
                                    properties: {
                                        version: { const: 2 },
                                    },
                                    required: ['version'],
                                },
                            },
                            required: ['enable', 'influxdb'],
                        },
                        then: {
                            type: 'object',
                            properties: {
                                influxdb: {
                                    type: 'object',
                                    properties: {
                                        v2Config: {
                                            type: 'object',
                                            properties: {
                                                description: { type: 'string', minLength: 1 },
                                            },
                                            required: ['description'],
                                        },
                                    },
                                },
                            },
                        },
                    },
                    {
                        if: {
                            type: 'object',
                            properties: {
                                enable: { const: true },
                                influxdb: {
                                    type: 'object',
                                    properties: {
                                        version: { const: 3 },
                                    },
                                    required: ['version'],
                                },
                            },
                            required: ['enable', 'influxdb'],
                        },
                        then: {
                            type: 'object',
                            properties: {
                                influxdb: {
                                    type: 'object',
                                    properties: {
                                        v3Config: {
                                            type: 'object',
                                            properties: {
                                                description: { type: 'string', minLength: 1 },
                                            },
                                            required: ['description'],
                                        },
                                    },
                                },
                            },
                        },
                    },
                ],
            },
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
                            type: 'object',
                            properties: {
                                enable: { const: true },
                            },
                            required: ['enable'],
                        },
                        then: {
                            type: 'object',
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
                            selectionTxnId: { type: 'boolean', default: false },
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
                                    type: 'object',
                                    properties: {
                                        mode: { const: 'qpsTicket' },
                                    },
                                    required: ['mode'],
                                },
                                then: {
                                    type: 'object',
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
