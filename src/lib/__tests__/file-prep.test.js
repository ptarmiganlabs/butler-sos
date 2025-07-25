import { jest, describe, test, beforeEach, afterEach } from '@jest/globals';

// Mock dependencies
jest.unstable_mockModule('fs', () => ({
    existsSync: jest.fn(),
    readFileSync: jest.fn(),
}));

jest.unstable_mockModule('path', () => ({
    extname: jest.fn(),
}));

jest.unstable_mockModule('node:sea', () => ({
    default: {
        getAsset: jest.fn(),
    },
}));

jest.unstable_mockModule('handlebars', () => ({
    default: {
        compile: jest.fn(),
    },
}));

jest.unstable_mockModule('../../globals.js', () => ({
    default: {
        logger: {
            verbose: jest.fn(),
            error: jest.fn(),
        },
        isSea: false,
    },
}));

// Import mocked modules
const fs = await import('fs');
const path = await import('path');
const sea = (await import('node:sea')).default;
const handlebars = (await import('handlebars')).default;
const globals = (await import('../../globals.js')).default;

// Import the module under test
const { prepareFile, compileTemplate, getFileContent, getMimeType } = await import(
    '../file-prep.js'
);

describe('file-prep', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        globals.isSea = false;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('prepareFile', () => {
        test('should prepare text file from filesystem successfully', async () => {
            // Setup mocks
            path.extname.mockReturnValue('.html');
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('<html>Test content</html>');

            // Execute
            const result = await prepareFile('/test/file.html');

            // Verify
            expect(result.found).toBe(true);
            expect(result.ext).toBe('html');
            expect(result.mimeType).toBe('text/html; charset=utf-8');
            expect(result.content).toBe('<html>Test content</html>');
            expect(result.stream).toBeDefined();
            expect(fs.readFileSync).toHaveBeenCalledWith('/test/file.html', 'utf8');
        });

        test('should prepare binary file from filesystem successfully', async () => {
            // Setup mocks
            path.extname.mockReturnValue('.png');
            fs.existsSync.mockReturnValue(true);
            const mockBuffer = Buffer.from('binary data');
            fs.readFileSync.mockReturnValue(mockBuffer);

            // Execute
            const result = await prepareFile('/test/image.png');

            // Verify
            expect(result.found).toBe(true);
            expect(result.ext).toBe('png');
            expect(result.mimeType).toBe('image/png');
            expect(result.content).toBe(mockBuffer);
            expect(fs.readFileSync).toHaveBeenCalledWith('/test/image.png');
        });

        test('should handle file not found in filesystem', async () => {
            // Setup mocks
            path.extname.mockReturnValue('.html');
            fs.existsSync.mockReturnValue(false);

            // Execute
            const result = await prepareFile('/test/nonexistent.html');

            // Verify
            expect(result.found).toBe(false);
            expect(result.ext).toBe('html');
            expect(result.stream).toBeUndefined();
            expect(globals.logger.error).toHaveBeenCalledWith(
                'FILE PREP: File not found: /test/nonexistent.html'
            );
        });

        test('should prepare file from SEA assets', async () => {
            // Setup mocks
            globals.isSea = true;
            path.extname.mockReturnValue('.js');
            sea.getAsset.mockReturnValue('console.log("test");');

            // Execute
            const result = await prepareFile('/test/script.js');

            // Verify
            expect(result.found).toBe(true);
            expect(result.ext).toBe('js');
            expect(result.mimeType).toBe('application/javascript');
            expect(result.content).toBe('console.log("test");');
            expect(sea.getAsset).toHaveBeenCalledWith('/test/script.js', 'utf8');
        });

        test('should handle ArrayBuffer from SEA assets', async () => {
            // Setup mocks
            globals.isSea = true;
            path.extname.mockReturnValue('.png');
            const mockArrayBuffer = new ArrayBuffer(8);
            sea.getAsset.mockReturnValue(mockArrayBuffer);

            // Execute
            const result = await prepareFile('/test/image.png');

            // Verify
            expect(result.found).toBe(true);
            expect(result.content).toBeInstanceOf(Buffer);
        });

        test('should handle SEA asset not found', async () => {
            // Setup mocks
            globals.isSea = true;
            path.extname.mockReturnValue('.html');
            sea.getAsset.mockReturnValue(undefined);

            // Execute
            const result = await prepareFile('/test/missing.html');

            // Verify
            expect(result.found).toBe(false);
            expect(globals.logger.error).toHaveBeenCalledWith(
                'FILE PREP: Could not find /test/missing.html in SEA assets'
            );
        });

        test('should handle errors during file preparation', async () => {
            // Setup mocks
            path.extname.mockReturnValue('.html');
            fs.existsSync.mockImplementation(() => {
                throw new Error('File system error');
            });

            // Execute
            const result = await prepareFile('/test/error.html');

            // Verify
            expect(result.found).toBe(false);
            expect(globals.logger.error).toHaveBeenCalledWith(
                'FILE PREP: Error preparing file: File system error'
            );
        });

        test('should use custom encoding when provided', async () => {
            // Setup mocks
            path.extname.mockReturnValue('.txt');
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('text content');

            // Execute
            const result = await prepareFile('/test/file.txt', 'latin1');

            // Verify
            expect(fs.readFileSync).toHaveBeenCalledWith('/test/file.txt', 'latin1');
        });
    });

    describe('compileTemplate', () => {
        test('should compile handlebars template successfully', () => {
            // Setup mocks
            const mockTemplate = jest.fn().mockReturnValue('Hello John!');
            handlebars.compile.mockReturnValue(mockTemplate);

            // Execute
            const result = compileTemplate('Hello {{name}}!', { name: 'John' });

            // Verify
            expect(result).toBe('Hello John!');
            expect(handlebars.compile).toHaveBeenCalledWith('Hello {{name}}!');
            expect(mockTemplate).toHaveBeenCalledWith({ name: 'John' });
        });

        test('should handle template compilation errors', () => {
            // Setup mocks
            handlebars.compile.mockImplementation(() => {
                throw new Error('Template error');
            });

            // Execute & Verify
            expect(() => compileTemplate('{{invalid', {})).toThrow('Template error');
            expect(globals.logger.error).toHaveBeenCalledWith(
                'FILE PREP: Error compiling handlebars template: Template error'
            );
        });
    });

    describe('getFileContent', () => {
        test('should return file content when file exists', async () => {
            // Setup mocks
            path.extname.mockReturnValue('.txt');
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('file content');

            // Execute
            const result = await getFileContent('/test/file.txt');

            // Verify
            expect(result).toBe('file content');
        });

        test('should throw error when file not found', async () => {
            // Setup mocks
            path.extname.mockReturnValue('.txt');
            fs.existsSync.mockReturnValue(false);

            // Execute & Verify
            await expect(getFileContent('/test/missing.txt')).rejects.toThrow(
                'File not found: /test/missing.txt'
            );
        });
    });

    describe('getMimeType', () => {
        test('should return correct MIME type for HTML files', () => {
            path.extname.mockReturnValue('.html');
            const result = getMimeType('/test/file.html');
            expect(result).toBe('text/html; charset=utf-8');
        });

        test('should return correct MIME type for CSS files', () => {
            path.extname.mockReturnValue('.css');
            const result = getMimeType('/test/file.css');
            expect(result).toBe('text/css');
        });

        test('should return correct MIME type for JavaScript files', () => {
            path.extname.mockReturnValue('.js');
            const result = getMimeType('/test/file.js');
            expect(result).toBe('application/javascript');
        });

        test('should return correct MIME type for PNG files', () => {
            path.extname.mockReturnValue('.png');
            const result = getMimeType('/test/file.png');
            expect(result).toBe('image/png');
        });

        test('should return default MIME type for unknown extensions', () => {
            path.extname.mockReturnValue('.unknown');
            const result = getMimeType('/test/file.unknown');
            expect(result).toBe('application/octet-stream');
        });

        test('should handle case insensitive extensions', () => {
            path.extname.mockReturnValue('.HTML');
            const result = getMimeType('/test/file.HTML');
            expect(result).toBe('text/html; charset=utf-8');
        });
    });
});
