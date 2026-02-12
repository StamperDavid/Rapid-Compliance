# FEATURE NAME: Admin Command Center Dashboard

## FILE PATH
`src/app/(dashboard)/dashboard/page.tsx`

## AUDIT STATUS: ✅ PASS

**Fixed on:** February 5, 2026 (Truth Sweep)

**Changes Made:**
- ✅ AI Agent count now fetched dynamically from `/api/admin/stats` API
- ✅ Platform overview stats now show real data: swarm agents, standalone agents, conversations, playbooks
- ✅ All hard-coded hex colors replaced with CSS variables (`var(--color-bg-elevated)`, `var(--color-border-light)`, etc.)
- ✅ Stats API enhanced to include `totalAgentCount`, `swarmAgentCount`, `standaloneAgentCount`, `totalConversations`, `totalPlaybooks`

---

## MANUAL SOP

### Purpose
The Admin Command Center is the CEO-level dashboard for SalesVelocity.ai platform administrators. It provides a bird's-eye view of platform health, active agents, and system metrics.

### Steps to Execute Manually

1. **Access the Dashboard**
   - Navigate to `https://salesvelocity.ai/(dashboard)/dashboard`
   - Authenticate with superadmin credentials
   - Dashboard loads automatically after authentication

2. **Check AI Agent Status**
   - Find the "AI Agents" KPI card
   - Verify the count shows live agent count from system (52 total agents, 38 specialists)
   - Click the card to navigate to Agent Registry

3. **Review Platform Statistics**
   - Scroll to "Platform Overview" section
   - Verify route count matches actual routes
   - Verify API endpoint count matches actual endpoints
   - Verify Firestore collection count is accurate

4. **Access Quick Actions**
   - Use sidebar navigation for:
     - User Management
     - System Flags
     - Audit Logs
     - System Settings

---

## VIDEO PRODUCTION SCRIPT

### Duration: 90 seconds

---

**[Visual]:** Fade in on SalesVelocity.ai login screen. Mouse clicks admin login button.

**[Audio]:** "Welcome to the SalesVelocity.ai Admin Command Center - your mission control for the entire platform."

---

**[Visual]:** Dashboard loads. Camera pans across KPI cards showing agent count, active users, system health.

**[Audio]:** "The moment you log in, you see everything that matters: your AI workforce status, active users across the platform, and real-time system health indicators."

---

**[Visual]:** Highlight the Platform Overview section. Numbers animate in.

**[Audio]:** "The Platform Overview gives you instant visibility into your infrastructure - one hundred forty-eight routes, two hundred fifteen API endpoints, and fifty-two AI agents working around the clock."

---

**[Visual]:** Mouse hovers over agent card, then clicks. Transition to Agent Registry.

**[Audio]:** "One click takes you directly to the AI Workforce Registry, where you can monitor each agent's performance, training status, and conversation metrics."

---

**[Visual]:** Return to dashboard. Highlight the sidebar navigation.

**[Audio]:** "From here, you control everything: user permissions, feature flags, system settings, and audit logs. All the power of your sales automation platform, unified in one command center."

---

**[Visual]:** Logo animation with tagline "SalesVelocity.ai - Your AI Sales Workforce"

**[Audio]:** "SalesVelocity.ai - the platform that works while you sleep."

---

## DATA DEPENDENCY

| Data Point | Firestore Path | Current Status |
|------------|----------------|----------------|
| AI Agent Count | `organizations/rapid-compliance-root/agentConfig` | ✅ **LIVE** - Fetched via `/api/admin/stats` |
| Swarm Agent Count | API-calculated | ✅ **LIVE** - Returned by stats API |
| Standalone Agent Count | API-calculated | ✅ **LIVE** - Returned by stats API |
| Conversations | `organizations/rapid-compliance-root/conversations` | ✅ **LIVE** - Fetched via stats API |
| Playbooks | `organizations/rapid-compliance-root/playbooks` | ✅ **LIVE** - Fetched via stats API |
| Active Users | `users` collection query | Fetched via stats API |

### Implementation
Stats are fetched from `/api/admin/stats` which uses Firestore Admin SDK's `.count()` aggregation for efficient counting.

---

## Planned Features (Not Yet Implemented)

### Platform Health Monitoring
- Real-time system status indicators (green = healthy, yellow = degraded, red = critical)
- Warning banners and alert notifications
- Status: Planned for future release

### Active Users Real-Time Count
- "Active Users" widget showing current logged-in user count
- Real-time session tracking and activity patterns
- Status: Planned for future release

---

*Last Audited: February 12, 2026*
