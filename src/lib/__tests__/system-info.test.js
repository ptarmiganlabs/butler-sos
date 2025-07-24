import { jest } from '@jest/globals';
import { confifgFileSchema } from '../config-file-schema.js';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import addKeywords from 'ajv-keywords';

describe('System Information Configuration Schema', () => {
    let ajv;
    
    beforeAll(() => {
        ajv = new Ajv({ strict: false });
        addFormats(ajv);
        addKeywords(ajv);
    });

    test('should validate configuration with systemInfo.enable set to false', () => {
        // Test just the systemInfo part of the schema for simplicity
        const systemInfoSchema = {
            type: 'object',
            properties: {
                systemInfo: confifgFileSchema.properties['Butler-SOS'].properties.systemInfo
            },
            required: ['systemInfo']
        };

        const config = {
            systemInfo: {
                enable: false
            }
        };

        const validate = ajv.compile(systemInfoSchema);
        const isValid = validate(config);
        
        if (!isValid) {
            console.log('Validation errors:', validate.errors);
        }
        
        expect(isValid).toBe(true);
    });

    test('should validate configuration with systemInfo.enable set to true', () => {
        // Test just the systemInfo part of the schema for simplicity
        const systemInfoSchema = {
            type: 'object',
            properties: {
                systemInfo: confifgFileSchema.properties['Butler-SOS'].properties.systemInfo
            },
            required: ['systemInfo']
        };

        const config = {
            systemInfo: {
                enable: true
            }
        };

        const validate = ajv.compile(systemInfoSchema);
        const isValid = validate(config);
        
        expect(isValid).toBe(true);
    });

    test('should fail validation when systemInfo.enable is not a boolean', () => {
        // Test just the systemInfo part of the schema for simplicity
        const systemInfoSchema = {
            type: 'object',
            properties: {
                systemInfo: confifgFileSchema.properties['Butler-SOS'].properties.systemInfo
            },
            required: ['systemInfo']
        };

        const config = {
            systemInfo: {
                enable: 'not-a-boolean'
            }
        };

        const validate = ajv.compile(systemInfoSchema);
        const isValid = validate(config);
        
        expect(isValid).toBe(false);
        expect(validate.errors).toContainEqual(
            expect.objectContaining({
                instancePath: "/systemInfo/enable",
                keyword: "type"
            })
        );
    });

    test('should fail validation when systemInfo is missing enable property', () => {
        // Test just the systemInfo part of the schema for simplicity
        const systemInfoSchema = {
            type: 'object',
            properties: {
                systemInfo: confifgFileSchema.properties['Butler-SOS'].properties.systemInfo
            },
            required: ['systemInfo']
        };

        const config = {
            systemInfo: {}
        };

        const validate = ajv.compile(systemInfoSchema);
        const isValid = validate(config);
        
        expect(isValid).toBe(false);
        expect(validate.errors).toContainEqual(
            expect.objectContaining({
                instancePath: "/systemInfo",
                keyword: "required"
            })
        );
    });
});