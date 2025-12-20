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
        required: ['enable', 'host', 'port', 'apiToken', 'cors'],
        additionalProperties: false,
    },
};
