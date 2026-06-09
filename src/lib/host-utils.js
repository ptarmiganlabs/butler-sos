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
 * Tests whether a host string is an IP literal or resolves to an IP address.
 * Optionally verifies that a TCP port on the resolved IP address is reachable.
 *
 * @param {string} host - IP address or hostname to validate
 * @param {boolean} [verifyTcpReachability] - When true, verify the resolved IP/port using TCP
 * @param {number|null} [port] - TCP port to verify when verifyTcpReachability is true
 * @param {number} [timeoutMs] - Timeout used for TCP reachability checks
 * @returns {Promise<boolean>} True if the host resolves to an IP address and optional TCP check succeeds
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

    if (net.isIP(trimmedHost) === 0) {
        if (!isValidHostname(trimmedHost)) {
            return false;
        }

        try {
            const lookupResult = await dns.lookup(trimmedHost);
            resolvedAddress = lookupResult.address;
        } catch (err) {
            return false;
        }
    }

    if (net.isIP(resolvedAddress) === 0) {
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
