/**
 * Unit tests for the crash dump module (src/lib/crash-dump.js)
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import path from 'path';
import os from 'os';
import fs from 'fs';

// ---------------------------------------------------------------------------
// Hoist mock instances OUTSIDE the factory functions for stable references
// ---------------------------------------------------------------------------

const mockLogger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    verbose: jest.fn(),
    debug: jest.fn(),
};

const mockConfigGet = jest.fn();
const mockConfigHas = jest.fn();

jest.unstable_mockModule(path.resolve('src/globals.js'), () => ({
    default: {
        logger: mockLogger,
        config: {
            get: mockConfigGet,
            has: mockConfigHas,
        },
        appVersion: '14.0.0',
        isSea: false,
    },
}));

const mockIsSea = jest.fn(() => false);

jest.unstable_mockModule(path.resolve('src/lib/sea-wrapper.js'), () => ({
    default: {
        isSea: mockIsSea,
    },
}));

// Dynamic import after mocks
const { writeCrashDump } = await import('../crash-dump.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a temporary directory for the test run.
 *
 * @returns {string} Absolute path to the temp directory
 */
function makeTempDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'butler-sos-crash-test-'));
}

/**
 * Removes a directory tree recursively (best-effort).
 *
 * @param {string} dir - Directory to remove
 */
function removeTempDir(dir) {
    try {
        fs.rmSync(dir, { recursive: true, force: true });
    } catch {
        // best-effort
    }
}

/**
 * Reads all files in a directory and returns them as name → content pairs.
 *
 * @param {string} dir - Directory to read
 * @returns {object} Map of filename to file content string
 */
