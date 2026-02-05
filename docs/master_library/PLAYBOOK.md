# FEATURE NAME: Sales Playbook Dashboard

## FILE PATH
`src/app/(dashboard)/playbook/page.tsx`

## AUDIT STATUS: FAIL

**Failure Reasons:**
- Hard-coded mocks detected: Full mock playbook arrays (lines 29-100+)
  - "Discovery Call Mastery" playbook with mock success metrics
  - "Objection Handling Playbook" with mock conversation counts
  - Mock confidence scores and performance data

---

## MANUAL SOP

### Purpose
The Sales Playbook Dashboard provides sales representatives with proven scripts, objection handling frameworks, and call guidance. Playbooks are generated and refined by AI agents based on successful conversation patterns.

### Steps to Execute Manually

1. **Access the Playbook**
   - Navigate to `/dashboard` (Main Dashboard)
   - Click "Playbook" in the sidebar navigation
   - Alternatively, navigate directly to `/playbook`

2. **Browse Available Playbooks**
   - View list of playbooks organized by category:
     - Discovery Calls
     - Demo Presentations
     - Objection Handling
     - Closing Techniques
     - Follow-up Sequences
   - Each playbook card shows:
     - Title and description
     - Success rate percentage
     - Number of conversations using this playbook
     - Confidence score

3. **Select a Playbook**
   - Click on a playbook card to open
   - Review the full script and guidance
   - View recommended talk tracks
   - See common objections and responses

4. **Use During Calls**
   - Keep playbook open during sales calls
   - Follow the structured flow
   - Use suggested responses for objections
   - Note outcomes for AI learning

5. **Review Performance**
   - Check playbook success metrics
   - Compare your performance to team average
   - Identify which scripts work best for you

6. **Request Playbook Updates**
   - If a playbook isn't working, flag for review
   - AI agents will analyze recent conversations
   - Updated playbooks deploy automatically

---

## VIDEO PRODUCTION SCRIPT

### Duration: 90 seconds

---

**[Visual]:** Sales rep on headset, looking at screen. Split screen shows playbook interface.

**[Audio]:** "What if every sales call came with a roadmap to success? The SalesVelocity.ai Playbook does exactly that."

---

**[Visual]:** Playbook dashboard loads. Cards animate in showing different playbooks with success percentages.

**[Audio]:** "Your AI workforce analyzes thousands of successful conversations and distills them into winning playbooks. Discovery calls, demos, objection handling - each one battle-tested and proven."

---

**[Visual]:** Click "Discovery Call Mastery" playbook. Full script expands with sections highlighted.

**[Audio]:** "Open a playbook and get a complete script: the perfect opening, qualifying questions that reveal budget and timeline, and transitions that keep the conversation flowing."

---

**[Visual]:** Scroll to "Common Objections" section. Show three objection cards with responses.

**[Audio]:** "When the prospect says 'it's too expensive' or 'we need to think about it,' you're ready. Every objection has a proven response, refined by AI from your top performers."

---

**[Visual]:** Success rate chart showing upward trend. Rep's face shows confidence.

**[Audio]:** "Watch your numbers climb. Reps using playbooks see up to forty percent higher close rates. Not because they're reading scripts - because they're following patterns that work."

---

**[Visual]:** AI agent icon analyzing conversation data, updating playbook.

**[Audio]:** "And your playbooks keep getting better. After every call, AI reviews outcomes and refines the guidance. Your playbook today is smarter than it was yesterday."

---

**[Visual]:** Logo animation with tagline.

**[Audio]:** "SalesVelocity.ai Playbooks. Turn every rep into your best rep."

---

## DATA DEPENDENCY

| Data Point | Firestore Path | Current Status |
|------------|----------------|----------------|
| Playbook List | `organizations/rapid-compliance-root/playbooks` | **MOCKED** - Hard-coded arrays |
| Success Metrics | Calculated from `conversations` outcomes | **MOCKED** - Static percentages |
| Conversation Count | Count from `conversations` using playbook | **MOCKED** - Hard-coded numbers |
| Confidence Score | AI-calculated from conversation analysis | **MOCKED** - Static values |

### Required Fix
```typescript
// Fetch playbooks from Firestore
const playbooks = await firestore
  .collection(`organizations/${DEFAULT_ORG_ID}/playbooks`)
  .orderBy('successRate', 'desc')
  .get();

// Calculate live metrics
const playbookMetrics = await Promise.all(
  playbooks.map(async (playbook) => {
    const conversations = await getConversationsUsingPlaybook(playbook.id);
    return {
      ...playbook,
      conversationCount: conversations.length,
      successRate: calculateSuccessRate(conversations),
      confidenceScore: calculateConfidence(conversations)
    };
  })
);
```

---

*Last Audited: February 5, 2026*
