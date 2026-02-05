# FEATURE NAME: Living Ledger - Deal Intelligence Dashboard

## FILE PATH
`src/app/admin/living-ledger/page.tsx`

## AUDIT STATUS: FAIL

**Failure Reasons:**
- Hard-coded mocks detected: Three mock deals with specific values (lines 53-91):
  - "Q1 2024 Enterprise Contract - Acme Corp" ($125,000)
  - "Startup Package - TechFlow" ($50,000)
  - "Consulting Services - Global Industries" ($200,000)

---

## MANUAL SOP

### Purpose
The Living Ledger is a real-time deal intelligence dashboard that provides a unified view of all active deals, their stages, values, and key metrics. It serves as the "single source of truth" for pipeline and revenue forecasting.

### Steps to Execute Manually

1. **Access the Living Ledger**
   - Navigate to `/admin` (Admin Command Center)
   - Click "CRM" in the sidebar navigation
   - Select "Living Ledger" from submenu
   - Alternatively, navigate directly to `/admin/living-ledger`

2. **Review Pipeline Overview**
   - Locate the pipeline summary at the top
   - Review total pipeline value (sum of all open deals)
   - Check deal count by stage
   - Note weighted forecast (value × probability)

3. **Browse Active Deals**
   - Scroll to the deals table
   - Each row shows:
     - Deal name and company
     - Current stage (Prospecting → Qualification → Proposal → Negotiation → Won/Lost)
     - Deal value
     - Close probability
     - Expected close date
     - Deal owner

4. **Filter and Sort Deals**
   - Use filter dropdowns to narrow by:
     - Stage
     - Owner
     - Date range
     - Value range
   - Click column headers to sort

5. **View Deal Details**
   - Click any deal row to expand
   - Review full deal history
   - Check associated contacts
   - View activity timeline
   - Access linked documents (proposals, contracts)

6. **Update Deal Information**
   - Click "Edit" on any deal
   - Update stage, value, or probability
   - Add notes or next steps
   - Save changes (syncs to Firestore)

7. **Generate Reports**
   - Click "Export" button
   - Select format (CSV, PDF)
   - Choose date range
   - Download pipeline report

---

## VIDEO PRODUCTION SCRIPT

### Duration: 90 seconds

---

**[Visual]:** Animated deal cards flowing like a ledger book. Transition to Living Ledger dashboard.

**[Audio]:** "Every great sales organization runs on accurate deal data. The Living Ledger gives you that data - alive, accurate, and always up to date."

---

**[Visual]:** Pipeline overview section with animated value counters. Stage bars fill up to show distribution.

**[Audio]:** "See your entire pipeline at a glance. Total value, deals by stage, weighted forecast. No spreadsheets, no manual updates - just real-time intelligence."

---

**[Visual]:** Scroll through deals table. Highlight different deal stages with color coding.

**[Audio]:** "Every deal tells a story. From first contact to closed won, track the journey with complete transparency. Know exactly where each opportunity stands."

---

**[Visual]:** Click on a deal row. Detail panel expands showing activity timeline.

**[Audio]:** "Drill into any deal to see the full picture: every email, every call, every meeting. Your AI agents log everything automatically, so nothing falls through the cracks."

---

**[Visual]:** Mouse clicks filter dropdown, selects "Negotiation" stage. Table updates to show filtered deals.

**[Audio]:** "Focus on what matters most. Filter by stage to see deals ready to close. Filter by owner to review team performance. The data shapes itself to your questions."

---

**[Visual]:** Export button clicked, PDF downloading animation.

**[Audio]:** "Need a report for the board? One click exports your pipeline to PDF or CSV. Professional, accurate, instant."

---

**[Visual]:** Logo with tagline "SalesVelocity.ai - Know Your Numbers"

**[Audio]:** "SalesVelocity.ai Living Ledger. Because guessing isn't a strategy."

---

## DATA DEPENDENCY

| Data Point | Firestore Path | Current Status |
|------------|----------------|----------------|
| Deals List | `organizations/rapid-compliance-root/workspaces/{wsId}/entities/deals/records` | **MOCKED** - Using hardcoded array |
| Pipeline Value | Calculated from deals | **MOCKED** - Derived from mock data |
| Stage Distribution | Aggregated from deals | **MOCKED** - Derived from mock data |
| Deal Activities | `organizations/rapid-compliance-root/conversations` linked by dealId | Needs implementation |

### Required Fix
```typescript
// Replace mock deals with Firestore query
const deals = await firestore
  .collection(`organizations/${DEFAULT_ORG_ID}/workspaces/${wsId}/entities/deals/records`)
  .orderBy('updatedAt', 'desc')
  .get();

// Calculate metrics from live data
const pipelineValue = deals.reduce((sum, deal) => sum + deal.value, 0);
const stageDistribution = deals.reduce((acc, deal) => {
  acc[deal.stage] = (acc[deal.stage] || 0) + 1;
  return acc;
}, {});
```

---

*Last Audited: February 5, 2026*
