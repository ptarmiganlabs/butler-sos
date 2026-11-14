/**
 * Console output: one line per event, and optionally a per-user table every poll.
 *
 * @param {object} cfg The `outputs.console` section.
 * @returns {{name: string, handle: Function, close: Function}} Output.
 */
export function consoleOutput(cfg) {
    const user = (e) => `${e.userDirectory}\\${e.userId}`;
    const line = (e) => {
        switch (e.type) {
            case 'alert':
                return `${e.level.toUpperCase().padEnd(8)} ${e.change.padEnd(9)} ${user(e)}: ${e.slotsUsed}/${e.slotsLimit} licence slots used in the window, ${e.proxySessions} proxy sessions${e.nextSlotFreeAt ? `, next slot free ${e.nextSlotFreeAt}` : ''}`;
            case 'refused':
                return `REFUSED  session   ${user(e)}: new session ${e.sessionId} on ${e.proxyHost} /${e.virtualProxy === '/' ? '' : e.virtualProxy} got no licence (first seen ${e.firstSeen})`;
            case 'licensed':
                return `INFO     signed in ${user(e)}: new session on /${e.virtualProxy === '/' ? '' : e.virtualProxy} took licence slot ${e.slotsUsed} of ${e.slotsLimit}`;
            case 'session-ended':
                return `INFO     ended     ${user(e)}: ${e.refused ? 'refused ' : ''}session ${e.sessionId} closed`;
            case 'sweep':
                return `INFO     sweep     the Repository removed ${e.recordsRemoved} licence usage records`;
            default:
                return JSON.stringify(e);
        }
    };
    return {
        name: 'console',
        handle(result) {
            for (const e of result.events) {
                // Sign-ins and ended sessions are many on a busy site: printed only with table: true.
                if (!cfg.table && (e.type === 'licensed' || e.type === 'session-ended')) continue;
                console.log(`${e.at} ${line(e)}`);
            }
            for (const err of result.summary.errors) console.error(`${result.at} ERROR    ${err}`);
            if (!cfg.table) return;
            const active = result.users.filter((u) => !u.gone && (u.slotsUsed || u.proxySessions));
            console.log(
                `${result.at} ${result.summary.proxySessions} proxy sessions, ${result.summary.usersWithSessions} users, ${result.summary.usersWarn} warn, ${result.summary.usersCritical} critical`
            );
            for (const u of active) {
                const vps = Object.entries(u.byVirtualProxy)
                    .map(([vp, n]) => `${vp}:${n}`)
                    .join(' ');
                console.log(
                    `    ${`${u.userDirectory}\\${u.userId}`.padEnd(32)} slots ${u.slotsUsed}/${u.slotsLimit} ${u.level.padEnd(8)} sessions ${String(u.proxySessions).padStart(3)} [${vps}]${u.nextSlotFreeInSeconds != null ? ` next free in ${u.nextSlotFreeInSeconds}s` : ''}`
                );
            }
        },
        close() {},
    };
}
