# FEATURE NAME: AI Agents Administration Panel

## FILE PATH
`src/app/admin/ai-agents/page.tsx`

## AUDIT STATUS: FAIL

**Failure Reasons:**
- Hard-coded mocks detected: "4 Active Agents" (line 108)
- Hard-coded mocks detected: "34 Total Training Sessions" (line 109)
- Hard-coded mocks detected: "127 Conversations Today" (line 110)
- Hard-coded mocks detected: "94% Success Rate" (line 111)
- Theme violation: Hard-coded gradient `#6366f1, #8b5cf6` (line 173)
- Theme violation: Hard-coded hex `#0a0a0a`, `#1a1a1a`, `#333`, `#222` (multiple lines)

---

## MANUAL SOP

### Purpose
The AI Agents Administration Panel allows platform administrators to monitor, configure, and manage the 51-agent AI workforce. This includes viewing agent status, training metrics, and conversation analytics.

### Steps to Execute Manually

1. **Access the AI Agents Panel**
   - Navigate to `/admin` (Admin Command Center)
   - Click "AI Workforce" in the sidebar navigation
   - Select "Agent Registry" from submenu
   - Alternatively, navigate directly to `/admin/ai-agents`

2. **Review Agent Overview Statistics**
   - Locate the statistics cards at the top of the page
   - **Active Agents**: Should show count of agents with `status: 'active'`
   - **Training Sessions**: Should show total training sessions from `trainingData` collection
   - **Conversations Today**: Should query `conversations` collection for today's date
   - **Success Rate**: Should calculate from conversation outcomes

3. **Browse Agent Registry**
   - Scroll down to the agent list
   - Agents are organized by hierarchy:
     - L1: Master Orchestrator (1)
     - L2: Managers (9)
     - L3: Specialists (37)
     - Standalone (4)
   - Click any agent row to view details

4. **View Individual Agent Details**
   - Click an agent name
   - Review configuration: model, temperature, system prompt
   - Check training status and last training date
   - View recent conversation logs

5. **Configure Agent Settings**
   - Click "Edit" on any agent
   - Modify persona, training data, or model parameters
   - Save changes to update Firestore config

6. **Monitor Agent Performance**
   - Check success rate per agent
   - Review conversation sentiment scores
   - Identify underperforming agents for retraining

---

## VIDEO PRODUCTION SCRIPT

### Duration: 120 seconds

---

**[Visual]:** Admin dashboard sidebar, mouse hovers over "AI Workforce" section, clicks "Agent Registry"

**[Audio]:** "Managing a team of fifty-one AI agents might sound overwhelming. But with SalesVelocity.ai's Agent Administration Panel, it's as simple as checking your email."

---

**[Visual]:** AI Agents page loads. Animated statistics cards appear with numbers counting up.

**[Audio]:** "At a glance, you see your entire AI workforce: how many agents are active, total training sessions completed, conversations handled today, and your overall success rate."

---

**[Visual]:** Zoom in on the agent hierarchy diagram showing L1, L2, L3 structure.

**[Audio]:** "Your AI workforce operates in a hierarchy. At the top, the Master Orchestrator coordinates everything. Nine managers handle different domains - marketing, sales, commerce, content. And thirty-seven specialists do the detailed work."

---

**[Visual]:** Click on "MARKETING_MANAGER" row. Detail panel slides in from right.

**[Audio]:** "Click any agent to see their configuration, recent conversations, and performance metrics. The Marketing Manager, for example, coordinates your social media experts, SEO specialists, and ad copywriters."

---

**[Visual]:** Click "Training" tab. Show training data being added.

**[Audio]:** "Need to improve an agent's performance? Add new training data, fine-tune their responses, and deploy updates - all without writing a single line of code."

---

**[Visual]:** Show success rate chart with upward trend.

**[Audio]:** "Track improvements over time. Watch as your agents learn from every conversation and continuously get better at serving your customers."

---

**[Visual]:** Pull back to show full dashboard. Logo watermark fades in.

**[Audio]:** "Fifty-one agents. One dashboard. Zero complexity. That's the power of SalesVelocity.ai."

---

## DATA DEPENDENCY

| Data Point | Firestore Path | Current Status |
|------------|----------------|----------------|
| Active Agents Count | `organizations/rapid-compliance-root/agentConfig` where `status == 'active'` | **MOCKED** - Hard-coded "4" |
| Training Sessions | `organizations/rapid-compliance-root/trainingData` | **MOCKED** - Hard-coded "34" |
| Conversations Today | `organizations/rapid-compliance-root/conversations` with date filter | **MOCKED** - Hard-coded "127" |
| Success Rate | Calculated from `conversations` outcomes | **MOCKED** - Hard-coded "94%" |

### Required Fix
```typescript
// Replace static stats with dynamic queries
const [activeAgents, trainingCount, todayConvos, successRate] = await Promise.all([
  getAgentCount({ status: 'active' }),
  getTrainingSessionCount(),
  getTodayConversationCount(),
  calculateSuccessRate()
]);
```

### Theme Fix Required
Replace hard-coded colors:
```css
/* Before */
background: linear-gradient(135deg, #6366f1, #8b5cf6);

/* After */
background: linear-gradient(135deg, var(--color-primary), var(--color-primary-light));
```

---

*Last Audited: February 5, 2026*
