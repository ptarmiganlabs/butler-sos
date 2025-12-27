import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const globalsPath = path.resolve(__dirname, '../../../../globals.js');
const influxdbPath = path.resolve(__dirname, '../../../influxdb/index.js');
const newRelicPath = path.resolve(__dirname, '../../../post-to-new-relic.js');
const mqttPath = path.resolve(__dirname, '../../../post-to-mqtt.js');
const categorisePath = path.resolve(__dirname, '../../../log-event-categorise.js');
const logErrorPath = path.resolve(__dirname, '../../../log-error.js');

const filtersPath = path.resolve(__dirname, '../filters/qix-perf-filters.js');

// Mock dependencies
jest.unstable_mockModule(globalsPath, () => ({
    default: {
        logger: {
            info: jest.fn(),
            verbose: jest.fn(),
            debug: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            silly: jest.fn(),
        },
        config: {
            get: jest.fn().mockImplementation((path) => {
                if (path === 'Butler-SOS.logEvents.source.engine.enable') return true;
                if (path === 'Butler-SOS.logEvents.source.proxy.enable') return true;
                if (path === 'Butler-SOS.logEvents.source.repository.enable') return true;
                if (path === 'Butler-SOS.logEvents.source.scheduler.enable') return true;
                if (path === 'Butler-SOS.logEvents.source.qixPerf.enable') return true;
                if (path === 'Butler-SOS.qlikSenseEvents.eventCount.enable') return true;
                if (path === 'Butler-SOS.logEvents.categorise.enable') return true;
                if (path === 'Butler-SOS.influxdbConfig.enable') return true;
                if (path === 'Butler-SOS.logEvents.sendToInfluxdb.enable') return true;
                if (path === 'Butler-SOS.newRelic.enable') return true;
                if (path === 'Butler-SOS.logEvents.sendToNewRelic.enable') return true;
                if (path === 'Butler-SOS.mqttConfig.enable') return true;
                if (path === 'Butler-SOS.logEvents.sendToMQTT.enable') return true;
                if (path === 'Butler-SOS.logEvents.enginePerformanceMonitor.enable') return true;
                if (path === 'Butler-SOS.logEvents.enginePerformanceMonitor.appNameLookup.enable') return true;
                if (path === 'Butler-SOS.logEvents.enginePerformanceMonitor.monitorFilter') return { appSpecific: { enable: true }, allApps: { enable: true } };
                if (path === 'Butler-SOS.logEvents.enginePerformanceMonitor.trackRejectedEvents.enable') return true;
                return undefined;
            }),
        },
        udpEvents: {
            addLogEvent: jest.fn(),
        },
        appNames: [{ id: 'uuid4', name: 'App1' }],
        rejectedEvents: {
            addRejectedLogEvent: jest.fn(),
        },
    },
}));

jest.unstable_mockModule(filtersPath, () => ({
    processAppSpecificFilters: jest.fn().mockReturnValue(true),
    processAllAppsFilters: jest.fn().mockReturnValue(true),
}));

jest.unstable_mockModule(influxdbPath, () => ({
    postLogEventToInfluxdb: jest.fn(),
}));

jest.unstable_mockModule(newRelicPath, () => ({
    postLogEventToNewRelic: jest.fn(),
}));

jest.unstable_mockModule(mqttPath, () => ({
    postLogEventToMQTT: jest.fn(),
}));

jest.unstable_mockModule(categorisePath, () => ({
    categoriseLogEvent: jest.fn().mockImplementation((msg) => msg),
}));

jest.unstable_mockModule(logErrorPath, () => ({
    logError: jest.fn(),
}));

const globals = (await import(globalsPath)).default;
const { postLogEventToInfluxdb } = await import(influxdbPath);
const { postLogEventToNewRelic } = await import(newRelicPath);
const { postLogEventToMQTT } = await import(mqttPath);
const { categoriseLogEvent } = await import(categorisePath);
const { logError } = await import(logErrorPath);
const { processAppSpecificFilters, processAllAppsFilters } = await import(filtersPath);
const { messageEventHandler } = await import('../message-event.js');

