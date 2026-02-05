# FEATURE NAME: Visual Workflow Builder

## FILE PATH
`src/app/(dashboard)/workflows/builder/page.tsx`

## AUDIT STATUS: PASS

All data is fetched from Firestore. No hard-coded mocks detected. Theme compliant with CSS variables.

---

## MANUAL SOP

### Purpose
The Visual Workflow Builder is a no-code automation tool that allows users to create complex business processes using a drag-and-drop interface. Workflows can automate lead nurturing, deal updates, notifications, and integrations with external systems.

### Steps to Execute Manually

1. **Access Workflow Builder**
   - Navigate to `/dashboard` (Main Dashboard)
   - Click "Automation" in the sidebar
   - Select "Workflows" → "Create New"
   - Alternatively, navigate to `/workflows/builder`

2. **Understand the Interface**
   - Three-panel layout:
     - **Left Panel**: Trigger and action palette
     - **Center Canvas**: Workflow visualization
     - **Right Panel**: Step configuration

3. **Select a Trigger**
   - Drag a trigger from the left palette to canvas
   - Available triggers:
     - Lead Created
     - Deal Stage Changed
     - Form Submitted
     - Contact Updated
     - Scheduled Time
     - Webhook Received
     - Manual Trigger

4. **Configure Trigger**
   - Click trigger on canvas
   - Right panel shows configuration options
   - Set conditions (e.g., "When lead score > 80")
   - Save configuration

5. **Add Actions**
   - Drag actions from palette below trigger
   - Available actions:
     - Send Email
     - Send SMS
     - Update Record
     - Create Task
     - Wait/Delay
     - Conditional Branch (If/Then)
     - Call Webhook
     - Assign Owner
     - Add Tag
     - Notify Team

6. **Connect Steps**
   - Actions automatically connect in sequence
   - Drag to reorder
   - Use branch action for conditional logic

7. **Configure Each Action**
   - Click action on canvas
   - Configure in right panel:
     - Email: Template, recipient, subject
     - Wait: Duration (hours, days)
     - Branch: Condition to evaluate
   - Save each step

8. **Test Workflow**
   - Click "Test" button (top right)
   - Enter sample data
   - Watch execution in real-time
   - Check for errors

9. **Set Workflow Status**
   - Draft: Saved but not running
   - Active: Processing triggers
   - Paused: Temporarily stopped

10. **Activate Workflow**
    - Click "Save & Activate"
    - Workflow begins processing
    - Monitor in Workflow Analytics

11. **Monitor Execution**
    - View run history
    - Check success/failure rates
    - Debug failed runs

---

## VIDEO PRODUCTION SCRIPT

### Duration: 120 seconds

---

**[Visual]:** Empty canvas with toolbar. Mouse begins dragging elements.

**[Audio]:** "What if you could automate your entire sales process without writing a single line of code? Meet the SalesVelocity.ai Workflow Builder."

---

**[Visual]:** Drag "Lead Created" trigger to canvas. It snaps into place with satisfying animation.

**[Audio]:** "Start with a trigger. A new lead enters your system. What happens next? That's up to you."

---

**[Visual]:** Drag "Wait" action below trigger. Configure for 5 minutes. Drag "Send Email" below that.

**[Audio]:** "Maybe you want to wait five minutes, then send a personalized welcome email. Drag, drop, configure. It's that simple."

---

**[Visual]:** Drag "Conditional Branch" action. Configure: "If lead score > 80, then..."

**[Audio]:** "Add smart logic with branches. If the lead is hot, fast-track them to a sales call. If they're cold, nurture them with content."

---

**[Visual]:** Split branch shows two paths - one goes to "Create Task", other goes to "Add to Nurture Sequence"

**[Audio]:** "Hot leads get a task created for your best closer. Cooler leads enter a nurture sequence automatically. Zero manual sorting."

---

**[Visual]:** Click "Test" button. Sample lead data enters. Watch workflow execute step by step.

**[Audio]:** "Test before you launch. Watch your workflow execute with sample data. Catch issues before they affect real leads."

---

**[Visual]:** Click "Save & Activate". Green badge appears saying "Active".

**[Audio]:** "When you're ready, one click activates your workflow. It runs twenty-four seven, processing leads while you sleep."

---

**[Visual]:** Dashboard showing workflow analytics - runs, success rate, time saved.

**[Audio]:** "Track performance with built-in analytics. See how many leads flow through, success rates, and time saved. That's ROI you can measure."

---

**[Visual]:** Logo with automation icons flowing around it.

**[Audio]:** "SalesVelocity.ai Workflow Builder. Automate everything."

---

## DATA DEPENDENCY

| Data Point | Firestore Path | Status |
|------------|----------------|--------|
| Workflow Definitions | `organizations/rapid-compliance-root/workflows/{workflowId}` | LIVE |
| Workflow Runs | `organizations/rapid-compliance-root/workflows/{workflowId}/runs` | LIVE |
| Trigger Configs | Embedded in workflow document | LIVE |
| Action Templates | `organizations/rapid-compliance-root/workflowTemplates` | LIVE |

---

*Last Audited: February 5, 2026*
