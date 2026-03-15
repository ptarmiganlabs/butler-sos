/**
 * Schema definition for Butler SOS monitoring services configuration.
 *
 * This schema covers configuration for various monitoring and health check services:
 * - Config visualization web interface
 * - Heartbeat monitoring to external URLs
 * - Docker health check endpoint
 * - Uptime monitoring with InfluxDB and New Relic integration
 *
 * @type {object} JSON Schema object for monitoring services validation
 */
export const monitoringServicesSchema = {
    configVisualisation: {
        type: 'object',
        properties: {
            enable: { type: 'boolean' },
            host: {
                type: 'string',
                format: 'hostname',
            },
            port: { type: 'number' },
            obfuscate: { type: 'boolean' },
        },
        required: ['enable', 'host', 'port', 'obfuscate'],
        additionalProperties: false,
    },
    heartbeat: {
        type: 'object',
        properties: {
            enable: { type: 'boolean' },
            remoteURL: {
                type: 'string',
                format: 'uri',
            },
            frequency: { type: 'string' },
        },
        required: ['enable', 'remoteURL', 'frequency'],
        additionalProperties: false,
    },
    dockerHealthCheck: {
        type: 'object',
        properties: {
            enable: { type: 'boolean' },
            port: { type: 'number' },
        },
        required: ['enable', 'port'],
        additionalProperties: false,
    },
    uptimeMonitor: {
        type: 'object',
        properties: {
            enable: { type: 'boolean' },
            frequency: { type: 'string' },
            logLevel: {
                type: 'string',
                enum: ['error', 'warn', 'info', 'verbose', 'debug', 'silly'],
                transform: ['trim', 'toLowerCase'],
            },
            storeInInfluxdb: {
                type: 'object',
                properties: {
                    butlerSOSMemoryUsage: { type: 'boolean' },
                    instanceTag: { type: 'string' },
                },
                required: ['butlerSOSMemoryUsage', 'instanceTag'],
                additionalProperties: false,
            },
            storeNewRelic: {
                type: 'object',
                properties: {
                    enable: { type: 'boolean' },
                    destinationAccount: {
                        type: ['array', 'null'],
                        minItems: 0,
                        items: {
                            type: 'string',
                        },
                    },
                    metric: {
                        type: 'object',
                        properties: {
                            dynamic: {
                                type: 'object',
                                properties: {
                                    butlerMemoryUsage: {
                                        type: 'object',
                                        properties: {
                                            enable: { type: 'boolean' },
                                        },
                                        required: ['enable'],
                                        additionalProperties: false,
                                    },
                                    butlerUptime: {
                                        type: 'object',
                                        properties: {
                                            enable: { type: 'boolean' },
                                        },
                                        required: ['enable'],
                                        additionalProperties: false,
                                    },
                                },
                                required: ['butlerMemoryUsage', 'butlerUptime'],
                                additionalProperties: false,
                            },
                        },
                        required: ['dynamic'],
                        additionalProperties: false,
                    },
                    attribute: {
                        type: 'object',
                        properties: {
                            static: {
                                type: 'array',
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
                                    butlerVersion: {
                                        type: 'object',
                                        properties: {
                                            enable: { type: 'boolean' },
                                        },
                                        required: ['enable'],
                                        additionalProperties: false,
                                    },
                                },
                                required: ['butlerVersion'],
                                additionalProperties: false,
                            },
                        },
                        required: ['static', 'dynamic'],
                    },
                },
                required: ['enable', 'destinationAccount', 'metric', 'attribute'],
                additionalProperties: false,
            },
        },
        required: ['enable', 'frequency', 'logLevel', 'storeInInfluxdb', 'storeNewRelic'],
        additionalProperties: false,
    },
};
