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
                            maxConcurrent: { type: 'number', minimum: 1 },
                            maxSize: { type: 'number', minimum: 1 },
                            dropStrategy: {
                                type: 'string',
                                enum: ['oldest', 'newest'],
                            },
                        },
                        required: ['maxConcurrent', 'maxSize', 'dropStrategy'],
                        additionalProperties: false,
                    },
                    rateLimit: {
                        type: 'object',
                        properties: {
                            enable: { type: 'boolean' },
                            maxMessagesPerMinute: { type: 'number', minimum: 1 },
                            violationLogThrottle: { type: 'number', minimum: 1 },
                        },
                        required: ['enable', 'maxMessagesPerMinute', 'violationLogThrottle'],
                        additionalProperties: false,
                    },
                    maxMessageSize: { type: 'number', minimum: 1, maximum: 65507 },
                    backpressure: {
                        type: 'object',
                        properties: {
                            threshold: { type: 'number', minimum: 1, maximum: 100 },
                        },
                        required: ['threshold'],
                        additionalProperties: false,
                    },
                },
                required: [
                    'serverHost',
                    'portUserActivityEvents',
                    'messageQueue',
                    'rateLimit',
                    'maxMessageSize',
                    'backpressure',
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
