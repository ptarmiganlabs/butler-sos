import { jest, describe, test, expect } from '@jest/globals';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import addKeywords from 'ajv-keywords';

import { auditEventsSchema } from '../audit-events.js';

describe('auditEvents schema', () => {
    test('should accept valid auditEvents configuration', () => {
        const ajv = new Ajv({ allErrors: true });
        addFormats(ajv);
        addKeywords(ajv);

        const schema = {
            type: 'object',
            properties: { auditEvents: auditEventsSchema.auditEvents },
            required: ['auditEvents'],
            additionalProperties: false,
        };

        const validate = ajv.compile(schema);

        const validConfig = {
            auditEvents: {
                enable: false,
                host: '0.0.0.0',
                port: 8181,
                apiToken: 'test-token',
                cors: {
                    allowedOrigins: ['https://qliksense.company.com'],
                },
            },
        };

        const ok = validate(validConfig);
        if (!ok) {
            // Helpful during failures
            // eslint-disable-next-line no-console
            console.error(validate.errors);
        }
        expect(ok).toBe(true);
    });

    test('should reject missing required properties', () => {
        const ajv = new Ajv({ allErrors: true });
        addFormats(ajv);
        addKeywords(ajv);

        const schema = {
            type: 'object',
            properties: { auditEvents: auditEventsSchema.auditEvents },
            required: ['auditEvents'],
            additionalProperties: false,
        };

        const validate = ajv.compile(schema);

        const invalidConfig = {
            auditEvents: {
                enable: true,
            },
        };

        expect(validate(invalidConfig)).toBe(false);
    });
});
