import { describe, test, expect, beforeEach, jest } from '@jest/globals';

// Mock process.exit
const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('process.exit called');
});

jest.unstable_mockModule('fs/promises', () => ({
    default: {
        readFile: jest.fn(),
    },
}));

jest.unstable_mockModule('js-yaml', () => ({
    load: jest.fn(),
}));

const fs = (await import('fs/promises')).default;
const { load } = await import('js-yaml');
const { verifyConfigFileSchema, verifyAppConfig } = await import('../config-file-verify.js');

describe('config-file-verify', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('verifyConfigFileSchema', () => {
        test('returns false on YAML parse error', async () => {
            fs.readFile.mockResolvedValue('invalid yaml');
            load.mockImplementation(() => {
                throw new Error('Parse error');
            });

            const result = await verifyConfigFileSchema('config.yaml');
            expect(result).toBe(false);
        });

        test('exits on validation failure', async () => {
            fs.readFile.mockResolvedValue('Butler-SOS: {}');
            load.mockReturnValue({ 'Butler-SOS': {} });

            // This will fail because it tries to validate against the real schema
            // which has many required fields.
            const result = await verifyConfigFileSchema('config.yaml');
            expect(result).toBe(false);
            expect(mockExit).toHaveBeenCalledWith(1);
        });
    });

    describe('verifyAppConfig', () => {
        let mockCfg;

        beforeEach(() => {
            mockCfg = {
                get: jest.fn(),
                has: jest.fn(),
                set: jest.fn(),
            };
        });

        test('returns true for valid app config', async () => {
            mockCfg.get.mockImplementation((key) => {
                if (key === 'Butler-SOS.influxdbConfig.enable') return false;
                if (key === 'Butler-SOS.anonTelemetry') return false;
                if (key === 'Butler-SOS.systemInfo.enable') return false;
                if (key === 'Butler-SOS.serversToMonitor.serverTagsDefinition') return [];
                if (key === 'Butler-SOS.serversToMonitor.servers') return [];
                return null;
            });

            const result = await verifyAppConfig(mockCfg);
            expect(result).toBe(true);
        });

        test('validates InfluxDB version', async () => {
            mockCfg.get.mockImplementation((key) => {
                if (key === 'Butler-SOS.influxdbConfig.enable') return true;
                if (key === 'Butler-SOS.influxdbConfig.version') return 4; // Invalid
                return null;
            });

            const result = await verifyAppConfig(mockCfg);
            expect(result).toBe(false);
        });

        test('validates InfluxDB maxBatchSize', async () => {
            mockCfg.get.mockImplementation((key) => {
                if (key === 'Butler-SOS.influxdbConfig.enable') return true;
                if (key === 'Butler-SOS.influxdbConfig.version') return 1;
                if (key === 'Butler-SOS.influxdbConfig.maxBatchSize') return 20000; // Too large
                if (key === 'Butler-SOS.anonTelemetry') return false;
                if (key === 'Butler-SOS.systemInfo.enable') return false;
                if (key === 'Butler-SOS.serversToMonitor.serverTagsDefinition') return [];
                if (key === 'Butler-SOS.serversToMonitor.servers') return [];
                return null;
            });
            mockCfg.has.mockReturnValue(true);

            const result = await verifyAppConfig(mockCfg);
            expect(result).toBe(true); // It warns and sets default, doesn't return false
            expect(mockCfg.set).toHaveBeenCalledWith('Butler-SOS.influxdbConfig.maxBatchSize', 1000);
        });

        test('validates telemetry vs system info', async () => {
            mockCfg.get.mockImplementation((key) => {
                if (key === 'Butler-SOS.influxdbConfig.enable') return false;
                if (key === 'Butler-SOS.anonTelemetry') return true;
                if (key === 'Butler-SOS.systemInfo.enable') return false;
                return null;
            });

            const result = await verifyAppConfig(mockCfg);
            expect(result).toBe(false);
        });

        test('validates server tags - missing tag on server', async () => {
            mockCfg.get.mockImplementation((key) => {
                if (key === 'Butler-SOS.influxdbConfig.enable') return false;
                if (key === 'Butler-SOS.anonTelemetry') return false;
                if (key === 'Butler-SOS.systemInfo.enable') return false;
                if (key === 'Butler-SOS.serversToMonitor.serverTagsDefinition') return ['tag1'];
                if (key === 'Butler-SOS.serversToMonitor.servers') return [
                    { serverName: 'S1', serverTags: {} }
                ];
                return null;
            });

            const result = await verifyAppConfig(mockCfg);
            expect(result).toBe(false);
        });

        test('validates server tags - extra tag on server', async () => {
            mockCfg.get.mockImplementation((key) => {
                if (key === 'Butler-SOS.influxdbConfig.enable') return false;
                if (key === 'Butler-SOS.anonTelemetry') return false;
                if (key === 'Butler-SOS.systemInfo.enable') return false;
                if (key === 'Butler-SOS.serversToMonitor.serverTagsDefinition') return ['tag1'];
                if (key === 'Butler-SOS.serversToMonitor.servers') return [
                    { serverName: 'S1', serverTags: { tag1: 'v1', tag2: 'v2' } }
                ];
                return null;
            });

            const result = await verifyAppConfig(mockCfg);
            expect(result).toBe(false);
        });

        test('handles error in server tags verification', async () => {
            mockCfg.get.mockImplementation((key) => {
                if (key === 'Butler-SOS.influxdbConfig.enable') return false;
                if (key === 'Butler-SOS.anonTelemetry') return false;
                if (key === 'Butler-SOS.systemInfo.enable') return false;
                if (key === 'Butler-SOS.serversToMonitor.serverTagsDefinition') {
                    throw new Error('Unexpected error');
                }
                return null;
            });

            const result = await verifyAppConfig(mockCfg);
            expect(result).toBe(false);
        });
    });
});
