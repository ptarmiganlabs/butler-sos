import net from 'node:net';

import { describe, test, expect, jest } from '@jest/globals';

jest.unstable_mockModule('../../globals.js', () => ({
    default: {
        logger: {
            warn: jest.fn(),
        },
    },
}));

const { resolvesToIpAddress, verifyHost } = await import('../host-utils.js');

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

        try {
            const address = server.address();
            const port = typeof address === 'object' && address !== null ? address.port : null;

            await expect(resolvesToIpAddress('127.0.0.1', true, port)).resolves.toBe(true);
        } finally {
            await new Promise((resolve, reject) => {
                server.close((err) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    resolve();
                });
            });
        }
    });
});

describe('verifyHost', () => {
    test('returns resolvesToIp true and tcpReachable null when no port provided', async () => {
        const result = await verifyHost('127.0.0.1');
        expect(result).toEqual({ resolvesToIp: true, tcpReachable: null });
    });

    test('returns resolvesToIp false for invalid host', async () => {
        const result = await verifyHost('invalid host name');
        expect(result).toEqual({ resolvesToIp: false, tcpReachable: null });
    });

    test('returns resolvesToIp false for IPv6 addresses', async () => {
        const result = await verifyHost('::1');
        expect(result).toEqual({ resolvesToIp: false, tcpReachable: null });
    });

    test('throws TypeError for invalid port when port is provided', async () => {
        await expect(verifyHost('127.0.0.1', 0)).rejects.toThrow(
            'A valid port must be provided when TCP reachability check is requested.'
        );
    });

    test('returns tcpReachable true when port is reachable', async () => {
        const server = net.createServer();

        await new Promise((resolve) => {
            server.listen(0, '127.0.0.1', resolve);
        });

        try {
            const address = server.address();
            const port = typeof address === 'object' && address !== null ? address.port : null;

            const result = await verifyHost('127.0.0.1', port);
            expect(result).toEqual({ resolvesToIp: true, tcpReachable: true });
        } finally {
            await new Promise((resolve, reject) => {
                server.close((err) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    resolve();
                });
            });
        }
    });

    test('returns tcpReachable false when port is unreachable', async () => {
        const result = await verifyHost('127.0.0.1', 1);
        expect(result).toEqual({ resolvesToIp: true, tcpReachable: false });
    });
});
