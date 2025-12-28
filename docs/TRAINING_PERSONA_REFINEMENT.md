# 🎓 Training → Persona Refinement System

## Overview

The **Training → Persona Refinement** system automatically improves your AI agent's persona based on training session feedback. When you identify issues like "too verbose," "inaccurate," or "off-brand," the system updates the persona configuration to fix these problems.

---

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                    TRAINING SESSION                              │
│  Trainer gives agent a scenario                                 │
│  Agent responds                                                  │
│  Trainer provides feedback                                      │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                  ISSUE DETECTION                                 │
│  System analyzes feedback:                                      │
│  - "Too gabby" → Verbosity issue                                │
│  - "Wrong pricing" → Accuracy issue                             │
│  - "Too aggressive" → Tone issue                                │
│  - "Not our brand" → Brand alignment issue                      │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                PERSONA REFINEMENT GENERATION                     │
│  For each issue, generate adjustment:                           │
│  - Verbosity → Reduce maxResponseLength                         │
│  - Accuracy → Add accuracy rule                                 │
│  - Tone → Update tone register                                  │
│  - Brand → Add brand alignment note                             │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                 AUTO-UPDATE PERSONA                              │
│  Apply refinements to persona configuration                     │
│  Log in trainingInsights history                                │
│  Next conversation uses updated persona                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Issue Types & Auto-Adjustments

### 1. Verbosity Issues ("Too Gabby")

**Detection**: 
- Feedback: "Too long", "Too verbose", "Rambling"
- Response length > 300 words
- Multiple paragraphs

**Auto-Adjustments**:
```typescript
// Reduce max response length
verbosityControl.maxResponseLength = currentLength * 0.7

// Enable bullet points
verbosityControl.preferBulletPoints = true

// Change pacing
verbosityControl.conversationalPacing = 'concise'

// Enable repetition avoidance
verbosityControl.avoidRepetition = true
```

**Example**:
```
Before Training:
Response: 500 words, multiple paragraphs, repeated points

After Refinement:
✓ Max response length reduced to 350 words
✓ Bullet points enabled
✓ Conversational pacing set to "concise"
✓ Repetition avoidance enabled

Next Response: 280 words, clear bullet points, no repetition
```

---

### 2. Accuracy Issues

**Detection**:
- Feedback: "Wrong info", "Inaccurate", "Not correct"
- Specific topic mentioned (pricing, features, etc.)

**Auto-Adjustments**:
```typescript
// Add accuracy rule
accuracyRules.push(
  "Always verify [topic] from authoritative source before responding"
)
```

**Example**:
```
Training Feedback:
"Agent gave wrong pricing for Enterprise plan"

Auto-Generated Rule:
✓ "Always verify pricing from latest pricing sheet before responding"

Next Response:
Agent: "Let me pull the exact Enterprise pricing from our official 
pricing documentation... [RAG search] The Enterprise plan is $1,250/month 
for 501-1,000 records."
```

---

### 3. Brand Alignment Issues

**Detection**:
- Feedback: "Not our brand", "Too salesy", "Wrong tone"
- Misalignment with company values

**Auto-Adjustments**:
```typescript
// Add brand alignment note
brandAlignmentNotes += "Always emphasize [value]. Avoid [behavior]."
```

**Example**:
```
Training Feedback:
"Too aggressive. We're consultative, not pushy."

Auto-Generated Note:
✓ "Brand alignment: Focus on being a trusted advisor. Avoid aggressive 
sales tactics. Lead with value, not urgency."

Next Response:
Agent shifts from: "You need to buy now!" 
             to: "Let's explore if this aligns with your goals..."
```

---

### 4. Tone Issues

**Detection**:
- Feedback: "Too formal", "Too casual", "Robotic"

**Auto-Adjustments**:
```typescript
// Update tone register
dynamicToneRegister += "Be more conversational and approachable."
```

