/**
 * Schema definition for Butler SOS user events configuration.
 *
 * This schema covers configuration for handling Qlik Sense user events:
 * - User activity tracking and exclusions
 * - UDP server configuration for receiving events
 * - MQTT, InfluxDB, and New Relic integration for event forwarding
 * - Event tagging and filtering
 *
 * @type {object} JSON Schema object for user events validation
 */
export const userEventsSchema = {
    userEvents: {
        type: 'object',
        properties: {
            enable: { type: 'boolean' },
            excludeUser: {
                type: ['array', 'null'],
                items: {
                    type: 'object',
                    properties: {
                        directory: { type: 'string' },
                        userId: { type: 'string' },
                    },
                    required: ['directory', 'userId'],
                    additionalProperties: false,
                },
            },
            udpServerConfig: {
                type: 'object',
                properties: {
                    serverHost: {
                        type: 'string',
                        format: 'hostname',
                    },
                    portUserActivityEvents: { type: 'number' },
                    messageQueue: {
                        type: 'object',
                        properties: {
                            maxConcurrent: { type: 'number', default: 10 },
                            maxSize: { type: 'number', default: 200 },
                            dropStrategy: {
                                type: 'string',
                                enum: ['oldest', 'newest'],
                                default: 'oldest',
                            },
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
                    maxMessageSize: { type: 'number', default: 65507 },
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
                                        default: 'user_events_queue',
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
                required: [
                    'serverHost',
                    'portUserActivityEvents',
                    'messageQueue',
                    'rateLimit',
                    'maxMessageSize',
                    'queueMetrics',
                ],
                additionalProperties: false,
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
            sendToMQTT: {
                type: 'object',
                properties: {
                    enable: { type: 'boolean' },
                    postTo: {
                        type: 'object',
                        properties: {
                            everythingTopic: {
                                type: 'object',
                                properties: {
                                    enable: { type: 'boolean' },
                                    topic: { type: 'string' },
                                },
                                required: ['enable', 'topic'],
                                additionalProperties: false,
                            },
                            sessionStartTopic: {
                                type: 'object',
                                properties: {
                                    enable: { type: 'boolean' },
                                    topic: { type: 'string' },
                                },
                                required: ['enable', 'topic'],
                                additionalProperties: false,
                            },
                            sessionStopTopic: {
                                type: 'object',
                                properties: {
                                    enable: { type: 'boolean' },
                                    topic: { type: 'string' },
                                },
                                required: ['enable', 'topic'],
                                additionalProperties: false,
                            },
                            connectionOpenTopic: {
                                type: 'object',
                                properties: {
                                    enable: { type: 'boolean' },
                                    topic: { type: 'string' },
                                },
                                required: ['enable', 'topic'],
                                additionalProperties: false,
                            },
                            connectionCloseTopic: {
                                type: 'object',
                                properties: {
                                    enable: { type: 'boolean' },
                                    topic: { type: 'string' },
                                },
                                required: ['enable', 'topic'],
                                additionalProperties: false,
                            },
                        },
                        required: [
                            'everythingTopic',
                            'sessionStartTopic',
                            'sessionStopTopic',
                            'connectionOpenTopic',
                            'connectionCloseTopic',
                        ],
                        additionalProperties: false,
                    },
                },
                required: ['enable', 'postTo'],
                additionalProperties: false,
            },
            sendToInfluxdb: {
                type: 'object',
                properties: {
                    enable: { type: 'boolean' },
                },
                required: ['enable'],
                additionalProperties: false,
            },
            sendToNewRelic: {
                type: 'object',
                properties: {
                    enable: { type: 'boolean' },
                    destinationAccount: {
                        type: ['array', 'null'],
                        items: {
                            type: 'string',
                        },
                    },
                    scramble: { type: 'boolean' },
                },
                required: ['enable', 'destinationAccount', 'scramble'],
                additionalProperties: false,
            },
        },
        required: ['enable', 'excludeUser', 'udpServerConfig', 'tags'],
        additionalProperties: false,
    },
};
