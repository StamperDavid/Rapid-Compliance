# FEATURE NAME: Leads Management

## FILE PATH
`src/app/(dashboard)/leads/page.tsx`

## AUDIT STATUS: PASS

All data is fetched from Firestore. No hard-coded mocks detected. Theme compliant with CSS variables.

---

## MANUAL SOP

### Purpose
The Leads Management module is the central hub for tracking and nurturing potential customers. It provides a comprehensive view of all leads with filtering, scoring, and quick actions for sales follow-up.

### Steps to Execute Manually

1. **Access Leads**
   - Navigate to `/dashboard` (Main Dashboard)
   - Click "Leads" in the CRM section of the sidebar
   - Alternatively, navigate directly to `/leads`

2. **View Lead List**
   - Leads display in a searchable table
   - Default sort: Most recently updated first
   - Each row shows:
     - Lead name and company
     - Email and phone
     - Status (New, Contacted, Qualified, Converted)
     - Lead score (Hot/Warm/Cold badge)
     - Created date
     - Assigned owner

3. **Filter Leads**
   - Use status filter tabs: All | New | Contacted | Qualified | Converted
   - Use search bar to find by name, email, or company
   - Click column headers to sort

4. **View Lead Details**
   - Click any lead row
   - Full profile opens with:
     - Contact information
     - Company details
     - Activity timeline
     - Notes and tags
     - Lead score breakdown

5. **Create New Lead**
   - Click "New Lead" button (top right)
   - Fill in required fields:
     - Name (required)
     - Email (required)
     - Phone (optional)
     - Company (optional)
   - Click "Create" to save

6. **Edit Lead**
   - Click lead row to open details
   - Click "Edit" button
   - Update any fields
   - Click "Save" to persist changes

7. **Change Lead Status**
   - From lead details, click status dropdown
   - Select new status
   - Status change logs automatically

8. **Assign Lead**
   - From lead details, click "Owner" field
   - Select team member from dropdown
   - Assignment notification sent automatically

9. **Add Notes**
   - In lead details, scroll to Notes section
   - Click "Add Note"
   - Type note content
   - Click "Save" (timestamped automatically)

10. **Convert Lead to Deal**
    - From qualified lead, click "Convert to Deal"
    - Enter deal value and stage
    - Lead status changes to "Converted"
    - New deal created in pipeline

---

## VIDEO PRODUCTION SCRIPT

### Duration: 90 seconds

---

**[Visual]:** Empty leads list transforms to full table with leads populating. Animation shows leads arriving.

**[Audio]:** "Every customer journey starts with a lead. SalesVelocity.ai helps you capture, track, and convert them like never before."

---

**[Visual]:** Lead list with color-coded score badges (red=hot, yellow=warm, blue=cold). Mouse hovers over hot lead.

**[Audio]:** "AI-powered lead scoring tells you who's ready to buy. Hot leads bubble to the top. No more guessing who to call first."

---

**[Visual]:** Search bar typing "enterprise". List filters in real-time. Status tabs click through.

**[Audio]:** "Find any lead in seconds. Search by name, company, or email. Filter by status to focus on what matters."

---

**[Visual]:** Click lead row. Detail panel slides in showing full profile with timeline.

**[Audio]:** "Every lead tells a story. See the complete picture: contact info, company details, every interaction logged automatically by your AI workforce."

---

**[Visual]:** Mouse clicks "Convert to Deal". Modal appears. Deal created with confetti animation.

**[Audio]:** "When a lead is ready, one click converts them to a deal. Your pipeline grows, your metrics update, and the sales cycle continues seamlessly."

---

**[Visual]:** Dashboard zooms out showing leads, deals, and revenue connected by flowing lines.

**[Audio]:** "From first touch to closed won, SalesVelocity.ai keeps every lead moving forward."

---

**[Visual]:** Logo with tagline "No Lead Left Behind"

**[Audio]:** "SalesVelocity.ai - No lead left behind."

---

## DATA DEPENDENCY

| Data Point | Firestore Path | Status |
|------------|----------------|--------|
| Lead Records | `organizations/rapid-compliance-root/workspaces/{wsId}/entities/leads/records` | LIVE |
| Lead Schema | `organizations/rapid-compliance-root/workspaces/{wsId}/schemas/leads` | LIVE |
| Lead Scores | Calculated by `LEAD_QUALIFIER` specialist agent | LIVE |
| Activity Log | `organizations/rapid-compliance-root/conversations` filtered by leadId | LIVE |

---

*Last Audited: February 5, 2026*
