import { jest, describe, test, expect } from '@jest/globals';
import { fileURLToPath } from 'url';
import path from 'path';

describe('import-meta-url', () => {
    test.skip('should export a URL object', async () => {
        // Import the module under test
        const { import_meta_url } = await import('../import-meta-url.js');

        // Expectations
        expect(import_meta_url).toBeDefined();
        expect(typeof import_meta_url).toBe('object');
        expect(import_meta_url instanceof URL).toBe(true);
    });

    test.skip('should point to the correct file path', async () => {
        // Import the module under test
        const { import_meta_url } = await import('../import-meta-url.js');

        // Convert the URL to a file path
        const filePath = fileURLToPath(import_meta_url);

        // Get the expected file path
        const expectedFilePath = path.resolve(process.cwd(), 'src/lib/import-meta-url.js');

        // Verify the path ends with 'import-meta-url.js'
        expect(filePath.endsWith('import-meta-url.js')).toBe(true);

        // Verify it's in the lib directory
        expect(filePath.includes(path.sep + 'lib' + path.sep)).toBe(true);
    });
});
