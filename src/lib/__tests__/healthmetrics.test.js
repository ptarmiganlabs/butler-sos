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
        },
        config: {
            get: jest.fn(),
            has: jest.fn(),
        },
    },
}));
const globals = (await import('../../globals.js')).default;

jest.unstable_mockModule('../post-to-influxdb.js', () => ({
    postHealthMetricsToInfluxdb: jest.fn(),
}));
const { postHealthMetricsToInfluxdb } = await import('../post-to-influxdb.js');

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

// Import the module to test
const { getHealthStatsFromSense } = await import('../healthmetrics.js');

describe('healthmetrics', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    test('should successfully get health metrics from Sense', async () => {
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
        expect(globals.logger.error).toHaveBeenCalledWith(
            expect.stringContaining('HEALTH: Error when calling health check API:')
        );

        // Verify that no metrics were posted
        expect(postHealthMetricsToInfluxdb).not.toHaveBeenCalled();
        expect(postHealthMetricsToNewRelic).not.toHaveBeenCalled();
        expect(postHealthToMQTT).not.toHaveBeenCalled();
        expect(saveHealthMetricsToPrometheus).not.toHaveBeenCalled();
    });
});
