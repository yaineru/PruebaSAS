# FASE 2 Integration Guide

## Quick Start for New Features

### 1. Email Preferences Page
**URL:** `/settings/email-preferences`

Users can now:
- Enable/disable notifications for 8 different event types
- Choose frequency: Immediate, Daily Digest, or Weekly Digest
- View all their active subscriptions

**For Developers:**
```typescript
// Trigger email notification when event occurs
import { trackAnalyticsEvent } from "@/lib/actions/notifications";

await trackAnalyticsEvent({
  eventName: "REPORT_GENERATED",
  eventCategory: "reports",
  properties: { reportId: "abc123", rowCount: 1000 }
});
```

---

### 2. Webhooks Management Page
**URL:** `/settings/webhooks` (Admin only)

Admins can:
- Create webhooks with name, URL, and event subscriptions
- View all active webhooks with their secrets
- Copy webhook secrets to clipboard
- Delete webhooks (soft-delete)

**Webhook Payload Example:**
```json
{
  "event": "REPORT_GENERATED",
  "timestamp": "2025-02-24T10:30:00Z",
  "data": {
    "reportId": "abc123",
    "reportType": "ASSETS",
    "rowCount": 1500
  },
  "signature": "sha256=hmac_signature_here"
}
```

**Validating Webhook Signature (Node.js Example):**
```javascript
const crypto = require('crypto');
const secret = 'webhook-secret-from-settings';
const payload = JSON.stringify(req.body);
const expectedSignature = crypto
  .createHmac('sha256', secret)
  .update(payload)
  .digest('hex');

if (expectedSignature !== req.headers['x-cafelindo-signature']) {
  return res.status(401).send('Unauthorized');
}
```

---

### 3. Analytics Dashboard
**URL:** `/analytics`

Shows:
- **KPI Cards:** Total reports, incidents, active users, maintenance completed
- **Timeline Charts:** Reports generated over last 30 days
- **Features Tab:** Most used features by usage count
- **Engagement Tab:** User statistics and session metrics

**Data Available:**
- 30-day history for all metrics
- Real-time metrics update
- Breakdown by event type

---

### 4. CSV Export
**Usage in Components:**

```typescript
import { downloadCSV } from "@/lib/csv-export";

// When user clicks "Download CSV" button
const handleDownload = () => {
  const data = [
    { id: 1, name: "Asset A", status: "Active" },
    { id: 2, name: "Asset B", status: "Inactive" }
  ];
  
  downloadCSV(data, "assets.csv", ["id", "name", "status"]);
};
```

**Features:**
- Proper Excel encoding (UTF-8 BOM)
- Automatic special character escaping
- Works in all modern browsers
- Automatic file cleanup after download

---

### 5. API Documentation
**URL:** `/api/docs`

Interactive Swagger UI with:
- Request/response examples for all endpoints
- Try-it-out functionality
- Authentication details
- Error responses

**OpenAPI Spec:** Available at `/api/openapi.json`

---

## Database Schema Changes

### New Tables (6 total):

#### email_subscriptions
```sql
- id (uuid, primary key)
- company_id (uuid, foreign key)
- user_id (uuid, foreign key)
- event_type (text: REPORT_GENERATED, etc)
- enabled (boolean)
- frequency (text: IMMEDIATE, DAILY_DIGEST, WEEKLY_DIGEST)
- last_sent_at (timestamp)
- created_at (timestamp)
- updated_at (timestamp)
```

#### email_logs
```sql
- id (uuid, primary key)
- company_id (uuid)
- user_id (uuid)
- event_type (text)
- subject (text)
- recipient_email (text)
- status (text: SENT, FAILED, BOUNCED)
- error_message (text, nullable)
- sent_at (timestamp)
```

#### webhooks
```sql
- id (uuid, primary key)
- company_id (uuid)
- created_by (uuid)
- name (text)
- url (text)
- secret (text, unique)
- events (text array)
- active (boolean)
- retry_count (integer)
- timeout_seconds (integer)
- created_at (timestamp)
- updated_at (timestamp)
```

#### webhook_deliveries
```sql
- id (uuid, primary key)
- webhook_id (uuid)
- event_type (text)
- payload (jsonb)
- status (text: PENDING, DELIVERED, FAILED)
- response_status_code (integer)
- response_body (text)
- attempt_count (integer)
- next_retry_at (timestamp)
- created_at (timestamp)
```

#### analytics_events
```sql
- id (uuid, primary key)
- company_id (uuid)
- user_id (uuid)
- event_name (text: REPORT_GENERATED, ASSET_CREATED, etc)
- event_category (text: reports, assets, etc)
- properties (jsonb)
- page_url (text)
- user_agent (text)
- ip_address (text)
- created_at (timestamp)
```

#### analytics_metrics
```sql
- id (uuid, primary key)
- company_id (uuid)
- metric_name (text)
- metric_date (date)
- metric_value (integer)
- created_at (timestamp)
```

---

## Migration Instructions

### Step 1: Apply Database Migrations

Run these migrations in order:

```bash
# In Supabase SQL Editor or via migration tool
-- First run: supabase/migrations/005_industry_templates.sql
-- Then run: supabase/migrations/006_email_webhooks_analytics.sql
```

