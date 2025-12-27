import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';

describe('sea-wrapper', () => {
    let seaWrapper;

    beforeEach(async () => {
        jest.resetModules();
    });

    test('should use fallback implementations when node:sea is not available', async () => {
        // Mock import to fail
        jest.unstable_mockModule('node:sea', () => {
            throw new Error('Module not found');
        });

        const module = await import('../sea-wrapper.js');
        seaWrapper = module.default;

        await seaWrapper.initialize();

        expect(seaWrapper.isSea()).toBe(false);
        expect(seaWrapper.getAsset('key')).toBeUndefined();
    });

    test('should use real implementations when node:sea is available', async () => {
        // Mock node:sea
        const mockIsSea = jest.fn().mockReturnValue(true);
        const mockGetAsset = jest.fn().mockReturnValue('asset-content');

        jest.unstable_mockModule('node:sea', () => ({
            default: {
                isSea: mockIsSea,
                getAsset: mockGetAsset,
            },
        }));

        const module = await import('../sea-wrapper.js');
        seaWrapper = module.default;

        await seaWrapper.initialize();

        expect(seaWrapper.isSea()).toBe(true);
        expect(seaWrapper.getAsset('key')).toBe('asset-content');
        expect(mockIsSea).toHaveBeenCalled();
        expect(mockGetAsset).toHaveBeenCalledWith('key');
    });

    test('isSea fallback should detect packaged environment', async () => {
        // Mock process.pkg
        const originalPkg = process.pkg;
        process.pkg = {};

        const module = await import('../sea-wrapper.js');
        seaWrapper = module.default;

        expect(seaWrapper.isSea()).toBe(true);

        process.pkg = originalPkg;
    });

    test('isSea fallback should handle errors', async () => {
        const originalExecPath = process.execPath;
        Object.defineProperty(process, 'execPath', {
            get() {
                throw new Error('Forced error');
            },
            configurable: true,
        });

        const module = await import('../sea-wrapper.js');
        seaWrapper = module.default;

        expect(seaWrapper.isSea()).toBe(false);

        Object.defineProperty(process, 'execPath', {
            value: originalExecPath,
            configurable: true,
        });
    });

    test('isSea fallback should detect single executable via argv', async () => {
        const originalArgv0 = process.argv0;
        const originalExecPath = process.execPath;
        const originalArgv = process.argv;

        Object.defineProperty(process, 'argv0', { value: '/path/to/exe', configurable: true });
        Object.defineProperty(process, 'execPath', { value: '/path/to/exe', configurable: true });
        Object.defineProperty(process, 'argv', { value: ['/path/to/exe'], configurable: true });

        const module = await import('../sea-wrapper.js');
        seaWrapper = module.default;

        expect(seaWrapper.isSea()).toBe(true);

        Object.defineProperty(process, 'argv0', { value: originalArgv0, configurable: true });
        Object.defineProperty(process, 'execPath', { value: originalExecPath, configurable: true });
        Object.defineProperty(process, 'argv', { value: originalArgv, configurable: true });
    });

    test('getAsset fallback should return undefined', async () => {
        const module = await import('../sea-wrapper.js');
        seaWrapper = module.default;

        expect(seaWrapper.getAsset('key')).toBeUndefined();
    });
});
