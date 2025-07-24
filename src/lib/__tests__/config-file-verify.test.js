import { jest, describe, test, beforeEach, afterEach } from '@jest/globals';

// Mock dependencies
jest.unstable_mockModule('fs/promises', () => ({
    default: {
        readFile: jest.fn(),
    },
}));
const fs = (await import('fs/promises')).default;

jest.unstable_mockModule('js-yaml', () => ({
    load: jest.fn(),
}));
const { load } = await import('js-yaml');

jest.unstable_mockModule('ajv', () => ({
    default: jest.fn(() => ({
        compile: jest.fn(),
    })),
}));
const Ajv = (await import('ajv')).default;

jest.unstable_mockModule('ajv-keywords', () => ({
    default: jest.fn(),
}));

jest.unstable_mockModule('ajv-formats', () => ({
    default: jest.fn(),
}));

jest.unstable_mockModule('../config-file-schema.js', () => ({
    confifgFileSchema: { type: 'object', properties: {} },
}));

// Mock console methods
jest.spyOn(console, 'error').mockImplementation(() => {});
jest.spyOn(console, 'info').mockImplementation(() => {});

// Mock process.exit
const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});

// Import the module under test
const { verifyConfigFileSchema, verifyAppConfig } = await import('../config-file-verify.js');

describe('config-file-verify', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    test('should successfully validate a config file with correct schema', async () => {
        // Mock implementations
        const mockFileContent = 'valid: yaml';
        const mockParsedContent = { valid: 'yaml' };

        fs.readFile.mockResolvedValue(mockFileContent);
        load.mockReturnValue(mockParsedContent);

        // Mock Ajv instance behavior
        const mockValidate = jest.fn().mockReturnValue(true);
        const mockCompile = jest.fn().mockReturnValue(mockValidate);

        // Mock Ajv instance
        Ajv.mockImplementation(() => ({
            compile: mockCompile,
        }));

        const result = await verifyConfigFileSchema('config.yaml');

        // Expectations
        expect(fs.readFile).toHaveBeenCalledWith('config.yaml', 'utf8');
        expect(load).toHaveBeenCalledWith(mockFileContent);
        expect(mockCompile).toHaveBeenCalled();
        expect(mockValidate).toHaveBeenCalledWith(mockParsedContent);
        expect(result).toBe(true);
        expect(console.info).toHaveBeenCalledWith(expect.stringContaining('correctly formatted'));
    });

    test('should handle invalid schema by logging errors and exiting', async () => {
        // Mock implementations
        const mockFileContent = 'invalid: yaml';
        const mockParsedContent = { invalid: 'yaml' };

        fs.readFile.mockResolvedValue(mockFileContent);
        load.mockReturnValue(mockParsedContent);

        // Mock validation errors
        const mockErrors = [
            {
                instancePath: '/somePath',
                schemaPath: '#/properties/somePath/type',
                keyword: 'type',
                params: { type: 'string' },
                message: 'should be string',
            },
        ];

        // Mock Ajv instance behavior
        const mockValidate = jest.fn().mockReturnValue(false);
        mockValidate.errors = mockErrors;

        const mockCompile = jest.fn().mockReturnValue(mockValidate);

        // Mock Ajv instance
        Ajv.mockImplementation(() => ({
            compile: mockCompile,
        }));

        await verifyConfigFileSchema('config.yaml');

        // Expectations
        expect(fs.readFile).toHaveBeenCalledWith('config.yaml', 'utf8');
        expect(load).toHaveBeenCalledWith(mockFileContent);
        expect(mockCompile).toHaveBeenCalled();
        expect(mockValidate).toHaveBeenCalledWith(mockParsedContent);
        expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining('/somePath : should be string')
        );
        expect(mockExit).toHaveBeenCalledWith(1);
    });

    test('should return false when YAML parsing fails', async () => {
        // Mock implementations
        const mockFileContent = 'invalid: : yaml';

        fs.readFile.mockResolvedValue(mockFileContent);
        load.mockImplementation(() => {
            throw new Error('YAML syntax error');
        });

        const result = await verifyConfigFileSchema('config.yaml');

        // Expectations
        expect(fs.readFile).toHaveBeenCalledWith('config.yaml', 'utf8');
        expect(load).toHaveBeenCalledWith(mockFileContent);
        expect(result).toBe(false);
        expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining('Error parsing YAML file')
        );
    });

    test('should handle file reading errors', async () => {
        // Mock file read error
        fs.readFile.mockRejectedValue(new Error('File not found'));

        const result = await verifyConfigFileSchema('config.yaml');

        // Expectations
        expect(fs.readFile).toHaveBeenCalledWith('config.yaml', 'utf8');
        expect(console.error).toHaveBeenCalledWith(expect.stringContaining('File not found'));
        expect(result).toBe(false);
    });
});

