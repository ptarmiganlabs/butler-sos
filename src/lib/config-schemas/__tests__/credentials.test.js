import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import Ajv from 'ajv';
import addKeywords from 'ajv-keywords';
import addFormats from 'ajv-formats';
import { credentialsSchema } from '../credentials.js';

describe('credentials schema', () => {
    let ajv;

    beforeEach(() => {
        ajv = new Ajv({
            strict: true,
            allErrors: true,
            allowUnionTypes: true,
        });
        addKeywords(ajv, ['transform']);
        addFormats(ajv);
    });

    test('should export a valid schema object', () => {
        expect(credentialsSchema).toBeDefined();
        expect(typeof credentialsSchema).toBe('object');
        expect(credentialsSchema.thirdPartyToolsCredentials).toBeDefined();
        expect(credentialsSchema.cert).toBeDefined();
    });

    describe('thirdPartyToolsCredentials property', () => {
        test('should accept valid New Relic credentials array', () => {
            const schema = {
                type: 'object',
                properties: {
                    thirdPartyToolsCredentials: credentialsSchema.thirdPartyToolsCredentials,
                },
            };

            const validate = ajv.compile(schema);

            const validConfig = {
                thirdPartyToolsCredentials: {
                    newRelic: [
                        {
                            accountName: 'Test Account',
                            insertApiKey: 'test-api-key-123',
                            accountId: '12345',
                        },
                    ],
                },
            };

            expect(validate(validConfig)).toBe(true);
        });

        test('should accept empty New Relic credentials array', () => {
            const schema = {
                type: 'object',
                properties: {
                    thirdPartyToolsCredentials: credentialsSchema.thirdPartyToolsCredentials,
                },
            };

            const validate = ajv.compile(schema);

            const validConfig = {
                thirdPartyToolsCredentials: {
                    newRelic: [],
                },
            };

            expect(validate(validConfig)).toBe(true);
        });

        test('should accept null New Relic credentials', () => {
            const schema = {
                type: 'object',
                properties: {
                    thirdPartyToolsCredentials: credentialsSchema.thirdPartyToolsCredentials,
                },
            };

            const validate = ajv.compile(schema);

            const validConfig = {
                thirdPartyToolsCredentials: {
                    newRelic: null,
                },
            };

            expect(validate(validConfig)).toBe(true);
        });

        test('should reject New Relic credentials missing required properties', () => {
            const schema = {
                type: 'object',
                properties: {
                    thirdPartyToolsCredentials: credentialsSchema.thirdPartyToolsCredentials,
                },
            };

            const validate = ajv.compile(schema);

            const invalidConfigs = [
                {
                    thirdPartyToolsCredentials: {
                        newRelic: [
                            {
                                accountName: 'Test Account',
                                // missing insertApiKey and accountId
                            },
                        ],
                    },
                },
                {
                    thirdPartyToolsCredentials: {
                        newRelic: [
                            {
                                insertApiKey: 'test-api-key-123',
                                accountId: '12345',
                                // missing accountName
                            },
                        ],
                    },
                },
            ];

            invalidConfigs.forEach((config) => {
                expect(validate(config)).toBe(false);
            });
        });

        test('should reject additional properties in New Relic credentials', () => {
            const schema = {
                type: 'object',
                properties: {
                    thirdPartyToolsCredentials: credentialsSchema.thirdPartyToolsCredentials,
                },
            };

            const validate = ajv.compile(schema);

            const invalidConfig = {
                thirdPartyToolsCredentials: {
                    newRelic: [
                        {
                            accountName: 'Test Account',
                            insertApiKey: 'test-api-key-123',
                            accountId: '12345',
                            extraProperty: 'not allowed',
                        },
                    ],
                },
            };

            expect(validate(invalidConfig)).toBe(false);
        });

        test('should reject missing newRelic property', () => {
            const schema = {
                type: 'object',
                properties: {
                    thirdPartyToolsCredentials: credentialsSchema.thirdPartyToolsCredentials,
                },
            };

            const validate = ajv.compile(schema);

            const invalidConfig = {
                thirdPartyToolsCredentials: {
                    // missing newRelic property
                },
            };

            expect(validate(invalidConfig)).toBe(false);
        });
    });

    describe('cert property', () => {
        test('should accept valid certificate configuration', () => {
            const schema = {
                type: 'object',
                properties: { cert: credentialsSchema.cert },
            };

            const validate = ajv.compile(schema);

            const validConfig = {
                cert: {
                    clientCert: '/path/to/client.pem',
                    clientCertKey: '/path/to/client-key.pem',
                    clientCertCA: '/path/to/ca.pem',
                    clientCertPassphrase: 'secret123',
                },
            };

            expect(validate(validConfig)).toBe(true);
        });

        test('should accept null clientCertPassphrase', () => {
            const schema = {
                type: 'object',
                properties: { cert: credentialsSchema.cert },
            };

            const validate = ajv.compile(schema);

            const validConfig = {
                cert: {
                    clientCert: '/path/to/client.pem',
                    clientCertKey: '/path/to/client-key.pem',
                    clientCertCA: '/path/to/ca.pem',
                    clientCertPassphrase: null,
                },
            };

            expect(validate(validConfig)).toBe(true);
        });

        test('should accept configuration without clientCertPassphrase', () => {
            const schema = {
                type: 'object',
                properties: { cert: credentialsSchema.cert },
            };

            const validate = ajv.compile(schema);

            const validConfig = {
                cert: {
                    clientCert: '/path/to/client.pem',
                    clientCertKey: '/path/to/client-key.pem',
                    clientCertCA: '/path/to/ca.pem',
                },
            };

            expect(validate(validConfig)).toBe(true);
        });

        test('should reject certificate configuration missing required properties', () => {
            const schema = {
                type: 'object',
                properties: { cert: credentialsSchema.cert },
            };

            const validate = ajv.compile(schema);

            const invalidConfigs = [
                {
                    cert: {
                        clientCertKey: '/path/to/client-key.pem',
                        clientCertCA: '/path/to/ca.pem',
                        // missing clientCert
                    },
                },
                {
                    cert: {
                        clientCert: '/path/to/client.pem',
                        clientCertCA: '/path/to/ca.pem',
                        // missing clientCertKey
                    },
                },
                {
                    cert: {
                        clientCert: '/path/to/client.pem',
                        clientCertKey: '/path/to/client-key.pem',
                        // missing clientCertCA
                    },
                },
            ];

            invalidConfigs.forEach((config) => {
                expect(validate(config)).toBe(false);
            });
        });

        test('should reject additional properties in cert configuration', () => {
            const schema = {
                type: 'object',
                properties: { cert: credentialsSchema.cert },
            };

            const validate = ajv.compile(schema);

            const invalidConfig = {
                cert: {
                    clientCert: '/path/to/client.pem',
                    clientCertKey: '/path/to/client-key.pem',
                    clientCertCA: '/path/to/ca.pem',
                    extraProperty: 'not allowed',
                },
            };

            expect(validate(invalidConfig)).toBe(false);
        });

        test('should reject non-string certificate paths', () => {
            const schema = {
                type: 'object',
                properties: { cert: credentialsSchema.cert },
            };

            const validate = ajv.compile(schema);

            const invalidConfig = {
                cert: {
                    clientCert: 123,
                    clientCertKey: '/path/to/client-key.pem',
                    clientCertCA: '/path/to/ca.pem',
                },
            };

            expect(validate(invalidConfig)).toBe(false);
        });
    });

    test('should validate complete credentials object', () => {
        const schema = {
            type: 'object',
            properties: credentialsSchema,
            required: ['thirdPartyToolsCredentials', 'cert'],
        };

        const validate = ajv.compile(schema);

        const validConfig = {
            thirdPartyToolsCredentials: {
                newRelic: [
                    {
                        accountName: 'Production Account',
                        insertApiKey: 'prod-api-key-456',
                        accountId: '67890',
                    },
                ],
            },
            cert: {
                clientCert: '/path/to/client.pem',
                clientCertKey: '/path/to/client-key.pem',
                clientCertCA: '/path/to/ca.pem',
                clientCertPassphrase: 'secret123',
            },
        };

        expect(validate(validConfig)).toBe(true);
    });
});