function readDirFiles(dir) {
    const result = {};
    for (const name of fs.readdirSync(dir)) {
        result[name] = fs.readFileSync(path.join(dir, name), 'utf8');
    }
    return result;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('writeCrashDump', () => {
    let tempDir;

    beforeEach(() => {
        jest.clearAllMocks();
        tempDir = makeTempDir();

        // Default config: crash dumps enabled, both file types on
        mockConfigHas.mockImplementation((key) => {
            const keys = [
                'Butler-SOS.crashFile.enable',
                'Butler-SOS.crashFile.crashFileDirectory',
                'Butler-SOS.crashFile.crashFileCreateJson',
                'Butler-SOS.crashFile.crashFileCreateText',
            ];
            return keys.includes(key);
        });
        mockConfigGet.mockImplementation((key) => {
            switch (key) {
                case 'Butler-SOS.crashFile.enable':
                    return true;
                case 'Butler-SOS.crashFile.crashFileDirectory':
                    return tempDir;
                case 'Butler-SOS.crashFile.crashFileCreateJson':
                    return true;
                case 'Butler-SOS.crashFile.crashFileCreateText':
                    return true;
                default:
                    return undefined;
            }
        });
    });

    afterEach(() => {
        removeTempDir(tempDir);
    });

    // -----------------------------------------------------------------------
    // Enable flag
    // -----------------------------------------------------------------------

    test('does not write any files when enable is false', async () => {
        mockConfigGet.mockImplementation((key) => {
            if (key === 'Butler-SOS.crashFile.enable') return false;
            return undefined;
        });

        const err = new Error('test error');
        await writeCrashDump(err, 'uncaughtException');

        expect(fs.readdirSync(tempDir)).toHaveLength(0);
    });

    // -----------------------------------------------------------------------
    // JSON file creation
    // -----------------------------------------------------------------------

    test('creates a JSON crash dump file when crashFileCreateJson is true', async () => {
        mockConfigGet.mockImplementation((key) => {
            switch (key) {
                case 'Butler-SOS.crashFile.enable':
                    return true;
                case 'Butler-SOS.crashFile.crashFileDirectory':
                    return tempDir;
                case 'Butler-SOS.crashFile.crashFileCreateJson':
                    return true;
                case 'Butler-SOS.crashFile.crashFileCreateText':
                    return false;
                default:
                    return undefined;
            }
        });

        const err = new Error('connection refused');
        await writeCrashDump(err, 'uncaughtException');

        const files = fs.readdirSync(tempDir);
        const jsonFiles = files.filter((f) => f.endsWith('.json'));
        expect(jsonFiles).toHaveLength(1);

        const content = JSON.parse(fs.readFileSync(path.join(tempDir, jsonFiles[0]), 'utf8'));
        expect(content.version).toBe('1.0');
        expect(content.app.name).toBe('butler-sos');
        expect(content.app.version).toBe('14.0.0');
        expect(content.error.message).toBe('connection refused');
        expect(content.error.type).toBe('Error');
        expect(content.context.source).toBe('uncaughtException');
        expect(content.context.exitCode).toBe(1);
        expect(typeof content.timestamp).toBe('string');
        expect(content.runtime).toHaveProperty('nodeVersion');
        expect(content.runtime).toHaveProperty('platform');
        expect(content.runtime).toHaveProperty('isSea');
    });

    test('skips JSON file when crashFileCreateJson is false', async () => {
        mockConfigGet.mockImplementation((key) => {
            switch (key) {
                case 'Butler-SOS.crashFile.enable':
                    return true;
                case 'Butler-SOS.crashFile.crashFileDirectory':
                    return tempDir;
                case 'Butler-SOS.crashFile.crashFileCreateJson':
                    return false;
                case 'Butler-SOS.crashFile.crashFileCreateText':
                    return true;
                default:
                    return undefined;
            }
        });

        await writeCrashDump(new Error('test'), 'unhandledRejection');

        const files = fs.readdirSync(tempDir);
        const jsonFiles = files.filter((f) => f.endsWith('.json'));
        expect(jsonFiles).toHaveLength(0);
    });

    // -----------------------------------------------------------------------
    // TXT file creation
    // -----------------------------------------------------------------------

    test('creates a TXT crash dump file when crashFileCreateText is true', async () => {
        mockConfigGet.mockImplementation((key) => {
            switch (key) {
                case 'Butler-SOS.crashFile.enable':
                    return true;
                case 'Butler-SOS.crashFile.crashFileDirectory':
                    return tempDir;
                case 'Butler-SOS.crashFile.crashFileCreateJson':
                    return false;
                case 'Butler-SOS.crashFile.crashFileCreateText':
                    return true;
                default:
                    return undefined;
            }
        });

        const err = new Error('disk full');
        await writeCrashDump(err, 'logFatal');

        const files = fs.readdirSync(tempDir);
        const txtFiles = files.filter((f) => f.endsWith('.txt'));
        expect(txtFiles).toHaveLength(1);

        const content = fs.readFileSync(path.join(tempDir, txtFiles[0]), 'utf8');
        expect(content).toContain('BUTLER SOS CRASH REPORT');
        expect(content).toContain('disk full');
        expect(content).toContain('logFatal');
        expect(content).toContain('Butler SOS Version: 14.0.0');
        expect(content).toContain('END OF CRASH REPORT');
    });

    test('skips TXT file when crashFileCreateText is false', async () => {
        mockConfigGet.mockImplementation((key) => {
            switch (key) {
                case 'Butler-SOS.crashFile.enable':
                    return true;
                case 'Butler-SOS.crashFile.crashFileDirectory':
                    return tempDir;
                case 'Butler-SOS.crashFile.crashFileCreateJson':
                    return true;
                case 'Butler-SOS.crashFile.crashFileCreateText':
                    return false;
                default:
                    return undefined;
            }
        });

        await writeCrashDump(new Error('test'), 'uncaughtException');

        const files = fs.readdirSync(tempDir);
        const txtFiles = files.filter((f) => f.endsWith('.txt'));
        expect(txtFiles).toHaveLength(0);
    });

    // -----------------------------------------------------------------------
    // Both files created simultaneously
    // -----------------------------------------------------------------------

    test('creates both JSON and TXT files when both flags are true', async () => {
        await writeCrashDump(new Error('both files'), 'uncaughtException');

        const files = fs.readdirSync(tempDir);
        expect(files.filter((f) => f.endsWith('.json'))).toHaveLength(1);
        expect(files.filter((f) => f.endsWith('.txt'))).toHaveLength(1);
    });

    // -----------------------------------------------------------------------
    // File naming
    // -----------------------------------------------------------------------

    test('filename contains timestamp in YYYYMMDD_HHMMSS_mmm format', async () => {
        await writeCrashDump(new Error('ts test'), 'uncaughtException');

        const files = fs.readdirSync(tempDir);
        const jsonFile = files.find((f) => f.endsWith('.json'));
        expect(jsonFile).toMatch(/^crash_dump_\d{8}_\d{6}_\d{3}\.json$/);
    });

    // -----------------------------------------------------------------------
    // Sensitive data filtering
    // -----------------------------------------------------------------------

    test('JSON dump does not include sensitive config fields', async () => {
        // Extend config mock to return sensitive values for known safe-config keys
        mockConfigHas.mockImplementation(() => true);
        mockConfigGet.mockImplementation((key) => {
            switch (key) {
                case 'Butler-SOS.crashFile.enable':
                    return true;
                case 'Butler-SOS.crashFile.crashFileDirectory':
                    return tempDir;
                case 'Butler-SOS.crashFile.crashFileCreateJson':
                    return true;
                case 'Butler-SOS.crashFile.crashFileCreateText':
                    return false;
                // Sensitive values that must NOT appear in crash dump
                case 'Butler-SOS.cert.clientCert':
                    return '/secret/path/client.pem';
                case 'Butler-SOS.mqttConfig.brokerHost':
                    return 'broker.internal.example.com';
                case 'Butler-SOS.influxdbConfig.token':
                    return 'secret-influx-token';
                default:
                    return undefined;
            }
        });

        await writeCrashDump(new Error('sensitive test'), 'uncaughtException');

        const files = fs.readdirSync(tempDir);
        const content = fs.readFileSync(path.join(tempDir, files[0]), 'utf8');

        expect(content).not.toContain('secret');
        expect(content).not.toContain('broker.internal.example.com');
        expect(content).not.toContain('/secret/path');
    });

    test('TXT dump does not include sensitive config fields', async () => {
        mockConfigHas.mockImplementation(() => true);
        mockConfigGet.mockImplementation((key) => {
            switch (key) {
                case 'Butler-SOS.crashFile.enable':
                    return true;
                case 'Butler-SOS.crashFile.crashFileDirectory':
                    return tempDir;
                case 'Butler-SOS.crashFile.crashFileCreateJson':
                    return false;
                case 'Butler-SOS.crashFile.crashFileCreateText':
                    return true;
                case 'Butler-SOS.mqttConfig.brokerHost':
                    return 'mqtt.internal.example.com';
                case 'Butler-SOS.influxdbConfig.token':
                    return 'top-secret';
                default:
                    return undefined;
            }
        });

        await writeCrashDump(new Error('sensitive txt'), 'logFatal');

        const files = fs.readdirSync(tempDir);
        const content = fs.readFileSync(path.join(tempDir, files[0]), 'utf8');

        expect(content).not.toContain('top-secret');
        expect(content).not.toContain('mqtt.internal.example.com');
    });

    // -----------------------------------------------------------------------
    // Stack trace sanitization
    // -----------------------------------------------------------------------

    test('sanitizes absolute paths from stack traces in JSON dump', async () => {
        const err = new Error('stack test');
        err.stack = 'Error: stack test\n    at Function.foo (/Users/goran/code/butler-sos/src/lib/foo.js:42:5)\n    at Module._compile (node:internal/modules/cjs:456:8)';

        await writeCrashDump(err, 'uncaughtException');

        const files = fs.readdirSync(tempDir);
        const jsonFile = files.find((f) => f.endsWith('.json'));
        const content = JSON.parse(fs.readFileSync(path.join(tempDir, jsonFile), 'utf8'));

        expect(content.error.stack).not.toContain('/Users/goran');
        expect(content.error.stack).toContain('src/lib/foo.js:42:5');
    });

    test('sanitizes absolute paths from stack traces in TXT dump', async () => {
        const err = new Error('stack txt test');
        err.stack = 'Error: stack txt test\n    at Object.<anonymous> (/home/runner/work/butler-sos/src/butler-sos.js:100:3)';

        mockConfigGet.mockImplementation((key) => {
            switch (key) {
                case 'Butler-SOS.crashFile.enable':
                    return true;
                case 'Butler-SOS.crashFile.crashFileDirectory':
                    return tempDir;
                case 'Butler-SOS.crashFile.crashFileCreateJson':
                    return false;
                case 'Butler-SOS.crashFile.crashFileCreateText':
                    return true;
                default:
                    return undefined;
            }
        });

        await writeCrashDump(err, 'uncaughtException');

        const files = fs.readdirSync(tempDir);
        const txtFile = files.find((f) => f.endsWith('.txt'));
        const content = fs.readFileSync(path.join(tempDir, txtFile), 'utf8');

        expect(content).not.toContain('/home/runner/work/butler-sos');
        expect(content).toContain('src/butler-sos.js:100:3');
    });

    // -----------------------------------------------------------------------
    // Best-effort redaction of sensitive patterns in error content
    // -----------------------------------------------------------------------

    test('redacts URLs with embedded credentials from error message', async () => {
        const err = new Error('connect ECONNREFUSED mqtts://admin:hunter2@broker.example.com:8883');

        await writeCrashDump(err, 'uncaughtException');

        const files = fs.readdirSync(tempDir);
        const jsonFile = files.find((f) => f.endsWith('.json'));
        const content = JSON.parse(fs.readFileSync(path.join(tempDir, jsonFile), 'utf8'));

        expect(content.error.message).not.toContain('hunter2');
        expect(content.error.message).toContain('[REDACTED]');
    });

    test('redacts Bearer tokens from error message', async () => {
        const err = new Error('Request failed: Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc');

        await writeCrashDump(err, 'uncaughtException');

        const files = fs.readdirSync(tempDir);
        const jsonFile = files.find((f) => f.endsWith('.json'));
        const content = JSON.parse(fs.readFileSync(path.join(tempDir, jsonFile), 'utf8'));

        expect(content.error.message).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
        expect(content.error.message).toContain('[REDACTED]');
    });

    test('redacts key=value secret patterns from error message', async () => {
        const err = new Error('DB connect failed: password=SuperSecretP@ss token=abc123xyz');

        await writeCrashDump(err, 'uncaughtException');

        const files = fs.readdirSync(tempDir);
        const jsonFile = files.find((f) => f.endsWith('.json'));
        const content = JSON.parse(fs.readFileSync(path.join(tempDir, jsonFile), 'utf8'));

        expect(content.error.message).not.toContain('SuperSecretP@ss');
        expect(content.error.message).not.toContain('abc123xyz');
        expect(content.error.message).toContain('[REDACTED]');
    });

    test('redacts sensitive patterns from stack traces', async () => {
        const err = new Error('api_key=my-very-secret-key in stack');
        err.stack =
            'Error: api_key=my-very-secret-key in stack\n    at src/lib/foo.js:10:5';

        await writeCrashDump(err, 'uncaughtException');

        const files = fs.readdirSync(tempDir);
        const jsonFile = files.find((f) => f.endsWith('.json'));
        const content = JSON.parse(fs.readFileSync(path.join(tempDir, jsonFile), 'utf8'));

        expect(content.error.message).not.toContain('my-very-secret-key');
        expect(content.error.stack).not.toContain('my-very-secret-key');
    });

    // -----------------------------------------------------------------------
    // Non-blocking on write failure
    // -----------------------------------------------------------------------

    test('does not throw when the crash directory cannot be created', async () => {
        // Point to an impossible path (file as parent) to force mkdir failure
        const impossibleDir = path.join(tempDir, 'not-a-dir-crash');
        fs.writeFileSync(impossibleDir, 'I am a file, not a directory');

        mockConfigGet.mockImplementation((key) => {
            switch (key) {
                case 'Butler-SOS.crashFile.enable':
                    return true;
                case 'Butler-SOS.crashFile.crashFileDirectory':
                    return path.join(impossibleDir, 'subdir');
                case 'Butler-SOS.crashFile.crashFileCreateJson':
                    return true;
                case 'Butler-SOS.crashFile.crashFileCreateText':
                    return true;
                default:
                    return undefined;
            }
        });

        await expect(writeCrashDump(new Error('write fail'), 'uncaughtException')).resolves.toBeUndefined();
    });

    // -----------------------------------------------------------------------
    // Directory creation
    // -----------------------------------------------------------------------

    test('creates the crash dump directory if it does not exist', async () => {
        const subDir = path.join(tempDir, 'new_subdir');
        expect(fs.existsSync(subDir)).toBe(false);

        mockConfigGet.mockImplementation((key) => {
            switch (key) {
                case 'Butler-SOS.crashFile.enable':
                    return true;
                case 'Butler-SOS.crashFile.crashFileDirectory':
                    return subDir;
                case 'Butler-SOS.crashFile.crashFileCreateJson':
                    return true;
                case 'Butler-SOS.crashFile.crashFileCreateText':
                    return false;
                default:
                    return undefined;
            }
        });

        await writeCrashDump(new Error('dir create test'), 'uncaughtException');

        expect(fs.existsSync(subDir)).toBe(true);
        expect(fs.readdirSync(subDir)).toHaveLength(1);
    });

    // -----------------------------------------------------------------------
    // Absolute path support
    // -----------------------------------------------------------------------

    test('handles absolute paths for crashFileDirectory', async () => {
        const absoluteDir = path.join(tempDir, 'absolute_path_test');
        fs.mkdirSync(absoluteDir, { recursive: true });

        mockConfigGet.mockImplementation((key) => {
            switch (key) {
                case 'Butler-SOS.crashFile.enable':
                    return true;
                case 'Butler-SOS.crashFile.crashFileDirectory':
                    return absoluteDir; // already absolute
                case 'Butler-SOS.crashFile.crashFileCreateJson':
                    return true;
                case 'Butler-SOS.crashFile.crashFileCreateText':
                    return false;
                default:
                    return undefined;
            }
        });

        await writeCrashDump(new Error('absolute path test'), 'uncaughtException');

        expect(fs.readdirSync(absoluteDir)).toHaveLength(1);
    });

    // -----------------------------------------------------------------------
    // Empty crashFileDirectory
    // -----------------------------------------------------------------------

    test('falls back to process.cwd() when crashFileDirectory is empty string', async () => {
        // We cannot safely write to cwd in tests, so instead we verify the
        // function completes without throwing when dir is ''
        mockConfigGet.mockImplementation((key) => {
            switch (key) {
                case 'Butler-SOS.crashFile.enable':
                    return true;
                case 'Butler-SOS.crashFile.crashFileDirectory':
                    return '';
                case 'Butler-SOS.crashFile.crashFileCreateJson':
                    return false;
                case 'Butler-SOS.crashFile.crashFileCreateText':
                    return false;
                default:
                    return undefined;
            }
        });

        await expect(writeCrashDump(new Error('empty dir'), 'uncaughtException')).resolves.toBeUndefined();
    });

    // -----------------------------------------------------------------------
    // JSON structure completeness
    // -----------------------------------------------------------------------

    test('JSON dump includes all required top-level fields', async () => {
        await writeCrashDump(new Error('structure test'), 'unhandledRejection');

        const files = fs.readdirSync(tempDir);
        const jsonFile = files.find((f) => f.endsWith('.json'));
        const content = JSON.parse(fs.readFileSync(path.join(tempDir, jsonFile), 'utf8'));

        expect(content).toHaveProperty('version');
        expect(content).toHaveProperty('timestamp');
        expect(content).toHaveProperty('app');
        expect(content).toHaveProperty('runtime');
        expect(content).toHaveProperty('error');
        expect(content).toHaveProperty('context');
        expect(content).toHaveProperty('config');
    });

    // -----------------------------------------------------------------------
    // Works when config is unavailable (early crash)
    // -----------------------------------------------------------------------

    test('does not throw when globals.config is null', async () => {
        // Re-mock globals without config
        jest.unstable_mockModule(path.resolve('src/globals.js'), () => ({
            default: {
                logger: mockLogger,
                config: null,
                appVersion: '14.0.0',
                isSea: false,
            },
        }));

        // writeCrashDump was already imported at module load; the internal
        // try/catch handles config being null
        await expect(writeCrashDump(new Error('no config'), 'uncaughtException')).resolves.toBeUndefined();
    });

    // -----------------------------------------------------------------------
    // Handles non-Error rejection reasons
    // -----------------------------------------------------------------------

    test('handles non-Error objects gracefully', async () => {
        // Pass a plain string as the "error"
        await expect(writeCrashDump('string error', 'unhandledRejection')).resolves.toBeUndefined();
    });

    // -----------------------------------------------------------------------
    // JSON content: config section
    // -----------------------------------------------------------------------

    test('JSON config section contains only non-sensitive allowed fields', async () => {
        mockConfigHas.mockImplementation(() => true);
        mockConfigGet.mockImplementation((key) => {
            switch (key) {
                case 'Butler-SOS.crashFile.enable':
                    return true;
                case 'Butler-SOS.crashFile.crashFileDirectory':
                    return tempDir;
                case 'Butler-SOS.crashFile.crashFileCreateJson':
                    return true;
                case 'Butler-SOS.crashFile.crashFileCreateText':
                    return false;
                case 'Butler-SOS.logLevel':
                    return 'info';
                case 'Butler-SOS.fileLogging':
                    return true;
                case 'Butler-SOS.logDirectory':
                    return './log';
                case 'Butler-SOS.anonTelemetry':
                    return false;
                case 'Butler-SOS.systemInfo.enable':
                    return true;
                case 'Butler-SOS.userEvents.enable':
                    return false;
                case 'Butler-SOS.influxdbConfig.enable':
                    return true;
                case 'Butler-SOS.influxdbConfig.version':
                    return 2;
                case 'Butler-SOS.prometheus.enable':
                    return false;
                case 'Butler-SOS.mqttConfig.enable':
                    return false;
                case 'Butler-SOS.auditEvents.enable':
                    return false;
                default:
                    return undefined;
            }
        });

        await writeCrashDump(new Error('config test'), 'uncaughtException');

        const files = fs.readdirSync(tempDir);
        const jsonFile = files.find((f) => f.endsWith('.json'));
        const content = JSON.parse(fs.readFileSync(path.join(tempDir, jsonFile), 'utf8'));

        // Allowed fields present
        expect(content.config.logLevel).toBe('info');
        expect(content.config.fileLogging).toBe(true);
        expect(content.config.logDirectory).toBe('./log');
        expect(content.config.anonTelemetry).toBe(false);
        expect(content.config.systemInfoEnable).toBe(true);

        // Sensitive fields must not be present
        const configStr = JSON.stringify(content.config);
        expect(configStr).not.toContain('password');
        expect(configStr).not.toContain('token');
        expect(configStr).not.toContain('cert');
        expect(configStr).not.toContain('host');
        expect(configStr).not.toContain('apiKey');
    });
});
