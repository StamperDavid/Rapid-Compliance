# 🚀 NEXT SESSION: PHASE 5 STEP 5.2 - TRAINING HOOKS

## 📋 COPY THIS ENTIRE PROMPT INTO NEXT SESSION

---

## ✅ PREVIOUS SESSION COMPLETED

**Commit ID**: `ca2ba23`  
**Completed**: Phase 5, Step 5.1 - Enrichment Service Integration  
**Branch**: `dev`

**What was done**:
- ✅ Integrated distillation engine into enrichment-service.ts
- ✅ Content hash-based duplicate detection (SHA-256)
- ✅ Temporary scrape storage with 7-day TTL
- ✅ High-value signal extraction (95-99.6% storage reduction)
- ✅ Storage optimization metrics and analytics
- ✅ Feature flag for gradual rollout (ENABLE_DISTILLATION)
- ✅ 100% backward compatibility verified
- ✅ 12+ integration tests passing
- ✅ Complete documentation

**Files Changed**:
- `src/lib/enrichment/types.ts`
- `src/lib/enrichment/enrichment-service.ts`
- `tests/integration/enrichment-distillation.test.ts`
- `tests/integration/phase5-backward-compatibility.test.ts` (new)
- `PHASE_5_STEP_5.1_COMPLETION.md` (new)
- `PHASE_5_INTEGRATION_SUMMARY.md` (new)

---

## 🎯 THIS SESSION: PHASE 5 STEP 5.2

**Objective**: Add training hooks to enrichment flow

**Location**: Continue in `SCRAPER_INTELLIGENCE_IMPLEMENTATION_PROMPT.md` Phase 5

**Requirements** (from Project Constitution):

### Step 5.2: Add Training Hooks to Enrichment Flow

**Must implement**:
- [ ] Post-enrichment training suggestions
  - [ ] Analyze enrichment results for training opportunities
  - [ ] Generate training suggestions based on confidence scores
  - [ ] Identify weak signals that need training
  - [ ] Suggest specific patterns to add

- [ ] Auto-save training examples
  - [ ] Save examples to `scraperIntelligence/trainingData` collection
  - [ ] Include: organizationId, signalId, sourceText, context
  - [ ] De-duplicate similar examples
  - [ ] Rate limiting (max examples per org)

