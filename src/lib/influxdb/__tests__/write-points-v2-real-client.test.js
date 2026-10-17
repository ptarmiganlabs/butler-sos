import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import http from 'node:http';
import { gunzipSync } from 'node:zlib';
import { InfluxDB, Point, setLogger } from '@influxdata/influxdb-client';

import { writePointsToInfluxV2 } from '../shared/utils.js';

/**
 * writePointsToInfluxV2 with the real InfluxDB v2 client, against a local HTTP server.
 *
 * The v2 client sends its buffer by itself once it holds `batchSize` points (1000 by default)
 * and ignores the result of that request. With 1000 points, the default maxBatchSize, the whole
 * write went out that way, close() found nothing left to send, and a failed write was reported
 * as written: no retry, no error count. Mocked write APIs cannot show this, as their
 * writePoints() rejects, which the real client's never does.
 */

let server;
let url;
let requests = [];
let respondWith = 204;

beforeAll(async () => {
    // The client logs failed writes itself; keep that out of the test output
    setLogger({ error: () => {}, warn: () => {} });

    server = http.createServer((req, res) => {
        const chunks = [];
        req.on('data', (chunk) => {
            chunks.push(chunk);
        });
        req.on('end', () => {
            // The client gzips larger bodies
            let body = Buffer.concat(chunks);
            if (req.headers['content-encoding'] === 'gzip') {
                body = gunzipSync(body);
            }
            requests.push(body.toString('utf8').split('\n').filter(Boolean).length);
            res.writeHead(respondWith, { 'content-type': 'application/json' });
            res.end(
                respondWith === 204 ? '' : JSON.stringify({ message: 'rejected by test server' })
            );
        });
    });
    await new Promise((resolve) => {
        server.listen(0, '127.0.0.1', resolve);
    });
    url = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
    await new Promise((resolve) => {
        server.close(resolve);
    });
});

/**
 * Builds points with distinct field values.
 *
 * @param {number} n - Number of points
 * @returns {Point[]} The points
 */
function makePoints(n) {
    return Array.from({ length: n }, (_, i) => new Point('m').intField('i', i).timestamp(`${i}`));
}

describe.each([1, 999, 1000, 2500])('writePointsToInfluxV2 with %i point(s)', (count) => {
    test('reports a failed write as failed', async () => {
        requests = [];
        respondWith = 400;
        const client = new InfluxDB({ url, token: 'test' });

        await expect(
            writePointsToInfluxV2(client, 'org', 'bucket', makePoints(count))
        ).rejects.toThrow('rejected by test server');
    });

    test('sends all points in one request', async () => {
        requests = [];
        respondWith = 204;
        const client = new InfluxDB({ url, token: 'test' });

        await writePointsToInfluxV2(client, 'org', 'bucket', makePoints(count));

        expect(requests).toEqual([count]);
    });
});