**Example**:
```
Training Feedback:
"Too stiff and formal for our brand"

Auto-Generated Adjustment:
✓ "Tone adjustment: Be more conversational and approachable."

Next Response:
Before: "I hereby present the specifications of our product offering."
After:  "Let me walk you through how this works..."
```

---

## Training Interface (To Be Built)

### Training Session Flow

```typescript
// 1. Trainer selects scenario
const scenario = "Prospect asks about Enterprise pricing";

// 2. Agent responds
const agentResponse = await generateAgentResponse(scenario, persona);

// 3. Trainer provides feedback
const feedback = {
  rating: 2, // 1-5 stars
  issues: [
    {
      type: 'verbosity',
      severity: 'high',
      description: 'Response was way too long - 600 words!',
      suggestedFix: 'Keep pricing responses under 200 words'
    },
    {
      type: 'accuracy',
      severity: 'medium',
      description: 'Mentioned old pricing from 2 months ago',
      suggestedFix: 'Always verify latest pricing before quoting'
    }
  ],
  comments: 'Good structure but needs to be more concise and up-to-date'
};

// 4. System analyzes and generates refinements
const refinements = analyzeTrainingSession({
  scenario,
  agentResponse,
  feedback
});

// 5. Auto-apply to persona
const { updatedPersona, changes } = applyRefinementsToPersona(
  currentPersona,
  refinements
);

// 6. Show trainer what changed
console.log('Persona Updated:');
changes.forEach(change => console.log(change));
// ✓ Reduced max response length to 420 words
// ✓ Added accuracy rule: "Always verify pricing from latest pricing sheet"
```

---

## Confidence Scoring

Not all feedback results in persona changes. The system uses **confidence scoring** to avoid over-adjusting:

```typescript
interface PersonaRefinement {
  category: 'verbosity' | 'accuracy' | 'brand-alignment' | 'tone';
  adjustment: string;
  reasoning: string;
  confidence: number; // 0-1
}

// Only apply refinements with confidence > 0.6
```

**Confidence Factors**:
- **High Confidence (0.9+)**: Clear, measurable issues (response too long)
- **Medium Confidence (0.7-0.9)**: Specific feedback with context
- **Low Confidence (<0.7)**: Vague feedback, filtered out

---

## Batch Processing

Process multiple training sessions at once for better insights:

```typescript
const sessions = [
  // 10 training sessions with feedback
];

const { refinements, summary } = batchProcessTrainingSessions(sessions);

console.log(summary);
// {
//   totalSessions: 10,
//   issuesFound: 15,
//   refinementsMade: 8,
//   confidenceScore: 0.82
// }

// Apply all refinements at once
const { updatedPersona, changes } = applyRefinementsToPersona(
  currentPersona,
  refinements
);
```

---

## Training Insights History

Every refinement is logged in `persona.trainingInsights[]`:

```typescript
{
  date: "2025-12-28T10:30:00Z",
  issue: "Response was 600 words. User feedback: 'Way too long'",
  adjustment: "Reduced maxResponseLength to 420 words",
  category: "verbosity"
}
```

**Displayed in Persona UI**:
- Shows all past adjustments
- Color-coded by category
- Helps track improvement over time

---

## Integration with Persona UI

The **Training Refinements** tab in the persona page shows:

1. **Verbosity Control** (modified by training)
   - Max response length
   - Conversational pacing
   - Bullet point preference
   - Repetition avoidance

2. **Accuracy Rules** (added by training)
   - One rule per line
   - Generated from inaccuracy feedback

3. **Brand Alignment Notes** (updated by training)
   - Cumulative guidance on brand voice

4. **Training Insights History**
   - Timeline of all training-driven changes
   - Issue → Adjustment for each

---

## Example: Complete Training Flow

### Initial State
```typescript
persona = {
  agentName: "TechCorp-AI",
  responseComplexityIndex: 7,
  verbosityControl: {
    maxResponseLength: 500,
    preferBulletPoints: false,
    avoidRepetition: false,
    conversationalPacing: 'balanced'
  },
  accuracyRules: [],
  brandAlignmentNotes: '',
  trainingInsights: []
}
```