### Step 2: Verify Routes Accessible

- [ ] Visit `/settings/email-preferences` - should load
- [ ] Visit `/settings/webhooks` - should be admin-only
- [ ] Visit `/analytics` - should show empty dashboard
- [ ] Visit `/api/docs` - should show Swagger UI

### Step 3: Test Features

**Email Subscriptions:**
1. Go to `/settings/email-preferences`
2. Toggle some subscriptions ON
3. Change frequency for one event
4. Should see "Subscription updated" message

**Webhooks (Admin):**
1. Go to `/settings/webhooks`
2. Create test webhook: `https://webhook.site/your-unique-id`
3. Select events and submit
4. Should see webhook in list with secret
5. Copy secret and test with Webhook.site

**Analytics:**
1. Go to `/analytics`
2. Dashboard loads with available metrics
3. Timeline shows any tracked events
4. Will populate as events are tracked

---

## Event Types Reference

### Email Notification Events (8 total):

1. **REPORT_GENERATED** - When a report finishes generating
2. **MAINTENANCE_DUE** - When maintenance is due soon
3. **INCIDENT_CREATED** - When an incident is created
4. **DOCUMENT_EXPIRING** - When document expiration date approaches
5. **MAINTENANCE_COMPLETED** - When maintenance is completed
6. **INCIDENT_RESOLVED** - When an incident is resolved
7. **PROJECT_MILESTONE** - When a project reaches a milestone
8. **USER_INVITED** - When a new user is invited

### Analytics Metric Names:

1. **REPORTS_GENERATED** - Count of reports created
2. **INCIDENTS_CREATED** - Count of incidents created
3. **USERS_ACTIVE** - Daily active user count
4. **MAINTENANCE_COMPLETED** - Count of completed maintenance

---

## Security Considerations

### Email Subscriptions:
- ✅ RLS policies ensure users only see their own subscriptions
- ✅ Rate-limited to 30 requests/minute per user
- ✅ Company isolation via company_id

### Webhooks:
- ✅ Admin-only access via role validation
- ✅ HMAC-SHA256 signing on all payloads
- ✅ Secret rotation recommended every 90 days
- ✅ Webhook logs tracked for audit trail

### Analytics:
- ✅ Company-isolated metrics
- ✅ Events include user agent and IP (for analytics)
- ✅ PII fields are optional in properties object

---

## Troubleshooting

### Email Preferences Page 404
**Solution:** Ensure database migration `006_email_webhooks_analytics.sql` was applied

### Webhooks Page Shows "Insufficient permissions"
**Solution:** Only ADMIN role can access. Check user role in auth system

### Analytics Dashboard Empty
**Solution:** Dashboard shows data as events are tracked. Check `analytics_events` table has entries

### Webhook Secret Not Displaying
**Solution:** Click the Eye icon to toggle visibility. Copy button should work regardless

### CSV Download Not Working
**Solution:** Check browser console for errors. Verify report data exists before export

---

## Configuration

### Rate Limiting:
- Email subscriptions: 30 requests/minute
- Webhooks create/delete: 10 requests/minute (ADMIN only)
- Analytics tracking: 100 requests/minute per user

### Webhook Retry Logic:
- Max retries: 3 attempts
- Initial timeout: 10 seconds
- Retry backoff: Exponential (future enhancement)

### Analytics Aggregation:
- Daily metrics calculated at midnight UTC
- Events stored immediately, metrics computed async
- 30-day retention for detailed events, unlimited for metrics

---

## API Endpoint Reference

### Email Subscriptions
```
GET /api/notifications/subscriptions     - List user subscriptions
PUT /api/notifications/subscriptions     - Update subscription
```

### Webhooks
```
GET /api/webhooks                        - List webhooks (admin)
POST /api/webhooks                       - Create webhook (admin)
DELETE /api/webhooks/:id                 - Delete webhook (admin)
```

### Reports (Existing - now with CSV)
```
POST /api/reports/generate               - Generate report
GET /api/reports/:id                     - Get report details
DELETE /api/reports/:id                  - Delete report
```

### Analytics
```
GET /api/analytics/metrics               - Get metrics (with filters)
```

---

## Performance Notes

- Analytics aggregation runs asynchronously
- Webhook deliveries use background job queue
- Email digests collected in batches
- Database indexes on company_id and date fields

---

## Next: Manual Verification Steps

1. **Check Database:**
   ```sql
   SELECT COUNT(*) FROM email_subscriptions;
   SELECT COUNT(*) FROM webhooks;
   SELECT COUNT(*) FROM analytics_events;
   ```

2. **Verify Component Imports:**
   - All new components properly export
   - No circular dependency issues

3. **Test Email Subscription Flow:**
   - User toggles subscription
   - Data persists in database
   - UI updates reflect new state

4. **Test Webhook Creation:**
   - Secret is unique per webhook
   - URL validation prevents invalid URLs
   - Events array persists correctly

5. **Verify Analytics Dashboard:**
   - Loads without errors
   - Charts render correctly
   - Metrics aggregate properly
