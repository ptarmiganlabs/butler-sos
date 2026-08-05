import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import pngjs from 'pngjs';
import crypto from 'crypto';

const { PNG } = pngjs;

/**
 * Byte-identity oracle for the PNG crop/composite path.
 *
 * The intermediate encodes in `cropPngBuffer`'s composite branches were made lazy: each branch
 * used to encode its composite immediately, and the result was thrown away whenever execution
 * carried on to the final crop. The change is meant to be invisible — the same input must
 * produce the same output bytes, only with less time spent blocking the event loop.
 *
 * These hashes were captured from the pre-change implementation and are the whole point of
 * the file — a dimensions-only assertion would not notice a changed filter strategy, a
 * different compression level, or a composite built from the wrong source.
 *
 * IF THESE HASHES FAIL WITHOUT A SOURCE CHANGE, suspect the toolchain before the code — and
 * suspect Node before pngjs. `PNG.sync.write` compresses through `zlib.deflateSync`, so the
 * bytes are a function of the zlib build shipped inside Node, not of pngjs alone; pngjs only
 * picks the row filters. CI pins a Node major, so a runner-image refresh (or an eventual
 * zlib-ng switch) can change every re-encoded hash here at once, on a PR that touched nothing
 * related. `pngjs` is also a caret range, so a 7.x patch can do it too.
 *
 * Only the `fast-path` and `degenerate-no-composite` scenarios are near-immune: they hand back
 * the deflateLevel-0 source bytes unchanged. Everything else is deflate-level-9 output.
 *
 * So: confirm the change is the toolchain's and not ours before re-capturing — diff the pixels,
 * not the bytes — then re-capture deliberately in its own commit.
 */

const mockAxios = { request: jest.fn() };
const mockFsPromises = { mkdir: jest.fn(), writeFile: jest.fn() };
const mockGlobals = { config: { get: jest.fn() } };
const mockCertUtils = { createCertificateOptions: jest.fn(), getCertificates: jest.fn() };
const mockFsSync = { existsSync: jest.fn(), mkdirSync: jest.fn(), writeFileSync: jest.fn() };

jest.unstable_mockModule('axios', () => ({ default: mockAxios }));
jest.unstable_mockModule('node:fs/promises', () => ({
    default: mockFsPromises,
    mkdir: mockFsPromises.mkdir,
    writeFile: mockFsPromises.writeFile,
}));
jest.unstable_mockModule('../../globals.js', () => ({ default: mockGlobals }));
jest.unstable_mockModule('../cert-utils.js', () => ({
    createCertificateOptions: mockCertUtils.createCertificateOptions,
    getCertificates: mockCertUtils.getCertificates,
}));
// PNG.sync.write is spied in place rather than through a module mock: audit-screenshots.js
// imports the same pngjs instance, so patching the method here counts its calls while the real
// encoder still runs. Counting matters because byte identity is structurally blind to a
// discarded encode — the output is the same whether the wasted work happened or not.
const syncWriteSpy = jest.spyOn(PNG.sync, 'write');
// PNG.sync.read is spied for the same reason, and it is the only thing that can see the
// header fast path at all. Encode counts cannot: a run that fully decodes and then returns the
// caller's buffer from the first early return produces zero encodes and the identical hash, so
// deleting the whole fast path scored a clean pass on every other assertion in this file.
const syncReadSpy = jest.spyOn(PNG.sync, 'read');

jest.unstable_mockModule('node:fs', () => ({
    default: mockFsSync,
    existsSync: mockFsSync.existsSync,
    mkdirSync: mockFsSync.mkdirSync,
    writeFileSync: mockFsSync.writeFileSync,
}));

/**
 * Builds a deterministic, non-uniform test image.
 *
 * Non-uniform matters: a flat colour compresses to almost nothing and would hash identically
 * whether or not the crop actually moved the right pixels.
 *
 * @param {number} w - Width in pixels.
 * @param {number} h - Height in pixels.
 * @param {number} [gridLineY] - Row index to render as a uniform grey line, or -1 for none.
 * @param {'noise'|'red-constant'|'blue-varies'|'uniform-bright'|'uniform-similar'} [rowAbove]
 *   How to render the row directly above the grid line. Each mode reaches a different arm of
 *   the detector's "is the row above uniform?" decision.
 * @returns {Buffer} Encoded PNG.
 */
