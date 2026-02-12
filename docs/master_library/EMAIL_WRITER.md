# FEATURE NAME: AI Email Writer

## FILE PATH
`src/app/(dashboard)/email-writer/page.tsx`

## AUDIT STATUS: PASS

All data is fetched from Firestore. No hard-coded mocks detected. Theme compliant with CSS variables.

---

## MANUAL SOP

### Purpose
The AI Email Writer has TWO implementations:
1. **Standalone Email Writer** (`/email-writer`): A dedicated page for composing individual sales emails using AI
2. **Nurture Campaign Email Steps** (`/outbound/nurture`): Email generation as part of multi-step nurture sequences

Both implementations use the same AI engine to generate personalized sales emails using deal data, battlecards, and contact information to create contextually relevant messages that drive responses.

### Steps to Execute Manually

1. **Access Email Writer**
   - Navigate to `/dashboard` (Main Dashboard)
   - Click "Outbound" in the sidebar
   - Select "Email Writer"
   - Alternatively, navigate to `/email-writer`

2. **Select Email Type**
   - Choose from 5 template types:
     - **Intro**: First contact with prospect
     - **Follow-up**: After initial contact or meeting
     - **Proposal**: Sending proposal/pricing
     - **Close**: Final push before decision
     - **Re-engagement**: Revive cold/stalled deals

3. **Select Recipient**
   - Search for contact by name or email
   - System loads:
     - Contact information
     - Company details
     - Past interactions
     - Associated deals

4. **Link to Deal (Optional)**
   - Select associated deal if applicable
   - Email Writer loads:
     - Deal value and stage
     - Previous emails in thread

5. **Generate AI Draft**
   - Click "Generate Email"
   - AI analyzes context:
     - Contact's role and industry
     - Deal stage and history
     - Your brand voice
   - Draft appears in editor

6. **Review and Edit**
   - AI draft appears in rich text editor
   - Edit subject line
   - Personalize content
   - Add or remove sections
   - Check tone alignment

7. **Preview Email**
   - Click "Preview"
   - See exactly how recipient sees it
   - Check formatting on mobile
   - Verify personalization tokens

8. **Send Email**
   - Click "Send Now" or "Schedule"
   - If scheduling, select date/time
   - Email queues for delivery

9. **Track Performance**
   - View email in history
   - Monitor:
     - Open rate
     - Click rate
     - Reply received
     - Meeting booked

---

## VIDEO PRODUCTION SCRIPT

### Duration: 90 seconds

---

**[Visual]:** Blank email compose window. Cursor blinks in empty subject line.

**[Audio]:** "Staring at a blank email is the enemy of productivity. Let SalesVelocity.ai write it for you."

---

**[Visual]:** Template selector shows 5 options. Click "Follow-up". Contact search bar appears.

**[Audio]:** "Choose your email type and select a contact. The AI already knows your history with them - every call, every meeting, every email exchanged."

---

**[Visual]:** Contact card loads showing name, company, past interactions. "Generate" button pulses.

**[Audio]:** "One click, and AI generates a personalized draft. Not generic templates - truly personalized content based on your specific relationship."

---

**[Visual]:** Email draft fills in. Subject line: "Quick follow-up on your Q2 goals, Sarah". Body shows personalized content.

**[Audio]:** "The email references your last conversation, addresses Sarah's specific challenges, and proposes a concrete next step. All in seconds."

---


**[Visual]:** Click "Send". Email whooshes away. Analytics dashboard shows email tracked.

**[Audio]:** "Send with confidence. Track opens, clicks, and replies in real time. Know the moment Sarah engages."

---

**[Visual]:** Logo with envelope icon morphing into handshake.

**[Audio]:** "SalesVelocity.ai Email Writer. Every email, personalized. Every send, strategic."

---

## DATA DEPENDENCY

| Data Point | Firestore Path | Status |
|------------|----------------|--------|
| Email Templates | `organizations/rapid-compliance-root/emailTemplates` | LIVE |
| Contact Data | `organizations/rapid-compliance-root/workspaces/{wsId}/entities/contacts/records` | LIVE |
| Deal Data | `organizations/rapid-compliance-root/workspaces/{wsId}/entities/deals/records` | LIVE |
| Battlecards | `organizations/rapid-compliance-root/battlecards` | LIVE |
| Email History | `organizations/rapid-compliance-root/emailCampaigns` | LIVE |
| Performance Metrics | `organizations/rapid-compliance-root/emailAnalytics` | LIVE |

---

## Planned Features (Not Yet Implemented)

- **Battlecard Integration**: Automatic competitor positioning data from battlecards
- **A/B Testing**: Create email variants and track performance comparison
- **Multi-variant Generation**: Generate multiple versions in one click

---

*Last Updated: February 12, 2026*
