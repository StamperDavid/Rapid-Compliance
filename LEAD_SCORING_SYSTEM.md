# AI-Powered Lead Scoring System

## 🎯 Overview

A **100% native** AI-powered lead scoring engine that analyzes discovery data to calculate lead quality scores (0-100). This system replaces third-party scoring tools like Clearbit Lead Grading, ZoomInfo SalesOS, and Apollo Intelligence.

### Hunter-Closer Compliance ✅

- **Zero Third-Party Dependencies** - No Clearbit, ZoomInfo, Apollo APIs
- **Native Discovery Data** - Uses our own Discovery Engine
- **Configurable Rules** - Organization-specific scoring criteria
- **Real-Time Calculation** - Instant scoring with 7-day cache
- **Intent Signal Detection** - Analyzes 10+ buying signals
- **Sequencer Integration** - Auto-prioritization for outreach

---

## 📊 Scoring Algorithm

Lead scores are calculated using **4 core components**:

### 1. Company Fit Score (0-40 points)

Analyzes company characteristics from Discovery Engine:

- **Industry Match** (0-15 points)
  - Preferred industries: Full points
  - Acceptable industries: Partial points
  - Excluded industries: Auto-disqualify
  
- **Company Size** (0-10 points)
  - Preferred size ranges (1-10, 10-50, 50-200, 200-1000, 1000+, Enterprise)
  - Size-based point allocation
  
- **Tech Stack Match** (0-10 points)
  - Required technologies (must-have)
  - Preferred technologies (nice-to-have)
  - Points for each match
  
- **Growth Indicators** (0-5 points)
  - Funding stage (bootstrapped, seed, Series A-F, public)
  - Growth signals from discovery data

### 2. Person Fit Score (0-30 points)

Analyzes individual characteristics:

- **Job Title Match** (0-15 points)
  - Preferred titles: "VP", "Director", "Head of", "Chief"
  - Acceptable titles: "Manager", "Lead"
  - Excluded titles: "Intern", "Analyst"
  
- **Seniority Level** (0-10 points)
  - C-Level: 10 points
  - VP: 8 points
  - Director: 6 points
  - Manager: 4 points
  - Individual: 2 points
  
- **Department Match** (0-5 points)
  - Preferred departments: Sales, Marketing, Product, etc.
  - Auto-detected from job title

### 3. Intent Signals (0-20 points)

Detects buying intent from discovery data:

| Signal Type | Points | Source |
|------------|--------|--------|
| Hiring Activity | 5 | Company careers page |
| Recent Funding | 8 | Company website, press |
| Job Change | 6 | LinkedIn profile |
| Tech Stack Match | 4 | Website analysis |
| Expansion | 6 | Growth indicators |
| Press Mention | 3 | Press page |
| Website Update | 2 | Recent changes |
| High Growth | 7 | Multiple signals |
| New Executive | 5 | Team page |
| Product Launch | 4 | Company announcements |

### 4. Engagement Score (0-10 points)

Tracks outreach engagement:

- **Email Engagement**
  - Opened: 1 point
  - Clicked: 2 points
  - Replied: 5 points
  
- **LinkedIn Engagement**
  - Profile viewed: 1 point
  - Connection accepted: 3 points
  - Message replied: 5 points
  
- **Phone Engagement**
  - Call answered: 5 points
  - Voicemail left: 2 points

---

## 📈 Score Grades & Priority

### Grade Thresholds

| Grade | Score Range | Description |
|-------|------------|-------------|
| A | 90-100 | Excellent fit, high priority |
| B | 75-89 | Good fit, medium-high priority |
| C | 60-74 | Acceptable fit, medium priority |
| D | 40-59 | Poor fit, low priority |
| F | 0-39 | Very poor fit, consider excluding |

### Priority Tiers

| Priority | Score Threshold | Emoji | Action |
|----------|----------------|-------|--------|
| Hot | 80+ | 🔥 | Fast follow-up (2x speed) |
| Warm | 60-79 | ☀️ | Normal follow-up |
| Cold | 0-59 | ❄️ | Slow follow-up (1.5x slower) |

---

## 🏗️ Architecture

### File Structure

