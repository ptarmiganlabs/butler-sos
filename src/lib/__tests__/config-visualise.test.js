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

// Mock file-prep
jest.unstable_mockModule('../file-prep.js', () => ({
    prepareFile: jest.fn().mockResolvedValue({
        found: true,
        content:
            'file content {{visTaskHost}} {{visTaskPort}} {{butlerSosConfigJsonEncoded}} {{butlerConfigYaml}}',
        mimeType: 'text/html',
    }),
    compileTemplate: jest.fn().mockReturnValue('compiled template'),
}));

// Mock sea-wrapper (needed by file-prep.js)
jest.unstable_mockModule('../sea-wrapper.js', () => ({
    default: {
        getAsset: jest.fn(),
        isSea: jest.fn().mockReturnValue(false),
    },
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

    test('should set log level to info when debug/silly logging is enabled', async () => {
        globals.getLoggingLevel.mockReturnValueOnce('debug');

        await setupConfigVisServer(globals.logger, globals.config);

        expect(fastifyModule.__mockInstance.log.level).toBe('info');
    });

    test('should set log level to silent for other log levels', async () => {
        globals.getLoggingLevel.mockReturnValueOnce('error');

        await setupConfigVisServer(globals.logger, globals.config);

        expect(fastifyModule.__mockInstance.log.level).toBe('silent');
    });

    test('should set up error handler for rate limiting', async () => {
        await setupConfigVisServer(globals.logger, globals.config);

        expect(fastifyModule.__mockInstance.setErrorHandler).toHaveBeenCalledWith(
            expect.any(Function)
        );

        // Test the error handler
        const errorHandler = fastifyModule.__mockInstance.setErrorHandler.mock.calls[0][0];
        const mockRequest = { ip: '127.0.0.1', method: 'GET', url: '/test' };
        const mockReply = { send: jest.fn() };
        const mockError = { statusCode: 429 };

        errorHandler(mockError, mockRequest, mockReply);

        expect(globals.logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('Rate limit exceeded for source IP address 127.0.0.1')
        );
        expect(mockReply.send).toHaveBeenCalledWith(mockError);
    });

    test('should handle root route with obfuscation enabled', async () => {
        const filePrep = await import('../file-prep.js');

        await setupConfigVisServer(globals.logger, globals.config);

        // Get the root route handler
        const rootRouteCall = fastifyModule.__mockInstance.get.mock.calls.find(
            (call) => call[0] === '/'
        );
        expect(rootRouteCall).toBeDefined();

        const routeHandler = rootRouteCall[1];
        const mockRequest = {};
        const mockReply = {
            code: jest.fn().mockReturnThis(),
            header: jest.fn().mockReturnThis(),
            send: jest.fn(),
        };

        await routeHandler(mockRequest, mockReply);

        expect(filePrep.prepareFile).toHaveBeenCalled();
        expect(filePrep.compileTemplate).toHaveBeenCalled();
        expect(configObfuscate).toHaveBeenCalled();
        expect(yaml.dump).toHaveBeenCalled();
        expect(mockReply.code).toHaveBeenCalledWith(200);
        expect(mockReply.header).toHaveBeenCalledWith('Content-Type', 'text/html; charset=utf-8');
        expect(mockReply.send).toHaveBeenCalled();
    });

    test('should handle root route with obfuscation disabled', async () => {
        globals.config.get.mockImplementation((path) => {
            if (path === 'Butler-SOS.configVisualisation.obfuscate') return false;
            if (path === 'Butler-SOS.configVisualisation.host') return '127.0.0.1';
            if (path === 'Butler-SOS.configVisualisation.port') return 8090;
            return null;
        });

        await setupConfigVisServer(globals.logger, globals.config);

        // Get the root route handler
        const rootRouteCall = fastifyModule.__mockInstance.get.mock.calls.find(
            (call) => call[0] === '/'
        );
        const routeHandler = rootRouteCall[1];
        const mockRequest = {};
        const mockReply = {
            code: jest.fn().mockReturnThis(),
            header: jest.fn().mockReturnThis(),
            send: jest.fn(),
        };

        await routeHandler(mockRequest, mockReply);

        expect(configObfuscate).not.toHaveBeenCalled();
    });

    test('should handle root route error when template not found', async () => {
        const filePrep = await import('../file-prep.js');
        filePrep.prepareFile.mockResolvedValueOnce({
            found: false,
            content: null,
            mimeType: null,
        });

        await setupConfigVisServer(globals.logger, globals.config);

        const rootRouteCall = fastifyModule.__mockInstance.get.mock.calls.find(
            (call) => call[0] === '/'
        );
        const routeHandler = rootRouteCall[1];
        const mockRequest = {};
        const mockReply = {
            code: jest.fn().mockReturnThis(),
            send: jest.fn(),
        };

        await routeHandler(mockRequest, mockReply);

        expect(globals.logger.error).toHaveBeenCalledWith(
            expect.stringContaining('Could not find index.html template')
        );
        expect(mockReply.code).toHaveBeenCalledWith(500);
        expect(mockReply.send).toHaveBeenCalledWith({
            error: 'Internal server error: Template not found',
        });
    });

    test('should handle root route error during processing', async () => {
        yaml.dump.mockImplementationOnce(() => {
            throw new Error('YAML dump failed');
        });

        await setupConfigVisServer(globals.logger, globals.config);

        const rootRouteCall = fastifyModule.__mockInstance.get.mock.calls.find(
            (call) => call[0] === '/'
        );
        const routeHandler = rootRouteCall[1];
        const mockRequest = {};
        const mockReply = {
            code: jest.fn().mockReturnThis(),
            send: jest.fn(),
        };

        await routeHandler(mockRequest, mockReply);

        expect(globals.logger.error).toHaveBeenCalledWith(
            expect.stringContaining('Error serving home page')
        );
        expect(mockReply.code).toHaveBeenCalledWith(500);
        expect(mockReply.send).toHaveBeenCalledWith({ error: 'Internal server error' });
    });

    test('should handle SEA mode setup', async () => {
        globals.isSea = true;

        await setupConfigVisServer(globals.logger, globals.config);

        expect(globals.logger.info).toHaveBeenCalledWith(
            expect.stringContaining('Running in SEA mode, setting up custom static file handlers')
        );
        expect(globals.logger.info).toHaveBeenCalledWith(
            expect.stringContaining('Custom static file handlers set up for SEA mode')
        );

        // Verify SEA-specific routes were set up
        const getRoutes = fastifyModule.__mockInstance.get.mock.calls;
        const filenameRoute = getRoutes.find((call) => call[0] === '/:filename');
        const logoRoute = getRoutes.find((call) => call[0] === '/butler-sos.png');

        expect(filenameRoute).toBeDefined();
        expect(logoRoute).toBeDefined();
    });

    test('should handle SEA mode filename route', async () => {
        globals.isSea = true;
        const filePrep = await import('../file-prep.js');

        await setupConfigVisServer(globals.logger, globals.config);

        const getRoutes = fastifyModule.__mockInstance.get.mock.calls;
        const filenameRoute = getRoutes.find((call) => call[0] === '/:filename');
        const routeHandler = filenameRoute[1];

        expect(filenameRoute).toBeDefined();
        expect(typeof routeHandler).toBe('function');
    });

    test('should handle SEA mode logo route', async () => {
        globals.isSea = true;

        await setupConfigVisServer(globals.logger, globals.config);

        const getRoutes = fastifyModule.__mockInstance.get.mock.calls;
        const logoRoute = getRoutes.find((call) => call[0] === '/butler-sos.png');

        expect(logoRoute).toBeDefined();
        expect(typeof logoRoute[1]).toBe('function');
    });

    test('should handle Node.js mode static file setup', async () => {
        globals.isSea = false;

        await setupConfigVisServer(globals.logger, globals.config);

        expect(globals.logger.info).toHaveBeenCalledWith(
            expect.stringContaining('Serving static files from')
        );

        // Verify FastifyStatic was registered
        const registerCalls = fastifyModule.__mockInstance.register.mock.calls;
        const staticRegister = registerCalls.find(
            (call) => call[1] && call[1].root && call[1].redirect === true
        );
        expect(staticRegister).toBeDefined();
    });

    test('should handle fs.readdirSync error in Node.js mode', async () => {
        globals.isSea = false;
        fs.readdirSync.mockImplementationOnce(() => {
            throw new Error('Permission denied');
        });

        await setupConfigVisServer(globals.logger, globals.config);

        expect(globals.logger.error).toHaveBeenCalledWith(
            expect.stringContaining('Error reading static directory')
        );
    });

    test('should set up not found handler', async () => {
        await setupConfigVisServer(globals.logger, globals.config);

        expect(fastifyModule.__mockInstance.setNotFoundHandler).toHaveBeenCalled();
    });

    test('should handle general setup errors', async () => {
        fastifyModule.__mockInstance.register.mockRejectedValueOnce(
            new Error('Plugin registration failed')
        );

        await expect(setupConfigVisServer(globals.logger, globals.config)).rejects.toThrow(
            'Plugin registration failed'
        );

        expect(globals.logger.error).toHaveBeenCalledWith(
            expect.stringContaining('Error setting up config visualisation server')
        );
    });

    test('should handle SEA mode filename route execution with successful file', async () => {
        globals.isSea = true;

        await setupConfigVisServer(globals.logger, globals.config);

        // Verify that the /:filename route was set up in SEA mode
        const getRoutes = fastifyModule.__mockInstance.get.mock.calls;
        const filenameRoute = getRoutes.find((call) => call[0] === '/:filename');

        expect(filenameRoute).toBeDefined();
        expect(typeof filenameRoute[1]).toBe('function');

        // Verify that the SEA mode info was logged
        expect(globals.logger.info).toHaveBeenCalledWith(
            expect.stringContaining('Running in SEA mode, setting up custom static file handlers')
        );
    });

    test('should handle serve404Page function execution', async () => {
        globals.isSea = false;
        const filePrep = await import('../file-prep.js');
        filePrep.prepareFile.mockResolvedValueOnce({
            found: true,
            content: 'Not found page content {{visTaskHost}} {{visTaskPort}}',
            mimeType: 'text/html',
        });

        await setupConfigVisServer(globals.logger, globals.config);

        // Get the not found handler
        const notFoundHandler = fastifyModule.__mockInstance.setNotFoundHandler.mock.calls[0][0];

        const mockRequest = {};
        const mockReply = {
            code: jest.fn().mockReturnThis(),
            header: jest.fn().mockReturnThis(),
            send: jest.fn(),
        };

        await notFoundHandler(mockRequest, mockReply);

        expect(filePrep.prepareFile).toHaveBeenCalled();
        expect(filePrep.compileTemplate).toHaveBeenCalled();
        expect(mockReply.code).toHaveBeenCalledWith(404);
        expect(mockReply.header).toHaveBeenCalledWith('Content-Type', 'text/html; charset=utf-8');
        expect(mockReply.send).toHaveBeenCalledWith('compiled template');
    });

    afterEach(() => {
        // Reset globals
        globals.isSea = false;
    });
});
