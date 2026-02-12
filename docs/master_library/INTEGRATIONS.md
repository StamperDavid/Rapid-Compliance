# FEATURE NAME: Integrations Hub

## FILE PATH
`src/app/(dashboard)/integrations/page.tsx`

## AUDIT STATUS: PASS

All data is fetched from Firestore. No hard-coded mocks detected. Theme compliant with CSS variables.

---

## MANUAL SOP

### Purpose
The Integrations Hub allows connecting SalesVelocity.ai with third-party services including email providers, calendars, accounting software, communication tools, and custom APIs. Integrations enable data sync and workflow automation across your tech stack.

### Steps to Execute Manually

1. **Access Integrations**
   - Navigate to `/dashboard` (Main Dashboard)
   - Click "Integrations" in the sidebar
   - Alternatively, navigate to `/integrations`

2. **Browse Available Integrations**
   - Integrations grouped by category:
     - **Email & Calendar**: Gmail, Outlook (Google and Microsoft OAuth)
     - **Communication**: Slack, Microsoft Teams
     - **Accounting**: QuickBooks
     - **Payment Processing**: Stripe (webhook-based)
     - **Webhooks**: Zapier and custom webhook endpoints

3. **Connect an Integration**
   - Click "Connect" on desired integration
   - OAuth flow initiates for supported services
   - Grant permissions when prompted
   - Return to SalesVelocity.ai

4. **Configure Integration**
   - After connecting, click "Configure"
   - Set sync options:
     - Sync frequency
     - Data directions (one-way/two-way)
     - Field mappings
     - Filters

5. **Email Integration Setup**
   - Connect Gmail or Outlook
   - Enable features:
     - Email tracking (opens/clicks)
     - Email sync (inbox/sent)
     - Send from platform
     - Calendar sync

6. **Calendar Integration Setup**
   - Connect Google or Outlook Calendar
   - Enable features:
     - Meeting sync
     - Availability detection
     - Auto-logging to contacts

7. **Slack Integration Setup**
   - Click "Connect to Slack"
   - Select workspace
   - Choose channels for notifications
   - Configure notification types

8. **Accounting Integration Setup**
   - Connect QuickBooks via OAuth
   - Map revenue to accounts
   - Enable invoice sync
   - Configure payment tracking

9. **Payment Integration Setup (Stripe)**
   - Stripe integration is webhook-based
   - Webhook endpoint: `/api/webhooks/stripe`
   - Handles payment events, subscription updates
   - Automatically syncs transaction data

10. **Test Integration**
    - Click "Test Connection"
    - Verify data flows correctly
    - Check for errors

11. **Disconnect Integration**
    - Click "Settings" on connected integration
    - Click "Disconnect"
    - Confirm disconnection
    - Data sync stops immediately

12. **View Sync Status**
    - Each integration shows:
      - Last sync time
      - Connection status
      - Health indicator

---

## VIDEO PRODUCTION SCRIPT

### Duration: 90 seconds

---

**[Visual]:** Multiple app icons floating disconnected. They connect with animated lines to SalesVelocity.ai logo in center.

**[Audio]:** "Your business runs on many tools. SalesVelocity.ai connects them all, turning scattered systems into one unified powerhouse."

---

**[Visual]:** Integrations hub loads. Cards show Gmail, Slack, Xero, Google Calendar with status indicators.

**[Audio]:** "The Integrations Hub shows everything at a glance. Connected services, sync status, last update time. Know your tech stack is working."

---

**[Visual]:** Click "Connect" on Gmail. OAuth popup appears. Permissions granted.

**[Audio]:** "Connecting is simple. Click, authorize, done. Gmail integration takes thirty seconds. Track opens, sync conversations, send directly from your CRM."

---

**[Visual]:** Click "Connect" on Slack. Workspace selector appears. Channel selection.

**[Audio]:** "Connect Slack and choose where notifications go. New deals, closed won, hot leads - your team stays informed in the channels they already use."

---

**[Visual]:** Configure panel shows sync settings. Toggle switches for different options.

**[Audio]:** "Configure exactly how data flows. One-way or two-way sync. Real-time or scheduled. You control the integration, not the other way around."

---

**[Visual]:** Dashboard showing sync activity log. Numbers counting up.

**[Audio]:** "Monitor sync health with detailed logs. See every record synced, catch errors early, maintain data integrity across all your systems."

---

**[Visual]:** Calendar showing meeting auto-logged to contact record.

**[Audio]:** "Calendar integration logs meetings automatically. Every touchpoint captured without manual data entry. Your CRM stays complete."

---

**[Visual]:** All integration cards showing green "Connected" badges. Data flowing between them.

**[Audio]:** "SalesVelocity.ai Integrations. One platform. Every tool. Perfectly connected."

---

## DATA DEPENDENCY

| Data Point | Firestore Path | Status |
|------------|----------------|--------|
| Integration Configs | `organizations/rapid-compliance-root/integrations/{integrationId}` | LIVE |
| OAuth Tokens | Encrypted storage within integration config | LIVE |
| Connection Status | Updated in integration document | LIVE |

**Note:** Subcollections for logs, tokens, or sync history may not be fully implemented yet. Current implementation stores connection metadata in the main integration document.

---

## Planned Features (Not Yet Implemented)

### Additional Integrations
- **CRM Import**: Salesforce, HubSpot data import wizards
- **Marketing**: Mailchimp, ActiveCampaign native integrations
- **Accounting**: Xero integration (currently only QuickBooks is available)
- **Voice**: Twilio, Vonage (basic SMS/voice capabilities may exist via API)
- **Payment**: PayPal integration (currently only Stripe)

### Enhanced Sync Features
- Detailed sync logs subcollection per integration
- Granular error tracking and retry mechanisms
- Advanced field mapping UI
- Two-way sync configuration for supported integrations

---

*Last Audited: February 12, 2026*
