# Comprehensive Persona & Training System - Implementation Plan

## Phase 1: Type Definitions ✅ COMPLETE

### Files Created/Modified:
1. **src/types/agent-memory.ts** - Updated with:
   - Comprehensive `OnboardingData` interface (25 steps)
   - Expanded `AgentPersona` interface (50+ fields)
   - New `SalesMethodology` interface for uploaded materials
   
2. **src/types/training-metrics.ts** - NEW file with:
   - 20 available training metrics
   - 8 scenario types for coverage tracking
   - Training session structures
   - Training requirements tracking

### Key Additions:

**OnboardingData now includes:**
- 5 new sales methodology sections (Steps 19-23)
- Training metrics selection (Step 24)
- Sales materials upload (Step 25)
- Total: 25 onboarding steps

**AgentPersona now includes:**
- Objection handling strategies (5 sub-fields)
- Customer sentiment handling (5 sub-fields)
- Discovery frameworks (5 sub-fields)
- Closing techniques (4 sub-fields)
- Product knowledge (6 sub-fields)
- Communication style (7 sub-fields)
- Value communication (6 sub-fields)
- Competitive positioning (3 sub-fields)
- Proactive behavior (4 sub-fields)
- Rules & boundaries (5 sub-fields)
- Training adjustments tracking
- Applied methodologies from uploaded books

**Total: 50+ adjustable persona fields**

---

## Phase 2: Next Steps

### 2.1 Onboarding Form Expansion ✅ COMPLETE
- [x] Add Steps 17-24 (new sales methodology sections)
- [x] Add Step 23 (training metrics selection with 20 options)
- [x] Add Step 24 (sales materials upload)
- [ ] Update onboarding processor to handle new fields

### 2.2 Document Processing for Sales Books
- [ ] Extend knowledge-processor.ts to handle PDFs
- [ ] Create sales-methodology-extractor.ts
- [ ] Prompt engineering for methodology extraction
- [ ] Map extracted knowledge to persona fields

### 2.3 Base Model Builder Updates
- [ ] Update buildSystemPrompt() to use all 50+ persona fields
- [ ] Ensure all new onboarding data populates persona
- [ ] Add methodology integration logic

### 2.4 Training Center Redesign
- [ ] Two-panel layout (chat left, metrics right)
- [ ] Dynamic metrics based on client selection
- [ ] Scenario type tagging
- [ ] Explanation text boxes (required)
- [ ] Scenario coverage tracking UI

### 2.5 Golden Master Requirements
- [ ] Training requirements validator
- [ ] Scenario coverage calculator
- [ ] Deployment blocker until requirements met
- [ ] Progress indicators

### 2.6 Deployment Controls
- [ ] Lock embed/short code until GM saved
- [ ] Placeholder preview boxes
- [ ] Training explanation messaging

### 2.7 Live Operations
- [ ] Conversation takeover functionality
- [ ] Sentiment analysis display
- [ ] Train-from-conversation feature
- [ ] Golden Master version management
- [ ] Delete & reset functionality

---

## Implementation Order:

**Week 1-2:** Onboarding expansion + Base Model updates
**Week 3:** Training Center redesign
**Week 4:** Document processing for sales books
**Week 5:** Golden Master requirements + deployment controls
**Week 6:** Live operations + testing

---

## Current Status:
✅ Phase 1: Type definitions complete
⏳ Phase 2: Ready to begin onboarding form expansion




