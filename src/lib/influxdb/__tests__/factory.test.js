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

jest.unstable_mockModule('../v1/health-metrics.js', () => ({
    storeHealthMetricsV1: jest.fn(),
}));

jest.unstable_mockModule('../v2/health-metrics.js', () => ({
    storeHealthMetricsV2: jest.fn(),
}));

jest.unstable_mockModule('../v3/health-metrics.js', () => ({
    postHealthMetricsToInfluxdbV3: jest.fn(),
}));

jest.unstable_mockModule('../v1/sessions.js', () => ({
    storeSessionsV1: jest.fn(),
}));

jest.unstable_mockModule('../v2/sessions.js', () => ({
    storeSessionsV2: jest.fn(),
}));

jest.unstable_mockModule('../v3/sessions.js', () => ({
    postProxySessionsToInfluxdbV3: jest.fn(),
}));

jest.unstable_mockModule('../v1/butler-memory.js', () => ({
    storeButlerMemoryV1: jest.fn(),
}));

jest.unstable_mockModule('../v2/butler-memory.js', () => ({
    storeButlerMemoryV2: jest.fn(),
}));

jest.unstable_mockModule('../v3/butler-memory.js', () => ({
    postButlerSOSMemoryUsageToInfluxdbV3: jest.fn(),
}));

jest.unstable_mockModule('../v1/user-events.js', () => ({
    storeUserEventV1: jest.fn(),
}));

jest.unstable_mockModule('../v2/user-events.js', () => ({
    storeUserEventV2: jest.fn(),
}));

jest.unstable_mockModule('../v3/user-events.js', () => ({
    postUserEventToInfluxdbV3: jest.fn(),
}));

jest.unstable_mockModule('../v1/log-events.js', () => ({
    storeLogEventV1: jest.fn(),
}));

jest.unstable_mockModule('../v2/log-events.js', () => ({
    storeLogEventV2: jest.fn(),
}));

jest.unstable_mockModule('../v3/log-events.js', () => ({
    postLogEventToInfluxdbV3: jest.fn(),
}));

jest.unstable_mockModule('../v1/event-counts.js', () => ({
    storeEventCountV1: jest.fn(),
    storeRejectedEventCountV1: jest.fn(),
}));

jest.unstable_mockModule('../v2/event-counts.js', () => ({
    storeEventCountV2: jest.fn(),
    storeRejectedEventCountV2: jest.fn(),
}));

jest.unstable_mockModule('../v3/event-counts.js', () => ({
    storeEventCountInfluxDBV3: jest.fn(),
    storeRejectedEventCountInfluxDBV3: jest.fn(),
}));

