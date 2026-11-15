import fs from 'node:fs';
import path from 'node:path';

/** The certificate files the monitor needs, as Sense exports them. */
export const CERT_FILES = ['client.pem', 'client_key.pem', 'root.pem'];

/**
 * Finds Qlik Sense on the machine the monitor runs on, so that running it on a Sense server needs
 * no configuration at all. Sense keeps its host name base64-encoded in %ProgramData%\Qlik\Sense\Host.cfg,
 * and the Repository exports its certificates as PEM files to
 * %ProgramData%\Qlik\Sense\Repository\Exported Certificates\.Local Certificates.
 *
 * @param {object} [opts] For tests.
 * @param {string} [opts.platform] Defaults to process.platform.
 * @param {object} [opts.env] Defaults to process.env.
 * @param {object} [opts.fsImpl] Defaults to node:fs.
 * @returns {null | {host: string, certDir: string, missing: string[], unreadable: string[]}}
 *     Null when this is not a Sense server. Otherwise the host name, the certificate folder, and
 *     which certificate files are missing or can't be read (reading the key needs admin rights).
 */
export function findLocalSense({
    platform = process.platform,
    env = process.env,
    fsImpl = fs,
} = {}) {
    if (platform !== 'win32') return null;
    const base = path.win32.join(env.ProgramData || 'C:\\ProgramData', 'Qlik', 'Sense');
    let host;
    try {
        const raw = fsImpl.readFileSync(path.win32.join(base, 'Host.cfg'), 'utf8').trim();
        host = Buffer.from(raw, 'base64').toString('utf8').trim();
    } catch {
        return null;
    }
    // A Host.cfg that doesn't decode to a host name is not one this can use.
    if (!/^[A-Za-z0-9.-]+$/.test(host)) return null;
    const certDir = path.win32.join(
        base,
        'Repository',
        'Exported Certificates',
        '.Local Certificates'
    );
    const missing = [];
    const unreadable = [];
    for (const f of CERT_FILES) {
        const file = path.win32.join(certDir, f);
        try {
            fsImpl.accessSync(file, fs.constants.R_OK);
            fsImpl.closeSync(fsImpl.openSync(file, 'r'));
        } catch (err) {
            (err.code === 'ENOENT' ? missing : unreadable).push(f);
        }
    }
    return { host, certDir, missing, unreadable };
}