describe('verifyAppConfig', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    test('should return true when telemetry is disabled', async () => {
        // Mock config object
        const mockConfig = {
            get: jest.fn((key) => {
                if (key === 'Butler-SOS.anonTelemetry') return false;
                if (key === 'Butler-SOS.systemInfo.enable') return false;
                if (key === 'Butler-SOS.influxdbConfig.enable') return false;
                if (key === 'Butler-SOS.serversToMonitor.serverTagsDefinition') return [];
                if (key === 'Butler-SOS.serversToMonitor.servers') return [];
                return undefined;
            }),
        };

        const result = await verifyAppConfig(mockConfig);

        expect(result).toBe(true);
        expect(console.error).not.toHaveBeenCalled();
    });

    test('should return true when both telemetry and system info are enabled', async () => {
        // Mock config object
        const mockConfig = {
            get: jest.fn((key) => {
                if (key === 'Butler-SOS.anonTelemetry') return true;
                if (key === 'Butler-SOS.systemInfo.enable') return true;
                if (key === 'Butler-SOS.influxdbConfig.enable') return false;
                if (key === 'Butler-SOS.serversToMonitor.serverTagsDefinition') return [];
                if (key === 'Butler-SOS.serversToMonitor.servers') return [];
                return undefined;
            }),
        };

        const result = await verifyAppConfig(mockConfig);

        expect(result).toBe(true);
        expect(console.error).not.toHaveBeenCalled();
    });

    test('should return false when telemetry is enabled but system info is disabled', async () => {
        // Mock config object
        const mockConfig = {
            get: jest.fn((key) => {
                if (key === 'Butler-SOS.anonTelemetry') return true;
                if (key === 'Butler-SOS.systemInfo.enable') return false;
                if (key === 'Butler-SOS.influxdbConfig.enable') return false;
                if (key === 'Butler-SOS.serversToMonitor.serverTagsDefinition') return [];
                if (key === 'Butler-SOS.serversToMonitor.servers') return [];
                return undefined;
            }),
        };

        const result = await verifyAppConfig(mockConfig);

        expect(result).toBe(false);
        expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining('Anonymous telemetry is enabled')
        );
        expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining('system information gathering is disabled')
        );
    });

    test('should return true when both telemetry and system info are disabled', async () => {
        // Mock config object
        const mockConfig = {
            get: jest.fn((key) => {
                if (key === 'Butler-SOS.anonTelemetry') return false;
                if (key === 'Butler-SOS.systemInfo.enable') return false;
                if (key === 'Butler-SOS.influxdbConfig.enable') return false;
                if (key === 'Butler-SOS.serversToMonitor.serverTagsDefinition') return [];
                if (key === 'Butler-SOS.serversToMonitor.servers') return [];
                return undefined;
            }),
        };

        const result = await verifyAppConfig(mockConfig);

        expect(result).toBe(true);
        expect(console.error).not.toHaveBeenCalled();
    });

    test('should validate InfluxDB version when enabled', async () => {
        // Mock config object with invalid InfluxDB version
        const mockConfig = {
            get: jest.fn((key) => {
                if (key === 'Butler-SOS.anonTelemetry') return false;
                if (key === 'Butler-SOS.systemInfo.enable') return true;
                if (key === 'Butler-SOS.influxdbConfig.enable') return true;
                if (key === 'Butler-SOS.influxdbConfig.version') return 3; // Invalid version
                if (key === 'Butler-SOS.serversToMonitor.serverTagsDefinition') return [];
                if (key === 'Butler-SOS.serversToMonitor.servers') return [];
                return undefined;
            }),
        };

        const result = await verifyAppConfig(mockConfig);

        expect(result).toBe(false);
        expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining('InfluxDB version) 3 is invalid')
        );
    });
});