function makeSourcePng(w, h, gridLineY = -1, rowAbove = 'noise') {
    const png = new PNG({ width: w, height: h });
    const refX = Math.floor(w / 4);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            if (rowAbove !== 'noise' && y === gridLineY - 1) {
                // The row the detector inspects to decide whether a uniform row below it is a
                // real grid line. Each mode drives a different arm of that decision.
                if (rowAbove === 'red-constant') {
                    // A heat-mapped measure row: constant RED, varying green and blue. The
                    // scan used to compare red alone, so it called this uniform, fell through
                    // to the brightness fallback and rejected the grid line. The reference
                    // pixel it samples (x = width/4) is neutral grey so that fallback rejects.
                    png.data[i] = 200;
                    png.data[i + 1] = x === refX ? 200 : (x * 23) % 160;
                    png.data[i + 2] = x === refX ? 200 : (x * 31) % 160;
                } else if (rowAbove === 'blue-varies') {
                    // Constant red AND green, varying blue — so only the blue term of the
                    // three-channel comparison can see this row is not uniform.
                    png.data[i] = 200;
                    png.data[i + 1] = 200;
                    png.data[i + 2] = x === refX ? 200 : (x * 31) % 160;
                } else if (rowAbove === 'uniform-bright') {
                    // Genuinely uniform and much brighter than the grid line: a white data
                    // cell above a rule. Reaches the brightness fallback and is accepted.
                    png.data[i] = 255;
                    png.data[i + 1] = 255;
                    png.data[i + 2] = 255;
                } else if (rowAbove === 'uniform-similar') {
                    // Uniform but nearly the same brightness as the grid line: a border band
                    // rather than a data row. Reaches the fallback and is rejected.
                    png.data[i] = 203;
                    png.data[i + 1] = 203;
                    png.data[i + 2] = 203;
                }
            } else if (y === gridLineY) {
                // A uniform mid-grey row, which is what the overflow-composite detector
                // scans for: brightness inside its 160-245 window, constant across x, with
                // varied content in the row above. Without one the whole branch is skipped
                // and any test claiming to cover it silently exercises nothing.
                png.data[i] = 200;
                png.data[i + 1] = 200;
                png.data[i + 2] = 200;
            } else {
                png.data[i] = (x * 3 + y * 7) % 256;
                png.data[i + 1] = (x * 11 + y * 5) % 256;
                png.data[i + 2] = (x * 17 + y * 13) % 256;
            }
            png.data[i + 3] = 255;
        }
    }
    // deflateLevel 0 on purpose: pngjs's default (9) re-encode then produces DIFFERENT bytes,
    // which is what makes the lazy-encode cache observable. With a default-encoded source the
    // decode/re-encode round-trips byte-identically and a broken cache would pass unnoticed.
    return PNG.sync.write(png, { deflateLevel: 0 });
}

/**
 * SHA-256 of a buffer, for compact comparison.
 *
 * @param {Buffer} buf - Buffer to hash.
 * @returns {string} Hex digest.
 */
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

// Reassigned per download so each test asserts against its own run.
let warnSpy = jest.fn();

