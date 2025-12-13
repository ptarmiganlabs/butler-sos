import { jest, describe, test, beforeEach, afterEach } from '@jest/globals';

// Mock dependencies
jest.unstable_mockModule('fs', () => ({
    default: {
        readFileSync: jest.fn(),
    },
}));

jest.unstable_mockModule('../../globals.js', () => ({
    default: {
        logger: {
            verbose: jest.fn(),
            error: jest.fn(),
            info: jest.fn(),
            debug: jest.fn(),
        },
        isSea: false,
        config: {
            get: jest.fn(),
            has: jest.fn(),
        },
    },
}));

// Import mocked modules
const fs = (await import('fs')).default;
const globals = (await import('../../globals.js')).default;

// Import modules under test
const { getCertificates: getCertificatesUtil, createCertificateOptions } =
    await import('../cert-utils.js');

describe('Certificate loading', () => {
    const mockCertificateOptions = {
        Certificate: '/path/to/client.crt',
        CertificateKey: '/path/to/client.key',
        CertificateCA: '/path/to/ca.crt',
    };

    const mockCertData = '-----BEGIN CERTIFICATE-----\nMIIBIjANBgkqhkiG9w0BAQEFA...';
    const mockKeyData = '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFA...';
    const mockCaData = '-----BEGIN CERTIFICATE-----\nMIICIjANBgkqhkiG9w0BAQEFA...';

    beforeEach(() => {
        jest.clearAllMocks();
        // Reset globals.isSea to default
        globals.isSea = false;
    });

    afterEach(() => {
        jest.clearAllMocks();
        // Reset globals.isSea to default
        globals.isSea = false;
    });

    describe('Certificate utility function', () => {
        test('should load certificates from filesystem', () => {
            fs.readFileSync
                .mockReturnValueOnce(mockCertData)
                .mockReturnValueOnce(mockKeyData)
                .mockReturnValueOnce(mockCaData);

            const certificates = getCertificatesUtil(mockCertificateOptions);

            expect(fs.readFileSync).toHaveBeenCalledWith('/path/to/client.crt');
            expect(fs.readFileSync).toHaveBeenCalledWith('/path/to/client.key');
            expect(fs.readFileSync).toHaveBeenCalledWith('/path/to/ca.crt');
            expect(fs.readFileSync).toHaveBeenCalledTimes(3);

            expect(certificates).toEqual({
                cert: mockCertData,
                key: mockKeyData,
                ca: mockCaData,
            });

            expect(globals.logger.debug).toHaveBeenCalledWith(
                'Loading certificates from disk. SEA mode: false'
            );
            expect(globals.logger.debug).toHaveBeenCalledWith(
                'Loading certificates from disk. cert=/path/to/client.crt'
            );
            expect(globals.logger.debug).toHaveBeenCalledWith(
                'Loading certificates from disk. key=/path/to/client.key'
            );
            expect(globals.logger.debug).toHaveBeenCalledWith(
                'Loading certificates from disk. ca=/path/to/ca.crt'
            );
        });

        test('should throw error when certificate paths are undefined', () => {
            const invalidOptions = {
                Certificate: undefined,
                CertificateKey: '/path/to/client.key',
                CertificateCA: '/path/to/ca.crt',
            };

            expect(() => getCertificatesUtil(invalidOptions)).toThrow(
                'Certificate paths are not properly defined'
            );
        });

        test('should throw error when filesystem read fails', () => {
            fs.readFileSync.mockImplementation((path) => {
                throw new Error(`ENOENT: no such file or directory, open '${path}'`);
            });

            expect(() => getCertificatesUtil(mockCertificateOptions)).toThrow(
                'Failed to load certificates from filesystem'
            );

            expect(fs.readFileSync).toHaveBeenCalledWith('/path/to/client.crt');
        });
    });

    describe('SEA mode behavior', () => {
        beforeEach(() => {
            globals.isSea = true;
        });

        test('should still load certificates from filesystem in SEA mode', () => {
            fs.readFileSync
                .mockReturnValueOnce(mockCertData)
                .mockReturnValueOnce(mockKeyData)
                .mockReturnValueOnce(mockCaData);

            const certificates = getCertificatesUtil(mockCertificateOptions);

            expect(fs.readFileSync).toHaveBeenCalledWith('/path/to/client.crt');
            expect(fs.readFileSync).toHaveBeenCalledWith('/path/to/client.key');
            expect(fs.readFileSync).toHaveBeenCalledWith('/path/to/ca.crt');
            expect(fs.readFileSync).toHaveBeenCalledTimes(3);

            expect(certificates).toEqual({
                cert: mockCertData,
                key: mockKeyData,
                ca: mockCaData,
            });

            expect(globals.logger.debug).toHaveBeenCalledWith(
                'Loading certificates from disk. SEA mode: true'
            );
        });

        test('should handle filesystem errors in SEA mode', () => {
            fs.readFileSync.mockImplementation((path) => {
                throw new Error(`ENOENT: no such file or directory, open '${path}'`);
            });

            expect(() => getCertificatesUtil(mockCertificateOptions)).toThrow(
                'Failed to load certificates from filesystem'
            );
        });
    });

    describe('Certificate options creation', () => {
        test('should create certificate options from global configuration', () => {
            // Mock the config get calls
            globals.config.get
                .mockReturnValueOnce('cert/client.crt')
                .mockReturnValueOnce('cert/client.key')
                .mockReturnValueOnce('cert/ca.crt');
            globals.config.has.mockReturnValue(false);

            const options = createCertificateOptions();

            expect(globals.config.get).toHaveBeenCalledWith('Butler-SOS.cert.clientCert');
            expect(globals.config.get).toHaveBeenCalledWith('Butler-SOS.cert.clientCertKey');
            expect(globals.config.get).toHaveBeenCalledWith('Butler-SOS.cert.clientCertCA');
            expect(globals.config.has).toHaveBeenCalledWith('Butler-SOS.cert.clientCertPassphrase');

            // Verify the paths are resolved to absolute paths
            expect(options.Certificate).toMatch(/cert\/client\.crt$/);
            expect(options.CertificateKey).toMatch(/cert\/client\.key$/);
            expect(options.CertificateCA).toMatch(/cert\/ca\.crt$/);
            expect(options.CertificatePassphrase).toBeNull();
        });

        test('should include passphrase when configured', () => {
            globals.config.get
                .mockReturnValueOnce('cert/client.crt')
                .mockReturnValueOnce('cert/client.key')
                .mockReturnValueOnce('cert/ca.crt')
                .mockReturnValue('my-passphrase'); // Any subsequent calls return the passphrase
            globals.config.has.mockReturnValue(true);

            const options = createCertificateOptions();

            expect(globals.config.get).toHaveBeenCalledWith('Butler-SOS.cert.clientCertPassphrase');
            expect(options.CertificatePassphrase).toBe('my-passphrase');
        });

        test('should set passphrase to null when empty string configured', () => {
            globals.config.get
                .mockReturnValueOnce('cert/client.crt')
                .mockReturnValueOnce('cert/client.key')
                .mockReturnValueOnce('cert/ca.crt')
                .mockReturnValueOnce('');
            globals.config.has.mockReturnValue(true);

            const options = createCertificateOptions();

            expect(options.CertificatePassphrase).toBeNull();
        });
    });

    describe('Certificate format consistency', () => {
        test('should handle various certificate formats', () => {
            const formats = [
                '-----BEGIN CERTIFICATE-----\nMIIBIjANBgkqhkiG9w0BAQEFA...\n-----END CERTIFICATE-----',
                '-----BEGIN CERTIFICATE-----\nMIICIjANBgkqhkiG9w0BAQEFA...\n-----END CERTIFICATE-----\n',
                'MIIC...', // base64 without headers
            ];

            formats.forEach((certFormat, index) => {
                fs.readFileSync.mockClear();
                fs.readFileSync.mockReturnValue(certFormat);

                const certs = getCertificatesUtil({
                    Certificate: `/cert${index}.crt`,
                    CertificateKey: `/key${index}.key`,
                    CertificateCA: `/ca${index}.crt`,
                });

                expect(certs.cert).toBe(certFormat);
            });
        });
    });

    describe('Certificate path handling', () => {
        test('should handle different certificate path formats', () => {
            const testPaths = [
                {
                    Certificate: 'client.crt',
                    CertificateKey: 'client.key',
                    CertificateCA: 'ca.crt',
                },
                {
                    Certificate: './certs/client.crt',
                    CertificateKey: './certs/client.key',
                    CertificateCA: './certs/ca.crt',
                },
                {
                    Certificate: '/absolute/path/client.crt',
                    CertificateKey: '/absolute/path/client.key',
                    CertificateCA: '/absolute/path/ca.crt',
                },
                {
                    Certificate: 'certs\\client.crt',
                    CertificateKey: 'certs\\client.key',
                    CertificateCA: 'certs\\ca.crt',
                }, // Windows paths
            ];

            testPaths.forEach((paths) => {
                fs.readFileSync.mockClear();
                fs.readFileSync.mockReturnValue('dummy-cert');

                getCertificatesUtil(paths);

                expect(fs.readFileSync).toHaveBeenCalledWith(paths.Certificate);
                expect(fs.readFileSync).toHaveBeenCalledWith(paths.CertificateKey);
                expect(fs.readFileSync).toHaveBeenCalledWith(paths.CertificateCA);
            });
        });
    });

    describe('Integration with TLS configuration', () => {
        test('should produce certificates compatible with HTTPS agent configuration', () => {
            const mockHttpsAgentOptions = {};

            fs.readFileSync.mockClear();
            fs.readFileSync
                .mockReturnValueOnce(mockCertData)
                .mockReturnValueOnce(mockKeyData)
                .mockReturnValueOnce(mockCaData);

            const certificates = getCertificatesUtil(mockCertificateOptions);

            // Verify that certificate structure is suitable for HTTPS agent
            expect(typeof certificates.cert).toBe('string');
            expect(typeof certificates.key).toBe('string');
            expect(typeof certificates.ca).toBe('string');

            // These should be assignable to HTTPS agent options
            Object.assign(mockHttpsAgentOptions, certificates);
            expect(mockHttpsAgentOptions.cert).toBe(mockCertData);
            expect(mockHttpsAgentOptions.key).toBe(mockKeyData);
            expect(mockHttpsAgentOptions.ca).toBe(mockCaData);
        });
    });
});
