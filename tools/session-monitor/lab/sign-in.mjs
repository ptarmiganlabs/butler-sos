// For the person-in-a-browser experiment: opens the hub as a test user in a new private Chrome window,
// using a one-minute ticket on the ticket proxy. Start watch-user.mjs for the same user first.
//   node lab/sign-in.mjs <testuser>
import { spawn } from 'node:child_process';
import { cfg, assertTestUser, ts } from './lib/config.mjs';
import { ticketFor } from './lib/proxy.mjs';

const user = assertTestUser(process.argv[2]);
const url = `https://${cfg.sense.entryHost}/${cfg.ticketProxy.prefix}/hub/?qlikTicket=${encodeURIComponent(await ticketFor(user))}`;
spawn(cfg.chrome, ['--incognito', '--new-window', url], {
    detached: true,
    stdio: 'ignore',
}).unref();
console.log(
    ts(),
    `opened a private Chrome window as ${cfg.headerProxy.userDirectory}\\${user} (the ticket is valid for one minute)`
);
