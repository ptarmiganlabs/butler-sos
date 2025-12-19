# Qlik Sense Audit Extension - Prototype

This directory contains prototype code for the Qlik Sense Audit Extension that sends user interaction data to Butler SOS.

## Overview

The extension captures:
- Selection changes (field names, values, counts)
- Object rendering events
- Sheet navigation
- User context (browser, session info)

And sends this data to Butler SOS via HTTP POST for storage in InfluxDB, New Relic, or MQTT.

## Structure

```
qlik-sense-audit-extension/
├── audit-extension.qext          # Extension metadata
├── audit-extension.js             # Main extension code
├── lib/
│   ├── event-buffer.js           # Event batching
│   ├── selection-monitor.js      # Selection tracking
│   ├── object-monitor.js         # Object tracking (placeholder)
│   └── transport.js              # HTTP communication
├── properties.js                  # Extension properties (placeholder)
└── README.md                      # This file
```

## Installation

### Prerequisites

- Qlik Sense Enterprise on Windows (QSEoW) version 3.0 or higher
- Butler SOS with audit events endpoint enabled
- HTTPS endpoint accessible from user browsers

### Steps

1. **Configure Butler SOS**

   Add to your Butler SOS config file:
   
   ```yaml
   Butler-SOS:
     auditEvents:
       enable: true
       apiToken: 'your-secure-token-here'  # Generate with: openssl rand -base64 32
       destinations:
         influxdb: true
         newRelic: false
         mqtt: false
       influxdb:
         measurement: 'audit_events'
   ```

2. **Deploy Extension**

   **Option A: Content Library (Recommended)**
   - Create a ZIP file of this directory
   - Upload to QMC → Content Libraries
   - Extension available to apps using that library

   **Option B: Server Installation**
   - Copy this directory to: `C:\Program Files\Qlik\Sense\EGW\extroot\extensions\`
   - Extension available server-wide

3. **Configure in App**

   - Open Qlik Sense app
   - Edit sheet, add "Butler SOS Audit Extension"
   - Configure:
     - Butler SOS Endpoint: `https://butler-sos:8181/api/v1/audit/events`
     - API Token: (same as Butler SOS config)
     - Enable desired tracking options
   - Save

## Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| Butler SOS Endpoint | URL of Butler SOS audit API | (required) |
| API Token | Authentication token | (required) |
| Batch Interval (ms) | Milliseconds between sending batches | 1000 |
| Track Selections | Enable selection tracking | true |
| Capture Values | Include selected field values | true |
| Max Values Per Field | Maximum values to capture | 100 |
| Track Objects | Enable object render tracking | true |
| Object IDs | Comma-separated IDs to track (empty = all) | "" |

## Usage

Once installed and configured, the extension:

1. Runs invisibly in the background
2. Listens for selection changes and object renders
3. Batches events and sends to Butler SOS every 1 second (configurable)
4. Displays basic status in the extension tile

## Event Types

### SELECTION_CHANGED

Sent when user makes selections.

```json
{
  "type": "SELECTION_CHANGED",
  "timestamp": "2025-12-19T12:30:20.592Z",
  "data": {
    "selections": [
      {
        "field": "Country",
        "stateName": "$",
        "selectedCount": 3,
        "totalCount": 50,
        "values": ["USA", "Canada", "Mexico"]
      }
    ]
  }
}
```

### SELECTION_CLEARED

Sent when all selections are cleared.

### OBJECT_RENDERED

Sent when an object renders data (future enhancement).

## Security

- **Always use HTTPS** for Butler SOS endpoint
- **Protect API tokens** - store in QMC custom properties, not in extension
- **Rotate tokens** regularly (quarterly recommended)
- **Network restrictions** - Butler SOS should be internal only
- **Rate limiting** - Butler SOS enforces rate limits

## Troubleshooting

### Extension not loading

- Check browser console for errors
- Verify extension deployed correctly
- Check QMC logs

### Events not reaching Butler SOS

- Verify endpoint URL is correct and accessible
- Check API token matches Butler SOS config
- Verify network/firewall allows HTTPS to Butler SOS
- Check Butler SOS logs for authentication failures
- Use browser Network tab to see HTTP requests

### Performance issues

- Increase batch interval (1000ms → 5000ms)
- Disable value capture if not needed
- Limit to specific object IDs
- Reduce max values per field

## Development

### Prerequisites

- Node.js (for testing/linting if needed)
- Qlik Sense Desktop or QSEoW for testing

### Testing

1. Deploy to Qlik Sense Desktop or dev server
2. Open browser developer console
3. Watch for log messages from extension
4. Verify HTTP POST requests sent to Butler SOS
5. Check Butler SOS logs for received events
6. Verify data in InfluxDB

### Debugging

Enable verbose logging by modifying transport.js:

```javascript
console.log('Sending events:', events);
console.log('Response:', response);
```

## References

- [Butler SOS Documentation](https://butler-sos.ptarmiganlabs.com)
- [Qlik Extension API](https://qlik.dev/extend/build-visualization-extensions)
- [Qlik Engine API](https://qlik.dev/apis/javascript/engine-api)
- [qlik-trail Project](https://github.com/olim-dev/qlik-trail) (inspiration)

## License

MIT License - Same as Butler SOS

## Support

For issues or questions:
- GitHub Issues: https://github.com/ptarmiganlabs/butler-sos/issues
- Documentation: https://butler-sos.ptarmiganlabs.com

## Version History

- **1.0.0** (Prototype) - Initial prototype implementation
  - Basic selection tracking
  - HTTP POST to Butler SOS
  - Configurable batching
  - Token authentication