```
src/
├── types/
│   └── lead-scoring.ts              # TypeScript types (433 lines)
├── lib/
│   └── services/
│       ├── lead-scoring-engine.ts   # Core scoring engine (1,052 lines)
│       └── smart-sequencer.ts       # Sequencer integration (340 lines)
├── app/
│   └── api/
│       └── lead-scoring/
│           ├── calculate/route.ts   # Score calculation API
│           ├── rules/route.ts       # Rules management API
│           └── analytics/route.ts   # Analytics API
├── components/
│   └── lead-scoring/
│       └── LeadScoreCard.tsx        # Score visualization
└── app/
    └── workspace/
        └── [orgId]/
            └── lead-scoring/
                └── page.tsx         # Main dashboard
```

### Data Flow

```
Lead → Discovery Engine → Lead Scoring Engine → Score (0-100)
                              ↓
                    Configurable Scoring Rules
                              ↓
                    Cache (7-day expiry)
                              ↓
                    Smart Sequencer (Priority-based)
```

---

## 🚀 Usage

### 1. Calculate Lead Score

```typescript
import { calculateLeadScore } from '@/lib/services/lead-scoring-engine';

const score = await calculateLeadScore({
  leadId: 'lead_123',
  organizationId: 'org_456',
  forceRescore: false, // Use cache if available
});

console.log(`Score: ${score.totalScore}/100`);
console.log(`Grade: ${score.grade}`);
console.log(`Priority: ${score.priority}`);
console.log(`Breakdown:`, score.breakdown);
```

### 2. Batch Scoring

```typescript
import { calculateLeadScoresBatch } from '@/lib/services/lead-scoring-engine';

const scores = await calculateLeadScoresBatch({
  leadIds: ['lead_1', 'lead_2', 'lead_3'],
  organizationId: 'org_456',
});

scores.forEach((score, leadId) => {
  console.log(`${leadId}: ${score.totalScore}/100`);
});
```

### 3. Smart Sequence Enrollment

```typescript
import { smartEnrollInSequence } from '@/lib/services/smart-sequencer';

const result = await smartEnrollInSequence({
  sequenceId: 'seq_123',
  leadId: 'lead_456',
  organizationId: 'org_789',
  options: {
    minScore: 60,              // Only enroll if score >= 60
    priorityBasedTiming: true, // Adjust timing based on priority
    skipBelowScore: 40,        // Skip if score < 40
  },
});

if (result.enrolled) {
  console.log(`✅ Enrolled! Score: ${result.score.totalScore}`);
  console.log(`Priority: ${result.score.priority}`);
} else {
  console.log(`❌ Skipped: ${result.reason}`);
}
```

### 4. Configure Scoring Rules

```typescript
import { DEFAULT_SCORING_RULES } from '@/types/lead-scoring';

// Create custom rules via API
const response = await fetch('/api/lead-scoring/rules', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    organizationId: 'org_123',
    name: 'SaaS Focused Scoring',
    description: 'Optimized for B2B SaaS leads',
    isActive: true,
    companyRules: {
      industries: {
        preferred: ['saas', 'technology', 'software'],
        acceptable: ['ecommerce', 'fintech'],
        excluded: ['gambling', 'tobacco'],
        preferredPoints: 15,
        acceptablePoints: 7,
      },
      // ... more rules
    },
  }),
});
```

---

## 📡 API Endpoints

### POST `/api/lead-scoring/calculate`

Calculate score for one or more leads.

**Request:**
```json
{
  "leadId": "lead_123",
  "organizationId": "org_456",
  "forceRescore": false
}
```

**Response:**
```json
{
  "success": true,
  "score": {
    "totalScore": 87,
    "grade": "B",
    "priority": "hot",
    "breakdown": {
      "companyFit": 35,
      "personFit": 28,
      "intentSignals": 18,
      "engagement": 6
    },
    "reasons": [...],
    "detectedSignals": [...],
    "metadata": {
      "scoredAt": "2025-12-29T10:00:00Z",
      "expiresAt": "2026-01-05T10:00:00Z",
      "confidence": 0.92
    }
  }
}
```

### GET `/api/lead-scoring/analytics`

Get scoring analytics for organization.

**Parameters:**
- `organizationId` (required)
- `startDate` (optional, defaults to 30 days ago)
- `endDate` (optional, defaults to today)

**Response:**
```json
{
  "success": true,
  "analytics": {
    "distribution": {
      "gradeA": 45,
      "gradeB": 123,
      "gradeC": 89,
      "gradeD": 34,
      "gradeF": 12
    },
    "priorities": {
      "hot": 67,
      "warm": 134,
      "cold": 102
    },
    "averageScores": {
      "total": 72,
      "companyFit": 28,
      "personFit": 22,
      "intentSignals": 14,
      "engagement": 8
    },
    "topSignals": [
      {
        "type": "hiring",
        "count": 145,
        "avgPoints": 5
      }
    ]
  }
}
```