// Each scenario drives a different branch of cropPngBuffer. The `hash` values are the
// captured pre-change output; `bytes` guards against a same-hash-different-length
// impossibility being masked by a hashing mistake.
const SCENARIOS = [
    {
        id: 'fast-path',
        name: 'fast path — render already matches the crop (no decode at all)',
        w: 40,
        h: 40,
        crop: { top: 0, left: 0, width: 40, height: 40 },
        bytes: 6508,
        hash: '8090249b5446518ddcb5f4a64315ee8155f3a1fcff4b5008e4b7e3d9c98ecb26',
    },
    {
        id: 'standard-crop',
        name: 'standard crop — render larger than the crop rectangle',
        w: 60,
        h: 60,
        crop: { top: 5, left: 7, width: 30, height: 25 },
        bytes: 997,
        hash: '6dbc10c56528d055432763241b4c59a76a7c3ab180c92ae38c0d3a42bddd42e2',
    },
    {
        id: 'scroll-then-crop',
        name: 'scroll composite followed by a final crop',
        w: 50,
        h: 80,
        crop: { top: 0, left: 0, width: 40, height: 40, scrollTop: 20, scrollAreaOffsetY: 10 },
        bytes: 2007,
        hash: '4fd16d1d8090d52d7f475a34ec7ce502d22916b2a66a638188428664a1d9a58d',
    },
    {
        // compositeHeight = height - scrollTop = 50, which fits the crop, so the function
        // returns straight after the composite. This is the path where the intermediate
        // encode is genuinely needed — the lazy-encode change must not break it.
        id: 'scroll-fits',
        name: 'scroll composite that then fits the crop (early return, encode required)',
        w: 50,
        h: 80,
        crop: { top: 0, left: 0, width: 50, height: 50, scrollTop: 30, scrollAreaOffsetY: 10 },
        bytes: 3065,
        hash: '5f19d80c949e2d5b5d806c3b4664a7447590ee5568267addf1f87209af6a3cce',
    },
    {
        // crop.left is beyond the image, so cropW goes negative and the function returns
        // the ORIGINAL buffer. No composite ran, so nothing may be re-encoded.
        id: 'degenerate-no-composite',
        name: 'degenerate crop rectangle returns the original bytes',
        w: 60,
        h: 60,
        crop: { top: 0, left: 70, width: 30, height: 30 },
        bytes: 14528,
        hash: '63fd85089da5b224857e640f501b9545549fa823537c5888850bb8ffd351c662',
    },
    {
        // Needs a detectable grid line: 240 wide so the uniformity scan gets >10 samples
        // past the 12px margin, with the uniform row in the lower half.
        id: 'overflow-then-crop',
        name: 'overflow composite',
        w: 240,
        h: 120,
        gridLineY: 100,
        crop: { top: 0, left: 0, width: 240, height: 110, renderingOverflow: 5 },
        bytes: 30544,
        hash: '4e3a049a224570b17a926aa25f6d1296325764251893126ba27c1015bccbd85c',
    },
    {
        // Both composites, then an early return. This is the only shape where a stale
        // encodedSrc cache is observable: the scroll composite populates it (under debug),
        // the overflow composite then replaces `src`, and the early return must not hand back
        // the earlier composite's bytes. Geometry: 140 tall, scrollTop 20 -> composite 120;
        // grid line at row 110 maps to composite row 90 (inside the scan window); overflow 5
        // -> 115 tall, which exactly fits the crop and triggers the early return.
        id: 'both-composites',
        name: 'both composites then an early return',
        bytes: 32047,
        hash: 'ed2d35da1192d9c586a4acfb07980c5af9d895780d8c9e118b239ff21e0af07c',
        w: 240,
        h: 140,
        gridLineY: 110,
        crop: {
            top: 0,
            left: 0,
            width: 240,
            height: 115,
            scrollTop: 20,
            scrollAreaOffsetY: 10,
            renderingOverflow: 5,
        },
    },
    {
        // The overflow composite's OWN early return. overflowCompositeHeight is
        // src.height - renderingOverflow, so a 120-tall render with overflow 5 composites to
        // exactly 115 and fits a 115-tall crop — the shape the feature is built for. Without
        // this, a `setSrc` in the overflow branch that forgot to drop the cached encoding goes
        // unnoticed and the uncropped 240x120 render is stored instead of the 240x115 composite.
        id: 'overflow-fits',
        name: 'overflow composite that then fits the crop',
        bytes: 31923,
        hash: 'e13c942edb62bcf4fbecf462047507c92d9732748c28c476674d47946238dc00',
        w: 240,
        h: 120,
        gridLineY: 100,
        crop: { top: 0, left: 0, width: 240, height: 115, renderingOverflow: 5 },
    },
    {
        // A composite followed by a DEGENERATE crop rectangle, which reaches the second early
        // return (cropW/cropH <= 0). If the cache still held the caller's original bytes at
        // that point the function hands back the uncomposited render — a silently wrong image, and
        // the only scenario that catches it. Geometry: 50x80 with scrollTop 40 composites to
        // 50x40, then cropH = min(40, 40-60) = -20 trips the guard.
        id: 'degenerate-after-composite',
        name: 'composite then a degenerate crop rectangle',
        w: 50,
        h: 80,
        crop: { top: 60, left: 0, width: 40, height: 40, scrollTop: 40, scrollAreaOffsetY: 5 },
        bytes: 2484,
        hash: '7c3d049b94034e7fea017529bc842139cc6860768282cbeb37b3f535161ff317',
    },
    {
        id: 'fractional',
        name: 'fractional geometry is floored, not rejected',
        w: 60,
        h: 60,
        crop: { top: 2.7, left: 3.2, width: 30.9, height: 25.4 },
        bytes: 995,
        hash: 'c69f3f15e9cb9ef15242e6e16fa9f128eccc7552ab1e459c9ade8f69d946a951',
    },
];

/**
 * Restores every mock to a known baseline.
 *
 * Shared rather than repeated per describe, because five hand-copied blocks had already
 * drifted from each other and from the equivalent in audit-screenshots.test.js.
 *
 * Two things matter beyond clearing calls. `mockReset()` on writeFileSync drops any
 * IMPLEMENTATION a previous test installed — `clearMocks` and `jest.clearAllMocks()` clear
 * recorded calls but leave implementations in place, so the ENOSPC stub used by one test
 * would otherwise still be throwing several describes later. And `config.get` throws on any
 * key it does not recognise, matching audit-screenshots.test.js: returning `undefined` for
 * everything meant a newly-added config read would sail through here while failing loudly
 * there, and the pinned hashes would then be captured under a configuration the code never
 * intended.
 *
 * @returns {Promise<void>} Resolves once the session cache has been cleared.
 */
async function resetMocks() {
    jest.clearAllMocks();
    mockFsSync.writeFileSync.mockReset();
    mockFsSync.existsSync.mockReset();

    const { clearScreenshotSessionCache } = await import('../audit-screenshot-session-cache.js');
    clearScreenshotSessionCache({ cleanup: false });

    mockGlobals.config.get.mockImplementation((key) => {
        if (key === 'Butler-SOS.serversToMonitor.rejectUnauthorized') return false;
        throw new Error(`Unexpected config.get key: ${key}`);
    });
    mockCertUtils.getCertificates.mockReturnValue(null);
    mockCertUtils.createCertificateOptions.mockReturnValue({});
    mockFsSync.existsSync.mockReturnValue(true);
    syncWriteSpy.mockClear();
    syncReadSpy.mockClear();
}

/**
 * Looks a scenario up by its stable `id`.
 *
 * @param {string} id - Scenario id.
 * @returns {object} The matching scenario.
 */
function scenario(id) {
    const found = SCENARIOS.find((s) => s.id === id);
    if (!found) throw new Error(`No scenario with id '${id}'`);
    return found;
}

