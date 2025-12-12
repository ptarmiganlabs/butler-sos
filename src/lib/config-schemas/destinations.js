// Destination system configurations for Butler-SOS
// This module contains schema definitions for various destination systems where Butler-SOS can send data:
// - MQTT broker configuration for message publishing
// - New Relic integration for events and metrics
// - Prometheus metrics endpoint configuration
// - InfluxDB time-series database configuration (both v1 and v2)

export const destinationsSchema = {
    mqttConfig: {
        type: 'object',
        properties: {
            enable: { type: 'boolean' },
            brokerHost: {
                type: 'string',
                format: 'hostname',
            },
            brokerPort: { type: 'number' },
            baseTopic: { type: 'string' },
        },
        required: ['enable', 'brokerHost', 'brokerPort', 'baseTopic'],
        additionalProperties: false,
    },
    newRelic: {
        type: 'object',
        properties: {
            enable: { type: 'boolean' },
            event: {
                type: 'object',
                properties: {
                    url: {
                        type: 'string',
                        format: 'uri',
                    },
                    header: {
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
                    attribute: {
                        type: 'object',
                        properties: {
                            static: {
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
                            dynamic: {
                                type: 'object',
                                properties: {
                                    butlerSosVersion: {
                                        type: 'object',
                                        properties: {
                                            enable: { type: 'boolean' },
                                        },
                                        required: ['enable'],
                                        additionalProperties: false,
                                    },
                                },
                                required: ['butlerSosVersion'],
                                additionalProperties: false,
                            },
                        },
                        required: ['static', 'dynamic'],
                    },
                },
                required: ['url', 'header', 'attribute'],
                additionalProperties: false,
            },
            metric: {
                type: 'object',
                properties: {
                    destinationAccount: {
                        type: ['array', 'null'],
                        items: {
                            type: 'string',
                        },
                    },
                    url: {
                        type: 'string',
                        format: 'uri',
                    },
                    header: {
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
                    dynamic: {
                        type: 'object',
                        properties: {
                            engine: {
                                type: 'object',
                                properties: {
                                    memory: {
                                        type: 'object',
                                        properties: {
                                            enable: { type: 'boolean' },
                                        },
                                        required: ['enable'],
                                        additionalProperties: false,
                                    },
                                    cpu: {
                                        type: 'object',
                                        properties: {
                                            enable: { type: 'boolean' },
                                        },
                                        required: ['enable'],
                                        additionalProperties: false,
                                    },
                                    calls: {
                                        type: 'object',
                                        properties: {
                                            enable: { type: 'boolean' },
                                        },
                                        required: ['enable'],
                                        additionalProperties: false,
                                    },
                                    selections: {
                                        type: 'object',
                                        properties: {
                                            enable: { type: 'boolean' },
                                        },
                                        required: ['enable'],
                                        additionalProperties: false,
                                    },
                                    sessions: {
                                        type: 'object',
                                        properties: {
                                            enable: { type: 'boolean' },
                                        },
                                        required: ['enable'],
                                        additionalProperties: false,
                                    },
                                    users: {
                                        type: 'object',
                                        properties: {
                                            enable: { type: 'boolean' },
                                        },
                                        required: ['enable'],
                                        additionalProperties: false,
                                    },
                                    saturated: {
                                        type: 'object',
                                        properties: {
                                            enable: { type: 'boolean' },
                                        },
                                        required: ['enable'],
                                        additionalProperties: false,
                                    },
                                },
                                required: [
                                    'memory',
                                    'cpu',
                                    'calls',
                                    'selections',
                                    'sessions',
                                    'users',
                                    'saturated',
                                ],
                                additionalProperties: false,
                            },
                            apps: {
                                type: 'object',
                                properties: {
                                    docCount: {
                                        type: 'object',
                                        properties: {
                                            enable: { type: 'boolean' },
                                        },
                                        required: ['enable'],
                                        additionalProperties: false,
                                    },
                                    activeDocs: {
                                        type: 'object',
                                        properties: {
                                            enable: { type: 'boolean' },
                                        },
                                        required: ['enable'],
                                        additionalProperties: false,
                                    },
                                    loadedDocs: {
                                        type: 'object',
                                        properties: {
                                            enable: { type: 'boolean' },
                                        },
                                        required: ['enable'],
                                        additionalProperties: false,
                                    },
                                    inMemoryDocs: {
                                        type: 'object',
                                        properties: {
                                            enable: { type: 'boolean' },
                                        },
                                        required: ['enable'],
                                        additionalProperties: false,
                                    },
                                },
                                required: ['docCount', 'activeDocs', 'loadedDocs', 'inMemoryDocs'],
                                additionalProperties: false,
                            },
                            cache: {
                                type: 'object',
                                properties: {
                                    cache: {
                                        type: 'object',
                                        properties: {
                                            enable: { type: 'boolean' },
                                        },
                                        required: ['enable'],
                                        additionalProperties: false,
                                    },
                                },
                                required: ['cache'],
                                additionalProperties: false,
                            },
                            proxy: {
                                type: 'object',
                                properties: {
                                    sessions: {
                                        type: 'object',
                                        properties: {
                                            enable: { type: 'boolean' },
                                        },
                                        required: ['enable'],
                                        additionalProperties: false,
                                    },
                                },
                                required: ['sessions'],
                                additionalProperties: false,
                            },
                        },
                        required: ['engine', 'apps', 'cache', 'proxy'],
                        additionalProperties: false,
                    },
                    attribute: {
                        type: 'object',
                        properties: {
                            static: {
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
                            dynamic: {
                                type: 'object',
                                properties: {
                                    butlerSosVersion: {
                                        type: 'object',
                                        properties: {
                                            enable: { type: 'boolean' },
                                        },
                                        required: ['enable'],
                                        additionalProperties: false,
                                    },
                                },
                                required: ['butlerSosVersion'],
                                additionalProperties: false,
                            },
                        },
                        required: ['static', 'dynamic'],
                    },
                },
                required: ['destinationAccount', 'url', 'header', 'dynamic', 'attribute'],
                additionalProperties: false,
            },
        },
        required: ['enable', 'event', 'metric'],
        additionalProperties: false,
    },
    prometheus: {
        type: 'object',
        properties: {
            enable: { type: 'boolean' },
            host: {
                type: 'string',
                format: 'hostname',
            },
            port: { type: 'number' },
        },
        required: ['enable', 'port'],
        additionalProperties: false,
    },
    influxdbConfig: {
        type: 'object',
        properties: {
            enable: { type: 'boolean' },
            host: {
                type: 'string',
                format: 'hostname',
            },
            port: { type: 'number' },
            version: { type: 'number' },
            v3Config: {
                type: 'object',
                properties: {
                    org: { type: 'string' },
                    database: { type: 'string' },
                    description: { type: 'string' },
                    token: { type: 'string' },
                    retentionDuration: { type: 'string' },
                },
                required: ['org', 'database', 'description', 'token', 'retentionDuration'],
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
                required: ['org', 'bucket', 'description', 'token', 'retentionDuration'],
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
            includeFields: {
                type: 'object',
                properties: {
                    activeDocs: { type: 'boolean' },
                    loadedDocs: { type: 'boolean' },
                    inMemoryDocs: { type: 'boolean' },
                },
                required: ['activeDocs', 'loadedDocs', 'inMemoryDocs'],
                additionalProperties: false,
            },
        },
        required: ['enable', 'host', 'port', 'version', 'v2Config', 'v1Config', 'includeFields'],
        additionalProperties: false,
    },
};
