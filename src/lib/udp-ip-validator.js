import dns from 'dns';
import { promisify } from 'util';

const resolve4 = promisify(dns.resolve4);

/**
 * Validate IPv4 address format.
 *
 * @param {string} ip - The string to validate as an IPv4 address
 * @returns {boolean} True if the string is a valid IPv4 address, false otherwise
 */
export function isIPv4(ip) {
    const parts = ip.split('.');
    if (parts.length !== 4) return false;
    return parts.every((part) => {
        if (!/^\d+$/.test(part)) return false;
        const num = parseInt(part, 10);
        return num >= 0 && num <= 255;
    });
}

/**
 * Resolve a hostname to its IPv4 addresses.
 *
 * @param {string} hostname - The hostname to resolve
 * @returns {Promise<string[]>} Array of resolved IPv4 addresses, or empty array on failure
 */
async function resolveHostname(hostname) {
    try {
        const addresses = await resolve4(hostname);
        return addresses;
    } catch {
        return [];
    }
}

/**
 * Parse and resolve allowed sources from config.
 *
 * Each entry may be a literal IPv4 address or a hostname that will be resolved
 * via DNS. Hostname lookups run in parallel. Any entry that cannot be resolved
 * is reported as an error; successfully resolved entries remain active.
 *
 * @param {string[]} sources - Array of IPv4 addresses or hostnames
 * @returns {Promise<{ allowedIPs: string[], errors: string[] }>} Resolved IPs and any error messages
 */
export async function parseAllowedSources(sources) {
    const results = await Promise.all(
        sources.map(async (source) => {
            if (isIPv4(source)) {
                return { ips: [source], error: null };
            }
            // Treat as hostname, try to resolve
            const resolved = await resolveHostname(source);
            if (resolved.length > 0) {
                return { ips: resolved, error: null };
            }
            return { ips: [], error: `Cannot resolve hostname or invalid IPv4: "${source}"` };
        })
    );

    const allowedIPs = [];
    const errors = [];
    for (const { ips, error } of results) {
        if (error) {
            errors.push(error);
        } else {
            allowedIPs.push(...ips);
        }
    }

    return { allowedIPs, errors };
}

/**
 * Check if an IP address is allowed to send messages.
 *
 * The semantics depend on whether source validation is active:
 * - When `validationEnabled` is false, all IPs are allowed (no restriction).
 * - When `validationEnabled` is true and `allowedIPs` is non-empty, only listed IPs are allowed.
 * - When `validationEnabled` is true and `allowedIPs` is empty/null, **no** IP is allowed
 *   (deny-all when validation is on but the list is empty).
 *
 * @param {string} ip - The IP address to check
 * @param {string[]} allowedIPs - Array of allowed IP addresses
 * @param {boolean} [validationEnabled] - Whether source validation is active
 * @returns {boolean} True if the IP is allowed, false otherwise
 */
export function isIpAllowed(ip, allowedIPs, validationEnabled = false) {
    if (!validationEnabled) {
        return true; // Validation disabled — allow all
    }

    if (!allowedIPs || allowedIPs.length === 0) {
        return false; // Validation enabled but no IPs configured — deny all
    }

    return allowedIPs.includes(ip);
}
