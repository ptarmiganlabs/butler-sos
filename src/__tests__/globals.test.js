import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// Mock dependencies
jest.unstable_mockModule('fs', () => ({
    readFileSync: jest.fn(),
}));

jest.unstable_mockModule('fs-extra', () => ({
    default: {
        pathExistsSync: jest.fn(),
        readFileSync: jest.fn(),
        accessSync: jest.fn(),
        constants: {
            F_OK: 0,
        },
    },
}));

jest.unstable_mockModule('mqtt', () => ({
    default: {
        connect: jest.fn().mockReturnValue({
            on: jest.fn(),
            publish: jest.fn(),
        }),
    },
}));

jest.unstable_mockModule('influx', () => {
    const FieldType = {
        STRING: 'string',
        INTEGER: 'integer',
        FLOAT: 'float',
    };
    const InfluxDB = jest.fn().mockImplementation(() => ({
        getDatabaseNames: jest.fn().mockResolvedValue(['db1']),
        createDatabase: jest.fn().mockResolvedValue({}),
        createRetentionPolicy: jest.fn().mockResolvedValue({}),
    }));
    return {
        default: {
            InfluxDB,
            FieldType,
        },
        FieldType,
    };
});

jest.unstable_mockModule('@influxdata/influxdb-client', () => ({
    InfluxDB: jest.fn().mockImplementation(() => ({
        getWriteApi: jest.fn().mockReturnValue({
            useDefaultTags: jest.fn(),
        }),
    })),
    Point: jest.fn().mockImplementation(() => ({
        tag: jest.fn().mockReturnThis(),
        floatField: jest.fn().mockReturnThis(),
        intField: jest.fn().mockReturnThis(),
        stringField: jest.fn().mockReturnThis(),
        booleanField: jest.fn().mockReturnThis(),
        timestamp: jest.fn().mockReturnThis(),
    })),
    HttpError: class extends Error {},
    DEFAULT_WriteOptions: {},
}));

jest.unstable_mockModule('@influxdata/influxdb-client-apis', () => ({
    OrgsAPI: jest.fn().mockImplementation(() => ({
        getOrgs: jest.fn().mockResolvedValue({ orgs: [{ id: 'org1', name: 'org1' }] }),
    })),
    BucketsAPI: jest.fn().mockImplementation(() => ({
        getBuckets: jest.fn().mockResolvedValue({ buckets: [{ name: 'bucket1' }] }),
    })),
}));

jest.unstable_mockModule('@influxdata/influxdb3-client', () => ({
    InfluxDBClient: jest.fn(),
    Point: jest.fn(),
    setLogger: jest.fn(),
}));

jest.unstable_mockModule('winston', () => ({
    default: {
        createLogger: jest.fn().mockReturnValue({
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
            verbose: jest.fn(),
            add: jest.fn(),
            clear: jest.fn(),
        }),
        format: {
            combine: jest.fn(),
            timestamp: jest.fn(),
            printf: jest.fn(),
            colorize: jest.fn(),
            uncolorize: jest.fn(),
            ms: jest.fn(),
            errors: jest.fn(),
            simple: jest.fn(),
            json: jest.fn(),
        },
        transports: {
            Console: jest.fn(),
            File: jest.fn(),
            DailyRotateFile: jest.fn(),
        },
    },
}));

jest.unstable_mockModule('crypto', () => ({
    default: {
        createHmac: jest.fn().mockReturnValue({
            update: jest.fn().mockReturnThis(),
            digest: jest.fn().mockReturnValue('mock-hash'),
        }),
    },
}));

jest.unstable_mockModule('systeminformation', () => ({
    default: {
        osInfo: jest.fn().mockResolvedValue({}),
        uuid: jest.fn().mockResolvedValue({}),
        cpu: jest.fn().mockResolvedValue({}),
        system: jest.fn().mockResolvedValue({ uuid: 'test-uuid' }),
        mem: jest.fn().mockResolvedValue({ total: 1024 }),
        dockerInfo: jest.fn().mockResolvedValue({}),
        networkInterfaces: jest.fn().mockResolvedValue([
            { iface: 'eth0', mac: '00:00:00:00:00:00', ip4: '127.0.0.1' }
        ]),
        networkInterfaceDefault: jest.fn().mockResolvedValue('eth0'),
    },
}));

