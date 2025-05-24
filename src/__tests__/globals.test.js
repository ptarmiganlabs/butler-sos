import { jest, describe, test, afterEach, beforeEach } from '@jest/globals';

// Create mock functions that will be reused
const mockAccessSync = jest.fn();
const mockReadFileSync = jest.fn();

// Mock fs-extra
jest.unstable_mockModule('fs-extra', () => ({
    default: {
        accessSync: mockAccessSync,
        constants: {
            F_OK: 0,
        },
        readFileSync: mockReadFileSync,
    },
    accessSync: mockAccessSync,
    constants: {
        F_OK: 0,
    },
    readFileSync: mockReadFileSync,
}));

// Mock node:sea
jest.unstable_mockModule('node:sea', () => ({
    default: {
        isSea: jest.fn(() => false),
        getAsset: jest.fn(),
    },
}));

// Mock path module
jest.unstable_mockModule('path', () => ({
    default: {
        dirname: jest.fn(),
        join: jest.fn(),
        resolve: jest.fn(),
        extname: jest.fn(),
        basename: jest.fn(),
    },
}));

// Import mocked modules
const fs = (await import('fs-extra')).default;
const sea = (await import('node:sea')).default;
const upath = (await import('path')).default;

describe('globals', () => {
    let Settings;
    let globalInstance;

    beforeEach(async () => {
        jest.clearAllMocks();

        // Reset modules to get fresh instances
        jest.resetModules();

        // Import the Settings class
        const globalsModule = await import('../globals.js');
        Settings = globalsModule.default;
        globalInstance = Settings;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('constructor', () => {
        test('should create singleton instance', () => {
            const instance1 = new Settings.constructor();
            const instance2 = new Settings.constructor();

            expect(instance1).toBe(instance2);
        });

        test('should initialize with initialised flag as false', () => {
            expect(globalInstance.initialised).toBe(false);
        });
    });

    describe('static methods', () => {
        describe('checkFileExistsSync', () => {
            test('should return true when file exists', () => {
                // Clear any previous mock calls
                jest.clearAllMocks();

                // Mock fs.accessSync to succeed (not throw)
                mockAccessSync.mockImplementation(() => {
                    // Success case - don't throw
                });

                // Access the static method directly from the constructor of the singleton instance
                const result = Settings.constructor.checkFileExistsSync('/test/path');

                expect(result).toBe(true);
                expect(mockAccessSync).toHaveBeenCalledWith('/test/path', 0);
            });

            test('should return false when file does not exist', () => {
                // Clear any previous mock calls
                jest.clearAllMocks();

                // Mock fs.accessSync to throw error (file doesn't exist)
                mockAccessSync.mockImplementation(() => {
                    throw new Error('File not found');
                });

                const result = Settings.constructor.checkFileExistsSync('/test/path');

                expect(result).toBe(false);
                expect(mockAccessSync).toHaveBeenCalledWith('/test/path', 0);
            });
        });

        describe('sleep', () => {
            test('should return a promise that resolves after specified time', async () => {
                jest.spyOn(global, 'setTimeout').mockImplementation((callback) => {
                    callback();
                    return 123;
                });

                const promise = Settings.constructor.sleep(100);

                expect(promise).toBeInstanceOf(Promise);

                await promise;
                expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 100);

                setTimeout.mockRestore();
            });
        });

        describe('isRunningInDocker', () => {
            test('should detect Docker environment from /.dockerenv', () => {
                // Clear any previous mock calls
                jest.clearAllMocks();

                // Mock fs.accessSync to succeed for /.dockerenv check
                mockAccessSync.mockImplementation((filePath) => {
                    if (filePath === '/.dockerenv') {
                        return; // File exists, no error
                    }
                    throw new Error('File not found');
                });

                const result = Settings.constructor.isRunningInDocker();

                expect(result).toBe(true);
                expect(mockAccessSync).toHaveBeenCalledWith('/.dockerenv');
            });

            test('should return false when not in Docker', () => {
                // Clear any previous mock calls
                jest.clearAllMocks();

                // Mock fs.accessSync to always throw (/.dockerenv doesn't exist)
                mockAccessSync.mockImplementation(() => {
                    throw new Error('File not found');
                });

                const result = Settings.constructor.isRunningInDocker();

                expect(result).toBe(false);
                expect(mockAccessSync).toHaveBeenCalledWith('/.dockerenv');
            });
        });
    });
});
