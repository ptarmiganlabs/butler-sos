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
    let raw;
    try {
        raw = fsImpl.readFileSync(path.win32.join(base, 'Host.cfg'));
    } catch {
        return null;
    }
    const host = hostFromCfg(raw);
    if (!host) return null;
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

const HOST = /^[A-Za-z0-9.-]+$/;

/**
 * Reads the host name out of Host.cfg's contents. Sense writes it base64-encoded; this also copes
 * with a byte-order mark, UTF-16, surrounding white space, and a plain-text host name.
 *
 * @param {Buffer | string} raw The file's contents.
 * @returns {string | null} The host name, or null if there is none to be found.
 */
export function hostFromCfg(raw) {
    const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(String(raw), 'utf8');
    const utf16 = buf.length > 1 && (buf.includes(0) || (buf[0] === 0xff && buf[1] === 0xfe));
    const text = buf
        .toString(utf16 ? 'utf16le' : 'utf8')
        .replace(/^\uFEFF/, '')
        .replace(/\0/g, '')
        .trim();
    const decoded = Buffer.from(text, 'base64').toString('utf8').replace(/\0/g, '').trim();
    if (HOST.test(decoded) && /^[A-Za-z0-9+/=]+$/.test(text)) return decoded;
    return HOST.test(text) && text.includes('.') ? text : null;
}
