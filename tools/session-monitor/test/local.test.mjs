import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findLocalSense } from '../src/local.js';

const base = 'D:\\Data\\Qlik\\Sense';
const certDir = `${base}\\Repository\\Exported Certificates\\.Local Certificates`;
const env = { ProgramData: 'D:\\Data' };

/** A fake file system holding `files` (path -> contents), with `locked` files unreadable. */
function fakeFs(files, locked = []) {
    const err = (code) => Object.assign(new Error(code), { code });
    const check = (f) => {
        if (locked.includes(f)) throw err('EACCES');
        if (!(f in files)) throw err('ENOENT');
    };
    return {
        readFileSync: (f) => (check(f), files[f]),
        accessSync: check,
        openSync: (f) => (check(f), 3),
        closeSync: () => {},
    };
}
const hostCfg = { [`${base}\\Host.cfg`]: Buffer.from('qs-1.corp.example\n').toString('base64') };
const certs = Object.fromEntries(
    ['client.pem', 'client_key.pem', 'root.pem'].map((f) => [`${certDir}\\${f}`, 'pem'])
);

test('not Windows: no local Sense', () => {
    assert.equal(findLocalSense({ platform: 'darwin', env, fsImpl: fakeFs({ ...hostCfg }) }), null);
});

test('Windows without Sense: null', () => {
    assert.equal(findLocalSense({ platform: 'win32', env, fsImpl: fakeFs({}) }), null);
});

test('a Sense server: host from Host.cfg, the exported certificates', () => {
    const r = findLocalSense({ platform: 'win32', env, fsImpl: fakeFs({ ...hostCfg, ...certs }) });
    assert.deepEqual(r, { host: 'qs-1.corp.example', certDir, missing: [], unreadable: [] });
});

test('a key it may not read is reported, not thrown', () => {
    const key = `${certDir}\\client_key.pem`;
    const r = findLocalSense({
        platform: 'win32',
        env,
        fsImpl: fakeFs({ ...hostCfg, ...certs }, [key]),
    });
    assert.deepEqual(r.unreadable, ['client_key.pem']);
    assert.deepEqual(r.missing, []);
});

test('missing certificates are listed', () => {
    const r = findLocalSense({ platform: 'win32', env, fsImpl: fakeFs({ ...hostCfg }) });
    assert.deepEqual(r.missing, ['client.pem', 'client_key.pem', 'root.pem']);
});

test('a Host.cfg that is not a host name is ignored', () => {
    const bad = { [`${base}\\Host.cfg`]: Buffer.from('not a host; rm -rf').toString('base64') };
    assert.equal(findLocalSense({ platform: 'win32', env, fsImpl: fakeFs(bad) }), null);
});
