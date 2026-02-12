# FEATURE NAME: Lead Nurture Campaigns

## FILE PATH
`src/app/(dashboard)/nurture/page.tsx`

## AUDIT STATUS: PASS

All data is fetched from Firestore. No hard-coded mocks detected. Theme compliant with CSS variables.

---

## MANUAL SOP

### Purpose
Lead Nurture Campaigns enable automated, multi-step email sequences designed to warm up leads over time. The current implementation supports email-only workflows with timing delays and manual enrollment.

### Steps to Execute Manually

1. **Access Nurture Campaigns**
   - Navigate to `/(dashboard)` (Main Dashboard)
   - Click "Outbound" in the sidebar
   - Select "Nurture"
   - Alternatively, navigate to `/(dashboard)/nurture`

2. **View Campaign List**
   - Campaigns display as cards
   - Each card shows:
     - Campaign name
     - Status (Active/Paused/Draft)
     - Steps count
     - Leads enrolled
     - Open rate
     - Click rate

3. **Create New Campaign**
   - Click "New Campaign"
   - Enter campaign name
   - Select campaign type:
     - Welcome sequence
     - Re-engagement
     - Product education
     - Custom

4. **Configure Enrollment**
   - Current implementation supports:
     - Manual enrollment

5. **Add Campaign Steps**
   - Click "Add Step"
   - Step types available:
     - Send Email
     - Wait (delay)

6. **Configure Email Steps**
   - Select email template
   - Or write custom email
   - Set subject line
   - Add personalization tokens:
     - {{firstName}}
     - {{company}}
     - {{customField}}

7. **Configure Wait Steps**
   - Set delay duration:
     - Hours
     - Days
     - Business days only
   - Set specific time of day

8. **Preview Campaign**
   - Click "Preview"
   - See visual flow of steps
   - Review timing calculations
   - Test with sample data

9. **Activate Campaign**
    - Click "Save & Activate"
    - Campaign begins processing
    - Manually enroll leads to start sequences

10. **Monitor Performance**
    - View campaign stats:
      - Enrolled count
      - Active count
      - Completed count
      - Unsubscribed count
    - Per-step metrics:
      - Sent count
      - Open rate
      - Click rate

---

## VIDEO PRODUCTION SCRIPT

### Duration: 90 seconds

---

**[Visual]:** Lead enters system. Calendar pages flip. Automated emails send. Lead converts.

**[Audio]:** "Not every lead is ready to buy today. Nurture campaigns keep them warm until they are - automatically."

---

**[Visual]:** Nurture campaigns list shows active campaigns with metrics.

**[Audio]:** "See all your campaigns at a glance. Active sequences, enrolled leads, performance metrics. Know what's running and how it's performing."

---

**[Visual]:** Click "New Campaign". Builder interface opens. Drag email step onto canvas.

**[Audio]:** "Build sequences with drag and drop. Add emails, waits, and actions. Create a journey that guides leads from curious to committed."

---

**[Visual]:** Configure email step. Template selector shows options. Personalization tokens highlighted.

**[Audio]:** "Personalize every message with dynamic tokens. First name, company name, custom fields. Each lead feels like it's written just for them."

---

**[Visual]:** Add wait step. Configure for 3 days. Add another email.

**[Audio]:** "Control timing precisely. Wait three days between touches. Send at optimal times. Respect your leads' attention while staying top of mind."

---

**[Visual]:** Campaign stats dashboard. Funnel showing enrolled → opened → clicked → converted.

**[Audio]:** "Track the entire journey. See how many leads enter, engage, and convert. Identify which steps work and which need optimization."

---

**[Visual]:** Logo with nurture plant growing icon.

**[Audio]:** "SalesVelocity.ai Nurture Campaigns. Plant seeds. Grow relationships. Harvest revenue."

---

## DATA DEPENDENCY

| Data Point | Firestore Path | Status |
|------------|----------------|--------|
| Campaign Definitions | `organizations/rapid-compliance-root/nurtureSequences/{sequenceId}` | LIVE |
| Campaign Steps | `organizations/rapid-compliance-root/nurtureSequences/{sequenceId}/steps` | LIVE |
| Enrolled Leads | `organizations/rapid-compliance-root/nurtureSequences/{sequenceId}/enrollments` | LIVE |
| Email Templates | `organizations/rapid-compliance-root/emailTemplates` | LIVE |
| Campaign Analytics | `organizations/rapid-compliance-root/nurtureSequences/{sequenceId}/analytics` | LIVE |

---

## Planned Features (Not Yet Implemented)

- **SMS Steps** - Send SMS messages as part of nurture sequences
- **Task Steps** - Create tasks for sales team as part of automation
- **Exit Conditions** - Smart removal of leads when they convert, unsubscribe, or reply
- **A/B Testing** - Create email variants and track winning performance
- **Trigger-Based Enrollment** - Auto-enroll leads based on status changes, form submissions, tags, or segment membership
- **Additional Step Actions** - Update lead fields, add/remove tags, and custom actions within sequences

---

*Last Audited: February 12, 2026*
