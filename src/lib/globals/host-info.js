import os from 'os';
import crypto from 'crypto';
import si from 'systeminformation';

/**
 * Gathers and returns information about the host system where Butler SOS is running.
 *
 * @param {object} settings - The settings object
 * @returns {object | null} Object containing host information or null if an error occurs
 */
export async function initHostInfo(settings) {
    try {
        // Check if detailed system info gathering is enabled
        const enableSystemInfo = settings.config.get('Butler-SOS.systemInfo.enable');

        let siCPU = {};
        let siSystem = {};
        let siMem = {};
        let siOS = {};
        let siDocker = {};
        let siNetwork = [];
        let siNetworkDefault = '';

        // Only gather detailed system info if enabled in config
        if (enableSystemInfo) {
            siCPU = await si.cpu();
            siSystem = await si.system();
            siMem = await si.mem();
            siOS = await si.osInfo();
            siDocker = await si.dockerInfo();
            siNetwork = await si.networkInterfaces();
            siNetworkDefault = await si.networkInterfaceDefault();
        } else {
            // If detailed system info is disabled, use minimal fallback values
            settings.logger.info(
                'SYSTEM INFO: Detailed system information gathering is disabled. Using minimal system info.'
            );
            siSystem = { uuid: 'disabled' };
            siMem = { total: 0 };
            siOS = {
                platform: os.platform(),
                arch: os.arch(),
                release: 'unknown',
                distro: 'unknown',
                codename: 'unknown',
            };
            siCPU = {
                processors: 1,
                physicalCores: 1,
                cores: 1,
                hypervizor: 'unknown',
            };
            siNetwork = [
                {
                    iface: 'default',
                    mac: '00:00:00:00:00:00',
                    ip4: '127.0.0.1',
                },
            ];
            siNetworkDefault = 'default';
        }

        const defaultNetworkInterface = siNetworkDefault;

        const networkInterface = siNetwork.filter((item) => item.iface === defaultNetworkInterface);

        // Ensure we have at least one network interface for ID generation
        const netIface =
            networkInterface.length > 0
                ? networkInterface[0]
                : siNetwork[0] || {
                      mac: '00:00:00:00:00:00',
                      ip4: '127.0.0.1',
                  };

        const idSrc = netIface.mac + netIface.ip4 + siSystem.uuid;
        const salt = netIface.mac;
        const hash = crypto.createHmac('sha256', salt);
        hash.update(idSrc);

        // Get first 50 characters of hash
        const id = hash.digest('hex');

        const hostInfo = {
            id,
            isRunningInDocker: settings.isRunningInDocker(),
            node: {
                nodeVersion: process.version,
                versions: process.versions,
            },
            os: {
                platform: os.platform(),
                release: os.release(),
                version: os.version(),
                arch: os.arch(),
                cpuCores: os.cpus().length,
                type: os.type(),
                totalmem: os.totalmem(),
            },
            si: {
                cpu: siCPU,
                system: siSystem,
                memory: {
                    total: siMem.total,
                },
                os: siOS,
                network: siNetwork,
                networkDefault: siNetworkDefault,
                docker: siDocker,
            },
        };

        return hostInfo;
    } catch (err) {
        settings.logger.error(`CONFIG: Getting host info: ${settings.getErrorMessage(err)}`);
        return null;
    }
}
