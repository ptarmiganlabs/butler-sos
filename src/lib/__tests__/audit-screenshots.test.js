import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import pngjs from 'pngjs';

const { PNG } = pngjs;

const mockAxios = {
    request: jest.fn(),
};

const mockFsPromises = {
    mkdir: jest.fn(),
    writeFile: jest.fn(),
};

const mockGlobals = {
    config: {
        get: jest.fn(),
    },
};

const mockCertUtils = {
    createCertificateOptions: jest.fn(),
    getCertificates: jest.fn(),
};

jest.unstable_mockModule('axios', () => ({
    default: mockAxios,
}));

jest.unstable_mockModule('node:fs/promises', () => ({
    default: mockFsPromises,
    mkdir: mockFsPromises.mkdir,
    writeFile: mockFsPromises.writeFile,
}));

jest.unstable_mockModule('../../globals.js', () => ({
    default: mockGlobals,
}));

jest.unstable_mockModule('../cert-utils.js', () => ({
    createCertificateOptions: mockCertUtils.createCertificateOptions,
    getCertificates: mockCertUtils.getCertificates,
}));

describe('audit-screenshots', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        mockGlobals.config.get.mockImplementation((key) => {
            if (key === 'Butler-SOS.serversToMonitor.rejectUnauthorized') return false;
            throw new Error(`Unexpected config.get key: ${key}`);
        });

        mockCertUtils.createCertificateOptions.mockReturnValue({
            CertificatePassphrase: null,
        });

        mockCertUtils.getCertificates.mockReturnValue({
            cert: Buffer.from('cert'),
            key: Buffer.from('key'),
            ca: Buffer.from('ca'),
        });

        mockFsPromises.mkdir.mockResolvedValue();
        mockFsPromises.writeFile.mockResolvedValue();
    });

    test('retries download with backoff when screenshot is not yet available (404 -> 200)', async () => {
        jest.useFakeTimers();

        const { downloadScreenshot } = await import('../audit-screenshots.js');

        const logger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
        };

        let callCount = 0;
        mockAxios.request.mockImplementation(async (req) => {
            callCount += 1;

            if (callCount === 1) {
                return {
                    status: 404,
                    headers: { 'content-type': 'text/plain' },
                    data: Buffer.from('not found'),
                };
            }

            return {
                status: 200,
                headers: { 'content-type': 'image/png' },
                data: Buffer.from('png-bytes'),
            };
        });

        const promise = downloadScreenshot(
            'https://example.com/screenshot.png',
            {
                eventId: 'evt-retry',
                timestamp: '2025-01-01T00:00:00.000Z',
                payload: {
                    context: {
                        user: 'LAB\\test-user',
                        appId: 'app-1',
                        appName: 'Test App',
                        sheetId: 'sheet-1',
                        sheetName: 'Sheet 1',
                    },
                    event: {
                        objectId: 'obj-1',
                        screenshotUrl: 'https://example.com/screenshot.png',
                        type: 'screenshot',
                    },
                },
            },
            {
                enable: true,
                downloadTimeoutMs: 15000,
                storageTargets: [
                    {
                        enable: true,
                        type: 'flat',
                        directory: 'screenshots/audit',
                    },
                ],
            },
            logger
        );

        // Allow the first request to run and schedule the backoff.
        await Promise.resolve();
        expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('retrying attempt=2/3'));

        // Backoff for attempt 2 is 500ms.
        await jest.advanceTimersByTimeAsync(500);

        await promise;

        expect(mockAxios.request).toHaveBeenCalledTimes(2);
        expect(mockFsPromises.writeFile).toHaveBeenCalledTimes(1);
        expect(logger.error).not.toHaveBeenCalled();

        jest.useRealTimers();
    });

    test('downloads screenshot without auth and writes file', async () => {
        const { downloadScreenshot } = await import('../audit-screenshots.js');

        const logger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
        };

        mockAxios.request.mockResolvedValue({
            status: 200,
            headers: { 'content-type': 'image/png' },
            data: Buffer.from('png-bytes'),
        });

        await downloadScreenshot(
            'https://example.com/screenshot.png',
            {
                timestamp: '2025-01-01T00:00:00.000Z',
                eventId: 'evt-1',
                correlationId: 'corr-1',
            },
            {
                enable: true,
                downloadTimeoutMs: 15000,
                storageTargets: [
                    {
                        enable: true,
                        type: 'flat',
                        directory: 'screenshots/audit',
                    },
                ],
            },
            logger
        );

        expect(mockAxios.request).toHaveBeenCalledTimes(1);
        expect(mockAxios.request.mock.calls[0][0].url).toBe('https://example.com/screenshot.png');

        expect(mockFsPromises.mkdir).toHaveBeenCalledTimes(1);
        expect(mockFsPromises.writeFile).toHaveBeenCalledTimes(1);

        const writtenPath = mockFsPromises.writeFile.mock.calls[0][0];
        expect(writtenPath).toContain('screenshots/audit');
        expect(writtenPath).toContain('20250101T000000.000Z_evt-1_corr-1.png');

        expect(logger.warn).not.toHaveBeenCalled();
    });

    test('downloads screenshot with qpsTicket auth by appending qlikTicket', async () => {
        const { downloadScreenshot } = await import('../audit-screenshots.js');

        const logger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
        };

        mockAxios.request.mockImplementation(async (req) => {
            if (typeof req.url === 'string' && req.url.includes('/qps/ticket?Xrfkey=')) {
                return {
                    status: 201,
                    data: {
                        Ticket: 'TICKET123',
                    },
                };
            }

            return {
                status: 200,
                headers: { 'content-type': 'image/png' },
                data: Buffer.from('png-bytes'),
            };
        });

        await downloadScreenshot(
            'https://qlik.example.com/sense/app/screenshot.png?foo=bar',
            {
                timestamp: '2025-01-01T00:00:00.000Z',
                eventId: 'evt-2',
                correlationId: 'corr-2',
            },
            {
                enable: true,
                downloadTimeoutMs: 15000,
                auth: {
                    mode: 'qpsTicket',
                    qps: {
                        host: 'qlik.example.com',
                        port: 4243,
                        userDirectory: 'LAB',
                        userId: 'butler-sos',
                        ticketTimeoutMs: 5000,
                    },
                },
                storageTargets: [
                    {
                        enable: true,
                        type: 'flat',
                        directory: 'screenshots/audit',
                    },
                ],
            },
            logger
        );

        expect(mockAxios.request).toHaveBeenCalledTimes(2);

        const ticketReq = mockAxios.request.mock.calls[0][0];
        expect(ticketReq.method).toBe('post');
        expect(ticketReq.url).toContain('https://qlik.example.com:4243/qps/ticket?Xrfkey=');
        expect(ticketReq.headers['X-Qlik-Xrfkey']).toBeTruthy();
        expect(ticketReq.httpsAgent).toBeDefined();

        const screenshotReq = mockAxios.request.mock.calls[1][0];
        expect(screenshotReq.method).toBe('get');
        expect(screenshotReq.url).toContain('foo=bar');
        expect(screenshotReq.url).toContain('qlikTicket=TICKET123');
        expect(screenshotReq.httpsAgent).toBeDefined();

        expect(mockFsPromises.writeFile).toHaveBeenCalledTimes(1);
        expect(logger.warn).not.toHaveBeenCalled();
    });

    test('adds metadata header to PNG screenshot when enabled', async () => {
        const { downloadScreenshot } = await import('../audit-screenshots.js');

        const logger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
        };

        const srcPng = new PNG({ width: 20, height: 10 });
        for (let y = 0; y < srcPng.height; y += 1) {
            for (let x = 0; x < srcPng.width; x += 1) {
                const idx = (srcPng.width * y + x) << 2;
                srcPng.data[idx] = 255;
                srcPng.data[idx + 1] = 0;
                srcPng.data[idx + 2] = 0;
                srcPng.data[idx + 3] = 255;
            }
        }
        const srcBuffer = PNG.sync.write(srcPng);

        mockAxios.request.mockResolvedValue({
            status: 200,
            headers: { 'content-type': 'image/png' },
            data: srcBuffer,
        });

        await downloadScreenshot(
            'https://example.com/screenshot.png',
            {
                timestamp: '2025-12-22T12:34:56.000Z',
                eventId: 'evt-1',
                correlationId: 'corr-1',
                payload: {
                    context: {
                        user: 'LAB\\test-user',
                        appId: 'app-1',
                        appName: 'Test App',
                        sheetId: 'sheet-1',
                        sheetName: 'Sheet 1',
                    },
                    event: {
                        objectId: 'obj-1',
                        screenshotUrl: 'https://example.com/screenshot.png',
                        type: 'screenshot',
                        format: 'png',
                        width: 20,
                        height: 10,
                    },
                },
            },
            {
                enable: true,
                downloadTimeoutMs: 15000,
                addInImageMetadata: {
                    date: true,
                    eventId: true,
                    correlationId: true,
                    userId: true,
                    appId: true,
                    appName: true,
                    sheetName: true,
                },
                storageTargets: [
                    {
                        enable: true,
                        type: 'flat',
                        directory: 'screenshots/audit',
                    },
                ],
            },
            logger
        );

        expect(mockFsPromises.writeFile).toHaveBeenCalledTimes(2);

        const firstWrittenPath = mockFsPromises.writeFile.mock.calls[0][0];
        const firstWrittenBuffer = mockFsPromises.writeFile.mock.calls[0][1];
        expect(firstWrittenPath).toContain('screenshots/audit');
        expect(firstWrittenPath).toContain('.png');

        const secondWrittenPath = mockFsPromises.writeFile.mock.calls[1][0];
        const secondWrittenBuffer = mockFsPromises.writeFile.mock.calls[1][1];
        expect(secondWrittenPath).toContain('screenshots/audit');
        expect(secondWrittenPath).toContain('_metadata');

        const originalPng = PNG.sync.read(firstWrittenBuffer);
        expect(originalPng.width).toBe(srcPng.width);
        expect(originalPng.height).toBe(srcPng.height);

        const outPng = PNG.sync.read(secondWrittenBuffer);
        expect(outPng.height).toBeGreaterThan(srcPng.height);
        expect(outPng.width).toBeGreaterThanOrEqual(srcPng.width);

        // Verify header contains black text pixels (not just background).
        const headerHeight = outPng.height - srcPng.height;
        let blackPixels = 0;
        for (let y = 0; y < headerHeight; y += 1) {
            for (let x = 0; x < outPng.width; x += 1) {
                const idx = (outPng.width * y + x) << 2;
                if (
                    outPng.data[idx] === 0 &&
                    outPng.data[idx + 1] === 0 &&
                    outPng.data[idx + 2] === 0 &&
                    outPng.data[idx + 3] === 255
                ) {
                    blackPixels += 1;
                }
            }
        }
        expect(blackPixels).toBeGreaterThan(10);

        expect(logger.error).not.toHaveBeenCalled();
    });

    test('adds viewing duration to metadata header when enabled', async () => {
        const { downloadScreenshot } = await import('../audit-screenshots.js');

        const logger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
        };

        const srcPng = new PNG({ width: 20, height: 10 });
        const srcBuffer = PNG.sync.write(srcPng);

        mockAxios.request.mockResolvedValue({
            status: 200,
            headers: { 'content-type': 'image/png' },
            data: srcBuffer,
        });

        await downloadScreenshot(
            'https://example.com/screenshot.png',
            {
                timestamp: '2025-12-22T12:34:56.000Z',
                eventId: 'evt-1',
                correlationId: 'corr-1',
                payload: {
                    context: {
                        user: 'LAB\\test-user',
                    },
                    event: {
                        objectId: 'obj-1',
                        screenshotUrl: 'https://example.com/screenshot.png',
                        type: 'screenshot',
                        format: 'png',
                        width: 20,
                        height: 10,
                        duration: 5500, // 5.5 seconds
                    },
                },
            },
            {
                enable: true,
                downloadTimeoutMs: 15000,
                addInImageMetadata: {
                    viewingDuration: true,
                },
                storageTargets: [
                    {
                        enable: true,
                        type: 'flat',
                        directory: 'screenshots/audit',
                    },
                ],
            },
            logger
        );

        expect(mockFsPromises.writeFile).toHaveBeenCalledTimes(2);

        const secondWrittenBuffer = mockFsPromises.writeFile.mock.calls[1][1];
        const outPng = PNG.sync.read(secondWrittenBuffer);

        // The header should be present.
        expect(outPng.height).toBeGreaterThan(srcPng.height);

        expect(logger.error).not.toHaveBeenCalled();
    });

    test('expands PNG width to fit long (capped) metadata values', async () => {
        const { downloadScreenshot } = await import('../audit-screenshots.js');

        const logger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
        };

        const srcPng = new PNG({ width: 20, height: 10 });
        for (let y = 0; y < srcPng.height; y += 1) {
            for (let x = 0; x < srcPng.width; x += 1) {
                const idx = (srcPng.width * y + x) << 2;
                srcPng.data[idx] = 0;
                srcPng.data[idx + 1] = 0;
                srcPng.data[idx + 2] = 255;
                srcPng.data[idx + 3] = 255;
            }
        }
        const srcBuffer = PNG.sync.write(srcPng);

        mockAxios.request.mockResolvedValue({
            status: 200,
            headers: { 'content-type': 'image/png' },
            data: srcBuffer,
        });

        await downloadScreenshot(
            'https://example.com/screenshot.png',
            {
                timestamp: '2025-12-22T12:34:56.000Z',
                eventId: 'evt-1',
                correlationId: 'corr-1',
                payload: {
                    context: {
                        user: 'LAB\\test-user',
                        appId: 'app-1',
                        appName: 'A'.repeat(220),
                        sheetName: 'SHEET',
                    },
                    event: {
                        type: 'screenshot',
                    },
                },
            },
            {
                enable: true,
                downloadTimeoutMs: 15000,
                addInImageMetadata: {
                    appName: true,
                },
                storageTargets: [
                    {
                        enable: true,
                        type: 'flat',
                        directory: 'screenshots/audit',
                    },
                ],
            },
            logger
        );

        expect(mockFsPromises.writeFile).toHaveBeenCalledTimes(2);
        const writtenBuffer = mockFsPromises.writeFile.mock.calls[1][1];
        const outPng = PNG.sync.read(writtenBuffer);

        expect(outPng.width).toBeGreaterThan(srcPng.width);
        expect(outPng.height).toBeGreaterThan(srcPng.height);

        expect(logger.error).not.toHaveBeenCalled();
    });
});
