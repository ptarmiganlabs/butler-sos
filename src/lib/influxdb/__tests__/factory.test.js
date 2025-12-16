import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// Mock globals
const mockGlobals = {
    logger: {
        info: jest.fn(),
        verbose: jest.fn(),
        debug: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
    },
    config: {
        get: jest.fn(),
        has: jest.fn(),
    },
};

jest.unstable_mockModule('../../../globals.js', () => ({
    default: mockGlobals,
}));

// Mock shared utils
jest.unstable_mockModule('../shared/utils.js', () => ({
    getInfluxDbVersion: jest.fn(),
    getFormattedTime: jest.fn(),
    processAppDocuments: jest.fn(),
    isInfluxDbEnabled: jest.fn(),
    applyTagsToPoint3: jest.fn(),
    writeToInfluxWithRetry: jest.fn(),
}));

// Mock v3 implementations
jest.unstable_mockModule('../v3/queue-metrics.js', () => ({
    postUserEventQueueMetricsToInfluxdbV3: jest.fn(),
    postLogEventQueueMetricsToInfluxdbV3: jest.fn(),
}));

// Mock v2 implementations
jest.unstable_mockModule('../v2/queue-metrics.js', () => ({
    storeUserEventQueueMetricsV2: jest.fn(),
    storeLogEventQueueMetricsV2: jest.fn(),
}));

// Mock v1 implementations
jest.unstable_mockModule('../v1/queue-metrics.js', () => ({
    storeUserEventQueueMetricsV1: jest.fn(),
    storeLogEventQueueMetricsV1: jest.fn(),
}));

describe('InfluxDB Factory', () => {
    let factory;
    let globals;
    let utils;
    let v3Impl;
    let v2Impl;
    let v1Impl;

    beforeEach(async () => {
        jest.clearAllMocks();

        globals = (await import('../../../globals.js')).default;
        utils = await import('../shared/utils.js');
        v3Impl = await import('../v3/queue-metrics.js');
        v2Impl = await import('../v2/queue-metrics.js');
        v1Impl = await import('../v1/queue-metrics.js');
        factory = await import('../factory.js');

        // Setup default mocks
        v3Impl.postUserEventQueueMetricsToInfluxdbV3.mockResolvedValue();
        v3Impl.postLogEventQueueMetricsToInfluxdbV3.mockResolvedValue();
        v2Impl.storeUserEventQueueMetricsV2.mockResolvedValue();
        v2Impl.storeLogEventQueueMetricsV2.mockResolvedValue();
        v1Impl.storeUserEventQueueMetricsV1.mockResolvedValue();
        v1Impl.storeLogEventQueueMetricsV1.mockResolvedValue();
    });

    describe('postUserEventQueueMetricsToInfluxdb', () => {
        test('should route to v3 implementation when version is 3', async () => {
            utils.getInfluxDbVersion.mockReturnValue(3);

            await factory.postUserEventQueueMetricsToInfluxdb();

            expect(v3Impl.postUserEventQueueMetricsToInfluxdbV3).toHaveBeenCalled();
            expect(v2Impl.storeUserEventQueueMetricsV2).not.toHaveBeenCalled();
            expect(v1Impl.storeUserEventQueueMetricsV1).not.toHaveBeenCalled();
        });

        test('should route to v2 implementation when version is 2', async () => {
            utils.getInfluxDbVersion.mockReturnValue(2);

            await factory.postUserEventQueueMetricsToInfluxdb();

            expect(v2Impl.storeUserEventQueueMetricsV2).toHaveBeenCalled();
            expect(v3Impl.postUserEventQueueMetricsToInfluxdbV3).not.toHaveBeenCalled();
            expect(v1Impl.storeUserEventQueueMetricsV1).not.toHaveBeenCalled();
        });

        test('should route to v1 implementation when version is 1', async () => {
            utils.getInfluxDbVersion.mockReturnValue(1);

            await factory.postUserEventQueueMetricsToInfluxdb();

            expect(v1Impl.storeUserEventQueueMetricsV1).toHaveBeenCalled();
            expect(v3Impl.postUserEventQueueMetricsToInfluxdbV3).not.toHaveBeenCalled();
            expect(v2Impl.storeUserEventQueueMetricsV2).not.toHaveBeenCalled();
        });

        test('should throw error for unsupported version', async () => {
            utils.getInfluxDbVersion.mockReturnValue(99);

            await expect(factory.postUserEventQueueMetricsToInfluxdb()).rejects.toThrow(
                'InfluxDB v99 not supported'
            );

            expect(globals.logger.debug).toHaveBeenCalledWith(
                'INFLUXDB FACTORY: Unknown InfluxDB version: v99'
            );
        });
    });

    describe('postLogEventQueueMetricsToInfluxdb', () => {
        test('should route to v3 implementation when version is 3', async () => {
            utils.getInfluxDbVersion.mockReturnValue(3);

            await factory.postLogEventQueueMetricsToInfluxdb();

            expect(v3Impl.postLogEventQueueMetricsToInfluxdbV3).toHaveBeenCalled();
            expect(v2Impl.storeLogEventQueueMetricsV2).not.toHaveBeenCalled();
            expect(v1Impl.storeLogEventQueueMetricsV1).not.toHaveBeenCalled();
        });

        test('should route to v2 implementation when version is 2', async () => {
            utils.getInfluxDbVersion.mockReturnValue(2);

            await factory.postLogEventQueueMetricsToInfluxdb();

            expect(v2Impl.storeLogEventQueueMetricsV2).toHaveBeenCalled();
            expect(v3Impl.postLogEventQueueMetricsToInfluxdbV3).not.toHaveBeenCalled();
            expect(v1Impl.storeLogEventQueueMetricsV1).not.toHaveBeenCalled();
        });

        test('should route to v1 implementation when version is 1', async () => {
            utils.getInfluxDbVersion.mockReturnValue(1);

            await factory.postLogEventQueueMetricsToInfluxdb();

            expect(v1Impl.storeLogEventQueueMetricsV1).toHaveBeenCalled();
            expect(v3Impl.postLogEventQueueMetricsToInfluxdbV3).not.toHaveBeenCalled();
            expect(v2Impl.storeLogEventQueueMetricsV2).not.toHaveBeenCalled();
        });

        test('should throw error for unsupported version', async () => {
            utils.getInfluxDbVersion.mockReturnValue(5);

            await expect(factory.postLogEventQueueMetricsToInfluxdb()).rejects.toThrow(
                'InfluxDB v5 not supported'
            );
        });
    });
});