describe('cropPngBuffer byte identity', () => {
    beforeEach(resetMocks);

    /**
     * Runs the real download path and returns the bytes handed to storage.
     *
     * @param {object} opts - Scenario options.
     * @param {number} opts.w - Source width.
     * @param {number} opts.h - Source height.
     * @param {object} opts.crop - Crop rectangle sent on the payload.
     * @param {boolean} [opts.debug] - Whether debug logging is enabled.
     * @param {number} [opts.gridLineY] - Row index to render as a uniform grey line.
     * @returns {Promise<Buffer>} The bytes passed to writeFile.
     */
    async function storedBytes({ w, h, crop, debug = false, gridLineY = -1 }) {
        const { downloadScreenshot } = await import('../audit-screenshots.js');

        mockAxios.request.mockResolvedValue({
            status: 200,
            headers: { 'content-type': 'image/png' },
            data: makeSourcePng(w, h, gridLineY),
        });

        warnSpy = jest.fn();

        await downloadScreenshot(
            'https://example.com/screenshot.png',
            {
                timestamp: '2025-12-22T12:34:56.000Z',
                eventId: 'evt-bytes',
                correlationId: 'corr-bytes',
                payload: { event: { screenshotUrl: 'https://example.com/screenshot.png', crop } },
            },
            {
                enable: true,
                downloadTimeoutMs: 15000,
                storageTargets: [{ enable: true, type: 'flat', directory: 'screenshots/audit' }],
            },
            {
                debug: jest.fn(),
                info: jest.fn(),
                warn: warnSpy,
                error: jest.fn(),
                isLevelEnabled: jest.fn().mockReturnValue(debug),
            }
        );

        return mockFsPromises.writeFile.mock.calls[0][1];
    }

    // Crossed with debug on/off. Two things only the `true` column can see: the encodedCurrent()
    // cache is populated exclusively by the debug-image branches, so with debug off every early
    // return takes the uncached path and the cached bytes are never compared to anything; and
    // the debug-image branches are the only thing that can leave a cache entry describing an
    // image that has since been replaced. Running every scenario both ways and demanding the
    // same hash is what makes a debug-only divergence — a cache handing back a stale or
    // differently-encoded image — fail instead of hide.
    test.each(
        SCENARIOS.flatMap((s) => [
            { ...s, debug: false },
            { ...s, debug: true },
        ])
    )('$name produces unchanged bytes (debug=$debug)', async (scenario) => {
        const stored = await storedBytes(scenario);

        // downloadScreenshot swallows a crop failure and carries on with the UNCROPPED buffer.
        // For the scenarios whose expected output just is the original bytes, that fallback is
        // indistinguishable from success by hash alone — a totally broken crop path scored a
        // pass. The warn is the only thing that tells the two apart.
        expect(warnSpy).not.toHaveBeenCalled();
        // Checked first so a non-Buffer fails here with a readable message rather than
        // throwing somewhere inside the hashing below.
        expect(Buffer.isBuffer(stored)).toBe(true);
        // Recorded so a failure shows what changed rather than only that something did.
        expect({ bytes: stored.length, hash: sha(stored) }).toEqual({
            bytes: scenario.bytes,
            hash: scenario.hash,
        });
    });
});

