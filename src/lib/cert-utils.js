/**
 * Certificate utilities for loading TLS certificates from the filesystem
 */

import fs from 'fs';
import path from 'path';
import globals from '../globals.js';

/**
 * Cached certificate contents, or null when nothing is cached.
 *
 * @type {{cert: Buffer, key: Buffer, ca: Buffer}|null}
 */
let cachedCertificates = null;

/**
 * Identity of the files behind {@link cachedCertificates}: paths, sizes and modification
 * times. Null when nothing is cached.
 *
 * @type {string|null}
 */
let cacheStamp = null;

/**
 * Builds a string identifying the current on-disk state of the given files.
 *
 * Certificates are re-read only when this changes, which keeps the cache honest about
 * rotation: replacing a certificate on disk changes its mtime, its size, or both, so the
 * next call sees a different stamp and reloads. Caching until restart would have been
 * faster still, but there is no config-reload path in Butler SOS to invalidate on, so a
 * rotated certificate would have gone unnoticed until the process was restarted.
 *
 * `statSync` is used rather than reading the files because it is dramatically cheaper: the
 * point is to stop pulling three certificate bodies off disk on every Sense API call, not
 * to avoid touching the filesystem at all.
 *
 * Returns null if any file cannot be stat'd, which the caller treats as "do not cache" and
 * falls through to the read so the existing error handling stays in charge.
 *
 * @param {string[]} filePaths - Absolute paths to stat, in a stable order.
 * @returns {string|null} Stamp string, or null when any file could not be stat'd.
 */
function buildCacheStamp(filePaths) {
    try {
        return filePaths
            .map((p) => {
                const st = fs.statSync(p);
                return `${p}:${st.size}:${st.mtimeMs}`;
            })
            .join('|');
    } catch {
        return null;
    }
}

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
    globals.logger.debug(`Loading certificates from disk. SEA mode: ${globals.isSea}`);
    globals.logger.debug(`Loading certificates from disk. cert=${options.Certificate}`);
    globals.logger.debug(`Loading certificates from disk. key=${options.CertificateKey}`);
    globals.logger.debug(`Loading certificates from disk. ca=${options.CertificateCA}`);

    if (!options.Certificate || !options.CertificateKey || !options.CertificateCA) {
        throw new Error(
            'Certificate paths are not properly defined. Please check your configuration.'
        );
    }

    const paths = [options.Certificate, options.CertificateKey, options.CertificateCA];
    const stamp = buildCacheStamp(paths);

    // A stamp of null means at least one file could not be stat'd. Fall through to the read
    // so the existing error path produces the same message it always has, rather than
    // reporting a stat failure the caller has never had to handle.
    if (stamp !== null && cacheStamp === stamp && cachedCertificates !== null) {
        return { ...cachedCertificates };
    }

    const certificate = {};

    try {
        certificate.cert = fs.readFileSync(options.Certificate);
        certificate.key = fs.readFileSync(options.CertificateKey);
        certificate.ca = fs.readFileSync(options.CertificateCA);
    } catch (error) {
        // Drop any previous entry: the paths have changed or a file has become unreadable,
        // and serving a stale certificate from before that would hide the problem.
        cachedCertificates = null;
        cacheStamp = null;

        throw new Error(
            `Failed to load certificates from filesystem. ` +
                `Error: ${error.message}. ` +
                `Certificate paths: cert=${options.Certificate}, key=${options.CertificateKey}, ca=${options.CertificateCA}`
        );
    }

    // Only cache when every file could be stat'd, so a cache entry always has a stamp that
    // can later be invalidated.
    if (stamp !== null) {
        cachedCertificates = certificate;
        cacheStamp = stamp;
    }

    return { ...certificate };
}

/**
 * Clears the certificate cache.
 *
 * Exported for tests, which need each case to start from a known state.
 *
 * @returns {void}
 */
export function clearCertificateCache() {
    cachedCertificates = null;
    cacheStamp = null;
}
