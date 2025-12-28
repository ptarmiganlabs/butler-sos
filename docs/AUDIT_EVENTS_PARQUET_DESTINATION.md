# Audit Events: Parquet Destination

Butler SOS can store audit events received from the Qlik Sense audit extension in Parquet files on the local filesystem.

## Configuration

The Parquet destination is configured in the `Butler-SOS.auditEvents.destination` section of the configuration file.

```yaml
auditEvents:
    destination:
        enable: true
        type: influxdb, parquet # Comma-delimited list of destinations.
        parquet:
            exportDirectory: audit-events/parquet # Directory where Parquet files will be stored.
            maxBatchSize: 1000 # Flush immediately when this many audit events are buffered.
            writeFrequency: 20000 # Flush buffered audit events this often (ms). Use 0 to write immediately per event.
            staticTags: # Optional static tags added to all audit event points.
                - name: qs_env
                  value: dev
```

### Settings

| Setting           | Description                                                                                                        |
| :---------------- | :----------------------------------------------------------------------------------------------------------------- |
| `exportDirectory` | The directory where Parquet files will be saved. Relative to the Butler SOS root directory or an absolute path.    |
| `maxBatchSize`    | The maximum number of events to buffer in memory before flushing to a new Parquet file.                            |
| `writeFrequency`  | How often (in milliseconds) to flush the buffer to a new Parquet file, even if `maxBatchSize` hasn't been reached. |
| `staticTags`      | Optional key-value pairs added to the `tags` field of every Parquet row.                                           |

## File Naming Convention

Parquet files are created daily using UTC time. To avoid overwriting files and to support multiple flushes per day, a "part-file" concept is used:

`YYYYMMDD_partN.parquet`

Example:

- `20251228_part1.parquet`
- `20251228_part2.parquet`

## Parquet Schema

The Parquet files use the following schema. All fields are optional (nullable).

| Field                  | Type      | Description                                              |
| :--------------------- | :-------- | :------------------------------------------------------- |
| `timestamp`            | `INT64`   | Event timestamp in milliseconds (UTC).                   |
| `date`                 | `UTF8`    | Event date in `YYYYMMDD` format (UTC).                   |
| `eventId`              | `UTF8`    | Unique identifier for the event.                         |
| `correlationId`        | `UTF8`    | ID linking related events.                               |
| `eventType`            | `UTF8`    | Type of audit event (e.g., `selection`, `sheet_view`).   |
| `userId`               | `UTF8`    | Qlik Sense user ID.                                      |
| `appId`                | `UTF8`    | Qlik Sense App GUID.                                     |
| `appName`              | `UTF8`    | Qlik Sense App Name.                                     |
| `sheetId`              | `UTF8`    | Qlik Sense Sheet GUID.                                   |
| `sheetName`            | `UTF8`    | Qlik Sense Sheet Name.                                   |
| `objectId`             | `UTF8`    | Qlik Sense Object ID.                                    |
| `selectionTxnId`       | `UTF8`    | Selection transaction ID.                                |
| `durationMs`           | `INT64`   | Duration in milliseconds.                                |
| `visible`              | `BOOLEAN` | Visibility state.                                        |
| `enteredAt`            | `UTF8`    | ISO timestamp when object was entered.                   |
| `leftAt`               | `UTF8`    | ISO timestamp when object was left.                      |
| `dataStateId`          | `INT64`   | Data state identifier.                                   |
| `selectionDetails`     | `UTF8`    | JSON string of selection details.                        |
| `screenshotUrl`        | `UTF8`    | URL to the captured screenshot.                          |
| `screenshotSavedPaths` | `UTF8`    | JSON string of local paths where screenshots were saved. |
| `tags`                 | `UTF8`    | JSON string containing static tags and other metadata.   |

## Implementation Details

- **Library**: Uses `hyparquet-writer` for high-performance, zero-dependency Parquet encoding.
- **Buffering**: Events are buffered in memory to minimize disk I/O and create reasonably sized Parquet files.
- **UTC**: All timestamps and date strings are based on UTC.