describe('cropPngBuffer does not encode more than once', () => {
    beforeEach(resetMocks);

    /**
     * Runs one download and reports how many times the PNG encoder ran.
     *
     * @param {object} scenario - Scenario definition (see SCENARIOS above).
     * @param {boolean} [debug] - Whether debug logging is enabled.
     * @returns {Promise<{encodes: number, decodes: number}>} Codec call counts.
     */
    async function encodeCount(scenario, debug = false) {
        const { downloadScreenshot } = await import('../audit-screenshots.js');
        const source = makeSourcePng(scenario.w, scenario.h, scenario.gridLineY ?? -1);
        syncWriteSpy.mockClear();
        syncReadSpy.mockClear();

        mockAxios.request.mockResolvedValue({
            status: 200,
            headers: { 'content-type': 'image/png' },
            data: source,
        });

        await downloadScreenshot(
            'https://example.com/screenshot.png',
            {
                timestamp: '2025-12-22T12:34:56.000Z',
                eventId: 'evt-count',
                correlationId: 'corr-count',
                payload: {
                    event: {
                        screenshotUrl: 'https://example.com/screenshot.png',
                        crop: scenario.crop,
                    },
                },
            },
            {
                enable: true,
                downloadTimeoutMs: 15000,
                storageTargets: [{ enable: true, type: 'flat', directory: 'screenshots/audit' }],
            },
            {
                debug: jest.fn(),
                info: jest.fn(),
                warn: jest.fn(),
                error: jest.fn(),
                isLevelEnabled: jest.fn().mockReturnValue(debug),
            }
        );

        return {
            encodes: syncWriteSpy.mock.calls.length,
            decodes: syncReadSpy.mock.calls.length,
        };
    }

    test('a scroll composite followed by a crop encodes once, not twice', async () => {
        // The composite used to encode into `buffer` unconditionally; the final crop then
        // discarded it. At 1920x1080 that discarded encode cost ~150 ms of blocked event loop.
        expect(await encodeCount(scenario('scroll-then-crop'))).toEqual({
            encodes: 1,
            decodes: 1,
        });
    });

    test('an overflow composite followed by a crop encodes once, not twice', async () => {
        const sc = scenario('overflow-then-crop');

        expect(await encodeCount(sc)).toEqual({ encodes: 1, decodes: 1 });

        // The count alone does not distinguish "composited then cropped" from "composite never
        // ran": both produce one encode. Pinning the stored dimensions ties the test to the
        // branch its name claims — the overflow composite trims to
        // src.height - renderingOverflow = 115, which the crop then leaves alone.
        const stored = PNG.sync.read(mockFsPromises.writeFile.mock.calls[0][1]);
        expect({ width: stored.width, height: stored.height }).toEqual({
            width: sc.crop.width,
            height: sc.crop.height,
        });
    });

    test('the fast path touches neither the decoder nor the encoder', async () => {
        // decodes: 0 is the assertion that actually pins the header fast path. Without it the
        // whole `if (!debugEnabledEarly)` block can be deleted and every test in this file
        // still passes — a full decode followed by the first early return yields the same zero
        // encodes and the same output bytes, so both other oracles are blind to it.
        expect(await encodeCount(scenario('fast-path'))).toEqual({ encodes: 0, decodes: 0 });
    });

    test('debug logging costs a decode even when nothing needs cropping', async () => {
        // The fast path is skipped under debug on purpose — the diagnostics scan pixels. Pinned
        // so the cost of turning debug on is a deliberate, visible trade, and so the exclusion
        // cannot be quietly widened to the non-debug path.
        expect(await encodeCount(scenario('fast-path'), true)).toEqual({
            encodes: 0,
            decodes: 1,
        });
    });

    test('a composite that then fits the crop still encodes exactly once', async () => {
        // This one genuinely needs the encode — the composited pixels are the result.
        const { encodes: calls } = await encodeCount(scenario('scroll-fits'));

        expect(calls).toBe(1);
    });
});

describe('debug logging does not multiply encodes', () => {
    beforeEach(resetMocks);

    /**
     * Runs one download with debug logging on and reports the encoder call count.
     *
     * @param {string} id - Scenario id.
     * @returns {Promise<number>} Number of PNG.sync.write calls.
     */
    async function debugEncodeCount(id) {
        const { downloadScreenshot } = await import('../audit-screenshots.js');
        const sc = scenario(id);
        // Build the source image BEFORE clearing the spy: makeSourcePng itself calls
        // PNG.sync.write, and counting it would inflate every expectation by one.
        const source = makeSourcePng(sc.w, sc.h, sc.gridLineY ?? -1);
        syncWriteSpy.mockClear();
        syncReadSpy.mockClear();

        mockAxios.request.mockResolvedValue({
            status: 200,
            headers: { 'content-type': 'image/png' },
            data: source,
        });

        await downloadScreenshot(
            'https://example.com/screenshot.png',
            {
                timestamp: '2025-12-22T12:34:56.000Z',
                eventId: 'evt-debug',
                correlationId: 'corr-debug',
                payload: {
                    event: {
                        screenshotUrl: 'https://example.com/screenshot.png',
                        crop: sc.crop,
                    },
                },
            },
            {
                enable: true,
                downloadTimeoutMs: 15000,
                storageTargets: [{ enable: true, type: 'flat', directory: 'screenshots/audit' }],
            },
            {
                debug: jest.fn(),
                info: jest.fn(),
                warn: jest.fn(),
                error: jest.fn(),
                isLevelEnabled: jest.fn().mockReturnValue(true),
            }
        );

        return syncWriteSpy.mock.calls.length;
    }

    test('a composite that then fits the crop encodes once, not twice, under debug', async () => {
        // The debug image write and the early return want the same bytes. An earlier revision
        // encoded separately for each, so turning on debug to investigate a slow screenshot
        // path added a full extra encode — ~140 ms of blocked event loop at 1920x1080, on
        // exactly the timers this change exists to protect.
        expect(await debugEncodeCount('scroll-fits')).toBe(1);
    });

    test('a scroll composite plus a final crop still encodes twice under debug', async () => {
        // One for the debug image of the intermediate composite, one for the final result:
        // genuinely different images, so two is correct and matches pre-change behaviour.
        expect(await debugEncodeCount('scroll-then-crop')).toBe(2);
    });

    test('the debug image and the returned bytes are the same encoding', async () => {
        // Proves the cache is not stale: whatever was written to the debug file is what the
        // early return hands back.
        await debugEncodeCount('scroll-fits');

        const debugBytes = mockFsSync.writeFileSync.mock.calls.at(-1)[1];
        const storedBytes = mockFsPromises.writeFile.mock.calls[0][1];
        expect(Buffer.compare(debugBytes, storedBytes)).toBe(0);
    });
});

