import { jest, describe, test, beforeEach, afterEach } from '@jest/globals';

// Mock dependencies
jest.unstable_mockModule('fs', () => ({
    default: {
        readFileSync: jest.fn(),
    },
}));

jest.unstable_mockModule('../sea-wrapper.js', () => ({
    default: {
        getAsset: jest.fn(),
        isSea: jest.fn(),
    },
}));

jest.unstable_mockModule('../../globals.js', () => ({
    default: {
        logger: {
            verbose: jest.fn(),
            error: jest.fn(),
            info: jest.fn(),
        },
        isSea: false,
    },
}));

// Import mocked modules
const fs = (await import('fs')).default;
const sea = (await import('../sea-wrapper.js')).default;
const globals = (await import('../../globals.js')).default;

// Import modules under test
const { getCertificates: getProxyCertificates } = await import('../proxysessionmetrics.js');
const { getCertificates: getHealthCertificates } = await import('../healthmetrics.js');

describe('Certificate loading in SEA vs non-SEA modes', () => {
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

    describe('Non-SEA mode certificate loading', () => {
        beforeEach(() => {
            globals.isSea = false;
        });

        test('should load certificates from filesystem using fs.readFileSync - proxysessionmetrics', () => {
            // Mock filesystem operations for this specific test
            fs.readFileSync
                .mockReturnValueOnce(mockCertData)
                .mockReturnValueOnce(mockKeyData)
                .mockReturnValueOnce(mockCaData);

            const certificates = getProxyCertificates(mockCertificateOptions);

            expect(fs.readFileSync).toHaveBeenCalledWith('/path/to/client.crt');
            expect(fs.readFileSync).toHaveBeenCalledWith('/path/to/client.key');
            expect(fs.readFileSync).toHaveBeenCalledWith('/path/to/ca.crt');
            expect(fs.readFileSync).toHaveBeenCalledTimes(3);

            expect(certificates).toEqual({
                cert: mockCertData,
                key: mockKeyData,
                ca: mockCaData,
            });

            // Should not call SEA functions
            expect(sea.getAsset).not.toHaveBeenCalled();
        });

        test('should load certificates from filesystem using fs.readFileSync - healthmetrics', () => {
            // Mock filesystem operations for this specific test
            fs.readFileSync
                .mockReturnValueOnce(mockCertData)
                .mockReturnValueOnce(mockKeyData)
                .mockReturnValueOnce(mockCaData);

            const certificates = getHealthCertificates(mockCertificateOptions);

            expect(fs.readFileSync).toHaveBeenCalledWith('/path/to/client.crt');
            expect(fs.readFileSync).toHaveBeenCalledWith('/path/to/client.key');
            expect(fs.readFileSync).toHaveBeenCalledWith('/path/to/ca.crt');
            expect(fs.readFileSync).toHaveBeenCalledTimes(3);

            expect(certificates).toEqual({
                cert: mockCertData,
                key: mockKeyData,
                ca: mockCaData,
            });

            // Should not call SEA functions
            expect(sea.getAsset).not.toHaveBeenCalled();
        });

        test('should handle filesystem errors gracefully - proxysessionmetrics', () => {
            fs.readFileSync.mockImplementation((path) => {
                throw new Error(`ENOENT: no such file or directory, open '${path}'`);
            });

            expect(() => getProxyCertificates(mockCertificateOptions)).toThrow(
                "ENOENT: no such file or directory, open '/path/to/client.crt'"
            );

            expect(fs.readFileSync).toHaveBeenCalledWith('/path/to/client.crt');
        });

        test('should handle filesystem errors gracefully - healthmetrics', () => {
            fs.readFileSync.mockImplementation((path) => {
                throw new Error(`ENOENT: no such file or directory, open '${path}'`);
            });

            expect(() => getHealthCertificates(mockCertificateOptions)).toThrow(
                "ENOENT: no such file or directory, open '/path/to/client.crt'"
            );

            expect(fs.readFileSync).toHaveBeenCalledWith('/path/to/client.crt');
        });
    });

    describe('SEA mode certificate loading', () => {
        beforeEach(() => {
            globals.isSea = true;
        });

        test('should load certificates from SEA assets using sea.getAsset - proxysessionmetrics', () => {
            // Mock SEA asset operations for this specific test
            sea.getAsset
                .mockReturnValueOnce(mockCertData)
                .mockReturnValueOnce(mockKeyData)
                .mockReturnValueOnce(mockCaData);

            const certificates = getProxyCertificates(mockCertificateOptions);

            expect(sea.getAsset).toHaveBeenCalledWith('/path/to/client.crt', 'utf8');
            expect(sea.getAsset).toHaveBeenCalledWith('/path/to/client.key', 'utf8');
            expect(sea.getAsset).toHaveBeenCalledWith('/path/to/ca.crt', 'utf8');
            expect(sea.getAsset).toHaveBeenCalledTimes(3);

            expect(certificates).toEqual({
                cert: mockCertData,
                key: mockKeyData,
                ca: mockCaData,
            });

            // Should not call filesystem functions
            expect(fs.readFileSync).not.toHaveBeenCalled();
        });

        test('should load certificates from SEA assets using sea.getAsset - healthmetrics', () => {
            // Mock SEA asset operations for this specific test
            sea.getAsset
                .mockReturnValueOnce(mockCertData)
                .mockReturnValueOnce(mockKeyData)
                .mockReturnValueOnce(mockCaData);

            const certificates = getHealthCertificates(mockCertificateOptions);

            expect(sea.getAsset).toHaveBeenCalledWith('/path/to/client.crt', 'utf8');
            expect(sea.getAsset).toHaveBeenCalledWith('/path/to/client.key', 'utf8');
            expect(sea.getAsset).toHaveBeenCalledWith('/path/to/ca.crt', 'utf8');
            expect(sea.getAsset).toHaveBeenCalledTimes(3);

            expect(certificates).toEqual({
                cert: mockCertData,
                key: mockKeyData,
                ca: mockCaData,
            });

            // Should not call filesystem functions
            expect(fs.readFileSync).not.toHaveBeenCalled();
        });

        test('should handle missing SEA assets gracefully - proxysessionmetrics', () => {
            sea.getAsset.mockReturnValue(undefined);

            const certificates = getProxyCertificates(mockCertificateOptions);

            expect(sea.getAsset).toHaveBeenCalledWith('/path/to/client.crt', 'utf8');
            expect(certificates).toEqual({
                cert: undefined,
                key: undefined,
                ca: undefined,
            });
        });

        test('should handle missing SEA assets gracefully - healthmetrics', () => {
            sea.getAsset.mockReturnValue(undefined);

            const certificates = getHealthCertificates(mockCertificateOptions);

            expect(sea.getAsset).toHaveBeenCalledWith('/path/to/client.crt', 'utf8');
            expect(certificates).toEqual({
                cert: undefined,
                key: undefined,
                ca: undefined,
            });
        });

        test('should handle mixed success/failure scenarios - proxysessionmetrics', () => {
            sea.getAsset
                .mockReturnValueOnce(mockCertData)    // cert succeeds
                .mockReturnValueOnce(undefined)       // key fails
                .mockReturnValueOnce(mockCaData);     // ca succeeds

            const certificates = getProxyCertificates(mockCertificateOptions);

            expect(certificates).toEqual({
                cert: mockCertData,
                key: undefined,
                ca: mockCaData,
            });
        });

        test('should handle mixed success/failure scenarios - healthmetrics', () => {
            sea.getAsset
                .mockReturnValueOnce(mockCertData)    // cert succeeds
                .mockReturnValueOnce(undefined)       // key fails
                .mockReturnValueOnce(mockCaData);     // ca succeeds

            const certificates = getHealthCertificates(mockCertificateOptions);

            expect(certificates).toEqual({
                cert: mockCertData,
                key: undefined,
                ca: mockCaData,
            });
        });
    });

    describe('Certificate format consistency', () => {
        test('should handle various certificate formats in both modes', () => {
            const formats = [
                '-----BEGIN CERTIFICATE-----\nMIIBIjANBgkqhkiG9w0BAQEFA...\n-----END CERTIFICATE-----',
                '-----BEGIN CERTIFICATE-----\nMIICIjANBgkqhkiG9w0BAQEFA...\n-----END CERTIFICATE-----\n',
                'MIIC...', // base64 without headers
            ];

            formats.forEach((certFormat, index) => {
                // Test non-SEA mode
                globals.isSea = false;
                fs.readFileSync.mockClear();
                fs.readFileSync.mockReturnValue(certFormat);
                
                const nonSeaCerts = getProxyCertificates({
                    Certificate: `/cert${index}.crt`,
                    CertificateKey: `/key${index}.key`,
                    CertificateCA: `/ca${index}.crt`,
                });
                
                expect(nonSeaCerts.cert).toBe(certFormat);

                // Test SEA mode
                globals.isSea = true;
                sea.getAsset.mockClear();
                sea.getAsset.mockReturnValue(certFormat);
                
                const seaCerts = getProxyCertificates({
                    Certificate: `/cert${index}.crt`,
                    CertificateKey: `/key${index}.key`,
                    CertificateCA: `/ca${index}.crt`,
                });
                
                expect(seaCerts.cert).toBe(certFormat);
            });
        });
    });

    describe('Certificate path handling', () => {
        test('should handle different certificate path formats', () => {
            const testPaths = [
                { Certificate: 'client.crt', CertificateKey: 'client.key', CertificateCA: 'ca.crt' },
                { Certificate: './certs/client.crt', CertificateKey: './certs/client.key', CertificateCA: './certs/ca.crt' },
                { Certificate: '/absolute/path/client.crt', CertificateKey: '/absolute/path/client.key', CertificateCA: '/absolute/path/ca.crt' },
                { Certificate: 'certs\\client.crt', CertificateKey: 'certs\\client.key', CertificateCA: 'certs\\ca.crt' }, // Windows paths
            ];

            testPaths.forEach((paths, index) => {
                // Test non-SEA mode
                globals.isSea = false;
                fs.readFileSync.mockClear();
                fs.readFileSync.mockReturnValue('dummy-cert');
                
                getProxyCertificates(paths);
                
                expect(fs.readFileSync).toHaveBeenCalledWith(paths.Certificate);
                expect(fs.readFileSync).toHaveBeenCalledWith(paths.CertificateKey);
                expect(fs.readFileSync).toHaveBeenCalledWith(paths.CertificateCA);

                // Test SEA mode
                globals.isSea = true;
                sea.getAsset.mockClear();
                sea.getAsset.mockReturnValue('dummy-cert');
                
                getHealthCertificates(paths);
                
                expect(sea.getAsset).toHaveBeenCalledWith(paths.Certificate, 'utf8');
                expect(sea.getAsset).toHaveBeenCalledWith(paths.CertificateKey, 'utf8');
                expect(sea.getAsset).toHaveBeenCalledWith(paths.CertificateCA, 'utf8');
            });
        });
    });

    describe('Error handling consistency', () => {
        test('should provide consistent error handling patterns across modes', () => {
            // Non-SEA mode error
            globals.isSea = false;
            fs.readFileSync.mockImplementation(() => {
                throw new Error('Permission denied');
            });

            expect(() => getProxyCertificates(mockCertificateOptions)).toThrow('Permission denied');

            // SEA mode should not throw for missing assets, but return undefined
            globals.isSea = true;
            sea.getAsset.mockClear();
            sea.getAsset.mockReturnValue(undefined);
            
            const certificates = getHealthCertificates(mockCertificateOptions);
            expect(certificates.cert).toBeUndefined();
            expect(certificates.key).toBeUndefined();
            expect(certificates.ca).toBeUndefined();
        });
    });

    describe('Integration with TLS configuration', () => {
        test('should produce certificates compatible with HTTPS agent configuration', () => {
            const mockHttpsAgentOptions = {};
            
            // Test non-SEA mode
            globals.isSea = false;
            fs.readFileSync.mockClear();
            fs.readFileSync
                .mockReturnValueOnce(mockCertData)
                .mockReturnValueOnce(mockKeyData)
                .mockReturnValueOnce(mockCaData);

            const nonSeaCerts = getProxyCertificates(mockCertificateOptions);
            
            // Verify that certificate structure is suitable for HTTPS agent
            expect(typeof nonSeaCerts.cert).toBe('string');
            expect(typeof nonSeaCerts.key).toBe('string');
            expect(typeof nonSeaCerts.ca).toBe('string');
            
            // These should be assignable to HTTPS agent options
            Object.assign(mockHttpsAgentOptions, nonSeaCerts);
            expect(mockHttpsAgentOptions.cert).toBe(mockCertData);
            expect(mockHttpsAgentOptions.key).toBe(mockKeyData);
            expect(mockHttpsAgentOptions.ca).toBe(mockCaData);

            // Test SEA mode
            globals.isSea = true;
            sea.getAsset.mockClear();
            sea.getAsset
                .mockReturnValueOnce(mockCertData)
                .mockReturnValueOnce(mockKeyData)
                .mockReturnValueOnce(mockCaData);

            const seaCerts = getHealthCertificates(mockCertificateOptions);
            
            // Should produce identical structure
            expect(seaCerts).toEqual(nonSeaCerts);
        });
    });
});