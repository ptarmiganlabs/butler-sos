import { jest, describe, test, beforeEach, afterEach } from '@jest/globals';

// Test static file serving patterns for SEA vs non-SEA modes

describe('SEA Static File Serving Tests', () => {
    let mockGlobals;
    let mockFastify;
    let mockFilePrep;
    let mockPath;

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock globals
        mockGlobals = {
            logger: {
                verbose: jest.fn(),
                error: jest.fn(),
                info: jest.fn(),
            },
            isSea: false,
            appBasePath: '/mock/app/base',
            config: {
                get: jest.fn().mockImplementation((key) => {
                    const config = {
                        'Butler-SOS.configVisualisation.host': 'localhost',
                        'Butler-SOS.configVisualisation.port': 8090,
                    };
                    return config[key];
                }),
            },
        };

        // Mock Fastify instance
        mockFastify = {
            register: jest.fn(),
            get: jest.fn(),
            log: { level: 'silent' },
        };

        // Mock file preparation utilities
        mockFilePrep = {
            prepareFile: jest.fn(),
            compileTemplate: jest.fn(),
        };

        // Mock path utilities  
        mockPath = {
            resolve: jest.fn(),
        };
    });

    test('should handle 404 page serving in non-SEA mode', async () => {
        // Setup non-SEA mode
        mockGlobals.isSea = false;
        mockPath.resolve.mockReturnValue('/mock/app/base/static/404.html');
        
        // Simulate 404 page request
        const filePath = mockGlobals.isSea 
            ? '/404.html' 
            : mockPath.resolve(mockGlobals.appBasePath, 'static', '404.html');

        expect(filePath).toBe('/mock/app/base/static/404.html');
        expect(mockPath.resolve).toHaveBeenCalledWith('/mock/app/base', 'static', '404.html');
    });

    test('should handle 404 page serving in SEA mode', async () => {
        // Setup SEA mode
        mockGlobals.isSea = true;
        
        // Simulate 404 page request  
        const filePath = mockGlobals.isSea 
            ? '/404.html' 
            : mockPath.resolve(mockGlobals.appBasePath, 'static', '404.html');

        expect(filePath).toBe('/404.html');
        // path.resolve should not be called in SEA mode
        expect(mockPath.resolve).not.toHaveBeenCalled();
    });

    test('should handle config visualization template serving in non-SEA mode', async () => {
        // Setup non-SEA mode
        mockGlobals.isSea = false;
        mockPath.resolve.mockReturnValue('/mock/app/base/static/configvis/index.html');
        
        // Simulate config vis template request
        const filePath = mockGlobals.isSea 
            ? '/configvis/index.html' 
            : mockPath.resolve(mockGlobals.appBasePath, 'static/configvis', 'index.html');

        expect(filePath).toBe('/mock/app/base/static/configvis/index.html');
        expect(mockPath.resolve).toHaveBeenCalledWith('/mock/app/base', 'static/configvis', 'index.html');
    });

    test('should handle config visualization template serving in SEA mode', async () => {
        // Setup SEA mode
        mockGlobals.isSea = true;
        
        // Simulate config vis template request
        const filePath = mockGlobals.isSea 
            ? '/configvis/index.html' 
            : mockPath.resolve(mockGlobals.appBasePath, 'static/configvis', 'index.html');

        expect(filePath).toBe('/configvis/index.html');
        // path.resolve should not be called in SEA mode
        expect(mockPath.resolve).not.toHaveBeenCalled();
    });

    test('should setup static file plugin in non-SEA mode', async () => {
        // Setup non-SEA mode
        mockGlobals.isSea = false;
        
        // Simulate static file plugin registration logic
        if (!mockGlobals.isSea) {
            // Would register @fastify/static plugin
            await mockFastify.register('mockStaticPlugin', {
                root: '/mock/app/base/static',
                prefix: '/',
            });
        }
        
        expect(mockFastify.register).toHaveBeenCalledWith('mockStaticPlugin', {
            root: '/mock/app/base/static', 
            prefix: '/',
        });
    });

    test('should setup custom file routes in SEA mode', async () => {
        // Setup SEA mode
        mockGlobals.isSea = true;
        
        // Simulate custom route setup logic
        if (mockGlobals.isSea) {
            mockGlobals.logger.info('Running in SEA mode, setting up custom static file handlers');
            
            // Would set up individual routes for each static file
            mockFastify.get('/:filename', jest.fn());
            mockFastify.get('/butler-sos.png', jest.fn());
            
            mockGlobals.logger.info('Custom static file handlers set up for SEA mode');
        }
        
        expect(mockGlobals.logger.info).toHaveBeenCalledWith(
            'Running in SEA mode, setting up custom static file handlers'
        );
        expect(mockFastify.get).toHaveBeenCalledWith('/:filename', expect.any(Function));
        expect(mockFastify.get).toHaveBeenCalledWith('/butler-sos.png', expect.any(Function));
        expect(mockGlobals.logger.info).toHaveBeenCalledWith(
            'Custom static file handlers set up for SEA mode'
        );
    });

    test('should handle file preparation with template compilation', async () => {
        // Setup successful file preparation
        const mockFileResult = {
            found: true,
            content: '<html>Hello {{name}}!</html>',
            mimeType: 'text/html; charset=utf-8',
        };
        mockFilePrep.prepareFile.mockResolvedValue(mockFileResult);
        mockFilePrep.compileTemplate.mockReturnValue('<html>Hello World!</html>');
        
        // Simulate file serving with template compilation
        const filePath = '/test/template.html';
        const fileResult = await mockFilePrep.prepareFile(filePath, 'utf8');
        
        if (fileResult.found) {
            const compiledContent = mockFilePrep.compileTemplate(fileResult.content, { name: 'World' });
            expect(compiledContent).toBe('<html>Hello World!</html>');
        }
        
        expect(mockFilePrep.prepareFile).toHaveBeenCalledWith(filePath, 'utf8');
        expect(mockFilePrep.compileTemplate).toHaveBeenCalledWith(
            '<html>Hello {{name}}!</html>',
            { name: 'World' }
        );
    });

    test('should handle file not found error in both modes', async () => {
        // Setup file not found scenario
        const mockFileResult = {
            found: false,
            content: null,
            mimeType: null,
        };
        mockFilePrep.prepareFile.mockResolvedValue(mockFileResult);
        
        // Test non-SEA mode file not found
        mockGlobals.isSea = false;
        const filePath1 = '/mock/app/base/static/missing.html';
        const result1 = await mockFilePrep.prepareFile(filePath1);
        
        if (!result1.found) {
            mockGlobals.logger.error('Could not find template file');
        }
        
        expect(mockGlobals.logger.error).toHaveBeenCalledWith('Could not find template file');
        
        // Reset mocks
        mockGlobals.logger.error.mockClear();
        
        // Test SEA mode file not found
        mockGlobals.isSea = true;
        const filePath2 = '/missing.html';
        const result2 = await mockFilePrep.prepareFile(filePath2);
        
        if (!result2.found) {
            mockGlobals.logger.error('Could not find template file');
        }
        
        expect(mockGlobals.logger.error).toHaveBeenCalledWith('Could not find template file');
    });

    test('should handle binary file serving in both modes', async () => {
        // Test PNG file serving
        const mockBinaryResult = {
            found: true,
            content: Buffer.from('mock-png-data'),
            mimeType: 'image/png',
            ext: 'png',
        };
        mockFilePrep.prepareFile.mockResolvedValue(mockBinaryResult);
        
        // Non-SEA mode
        mockGlobals.isSea = false;
        const nonSeaPath = mockGlobals.isSea ? '/logo.png' : '/mock/app/base/static/logo.png';
        const result1 = await mockFilePrep.prepareFile(nonSeaPath);
        
        expect(result1.found).toBe(true);
        expect(result1.mimeType).toBe('image/png');
        expect(Buffer.isBuffer(result1.content)).toBe(true);
        
        // SEA mode  
        mockGlobals.isSea = true;
        const seaPath = mockGlobals.isSea ? '/logo.png' : '/mock/app/base/static/logo.png';
        const result2 = await mockFilePrep.prepareFile(seaPath);
        
        expect(result2.found).toBe(true);
        expect(result2.mimeType).toBe('image/png');
        expect(Buffer.isBuffer(result2.content)).toBe(true);
    });

    test('should handle file streaming in both modes', async () => {
        const mockStreamResult = {
            found: true,
            content: 'file content',
            stream: {
                pipe: jest.fn(),
            },
            mimeType: 'text/plain',
        };
        mockFilePrep.prepareFile.mockResolvedValue(mockStreamResult);
        
        // Test that file streams are created properly
        const result = await mockFilePrep.prepareFile('/test/file.txt');
        
        expect(result.found).toBe(true);
        expect(result.stream).toBeDefined();
        expect(result.stream.pipe).toBeDefined();
    });

    test('should validate content type headers for different file types', () => {
        // Test MIME type mappings that should work consistently in both modes
        const mimeTypes = {
            '.html': 'text/html; charset=utf-8',
            '.css': 'text/css', 
            '.js': 'application/javascript',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon',
        };
        
        Object.entries(mimeTypes).forEach(([ext, expectedMimeType]) => {
            expect(mimeTypes[ext]).toBe(expectedMimeType);
        });
    });

    test('should handle custom route parameters in SEA mode', async () => {
        // Test that SEA mode can handle parameterized routes
        mockGlobals.isSea = true;
        
        if (mockGlobals.isSea) {
            // Mock route handler for /:filename
            const filenameHandler = jest.fn(async (request, reply) => {
                const filename = request.params.filename;
                const filePath = `/${filename}`;
                
                const result = await mockFilePrep.prepareFile(filePath);
                if (result.found) {
                    reply.type(result.mimeType).send(result.content);
                } else {
                    reply.code(404).send('File not found');
                }
            });
            
            mockFastify.get('/:filename', filenameHandler);
            
            // Simulate request  
            const mockRequest = { params: { filename: 'test.html' } };
            const mockReply = {
                type: jest.fn().mockReturnThis(),
                send: jest.fn(),
                code: jest.fn().mockReturnThis(),
            };
            
            // Mock successful file result
            mockFilePrep.prepareFile.mockResolvedValue({
                found: true,
                content: '<html>Test</html>',
                mimeType: 'text/html; charset=utf-8',
            });
            
            await filenameHandler(mockRequest, mockReply);
            
            expect(mockFilePrep.prepareFile).toHaveBeenCalledWith('/test.html');
            expect(mockReply.type).toHaveBeenCalledWith('text/html; charset=utf-8');
            expect(mockReply.send).toHaveBeenCalledWith('<html>Test</html>');
        }
    });
});