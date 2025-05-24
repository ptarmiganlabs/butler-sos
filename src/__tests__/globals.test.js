import { jest, describe, test, afterEach, beforeEach } from '@jest/globals';

// Mock fs-extra
jest.unstable_mockModule('fs-extra', () => ({
    default: {
        accessSync: jest.fn(),
        constants: {
            F_OK: 0,
        },
        readFileSync: jest.fn(),
    },
    accessSync: jest.fn(),
    constants: {
        F_OK: 0,
    },
    readFileSync: jest.fn(),
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
                fs.accessSync.mockImplementation(() => {
                    // Success case - don't throw
                });

                const result = Settings.constructor.checkFileExistsSync('/test/path');

                expect(result).toBe(true);
                expect(fs.accessSync).toHaveBeenCalledWith('/test/path', fs.constants.F_OK);
            });

            test('should return false when file does not exist', () => {
                // Clear any previous mock calls
                jest.clearAllMocks();
                
                // Mock fs.accessSync to throw error (file doesn't exist)
                fs.accessSync.mockImplementation(() => {
                    throw new Error('File not found');
                });

                const result = Settings.constructor.checkFileExistsSync('/test/path');

                expect(result).toBe(false);
                expect(fs.accessSync).toHaveBeenCalledWith('/test/path', fs.constants.F_OK);
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
                fs.accessSync.mockImplementation((filePath) => {
                    if (filePath === '/.dockerenv') {
                        return; // File exists, no error
                    }
                    throw new Error('File not found');
                });

                const result = Settings.constructor.isRunningInDocker();

                expect(result).toBe(true);
                expect(fs.accessSync).toHaveBeenCalledWith('/.dockerenv');
            });

            test('should return false when not in Docker', () => {
                // Clear any previous mock calls
                jest.clearAllMocks();
                
                // Mock fs.accessSync to always throw (/.dockerenv doesn't exist)
                fs.accessSync.mockImplementation(() => {
                    throw new Error('File not found');
                });

                const result = Settings.constructor.isRunningInDocker();

                expect(result).toBe(false);
                expect(fs.accessSync).toHaveBeenCalledWith('/.dockerenv');
            });
        });
    });
});
