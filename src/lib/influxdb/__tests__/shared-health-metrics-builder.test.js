import { jest, describe, test, expect, beforeEach } from '@jest/globals';

const mockGlobals = {
    logger: {
        info: jest.fn(),
        verbose: jest.fn(),
        debug: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
    },
    config: { get: jest.fn() },
};

jest.unstable_mockModule('../../../globals.js', () => ({ default: mockGlobals }));

const mockUtils = {
    getFormattedTime: jest.fn(),
    processAppDocuments: jest.fn(),
};

jest.unstable_mockModule('../shared/utils.js', () => mockUtils);

describe('shared/health-metrics-builder', () => {
    let buildHealthMetricDatapoints;
    let globals;
    let utils;

    beforeEach(async () => {
        jest.clearAllMocks();
        globals = (await import('../../../globals.js')).default;
        utils = await import('../shared/utils.js');
        const builder = await import('../shared/health-metrics-builder.js');
        buildHealthMetricDatapoints = builder.buildHealthMetricDatapoints;

        utils.getFormattedTime.mockReturnValue('1d 2h 30m');
        utils.processAppDocuments.mockResolvedValue({
            appNames: ['App1', 'App2'],
            sessionAppNames: ['SessionApp1'],
        });

        globals.config.get.mockImplementation((key) => {
            if (key === 'Butler-SOS.influxdbConfig.includeFields.activeDocs') return true;
            if (key === 'Butler-SOS.influxdbConfig.includeFields.loadedDocs') return true;
            if (key === 'Butler-SOS.influxdbConfig.includeFields.inMemoryDocs') return true;
            if (key === 'Butler-SOS.appNames.enableAppNameExtract') return true;
            return false;
        });
    });

    /**
     * Create mock health metrics body
     *
     * @returns {object} Mock body with health metrics
     */
    const createMockBody = () => ({
        version: '14.76.3',
        started: '2024-01-01T00:00:00Z',
        mem: { committed: 1000000, allocated: 800000, free: 200000 },
        apps: {
            active_docs: ['doc1', 'doc2'],
            loaded_docs: ['doc3'],
            in_memory_docs: ['doc4', 'doc5'],
            calls: 100,
            selections: 50,
        },
        cpu: { total: 45 },
        session: { active: 10, total: 15 },
        users: { active: 5, total: 8 },
        cache: { hits: 1000, lookups: 1200, added: 50, replaced: 10, bytes_added: 500000 },
        saturated: false,
    });

    test('should call processAppDocuments three times for active, loaded, and in-memory docs', async () => {
        const body = createMockBody();

        await buildHealthMetricDatapoints(body, 'TEST PREFIX');

        expect(utils.processAppDocuments).toHaveBeenCalledTimes(3);
        expect(utils.processAppDocuments).toHaveBeenCalledWith(
            body.apps.active_docs,
            'TEST PREFIX',
            'active'
        );
        expect(utils.processAppDocuments).toHaveBeenCalledWith(
            body.apps.loaded_docs,
            'TEST PREFIX',
            'loaded'
        );
        expect(utils.processAppDocuments).toHaveBeenCalledWith(
            body.apps.in_memory_docs,
            'TEST PREFIX',
            'in memory'
        );
    });

    test('should call getFormattedTime with started timestamp', async () => {
        const body = createMockBody();

        await buildHealthMetricDatapoints(body, 'TEST PREFIX');

        expect(utils.getFormattedTime).toHaveBeenCalledWith(body.started);
    });

    test('should return formattedTime from getFormattedTime', async () => {
        const body = createMockBody();

        const result = await buildHealthMetricDatapoints(body, 'TEST PREFIX');

        expect(result.formattedTime).toBe('1d 2h 30m');
    });

    test('should return processed app names for all three categories', async () => {
        utils.processAppDocuments
            .mockResolvedValueOnce({ appNames: ['ActiveApp'], sessionAppNames: ['ActiveSession'] })
            .mockResolvedValueOnce({ appNames: ['LoadedApp'], sessionAppNames: ['LoadedSession'] })
            .mockResolvedValueOnce({ appNames: ['MemApp'], sessionAppNames: ['MemSession'] });

        const body = createMockBody();

        const result = await buildHealthMetricDatapoints(body, 'TEST PREFIX');

        expect(result.appNames.active).toEqual(['ActiveApp']);
        expect(result.appNames.activeSession).toEqual(['ActiveSession']);
        expect(result.appNames.loaded).toEqual(['LoadedApp']);
        expect(result.appNames.loadedSession).toEqual(['LoadedSession']);
        expect(result.appNames.inMemory).toEqual(['MemApp']);
        expect(result.appNames.inMemorySession).toEqual(['MemSession']);
    });

    test('should return config flags from globals.config', async () => {
        const body = createMockBody();

        const result = await buildHealthMetricDatapoints(body, 'TEST PREFIX');

        expect(result.config.includeActiveDocs).toBe(true);
        expect(result.config.includeLoadedDocs).toBe(true);
        expect(result.config.includeInMemoryDocs).toBe(true);
        expect(result.config.enableAppNameExtract).toBe(true);
    });

    test('should return false config flags when disabled', async () => {
        globals.config.get.mockReturnValue(false);

        const body = createMockBody();

        const result = await buildHealthMetricDatapoints(body, 'TEST PREFIX');

        expect(result.config.includeActiveDocs).toBe(false);
        expect(result.config.includeLoadedDocs).toBe(false);
        expect(result.config.includeInMemoryDocs).toBe(false);
        expect(result.config.enableAppNameExtract).toBe(false);
    });

    test('should log app document counts with the provided prefix', async () => {
        const body = createMockBody();

        await buildHealthMetricDatapoints(body, 'MY PREFIX');

        expect(globals.logger.debug).toHaveBeenCalledWith(
            'MY PREFIX: Number of apps active: 2'
        );
        expect(globals.logger.debug).toHaveBeenCalledWith(
            'MY PREFIX: Number of apps loaded: 1'
        );
        expect(globals.logger.debug).toHaveBeenCalledWith(
            'MY PREFIX: Number of apps in memory: 2'
        );
    });

    test('should read correct config keys', async () => {
        const body = createMockBody();

        await buildHealthMetricDatapoints(body, 'TEST PREFIX');

        expect(globals.config.get).toHaveBeenCalledWith(
            'Butler-SOS.influxdbConfig.includeFields.activeDocs'
        );
        expect(globals.config.get).toHaveBeenCalledWith(
            'Butler-SOS.influxdbConfig.includeFields.loadedDocs'
        );
        expect(globals.config.get).toHaveBeenCalledWith(
            'Butler-SOS.influxdbConfig.includeFields.inMemoryDocs'
        );
        expect(globals.config.get).toHaveBeenCalledWith(
            'Butler-SOS.appNames.enableAppNameExtract'
        );
    });
});
