# Audit Events: QVD Destination

Butler SOS can store audit events received from the Qlik Sense audit extension in Qlik data files (QVD) in the local filesystem.

## Configuration

The QVD destination is configured in the `Butler-SOS.auditEvents.destination` section of the configuration file.

```yaml
auditEvents:
    destination:
        enable: true
        type: influxdb, qvd # Comma-delimited list of destinations.
        qvd:
            exportDirectory: audit-events/qvd # Directory where QVD files will be stored.
            maxBatchSize: 1000 # Flush immediately when this many audit events are buffered.
            writeFrequency: 20000 # Flush buffered audit events this often (ms). Use 0 to write immediately per event.
            staticTags: # Optional static tags added to all audit event points.
                - name: qs_env
                  value: dev
            includeObjectData: true # Include object data (dimensions/measures) from visualizations in audit events.
```

### Settings

| Setting                | Description                                                                                                    |
| :--------------------- | :------------------------------------------------------------------------------------------------------------- |
| `exportDirectory`      | The directory where QVD files will be saved. Relative to the Butler SOS root directory or an absolute path.    |
| `maxBatchSize`         | The maximum number of events to buffer in memory before flushing to a new QVD file.                            |
| `writeFrequency`       | How often (in milliseconds) to flush the buffer to a new QVD file, even if `maxBatchSize` hasn't been reached. |
| `staticTags`           | Optional key-value pairs added to the `tags` field of every QVD row.                                           |
| `includeObjectData` | When `true` (default), stores object data (dimensions/measures) extracted from visualizations. Set to `false` to exclude.  |

## File Naming Convention

QVD files are created daily using UTC time. To avoid overwriting files and to support multiple flushes per day, a "part-file" concept is used:

`YYYYMMDD_partN.qvd`

Example:

- `20251228_part1.qvd`
- `20251228_part2.qvd`

## QVD Schema

The QVD files use the following schema. All fields are optional (nullable).

| Field                  | Type      | Description                                              |
| :--------------------- | :-------- | :------------------------------------------------------- |
| `timestamp`            | `Number`  | Event timestamp in milliseconds (UTC).                   |
| `date`                 | `String`  | Event date in `YYYYMMDD` format (UTC).                   |
| `eventId`              | `String`  | Unique identifier for the event.                         |
| `correlationId`        | `String`  | ID linking related events.                               |
| `eventType`            | `String`  | Type of audit event (e.g., `selection`, `sheet_view`).   |
| `userId`               | `String`  | Qlik Sense user ID.                                      |
| `appId`                | `String`  | Qlik Sense App GUID.                                     |
| `appName`              | `String`  | Qlik Sense App Name.                                     |
| `sheetId`              | `String`  | Qlik Sense Sheet GUID.                                   |
| `sheetName`            | `String`  | Qlik Sense Sheet Name.                                   |
| `objectId`             | `String`  | Qlik Sense Object ID.                                    |
| `objectType`           | `String`  | Visualization type (e.g., `barchart`, `table`). Extracted from `objectData`. |
| `selectionTxnId`       | `String`  | Selection transaction ID.                                |
| `durationMs`           | `Number`  | Duration in milliseconds.                                |
| `visible`              | `Boolean` | Visibility state.                                        |
| `enteredAt`            | `String`  | ISO timestamp when object was entered.                   |
| `leftAt`               | `String`  | ISO timestamp when object was left.                      |
| `dataStateId`          | `Number`  | Data state identifier.                                   |
| `selectionDetails`     | `String`  | JSON string of selection details.                        |
| `screenshotUrl`        | `String`  | URL to the captured screenshot.                          |
| `screenshotSavedPaths` | `String`  | JSON string of local paths where screenshots were saved. |
| `objectData`        | `String`  | JSON string containing extracted object data (dimensions/measures) from the visualization. See [Object Data](#object-data). |
| `tags`                 | `String`  | JSON string containing static tags and other metadata.   |

## Implementation Details

- **Library**: Uses `qvdjs` for high-performance QVD encoding.
- **Buffering**: Events are buffered in memory to minimize disk I/O and create reasonably sized QVD files.
- **UTC**: All timestamps and date strings are based on UTC.

## Object Data

The `objectData` field contains a JSON-serialized object with the actual dimension and measure values extracted from the visualization at the time the audit event was captured. This field is only populated for `screenshot.url.received` events when the audit extension is able to extract the data.

The data is controlled by the `includeObjectData` config setting (default: `true`). Set to `false` to exclude object data from QVD files.

### Structure

```json
{
    "schemaVersion": 1,
    "objectType": "barchart",
    "extractedAt": "2026-02-08T07:30:00.000Z",
    "visibleRange": {
        "rowStart": 0,
        "rowEnd": 10,
        "colStart": 0,
        "colEnd": 4,
        "source": "scroll-state"
    },
    "dimensions": [
        {
            "fieldName": "Region",
            "label": "Sales Region",
            "values": ["North", "South", "East", "West"]
        }
    ],
    "measures": [
        {
            "label": "Revenue",
            "values": ["15000.50", "22000.00", "18500.75", "30000.00"]
        }
    ]
}
```

### Size Constraints

The audit extension enforces the following limits before sending:

- Max 50 dimensions, max 50 measures
- Max 10,000 values per dimension/measure
- Max 1,000 characters per value (truncated with `...`)
- `objectData` is `null` when data is unavailable, extraction fails, or the visualization type is unsupported
