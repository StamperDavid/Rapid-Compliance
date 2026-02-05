# FEATURE NAME: Deals Pipeline (Kanban View)

## FILE PATH
`src/app/(dashboard)/deals/page.tsx`

## AUDIT STATUS: PASS

All data is fetched from Firestore. No hard-coded mocks detected. Theme compliant with CSS variables.

---

## MANUAL SOP

### Purpose
The Deals Pipeline provides a visual Kanban-style view of all sales opportunities organized by stage. It enables sales teams to track deal progress, forecast revenue, and identify bottlenecks in the sales process.

### Steps to Execute Manually

1. **Access Deals Pipeline**
   - Navigate to `/dashboard` (Main Dashboard)
   - Click "Deals" in the CRM section of the sidebar
   - Alternatively, navigate directly to `/deals`

2. **View Pipeline (Kanban Mode)**
   - Default view shows Kanban board with 6 columns:
     - Prospecting
     - Qualification
     - Proposal
     - Negotiation
     - Closed Won
     - Closed Lost
   - Each deal appears as a card in its current stage

3. **View Pipeline (List Mode)**
   - Click "List View" toggle (top right)
   - Deals display in sortable table
   - Columns: Name, Company, Value, Stage, Probability, Close Date, Owner

4. **Review Stage Metrics**
   - Top of each column shows:
     - Deal count in stage
     - Total value in stage
     - Average time in stage

5. **Move Deal Between Stages**
   - Kanban: Drag deal card to new column
   - List: Click stage dropdown, select new stage
   - Movement logged automatically

6. **Create New Deal**
   - Click "New Deal" button
   - Fill required fields:
     - Deal name (required)
     - Company (required)
     - Value (required)
     - Stage (default: Prospecting)
     - Probability (auto-set based on stage)
     - Expected close date
   - Click "Create" to save

7. **View Deal Details**
   - Click any deal card/row
   - Full details panel shows:
     - Deal information
     - Associated contacts
     - Activity timeline
     - Documents (proposals, contracts)
     - Notes

8. **Update Deal Value**
   - In deal details, click value field
   - Enter new amount
   - Save changes

9. **Set Close Probability**
   - Auto-calculated based on stage:
     - Prospecting: 10%
     - Qualification: 25%
     - Proposal: 50%
     - Negotiation: 75%
     - Closed Won: 100%
     - Closed Lost: 0%
   - Can override manually per deal

10. **Link Contacts to Deal**
    - In deal details, click "Add Contact"
    - Search and select from existing contacts
    - Assign role (Decision Maker, Influencer, Champion)

11. **Generate Forecast**
    - Pipeline value shows at top
    - Weighted forecast = Sum(Value × Probability)
    - View by time period (This Month, This Quarter)

---

## VIDEO PRODUCTION SCRIPT

### Duration: 120 seconds

---

**[Visual]:** Bird's eye view of Kanban board. Deals animate flowing left to right through stages.

**[Audio]:** "Your sales pipeline is the heartbeat of your business. With SalesVelocity.ai, you see every deal, every stage, every opportunity - all in one powerful view."

---

**[Visual]:** Zoom in on Kanban board. Six columns visible with deal cards.

**[Audio]:** "The Kanban view makes pipeline management visual. Prospecting, Qualification, Proposal, Negotiation - watch your deals progress from first touch to closed won."

---

**[Visual]:** Mouse drags deal card from Qualification to Proposal. Card animates into new column.

**[Audio]:** "Moving deals is as simple as drag and drop. Stage changes log automatically, probabilities update, and your forecast recalculates in real time."

---

**[Visual]:** Stage metrics highlight - showing deal count and total value per stage.

**[Audio]:** "Each stage shows its health: total value, number of deals, and average time. Instantly see where deals are flowing smoothly and where they're getting stuck."

---

**[Visual]:** Click on a high-value deal. Detail panel slides in showing full information.

**[Audio]:** "Dive into any deal to see the complete story. Every contact involved, every meeting scheduled, every document exchanged - all automatically captured by your AI workforce."

---

**[Visual]:** Forecast numbers at top animate. Show weighted vs. total pipeline.

**[Audio]:** "Forecasting becomes reliable. Weighted pipeline shows what you can actually expect to close, not just what's in the funnel. Board meetings just got a lot easier."

---

**[Visual]:** Toggle to List View. Table appears with sortable columns.

**[Audio]:** "Prefer a traditional view? Switch to list mode for a detailed table. Sort by value, close date, or owner. The data adapts to how you work."

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
| Activity Timeline | `organizations/rapid-compliance-root/conversations` filtered by dealId | LIVE |
| Documents | `organizations/rapid-compliance-root/documents` linked by dealId | LIVE |

---

*Last Audited: February 5, 2026*