describe('the debug-encode cache is never stale', () => {
    beforeEach(resetMocks);

    /**
     * Runs the 'both-composites' scenario with debug on.
     *
     * That shape is the only one that replaces `src` twice before returning early, so it is
     * where a cache tied to the wrong image becomes observable.
     *
     * @param {object} logger - Logger double to pass through.
     * @returns {Promise<void>} Resolves when the download has been processed.
     */
    async function runBothComposites(logger) {
        const { downloadScreenshot } = await import('../audit-screenshots.js');
        const sc = scenario('both-composites');
        // Built before the spy is cleared: makeSourcePng encodes too, and counting it would
        // inflate every expectation below by one.
        const source = makeSourcePng(sc.w, sc.h, sc.gridLineY);
        syncWriteSpy.mockClear();
        syncReadSpy.mockClear();

        mockAxios.request.mockResolvedValue({
            status: 200,
            headers: { 'content-type': 'image/png' },
            data: source,
        });

        await downloadScreenshot(
            'https://example.com/screenshot.png',
            {
                timestamp: '2025-12-22T12:34:56.000Z',
                eventId: 'evt-stale',
                correlationId: 'corr-stale',
                payload: {
                    event: {
                        screenshotUrl: 'https://example.com/screenshot.png',
                        crop: sc.crop,
                    },
                },
            },
            {
                enable: true,
                downloadTimeoutMs: 15000,
                storageTargets: [{ enable: true, type: 'flat', directory: 'screenshots/audit' }],
            },
            logger
        );
    }

    /**
     * A logger double with debug enabled.
     *
     * @returns {object} Logger with jest.fn() methods.
     */
    const debugLogger = () => ({
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        isLevelEnabled: jest.fn().mockReturnValue(true),
    });

    test('each composite is encoded exactly once and the last one is what is stored', async () => {
        // Two composites, two encodes, and the early return reuses the second rather than
        // paying for a third.
        //
        // Asserting the COUNT is what makes this test able to fail. Comparing the stored bytes
        // against the last debug image alone cannot: whichever image the cache holds, both
        // sides of that comparison read it, so they match either way. But a cache that is not
        // dropped when `src` changes makes the second encodedCurrent() a cache HIT — one
        // encode instead of two — and hands the scroll composite's bytes to both the debug
        // file and storage. The count catches that; the byte comparison then says which image
        // was wrong.
        const logger = debugLogger();
        await runBothComposites(logger);

        expect(syncWriteSpy).toHaveBeenCalledTimes(2);

        const debugWrites = mockFsSync.writeFileSync.mock.calls.map((c) => c[1]);
        const stored = mockFsPromises.writeFile.mock.calls[0][1];
        expect(Buffer.compare(stored, debugWrites.at(-1))).toBe(0);
        expect(Buffer.compare(stored, debugWrites.at(-2))).not.toBe(0);
        expect(logger.warn).not.toHaveBeenCalled();
    });

    test('a failed debug write does not change what gets stored', async () => {
        // A read-only volume or full disk must not alter the screenshot. The encode itself sits
        // OUTSIDE the try that wraps the filesystem work, so the cache is populated and correct
        // even when the write fails — and an encoder fault, which is a real pipeline failure,
        // still propagates instead of being reported as a debug-image problem.
        //
        // The failure is keyed to the overflow composite's own filename. An earlier version
        // counted existsSync calls and threw after the second, which silently stopped testing
        // anything the moment an unrelated debug write was added or removed elsewhere in the
        // function.
        const logger = debugLogger();
        mockFsSync.writeFileSync.mockImplementation((file) => {
            if (String(file).includes('overflow-composite-')) {
                throw new Error('ENOSPC: no space left on device');
            }
        });

        await runBothComposites(logger);

        // Whatever was stored must be the real final image — identical to what the same
        // scenario produces with debug off, where no cache is ever populated.
        const sc = scenario('both-composites');
        const stored = mockFsPromises.writeFile.mock.calls[0][1];
        expect({ bytes: stored.length, hash: sha(stored) }).toEqual({
            bytes: sc.bytes,
            hash: sc.hash,
        });
        // The overflow debug write really did fail — otherwise this test proves nothing.
        expect(
            mockFsSync.writeFileSync.mock.calls.some((c) =>
                String(c[0]).includes('overflow-composite-')
            )
        ).toBe(true);
        expect(logger.debug).toHaveBeenCalledWith(
            expect.stringContaining('Failed to save overflow composite debug image')
        );
    });
});

