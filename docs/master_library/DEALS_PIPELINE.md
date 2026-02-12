# FEATURE NAME: Deals Pipeline

## FILE PATH
`src/app/(dashboard)/deals/page.tsx`

## AUDIT STATUS: PASS

All data is fetched from Firestore. No hard-coded mocks detected. Theme compliant with CSS variables.

---

## MANUAL SOP

### Purpose
The Deals Pipeline provides a table/list view of all sales opportunities organized by stage. It enables sales teams to track deal progress, forecast revenue, and identify bottlenecks in the sales process.

### Steps to Execute Manually

1. **Access Deals Pipeline**
   - Navigate to `/(dashboard)` (Main Dashboard)
   - Click "Deals" in the CRM section of the sidebar
   - Alternatively, navigate directly to `/(dashboard)/deals`

2. **View Pipeline (List Mode)**
   - Default view displays deals in a sortable table
   - Columns: Name, Company, Value, Stage, Probability, Close Date, Owner
   - Deals organized by stage:
     - Prospecting
     - Qualification
     - Proposal
     - Negotiation
     - Closed Won
     - Closed Lost

3. **Review Stage Metrics**
   - Summary metrics display:
     - Deal count per stage
     - Total value per stage
     - Pipeline health indicators

4. **Move Deal Between Stages**
   - Click stage dropdown in list view
   - Select new stage
   - Movement logged automatically

5. **Create New Deal**
   - Click "New Deal" button
   - Fill required fields:
     - Deal name (required)
     - Company (required)
     - Value (required)
     - Stage (default: Prospecting)
     - Probability (manually set)
     - Expected close date
   - Click "Create" to save

6. **View Deal Details**
   - Click any deal row
   - Full details panel shows:
     - Deal information
     - Associated contacts
     - Activity timeline
     - Documents (proposals, contracts)
     - Notes

7. **Update Deal Value**
   - In deal details, click value field
   - Enter new amount
   - Save changes

8. **Set Close Probability**
   - Probability is manually set per deal
   - Common values by stage:
     - Prospecting: 10%
     - Qualification: 25%
     - Proposal: 50%
     - Negotiation: 75%
     - Closed Won: 100%
     - Closed Lost: 0%

9. **Link Contacts to Deal**
    - In deal details, click "Add Contact"
    - Search and select from existing contacts
    - Contacts linked to deal (roles not currently implemented)

10. **Generate Forecast**
    - Pipeline value shows at top
    - Weighted forecast = Sum(Value × Probability)
    - View by time period (This Month, This Quarter)

---

## VIDEO PRODUCTION SCRIPT

### Duration: 120 seconds

---

**[Visual]:** Bird's eye view of deals table. Deals populate with values and stages.

**[Audio]:** "Your sales pipeline is the heartbeat of your business. With SalesVelocity.ai, you see every deal, every stage, every opportunity - all in one powerful view."

---

**[Visual]:** Zoom in on deals table. Six stages visible with deal rows organized.

**[Audio]:** "The pipeline view makes deal management clear. Prospecting, Qualification, Proposal, Negotiation - track your deals from first touch to closed won."

---

**[Visual]:** Mouse clicks stage dropdown on a deal. Changes from Qualification to Proposal.

**[Audio]:** "Moving deals is as simple as selecting a new stage. Changes log automatically, and your forecast recalculates in real time."

---

**[Visual]:** Summary metrics highlight - showing deal count and total value per stage.

**[Audio]:** "Pipeline metrics show health at a glance: total value, number of deals per stage. Instantly see where deals are concentrated and what's moving forward."

---

**[Visual]:** Click on a high-value deal. Detail panel slides in showing full information.

**[Audio]:** "Dive into any deal to see the complete story. Every contact involved, every meeting scheduled, every document exchanged - all automatically captured by your AI workforce."

---

**[Visual]:** Forecast numbers at top animate. Show weighted vs. total pipeline.

**[Audio]:** "Forecasting becomes reliable. Weighted pipeline shows what you can actually expect to close, not just what's in the funnel. Board meetings just got a lot easier."

---


**[Visual]:** Logo with revenue chart trending upward.

**[Audio]:** "SalesVelocity.ai Deals Pipeline. See the future of your revenue."

---

## DATA DEPENDENCY

| Data Point | Firestore Path | Status |
|------------|----------------|--------|
| Deal Records | `organizations/rapid-compliance-root/workspaces/{wsId}/entities/deals/records` | LIVE |
| Deal Schema | `organizations/rapid-compliance-root/workspaces/{wsId}/schemas/deals` | LIVE |
| Associated Contacts | Linked via contactIds array in deal document | LIVE |
| Activity Timeline | `organizations/rapid-compliance-root/workspaces/{wsId}/entities/deals/records/{dealId}/activities` | LIVE |
| Documents | `organizations/rapid-compliance-root/documents` linked by dealId | LIVE |

---

## Planned Features (Not Yet Implemented)

- **Drag-and-Drop Kanban Board** - Visual Kanban interface with drag-and-drop deal movement between stage columns
- **Automatic Probability Calculation** - Auto-set probability percentages based on stage changes
- **Contact Roles on Deals** - Ability to assign specific roles (Decision Maker, Influencer, Champion) to contacts linked to deals
- **Average Time in Stage Metrics** - Analytics showing how long deals typically spend in each stage

---

*Last Audited: February 12, 2026*
