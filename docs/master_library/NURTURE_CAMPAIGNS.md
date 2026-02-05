# FEATURE NAME: Lead Nurture Campaigns

## FILE PATH
`src/app/(dashboard)/nurture/page.tsx`

## AUDIT STATUS: PASS

All data is fetched from Firestore. No hard-coded mocks detected. Theme compliant with CSS variables.

---

## MANUAL SOP

### Purpose
Lead Nurture Campaigns enable automated, multi-step email sequences designed to warm up leads over time. Campaigns can be triggered by lead status changes, form submissions, or manual enrollment, and include sophisticated timing and personalization.

### Steps to Execute Manually

1. **Access Nurture Campaigns**
   - Navigate to `/dashboard` (Main Dashboard)
   - Click "Outbound" in the sidebar
   - Select "Nurture"
   - Alternatively, navigate to `/nurture`

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

4. **Configure Trigger**
   - Set enrollment trigger:
     - Lead status change
     - Form submission
     - Tag added
     - Manual enrollment
     - Segment membership

5. **Add Campaign Steps**
   - Click "Add Step"
   - Step types:
     - Send Email
     - Wait (delay)
     - Send SMS
     - Update Lead
     - Add Tag
     - Remove from campaign

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

8. **Set Exit Conditions**
   - Define when to remove leads:
     - Lead converts to deal
     - Lead unsubscribes
     - Lead replies
     - Manual removal

9. **Preview Campaign**
   - Click "Preview"
   - See visual flow of steps
   - Review timing calculations
   - Test with sample data

10. **Activate Campaign**
    - Click "Save & Activate"
    - Campaign begins processing
    - New triggers enroll leads

11. **Monitor Performance**
    - View campaign stats:
      - Enrolled count
      - Active count
      - Completed count
      - Unsubscribed count
    - Per-step metrics:
      - Sent count
      - Open rate
      - Click rate

12. **A/B Test Emails**
    - Create variant for any email step
    - Split traffic percentage
    - Track winning variant

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

**[Visual]:** Set exit condition panel. Check "Lead converts to deal".

**[Audio]:** "Smart exit conditions stop the sequence at the right moment. Lead converts? They exit automatically. No awkward 'still interested?' emails after they've bought."

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

*Last Audited: February 5, 2026*
