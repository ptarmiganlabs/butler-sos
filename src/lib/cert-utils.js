/**
 * Certificate utilities for loading TLS certificates from the filesystem
 */

import fs from 'fs';
import path from 'path';
import globals from '../globals.js';

/**
 * Creates certificate options object from global configuration.
 *
 * This function reads certificate paths from the Butler-SOS configuration
 * and creates an options object suitable for use with getCertificates().
 *
 * @property {string} Certificate - Absolute path to client certificate
 * @property {string} CertificateKey - Absolute path to client certificate key
 * @property {string} CertificateCA - Absolute path to certificate authority
 * @property {string|null} CertificatePassphrase - Certificate passphrase or null
 * @returns {object} Certificate options object with resolved paths
 */
export function createCertificateOptions() {
    const options = {};

    options.Certificate = path.resolve(
        process.cwd(),
        globals.config.get('Butler-SOS.cert.clientCert')
    );
    options.CertificateKey = path.resolve(
        process.cwd(),
        globals.config.get('Butler-SOS.cert.clientCertKey')
    );
    options.CertificateCA = path.resolve(
        process.cwd(),
        globals.config.get('Butler-SOS.cert.clientCertCA')
    );

    if (
        globals.config.has('Butler-SOS.cert.clientCertPassphrase') === true &&
        globals.config.get('Butler-SOS.cert.clientCertPassphrase')?.length > 0
    ) {
        options.CertificatePassphrase = globals.config.get('Butler-SOS.cert.clientCertPassphrase');
    } else {
        options.CertificatePassphrase = null;
    }

    return options;
}

/**
 * Loads TLS certificates from the filesystem.
 *
 * Certificates are always loaded from disk files, regardless of whether the
 * application is running in SEA (Single Executable Application) mode or not.
 * This ensures security and flexibility by keeping certificates as external files.
 *
 * @param {object} options - Certificate options
 * @param {string} options.Certificate - Path to the client certificate file
 * @param {string} options.CertificateKey - Path to the client certificate key file
 * @param {string} options.CertificateCA - Path to the certificate authority file
 * @param {string} [options.CertificatePassphrase] - Optional passphrase for the certificate
 * @returns {object} Object containing cert, key, and ca properties with certificate contents
 * @throws {Error} If any certificate file cannot be read
 */
export function getCertificates(options) {
    const certificate = {};

    globals.logger.debug(`Loading certificates from disk. SEA mode: ${globals.isSea}`);
    globals.logger.debug(`Loading certificates from disk. cert=${options.Certificate}`);
    globals.logger.debug(`Loading certificates from disk. key=${options.CertificateKey}`);
    globals.logger.debug(`Loading certificates from disk. ca=${options.CertificateCA}`);

    if (!options.Certificate || !options.CertificateKey || !options.CertificateCA) {
        throw new Error(
            'Certificate paths are not properly defined. Please check your configuration.'
        );
    }

    try {
        certificate.cert = fs.readFileSync(options.Certificate);
        certificate.key = fs.readFileSync(options.CertificateKey);
        certificate.ca = fs.readFileSync(options.CertificateCA);
    } catch (error) {
        throw new Error(
            `Failed to load certificates from filesystem. ` +
                `Error: ${error.message}. ` +
                `Certificate paths: cert=${options.Certificate}, key=${options.CertificateKey}, ca=${options.CertificateCA}`
        );
    }

    return certificate;
}
