import net from 'node:net';

import { describe, test, expect } from '@jest/globals';

import { resolvesToIpAddress } from '../host-utils.js';

describe('host-utils', () => {
    test('accepts literal IPv4 addresses', async () => {
        await expect(resolvesToIpAddress('127.0.0.1')).resolves.toBe(true);
    });

    test('rejects literal IPv6 addresses', async () => {
        await expect(resolvesToIpAddress('::1')).resolves.toBe(false);
    });

    test('rejects invalid host names', async () => {
        await expect(resolvesToIpAddress('invalid host name')).resolves.toBe(false);
    });

    test('requires a port when TCP reachability is enabled', async () => {
        await expect(resolvesToIpAddress('127.0.0.1', true)).rejects.toThrow(
            'A valid TCP port must be provided when verifyTcpReachability is enabled.'
        );
    });

    test('can verify TCP reachability for a resolved IP address', async () => {
        const server = net.createServer();

        await new Promise((resolve) => {
            server.listen(0, '127.0.0.1', resolve);
        });

        const address = server.address();
        const port = typeof address === 'object' && address !== null ? address.port : null;

        await expect(resolvesToIpAddress('127.0.0.1', true, port)).resolves.toBe(true);

        await new Promise((resolve, reject) => {
            server.close((err) => {
                if (err) {
                    reject(err);
                    return;
                }

                resolve();
            });
        });
    });
});
