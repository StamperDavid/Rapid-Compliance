# FEATURE NAME: Sales Coaching Dashboard

## FILE PATH
`src/app/(dashboard)/coaching/page.tsx`

## AUDIT STATUS: BUFFERING

**Buffering Reasons:**
- Hard-coded user ID: `currentUserId = 'user_default'` (line 47) - TODO: Get from auth context
- Missing backend integration: Track acceptance in backend (line 114)
- Missing backend integration: Track dismissal in backend (line 123)

---

## MANUAL SOP

### Purpose
The Sales Coaching Dashboard provides AI-powered coaching recommendations for sales representatives. It analyzes conversation patterns, identifies skill gaps, and suggests specific improvements based on top performer behaviors.

### Steps to Execute Manually

1. **Access Coaching Dashboard**
   - Navigate to `/dashboard` (Main Dashboard)
   - Click "Dashboard" in sidebar
   - Select "Coaching" from submenu
   - Alternatively, navigate to `/coaching`

2. **Review Your Coaching Score**
   - Dashboard loads with your overall coaching score (0-100)
   - Score based on:
     - Conversation quality
     - Response time
     - Close rate
     - Customer satisfaction

3. **View Active Recommendations**
   - AI-generated recommendations appear as cards
   - Each recommendation includes:
     - Skill area (e.g., "Objection Handling")
     - Specific suggestion
     - Example from top performer
     - Expected impact

4. **Accept a Recommendation**
   - Click "Accept" on recommendation card
   - Recommendation moves to "In Progress"
   - AI tracks your implementation

5. **Dismiss a Recommendation**
   - Click "Dismiss" if not relevant
   - Provide optional feedback
   - AI adjusts future suggestions

6. **Review Progress**
   - View accepted recommendations
   - See improvement metrics
   - Track before/after comparison

7. **Access Training Resources**
   - Click "Resources" on any recommendation
   - View related:
     - Playbooks
     - Video examples
     - Best practice guides

8. **Team View (Managers)**
   - Click "Team" tab
   - See team-wide coaching scores
   - Identify common skill gaps
   - Assign coaching to team members

---

## VIDEO PRODUCTION SCRIPT

### Duration: 90 seconds

---

**[Visual]:** Sales rep looking at call analytics. Frustration visible. Transition to coaching dashboard.

**[Audio]:** "Every sales rep has blind spots. The difference between good and great is knowing what to improve. Enter AI Coaching."

---

**[Visual]:** Coaching dashboard loads. Overall score prominently displayed. Cards animate in.

**[Audio]:** "Your coaching score reflects your real performance across conversations, close rates, and customer satisfaction. No guesswork, just data."

---

**[Visual]:** Recommendation card zooms in: "Improve Discovery Questions - Ask more open-ended questions about budget early"

**[Audio]:** "AI analyzes your calls against your top performers and surfaces specific, actionable recommendations. Not generic advice - coaching tailored to your conversations."

---

**[Visual]:** Click recommendation to expand. Shows example conversation snippet from top performer.

**[Audio]:** "Each recommendation comes with real examples from your team's best closers. Learn from what's actually working in your organization."

---

**[Visual]:** Click "Accept". Card moves to "In Progress". Checkmark animation.

**[Audio]:** "Accept a recommendation and AI tracks your progress. Use the new technique in your next call. Watch your metrics improve."

---

**[Visual]:** Progress chart shows improvement over time. Score increasing.

**[Audio]:** "Track your growth over weeks and months. See concrete improvements in close rate, deal size, and customer feedback."

---

**[Visual]:** Manager view showing team grid with individual scores.

**[Audio]:** "Managers see the whole team. Identify skill gaps across your organization and assign targeted coaching where it's needed most."

---

**[Visual]:** Logo with upward growth arrow.

**[Audio]:** "SalesVelocity.ai Coaching. Because great sellers never stop learning."

---

## DATA DEPENDENCY

| Data Point | Firestore Path | Current Status |
|------------|----------------|----------------|
| User Coaching Score | `users/{userId}/coachingData` | Needs auth context |
| Recommendations | `organizations/rapid-compliance-root/coachingRecommendations/{userId}` | LIVE |
| Accepted/Dismissed | `users/{userId}/coachingData/recommendations` | **NOT IMPLEMENTED** |
| Team Scores | Aggregated from user scores | Needs implementation |

### Required Fix
```typescript
// Get user ID from auth context instead of hard-coded value
const { user } = useAuth();
const currentUserId = user?.uid ?? '';

// Implement acceptance tracking
const handleAccept = async (recommendationId: string) => {
  await firestore.doc(`users/${currentUserId}/coachingData/recommendations/${recommendationId}`)
    .set({ status: 'accepted', acceptedAt: serverTimestamp() });
};

// Implement dismissal tracking
const handleDismiss = async (recommendationId: string, feedback?: string) => {
  await firestore.doc(`users/${currentUserId}/coachingData/recommendations/${recommendationId}`)
    .set({ status: 'dismissed', dismissedAt: serverTimestamp(), feedback });
};
```

---

*Last Audited: February 5, 2026*
