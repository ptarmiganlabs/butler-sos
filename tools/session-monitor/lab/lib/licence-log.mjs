// Follows Sense's licence trace log (if lab.config.yaml names it) and returns new lines for one user.
import fs from 'node:fs';
import { cfg } from './config.mjs';

export function licenceLogFollower(userId) {
    const file = cfg.licenceLog;
    let size = file && fs.existsSync(file) ? fs.statSync(file).size : 0;
    return () => {
        if (!file || !fs.existsSync(file)) return [];
        const now = fs.statSync(file).size;
        if (now < size) size = 0; // the log rolled over
        if (now === size) return [];
        const buf = Buffer.alloc(now - size);
        const fd = fs.openSync(file, 'r');
        fs.readSync(fd, buf, 0, buf.length, size);
        fs.closeSync(fd);
        size = now;
        return buf
            .toString('utf8')
            .split('\n')
            .filter((l) => l.includes(`\\${userId}`))
            .map((l) => {
                const f = l.split('\t');
                return `${f[1]} ${f[12]} ${String(f[8]).slice(0, 100)}`; // timestamp, operation, message
            });
    };
}
