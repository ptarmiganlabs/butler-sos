// Server monitoring configuration for Butler-SOS
// This module contains schema definitions for configuring which Qlik Sense servers to monitor
// including polling intervals, server details, user session tracking, and custom tags/headers

const serversToMonitor = {
    type: 'object',
    properties: {
        pollingInterval: { type: 'number' },
        rejectUnauthorized: { type: 'boolean' },
        serverTagsDefinition: {
            type: ['array', 'null'],
            items: {
                type: 'string',
            },
        },
        servers: {
            type: ['array', 'null'],
            items: {
                type: 'object',
                properties: {
                    host: { type: 'string' },
                    serverName: { type: 'string' },
                    serverDescription: { type: 'string' },
                    userSessions: {
                        type: 'object',
                        properties: {
                            enable: { type: 'boolean' },
                            host: { type: 'string' },
                            virtualProxies: {
                                type: ['array'],
                                items: {
                                    type: 'object',
                                    properties: {
                                        virtualProxy: { type: 'string' },
                                    },
                                    required: ['virtualProxy'],
                                    additionalProperties: false,
                                },
                                minItems: 1,
                            },
                        },
                        required: ['enable', 'host', 'virtualProxies'],
                        additionalProperties: false,
                    },
                    serverTags: {
                        type: ['object', 'null'],
                        properties: {},
                        required: [],
                        additionalProperties: true,
                    },
                    headers: {
                        type: ['object', 'null'],
                        properties: {},
                        required: [],
                        additionalProperties: true,
                    },
                },
                required: [
                    'host',
                    'serverName',
                    'serverDescription',
                    'userSessions',
                    'serverTags',
                    'headers',
                ],
                additionalProperties: false,
            },
        },
    },
    required: ['pollingInterval', 'rejectUnauthorized', 'serverTagsDefinition', 'servers'],
    additionalProperties: false,
};

export const serversSchema = {
    serversToMonitor,
};
