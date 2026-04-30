# Audit Events: Parquet Destination

Butler SOS can store audit events received from the Qlik Sense audit extension in Parquet files on the local filesystem. The Parquet destination stores one metadata row per accepted audit event.

## API Input

Audit events are received by the Butler SOS audit API:

- `POST /api/v1/audit-event` - Accepts audit event envelopes and returns `202 Accepted`.
- `GET /api/v1/test-connection` - Returns a simple health response for connection tests.

When `Butler-SOS.auditEvents.apiToken` is configured, both endpoints require an `Authorization: Bearer <token>` header. Browser calls also require an allowed origin in `Butler-SOS.auditEvents.cors.allowedOrigins`. The POST endpoint accepts an envelope with these required top-level fields:

```json
{
    "schemaVersion": 1,
    "eventId": "165c9558-abcd-1234-a1b2-cc12e5aa9f01",
    "correlationId": "cc12e5aa-beef-4321-9876-abcdef012345",
    "timestamp": "2026-03-08T16:46:26.181Z",
    "type": "screenshot.url.received",
    "source": {
        "kind": "qlik-sense-extension",
        "name": "butler-sos-audit"
    },
    "payload": {
        "context": {
            "user": "LAB\\johndoe",
            "appId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
            "appName": "Sales Dashboard",
            "sheetId": "sheet01",
            "sheetName": "Overview"
        },
        "event": {
            "objectId": "obj123",
            "selectionTxnId": "txn-abc-123",
            "screenshotUrl": "https://qliksense.company.com/tempcontent/example.png",
            "dataStateId": 1776427800995,
            "objectData": {
                "schemaVersion": 1,
                "objectType": "barchart",
                "dimensions": [],
                "measures": []
            }
        }
    }
}
```

Known event types with payload validation are `selection.transaction.finalized`, `selection.state.changed`, `app.model.validated`, `screenshot.url.received`, `event.unsupported.visualization`, and `object.view.duration`. Unknown event types are accepted and stored using the open envelope/payload model.

## Configuration

The Parquet destination is configured in the `Butler-SOS.auditEvents.destination.parquet.metadata` section of the configuration file.

```yaml
Butler-SOS:
    auditEvents:
        destination:
            enable: true
            type: influxdb, parquet # Comma-delimited list of destinations.
            parquet:
                metadata:
                    exportDirectory: audit-events/parquet # Directory where Parquet files will be stored.
                    maxBatchSize: 1000 # Flush immediately when this many audit events are buffered.
                    writeFrequency: 20000 # Flush buffered audit events this often (ms). Use 0 to write immediately per event.
                    staticTags: # Optional static tags added to the tags field of every Parquet row.
                        - name: qs_env
                            value: dev
```

### Settings

| Setting                | Description                                                                                                        |
| :--------------------- | :----------------------------------------------------------------------------------------------------------------- |
| `exportDirectory`      | The directory where Parquet files will be saved. Relative to the Butler SOS root directory or an absolute path.    |
| `maxBatchSize`         | The maximum number of events to buffer in memory before flushing to a new Parquet file.                            |
| `writeFrequency`       | How often (in milliseconds) to flush the buffer to a new Parquet file, even if `maxBatchSize` hasn't been reached. |
| `staticTags`           | Optional key-value pairs added to the `tags` field of every Parquet row.                                           |

The shared configuration schema also allows an optional `destination.parquet.objectdata` subsection, but the current Parquet implementation does not write a separate objectdata dataset. Object data is stored in the metadata row's `objectData` field whenever it is present in the incoming event.

## File Naming Convention

Parquet files are created daily using UTC time. To avoid overwriting files and to support multiple flushes per day, a "part-file" concept is used:

`YYYYMMDD_partN.parquet`

Example:

- `20251228_part1.parquet`
- `20251228_part2.parquet`

## Parquet Schema

The Parquet files use the following schema. All fields are optional (nullable).

| Field | Type | Description |
| :--- | :--- | :--- |
| `timestamp` | `INT64` | Event timestamp in milliseconds (UTC). |
| `date` | `UTF8` | Event date in `YYYYMMDD` format (UTC). |
| `eventId` | `UTF8` | Unique identifier for the event. |
| `correlationId` | `UTF8` | ID linking related events. |
| `eventType` | `UTF8` | Type of audit event (e.g., `screenshot.url.received`, `object.view.duration`). |
| `userId` | `UTF8` | Qlik Sense user ID. |
| `appId` | `UTF8` | Qlik Sense App GUID. |
| `appName` | `UTF8` | Qlik Sense App Name. |
| `sheetId` | `UTF8` | Qlik Sense Sheet GUID. |
| `sheetName` | `UTF8` | Qlik Sense Sheet Name. |
| `objectId` | `UTF8` | Qlik Sense Object ID. |
| `objectType` | `UTF8` | Visualization type (e.g., `barchart`, `table`). Extracted from `objectData`. |
| `selectionTxnId` | `UTF8` | Selection transaction ID. |
| `durationMs` | `INT64` | Duration in milliseconds. |
| `visible` | `BOOLEAN` | Visibility state. |
| `enteredAt` | `UTF8` | ISO timestamp when object was entered. |
| `leftAt` | `UTF8` | ISO timestamp when object was left. |
| `dataStateId` | `INT64` | Data state identifier. |
| `selectionDetails` | `UTF8` | JSON string of selection details. |
| `screenshotUrl` | `UTF8` | URL to the captured screenshot. |
| `screenshotSavedPaths` | `UTF8` | JSON string of local paths where screenshots were saved. |
| `objectData` | `UTF8` | JSON string containing extracted object data (dimensions/measures) from the visualization. See [Object Data](#object-data). |
| `tags` | `UTF8` | JSON string containing static tags and other metadata. |

## Implementation Details

- **Library**: Uses `hyparquet-writer` for high-performance, zero-dependency Parquet encoding.
- **Buffering**: Events are buffered in memory to minimize disk I/O and create reasonably sized Parquet files.
- **UTC**: All timestamps and date strings are based on UTC.

## Object Data

The `objectData` field contains a JSON-serialized object with the actual dimension and measure values extracted from the visualization at the time the audit event was captured. This field is populated whenever the incoming event contains `payload.event.objectData`; otherwise it is stored as `null`.

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

The audit extension is expected to limit and sanitize object data before sending it. Butler SOS stores the received `objectData` payload as-is, after JSON serialization. Typical extension-side limits are:

- Max 50 dimensions, max 50 measures
- Max 10,000 values per dimension/measure
- Max 1,000 characters per value (truncated with `...`)
- `objectData` is `null` when data is unavailable, extraction fails, or the visualization type is unsupported