describe('InfluxDB Factory', () => {
    let factory;
    let globals;
    let utils;
    let v3Impl;
    let v2Impl;
    let v1Impl;
    let v3Health, v2Health, v1Health;
    let v3Sessions, v2Sessions, v1Sessions;
    let v3Memory, v2Memory, v1Memory;
    let v3User, v2User, v1User;
    let v3Log, v2Log, v1Log;
    let v3EventCounts, v2EventCounts, v1EventCounts;

    beforeEach(async () => {
        jest.clearAllMocks();

        globals = (await import('../../../globals.js')).default;
        utils = await import('../shared/utils.js');
        v3Impl = await import('../v3/queue-metrics.js');
        v2Impl = await import('../v2/queue-metrics.js');
        v1Impl = await import('../v1/queue-metrics.js');

        v3Health = await import('../v3/health-metrics.js');
        v2Health = await import('../v2/health-metrics.js');
        v1Health = await import('../v1/health-metrics.js');

        v3Sessions = await import('../v3/sessions.js');
        v2Sessions = await import('../v2/sessions.js');
        v1Sessions = await import('../v1/sessions.js');

        v3Memory = await import('../v3/butler-memory.js');
        v2Memory = await import('../v2/butler-memory.js');
        v1Memory = await import('../v1/butler-memory.js');

        v3User = await import('../v3/user-events.js');
        v2User = await import('../v2/user-events.js');
        v1User = await import('../v1/user-events.js');

        v3Log = await import('../v3/log-events.js');
        v2Log = await import('../v2/log-events.js');
        v1Log = await import('../v1/log-events.js');

        v3EventCounts = await import('../v3/event-counts.js');
        v2EventCounts = await import('../v2/event-counts.js');
        v1EventCounts = await import('../v1/event-counts.js');

        factory = await import('../factory.js');

        // Setup default mocks
        v3Impl.postUserEventQueueMetricsToInfluxdbV3.mockResolvedValue();
        v3Impl.postLogEventQueueMetricsToInfluxdbV3.mockResolvedValue();
        v2Impl.storeUserEventQueueMetricsV2.mockResolvedValue();
        v2Impl.storeLogEventQueueMetricsV2.mockResolvedValue();
        v1Impl.storeUserEventQueueMetricsV1.mockResolvedValue();
        v1Impl.storeLogEventQueueMetricsV1.mockResolvedValue();

        v3Health.postHealthMetricsToInfluxdbV3.mockResolvedValue();
        v2Health.storeHealthMetricsV2.mockResolvedValue();
        v1Health.storeHealthMetricsV1.mockResolvedValue();

        v3Sessions.postProxySessionsToInfluxdbV3.mockResolvedValue();
        v2Sessions.storeSessionsV2.mockResolvedValue();
        v1Sessions.storeSessionsV1.mockResolvedValue();

        v3Memory.postButlerSOSMemoryUsageToInfluxdbV3.mockResolvedValue();
        v2Memory.storeButlerMemoryV2.mockResolvedValue();
        v1Memory.storeButlerMemoryV1.mockResolvedValue();

        v3User.postUserEventToInfluxdbV3.mockResolvedValue();
        v2User.storeUserEventV2.mockResolvedValue();
        v1User.storeUserEventV1.mockResolvedValue();

        v3Log.postLogEventToInfluxdbV3.mockResolvedValue();
        v2Log.storeLogEventV2.mockResolvedValue();
        v1Log.storeLogEventV1.mockResolvedValue();

        v3EventCounts.storeEventCountInfluxDBV3.mockResolvedValue();
        v3EventCounts.storeRejectedEventCountInfluxDBV3.mockResolvedValue();
        v2EventCounts.storeEventCountV2.mockResolvedValue();
        v2EventCounts.storeRejectedEventCountV2.mockResolvedValue();
        v1EventCounts.storeEventCountV1.mockResolvedValue();
        v1EventCounts.storeRejectedEventCountV1.mockResolvedValue();
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

    describe('postHealthMetricsToInfluxdb', () => {
        const serverName = 'test-server';
        const host = 'test-host';
        const body = { version: '1.0' };
        const serverTags = [{ name: 'env', value: 'prod' }];

        test('should route to v3 implementation when version is 3', async () => {
            utils.getInfluxDbVersion.mockReturnValue(3);

            await factory.postHealthMetricsToInfluxdb(serverName, host, body, serverTags);

            expect(v3Health.postHealthMetricsToInfluxdbV3).toHaveBeenCalledWith(
                serverName,
                host,
                body,
                serverTags
            );
            expect(v2Health.storeHealthMetricsV2).not.toHaveBeenCalled();
            expect(v1Health.storeHealthMetricsV1).not.toHaveBeenCalled();
        });

        test('should route to v2 implementation when version is 2', async () => {
            utils.getInfluxDbVersion.mockReturnValue(2);

            await factory.postHealthMetricsToInfluxdb(serverName, host, body, serverTags);

            expect(v2Health.storeHealthMetricsV2).toHaveBeenCalledWith(
                serverName,
                host,
                body,
                serverTags
            );
            expect(v3Health.postHealthMetricsToInfluxdbV3).not.toHaveBeenCalled();
            expect(v1Health.storeHealthMetricsV1).not.toHaveBeenCalled();
        });

        test('should route to v1 implementation when version is 1', async () => {
            utils.getInfluxDbVersion.mockReturnValue(1);

            await factory.postHealthMetricsToInfluxdb(serverName, host, body, serverTags);

            expect(v1Health.storeHealthMetricsV1).toHaveBeenCalledWith(serverTags, body);
            expect(v3Health.postHealthMetricsToInfluxdbV3).not.toHaveBeenCalled();
            expect(v2Health.storeHealthMetricsV2).not.toHaveBeenCalled();
        });

        test('should throw error for unsupported version', async () => {
            utils.getInfluxDbVersion.mockReturnValue(4);

            await expect(
                factory.postHealthMetricsToInfluxdb(serverName, host, body, serverTags)
            ).rejects.toThrow('InfluxDB v4 not supported');
        });
    });

    describe('postProxySessionsToInfluxdb', () => {
        const userSessions = { serverName: 'test', host: 'test-host' };

        test('should route to v3 implementation when version is 3', async () => {
            utils.getInfluxDbVersion.mockReturnValue(3);

            await factory.postProxySessionsToInfluxdb(userSessions);

            expect(v3Sessions.postProxySessionsToInfluxdbV3).toHaveBeenCalledWith(userSessions);
            expect(v2Sessions.storeSessionsV2).not.toHaveBeenCalled();
            expect(v1Sessions.storeSessionsV1).not.toHaveBeenCalled();
        });

        test('should route to v2 implementation when version is 2', async () => {
            utils.getInfluxDbVersion.mockReturnValue(2);

            await factory.postProxySessionsToInfluxdb(userSessions);

            expect(v2Sessions.storeSessionsV2).toHaveBeenCalledWith(userSessions);
            expect(v3Sessions.postProxySessionsToInfluxdbV3).not.toHaveBeenCalled();
            expect(v1Sessions.storeSessionsV1).not.toHaveBeenCalled();
        });

        test('should route to v1 implementation when version is 1', async () => {
            utils.getInfluxDbVersion.mockReturnValue(1);

            await factory.postProxySessionsToInfluxdb(userSessions);

            expect(v1Sessions.storeSessionsV1).toHaveBeenCalledWith(userSessions);
            expect(v3Sessions.postProxySessionsToInfluxdbV3).not.toHaveBeenCalled();
            expect(v2Sessions.storeSessionsV2).not.toHaveBeenCalled();
        });

        test('should throw error for unsupported version', async () => {
            utils.getInfluxDbVersion.mockReturnValue(10);

            await expect(factory.postProxySessionsToInfluxdb(userSessions)).rejects.toThrow(
                'InfluxDB v10 not supported'
            );
        });
    });

    describe('postButlerSOSMemoryUsageToInfluxdb', () => {
        const memory = { heap_used: 100, heap_total: 200 };

        test('should route to v3 implementation when version is 3', async () => {
            utils.getInfluxDbVersion.mockReturnValue(3);

            await factory.postButlerSOSMemoryUsageToInfluxdb(memory);

            expect(v3Memory.postButlerSOSMemoryUsageToInfluxdbV3).toHaveBeenCalledWith(memory);
            expect(v2Memory.storeButlerMemoryV2).not.toHaveBeenCalled();
            expect(v1Memory.storeButlerMemoryV1).not.toHaveBeenCalled();
        });

        test('should route to v2 implementation when version is 2', async () => {
            utils.getInfluxDbVersion.mockReturnValue(2);

            await factory.postButlerSOSMemoryUsageToInfluxdb(memory);

            expect(v2Memory.storeButlerMemoryV2).toHaveBeenCalledWith(memory);
        });

        test('should route to v1 implementation when version is 1', async () => {
            utils.getInfluxDbVersion.mockReturnValue(1);

            await factory.postButlerSOSMemoryUsageToInfluxdb(memory);

            expect(v1Memory.storeButlerMemoryV1).toHaveBeenCalledWith(memory);
        });

        test('should throw error for unsupported version', async () => {
            utils.getInfluxDbVersion.mockReturnValue(7);

            await expect(factory.postButlerSOSMemoryUsageToInfluxdb(memory)).rejects.toThrow(
                'InfluxDB v7 not supported'
            );
        });
    });

    describe('postUserEventToInfluxdb', () => {
        const msg = { host: 'test-host', command: 'OpenApp' };

        test('should route to v3 implementation when version is 3', async () => {
            utils.getInfluxDbVersion.mockReturnValue(3);

            await factory.postUserEventToInfluxdb(msg);

            expect(v3User.postUserEventToInfluxdbV3).toHaveBeenCalledWith(msg);
        });

        test('should route to v2 implementation when version is 2', async () => {
            utils.getInfluxDbVersion.mockReturnValue(2);

            await factory.postUserEventToInfluxdb(msg);

            expect(v2User.storeUserEventV2).toHaveBeenCalledWith(msg);
        });

        test('should route to v1 implementation when version is 1', async () => {
            utils.getInfluxDbVersion.mockReturnValue(1);

            await factory.postUserEventToInfluxdb(msg);

            expect(v1User.storeUserEventV1).toHaveBeenCalledWith(msg);
        });

        test('should throw error for unsupported version', async () => {
            utils.getInfluxDbVersion.mockReturnValue(0);

            await expect(factory.postUserEventToInfluxdb(msg)).rejects.toThrow(
                'InfluxDB v0 not supported'
            );
        });
    });

    describe('postLogEventToInfluxdb', () => {
        const msg = { host: 'test-host', source: 'qseow-engine' };

        test('should route to v3 implementation when version is 3', async () => {
            utils.getInfluxDbVersion.mockReturnValue(3);

            await factory.postLogEventToInfluxdb(msg);

            expect(v3Log.postLogEventToInfluxdbV3).toHaveBeenCalledWith(msg);
        });

        test('should route to v2 implementation when version is 2', async () => {
            utils.getInfluxDbVersion.mockReturnValue(2);

            await factory.postLogEventToInfluxdb(msg);

            expect(v2Log.storeLogEventV2).toHaveBeenCalledWith(msg);
        });

        test('should route to v1 implementation when version is 1', async () => {
            utils.getInfluxDbVersion.mockReturnValue(1);

            await factory.postLogEventToInfluxdb(msg);

            expect(v1Log.storeLogEventV1).toHaveBeenCalledWith(msg);
        });

        test('should throw error for unsupported version', async () => {
            utils.getInfluxDbVersion.mockReturnValue(-1);

            await expect(factory.postLogEventToInfluxdb(msg)).rejects.toThrow(
                'InfluxDB v-1 not supported'
            );
        });
    });

    describe('storeEventCountInfluxDB', () => {
        test('should route to v3 implementation when version is 3', async () => {
            utils.getInfluxDbVersion.mockReturnValue(3);

            await factory.storeEventCountInfluxDB();

            expect(v3EventCounts.storeEventCountInfluxDBV3).toHaveBeenCalled();
        });

        test('should route to v2 implementation when version is 2', async () => {
            utils.getInfluxDbVersion.mockReturnValue(2);

            await factory.storeEventCountInfluxDB();

            expect(v2EventCounts.storeEventCountV2).toHaveBeenCalled();
        });

        test('should route to v1 implementation when version is 1', async () => {
            utils.getInfluxDbVersion.mockReturnValue(1);

            await factory.storeEventCountInfluxDB();

            expect(v1EventCounts.storeEventCountV1).toHaveBeenCalled();
        });

        test('should throw error for unsupported version', async () => {
            utils.getInfluxDbVersion.mockReturnValue(100);

            await expect(factory.storeEventCountInfluxDB()).rejects.toThrow(
                'InfluxDB v100 not supported'
            );
        });
    });

    describe('storeRejectedEventCountInfluxDB', () => {
        test('should route to v3 implementation when version is 3', async () => {
            utils.getInfluxDbVersion.mockReturnValue(3);

            await factory.storeRejectedEventCountInfluxDB();

            expect(v3EventCounts.storeRejectedEventCountInfluxDBV3).toHaveBeenCalled();
        });

        test('should route to v2 implementation when version is 2', async () => {
            utils.getInfluxDbVersion.mockReturnValue(2);

            await factory.storeRejectedEventCountInfluxDB();

            expect(v2EventCounts.storeRejectedEventCountV2).toHaveBeenCalled();
        });

        test('should route to v1 implementation when version is 1', async () => {
            utils.getInfluxDbVersion.mockReturnValue(1);

            await factory.storeRejectedEventCountInfluxDB();

            expect(v1EventCounts.storeRejectedEventCountV1).toHaveBeenCalled();
        });

        test('should throw error for unsupported version', async () => {
            utils.getInfluxDbVersion.mockReturnValue(99);

            await expect(factory.storeRejectedEventCountInfluxDB()).rejects.toThrow(
                'InfluxDB v99 not supported'
            );
        });
    });
});
