import dns from 'node:dns/promises';
import net from 'node:net';

export const hostnamePattern =
    /^(?=.{1,253}$)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)(?:\.(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?))*$/u;

/**
 * Tests whether a value is a syntactically valid hostname.
 *
 * @param {string} value - Value to validate
 * @returns {boolean} True if the value is a valid hostname
 */
export function isValidHostname(value) {
    return typeof value === 'string' && hostnamePattern.test(value.trim());
}

/**
 * Tests whether a host string is an IPv4 literal or resolves to an IPv4 address.
 * Optionally verifies that a TCP port on the resolved IPv4 address is reachable.
 *
 * @param {string} host - IPv4 address or hostname to validate
 * @param {boolean} [verifyTcpReachability] - When true, verify the resolved IPv4/port using TCP
 * @param {number|null} [port] - TCP port to verify when verifyTcpReachability is true
 * @param {number} [timeoutMs] - Timeout used for TCP reachability checks
 * @returns {Promise<boolean>} True if the host resolves to an IPv4 address and optional TCP check succeeds
 */
export async function resolvesToIpAddress(
    host,
    verifyTcpReachability = false,
    port = null,
    timeoutMs = 5000
) {
    if (typeof host !== 'string') {
        return false;
    }

    const trimmedHost = host.trim();

    if (trimmedHost.length === 0) {
        return false;
    }

    let resolvedAddress = trimmedHost;
    const ipVersion = net.isIP(trimmedHost);

    if (ipVersion === 0) {
        if (!isValidHostname(trimmedHost)) {
            return false;
        }

        try {
            const lookupResult = await dns.lookup(trimmedHost, { family: 4 });
            resolvedAddress = lookupResult.address;
        } catch (err) {
            return false;
        }
    } else if (ipVersion !== 4) {
        return false;
    }

    if (net.isIP(resolvedAddress) !== 4) {
        return false;
    }

    if (verifyTcpReachability === false) {
        return true;
    }

    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new TypeError(
            'A valid TCP port must be provided when verifyTcpReachability is enabled.'
        );
    }

    return new Promise((resolve) => {
        const socket = net.createConnection({
            host: resolvedAddress,
            port,
        });

        /**
         * Removes listeners and closes the TCP socket.
         *
         * @returns {void}
         */
        const cleanup = () => {
            socket.removeAllListeners();
            socket.destroy();
        };

        socket.setTimeout(timeoutMs);

        socket.once('connect', () => {
            cleanup();
            resolve(true);
        });

        socket.once('timeout', () => {
            cleanup();
            resolve(false);
        });

        socket.once('error', () => {
            cleanup();
            resolve(false);
        });
    });
}

/**
 * Verifies a host resolves to IPv4 and optionally checks TCP reachability in a single pass.
 * Performs DNS lookup once and reuses the resolved IP for TCP verification.
 *
 * @param {string} host - IPv4 address or hostname to validate
 * @param {number|null} [port] - TCP port to verify (null skips TCP check)
 * @param {number} [timeoutMs] - Timeout for TCP reachability check
 * @returns {Promise<{resolvesToIp: boolean, tcpReachable: boolean | null}>}
 */
export async function verifyHost(host, port = null, timeoutMs = 5000) {
    if (typeof host !== 'string') {
        return { resolvesToIp: false, tcpReachable: null };
    }

    const trimmedHost = host.trim();

    if (trimmedHost.length === 0) {
        return { resolvesToIp: false, tcpReachable: null };
    }

    let resolvedAddress = trimmedHost;
    const ipVersion = net.isIP(trimmedHost);

    if (ipVersion === 0) {
        if (!isValidHostname(trimmedHost)) {
            return { resolvesToIp: false, tcpReachable: null };
        }

        try {
            const lookupResult = await dns.lookup(trimmedHost, { family: 4 });
            resolvedAddress = lookupResult.address;
        } catch (err) {
            return { resolvesToIp: false, tcpReachable: null };
        }
    } else if (ipVersion !== 4) {
        return { resolvesToIp: false, tcpReachable: null };
    }

    if (net.isIP(resolvedAddress) !== 4) {
        return { resolvesToIp: false, tcpReachable: null };
    }

    if (port === null) {
        return { resolvesToIp: true, tcpReachable: null };
    }

    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new TypeError(
            'A valid port must be provided when TCP reachability check is requested.'
        );
    }

    const tcpReachable = await new Promise((resolve) => {
        const socket = net.createConnection({
            host: resolvedAddress,
            port,
        });

        /**
         * Removes listeners and closes the TCP socket.
         *
         * @returns {void}
         */
        const cleanup = () => {
            socket.removeAllListeners();
            socket.destroy();
        };

        socket.setTimeout(timeoutMs);

        socket.once('connect', () => {
            cleanup();
            resolve(true);
        });

        socket.once('timeout', () => {
            cleanup();
            resolve(false);
        });

        socket.once('error', () => {
            cleanup();
            resolve(false);
        });
    });

    return { resolvesToIp: true, tcpReachable };
}
