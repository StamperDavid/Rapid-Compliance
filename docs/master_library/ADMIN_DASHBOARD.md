# FEATURE NAME: Admin Command Center Dashboard

## FILE PATH
`src/app/admin/page.tsx`

## AUDIT STATUS: FAIL

**Failure Reasons:**
- Hard-coded mocks detected: "AI Agents: 51" statistic (line 180)
- Hard-coded mocks detected: Platform overview stats - "130+ Physical Routes", "215+ API Endpoints" (lines 314-319)
- Theme violation: Hard-coded hex colors `#1a1a1a`, `#333` in inline styles (lines 298-300)

---

## MANUAL SOP

### Purpose
The Admin Command Center is the CEO-level dashboard for SalesVelocity.ai platform administrators. It provides a bird's-eye view of platform health, active agents, and system metrics.

### Steps to Execute Manually

1. **Access the Dashboard**
   - Navigate to `https://salesvelocity.ai/admin`
   - Authenticate with superadmin credentials
   - Dashboard loads automatically after authentication

2. **Review Platform Health**
   - Locate the "Platform Health" section at the top
   - Verify system status indicators (green = healthy, yellow = degraded, red = critical)
   - Note any warning banners or alerts

3. **Check AI Agent Status**
   - Find the "AI Agents" KPI card
   - Verify the count shows live agent count from system
   - Click the card to navigate to Agent Registry

4. **Review Platform Statistics**
   - Scroll to "Platform Overview" section
   - Verify route count matches actual routes
   - Verify API endpoint count matches actual endpoints
   - Verify Firestore collection count is accurate

5. **Monitor Active Sessions**
   - Check "Active Users" widget
   - Review current logged-in user count
   - Note any unusual activity patterns

6. **Access Quick Actions**
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

**[Audio]:** "The Platform Overview gives you instant visibility into your infrastructure - one hundred forty-eight routes, two hundred fifteen API endpoints, and fifty-one AI agents working around the clock."

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
| AI Agent Count | `organizations/rapid-compliance-root/agentConfig` | **MOCKED** - Shows hard-coded "51" |
| Route Count | N/A (build-time) | **MOCKED** - Shows hard-coded "130+" |
| API Endpoint Count | N/A (build-time) | **MOCKED** - Shows hard-coded "215+" |
| Active Users | `users` collection query | Needs implementation |
| System Health | `health/{healthId}` | Needs implementation |

### Required Fix
Replace static values with:
```typescript
// Fetch agent count dynamically
const agentCount = await getCollection('organizations/rapid-compliance-root/agentConfig').count();

// System health from health collection
const healthDoc = await getDoc('health/current');
```

---

*Last Audited: February 5, 2026*