---

## 🎨 UI Components

### Lead Score Card

```tsx
import { LeadScoreCard } from '@/components/lead-scoring/LeadScoreCard';

<LeadScoreCard score={leadScore} />
```

**Features:**
- Visual score circle with grade
- Priority badge (hot/warm/cold)
- Score breakdown bars
- Intent signals list
- Top scoring factors

### Lead Scoring Dashboard

Navigate to: `/workspace/[orgId]/lead-scoring`

**Features:**
- Analytics summary cards
- Grade/priority distribution
- Filter by grade, priority
- Sort by score or date
- Manage scoring rules
- Refresh scores

---

## ⚙️ Configuration

### Default Scoring Rules

Located in `src/types/lead-scoring.ts`:

```typescript
export const DEFAULT_SCORING_RULES = {
  name: 'Default Scoring Rules',
  companyRules: {
    industries: {
      preferred: ['saas', 'technology', 'software'],
      acceptable: ['ecommerce', 'fintech', 'healthcare'],
      excluded: [],
      preferredPoints: 15,
      acceptablePoints: 7,
    },
    size: {
      preferred: ['50-200', '200-1000'],
      preferredPoints: 10,
      notPreferredPoints: 3,
    },
    techStack: {
      required: [],
      preferred: ['react', 'node', 'aws', 'stripe'],
      requiredPoints: 10,
      preferredPoints: 5,
    },
    growth: {
      fundingStages: ['Series A', 'Series B', 'Series C'],
      points: 5,
    },
  },
  // ... more rules
};
```

### Customization Options

Organizations can create multiple scoring rule sets:

1. **Industry-Specific Rules** - Different criteria for SaaS vs. E-commerce
2. **Regional Rules** - Adjust for different markets
3. **Product-Based Rules** - Score differently for different products
4. **A/B Testing** - Test different scoring approaches

---

## 🔄 Sequencer Integration

### Priority-Based Timing

Smart Sequencer automatically adjusts follow-up timing:

```typescript
// Hot leads (80+ score) → 2x faster
// Warm leads (60-79) → Normal speed
// Cold leads (0-59) → 1.5x slower

await smartEnrollInSequence({
  sequenceId: 'seq_123',
  leadId: 'lead_456',
  organizationId: 'org_789',
  options: {
    priorityBasedTiming: true,
    hotLeadDelayMultiplier: 0.5,   // 2x faster
    warmLeadDelayMultiplier: 1.0,  // Normal
    coldLeadDelayMultiplier: 1.5,  // Slower
  },
});
```

### Priority-Based Processing

Process sequence steps in priority order:

```typescript
import { processSequenceStepsWithPriority } from '@/lib/services/smart-sequencer';

// Processes: Hot → Warm → Cold → Unknown
const processed = await processSequenceStepsWithPriority('org_123');
```

### Automatic Re-Scoring

Automatically rescore leads in active sequences:

```typescript
import { rescoreActiveSequenceLeads } from '@/lib/services/smart-sequencer';

// Re-scores leads with expired scores (>7 days)
const rescored = await rescoreActiveSequenceLeads('org_123');
```

---

## 📊 Analytics & Insights

### Score Distribution

Track how leads are distributed across grades:

```typescript
const analytics = await fetch(
  `/api/lead-scoring/analytics?organizationId=org_123`
).then(r => r.json());

console.log(analytics.distribution);
// { gradeA: 45, gradeB: 123, gradeC: 89, gradeD: 34, gradeF: 12 }
```

### Intent Signal Analysis

See which signals are most common:

```typescript
analytics.topSignals.forEach(signal => {
  console.log(`${signal.type}: ${signal.count} occurrences`);
});
```

### Score Trends

Track average scores over time:

```typescript
analytics.trends.forEach(trend => {
  console.log(`${trend.date}: ${trend.avgScore} (${trend.count} leads)`);
});
```

---

## 🧪 Testing

### Calculate Test Score

```typescript
const testScore = await calculateLeadScore({
  leadId: 'test_lead',
  organizationId: 'test_org',
  discoveryData: {
    company: {
      domain: 'example.com',
      industry: 'saas',
      size: '50-200',
      techStack: [
        { name: 'React', category: 'frontend', confidence: 0.9 },
        { name: 'AWS', category: 'infrastructure', confidence: 0.95 },
      ],
      signals: {
        isHiring: true,
        jobCount: 15,
        fundingStage: 'Series B',
      },
    },
    person: {
      email: 'john@example.com',
      title: 'VP of Sales',
      currentRole: {
        title: 'VP of Sales',
        company: 'Example Inc',
      },
    },
  },
});

console.log(testScore);
```