describe('messageEventHandler', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        processAppSpecificFilters.mockReturnValue(true);
        processAllAppsFilters.mockReturnValue(true);
    });

    test('should process engine event', async () => {
        const msg = Buffer.from('/qseow-engine/;1;20211109T153726.028+0200;2021-11-09 15:37:26,028;WARN;host1;sub1;user1;message1;3b3b3b3b-3b3b-3b3b-3b3b-3b3b3b3b3b3b;dir1;uid1;ts1;3b3b3b3b-3b3b-3b3b-3b3b-3b3b3b3b3b3b;v1;ts2;type1;3b3b3b3b-3b3b-3b3b-3b3b-3b3b3b3b3b3b;3b3b3b3b-3b3b-3b3b-3b3b-3b3b3b3b3b3b');
        await messageEventHandler(msg, {});

        expect(globals.logger.verbose).toHaveBeenCalled();
        expect(globals.udpEvents.addLogEvent).toHaveBeenCalled();
        expect(categoriseLogEvent).toHaveBeenCalled();
        expect(postLogEventToInfluxdb).toHaveBeenCalled();
        expect(postLogEventToNewRelic).toHaveBeenCalled();
        expect(postLogEventToMQTT).toHaveBeenCalled();
    });

    test('should process proxy event', async () => {
        const msg = Buffer.from('/qseow-proxy/;1;20211109T153726.028+0200;2021-11-09 15:37:26,028;WARN;host1;sub1;user1;message1;3b3b3b3b-3b3b-3b3b-3b3b-3b3b3b3b3b3b;dir1;uid1;ts1;3b3b3b3b-3b3b-3b3b-3b3b-3b3b3b3b3b3b;v1;ts2;type1;3b3b3b3b-3b3b-3b3b-3b3b-3b3b3b3b3b3b;3b3b3b3b-3b3b-3b3b-3b3b-3b3b3b3b3b3b');
        await messageEventHandler(msg, {});

        expect(globals.logger.verbose).toHaveBeenCalled();
    });

    test('should process repository event', async () => {
        const msg = Buffer.from('/qseow-repository/;1;20211109T153726.028+0200;2021-11-09 15:37:26,028;WARN;host1;sub1;user1;message1;3b3b3b3b-3b3b-3b3b-3b3b-3b3b3b3b3b3b;dir1;uid1;ts1;3b3b3b3b-3b3b-3b3b-3b3b-3b3b3b3b3b3b;v1;ts2;type1;3b3b3b3b-3b3b-3b3b-3b3b-3b3b3b3b3b3b;3b3b3b3b-3b3b-3b3b-3b3b-3b3b3b3b3b3b');
        await messageEventHandler(msg, {});

        expect(globals.logger.verbose).toHaveBeenCalled();
    });

    test('should process scheduler event', async () => {
        const msg = Buffer.from('/qseow-scheduler/;1;20211109T153726.028+0200;2021-11-09 15:37:26,028;WARN;host1;sub1;user1;message1;3b3b3b3b-3b3b-3b3b-3b3b-3b3b3b3b3b3b;dir1;uid1;ts1;3b3b3b3b-3b3b-3b3b-3b3b-3b3b3b3b3b3b;v1;ts2;type1;3b3b3b3b-3b3b-3b3b-3b3b-3b3b3b3b3b3b;3b3b3b3b-3b3b-3b3b-3b3b-3b3b3b3b3b3b');
        await messageEventHandler(msg, {});

        expect(globals.logger.verbose).toHaveBeenCalled();
    });

    test('should process qix-perf event', async () => {
        const msg = Buffer.from('/qseow-qix-perf/;1;20211109T153726.028+0200;2021-11-09 15:37:26,028;WARN;host1;sub1;user1;0;dir1;uid1;ts1;3b3b3b3b-3b3b-3b3b-3b3b-3b3b3b3b3b3b;uuid4;3b3b3b3b-3b3b-3b3b-3b3b-3b3b3b3b3b3b;method1;100;100;100;100;100;1;obj1;100;100;type1');
        await messageEventHandler(msg, {});

        expect(globals.logger.verbose).toHaveBeenCalled();
    });

    test('should process qix-perf event with user activity', async () => {
        const msg = Buffer.from('/qseow-qix-perf/;1;20211109T153726.028+0200;2021-11-09 15:37:26,028;WARN;host1;sub1;user1;3b3b3b3b-3b3b-3b3b-3b3b-3b3b3b3b3b3b;dir1;uid1;ts1;3b3b3b3b-3b3b-3b3b-3b3b-3b3b3b3b3b3b;uuid4;3b3b3b3b-3b3b-3b3b-3b3b-3b3b3b3b3b3b;method1;100;100;100;100;100;1;obj1;100;100;type1');
        await messageEventHandler(msg, {});

        expect(globals.logger.debug).toHaveBeenCalledWith(expect.stringContaining('user activity'));
    });

    test('should skip qix-perf event if disabled', async () => {
        globals.config.get.mockImplementation((path) => {
            if (path === 'Butler-SOS.logEvents.enginePerformanceMonitor.enable') return false;
            if (path === 'Butler-SOS.qlikSenseEvents.eventCount.enable') return true;
            return true;
        });

        const msg = Buffer.from('/qseow-qix-perf/;1;2;3;4;5;6;7;8;9;10;11;12;13;14;15;16;17;18;19;20;21;22;23;24;25');
        await messageEventHandler(msg, {});

        expect(globals.logger.debug).toHaveBeenCalledWith(expect.stringContaining('disabled in the configuration'));
    });

    test('should skip qix-perf event if filters do not match', async () => {
        globals.config.get.mockImplementation((path) => {
            if (path === 'Butler-SOS.logEvents.enginePerformanceMonitor.enable') return true;
            if (path === 'Butler-SOS.logEvents.enginePerformanceMonitor.trackRejectedEvents.enable') return true;
            if (path === 'Butler-SOS.logEvents.enginePerformanceMonitor.monitorFilter') return { appSpecific: { enable: true }, allApps: { enable: true } };
            return true;
        });
        processAppSpecificFilters.mockReturnValue(false);
        processAllAppsFilters.mockReturnValue(false);

        const msg = Buffer.from('/qseow-qix-perf/;1;2;3;4;5;6;7;8;9;10;11;12;13;14;15;16;17;18;19;20;21;22;23;24;25');
        await messageEventHandler(msg, {});

        expect(globals.logger.debug).toHaveBeenCalledWith(expect.stringContaining('does not match filters'));
        expect(globals.rejectedEvents.addRejectedLogEvent).toHaveBeenCalled();
    });

    test('should handle unknown source', async () => {
        const msg = Buffer.from('/unknown/;1;2;3;4;5;6;7;8;9;10;11;12;13;14;15;16;17;18');
        await messageEventHandler(msg, {});

        expect(globals.logger.warn).toHaveBeenCalledWith(expect.stringContaining('unrecognized log event'));
        expect(globals.udpEvents.addLogEvent).toHaveBeenCalledWith(expect.objectContaining({ source: 'unknown' }));
    });

    test('should handle disabled source', async () => {
        globals.config.get.mockImplementation((path) => {
            if (path === 'Butler-SOS.logEvents.source.engine.enable') return false;
            return true;
        });

        const msg = Buffer.from('/qseow-engine/;1;2;3;4;5;6;7;8;9;10;11;12;13;14;15;16;17;18');
        await messageEventHandler(msg, {});

        expect(globals.logger.verbose).not.toHaveBeenCalled();
    });

    test('should handle errors', async () => {
        const msg = null; // Will cause error in toString()
        await messageEventHandler(msg, {});

        expect(logError).toHaveBeenCalled();
    });
});