jest.unstable_mockModule('commander', () => ({
    Command: jest.fn().mockImplementation(() => ({
        version: jest.fn().mockReturnThis(),
        name: jest.fn().mockReturnThis(),
        description: jest.fn().mockReturnThis(),
        addHelpText: jest.fn().mockReturnThis(),
        addOption: jest.fn().mockReturnThis(),
        option: jest.fn().mockReturnThis(),
        parse: jest.fn().mockReturnThis(),
        help: jest.fn().mockReturnThis(),
        opts: jest.fn().mockReturnValue({ configfile: 'test.yaml' }),
    })),
    Option: jest.fn().mockImplementation(() => ({
        choices: jest.fn().mockReturnThis(),
    })),
}));

jest.unstable_mockModule('../lib/sea-wrapper.js', () => ({
    default: {
        isSea: jest.fn().mockReturnValue(false),
        getAsset: jest.fn(),
        initialize: jest.fn().mockResolvedValue({}),
    },
}));

jest.unstable_mockModule('../lib/config-file-verify.js', () => ({
    verifyConfigFileSchema: jest.fn().mockReturnValue(true),
    verifyAppConfig: jest.fn().mockReturnValue(true),
}));

jest.unstable_mockModule('../lib/error-tracker.js', () => ({
    ErrorTracker: jest.fn().mockImplementation(() => ({
        incrementError: jest.fn(),
    })),
    setupErrorCounterReset: jest.fn(),
}));

jest.unstable_mockModule('../lib/udp-event.js', () => ({
    UdpEvents: jest.fn().mockImplementation(() => ({
        logEvents: [],
        userEvents: [],
        rejectedLogEvents: [],
    })),
}));

jest.unstable_mockModule('../lib/udp-queue-manager.js', () => ({
    UdpQueueManager: jest.fn().mockImplementation(() => ({
        queue: {
            on: jest.fn(),
        },
    })),
}));

jest.unstable_mockModule('winston-daily-rotate-file', () => ({
    default: jest.fn(),
}));

jest.unstable_mockModule('config', () => ({
    default: {
        get: jest.fn().mockImplementation((path) => {
            if (path === 'Butler-SOS.logLevel') return 'info';
            if (path === 'Butler-SOS.logDirectory') return 'log';
            if (path === 'Butler-SOS.fileLogging') return false;
            if (path === 'Butler-SOS.influxdbConfig.enable') return false;
            if (path === 'Butler-SOS.mqttConfig.enable') return false;
            if (path === 'Butler-SOS.anonTelemetry') return false;
            if (path === 'Butler-SOS.cert.clientCert') return 'cert.pem';
            if (path === 'Butler-SOS.cert.clientCertKey') return 'key.pem';
            if (path === 'Butler-SOS.cert.clientCertCA') return 'ca.pem';
            return null;
        }),
        has: jest.fn().mockReturnValue(true),
        'Butler-SOS': {
            logLevel: 'info',
            logDirectory: 'log',
            fileLogging: false,
            thirdPartyToolsCredentials: {
                newRelic: [],
            },
            influxdbConfig: {
                enable: false,
            },
            mqttConfig: {
                enable: false,
            },
            anonTelemetry: false,
        },
    },
}));

jest.unstable_mockModule('js-yaml', () => ({
    load: jest.fn().mockReturnValue({
        'Butler-SOS': {
            influxdbConfig: { enable: false },
            mqttConfig: { enable: false },
            anonTelemetry: false,
            logLevel: 'info',
        },
    }),
}));

jest.unstable_mockModule('node:url', () => ({
    fileURLToPath: jest.fn().mockReturnValue('/path/to/globals.js'),
}));

// Import globals
const { Settings } = await import('../globals.js');
const globals = (await import('../globals.js')).default;
const fs = (await import('fs-extra')).default;
const sea = (await import('../lib/sea-wrapper.js')).default;
const config = (await import('config')).default;

