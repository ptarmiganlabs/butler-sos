import { jest, describe, test, afterEach } from '@jest/globals';

// Mock dependencies
jest.unstable_mockModule('fs', () => ({
    default: {
        readFileSync: jest.fn(),
    },
}));
const fs = (await import('fs')).default;

jest.unstable_mockModule('axios', () => ({
    default: {
        create: jest.fn(),
        get: jest.fn(),
    },
}));
const axios = (await import('axios')).default;

jest.unstable_mockModule('../../globals.js', () => ({
    default: {
        logger: {
            error: jest.fn(),
            verbose: jest.fn(),
            debug: jest.fn(),
            warn: jest.fn(),
        },
        errorTracker: {
            incrementError: jest.fn(),
        },
        config: {
            get: jest.fn(),
            has: jest.fn(),
        },
        getErrorMessage: jest.fn().mockImplementation((err) => err.toString()),
    },
}));
const globals = (await import('../../globals.js')).default;

jest.unstable_mockModule('../influxdb/index.js', () => ({
    postHealthMetricsToInfluxdb: jest.fn(),
}));
const { postHealthMetricsToInfluxdb } = await import('../influxdb/index.js');

jest.unstable_mockModule('../post-to-new-relic.js', () => ({
    postHealthMetricsToNewRelic: jest.fn(),
}));
const { postHealthMetricsToNewRelic } = await import('../post-to-new-relic.js');

jest.unstable_mockModule('../post-to-mqtt.js', () => ({
    postHealthToMQTT: jest.fn(),
}));
const { postHealthToMQTT } = await import('../post-to-mqtt.js');

jest.unstable_mockModule('../serverheaders.js', () => ({
    getServerHeaders: jest.fn(),
}));
const { getServerHeaders } = await import('../serverheaders.js');

jest.unstable_mockModule('../servertags.js', () => ({
    getServerTags: jest.fn(),
}));
const { getServerTags } = await import('../servertags.js');

jest.unstable_mockModule('../prom-client.js', () => ({
    saveHealthMetricsToPrometheus: jest.fn(),
}));
const { saveHealthMetricsToPrometheus } = await import('../prom-client.js');

jest.unstable_mockModule('../cert-utils.js', () => ({
    getCertificates: jest.fn(),
    createCertificateOptions: jest.fn(),
}));
const { getCertificates, createCertificateOptions } = await import('../cert-utils.js');

jest.unstable_mockModule('../log-error.js', () => ({
    logError: jest.fn(),
}));
const { logError } = await import('../log-error.js');

// Import the module to test
const { getHealthStatsFromSense, setupHealthMetricsTimer } = await import('../healthmetrics.js');