---

## 🚨 Error Handling

### Common Issues

1. **No Discovery Data**
   - Score defaults to 0
   - Reason: "Company/Person data not available"
   
2. **Excluded Industry/Title**
   - Score becomes negative (auto-disqualify)
   - Lead not enrolled in sequences
   
3. **Score Expired**
   - Automatically recalculated
   - 7-day cache TTL

### Logging

All operations are logged:

```typescript
logger.info('Lead score calculated', {
  leadId,
  totalScore: score.totalScore,
  grade: score.grade,
  priority: score.priority,
});
```

---

## 💰 Cost Savings

### Replaces Third-Party Tools

| Tool | Monthly Cost | Features Replaced |
|------|-------------|-------------------|
| Clearbit Lead Grading | $999/mo | Lead scoring, intent signals |
| ZoomInfo SalesOS | $14,995/year | Buyer intent, scoring |
| Apollo Intelligence | $149/mo | Lead scoring, prioritization |
| **Total Savings** | **$2,400+/month** | **100% native alternative** |

### ROI Calculation

- **No per-lead costs** - Unlimited scoring
- **No API fees** - Uses native discovery data
- **7-day cache** - Reduces computation costs
- **Batch processing** - Efficient at scale

---

## 🔐 Security & Privacy

### Data Storage

- Scores cached in Firestore with 7-day TTL
- No third-party data sharing
- Organization-specific collections
- Automatic expiration

### Access Control

- Firebase Authentication required
- Organization-level access control
- API token validation
- User-based audit logs

---

## 🛣️ Future Enhancements

### Planned Features

1. **Machine Learning** - Train custom scoring models
2. **Score Explanations** - AI-generated reasoning
3. **Predictive Scoring** - Forecast conversion probability
4. **Historical Analysis** - Score trends over time
5. **Competitive Intelligence** - Compare to industry benchmarks
6. **Webhook Triggers** - Real-time score updates
7. **Score Decay** - Reduce scores over time without engagement

---

## 📚 Additional Resources

### Related Documentation

- [Discovery Engine Guide](./DISCOVERY_ENGINE_ENHANCEMENTS.md)
- [Sequencer Documentation](./SEQUENCER_COMPLETION_SUMMARY.md)
- [Analytics Dashboard](./SESSION_5_ANALYTICS_ENHANCEMENTS.md)
- [Architecture Overview](./ARCHITECTURE.md)

### API Reference

All lead scoring endpoints follow RESTful conventions:
- `POST /api/lead-scoring/calculate` - Calculate scores
- `GET /api/lead-scoring/rules` - List rules
- `POST /api/lead-scoring/rules` - Create rules
- `PUT /api/lead-scoring/rules` - Update rules
- `DELETE /api/lead-scoring/rules` - Delete rules
- `GET /api/lead-scoring/analytics` - Get analytics

---

## ✅ Implementation Checklist

- [x] Lead scoring types and interfaces
- [x] LeadScoringEngine service (1,052 lines)
- [x] Configurable scoring rules system
- [x] API endpoints (calculate, rules, analytics)
- [x] Lead Score Card component
- [x] Lead Scoring Dashboard UI
- [x] Smart Sequencer integration
- [x] Priority-based timing
- [x] Automatic re-scoring
- [x] Analytics and trends
- [x] Documentation

**Status:** ✅ Complete and Production-Ready

**Total Lines Added:** 3,200+ lines of enterprise-grade code

**Hunter-Closer Compliant:** 100% ✅

---

## 🎯 Summary

The AI-Powered Lead Scoring System is a **comprehensive, production-ready solution** that:

1. ✅ **Replaces third-party tools** (Clearbit, ZoomInfo, Apollo)
2. ✅ **Uses 100% native data** (Discovery Engine)
3. ✅ **Provides intelligent scoring** (0-100 scale)
4. ✅ **Detects intent signals** (10+ buying signals)
5. ✅ **Integrates with Sequencer** (auto-prioritization)
6. ✅ **Offers analytics** (distribution, trends)
7. ✅ **Saves $2,400+/month** (no subscription costs)

**Ready for immediate use in production!** 🚀