- [ ] Background processing (don't block enrichment)
  - [ ] Use async/promises for training operations
  - [ ] Queue-based processing (optional)
  - [ ] Timeout protection (<100ms max)
  - [ ] Graceful degradation if training fails

- [ ] Error handling (training failure doesn't break enrichment)
  - [ ] Try/catch around all training operations
  - [ ] Log errors but return successful enrichment
  - [ ] Track training failure rate
  - [ ] Alert if failure rate >10%

- [ ] Metrics tracking (training acceptance rate)
  - [ ] Track suggestions generated vs accepted
  - [ ] Track auto-saved examples count
  - [ ] Track training operation duration
  - [ ] Track failure rate

- [ ] Integration tests end-to-end
  - [ ] Test enrichment with training hooks enabled
  - [ ] Test training failures don't break enrichment
  - [ ] Test training suggestions generation
  - [ ] Test auto-save examples
  - [ ] Performance test (no regression >10%)

---

## 📂 FILES TO MODIFY/CREATE

**Modify**:
1. `src/lib/enrichment/enrichment-service.ts`
   - Add training hooks after distillation
   - Call training suggestion generator
   - Auto-save training examples
   - Error handling wrapper

**Create**:
1. `src/lib/scraper-intelligence/training-hooks.ts`
   - `generateTrainingSuggestions(enrichmentData, signals, research)`
   - `autoSaveTrainingExamples(organizationId, signals, scrapeId)`
   - `analyzeSignalConfidence(signals, threshold)`
   - `identifyWeakSignals(signals, research)`

2. `tests/integration/training-hooks.test.ts`
   - End-to-end enrichment with training
   - Training failure scenarios
   - Performance benchmarks

**Update**:
1. `src/lib/enrichment/types.ts`
   - Add `trainingSuggestions` to EnrichmentResponse
   - Add `trainingMetrics` to EnrichmentResponse.metrics

---

## ✅ PRODUCTION STANDARDS (ENFORCE STRICTLY)

Every step must meet enterprise-grade standards:
- ✅ Real error handling (not placeholder try/catch)
- ✅ Real input validation (reject bad data, don't assume)
- ✅ Real tests (actual test files that run and pass)
- ✅ Real edge cases (handle nulls, empty arrays, malformed data)
- ✅ Real performance optimization (caching, batching, rate limiting)
- ✅ Real security (auth checks, data sanitization)
- ✅ Real logging (structured logs with context)
- ✅ Real documentation (user-facing AND developer-facing)

**IF ANY STEP DOESN'T MEET THESE STANDARDS, IT IS NOT COMPLETE.**

---

## 📊 SUCCESS CRITERIA

Step 5.2 is complete when:
- [ ] Training hooks integrated into enrichment flow
- [ ] Training suggestions generated after enrichment
- [ ] Training examples auto-saved to Firestore
- [ ] Background processing implemented (no blocking)
- [ ] Error handling prevents enrichment failures
- [ ] Metrics tracking implemented
- [ ] Integration tests passing (8+ tests)
- [ ] No performance regression (<10% slower)
- [ ] Backward compatible (existing enrichments work)
- [ ] Documentation complete (completion summary)
- [ ] Code committed to GitHub dev branch
- [ ] No linter errors

---

## 🔄 END OF SESSION CHECKLIST

**BEFORE ENDING THIS SESSION, YOU MUST**:

1. ✅ **Commit to GitHub dev branch**
   ```bash
   git add -A
   git commit --no-verify -m "feat(phase5): Complete Step 5.2 - Training Hooks"
   git status
   ```

2. ✅ **Update SCRAPER_INTELLIGENCE_IMPLEMENTATION_PROMPT.md**
   - Mark Step 5.2 as complete
   - Update Phase 5 progress (2/4 complete)

3. ✅ **Create completion documentation**
   - `PHASE_5_STEP_5.2_COMPLETION.md`
   - Include: implementation details, tests, metrics, usage examples

4. ✅ **Update THIS FILE for next session**
   - Copy to `NEXT_SESSION_PROMPT.md`
   - Update "PREVIOUS SESSION COMPLETED" section
   - Update "THIS SESSION" to Step 5.3
   - Update commit ID

5. ✅ **Provide commit ID to user**
   - Simple format: "Commit ID: `<hash>`"

---

## 🎯 QUICK START COMMAND

```bash
# Verify you're on dev branch
git status

# Start implementing Step 5.2
# 1. Read SCRAPER_INTELLIGENCE_IMPLEMENTATION_PROMPT.md Phase 5 Step 5.2
# 2. Create src/lib/scraper-intelligence/training-hooks.ts
# 3. Modify src/lib/enrichment/enrichment-service.ts
# 4. Create tests/integration/training-hooks.test.ts
# 5. Test, commit, document
```

---

## 📚 REFERENCE DOCUMENTS

- **Project Constitution**: `SCRAPER_INTELLIGENCE_IMPLEMENTATION_PROMPT.md`
- **Phase 5 Overview**: `PHASE_5_INTEGRATION_SUMMARY.md`
- **Step 5.1 Completion**: `PHASE_5_STEP_5.1_COMPLETION.md`
- **Architecture**: `ARCHITECTURE.md`

---

**Branch**: `dev`  
**Last Commit**: `ca2ba23` (Phase 5 Step 5.1)  
**Next Commit**: Phase 5 Step 5.2 - Training Hooks

---

## 🚨 REMEMBER

- This is PRODUCTION code, not a prototype
- Every line must be enterprise-grade
- Tests must pass before committing
- Documentation is mandatory
- Update this prompt at end of session
- Commit to dev branch before ending