describe('grid-line detection is not fooled by colour-coded rows', () => {
    let gridLineWarn;

    beforeEach(async () => {
        await resetMocks();
        gridLineWarn = jest.fn();
    });

    /**
     * Runs one download of a 240x120 render whose row above the grid line is colour-coded.
     *
     * @param {number} renderingOverflow - Overflow rows reported by the extension.
     * @param {string} [rowAbove] - Row-above mode passed to makeSourcePng.
     * @param {number} [gridLineY] - Row to render as the uniform grid line.
     * @returns {Promise<Buffer>} The bytes passed to writeFile.
     */
    async function storedWithOverflow(
        renderingOverflow,
        rowAbove = 'red-constant',
        gridLineY = 100
    ) {
        const { downloadScreenshot } = await import('../audit-screenshots.js');

        mockAxios.request.mockResolvedValue({
            status: 200,
            headers: { 'content-type': 'image/png' },
            data: makeSourcePng(240, 120, gridLineY, rowAbove),
        });

        await downloadScreenshot(
            'https://example.com/screenshot.png',
            {
                timestamp: '2025-12-22T12:34:56.000Z',
                eventId: 'evt-colour',
                correlationId: 'corr-colour',
                payload: {
                    event: {
                        screenshotUrl: 'https://example.com/screenshot.png',
                        crop: { top: 0, left: 0, width: 240, height: 115, renderingOverflow },
                    },
                },
            },
            {
                enable: true,
                downloadTimeoutMs: 15000,
                storageTargets: [{ enable: true, type: 'flat', directory: 'screenshots/audit' }],
            },
            {
                debug: jest.fn(),
                info: jest.fn(),
                warn: gridLineWarn,
                error: jest.fn(),
                isLevelEnabled: jest.fn().mockReturnValue(false),
            }
        );

        return mockFsPromises.writeFile.mock.calls[0][1];
    }

    test('a heat-mapped row above the grid line still triggers the overflow composite', async () => {
        // Compared against the same render with overflow reporting turned off, rather than
        // against a pinned hash: if the composite fires the two must differ, and if the
        // detector misses the grid line both runs collapse to the same plain crop. That makes
        // the assertion self-validating — it cannot pass by both paths being broken.
        //
        // Restoring the red-only comparison in the aboveUniform scan is exactly what makes
        // them collapse, because the reference pixel is neutral grey and the brightness
        // fallback then rejects a real grid line.
        const composited = await storedWithOverflow(5);
        // Asserted before the comparison below. downloadScreenshot swallows a crop failure and
        // stores the UNCROPPED 240x120 render, which also differs from the plain 240x115 crop
        // — so a cropPngBuffer that throws outright satisfied the Buffer.compare on its own.
        expect(gridLineWarn).not.toHaveBeenCalled();

        await resetMocks();
        const plainCrop = await storedWithOverflow(0);
        expect(gridLineWarn).not.toHaveBeenCalled();

        // Both runs cropped successfully, so any difference is the composite doing its job.
        expect(Buffer.compare(composited, plainCrop)).not.toBe(0);
        expect(PNG.sync.read(composited).height).toBe(115);
    });

    test('a row varying only in blue is still seen as varied content', async () => {
        // Isolates the blue term of the three-channel comparison: red and green are constant
        // across this row, so blue is the only channel that can reveal it is not uniform.
        // Drop that term and the row reads as uniform, the brightness fallback rejects it
        // against its neutral-grey reference pixel, and no composite runs at all.
        const composited = await storedWithOverflow(5, 'blue-varies');
        expect(gridLineWarn).not.toHaveBeenCalled();

        await resetMocks();
        gridLineWarn = jest.fn();
        const plainCrop = await storedWithOverflow(0, 'blue-varies');

        expect(Buffer.compare(composited, plainCrop)).not.toBe(0);
    });

    test('a uniform but much brighter row above is accepted by the brightness fallback', async () => {
        // The fallback's accept arm: a white data cell sitting on a rule. The row above is
        // genuinely uniform, so the non-uniform shortcut does not fire and the decision falls
        // through to `aboveBrightness - brightness > 8` (255 - 200 = 55).
        const composited = await storedWithOverflow(5, 'uniform-bright');
        expect(gridLineWarn).not.toHaveBeenCalled();

        await resetMocks();
        gridLineWarn = jest.fn();
        const plainCrop = await storedWithOverflow(0, 'uniform-bright');

        expect(Buffer.compare(composited, plainCrop)).not.toBe(0);
    });

    test('a uniform row above of similar brightness is rejected as a border band', async () => {
        // The fallback's reject arm: 203 - 200 = 3, below the threshold, so this is treated as
        // an adjacent border band rather than a data row and the scan moves on.
        //
        // The grid line sits at h/2, the last row the scan visits, so rejection is terminal —
        // no later candidate can mask it. With no grid line found the overflow composite is
        // skipped entirely, which makes the two runs below byte-identical.
        const composited = await storedWithOverflow(5, 'uniform-similar', 60);
        expect(gridLineWarn).not.toHaveBeenCalled();

        await resetMocks();
        gridLineWarn = jest.fn();
        const plainCrop = await storedWithOverflow(0, 'uniform-similar', 60);

        expect(Buffer.compare(composited, plainCrop)).toBe(0);
    });
});

