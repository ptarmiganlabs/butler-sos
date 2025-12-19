# Qlik Sense Audit Extension Feasibility Investigation

**Date:** December 2025  
**Version:** 1.0  
**Status:** Investigation Complete  
**Related Issue:** [#1156](https://github.com/ptarmiganlabs/butler-sos/issues/1156)

## Executive Summary

This document investigates the feasibility and design of a Qlik Sense visualization extension that monitors specific sheet objects and sends detailed interaction data to Butler SOS. The investigation concludes that **this approach is technically feasible** with moderate development effort, though it requires architectural changes to Butler SOS and careful consideration of deployment and security implications.

### Key Findings

✅ **Feasible:** Client-side selection tracking is possible using Qlik's Engine API  
✅ **Proven:** The qlik-trail project demonstrates the core concepts work  
⚠️ **Limitation:** UDP is not available from browsers; requires HTTP/WebSocket endpoint  
⚠️ **Consideration:** Performance and security implications need careful management  
✅ **Value:** Provides granular audit data not available from server-side logs alone  

### Recommendation

**Proceed with a phased approach:**
1. **Phase 1:** Implement basic HTTP endpoint and prototype extension
2. **Phase 2:** Add WebSocket support for real-time streaming if needed
3. **Phase 3:** Enhance with data sampling and advanced tracking features

---

## 1. Background and Motivation

### 1.1 Problem Statement

Server-side logs from Qlik Sense services (Proxy, Engine, Repository, Scheduler) capture system-level events but may not provide sufficient granularity for comprehensive auditing needs:

- **Selection Details:** Server logs don't capture which specific values users selected
- **Data Visibility:** No insight into what data users actually see in visualizations
- **Client Context:** Missing browser, client-side timing, and user agent information
- **Object-Level Tracking:** Cannot monitor specific visualizations of interest

### 1.2 Proposed Solution

A client-side Qlik Sense visualization extension that:
- Monitors user interactions within apps
- Captures selection details, field values, and object rendering events
- Transmits audit data to Butler SOS for storage and analysis
- Works alongside existing server-side logging

### 1.3 Benefits

1. **Complete Audit Trail:** Combines server-side and client-side events
2. **Selection Forensics:** Know exactly what users selected and when
3. **Data Access Tracking:** Track which data users viewed
4. **User Behavior Analytics:** Understand how users interact with apps
5. **Compliance Support:** Enhanced audit capabilities for regulated industries

---

## 2. Technical Feasibility Analysis

### 2.1 Client-Side Selection Tracking

**Status: ✅ FEASIBLE**

The [qlik-trail](https://github.com/olim-dev/qlik-trail) project demonstrates that comprehensive selection tracking is possible using Qlik's Capability APIs.

#### 2.1.1 Available Capabilities

| Capability | Feasibility | API Method | Notes |
|------------|-------------|------------|-------|
| Field names | ✅ Confirmed | `getList('SelectionObject')` | Easy to capture |
| Selected values | ✅ Confirmed | `createList()` + `qDataPages` | Requires additional API call |
| Selection counts | ✅ Confirmed | `qSelectedCount` in SelectionObject | Built-in property |
| Alternate states | ✅ Confirmed | `qStateName` | Supports alternate state tracking |
| Selection source | ⚠️ Partial | Event analysis | Can infer from timing/context |
| Bookmark detection | ⚠️ Partial | Compare signatures | Requires signature comparison |

#### 2.1.2 Core API Patterns

```javascript
// 1. Get app reference
var app = qlik.currApp();

// 2. Listen to selection changes
app.getList('SelectionObject', function(reply) {
    var selections = reply.qSelectionObject.qSelections;
    selections.forEach(function(sel) {
        // sel.qField - field name
        // sel.qSelectedCount - number of selected values
        // sel.qTotal - total number of values in field
        // sel.qStateName - alternate state ($ = default)
    });
});

// 3. Get actual selected values
app.createList({
    qStateName: sel.qStateName || '$',
    qDef: { qFieldDefs: [sel.qField] },
    qInitialDataFetch: [{
        qTop: 0,
        qLeft: 0,
        qWidth: 1,
        qHeight: 10000  // Max values to fetch
    }]
}).then(function(model) {
    model.getLayout().then(function(layout) {
        var values = layout.qListObject.qDataPages[0].qMatrix;
        // values = array of [{ qText: "Value1", qState: "S" }]
    });
});

// 4. Detect selection changes with signature
function createSignature(selections) {
    return JSON.stringify(selections.map(function(s) {
        return s.qField + ':' + (s.qStateName || '$') + ':' + s.qSelectedCount;
    }));
}
```


### 2.2 Object Rendering Tracking

**Status: ✅ FEASIBLE with limitations**

#### 2.2.1 Available Object Information

| Information | Feasibility | Method | Notes |
|-------------|-------------|--------|-------|
| Object ID | ✅ Confirmed | `model.id` | Unique identifier |
| Object Type | ✅ Confirmed | `layout.qInfo.qType` | Chart type (barchart, table, etc.) |
| Render events | ✅ Confirmed | `model.Validated.bind()` | Fires on data updates |
| Row counts | ✅ Confirmed | `layout.qHyperCube.qSize.qcy` | For hypercube objects |
| Actual data values | ⚠️ Complex | `layout.qHyperCube.qDataPages` | Can be large, privacy concerns |
| Dimension values | ⚠️ Complex | Parse hypercube structure | Requires understanding layout |

#### 2.2.2 Example Code

```javascript
app.getObject('QV01', 'myObjectId').then(function(model) {
    // Listen for render/update events
    model.Validated.bind(function() {
        model.getLayout().then(function(layout) {
            var event = {
                objectId: model.id,
                objectType: layout.qInfo.qType,
                timestamp: new Date().toISOString()
            };
            
            // For hypercube-based objects
            if (layout.qHyperCube) {
                event.rowCount = layout.qHyperCube.qSize.qcy;
                event.columnCount = layout.qHyperCube.qSize.qcx;
            }
            
            sendToButlerSOS(event);
        });
    });
});
```

### 2.3 Browser-to-Butler SOS Communication

**Status: ⚠️ REQUIRES ARCHITECTURAL CHANGES**

#### 2.3.1 UDP Limitation

**Direct UDP from browser is NOT possible** due to browser security model:
- Browsers only support HTTP(S) and WebSocket protocols
- No access to raw UDP sockets from JavaScript
- This is a fundamental limitation, not a workaround issue

#### 2.3.2 Available Options

| Option | Protocol | Pros | Cons | Recommendation |
|--------|----------|------|------|----------------|
| HTTP POST | HTTPS | Simple, widely supported, works with proxies | Higher overhead, not real-time | ✅ **Recommended for Phase 1** |
| WebSocket | WSS | Real-time, bi-directional, lower overhead | More complex, connection management | ⚠️ Consider for Phase 2 |
| Server-Side Relay | UDP via proxy | Uses existing UDP infrastructure | Requires intermediary service | ❌ Not recommended (adds complexity) |

### 2.4 Performance Considerations

#### 2.4.1 Impact on Client

| Aspect | Impact | Mitigation |
|--------|--------|------------|
| Selection listener | Low | Single global listener, minimal CPU |
| Network calls | Medium | Batch events (default: 1 second) |
| Memory usage | Low-Medium | Limit buffer size, clear after send |
| Page load time | Negligible | Extension loads asynchronously |

#### 2.4.2 Impact on Butler SOS

| Aspect | Impact | Mitigation |
|--------|--------|------------|
| Network traffic | Medium | Client-side batching, compression |
| Processing load | Medium | Async processing, queue management |
| Storage | High | User configurable retention, sampling |

**Estimated Traffic:**
- 10 users × 20 selections/hour × 2KB/event = ~400 KB/hour
- With data sampling: up to 10× higher
- Acceptable for most deployments

### 2.5 Security Analysis

#### 2.5.1 Risks

| Risk | Severity | Description |
|------|----------|-------------|
| Data exposure | **HIGH** | Extension has access to all data user can see |
| Unauthorized transmission | **MEDIUM** | Could send data to unintended endpoint |
| Man-in-the-middle | **MEDIUM** | HTTP traffic interception (if not HTTPS) |
| Denial of service | **LOW** | Malicious rapid event generation |

#### 2.5.2 Mitigations

1. **Authentication:**
   - API token-based authentication
   - Token configured per app or organization-wide
   - Validate token on Butler SOS side

2. **Encryption:**
   - **REQUIRE HTTPS** for all communication
   - TLS 1.2+ minimum
   - Certificate validation

3. **Rate Limiting:**
   - Butler SOS enforces rate limits per source
   - Client-side batching reduces request frequency
   - Reject excessive event rates

4. **Access Control:**
   - Extension only sees data user has access to
   - No privilege escalation possible
   - Butler SOS logs all received events

5. **Data Minimization:**
   - Configurable to exclude sensitive fields
   - Optional data sampling (vs. full capture)
   - Retention policies in Butler SOS

#### 2.5.3 Deployment Security

| Consideration | Recommendation |
|---------------|----------------|
| Extension distribution | QMC Content Library (controlled deployment) |
| Configuration management | Store tokens in QMC custom properties, not extension |
| Network access | Restrict Butler SOS endpoint to internal network only |
| Monitoring | Alert on unusual event volumes or patterns |


---

## 3. Architecture Design

### 3.1 Recommended Architecture (Phase 1)

```
┌─────────────────────────────────────────────┐
│          Qlik Sense Server                  │
│                                             │
│  ┌────────────────────────────────────┐    │
│  │  Qlik Sense App (Browser)          │    │
│  │                                     │    │
│  │  ┌──────────────────────────────┐  │    │
│  │  │  Audit Extension             │  │    │
│  │  │  - Selection Monitor         │  │    │
│  │  │  - Object Monitor            │  │    │
│  │  │  - Event Buffer              │  │    │
│  │  └──────────┬───────────────────┘  │    │
│  │             │ HTTPS POST             │    │
│  └─────────────┼────────────────────────┘    │
│                │                             │
└────────────────┼─────────────────────────────┘
                 │
                 │ HTTPS (port 8181)
                 │ POST /api/v1/audit/events
                 │
                 ▼
┌─────────────────────────────────────────────┐
│          Butler SOS                         │
│                                             │
│  ┌────────────────────────────────────┐    │
│  │  New: HTTP API Endpoint            │    │
│  │  - Authentication                  │    │
│  │  - Rate Limiting                   │    │
│  │  - Input Validation                │    │
│  │  - Event Queue                     │    │
│  └────────────┬───────────────────────┘    │
│               │                             │
│  ┌────────────▼───────────────────────┐    │
│  │  Event Processor                   │    │
│  │  - Transform to internal format    │    │
│  │  - Enrich with metadata            │    │
│  │  - Apply filters                   │    │
│  └────────────┬───────────────────────┘    │
│               │                             │
│  ┌────────────▼───────────────────────┐    │
│  │  Destinations (existing)           │    │
│  │  - InfluxDB                        │    │
│  │  - New Relic                       │    │
│  │  - MQTT                            │    │
│  └────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

### 3.2 Event Schema

#### HTTP Request Format

```json
{
  "apiVersion": "1.0",
  "source": {
    "extensionVersion": "1.0.0",
    "appId": "a4c3d8f1-5c2b-4e8f-9d1a-7b6c3e2f1a0b",
    "appName": "Sales Dashboard",
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "userId": "DOMAIN\\username",
    "userDirectory": "DOMAIN",
    "userName": "username"
  },
  "client": {
    "timestamp": "2025-12-19T12:30:20.592Z",
    "userAgent": "Mozilla/5.0...",
    "browser": "Chrome",
    "browserVersion": "120.0",
    "os": "Windows",
    "osVersion": "10"
  },
  "events": [
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
  ]
}
```

### 3.3 Event Types

| Event Type | Description | Data Included |
|------------|-------------|---------------|
| `SELECTION_CHANGED` | User made selections | Field names, values, counts, state |
| `SELECTION_CLEARED` | All selections cleared | Previous state |
| `OBJECT_RENDERED` | Object displayed data | Object ID, type, row/column counts |
| `SHEET_OPENED` | User navigated to sheet | Sheet ID, sheet name |
| `APP_OPENED` | User opened app | App ID, app name |

---

## 4. Extension Implementation Details

### 4.1 Core Components

The extension consists of:
1. **Main Extension Module** - Initializes and coordinates components
2. **Event Buffer** - Batches events before sending
3. **Selection Monitor** - Tracks field selections and values
4. **Object Monitor** - Tracks object rendering events
5. **Transport Layer** - Handles HTTP communication to Butler SOS

### 4.2 Key Features

- ✅ Selection tracking with configurable value capture
- ✅ Configurable batch intervals (default: 1 second)
- ✅ Token-based authentication
- ✅ Graceful error handling
- ✅ Object rendering tracking
- ✅ Extension configuration UI in Qlik Sense

### 4.3 Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| Butler SOS Endpoint | String | (required) | URL of Butler SOS API endpoint |
| API Token | String | (required) | Authentication token |
| Batch Interval | Number | 1000 | Milliseconds between batches |
| Track Selections | Boolean | true | Enable selection tracking |
| Capture Values | Boolean | true | Include selected values |
| Max Values Per Field | Number | 100 | Maximum values to capture per field |
| Track Objects | Boolean | true | Enable object rendering tracking |
| Object IDs | String | "" | Comma-separated object IDs (empty = all) |

---

## 5. Butler SOS Changes Required

### 5.1 New Components

1. **HTTP API Endpoint** (`/api/v1/audit/events`)
   - Accept POST requests with audit event payloads
   - Validate JSON schema
   - Authenticate using API token
   - Rate limiting to prevent abuse

2. **Audit Event Processor**
   - Transform events to internal format
   - Enrich with server-side metadata
   - Route to configured destinations

3. **Configuration Schema**
   - Add `auditEvents` section to config
   - Define API token
   - Configure destinations (InfluxDB, New Relic, MQTT)

### 5.2 Integration Points

| Component | Change Type | Complexity |
|-----------|-------------|------------|
| Fastify server | Add route handler | Low |
| Config schema | Add section | Low |
| InfluxDB writer | New measurement | Medium |
| New Relic sender | New event type | Medium |
| MQTT publisher | New topic | Low |

### 5.3 Configuration Example

```yaml
Butler-SOS:
  auditEvents:
    enable: true
    apiToken: 'your-secure-token-here'
    destinations:
      influxdb: true
      newRelic: false
      mqtt: false
    influxdb:
      measurement: 'audit_events'
```

### 5.4 Development Effort Estimate

| Task | Effort | Notes |
|------|--------|-------|
| HTTP endpoint | 4-6 hours | Including authentication, validation |
| Event processing | 4-6 hours | Transform, enrich, queue |
| InfluxDB integration | 3-4 hours | New measurement schema |
| New Relic integration | 2-3 hours | Leverage existing code |
| MQTT integration | 2-3 hours | New topic structure |
| Testing | 6-8 hours | Unit + integration tests |
| Documentation | 4-6 hours | User guide, API docs |
| **TOTAL** | **25-36 hours** | ~1 week for experienced developer |

---

## 6. Deployment and Operations

### 6.1 Installation Process

#### Step 1: Configure Butler SOS

```yaml
Butler-SOS:
  auditEvents:
    enable: true
    apiToken: 'generate-with-openssl-rand-base64-32'
    destinations:
      influxdb: true
```

Restart Butler SOS and verify endpoint availability.

#### Step 2: Deploy Extension

**Option A: QMC Content Library** (Recommended)
1. Package extension as ZIP
2. Upload to QMC → Content Libraries
3. Extension available to all apps

**Option B: Manual Installation**
1. Copy to `C:\Program Files\Qlik\Sense\EGW\extroot\extensions\`
2. Requires server admin access

#### Step 3: Configure in Apps

1. Add extension to sheet
2. Configure endpoint URL and API token
3. Enable desired tracking options
4. Save and publish

### 6.2 Network Requirements

| Requirement | Configuration |
|-------------|---------------|
| Firewall | Allow outbound HTTPS from Qlik Sense to Butler SOS port 8181 |
| DNS | Butler SOS hostname resolvable from browsers |
| TLS | Valid certificate on Butler SOS |
| Proxy | Configure PAC file if web proxy used |

### 6.3 Monitoring

- Monitor Butler SOS logs for incoming events
- Check InfluxDB for stored audit data
- Alert on unusual event volumes
- Track failed authentication attempts

---

## 7. Performance and Scalability

### 7.1 Expected Load

| Users | Events/Hour | Network (MB/hr) | Impact |
|-------|-------------|-----------------|--------|
| 10 | 100 | 0.24 | Negligible |
| 50 | 500 | 1.2 | Low |
| 100 | 1,000 | 2.4 | Low-Medium |
| 500 | 5,000 | 12 | Medium |
| 1,000 | 10,000 | 24 | Medium-High |

### 7.2 Optimization Strategies

1. **Increase batch interval** - Reduce request frequency
2. **Disable value capture** - Reduce payload size by ~60%
3. **Limit tracked objects** - Only monitor important visualizations
4. **Implement sampling** - Track subset of events
5. **Use compression** - Enable HTTP compression

### 7.3 Scaling Recommendations

- **Up to 500 users:** Single Butler SOS instance
- **500-1,000 users:** Consider load balancing
- **1,000+ users:** Multiple Butler SOS instances

---

## 8. Security Considerations

### 8.1 Security Checklist

- [ ] Use HTTPS for all communication
- [ ] Generate strong API tokens (32+ chars)
- [ ] Store tokens securely (QMC custom properties)
- [ ] Rotate tokens quarterly
- [ ] Enable rate limiting in Butler SOS
- [ ] Restrict Butler SOS to internal network
- [ ] Monitor for unusual activity
- [ ] Implement retention policies

### 8.2 Data Protection

- Configure field exclusions for sensitive data
- Use data sampling where full capture not required
- Implement retention policies in InfluxDB
- Regular security audits

### 8.3 Compliance

| Regulation | Considerations |
|------------|----------------|
| GDPR | Document legal basis, implement retention limits |
| HIPAA | Exclude PHI fields, encrypt transmission |
| SOX | Ensure audit trail integrity |
| PCI DSS | Never capture payment card data |

---

## 9. Alternatives Considered

### 9.1 Server-Side Only Approach

**Verdict:** ❌ Rejected - Doesn't capture selection details

### 9.2 Mashup Integration

**Verdict:** ❌ Rejected - Requires separate deployment, limits adoption

### 9.3 Qlik Proxy Plugin

**Verdict:** ❌ Rejected - Too complex, doesn't solve core problem

### 9.4 Selected Approach

**Visualization Extension** - Best balance of capability, complexity, and adoption

---

## 10. Future Enhancements

### 10.1 Phase 2 Features

- WebSocket support for real-time streaming
- Data sampling from hypercubes
- Bookmark detection
- Advanced navigation tracking
- Client-side filtering

### 10.2 Enterprise Features

- Multi-tenancy support
- OAuth 2.0 authentication
- Data lineage tracking
- Pre-built Grafana dashboards
- Anomaly detection alerts

---

## 11. Recommendations

### 11.1 Final Recommendation

**✅ PROCEED with phased implementation**

- Technically feasible with proven APIs
- Moderate development effort (~1-2 weeks)
- Acceptable performance impact
- Valuable for audit and compliance

### 11.2 Implementation Phases

**Phase 1: MVP** (2-3 weeks)
- Basic selection tracking
- HTTP endpoint
- InfluxDB integration

**Phase 2: Enhanced** (1-2 weeks)
- Value capture
- Object tracking
- New Relic integration

**Phase 3: Production** (1-2 weeks)
- Security hardening
- Performance optimization
- Documentation

### 11.3 Success Criteria

- Extension captures selections accurately
- Butler SOS processes events without errors
- Performance impact <5%
- Security review passed
- Documentation complete

### 11.4 Next Steps

1. **Review and Approval** - Stakeholder sign-off
2. **Technical Setup** - Dev environment
3. **Prototype Development** - Week 1
4. **Demo and Feedback** - Internal review
5. **Production Development** - Weeks 2-3
6. **Deployment** - Week 4

---

## 12. References

1. **qlik-trail Project:** https://github.com/olim-dev/qlik-trail
2. **Qlik Extension API:** https://qlik.dev/extend/build-visualization-extensions
3. **Qlik Engine API:** https://qlik.dev/apis/javascript/engine-api
4. **Butler SOS Documentation:** https://butler-sos.ptarmiganlabs.com
5. **Butler SOS UDP Handlers:** https://github.com/ptarmiganlabs/butler-sos/tree/master/src/lib/udp_handlers

---

## 13. Conclusion

The Qlik Sense audit extension is a **viable and valuable enhancement** to Butler SOS. It provides granular audit capabilities not available from server-side logs alone, with acceptable complexity and performance characteristics.

**Key Takeaways:**

1. ✅ Technically sound using proven APIs
2. ✅ Architecturally feasible with HTTP endpoint
3. ⚠️ Requires security considerations (HTTPS, tokens, rate limiting)
4. ✅ Acceptable performance (<5% overhead)
5. ✅ Moderate effort (~1 week core development)

**Recommended Action:** Proceed with Phase 1 MVP to validate approach and demonstrate value.

---

**Document Version:** 1.0  
**Last Updated:** December 19, 2025  
**Status:** Ready for Review

