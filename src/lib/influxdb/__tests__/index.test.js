import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';

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

// Mock factory
const mockFactory = {
    postHealthMetricsToInfluxdb: jest.fn(),
    postProxySessionsToInfluxdb: jest.fn(),
    postButlerSOSMemoryUsageToInfluxdb: jest.fn(),
    postUserEventToInfluxdb: jest.fn(),
    postLogEventToInfluxdb: jest.fn(),
    storeEventCountInfluxDB: jest.fn(),
    storeRejectedEventCountInfluxDB: jest.fn(),
    postUserEventQueueMetricsToInfluxdb: jest.fn(),
    postLogEventQueueMetricsToInfluxdb: jest.fn(),
};

jest.unstable_mockModule('../factory.js', () => mockFactory);

// Mock shared utils
jest.unstable_mockModule('../shared/utils.js', () => ({
    getFormattedTime: jest.fn((time) => `formatted-${time}`),
}));

describe('InfluxDB Index (Facade)', () => {
    let indexModule;
    let globals;

    beforeEach(async () => {
        jest.clearAllMocks();

        globals = (await import('../../../globals.js')).default;
        indexModule = await import('../index.js');

        // Setup default mock implementations
        mockFactory.postHealthMetricsToInfluxdb.mockResolvedValue();
        mockFactory.postProxySessionsToInfluxdb.mockResolvedValue();
        mockFactory.postButlerSOSMemoryUsageToInfluxdb.mockResolvedValue();
        mockFactory.postUserEventToInfluxdb.mockResolvedValue();
        mockFactory.postLogEventToInfluxdb.mockResolvedValue();
        mockFactory.storeEventCountInfluxDB.mockResolvedValue();
        mockFactory.storeRejectedEventCountInfluxDB.mockResolvedValue();
        mockFactory.postUserEventQueueMetricsToInfluxdb.mockResolvedValue();
        mockFactory.postLogEventQueueMetricsToInfluxdb.mockResolvedValue();

        globals.config.get.mockReturnValue(true);
    });

    describe('getFormattedTime', () => {
        test('should be exported and callable', () => {
            expect(indexModule.getFormattedTime).toBeDefined();
            expect(typeof indexModule.getFormattedTime).toBe('function');
        });

        test('should format time correctly', () => {
            const result = indexModule.getFormattedTime('20240101T120000');
            expect(result).toBe('formatted-20240101T120000');
        });
    });

    describe('postHealthMetricsToInfluxdb', () => {
        test('should delegate to factory', async () => {
            const serverName = 'server1';
            const host = 'host1';
            const body = { version: '1.0' };
            const serverTags = [{ name: 'env', value: 'prod' }];

            await indexModule.postHealthMetricsToInfluxdb(serverName, host, body, serverTags);

            expect(mockFactory.postHealthMetricsToInfluxdb).toHaveBeenCalledWith(
                serverName,
                host,
                body,
                serverTags
            );
        });
    });

    describe('postProxySessionsToInfluxdb', () => {
        test('should delegate to factory', async () => {
            const userSessions = { serverName: 'test', host: 'test-host' };

            await indexModule.postProxySessionsToInfluxdb(userSessions);

            expect(mockFactory.postProxySessionsToInfluxdb).toHaveBeenCalledWith(userSessions);
        });
    });

    describe('postButlerSOSMemoryUsageToInfluxdb', () => {
        test('should delegate to factory', async () => {
            const memory = { heap_used: 100, heap_total: 200 };

            await indexModule.postButlerSOSMemoryUsageToInfluxdb(memory);

            expect(mockFactory.postButlerSOSMemoryUsageToInfluxdb).toHaveBeenCalledWith(memory);
        });
    });

    describe('postUserEventToInfluxdb', () => {
        test('should delegate to factory', async () => {
            const msg = { host: 'test-host', command: 'OpenApp' };

            await indexModule.postUserEventToInfluxdb(msg);

            expect(mockFactory.postUserEventToInfluxdb).toHaveBeenCalledWith(msg);
        });
    });

    describe('postLogEventToInfluxdb', () => {
        test('should delegate to factory', async () => {
            const msg = { host: 'test-host', source: 'qseow-engine' };

            await indexModule.postLogEventToInfluxdb(msg);

            expect(mockFactory.postLogEventToInfluxdb).toHaveBeenCalledWith(msg);
        });
    });

    describe('storeEventCountInfluxDB', () => {
        test('should delegate to factory', async () => {
            await indexModule.storeEventCountInfluxDB('midnight', 'hour');

            expect(mockFactory.storeEventCountInfluxDB).toHaveBeenCalled();
        });

        test('should ignore deprecated parameters', async () => {
            await indexModule.storeEventCountInfluxDB('deprecated1', 'deprecated2');

            expect(mockFactory.storeEventCountInfluxDB).toHaveBeenCalledWith();
        });
    });

    describe('storeRejectedEventCountInfluxDB', () => {
        test('should delegate to factory', async () => {
            await indexModule.storeRejectedEventCountInfluxDB('midnight', 'hour');

            expect(mockFactory.storeRejectedEventCountInfluxDB).toHaveBeenCalled();
        });

        test('should ignore deprecated parameters', async () => {
            await indexModule.storeRejectedEventCountInfluxDB({ data: 'old' }, { data: 'old2' });

            expect(mockFactory.storeRejectedEventCountInfluxDB).toHaveBeenCalledWith();
        });
    });

    describe('postUserEventQueueMetricsToInfluxdb', () => {
        test('should delegate to factory', async () => {
            await indexModule.postUserEventQueueMetricsToInfluxdb({ some: 'data' });

            expect(mockFactory.postUserEventQueueMetricsToInfluxdb).toHaveBeenCalled();
        });

        test('should ignore deprecated parameter', async () => {
            await indexModule.postUserEventQueueMetricsToInfluxdb({ old: 'metrics' });

            expect(mockFactory.postUserEventQueueMetricsToInfluxdb).toHaveBeenCalledWith();
        });
    });

    describe('postLogEventQueueMetricsToInfluxdb', () => {
        test('should delegate to factory', async () => {
            await indexModule.postLogEventQueueMetricsToInfluxdb({ some: 'data' });

            expect(mockFactory.postLogEventQueueMetricsToInfluxdb).toHaveBeenCalled();
        });

        test('should ignore deprecated parameter', async () => {
            await indexModule.postLogEventQueueMetricsToInfluxdb({ old: 'metrics' });

            expect(mockFactory.postLogEventQueueMetricsToInfluxdb).toHaveBeenCalledWith();
        });
    });

    describe('setupUdpQueueMetricsStorage', () => {
        let intervalSpy;

        beforeEach(() => {
            intervalSpy = jest.spyOn(global, 'setInterval');
        });

        afterEach(() => {
            intervalSpy.mockRestore();
        });

        test('should return empty interval IDs when InfluxDB is disabled', () => {
            globals.config.get.mockImplementation((path) => {
                if (path.includes('influxdbConfig.enable')) return false;
                return undefined;
            });

            const result = indexModule.setupUdpQueueMetricsStorage();

            expect(result).toEqual({
                userEvents: null,
                logEvents: null,
            });
            expect(globals.logger.info).toHaveBeenCalledWith(
                expect.stringContaining('InfluxDB is disabled')
            );
        });

        test('should setup user event queue metrics when enabled', () => {
            globals.config.get.mockImplementation((path) => {
                if (path.includes('influxdbConfig.enable')) return true;
                if (path.includes('userEvents.udpServerConfig.queueMetrics.influxdb.enable'))
                    return true;
                if (
                    path.includes('userEvents.udpServerConfig.queueMetrics.influxdb.writeFrequency')
                )
                    return 60000;
                if (path.includes('logEvents.udpServerConfig.queueMetrics.influxdb.enable'))
                    return false;
                return undefined;
            });

            const result = indexModule.setupUdpQueueMetricsStorage();

            expect(result.userEvents).not.toBeNull();
            expect(intervalSpy).toHaveBeenCalledWith(expect.any(Function), 60000);
            expect(globals.logger.info).toHaveBeenCalledWith(
                expect.stringContaining('user event queue metrics')
            );
        });

        test('should setup log event queue metrics when enabled', () => {
            globals.config.get.mockImplementation((path) => {
                if (path.includes('influxdbConfig.enable')) return true;
                if (path.includes('userEvents.udpServerConfig.queueMetrics.influxdb.enable'))
                    return false;
                if (path.includes('logEvents.udpServerConfig.queueMetrics.influxdb.enable'))
                    return true;
                if (path.includes('logEvents.udpServerConfig.queueMetrics.influxdb.writeFrequency'))
                    return 30000;
                return undefined;
            });

            const result = indexModule.setupUdpQueueMetricsStorage();

            expect(result.logEvents).not.toBeNull();
            expect(intervalSpy).toHaveBeenCalledWith(expect.any(Function), 30000);
        });

        test('should setup both metrics when both enabled', () => {
            globals.config.get.mockImplementation((path) => {
                if (path.includes('influxdbConfig.enable')) return true;
                if (path.includes('userEvents.udpServerConfig.queueMetrics.influxdb.enable'))
                    return true;
                if (
                    path.includes('userEvents.udpServerConfig.queueMetrics.influxdb.writeFrequency')
                )
                    return 45000;
                if (path.includes('logEvents.udpServerConfig.queueMetrics.influxdb.enable'))
                    return true;
                if (path.includes('logEvents.udpServerConfig.queueMetrics.influxdb.writeFrequency'))
                    return 55000;
                return undefined;
            });

            const result = indexModule.setupUdpQueueMetricsStorage();

            expect(result.userEvents).not.toBeNull();
            expect(result.logEvents).not.toBeNull();
            expect(intervalSpy).toHaveBeenCalledTimes(2);
        });

        test('should log when metrics are disabled', () => {
            globals.config.get.mockImplementation((path) => {
                if (path.includes('influxdbConfig.enable')) return true;
                if (path.includes('queueMetrics.influxdb.enable')) return false;
                return undefined;
            });

            indexModule.setupUdpQueueMetricsStorage();

            expect(globals.logger.info).toHaveBeenCalledWith(
                expect.stringContaining('User event queue metrics storage to InfluxDB is disabled')
            );
            expect(globals.logger.info).toHaveBeenCalledWith(
                expect.stringContaining('Log event queue metrics storage to InfluxDB is disabled')
            );
        });
    });
});