### Training Session 1
```
Scenario: "Prospect asks about security features"
Agent Response: [650 words, 5 paragraphs]
Feedback: "Too long and rambling. Get to the point faster."

Refinements Generated:
✓ Reduce maxResponseLength to 455 words
✓ Enable preferBulletPoints
✓ Set conversationalPacing to 'concise'
```

### Training Session 2
```
Scenario: "Prospect asks about Enterprise pricing"
Agent Response: "Enterprise starts at $900/month"
Feedback: "Wrong! It's $1,250/month now."

Refinements Generated:
✓ Add accuracy rule: "Always verify pricing from latest pricing sheet"
```

### Training Session 3
```
Scenario: "Prospect says 'just browsing'"
Agent Response: "You NEED to buy now or miss out!"
Feedback: "Way too aggressive. We're consultative."

Refinements Generated:
✓ Brand alignment: "Focus on being a trusted advisor. Avoid pressure tactics."
```

### Final State
```typescript
persona = {
  agentName: "TechCorp-AI",
  responseComplexityIndex: 7,
  verbosityControl: {
    maxResponseLength: 455,  // ← Reduced
    preferBulletPoints: true,  // ← Enabled
    avoidRepetition: true,  // ← Enabled
    conversationalPacing: 'concise'  // ← Changed
  },
  accuracyRules: [
    "Always verify pricing from latest pricing sheet"  // ← Added
  ],
  brandAlignmentNotes: "Focus on being a trusted advisor. Avoid pressure tactics.",  // ← Added
  trainingInsights: [
    {
      date: "2025-12-28T10:00:00Z",
      issue: "Response was 650 words. User: 'Too long and rambling'",
      adjustment: "Reduced maxResponseLength to 455 words",
      category: "verbosity"
    },
    {
      date: "2025-12-28T10:15:00Z",
      issue: "Inaccuracy: Wrong Enterprise pricing",
      adjustment: "Add accuracy rule: Always verify pricing",
      category: "accuracy"
    },
    {
      date: "2025-12-28T10:30:00Z",
      issue: "Too aggressive sales approach",
      adjustment: "Brand alignment: Focus on being trusted advisor",
      category: "brand-alignment"
    }
  ]
}
```

**Result**: Agent is now more concise, accurate, and brand-aligned!

---

## API Endpoints

### Save Training Session with Feedback
```typescript
POST /api/workspace/{orgId}/agent/training/session

{
  scenario: string;
  agentResponse: string;
  feedback: {
    rating: number;
    issues: TrainingIssue[];
    comments?: string;
  };
}

// Auto-triggers persona refinement
```

### Get Training Insights
```typescript
GET /api/workspace/{orgId}/agent/training/insights

Returns: {
  recentSessions: TrainingSession[];
  pendingRefinements: PersonaRefinement[];
  appliedRefinements: PersonaRefinement[];
}
```

---

## Benefits

### For Clients
✅ **No manual persona tuning** - Training automatically improves the agent  
✅ **Learns from mistakes** - Each training session makes it better  
✅ **Transparent improvements** - See exactly what changed and why  
✅ **Continuous refinement** - Agent gets smarter over time  

### For Platform
✅ **Differentiation** - No other platform does this  
✅ **Proven improvement** - Quantifiable training effectiveness  
✅ **Less support** - Agents self-improve instead of needing manual config  
✅ **Value demonstration** - Show ROI of training time  

---

## Next Steps

1. **Build Training UI** (`/workspace/{orgId}/settings/ai-agents/training`)
   - Scenario selector
   - Agent response display
   - Feedback form with issue types
   - Real-time persona refinement

2. **Implement Auto-Refinement API**
   - Process training feedback
   - Generate refinements
   - Auto-update persona
   - Log insights

3. **Add Analytics**
   - Training effectiveness score
   - Improvement over time
   - Issue frequency charts

---

**This system ensures every client gets a perfectly tuned agent through training, not manual configuration.**

