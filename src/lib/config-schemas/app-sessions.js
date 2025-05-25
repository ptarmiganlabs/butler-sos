// Application and user session configuration for Butler-SOS
// This module contains schema definitions for:
// - App names extraction from Qlik Sense
// - User session monitoring and tracking
// These configurations control how Butler-SOS gathers information about applications and user sessions

export const appSessionsSchema = {
    appNames: {
        type: 'object',
        properties: {
            enableAppNameExtract: { type: 'boolean' },
            extractInterval: { type: 'number' },
            hostIP: {
                type: 'string',
                format: 'hostname',
            },
        },
        required: ['enableAppNameExtract', 'extractInterval', 'hostIP'],
        additionalProperties: false,
    },
    userSessions: {
        type: 'object',
        properties: {
            enableSessionExtract: { type: 'boolean' },
            pollingInterval: { type: 'number' },
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
        },
        required: ['enableSessionExtract', 'pollingInterval', 'excludeUser'],
        additionalProperties: false,
    },
};
