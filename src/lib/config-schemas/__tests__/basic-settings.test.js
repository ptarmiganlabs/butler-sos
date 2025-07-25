import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import Ajv from 'ajv';
import addKeywords from 'ajv-keywords';
import { basicSettingsSchema } from '../basic-settings.js';

describe('basic-settings schema', () => {
    let ajv;

    beforeEach(() => {
        ajv = new Ajv({
            strict: true,
            allErrors: true,
            allowUnionTypes: true,
        });
        addKeywords(ajv, ['transform']);
    });

    test('should export a valid schema object', () => {
        expect(basicSettingsSchema).toBeDefined();
        expect(typeof basicSettingsSchema).toBe('object');
        expect(basicSettingsSchema.logLevel).toBeDefined();
        expect(basicSettingsSchema.fileLogging).toBeDefined();
        expect(basicSettingsSchema.logDirectory).toBeDefined();
        expect(basicSettingsSchema.anonTelemetry).toBeDefined();
        expect(basicSettingsSchema.systemInfo).toBeDefined();
    });

    describe('logLevel property', () => {
        test('should accept valid log levels', () => {
            const validLogLevels = ['error', 'warn', 'info', 'verbose', 'debug', 'silly'];

            validLogLevels.forEach((logLevel) => {
                const schema = {
                    type: 'object',
                    properties: { logLevel: basicSettingsSchema.logLevel },
                };

                const validate = ajv.compile(schema);
                const result = validate({ logLevel });

                if (!result) {
                    console.error(`Failed for logLevel ${logLevel}:`, validate.errors);
                }

                expect(result).toBe(true);
            });
        });

        test('should reject invalid log levels', () => {
            const invalidLogLevels = ['invalid', 'trace', 'fatal'];

            invalidLogLevels.forEach((logLevel) => {
                const schema = {
                    type: 'object',
                    properties: { logLevel: basicSettingsSchema.logLevel },
                };

                const validate = ajv.compile(schema);
                const result = validate({ logLevel });

                expect(result).toBe(false);
            });
        });

        test('should have transform property for trimming', () => {
            expect(basicSettingsSchema.logLevel.transform).toContain('trim');
        });
    });

    describe('fileLogging property', () => {
        test('should accept boolean values', () => {
            const schema = {
                type: 'object',
                properties: { fileLogging: basicSettingsSchema.fileLogging },
            };

            const validate = ajv.compile(schema);

            expect(validate({ fileLogging: true })).toBe(true);
            expect(validate({ fileLogging: false })).toBe(true);
        });

        test('should reject non-boolean values', () => {
            const schema = {
                type: 'object',
                properties: { fileLogging: basicSettingsSchema.fileLogging },
            };

            const validate = ajv.compile(schema);

            expect(validate({ fileLogging: 'true' })).toBe(false);
            expect(validate({ fileLogging: 1 })).toBe(false);
            expect(validate({ fileLogging: null })).toBe(false);
        });
    });

    describe('logDirectory property', () => {
        test('should accept string values', () => {
            const schema = {
                type: 'object',
                properties: { logDirectory: basicSettingsSchema.logDirectory },
            };

            const validate = ajv.compile(schema);

            expect(validate({ logDirectory: './log' })).toBe(true);
            expect(validate({ logDirectory: '/var/log/butler-sos' })).toBe(true);
            expect(validate({ logDirectory: 'log' })).toBe(true);
        });

        test('should reject non-string values', () => {
            const schema = {
                type: 'object',
                properties: { logDirectory: basicSettingsSchema.logDirectory },
            };

            const validate = ajv.compile(schema);

            expect(validate({ logDirectory: 123 })).toBe(false);
            expect(validate({ logDirectory: true })).toBe(false);
            expect(validate({ logDirectory: null })).toBe(false);
        });
    });

    describe('anonTelemetry property', () => {
        test('should accept boolean values', () => {
            const schema = {
                type: 'object',
                properties: { anonTelemetry: basicSettingsSchema.anonTelemetry },
            };

            const validate = ajv.compile(schema);

            expect(validate({ anonTelemetry: true })).toBe(true);
            expect(validate({ anonTelemetry: false })).toBe(true);
        });

        test('should reject non-boolean values', () => {
            const schema = {
                type: 'object',
                properties: { anonTelemetry: basicSettingsSchema.anonTelemetry },
            };

            const validate = ajv.compile(schema);

            expect(validate({ anonTelemetry: 'false' })).toBe(false);
            expect(validate({ anonTelemetry: 0 })).toBe(false);
            expect(validate({ anonTelemetry: null })).toBe(false);
        });
    });

    describe('systemInfo property', () => {
        test('should accept valid systemInfo configuration', () => {
            const schema = {
                type: 'object',
                properties: { systemInfo: basicSettingsSchema.systemInfo },
            };

            const validate = ajv.compile(schema);

            expect(validate({ systemInfo: { enable: true } })).toBe(true);
            expect(validate({ systemInfo: { enable: false } })).toBe(true);
        });

        test('should reject invalid systemInfo configuration', () => {
            const schema = {
                type: 'object',
                properties: { systemInfo: basicSettingsSchema.systemInfo },
            };

            const validate = ajv.compile(schema);

            // Missing enable property
            expect(validate({ systemInfo: {} })).toBe(false);

            // Invalid enable type
            expect(validate({ systemInfo: { enable: 'true' } })).toBe(false);
            expect(validate({ systemInfo: { enable: 1 } })).toBe(false);
            expect(validate({ systemInfo: { enable: null } })).toBe(false);

            // Additional properties not allowed
            expect(validate({ systemInfo: { enable: true, extra: 'value' } })).toBe(false);
        });

        test('should require enable property', () => {
            const schema = {
                type: 'object',
                properties: { systemInfo: basicSettingsSchema.systemInfo },
                required: ['systemInfo'],
            };

            const validate = ajv.compile(schema);

            expect(validate({ systemInfo: { enable: true } })).toBe(true);
            expect(validate({ systemInfo: {} })).toBe(false);
            expect(validate({})).toBe(false);
        });
    });

    test('should validate complete basic settings object', () => {
        const schema = {
            type: 'object',
            properties: basicSettingsSchema,
            required: ['logLevel', 'fileLogging', 'logDirectory', 'anonTelemetry', 'systemInfo'],
        };

        const validate = ajv.compile(schema);

        const validConfig = {
            logLevel: 'info',
            fileLogging: true,
            logDirectory: './log',
            anonTelemetry: false,
            systemInfo: { enable: true },
        };

        expect(validate(validConfig)).toBe(true);
    });
});
