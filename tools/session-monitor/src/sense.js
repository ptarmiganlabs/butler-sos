import fs from 'node:fs';
import https from 'node:https';
import crypto from 'node:crypto';

/**
 * Minimal client for the Qlik Sense Repository (QRS) and Proxy (QPS) APIs using client certificates.
 * Read-only use: the monitor only ever sends GET requests.
 */
export class SenseClient {
    /**
     * @param {object} senseCfg The `sense` section of the configuration.
     * @param {number} timeoutSeconds Per-request timeout.
     */
    constructor(senseCfg, timeoutSeconds) {
        this.cfg = senseCfg;
        this.timeoutMs = timeoutSeconds * 1000;
        this.agent = new https.Agent({
            cert: fs.readFileSync(senseCfg.certFile),
            key: fs.readFileSync(senseCfg.keyFile),
            ca: fs.readFileSync(senseCfg.caFile),
            rejectUnauthorized: true,
            keepAlive: true,
            maxSockets: 4,
        });
        // Xrfkey: 16 alphanumeric characters, sent as both query parameter and header.
        this.xrf = crypto
            .randomBytes(12)
            .toString('base64')
            .replace(/[^A-Za-z0-9]/g, 'x')
            .slice(0, 16);
        this.clockOffsetMs = 0;
        const u = senseCfg.apiUser;
        this.userHeader = `UserDirectory=${u.userDirectory}; UserId=${u.userId}`;
    }

    /**
     * GET a JSON resource.
     *
     * @param {string} host Host name.
     * @param {number} port Port (4242 QRS, 4243 QPS).
     * @param {string} path Path including any query string, without the xrfkey.
     * @returns {Promise<any>} Parsed JSON body.
     */
    get(host, port, path) {
        const sep = path.includes('?') ? '&' : '?';
        const fullPath = `${encodeURI(path).replace(/'/g, '%27')}${sep}xrfkey=${this.xrf}`;
        return new Promise((resolve, reject) => {
            const req = https.request(
                {
                    host,
                    port,
                    path: fullPath,
                    method: 'GET',
                    agent: this.agent,
                    timeout: this.timeoutMs,
                    headers: {
                        'X-Qlik-Xrfkey': this.xrf,
                        'X-Qlik-User': this.userHeader,
                        Accept: 'application/json',
                    },
                },
                (res) => {
                    // Usage record times come from the Sense server's clock: track its offset from
                    // ours (HTTP Date header, one-second resolution) so the window is measured on its clock.
                    const serverDate = Date.parse(res.headers.date || '');
                    if (Number.isFinite(serverDate)) this.clockOffsetMs = serverDate - Date.now();
                    const chunks = [];
                    res.on('data', (c) => chunks.push(c));
                    res.on('end', () => {
                        const text = Buffer.concat(chunks).toString('utf8');
                        if (res.statusCode < 200 || res.statusCode > 299) {
                            reject(
                                new Error(
                                    `GET https://${host}:${port}${path} -> ${res.statusCode} ${text.slice(0, 200)}`
                                )
                            );
                            return;
                        }
                        try {
                            resolve(text ? JSON.parse(text) : null);
                        } catch (err) {
                            reject(new Error(`GET ${path}: invalid JSON (${err.message})`));
                        }
                    });
                }
            );
            req.on('timeout', () =>
                req.destroy(new Error(`GET https://${host}:${port}${path} timed out`))
            );
            req.on('error', reject);
            req.end();
        });
    }

    /** @param {string} path QRS path after /qrs. @returns {Promise<any>} JSON. */
    qrs(path) {
        return this.get(this.cfg.repositoryHost, this.cfg.repositoryPort, `/qrs${path}`);
    }

    /**
     * @param {string} host Proxy node host.
     * @param {number} port Proxy REST port.
     * @param {string} path QPS path after /qps.
     * @returns {Promise<any>} JSON.
     */
    qps(host, port, path) {
        return this.get(host, port, `/qps${path}`);
    }

    close() {
        this.agent.destroy();
    }
}

/**
 * Turns a connection error into advice a Sense administrator can act on.
 *
 * @param {Error & {code?: string}} err The error.
 * @param {object} senseCfg The `sense` section of the configuration.
 * @returns {string} The error, with a hint when the cause is a common one.
 */
export function explain(err, senseCfg) {
    const host = senseCfg.repositoryHost;
    const msg = String(err?.message || err);
    const code = err?.code || '';
    if (['ENOTFOUND', 'EAI_AGAIN'].includes(code))
        return `${msg}\n    The name ${host} can't be resolved from this computer. Use the server's full DNS name.`;
    if (
        ['ECONNREFUSED', 'ETIMEDOUT', 'EHOSTUNREACH', 'ENETUNREACH'].includes(code) ||
        /timed out/.test(msg)
    )
        return `${msg}\n    Can't reach ${host} on ports 4242 (repository) and 4243 (proxy). Check the firewall between this computer and the Sense server(s).`;
    if (code === 'ERR_TLS_CERT_ALTNAME_INVALID')
        return `${msg}\n    sense.host must be the name the Sense certificates were made for: the name of the central node, as shown in the QMC under Nodes.`;
    if (/self.signed|unable to verify|UNABLE_TO_|certificate/i.test(msg + code))
        return `${msg}\n    Use root.pem from the same QMC certificate export as client.pem and client_key.pem.`;
    if (/-> 403/.test(msg))
        return `${msg}\n    Sense refused the client certificate. Export the certificates again from this site's QMC; certificates from another site don't work.`;
    return msg;
}
