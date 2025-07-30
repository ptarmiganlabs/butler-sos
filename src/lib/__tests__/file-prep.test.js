import { jest, describe, test, beforeEach, afterEach } from '@jest/globals';

// Mock dependencies
jest.unstable_mockModule('fs', () => ({
    existsSync: jest.fn(),
    readFileSync: jest.fn(),
}));

jest.unstable_mockModule('path', () => ({
    extname: jest.fn(),
}));

jest.unstable_mockModule('../sea-wrapper.js', () => ({
    default: {
        getAsset: jest.fn(),
        isSea: jest.fn().mockReturnValue(false),
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
const sea = (await import('../sea-wrapper.js')).default;
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

        test('should handle large file content in SEA mode', async () => {
            // Setup mocks
            globals.isSea = true;
            path.extname.mockReturnValue('.txt');
            const largeContent = 'x'.repeat(10000); // Large text content
            sea.getAsset.mockReturnValue(largeContent);

            // Execute
            const result = await prepareFile('/test/large.txt');

            // Verify
            expect(result.found).toBe(true);
            expect(result.content).toBe(largeContent);
            expect(result.content.length).toBe(10000);
        });

        test('should handle empty file content in both modes', async () => {
            // Test non-SEA mode with empty file
            globals.isSea = false;
            path.extname.mockReturnValue('.txt');
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('');

            const result1 = await prepareFile('/test/empty.txt');
            expect(result1.found).toBe(true);
            expect(result1.content).toBe('');

            // Test SEA mode with empty asset
            globals.isSea = true;
            sea.getAsset.mockReturnValue('');

            const result2 = await prepareFile('/test/empty.txt');
            expect(result2.found).toBe(true);
            expect(result2.content).toBe('');
        });

        test('should handle file path with special characters', async () => {
            // Setup mocks
            path.extname.mockReturnValue('.html');
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('<html>Special chars</html>');

            // Execute with path containing special characters
            const result = await prepareFile('/test/file-with-special_chars[1].html');

            // Verify
            expect(result.found).toBe(true);
            expect(result.content).toBe('<html>Special chars</html>');
        });

        test('should handle concurrent file preparation requests', async () => {
            // Setup mocks
            path.extname.mockReturnValue('.txt');
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('concurrent content');

            // Execute multiple concurrent requests
            const promises = [
                prepareFile('/test/file1.txt'),
                prepareFile('/test/file2.txt'),
                prepareFile('/test/file3.txt'),
            ];

            const results = await Promise.all(promises);

            // Verify all requests succeeded
            results.forEach((result, index) => {
                expect(result.found).toBe(true);
                expect(result.content).toBe('concurrent content');
                expect(fs.readFileSync).toHaveBeenCalledWith(`/test/file${index + 1}.txt`, 'utf8');
            });
        });

        test('should validate stream creation for different content types', async () => {
            // Test text content stream
            path.extname.mockReturnValue('.txt');
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockReturnValue('text content');

            const textResult = await prepareFile('/test/text.txt');
            expect(textResult.stream).toBeDefined();
            expect(textResult.content).toBe('text content');

            // Test binary content stream
            path.extname.mockReturnValue('.png');
            const binaryBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47]); // PNG header
            fs.readFileSync.mockReturnValue(binaryBuffer);

            const binaryResult = await prepareFile('/test/image.png');
            expect(binaryResult.stream).toBeDefined();
            expect(Buffer.isBuffer(binaryResult.content)).toBe(true);
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

        test('should handle files without extensions', () => {
            path.extname.mockReturnValue('');
            const result = getMimeType('/test/file-no-extension');
            expect(result).toBe('application/octet-stream');
        });

        test('should handle complex file paths', () => {
            path.extname.mockReturnValue('.css');
            const result = getMimeType('/deep/nested/path/with-special_chars[1]/style.css');
            expect(result).toBe('text/css');
        });

        test('should handle all supported MIME types', () => {
            const extensionTests = [
                { ext: '.html', expected: 'text/html; charset=utf-8' },
                { ext: '.css', expected: 'text/css' },
                { ext: '.js', expected: 'application/javascript' },
                { ext: '.png', expected: 'image/png' },
                { ext: '.jpg', expected: 'image/jpeg' },
                { ext: '.gif', expected: 'image/gif' },
                { ext: '.svg', expected: 'image/svg+xml' },
                { ext: '.map', expected: 'application/json' },
                { ext: '.ico', expected: 'image/x-icon' },
            ];

            extensionTests.forEach(({ ext, expected }) => {
                path.extname.mockReturnValue(ext);
                const result = getMimeType(`/test/file${ext}`);
                expect(result).toBe(expected);
            });
        });
    });
});
