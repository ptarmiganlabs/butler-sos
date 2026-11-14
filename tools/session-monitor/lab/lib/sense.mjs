// Repository (QRS, 4242) and Proxy (QPS, 4243) API calls with the site's client certificates.
// The certificates are read where they are and never printed.
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { cfg } from './config.mjs';

const agent = new https.Agent({
    cert: fs.readFileSync(path.join(cfg.sense.certDir, 'client.pem')),
    key: fs.readFileSync(path.join(cfg.sense.certDir, 'client_key.pem')),
    ca: fs.readFileSync(path.join(cfg.sense.certDir, 'root.pem')),
    rejectUnauthorized: true,
});
const XRF = crypto
    .randomBytes(12)
    .toString('base64')
    .replace(/[^A-Za-z0-9]/g, 'x')
    .slice(0, 16);

function call(port, method, urlPath, { body } = {}) {
    return new Promise((resolve, reject) => {
        const sep = urlPath.includes('?') ? '&' : '?';
        const req = https.request(
            {
                host: cfg.sense.host,
                port,
                method,
                path: `${encodeURI(urlPath).replace(/'/g, '%27')}${sep}xrfkey=${XRF}`,
                agent,
                timeout: 15000,
                headers: {
                    'X-Qlik-Xrfkey': XRF,
                    'X-Qlik-User': 'UserDirectory=INTERNAL; UserId=sa_api',
                    'Content-Type': 'application/json',
                },
            },
            (res) => {
                let data = '';
                res.on('data', (c) => (data += c));
                res.on('error', reject);
                res.on('end', () => {
                    let json = data;
                    try {
                        json = data ? JSON.parse(data) : null;
                    } catch {
                        /* not JSON */
                    }
                    resolve({ status: res.statusCode, body: json });
                });
            }
        );
        req.on('timeout', () => req.destroy(new Error(`${method} ${urlPath} timed out`)));
        req.on('error', reject);
        if (body !== undefined) req.write(JSON.stringify(body));
        req.end();
    });
}

export const qrs = (method, p, opts) => call(4242, method, `/qrs${p}`, opts);
export const qps = (method, p, opts) => call(4243, method, `/qps${p}`, opts);
