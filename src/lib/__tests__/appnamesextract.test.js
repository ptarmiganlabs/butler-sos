import { jest, describe, test, afterEach } from '@jest/globals';

// Mock dependencies
jest.unstable_mockModule('qrs-interact', () => ({
    default: jest.fn(),
}));
const qrsInteract = (await import('qrs-interact')).default;

jest.unstable_mockModule('lodash.clonedeep', () => ({
    default: jest.fn((data) => data),
}));
const clonedeep = await import('lodash.clonedeep');

jest.unstable_mockModule('../../globals.js', () => ({
    default: {
        logger: {
            verbose: jest.fn(),
            debug: jest.fn(),
            error: jest.fn(),
        },
        config: {
            get: jest.fn(),
        },
        errorTracker: {
            incrementError: jest.fn().mockResolvedValue(),
        },
        certPath: 'cert/path',
        keyPath: 'key/path',
    },
}));
const globals = (await import('../../globals.js')).default;

// Import the module to test
const { getAppNames } = await import('../appnamesextract.js');

describe('appnamesextract', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    test('should pass a basic test', () => {
        expect(true).toBe(true);
    });

    test('should successfully get app names from QRS', async () => {
        // Mock implementation for config.get
        globals.config.get.mockImplementation((key) => {
            if (key === 'Butler-SOS.appNames.hostIP') {
                return '192.168.1.123';
            }
            return null;
        });

        // Mock app data that would be returned from the QRS API
        const mockAppData = {
            body: [
                { id: 'app1', name: 'Application 1', description: 'First app' },
                { id: 'app2', name: 'Application 2', description: 'Second app' },
            ],
        };

        // Create a mock of the Get method to resolve with the mock data
        const mockGet = jest.fn().mockResolvedValue(mockAppData);

        // Mock the qrsInteract constructor to return an object with the Get method
        qrsInteract.mockImplementation(() => ({
            Get: mockGet,
        }));

        // Call the function to test
        getAppNames();

        // Allow the promise to resolve
        await new Promise(process.nextTick);

        // Expectations
        expect(qrsInteract).toHaveBeenCalledWith({
            hostname: '192.168.1.123',
            portNumber: 4242,
            certificates: {
                certFile: 'cert/path',
                keyFile: 'key/path',
            },
            headers: {
                'X-Qlik-User': 'UserDirectory=Internal; UserId=sa_repository',
            },
        });

        expect(mockGet).toHaveBeenCalledWith('app');
        expect(globals.appNames).toEqual([
            { id: 'app1', name: 'Application 1', description: 'First app' },
            { id: 'app2', name: 'Application 2', description: 'Second app' },
        ]);

        // Verify logging
        expect(globals.logger.verbose).toHaveBeenCalledWith(
            'APP NAMES: Start getting app names from repository db'
        );
        expect(globals.logger.verbose).toHaveBeenCalledWith('APP NAMES: Number of apps: 2');
        expect(globals.logger.debug).toHaveBeenCalledWith(
            expect.stringContaining('APP NAMES: App list JSON:')
        );
        expect(globals.logger.verbose).toHaveBeenCalledWith(
            'APP NAMES: Done getting app names from repository db'
        );
    });

    test('should handle errors when getting app names from QRS', async () => {
        // Mock implementation for config.get
        globals.config.get.mockImplementation((key) => {
            if (key === 'Butler-SOS.appNames.hostIP') {
                return '192.168.1.123';
            }
            return null;
        });

        // Create a mock of the Get method to reject with an error
        const mockGet = jest.fn().mockRejectedValue(new Error('QRS API Error'));

        // Mock the qrsInteract constructor to return an object with the Get method
        qrsInteract.mockImplementation(() => ({
            Get: mockGet,
        }));

        // Call the function to test
        getAppNames();

        // Allow the promise to reject
        await new Promise(process.nextTick);

        // Expectations
        expect(qrsInteract).toHaveBeenCalledWith(expect.any(Object));
        expect(mockGet).toHaveBeenCalledWith('app');

        // Verify error logging - logError creates TWO log calls: message + stack trace
        expect(globals.logger.error).toHaveBeenCalledWith(
            'APP NAMES: Error getting app names: QRS API Error'
        );
        expect(globals.logger.error).toHaveBeenCalledWith(
            expect.stringContaining('Stack trace: Error: QRS API Error')
        );
    });
});