describe('healthmetrics', () => {
    afterEach(() => {
        jest.clearAllMocks();
        jest.useRealTimers();
    });

    test('should successfully get health metrics from Sense', async () => {
        // Mock certificate utils
        createCertificateOptions.mockReturnValue({ CertificatePassphrase: 'pass' });
        getCertificates.mockReturnValue({
            cert: 'CERT',
            key: 'KEY',
            ca: 'CA',
        });

        // Mock configuration
        globals.config.get.mockImplementation((key) => {
            switch (key) {
                case 'Butler-SOS.cert.clientCert':
                    return './cert.pem';
                case 'Butler-SOS.cert.clientCertKey':
                    return './key.pem';
                case 'Butler-SOS.cert.clientCertCA':
                    return './ca.pem';
                case 'Butler-SOS.influxdbConfig.enable':
                    return true;
                case 'Butler-SOS.mqttConfig.enable':
                    return true;
                case 'Butler-SOS.newRelic.enable':
                    return true;
                case 'Butler-SOS.prometheus.enable':
                    return true;
                case 'Butler-SOS.serversToMonitor.rejectUnauthorized':
                    return false;
                default:
                    return undefined;
            }
        });

        globals.config.has.mockImplementation((key) => {
            if (key === 'Butler-SOS.cert.clientCertPassphrase') {
                return true;
            }
            return false;
        });

        // Mock file system
        fs.readFileSync.mockImplementation((filePath) => {
            if (filePath.endsWith('cert.pem')) return 'CERT_CONTENT';
            if (filePath.endsWith('key.pem')) return 'KEY_CONTENT';
            if (filePath.endsWith('ca.pem')) return 'CA_CONTENT';
            return '';
        });

        // Mock axios response
        const mockResponse = {
            status: 200,
            data: {
                health: 'OK',
                version: '1.0.0',
                started: '2023-01-01T00:00:00.000Z',
                mem: {
                    committed: 1000,
                    allocated: 800,
                    free: 200,
                },
                cpu: {
                    total: 10,
                },
                session: {
                    active: 5,
                },
                apps: {
                    active_docs: 3,
                    loaded_docs: 5,
                    in_memory_docs: 2,
                },
                users: {
                    active: 8,
                    total: 10,
                },
                cache: {
                    hits: 20,
                    lookups: 25,
                    added: 5,
                    replaced: 2,
                },
            },
        };

        // Mock axios.request
        axios.request = jest.fn().mockResolvedValue(mockResponse);

        // Call the function
        getHealthStatsFromSense(
            'server1',
            'server1.example.com',
            { host: 'server1' },
            {
                'X-Qlik-User': 'UserDirectory=Internal; UserId=sa_repository',
            }
        );

        // Allow promises to resolve
        await new Promise(process.nextTick);

        // Expectations
        expect(axios.request).toHaveBeenCalled();
        expect(globals.logger.debug).toHaveBeenCalledWith(
            'HEALTH: URL=https://server1.example.com/engine/healthcheck'
        );

        // Verify that metrics were posted to all enabled destinations
        expect(postHealthMetricsToInfluxdb).toHaveBeenCalled();
        expect(postHealthMetricsToNewRelic).toHaveBeenCalled();
        expect(postHealthToMQTT).toHaveBeenCalled();
        expect(saveHealthMetricsToPrometheus).toHaveBeenCalled();
    });

    test('should handle HTTP errors when getting health stats', async () => {
        // Mock certificate utils
        createCertificateOptions.mockReturnValue({});
        getCertificates.mockReturnValue({
            cert: 'CERT',
            key: 'KEY',
            ca: 'CA',
        });

        // Mock configuration
        globals.config.get.mockImplementation((key) => {
            switch (key) {
                case 'Butler-SOS.cert.clientCert':
                    return './cert.pem';
                case 'Butler-SOS.cert.clientCertKey':
                    return './key.pem';
                case 'Butler-SOS.cert.clientCertCA':
                    return './ca.pem';
                case 'Butler-SOS.serversToMonitor.rejectUnauthorized':
                    return false;
                default:
                    return undefined;
            }
        });

        globals.config.has.mockReturnValue(false);

        // Mock file system
        fs.readFileSync.mockImplementation((filePath) => {
            if (filePath.endsWith('cert.pem')) return 'CERT_CONTENT';
            if (filePath.endsWith('key.pem')) return 'KEY_CONTENT';
            if (filePath.endsWith('ca.pem')) return 'CA_CONTENT';
            return '';
        });

        // Mock axios to throw an error
        axios.request = jest.fn().mockRejectedValue(new Error('Connection refused'));

        // Call the function
        getHealthStatsFromSense(
            'server1',
            'server1.example.com',
            { host: 'server1' },
            {
                'X-Qlik-User': 'UserDirectory=Internal; UserId=sa_repository',
            }
        );

        // Allow promises to reject
        await new Promise(process.nextTick);

        // Expectations
        expect(axios.request).toHaveBeenCalled();
        expect(logError).toHaveBeenCalledWith(
            expect.stringContaining(
                "HEALTH: Error when calling health check API for server 'server1' (server1.example.com)"
            ),
            expect.any(Error)
        );

        // Verify that no metrics were posted
        expect(postHealthMetricsToInfluxdb).not.toHaveBeenCalled();
        expect(postHealthMetricsToNewRelic).not.toHaveBeenCalled();
        expect(postHealthToMQTT).not.toHaveBeenCalled();
        expect(saveHealthMetricsToPrometheus).not.toHaveBeenCalled();
    });

    test('should handle missing certificates', async () => {
        // Mock certificate utils to return missing certs
        createCertificateOptions.mockReturnValue({});
        getCertificates.mockReturnValue({
            cert: undefined,
            key: 'KEY',
            ca: 'CA',
        });

        // Call the function
        await getHealthStatsFromSense('server1', 'host1', {}, {});

        // Expectations
        expect(globals.logger.error).toHaveBeenCalledWith(
            'HEALTH: Client certificate or key was not found'
        );
    });

    test('should handle non-200 response code', async () => {
        // Mock certificate utils
        createCertificateOptions.mockReturnValue({});
        getCertificates.mockReturnValue({
            cert: 'CERT',
            key: 'KEY',
            ca: 'CA',
        });

        // Mock axios to return 404
        axios.request = jest.fn().mockResolvedValue({
            status: 404,
        });

        // Call the function
        await getHealthStatsFromSense('server1', 'host1', { host: 'host1' }, {});

        // Expectations
        expect(globals.logger.error).toHaveBeenCalledWith(
            expect.stringContaining('HEALTH: Received non-200 response code (404)')
        );
    });

    test('should setup health metrics timer and collect stats', async () => {
        jest.useFakeTimers();

        // Mock configuration
        globals.config.get.mockImplementation((key) => {
            if (key === 'Butler-SOS.serversToMonitor.pollingInterval') return 1000;
            return undefined;
        });

        // Mock server list
        globals.serverList = [
            {
                serverName: 'server1',
                host: 'host1',
            },
        ];

        // Mock tags and headers
        getServerTags.mockReturnValue({ host: 'host1' });
        getServerHeaders.mockReturnValue({});

        // Mock axios to succeed
        axios.request = jest.fn().mockResolvedValue({
            status: 200,
            data: {},
        });

        // Start the timer
        setupHealthMetricsTimer();

        // Fast-forward time
        jest.advanceTimersByTime(1000);

        // Allow async interval callback to run
        await jest.runOnlyPendingTimersAsync();

        // Expectations
        expect(globals.logger.verbose).toHaveBeenCalledWith(
            'HEALTH: Event started: Statistics collection'
        );
        expect(globals.logger.verbose).toHaveBeenCalledWith(
            'HEALTH: Getting stats for server: server1'
        );
        expect(axios.request).toHaveBeenCalled();
    });

    test('should skip collection if previous one is still in progress', async () => {
        jest.useFakeTimers();

        // Mock configuration
        globals.config.get.mockImplementation((key) => {
            if (key === 'Butler-SOS.serversToMonitor.pollingInterval') return 1000;
            return undefined;
        });

        // Mock server list with a slow server
        globals.serverList = [
            {
                serverName: 'server1',
                host: 'host1',
            },
        ];

        // Mock axios to be slow
        let resolveAxios;
        const axiosPromise = new Promise((resolve) => {
            resolveAxios = resolve;
        });
        axios.request = jest.fn().mockReturnValue(axiosPromise);

        // Start the timer
        setupHealthMetricsTimer();

        // First interval
        jest.advanceTimersByTime(1000);
        // We don't await runOnlyPendingTimersAsync here because it would wait for axiosPromise
        // Instead we just let the interval callback start
        await Promise.resolve();
        await Promise.resolve();

        expect(globals.logger.verbose).toHaveBeenCalledWith(
            'HEALTH: Event started: Statistics collection'
        );

        // Second interval while first is still running
        jest.advanceTimersByTime(1000);
        await Promise.resolve();
        await Promise.resolve();

        expect(globals.logger.warn).toHaveBeenCalledWith(
            'HEALTH: Previous health check collection still in progress, skipping this interval'
        );

        // Resolve first one
        resolveAxios({ status: 200, data: {} });
        await Promise.resolve();
        await Promise.resolve();

        // Third interval should now run
        jest.advanceTimersByTime(1000);
        await Promise.resolve();
        await Promise.resolve();

        expect(globals.logger.verbose).toHaveBeenCalledWith(
            'HEALTH: Event started: Statistics collection'
        );
    });

    test('should handle errors in the server loop', async () => {
        jest.useFakeTimers();

        // Mock configuration
        globals.config.get.mockImplementation((key) => {
            if (key === 'Butler-SOS.serversToMonitor.pollingInterval') return 1000;
            return undefined;
        });

        // Mock server list
        globals.serverList = [
            {
                serverName: 'server1',
                host: 'host1',
            },
        ];

        // Mock getServerTags to throw
        getServerTags.mockImplementation(() => {
            throw new Error('Tags error');
        });

        // Start the timer
        setupHealthMetricsTimer();

        // Fast-forward time
        jest.advanceTimersByTime(1000);
        await jest.runOnlyPendingTimersAsync();

        // Expectations
        expect(globals.logger.error).toHaveBeenCalledWith(
            expect.stringContaining(
                "HEALTH: Unexpected error processing health stats for server 'server1'"
            )
        );
    });
});