describe('globals', () => {
    beforeEach(async () => {
        jest.clearAllMocks();
        // Reset globals state if possible, but it's a singleton
        globals.initialised = false;

        const fs = await import('fs');
        fs.readFileSync.mockReturnValue(JSON.stringify({ version: '1.0.0' }));
    });

    test('getErrorMessage should format error correctly', () => {
        const err = new Error('Test error');
        // Since isSea is false by default in our mock, it should return the stack trace
        expect(globals.getErrorMessage(err)).toContain('Test error');
        expect(globals.getErrorMessage(err)).toContain('Error: Test error');

        const stringErr = 'String error';
        expect(globals.getErrorMessage(stringErr)).toBe('String error');
    });

    test('sleep should resolve after timeout', async () => {
        const start = Date.now();
        await Settings.sleep(10);
        const end = Date.now();
        expect(end - start).toBeGreaterThanOrEqual(10);
    });

    test('checkFileExistsSync should return true if file exists', () => {
        fs.accessSync.mockReturnValue(undefined); // success
        expect(Settings.checkFileExistsSync('test.txt')).toBe(true);

        fs.accessSync.mockImplementation(() => {
            throw new Error('File not found');
        });
        expect(Settings.checkFileExistsSync('nonexistent.txt')).toBe(false);
    });

    test('init should initialize the application', async () => {
        const fsExtra = (await import('fs-extra')).default;
        fsExtra.accessSync.mockReturnValue(undefined);

        jest.spyOn(process, 'exit').mockImplementation(() => {});

        const settings = new Settings();
        settings.config = config;

        await settings.init();

        expect(settings.initialised).toBe(true);
        expect(settings.logger).toBeDefined();
    });

    test('init should initialize InfluxDB v1', async () => {
        const settings = new Settings();
        settings.config = config;

        jest.mocked(config.get).mockImplementation((path) => {
            if (path === 'Butler-SOS.influxdbConfig.enable') return true;
            if (path === 'Butler-SOS.influxdbConfig.version') return 1;
            if (path === 'Butler-SOS.influxdbConfig.v1Config.dbName') return 'testdb';
            if (path === 'Butler-SOS.influxdbConfig.v1Config.auth.enable') return false;
            if (path === 'Butler-SOS.logLevel') return 'info';
            if (path === 'Butler-SOS.logDirectory') return 'log';
            if (path === 'Butler-SOS.fileLogging') return false;
            if (path === 'Butler-SOS.mqttConfig.enable') return false;
            if (path === 'Butler-SOS.anonTelemetry') return false;
            if (path === 'Butler-SOS.cert.clientCert') return 'cert.pem';
            if (path === 'Butler-SOS.cert.clientCertKey') return 'key.pem';
            if (path === 'Butler-SOS.cert.clientCertCA') return 'ca.pem';
            return null;
        });

        await settings.init();
        expect(settings.influx).toBeDefined();
    });

    test('init should initialize InfluxDB v2', async () => {
        const settings = new Settings();
        settings.config = config;

        jest.mocked(config.get).mockImplementation((path) => {
            if (path === 'Butler-SOS.influxdbConfig.enable') return true;
            if (path === 'Butler-SOS.influxdbConfig.version') return 2;
            if (path === 'Butler-SOS.influxdbConfig.host') return 'localhost';
            if (path === 'Butler-SOS.influxdbConfig.port') return 8086;
            if (path === 'Butler-SOS.influxdbConfig.v2Config.token') return 'test-token';
            if (path === 'Butler-SOS.logLevel') return 'info';
            if (path === 'Butler-SOS.logDirectory') return 'log';
            if (path === 'Butler-SOS.fileLogging') return false;
            if (path === 'Butler-SOS.mqttConfig.enable') return false;
            if (path === 'Butler-SOS.anonTelemetry') return false;
            if (path === 'Butler-SOS.cert.clientCert') return 'cert.pem';
            if (path === 'Butler-SOS.cert.clientCertKey') return 'key.pem';
            if (path === 'Butler-SOS.cert.clientCertCA') return 'ca.pem';
            return null;
        });

        await settings.init();
        expect(settings.influx).toBeDefined();
    });

    test('init should initialize MQTT', async () => {
        const settings = new Settings();
        settings.config = config;

        jest.mocked(config.get).mockImplementation((path) => {
            if (path === 'Butler-SOS.mqttConfig.enable') return true;
            if (path === 'Butler-SOS.mqttConfig.brokerHost') return 'localhost';
            if (path === 'Butler-SOS.mqttConfig.brokerPort') return 1883;
            if (path === 'Butler-SOS.mqttConfig.azureEventGrid.enable') return false;
            if (path === 'Butler-SOS.logLevel') return 'info';
            if (path === 'Butler-SOS.logDirectory') return 'log';
            if (path === 'Butler-SOS.fileLogging') return false;
            if (path === 'Butler-SOS.influxdbConfig.enable') return false;
            if (path === 'Butler-SOS.anonTelemetry') return false;
            if (path === 'Butler-SOS.cert.clientCert') return 'cert.pem';
            if (path === 'Butler-SOS.cert.clientCertKey') return 'key.pem';
            if (path === 'Butler-SOS.cert.clientCertCA') return 'ca.pem';
            return null;
        });

        await settings.init();
        expect(settings.mqttClient).toBeDefined();
    });

    test('initHostInfo should return host information', async () => {
        const settings = new Settings();
        settings.config = config;
        settings.logger = {
            info: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        };

        jest.mocked(config.get).mockImplementation((path) => {
            if (path === 'Butler-SOS.systemInfo.enable') return true;
            return null;
        });

        const hostInfo = await settings.initHostInfo();
        expect(hostInfo).toBeDefined();
        expect(hostInfo.id).toBe('mock-hash');
    });

    test('initHostInfo should handle errors', async () => {
        const settings = new Settings();
        settings.config = config;
        settings.logger = {
            error: jest.fn(),
        };

        jest.mocked(config.get).mockImplementation(() => {
            throw new Error('Config error');
        });

        const hostInfo = await settings.initHostInfo();
        expect(hostInfo).toBeNull();
        expect(settings.logger.error).toHaveBeenCalled();
    });

    test('isRunningInDocker should return true if .dockerenv exists', async () => {
        const fsExtra = (await import('fs-extra')).default;
        fsExtra.accessSync.mockReturnValue(undefined);

        expect(Settings.isRunningInDocker()).toBe(true);
    });

    test('isRunningInDocker should return false if .dockerenv does not exist', async () => {
        const fsExtra = (await import('fs-extra')).default;
        fsExtra.accessSync.mockImplementation(() => {
            throw new Error('Not in docker');
        });

        expect(Settings.isRunningInDocker()).toBe(false);
    });

    test('init should initialize InfluxDB v3', async () => {
        const settings = new Settings();
        settings.config = config;

        jest.mocked(config.get).mockImplementation((path) => {
            if (path === 'Butler-SOS.influxdbConfig.enable') return true;
            if (path === 'Butler-SOS.influxdbConfig.version') return 3;
            if (path === 'Butler-SOS.influxdbConfig.host') return 'localhost';
            if (path === 'Butler-SOS.influxdbConfig.port') return 8086;
            if (path === 'Butler-SOS.influxdbConfig.v3Config.token') return 'test-token';
            if (path === 'Butler-SOS.influxdbConfig.v3Config.database') return 'testdb';
            if (path === 'Butler-SOS.logLevel') return 'info';
            if (path === 'Butler-SOS.logDirectory') return 'log';
            if (path === 'Butler-SOS.fileLogging') return false;
            if (path === 'Butler-SOS.mqttConfig.enable') return false;
            if (path === 'Butler-SOS.anonTelemetry') return false;
            if (path === 'Butler-SOS.cert.clientCert') return 'cert.pem';
            if (path === 'Butler-SOS.cert.clientCertKey') return 'key.pem';
            if (path === 'Butler-SOS.cert.clientCertCA') return 'ca.pem';
            return null;
        });

        // Mock InfluxDB v3 query iterator
        const mockInflux3 = {
            query: jest.fn().mockReturnValue({
                [Symbol.asyncIterator]: jest.fn().mockReturnValue({
                    next: jest.fn().mockResolvedValue({ done: true }),
                }),
            }),
        };
        const { InfluxDBClient } = await import('@influxdata/influxdb3-client');
        jest.mocked(InfluxDBClient).mockReturnValue(mockInflux3);

        await settings.init();
        expect(settings.influx).toBeDefined();
    });
});
