// Reads lab.config.yaml (next to the experiments) and guards the test users.
import fs from 'node:fs';
import { load } from 'js-yaml';

const file = new URL('../lab.config.yaml', import.meta.url);
if (!fs.existsSync(file)) {
    console.error(
        'No lab.config.yaml: copy lab.config.example.yaml to lab.config.yaml and fill it in.'
    );
    process.exit(1);
}
export const cfg = load(fs.readFileSync(file, 'utf8'));
for (const k of [
    'sense.host',
    'sense.certDir',
    'sense.entryHost',
    'headerProxy.prefix',
    'headerProxy.header',
    'headerProxy.userDirectory',
    'testUsers.pattern',
]) {
    if (!k.split('.').reduce((o, p) => o?.[p], cfg)) {
        console.error(`lab.config.yaml: ${k} is missing.`);
        process.exit(1);
    }
}
const testUser = new RegExp(cfg.testUsers.pattern);

/** Stops the experiment unless `user` is a test user. Every experiment calls this first. */
export function assertTestUser(user) {
    if (!user || !testUser.test(user)) {
        console.error(
            `Refusing: "${user}" is not a test user (testUsers.pattern is ${cfg.testUsers.pattern}).`
        );
        process.exit(1);
    }
    return user;
}

export const ts = () => new Date().toISOString();
/** Session ids are valid session cookies: print only their first characters. */
export const short = (id) => (id ? `${String(id).slice(0, 4)}…` : id);
export const pause = (ms) => new Promise((r) => setTimeout(r, ms));
