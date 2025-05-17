import { jest, describe, test, beforeEach, afterEach } from '@jest/globals';

// Mock Fastify and other dependencies
jest.unstable_mockModule('fastify', () => {
    const mockFastifyInstance = {
        register: jest.fn().mockResolvedValue(undefined),
        setErrorHandler: jest.fn(),
        setNotFoundHandler: jest.fn(),
        get: jest.fn(),
        listen: jest.fn((options, callback) => {
            callback(null, 'http://127.0.0.1:8090');
            return mockFastifyInstance;
        }),
        ready: jest.fn((callback) => callback(null)),
        log: {
            level: 'silent',
            error: jest.fn(),
        },
    };

    return {
        default: jest.fn().mockReturnValue(mockFastifyInstance),
        __mockInstance: mockFastifyInstance,
    };
});

// Mock @fastify/rate-limit
jest.unstable_mockModule('@fastify/rate-limit', () => ({
    default: jest.fn().mockResolvedValue(undefined),
}));

// Mock @fastify/static
jest.unstable_mockModule('@fastify/static', () => ({
    default: jest.fn().mockResolvedValue(undefined),
}));

// Mock fs
jest.unstable_mockModule('fs', () => ({
    readdirSync: jest.fn().mockReturnValue(['file1', 'file2']),
    readFileSync: jest.fn().mockReturnValue('{{butlerSosConfigJsonEncoded}}{{butlerConfigYaml}}'),
}));

// Mock path
jest.unstable_mockModule('path', () => ({
    resolve: jest.fn().mockReturnValue('/mock/path'),
    join: jest.fn().mockReturnValue('/mock/path/static'),
}));

// Mock js-yaml
jest.unstable_mockModule('js-yaml', () => ({
    dump: jest.fn().mockReturnValue('mockYaml'),
}));

// Mock handlebars
jest.unstable_mockModule('handlebars', () => ({
    default: {
        compile: jest.fn().mockReturnValue((data) => `compiled:${JSON.stringify(data)}`),
    },
    compile: jest.fn().mockReturnValue((data) => `compiled:${JSON.stringify(data)}`),
}));

// Mock config-obfuscate
jest.unstable_mockModule('../config-obfuscate.js', () => ({
    default: jest.fn((config) => {
        return { ...config, obfuscated: true };
    }),
}));

// Mock globals
jest.unstable_mockModule('../../globals.js', () => ({
    default: {
        logger: {
            info: jest.fn(),
            verbose: jest.fn(),
            debug: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
        },
        getLoggingLevel: jest.fn().mockReturnValue('info'),
        appBasePath: '/mock/app/base/path',
        config: {
            get: jest.fn((path) => {
                if (path === 'Butler-SOS.configVisualisation.obfuscate') return true;
                if (path === 'Butler-SOS.configVisualisation.host') return '127.0.0.1';
                if (path === 'Butler-SOS.configVisualisation.port') return 8090;
                return null;
            }),
        },
    },
}));

// Mock modules for '../plugins/sensible.js' and '../plugins/support.js'
// jest.unstable_mockModule('../plugins/sensible.js', () => ({
//     default: jest.fn(),
// }));

// jest.unstable_mockModule('../plugins/support.js', () => ({
//     default: jest.fn(),
// }));

describe('config-visualise', () => {
    let mockFastify;
    let configObfuscate;
    let globals;
    let setupConfigVisServer;
    let fs;
    let path;
    let yaml;
    let handlebars;
    let fastifyModule;

    beforeEach(async () => {
        // Clear all mocks before each test
        jest.clearAllMocks();

        // Import mocked modules
        fastifyModule = await import('fastify');
        mockFastify = fastifyModule.default;

        configObfuscate = (await import('../config-obfuscate.js')).default;
        globals = (await import('../../globals.js')).default;
        fs = await import('fs');
        path = await import('path');
        yaml = await import('js-yaml');
        handlebars = await import('handlebars');

        // Import the module under test
        setupConfigVisServer = (await import('../config-visualise.js')).setupConfigVisServer;
    });

    test('should set up server with correct configuration', async () => {
        // Call the function being tested
        await setupConfigVisServer(globals.logger, globals.config);

        // Verify Fastify was initialized
        expect(mockFastify).toHaveBeenCalled();

        // Verify rate limit plugin was registered
        expect(fastifyModule.__mockInstance.register).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                max: 300,
                timeWindow: '1 minute',
            })
        );

        // Verify static file server was set up
        expect(fastifyModule.__mockInstance.register).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                root: expect.any(String),
                redirect: true,
            })
        );

        // Verify route handler was set up
        expect(fastifyModule.__mockInstance.get).toHaveBeenCalledWith('/', expect.any(Function));

        // Verify server was started
        expect(fastifyModule.__mockInstance.listen).toHaveBeenCalledWith(
            {
                host: '127.0.0.1',
                port: 8090,
            },
            expect.any(Function)
        );

        // Verify success was logged
        expect(globals.logger.info).toHaveBeenCalledWith(
            expect.stringContaining('Config visualisation server listening on')
        );
    });

    test('should handle errors during server setup', async () => {
        // Make Fastify.listen throw an error
        fastifyModule.__mockInstance.listen.mockImplementationOnce((options, callback) => {
            callback(new Error('Failed to start server'), null);
            return fastifyModule.__mockInstance;
        });

        // Mock process.exit to prevent test from exiting
        const originalExit = process.exit;
        process.exit = jest.fn();

        try {
            // Call the function being tested
            await setupConfigVisServer(globals.logger, globals.config);

            // Verify error was logged
            expect(globals.logger.error).toHaveBeenCalledWith(
                expect.stringContaining('Could not set up config visualisation server')
            );
            expect(process.exit).toHaveBeenCalledWith(1);
        } finally {
            // Restore process.exit
            process.exit = originalExit;
        }
    });
});
