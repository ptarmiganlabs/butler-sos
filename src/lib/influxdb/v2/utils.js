import { Point } from '@influxdata/influxdb-client';

/**
 * Applies tags from config to an InfluxDB Point object.
 *
 * @param {Point} point - The InfluxDB Point object
 * @param {Array<{name: string, value: string}>} tags - Array of tag objects
 * @returns {Point} The Point object with tags applied (for chaining)
 */
export function applyInfluxTags(point, tags) {
    if (!tags || !Array.isArray(tags) || tags.length === 0) {
        return point;
    }

    for (const tag of tags) {
        if (tag.name && tag.value !== undefined && tag.value !== null) {
            point.tag(tag.name, String(tag.value));
        }
    }

    return point;
}
