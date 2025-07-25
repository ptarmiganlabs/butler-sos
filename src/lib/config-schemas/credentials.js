/**
 * Schema definition for Butler SOS credentials and certificates configuration.
 *
 * This schema covers:
 * - Third-party tool credentials (New Relic API keys)
 * - SSL/TLS certificate paths and configurations
 *
 * @type {object} JSON Schema object for credentials validation
 */
export const credentialsSchema = {
    thirdPartyToolsCredentials: {
        type: 'object',
        properties: {
            newRelic: {
                type: ['array', 'null'],
                items: {
                    type: 'object',
                    properties: {
                        accountName: { type: 'string' },
                        insertApiKey: { type: 'string' },
                        accountId: { type: 'string' },
                    },
                    required: ['accountName', 'insertApiKey', 'accountId'],
                    additionalProperties: false,
                },
            },
        },
        required: ['newRelic'],
        additionalProperties: false,
    },
    cert: {
        type: 'object',
        properties: {
            clientCert: { type: 'string' },
            clientCertKey: { type: 'string' },
            clientCertCA: { type: 'string' },
            clientCertPassphrase: {
                type: ['string', 'null'],
                format: 'password',
            },
        },
        required: ['clientCert', 'clientCertKey', 'clientCertCA'],
        additionalProperties: false,
    },
};
