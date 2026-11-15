import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findLocalSense, hostFromCfg } from '../src/local.js';

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

test('Host.cfg: base64, with a BOM, as UTF-16, or in plain text', () => {
    const b64 = Buffer.from('qs-1.corp.example').toString('base64');
    assert.equal(hostFromCfg(Buffer.from(`${b64}\r\n`)), 'qs-1.corp.example');
    assert.equal(hostFromCfg(Buffer.from(`\uFEFF${b64}`)), 'qs-1.corp.example');
    assert.equal(
        hostFromCfg(Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(b64, 'utf16le')])),
        'qs-1.corp.example'
    );
    assert.equal(hostFromCfg(Buffer.from('qs-1.corp.example\n')), 'qs-1.corp.example');
    assert.equal(hostFromCfg(Buffer.from('')), null);
});

test('relative certificate paths in a config file are relative to that file', async () => {
    const fs = await import('node:fs');
    const os = await import('node:os');
    const path = await import('node:path');
    const { loadConfig } = await import('../src/config.js');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sm-cfg-'));
    try {
        fs.mkdirSync(path.join(dir, 'certs'));
        for (const f of ['client.pem', 'client_key.pem', 'root.pem'])
            fs.writeFileSync(path.join(dir, 'certs', f), 'pem');
        const file = path.join(dir, 'config.yaml');
        fs.writeFileSync(file, 'sense:\n  host: qs-1.corp.example\n  certDir: certs\n');
        const c = loadConfig(file);
        assert.equal(c.sense.keyFile, path.join(dir, 'certs', 'client_key.pem'));
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