describe('the cropped image and its decoded form are handed over together', () => {
    beforeEach(resetMocks);

    /**
     * Runs a download with BOTH a crop rectangle and in-image metadata enabled.
     *
     * That combination existed nowhere in the suite, so `croppedDecoded` was null in every
     * test and the handoff into addTextHeaderToPng was never exercised at all.
     *
     * @param {object} crop - Crop rectangle sent on the payload.
     * @param {number} w - Source width.
     * @param {number} h - Source height.
     * @returns {Promise<{screenshot: Buffer, metadata: Buffer}>} The two stored buffers.
     */
    async function storedWithMetadata(crop, w, h) {
        const { downloadScreenshot } = await import('../audit-screenshots.js');

        mockAxios.request.mockResolvedValue({
            status: 200,
            headers: { 'content-type': 'image/png' },
            data: makeSourcePng(w, h),
        });

        await downloadScreenshot(
            'https://example.com/screenshot.png',
            {
                timestamp: '2025-12-22T12:34:56.000Z',
                eventId: 'evt-meta',
                correlationId: 'corr-meta',
                payload: {
                    event: {
                        screenshotUrl: 'https://example.com/screenshot.png',
                        crop,
                        appName: 'Sales dashboard',
                    },
                },
            },
            {
                enable: true,
                downloadTimeoutMs: 15000,
                storageTargets: [{ enable: true, type: 'flat', directory: 'screenshots/audit' }],
                addInImageMetadata: { enable: true, eventTime: true, appName: true },
            },
            {
                debug: jest.fn(),
                info: jest.fn(),
                warn: jest.fn(),
                error: jest.fn(),
                isLevelEnabled: jest.fn().mockReturnValue(false),
            }
        );

        const writes = mockFsPromises.writeFile.mock.calls;
        const metaCall = writes.find((c) => String(c[0]).includes('_metadata'));
        const shotCall = writes.find((c) => !String(c[0]).includes('_metadata'));
        return { screenshot: shotCall[1], metadata: metaCall[1] };
    }

    // Crops are deliberately wider than the rendered header text (~94px), so the output width
    // is the image's and not the band's — otherwise Math.max would mask a wrong `decoded`.
    test.each([
        ['a standard crop', { top: 5, left: 7, width: 150, height: 80 }, 200, 120],
        [
            'a scroll composite that fits the crop',
            { top: 0, left: 0, width: 200, height: 120, scrollTop: 40, scrollAreaOffsetY: 10 },
            200,
            160,
        ],
    ])('%s produces a metadata image built from the cropped pixels', async (_l, crop, w, h) => {
        const { screenshot, metadata } = await storedWithMetadata(crop, w, h);

        const shot = PNG.sync.read(screenshot);
        const meta = PNG.sync.read(metadata);

        // The metadata image is the screenshot plus a header band, so it must be exactly as
        // wide and strictly taller. Handing over the WRONG decoded image — the uncropped
        // render, or the pre-composite one — changes these numbers, and nothing else in the
        // suite would notice: addTextHeaderToPng ignores pngBuffer once `decoded` is supplied,
        // so a mismatch produces a valid image rather than an error.
        expect(meta.width).toBe(shot.width);
        expect(meta.height).toBeGreaterThan(shot.height);

        // And the pixels below the band must be the cropped screenshot itself.
        const bandHeight = meta.height - shot.height;
        let mismatches = 0;
        for (let y = 0; y < shot.height; y++) {
            for (let x = 0; x < shot.width; x++) {
                const a = (y * shot.width + x) * 4;
                const b = ((y + bandHeight) * meta.width + x) * 4;
                if (shot.data[a] !== meta.data[b] || shot.data[a + 1] !== meta.data[b + 1]) {
                    mismatches++;
                }
            }
        }
        expect(mismatches).toBe(0);
    });
});

describe('encoder faults are not swallowed as debug-image failures', () => {
    beforeEach(resetMocks);

    test('a composite encode failure reaches the caller, not the debug catch', async () => {
        // The encode sits outside the diagnostics try on purpose. Moving it inside converts a
        // real pipeline fault into a debug-level "failed to save debug image" line and stores
        // a screenshot built from who-knows-what; nothing pinned that placement before.
        const { downloadScreenshot } = await import('../audit-screenshots.js');
        const sc = scenario('scroll-fits');
        const source = makeSourcePng(sc.w, sc.h);

        const warn = jest.fn();
        const debug = jest.fn();
        mockAxios.request.mockResolvedValue({
            status: 200,
            headers: { 'content-type': 'image/png' },
            data: source,
        });

        // Fail only the composite encode; the test's own fixture is already built.
        syncWriteSpy.mockImplementationOnce(() => {
            throw new Error('simulated encoder failure');
        });

        await downloadScreenshot(
            'https://example.com/screenshot.png',
            {
                timestamp: '2025-12-22T12:34:56.000Z',
                eventId: 'evt-encfail',
                correlationId: 'corr-encfail',
                payload: {
                    event: { screenshotUrl: 'https://example.com/screenshot.png', crop: sc.crop },
                },
            },
            {
                enable: true,
                downloadTimeoutMs: 15000,
                storageTargets: [{ enable: true, type: 'flat', directory: 'screenshots/audit' }],
            },
            {
                debug,
                info: jest.fn(),
                warn,
                error: jest.fn(),
                isLevelEnabled: jest.fn().mockReturnValue(true),
            }
        );

        expect(warn).toHaveBeenCalledWith(expect.stringContaining('Failed to crop screenshot PNG'));
        expect(debug).not.toHaveBeenCalledWith(
            expect.stringContaining('Failed to save composite debug image')
        );
        // The uncropped original is stored rather than a half-built image.
        expect(Buffer.compare(mockFsPromises.writeFile.mock.calls[0][1], source)).toBe(0);
    });
});
