# 🏭 PRODUCTION-READY SCRAPER INTELLIGENCE IMPLEMENTATION

## ⚠️ CRITICAL: PRODUCTION STANDARDS REQUIRED

This is NOT a prototype. This is NOT an MVP. This is a **PRODUCTION DEPLOYMENT**.

Every step must meet enterprise-grade standards:
- ✅ Real error handling (not placeholder try/catch)
- ✅ Real input validation (reject bad data, don't assume)
- ✅ Real tests (actual test files that run and pass)
- ✅ Real edge cases (handle nulls, empty arrays, malformed data)
- ✅ Real performance optimization (caching, batching, rate limiting)
- ✅ Real security (auth checks, data sanitization, SQL injection prevention)
- ✅ Real logging (structured logs with context, not console.log)
- ✅ Real rollback strategy (version control, data migration support)
- ✅ Real documentation (user-facing AND developer-facing)
- ✅ **DISTILLATION & TTL ARCHITECTURE** (auto-delete raw data, save only signals)

**IF ANY STEP DOESN'T MEET THESE STANDARDS, IT IS NOT COMPLETE.**

---

## 🔥 CRITICAL ARCHITECTURAL PRINCIPLE: DISTILLATION & TTL

**The Problem:** Saving raw HTML/scrapes forever will bankrupt you at scale.
- 1,000 clients × 100 scrapes/day × 500KB per scrape = 50GB/day = $1,500/month storage costs

**The Solution:** Separate temporary "ore" from permanent "refined metal"

### **The Three-Tier Data Model:**

1. **The Ore (Raw Scrape)** - Temporary, auto-delete after 7 days
   - Collection: `temporary_scrapes`
   - Contains: Full HTML, raw markdown, metadata
   - TTL: 7 days (Firestore TTL policy or Cloud Function cleanup)
   - Purpose: Available for training/verification, then deleted

2. **The Refined Metal (Extracted Signals)** - Permanent, saved to CRM
   - Collection: `leads` or `companies` (existing CRM records)
   - Contains: ONLY the high-value signals defined in Industry Blueprint
   - Storage: ~2KB per lead vs 500KB raw HTML (250x reduction)
   - Purpose: The actual business intelligence

3. **The Heuristic (The Learning)** - Permanent, saved to templates
   - Collection: `scraperIntelligence/trainingData`
   - Contains: Client feedback on what's valuable
   - Purpose: Improve extraction accuracy over time

### **Implementation Requirements:**

**Content Hashing:**
```typescript
const contentHash = crypto.createHash('sha256').update(rawHtml).digest('hex');
// If hash matches existing record, only update lastSeen timestamp
// Don't create duplicate scrapes
```

**TTL Field:**
```typescript
interface TemporaryScrape {
  id: string;
  orgId: string;
  url: string;
  rawContent: string;
  contentHash: string;
  createdAt: Date;
  expiresAt: Date; // NOW + 7 days
  lastSeen: Date;
  scrapeCount: number; // How many times we've seen this content
}
```

**Distillation Flow:**
```
1. Scrape website → Save to temporary_scrapes (with expiresAt)
2. Extract high-value signals → Save to leads/companies (permanent)
3. After 7 days → Firestore auto-deletes temporary_scrapes
4. If client verifies in Training Center → Flag temporary_scrape for immediate deletion
```

**Cost Savings:**
- **Before:** 1,000 scrapes × 500KB = 500MB stored forever
- **After:** 1,000 scrapes × 2KB signals = 2MB stored permanently
- **Savings:** 99.6% storage reduction

---

# 📊 PROGRESS TRACKER

## **PHASE 1: FOUNDATION & TYPE SAFETY** ⏳ Not Started

- [ ] **Step 1.1:** Extend IndustryTemplate with ResearchIntelligence
  - [ ] TypeScript interfaces created with strict typing
  - [ ] Backward compatibility verified (existing templates work)
  - [ ] Zod schemas added for runtime validation
  - [ ] JSDoc added to all interfaces
  - [ ] No `any` types used
  - [ ] Unit tests written for type guards
  
- [ ] **Step 1.2:** Create Firestore schema with Distillation & TTL Architecture
  - [ ] `temporary_scrapes` collection created with TTL field
  - [ ] `scraperIntelligence` collection for training data
  - [ ] Firestore TTL policy configured (auto-delete after 7 days)
  - [ ] Content hashing logic implemented
  - [ ] Schema documented in ARCHITECTURE.md
  - [ ] Migration script created for existing orgs
  - [ ] Firestore security rules updated
  - [ ] Indexes defined for query performance (contentHash, expiresAt)
  - [ ] Collection structure validated
  - [ ] Rollback procedure documented
  - [ ] Cost analysis documented (storage savings projection)

- [ ] **Step 1.3:** Implement Distillation Engine & Content Hashing
  - [ ] Content hashing function (SHA-256)
  - [ ] Duplicate detection logic (check hash before saving)
  - [ ] Timestamp update logic (lastSeen instead of new record)
  - [ ] Distillation service (extract signals → save permanently)
  - [ ] TTL cleanup monitoring (Cloud Function or Firestore TTL)
  - [ ] Storage cost calculator (estimate savings)
  - [ ] Unit tests for hashing and duplicate detection
  - [ ] Integration tests for distillation flow

- [ ] **Step 1.4:** Create scraper-intelligence service layer
  - [ ] Full CRUD operations implemented
  - [ ] Error handling for all Firestore operations
  - [ ] Transaction support for atomic updates
  - [ ] Rate limiting to prevent abuse
  - [ ] Caching layer for frequent queries
  - [ ] Integration tests written and passing

## **PHASE 2: INDUSTRY INTELLIGENCE (10 Templates)** ⏳ Not Started

- [ ] **Step 2.1:** HVAC Research Intelligence
- [ ] **Step 2.2:** B2B SaaS Research Intelligence
- [ ] **Step 2.3:** Real Estate Research Intelligence
- [ ] **Step 2.4:** Fitness/Wellness Research Intelligence
- [ ] **Step 2.5:** Dental/Healthcare Research Intelligence
- [ ] **Step 2.6:** E-commerce Research Intelligence
- [ ] **Step 2.7:** Legal Services Research Intelligence
- [ ] **Step 2.8:** Home Services Research Intelligence
- [ ] **Step 2.9:** Restaurant/Hospitality Research Intelligence
- [ ] **Step 2.10:** Professional Services Research Intelligence

**Each template must include:**
- [ ] 15-25 high-value signals with real keywords
- [ ] 20+ fluff patterns (tested against real websites)
- [ ] 10+ scoring rules with clear logic
- [ ] 5-10 custom fields with extraction logic
- [ ] Scraping strategy optimized for industry
- [ ] Validated against 5 real industry websites
- [ ] Performance benchmarked (<2s per extraction)

## **PHASE 3: INTELLIGENT EXTRACTION ENGINE (Distillation Focus)** ⏳ Not Started

- [ ] **Step 3.1:** Industry-aware AI extraction with distillation
  - [ ] ai-extractor.ts enhanced with industry context
  - [ ] Extract ONLY high-value signals (not full content)
  - [ ] Save extracted signals to permanent CRM records
  - [ ] Save raw scrape to temporary_scrapes (with TTL)
  - [ ] LLM prompts optimized for each industry
  - [ ] Token usage optimized (costs documented)
  - [ ] Fallback logic for AI failures
  - [ ] Extraction confidence scoring
  - [ ] Verify distillation reduces storage by >95%
  - [ ] A/B test results vs baseline
  
- [ ] **Step 3.2:** Keyword-based signal detection
  - [ ] Regex patterns for each signal type
  - [ ] Case-insensitive matching
  - [ ] Fuzzy matching for typos
  - [ ] Multi-language support (if applicable)
  - [ ] Performance: <100ms per page
  - [ ] Unit tests for all patterns

- [ ] **Step 3.3:** Fluff pattern filtering
  - [ ] Pre-processing removes common noise
  - [ ] Context-aware filtering (don't remove headers from body)
  - [ ] Whitelist/blacklist logic
  - [ ] Performance: <50ms per page
  - [ ] False positive rate: <5%
  - [ ] Integration tests with real websites

- [ ] **Step 3.4:** Confidence scoring algorithm
  - [ ] Multi-factor scoring (keyword density, source reliability, AI confidence)
  - [ ] Normalized scores (0-100)
  - [ ] Threshold tuning documented
  - [ ] Calibration against manual labels
  - [ ] Unit tests for edge cases
  - [ ] Performance: O(1) complexity

## **PHASE 4: LEARNING SYSTEM (Client Feedback)** ⏳ Not Started

- [ ] **Step 4.1:** Training Manager with TTL Integration (training-manager.ts)
  - [ ] Client feedback submission endpoint
  - [ ] Feedback validation (reject malformed data)
  - [ ] When client verifies extraction → Flag temporary_scrape for immediate deletion
  - [ ] Move verified signals to permanent storage
  - [ ] Update training data with client confirmation
  - [ ] Atomic updates (no partial writes)
  - [ ] Conflict resolution (concurrent edits)
  - [ ] Audit trail (who changed what when)
  - [ ] Rate limiting (prevent abuse)
  - [ ] Integration tests for all operations
  - [ ] Verify temporary scrapes are deleted after verification
  - [ ] API documentation generated

- [ ] **Step 4.2:** Pattern Matcher (pattern-matcher.ts)
  - [ ] OpenAI embeddings integration
  - [ ] Vector similarity search
  - [ ] Similarity threshold tuning (precision/recall trade-off)
  - [ ] Batch processing for efficiency
  - [ ] Caching for repeated queries
  - [ ] Fallback for embedding API failures
  - [ ] Cost tracking (embeddings are $$$)
  - [ ] Performance: <500ms for 1000 patterns

- [ ] **Step 4.3:** Confidence Scorer (confidence-scorer.ts)
  - [ ] Bayesian confidence updates
  - [ ] Decay function for stale patterns
  - [ ] Reinforcement learning from confirmations
  - [ ] Multi-source aggregation
  - [ ] Outlier detection
  - [ ] Unit tests for all scenarios
  - [ ] Performance: <10ms per score

- [ ] **Step 4.4:** Version Control (version-control.ts)
  - [ ] Git-like versioning for training data
  - [ ] Diff generation (what changed)
  - [ ] Rollback to any version
  - [ ] Branch/merge for A/B testing
  - [ ] Changelog generation
  - [ ] Migration scripts for version upgrades
  - [ ] Recovery from corrupted versions

## **PHASE 5: INTEGRATION (Glue Everything Together)** ⏳ Not Started

- [ ] **Step 5.1:** Integrate distillation into enrichment-service.ts
  - [ ] Load industry research config on scrape
  - [ ] Check content hash (avoid duplicate scrapes)
  - [ ] Save raw scrape to temporary_scrapes (with expiresAt)
  - [ ] Apply high-value signal detection
  - [ ] Filter fluff patterns
  - [ ] Calculate confidence scores
  - [ ] Save ONLY extracted signals to permanent CRM records (not raw HTML)
  - [ ] Verify 95%+ storage reduction
  - [ ] No performance regression (<10% slower)
  - [ ] Backward compatible (existing flows work)
  - [ ] Feature flag for gradual rollout
  - [ ] Monitor storage costs (should decrease over time)

- [ ] **Step 5.2:** Add training hooks to enrichment flow
  - [ ] Post-enrichment training suggestions
  - [ ] Auto-save training examples
  - [ ] Background processing (don't block enrichment)
  - [ ] Error handling (training failure doesn't break enrichment)
  - [ ] Metrics tracking (training acceptance rate)
  - [ ] Integration tests end-to-end

- [ ] **Step 5.3:** Create client feedback API route
  - [ ] POST /api/scraper/feedback endpoint
  - [ ] Request validation (Zod schema)
  - [ ] Auth check (organizationId validation)
  - [ ] Rate limiting (10 req/min per org)
  - [ ] Idempotency (duplicate submissions handled)
  - [ ] Error responses with proper HTTP codes
  - [ ] OpenAPI spec generated
  - [ ] Postman collection created

- [ ] **Step 5.4:** Auto-generate Custom Schemas from extractionSchema
  - [ ] Parse customFields from research config
  - [ ] Create Firestore schema fields
  - [ ] Type generation for TypeScript
  - [ ] Migration for existing schemas
  - [ ] Validation rules auto-generated
  - [ ] UI form fields auto-generated
  - [ ] Integration tests for schema creation

## **PHASE 6: USER INTERFACE** ⏳ Not Started

- [ ] **Step 6.1:** Scraper Training Center page
  - [ ] Next.js page with proper routing
  - [ ] SSR for initial data load
  - [ ] Loading states (no blank screens)
  - [ ] Error states (network failures, auth)
  - [ ] Empty states (no training data yet)
  - [ ] Responsive design (mobile-friendly)
  - [ ] Accessibility (WCAG AA compliant)
  - [ ] Performance: LCP <2.5s
  - [ ] E2E tests with Playwright

- [ ] **Step 6.2:** Extraction Verification component
  - [ ] Real-time extraction preview
  - [ ] Inline editing for corrections
  - [ ] Confidence visualization
  - [ ] Source highlighting (show where data came from)
  - [ ] Bulk actions (confirm all, reject all)
  - [ ] Undo/redo support
  - [ ] Keyboard shortcuts
  - [ ] Unit tests for all interactions
  - [ ] Storybook stories created

- [ ] **Step 6.3:** Training History & Analytics
  - [ ] Chart showing accuracy over time
  - [ ] List of all training sessions
  - [ ] Rollback UI (with confirmation)
  - [ ] Export training data (CSV/JSON)
  - [ ] Filtering and search
  - [ ] Pagination (handle 10,000+ entries)
  - [ ] Performance: render <1s for 1000 rows
  - [ ] E2E tests for workflows

- [ ] **Step 6.4:** Add training UI to enrichment results
  - [ ] "Train Scraper" button on enrichment cards
  - [ ] Modal for feedback submission
  - [ ] Optimistic updates (instant feedback)
  - [ ] Error handling (retry logic)
  - [ ] Success confirmation
  - [ ] Integration with existing UI
  - [ ] A/B test training adoption rate

## **PHASE 7: TESTING & QUALITY ASSURANCE** ⏳ Not Started

- [ ] **Step 7.1:** Unit Tests (100% coverage for critical paths)
  - [ ] Jest config updated
  - [ ] Tests for all service functions
  - [ ] Tests for all utility functions
  - [ ] Tests for all validation logic
  - [ ] Mock external APIs (OpenAI, Firestore)
  - [ ] Edge cases covered
  - [ ] All tests passing (no skipped tests)
  - [ ] Coverage report: >90%

- [ ] **Step 7.2:** Integration Tests
  - [ ] API route tests
  - [ ] Database operation tests
  - [ ] Service layer integration tests
  - [ ] Authentication flow tests
  - [ ] Error handling tests
  - [ ] Performance tests (load testing)
  - [ ] All tests passing
  - [ ] CI/CD pipeline configured

- [ ] **Step 7.3:** Real-world validation (10 industry templates)
  - [ ] Test each template against 5 real websites
  - [ ] Measure extraction accuracy (manual baseline)
  - [ ] Measure performance (time per scrape)
  - [ ] Identify and fix false positives/negatives
  - [ ] Document edge cases found
  - [ ] Create regression tests
  - [ ] Accuracy target: >85% for each industry

- [ ] **Step 7.4:** Version control & rollback testing
  - [ ] Test rollback to previous versions
  - [ ] Test data migration scripts
  - [ ] Test conflict resolution
  - [ ] Test concurrent updates
  - [ ] Test corrupted data recovery
  - [ ] Document rollback procedures
  - [ ] Create runbook for ops team

## **PHASE 8: PRODUCTION READINESS** ⏳ Not Started

- [ ] **Step 8.1:** Performance optimization
  - [ ] Implement Redis caching for hot paths
  - [ ] Database query optimization (indexes)
  - [ ] Lazy loading for UI components
  - [ ] Image optimization
  - [ ] Bundle size optimization (<200KB JS)
  - [ ] Load testing (1000 concurrent users)
  - [ ] Performance budget monitoring
  - [ ] Lighthouse score: >90

- [ ] **Step 8.2:** Security hardening
  - [ ] Input sanitization (XSS prevention)
  - [ ] SQL injection prevention (parameterized queries)
  - [ ] CSRF protection
  - [ ] Rate limiting on all endpoints
  - [ ] API key rotation strategy
  - [ ] Secrets management (environment variables)
  - [ ] Security audit completed
  - [ ] OWASP Top 10 mitigation verified

- [ ] **Step 8.3:** Monitoring & observability (including TTL tracking)
  - [ ] Structured logging (JSON format)
  - [ ] Error tracking (Sentry integration)
  - [ ] Performance monitoring (metrics)
  - [ ] Storage cost monitoring (Firestore usage trends)
  - [ ] TTL cleanup verification (ensure scrapes are deleted after 7 days)
  - [ ] Duplicate detection rate monitoring (hash collision tracking)
  - [ ] Distillation efficiency metrics (storage reduction %)
  - [ ] Usage analytics (PostHog/Mixpanel)
  - [ ] Alerting rules configured (cost spikes, TTL failures)
  - [ ] Dashboard created (Grafana/Datadog)
  - [ ] Runbook for common issues
  - [ ] On-call rotation defined

- [ ] **Step 8.4:** Documentation & training
  - [ ] Developer documentation (SCRAPER_INTELLIGENCE_GUIDE.md)
  - [ ] API documentation (OpenAPI spec)
  - [ ] User documentation (how-to guides)
  - [ ] Video tutorial (screen recording)
  - [ ] Changelog (CHANGELOG.md)
  - [ ] Migration guide (for existing users)
  - [ ] Internal training session conducted
  - [ ] Support team trained

- [ ] **Step 8.5:** Deployment & rollout strategy
  - [ ] Feature flag configuration
  - [ ] Gradual rollout plan (5% → 25% → 50% → 100%)
  - [ ] Rollback plan documented
  - [ ] Database migration scripts tested
  - [ ] Canary deployment configured
  - [ ] Blue-green deployment strategy
  - [ ] Post-deployment verification checklist
  - [ ] Success metrics defined

---

# 🎯 CURRENT STEP

**Status:** Waiting to start
**Next Step:** 1.1 - Extend IndustryTemplate interface

When you paste this prompt to begin, Step 1.1 will be loaded here with:
- Detailed implementation instructions
- Production-grade acceptance criteria
- Testing requirements
- Code review checklist

---

# 🏗️ ARCHITECTURE & CONSTRAINTS

## Technology Stack
- **Language:** TypeScript 5.x (strict mode enabled)
- **Framework:** Next.js 14 (App Router)
- **Database:** Firestore (Google Cloud)
- **AI/ML:** OpenAI API (GPT-4, Embeddings)
- **Testing:** Jest, React Testing Library, Playwright
- **Validation:** Zod
- **Logging:** Winston or Pino
- **Monitoring:** Sentry (errors), Vercel Analytics (performance)

## File Structure
```
src/
├── lib/
│   ├── enrichment/                    # Existing scraper
│   │   ├── enrichment-service.ts      # MODIFY: Add research intelligence
│   │   ├── ai-extractor.ts            # MODIFY: Industry-aware extraction
│   │   ├── browser-scraper.ts         # KEEP: No changes
│   │   └── web-scraper.ts             # KEEP: No changes
│   ├── persona/
│   │   └── industry-templates.ts      # MODIFY: Add research block
│   ├── scraper-intelligence/          # CREATE: New folder
│   │   ├── training-manager.ts        # CREATE
│   │   ├── pattern-matcher.ts         # CREATE
│   │   ├── confidence-scorer.ts       # CREATE
│   │   └── version-control.ts         # CREATE
│   └── db/
│       └── firestore-service.ts       # MODIFY: Add scraper collections
├── types/
│   └── scraper-intelligence.ts        # CREATE
├── app/
│   ├── api/
│   │   └── scraper/
│   │       ├── feedback/route.ts      # CREATE
│   │       └── training/route.ts      # CREATE
│   └── scraper-training/              # CREATE: New page
│       ├── page.tsx
│       └── layout.tsx
├── components/
│   └── scraper-training/              # CREATE: New components
│       ├── TrainingCenter.tsx
│       ├── ExtractionVerification.tsx
│       ├── TrainingHistory.tsx
│       └── AnalyticsDashboard.tsx
└── tests/
    ├── unit/
    │   └── scraper-intelligence/      # CREATE
    ├── integration/
    │   └── scraper-intelligence/      # CREATE
    └── e2e/
        └── scraper-training.spec.ts   # CREATE
```

## Performance Requirements
- **Extraction time:** <2s per lead (95th percentile)
- **Feedback submission:** <500ms response time
- **Training UI load:** <1s initial render
- **Database queries:** <100ms (with indexes)
- **Memory usage:** <512MB per scraping instance
- **Concurrent scrapes:** Support 100+ simultaneous

## Security Requirements
- **Authentication:** Every API call must verify organizationId
- **Authorization:** Users can only access their org's data
- **Input validation:** All user inputs validated with Zod
- **Rate limiting:** 100 req/min per org (enrichment), 10 req/min (training)
- **Data sanitization:** All scraped content sanitized before storage
- **API keys:** Never exposed in client code, use environment variables

## Quality Gates (Must Pass to Deploy)

### Code Quality
- [ ] TypeScript compiles with zero errors/warnings
- [ ] ESLint passes with zero errors
- [ ] Prettier formatting applied
- [ ] No `any` types (except justified with comment)
- [ ] No `console.log` (use logger)
- [ ] No hardcoded values (use constants/env vars)

### Testing
- [ ] All unit tests pass (>90% coverage)
- [ ] All integration tests pass
- [ ] All E2E tests pass
- [ ] Manual QA completed (test plan executed)
- [ ] Performance tests meet SLA

### Documentation
- [ ] All public APIs documented (JSDoc)
- [ ] README updated
- [ ] CHANGELOG updated
- [ ] Migration guide written (if needed)

### Security
- [ ] No secrets in code
- [ ] Input validation on all endpoints
- [ ] OWASP Top 10 reviewed
- [ ] Dependencies scanned (no critical vulnerabilities)

---

# 📋 IMPLEMENTATION WORKFLOW

## For Each Step:

### 1️⃣ BEFORE WRITING CODE

**Review Phase (15-20 minutes):**
```
1. Read ALL relevant existing code
   - Use ReadFile for files you'll modify
   - Use SemanticSearch to understand context
   - Use Grep to find related patterns

2. Understand the bigger picture
   - How does this fit with existing architecture?
   - What dependencies exist?
   - What could break?

3. Plan the implementation
   - What files need to change?
   - What's the order of operations?
   - What edge cases exist?

4. Check for existing patterns
   - Is there similar code in the codebase?
   - What patterns are already used?
   - Don't reinvent the wheel
```

### 2️⃣ DURING IMPLEMENTATION

**Coding Phase (30-60 minutes):**
```
1. Start with types and interfaces
   - Define TypeScript types first
   - Add Zod schemas for validation
   - Add JSDoc comments

2. Implement core logic
   - Write the happy path first
   - Add error handling
   - Add logging
   - Add comments for complex logic

3. Add validation and error handling
   - Validate all inputs
   - Handle all error cases
   - Use try/catch appropriately
   - Return meaningful error messages

4. Optimize for performance
   - Cache where appropriate
   - Use parallel operations (Promise.all)
   - Avoid N+1 queries
   - Add indexes for database queries
```

### 3️⃣ TESTING & VALIDATION

**Quality Assurance Phase (30-45 minutes):**
```
1. Write unit tests
   - Test happy path
   - Test error cases
   - Test edge cases (null, empty, invalid)
   - Aim for >90% coverage

2. Write integration tests (if applicable)
   - Test service interactions
   - Test database operations
   - Test API endpoints

3. Manual testing
   - Test in development environment
   - Try to break it
   - Check edge cases
   - Verify performance

4. Check for issues
   - Run TypeScript compiler
   - Run ESLint
   - Run tests
   - Use ReadLints to check for errors
```

### 4️⃣ CODE REVIEW CHECKLIST

**Self-Review Phase (15 minutes):**
```
Code Quality:
- [ ] No TypeScript errors or warnings
- [ ] No ESLint errors
- [ ] No `any` types (or justified)
- [ ] Consistent naming conventions
- [ ] No magic numbers (use constants)
- [ ] No console.log (use logger)

Error Handling:
- [ ] All async operations have try/catch
- [ ] All errors are logged with context
- [ ] User-friendly error messages
- [ ] Errors don't expose sensitive info

Performance:
- [ ] No unnecessary re-renders (React)
- [ ] Database queries optimized
- [ ] Caching implemented where appropriate
- [ ] No memory leaks

Security:
- [ ] All inputs validated
- [ ] No SQL injection risk
- [ ] No XSS vulnerabilities
- [ ] Auth checks present
- [ ] Rate limiting implemented

Testing:
- [ ] Unit tests written and passing
- [ ] Integration tests written (if needed)
- [ ] Edge cases covered
- [ ] Coverage >90% for critical paths

Documentation:
- [ ] JSDoc comments added
- [ ] Complex logic explained
- [ ] README updated (if needed)
- [ ] API docs updated (if needed)
```

### 5️⃣ COMMIT & UPDATE

**Git Workflow:**
```bash
# Stage changes
git add .

# Commit with descriptive message
git commit -m "feat(scraper-intelligence): [Step X.Y] [What was done]

- Detailed point 1
- Detailed point 2
- Detailed point 3

Tests: [X unit, Y integration]
Coverage: [%]
Performance: [metrics]"

# Push to dev branch
git push origin dev
```

**Prompt Update:**
```
1. Mark step as complete: [x] Step X.Y
2. Update CURRENT STEP section with next step
3. Add any learnings or notes
4. Copy updated prompt for next session
```

---

# 🚦 STEP 1.1: EXTEND INDUSTRYTEMPLATE INTERFACE

## 📝 Detailed Implementation Instructions

### Goal
Extend the `IndustryTemplate` interface to support research intelligence that guides the web scraper on what to extract, where to look, and how to score leads.

### Prerequisites
- Read `src/lib/persona/industry-templates.ts` (entire file)
- Understand current structure (49 templates with 5 sections each)
- Review `src/lib/enrichment/types.ts` for existing types
- Check `src/types/` for type organization patterns

### Implementation Steps

#### 1. Create New Type Definitions File

**File:** `src/types/scraper-intelligence.ts`

```typescript
/**
 * Scraper Intelligence Types
 * Defines the research intelligence layer for industry-specific web scraping
 */

import { z } from 'zod';

// ============================================================================
// CORE TYPES
// ============================================================================

/**
 * Field types supported in custom extraction schemas
 */
export type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';

/**
 * Platforms that can be scraped or searched
 */
export type ScrapingPlatform = 
  | 'website'           // Company website (always available)
  | 'linkedin-jobs'     // LinkedIn job postings (via API or scraping)
  | 'linkedin-company'  // LinkedIn company page (limited)
  | 'news'              // News articles (via NewsAPI)
  | 'crunchbase'        // Funding data (via API, requires key)
  | 'dns'               // DNS/WHOIS data (free)
  | 'google-business'   // Google Business Profile (requires API)
  | 'social-media';     // Generic social media (Facebook, Twitter, Instagram)

/**
 * Priority levels for signals and extraction
 */
export type SignalPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Actions to take when a high-value signal is detected
 */
export type SignalAction = 
  | 'increase-score'     // Boost lead score
  | 'trigger-workflow'   // Start an automated workflow
  | 'add-to-segment'     // Add to a specific audience segment
  | 'notify-user'        // Send notification to user
  | 'flag-for-review';   // Mark for manual review

/**
 * Scraping frequency options
 */
export type ScrapingFrequency = 
  | 'per-lead'    // Scrape every time a lead is enriched
  | 'daily'       // Scrape once per day (for company updates)
  | 'weekly'      // Scrape once per week
  | 'on-change';  // Scrape only when website changes detected

// ============================================================================
// SCRAPING STRATEGY
// ============================================================================

/**
 * Defines which platforms to scrape and in what order
 */
export interface ScrapingStrategy {
  /**
   * Primary data source (always scraped first)
   */
  primarySource: ScrapingPlatform;

  /**
   * Secondary sources (scraped in parallel or as fallback)
   */
  secondarySources: ScrapingPlatform[];

  /**
   * How often to refresh data for this industry
   */
  frequency: ScrapingFrequency;

  /**
   * Maximum time to spend scraping (ms)
   * Used to prevent timeout for slow sites
   */
  timeoutMs?: number;

  /**
   * Whether to use cache for this industry
   * Some industries need fresh data (news), others can cache (company info)
   */
  enableCaching: boolean;

  /**
   * Cache TTL in seconds
   */
  cacheTtlSeconds?: number;
}

// Zod schema for validation
export const ScrapingStrategySchema = z.object({
  primarySource: z.enum([
    'website',
    'linkedin-jobs',
    'linkedin-company',
    'news',
    'crunchbase',
    'dns',
    'google-business',
    'social-media',
  ]),
  secondarySources: z.array(z.enum([
    'website',
    'linkedin-jobs',
    'linkedin-company',
    'news',
    'crunchbase',
    'dns',
    'google-business',
    'social-media',
  ])),
  frequency: z.enum(['per-lead', 'daily', 'weekly', 'on-change']),
  timeoutMs: z.number().positive().optional(),
  enableCaching: z.boolean(),
  cacheTtlSeconds: z.number().positive().optional(),
});

// ============================================================================
// HIGH-VALUE SIGNALS
// ============================================================================

/**
 * Defines a pattern or keyword that indicates a high-quality lead
 */
export interface HighValueSignal {
  /**
   * Unique identifier for this signal
   */
  id: string;

  /**
   * Human-readable label
   */
  label: string;

  /**
   * Description of what this signal means
   */
  description: string;

  /**
   * Keywords or phrases to search for (case-insensitive)
   */
  keywords: string[];

  /**
   * Regex pattern for more complex matching (optional)
   */
  regexPattern?: string;

  /**
   * Which platform to look for this signal
   */
  platform: ScrapingPlatform | 'any';

  /**
   * Priority level (affects lead score boost)
   */
  priority: SignalPriority;

  /**
   * What to do when this signal is detected
   */
  action: SignalAction;

  /**
   * Points to add to lead score if detected
   */
  scoreBoost: number;

  /**
   * Additional context for training/debugging
   */
  examples?: string[];
}

// Zod schema
export const HighValueSignalSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().min(1),
  keywords: z.array(z.string()).min(1),
  regexPattern: z.string().optional(),
  platform: z.union([
    z.enum([
      'website',
      'linkedin-jobs',
      'linkedin-company',
      'news',
      'crunchbase',
      'dns',
      'google-business',
      'social-media',
    ]),
    z.literal('any'),
  ]),
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
  action: z.enum([
    'increase-score',
    'trigger-workflow',
    'add-to-segment',
    'notify-user',
    'flag-for-review',
  ]),
  scoreBoost: z.number().int().min(0).max(100),
  examples: z.array(z.string()).optional(),
});

// ============================================================================
// FLUFF PATTERNS
// ============================================================================

/**
 * Defines text patterns to ignore as noise/boilerplate
 */
export interface FluffPattern {
  /**
   * Unique identifier
   */
  id: string;

  /**
   * Regex pattern to match
   */
  pattern: string;

  /**
   * Description of what this filters
   */
  description: string;

  /**
   * Where this pattern applies (optional, default: all)
   */
  context?: 'header' | 'footer' | 'sidebar' | 'body' | 'all';

  /**
   * Examples of text this pattern would match
   */
  examples?: string[];
}

// Zod schema
export const FluffPatternSchema = z.object({
  id: z.string().min(1),
  pattern: z.string().min(1),
  description: z.string().min(1),
  context: z.enum(['header', 'footer', 'sidebar', 'body', 'all']).optional(),
  examples: z.array(z.string()).optional(),
});

// ============================================================================
// SCORING RULES
// ============================================================================

/**
 * Defines conditional logic for boosting lead scores
 */
export interface ScoringRule {
  /**
   * Unique identifier
   */
  id: string;

  /**
   * Human-readable name
   */
  name: string;

  /**
   * Description of what triggers this rule
   */
  description: string;

  /**
   * Condition expression (evaluated as JavaScript)
   * Example: "careers_page_exists && hiring_count > 0"
   */
  condition: string;

  /**
   * Points to add if condition is true
   */
  scoreBoost: number;

  /**
   * Priority (rules evaluated in priority order)
   */
  priority: number;

  /**
   * Whether this rule is enabled
   */
  enabled: boolean;
}

// Zod schema
export const ScoringRuleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  condition: z.string().min(1),
  scoreBoost: z.number().int(),
  priority: z.number().int().min(1),
  enabled: z.boolean(),
});

// ============================================================================
// CUSTOM EXTRACTION FIELDS
// ============================================================================

/**
 * Defines a custom field to extract from scraped data
 */
export interface CustomField {
  /**
   * Field key (used in database)
   */
  key: string;

  /**
   * Human-readable label
   */
  label: string;

  /**
   * Data type
   */
  type: FieldType;

  /**
   * Description of what this field represents
   */
  description: string;

  /**
   * Keywords or patterns to identify this field's value
   */
  extractionHints: string[];

  /**
   * Whether this field is required
   */
  required: boolean;

  /**
   * Default value if not found
   */
  defaultValue?: any;

  /**
   * Validation rule (Zod schema as string)
   */
  validation?: string;
}

// Zod schema
export const CustomFieldSchema = z.object({
  key: z.string().min(1).regex(/^[a-z_][a-z0-9_]*$/), // snake_case
  label: z.string().min(1),
  type: z.enum(['string', 'number', 'boolean', 'date', 'array', 'object']),
  description: z.string().min(1),
  extractionHints: z.array(z.string()),
  required: z.boolean(),
  defaultValue: z.any().optional(),
  validation: z.string().optional(),
});

// ============================================================================
// RESEARCH INTELLIGENCE (Main Interface)
// ============================================================================

/**
 * Complete research intelligence configuration for an industry
 * This guides the scraper on what to extract and how to score leads
 */
export interface ResearchIntelligence {
  /**
   * Scraping strategy for this industry
   */
  scrapingStrategy: ScrapingStrategy;

  /**
   * High-value signals to detect
   */
  highValueSignals: HighValueSignal[];

  /**
   * Patterns to filter out as noise
   */
  fluffPatterns: FluffPattern[];

  /**
   * Scoring rules for lead qualification
   */
  scoringRules: ScoringRule[];

  /**
   * Custom fields to extract (industry-specific)
   */
  customFields: CustomField[];

  /**
   * Metadata
   */
  metadata: {
    /**
     * Last updated timestamp
     */
    lastUpdated: Date;

    /**
     * Version number (for migration)
     */
    version: number;

    /**
     * Who created/updated this (system or user)
     */
    updatedBy: 'system' | 'user';

    /**
     * Notes or changelog
     */
    notes?: string;
  };
}

// Zod schema
export const ResearchIntelligenceSchema = z.object({
  scrapingStrategy: ScrapingStrategySchema,
  highValueSignals: z.array(HighValueSignalSchema),
  fluffPatterns: z.array(FluffPatternSchema),
  scoringRules: z.array(ScoringRuleSchema),
  customFields: z.array(CustomFieldSchema),
  metadata: z.object({
    lastUpdated: z.date(),
    version: z.number().int().positive(),
    updatedBy: z.enum(['system', 'user']),
    notes: z.string().optional(),
  }),
});

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard to check if a value is a valid ResearchIntelligence object
 */
export function isResearchIntelligence(value: unknown): value is ResearchIntelligence {
  try {
    ResearchIntelligenceSchema.parse(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Type guard for HighValueSignal
 */
export function isHighValueSignal(value: unknown): value is HighValueSignal {
  try {
    HighValueSignalSchema.parse(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Type guard for FluffPattern
 */
export function isFluffPattern(value: unknown): value is FluffPattern {
  try {
    FluffPatternSchema.parse(value);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate total possible score boost from all signals
 */
export function calculateMaxScore(research: ResearchIntelligence): number {
  const signalScore = research.highValueSignals.reduce(
    (sum, signal) => sum + signal.scoreBoost,
    0
  );
  const ruleScore = research.scoringRules
    .filter((rule) => rule.enabled)
    .reduce((sum, rule) => sum + rule.scoreBoost, 0);

  return signalScore + ruleScore;
}

/**
 * Get all keywords across all high-value signals
 */
export function getAllKeywords(research: ResearchIntelligence): string[] {
  const keywords = research.highValueSignals.flatMap((signal) => signal.keywords);
  return Array.from(new Set(keywords.map((k) => k.toLowerCase())));
}

/**
 * Get all fluff patterns as compiled RegExp objects
 */
export function getFluffRegexes(research: ResearchIntelligence): RegExp[] {
  return research.fluffPatterns
    .map((pattern) => {
      try {
        return new RegExp(pattern.pattern, 'gi');
      } catch (error) {
        console.error(`Invalid regex pattern: ${pattern.pattern}`, error);
        return null;
      }
    })
    .filter((regex): regex is RegExp => regex !== null);
}
```

**Requirements:**
- [ ] File created with all types defined
- [ ] Zod schemas added for runtime validation
- [ ] JSDoc comments on all interfaces
- [ ] Type guards implemented
- [ ] Helper functions added
- [ ] No TypeScript errors
- [ ] Imports resolve correctly

#### 2. Extend IndustryTemplate Interface

**File:** `src/lib/persona/industry-templates.ts`

**Add to the top of the file (after existing imports):**

```typescript
import type { ResearchIntelligence } from '@/types/scraper-intelligence';
```

**Modify the IndustryTemplate interface:**

```typescript
export interface IndustryTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  
  coreIdentity: {
    title: string;
    positioning: string;
    tone: string;
  };
  
  cognitiveLogic: {
    framework: string;
    reasoning: string;
    decisionProcess: string;
  };
  
  knowledgeRAG: {
    static: string[];
    dynamic: string[];
  };
  
  learningLoops: {
    patternRecognition: string;
    adaptation: string;
    feedbackIntegration: string;
  };
  
  tacticalExecution: {
    primaryAction: string;
    conversionRhythm: string;
    secondaryActions: string[];
  };

  /**
   * Research Intelligence (NEW)
   * 
   * Guides the web scraper on what data to extract, where to look,
   * and how to score leads for this industry.
   * 
   * Optional for backward compatibility with existing templates.
   * 
   * @see ResearchIntelligence for full type definition
   */
  research?: ResearchIntelligence;
}
```

**Requirements:**
- [ ] Interface extended with optional `research` field
- [ ] Import added
- [ ] JSDoc comment added
- [ ] Backward compatible (existing 49 templates still work)
- [ ] No TypeScript errors

#### 3. Create Helper Functions

**Add to bottom of `src/lib/persona/industry-templates.ts`:**

```typescript
// ============================================================================
// RESEARCH INTELLIGENCE HELPERS
// ============================================================================

/**
 * Check if a template has research intelligence configured
 */
export function hasResearchIntelligence(template: IndustryTemplate): boolean {
  return template.research !== undefined && template.research !== null;
}

/**
 * Get research intelligence from template, or return null
 */
export function getResearchIntelligence(
  template: IndustryTemplate
): ResearchIntelligence | null {
  return template.research ?? null;
}

/**
 * Get industry template by ID
 */
export function getTemplateById(templateId: string): IndustryTemplate | null {
  return INDUSTRY_TEMPLATES[templateId] ?? null;
}

/**
 * Get research intelligence by industry ID
 */
export function getResearchIntelligenceById(
  industryId: string
): ResearchIntelligence | null {
  const template = getTemplateById(industryId);
  return template ? getResearchIntelligence(template) : null;
}

/**
 * Get all templates that have research intelligence configured
 */
export function getTemplatesWithResearch(): IndustryTemplate[] {
  return Object.values(INDUSTRY_TEMPLATES).filter(hasResearchIntelligence);
}

/**
 * Validate research intelligence configuration
 */
export function validateResearchIntelligence(
  research: unknown
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  try {
    ResearchIntelligenceSchema.parse(research);
    return { valid: true, errors: [] };
  } catch (error: any) {
    if (error.errors) {
      error.errors.forEach((err: any) => {
        errors.push(`${err.path.join('.')}: ${err.message}`);
      });
    } else {
      errors.push(error.message || 'Unknown validation error');
    }
    return { valid: false, errors };
  }
}
```

**Requirements:**
- [ ] Helper functions added
- [ ] All functions have JSDoc
- [ ] Type-safe implementations
- [ ] Error handling included
- [ ] Unit tests written (see next section)

#### 4. Write Unit Tests

**File:** `tests/unit/scraper-intelligence/types.test.ts` (CREATE)

```typescript
import { describe, it, expect } from '@jest/globals';
import {
  isResearchIntelligence,
  isHighValueSignal,
  isFluffPattern,
  calculateMaxScore,
  getAllKeywords,
  getFluffRegexes,
  type ResearchIntelligence,
  type HighValueSignal,
  type FluffPattern,
} from '@/types/scraper-intelligence';

describe('Scraper Intelligence Types', () => {
  describe('Type Guards', () => {
    it('should validate valid ResearchIntelligence object', () => {
      const valid: ResearchIntelligence = {
        scrapingStrategy: {
          primarySource: 'website',
          secondarySources: ['linkedin-jobs'],
          frequency: 'per-lead',
          enableCaching: true,
          cacheTtlSeconds: 3600,
        },
        highValueSignals: [],
        fluffPatterns: [],
        scoringRules: [],
        customFields: [],
        metadata: {
          lastUpdated: new Date(),
          version: 1,
          updatedBy: 'system',
        },
      };

      expect(isResearchIntelligence(valid)).toBe(true);
    });

    it('should reject invalid ResearchIntelligence object', () => {
      const invalid = {
        scrapingStrategy: {
          primarySource: 'invalid-source', // Invalid
        },
      };

      expect(isResearchIntelligence(invalid)).toBe(false);
    });

    it('should validate HighValueSignal', () => {
      const valid: HighValueSignal = {
        id: 'test-signal',
        label: 'Test Signal',
        description: 'A test signal',
        keywords: ['test'],
        platform: 'website',
        priority: 'HIGH',
        action: 'increase-score',
        scoreBoost: 10,
      };

      expect(isHighValueSignal(valid)).toBe(true);
    });

    it('should reject invalid HighValueSignal (missing required fields)', () => {
      const invalid = {
        label: 'Test',
        // Missing required fields
      };

      expect(isHighValueSignal(invalid)).toBe(false);
    });

    it('should reject HighValueSignal with invalid priority', () => {
      const invalid = {
        id: 'test',
        label: 'Test',
        description: 'Test',
        keywords: ['test'],
        platform: 'website',
        priority: 'INVALID', // Invalid priority
        action: 'increase-score',
        scoreBoost: 10,
      };

      expect(isHighValueSignal(invalid)).toBe(false);
    });

    it('should validate FluffPattern', () => {
      const valid: FluffPattern = {
        id: 'test-pattern',
        pattern: '.*boilerplate.*',
        description: 'Remove boilerplate',
      };

      expect(isFluffPattern(valid)).toBe(true);
    });
  });

  describe('Helper Functions', () => {
    it('should calculate max score correctly', () => {
      const research: ResearchIntelligence = {
        scrapingStrategy: {
          primarySource: 'website',
          secondarySources: [],
          frequency: 'per-lead',
          enableCaching: true,
        },
        highValueSignals: [
          {
            id: 'signal-1',
            label: 'Signal 1',
            description: 'Test',
            keywords: ['test'],
            platform: 'website',
            priority: 'HIGH',
            action: 'increase-score',
            scoreBoost: 20,
          },
          {
            id: 'signal-2',
            label: 'Signal 2',
            description: 'Test',
            keywords: ['test'],
            platform: 'website',
            priority: 'MEDIUM',
            action: 'increase-score',
            scoreBoost: 10,
          },
        ],
        fluffPatterns: [],
        scoringRules: [
          {
            id: 'rule-1',
            name: 'Rule 1',
            description: 'Test rule',
            condition: 'true',
            scoreBoost: 15,
            priority: 1,
            enabled: true,
          },
          {
            id: 'rule-2',
            name: 'Rule 2',
            description: 'Disabled rule',
            condition: 'true',
            scoreBoost: 100, // Should be ignored (disabled)
            priority: 2,
            enabled: false,
          },
        ],
        customFields: [],
        metadata: {
          lastUpdated: new Date(),
          version: 1,
          updatedBy: 'system',
        },
      };

      const maxScore = calculateMaxScore(research);
      expect(maxScore).toBe(45); // 20 + 10 + 15 (disabled rule ignored)
    });

    it('should extract all unique keywords', () => {
      const research: ResearchIntelligence = {
        scrapingStrategy: {
          primarySource: 'website',
          secondarySources: [],
          frequency: 'per-lead',
          enableCaching: true,
        },
        highValueSignals: [
          {
            id: '1',
            label: 'S1',
            description: 'D1',
            keywords: ['emergency', 'urgent', 'EMERGENCY'], // Duplicate (different case)
            platform: 'website',
            priority: 'HIGH',
            action: 'increase-score',
            scoreBoost: 10,
          },
          {
            id: '2',
            label: 'S2',
            description: 'D2',
            keywords: ['hiring', 'jobs'],
            platform: 'linkedin-jobs',
            priority: 'MEDIUM',
            action: 'increase-score',
            scoreBoost: 5,
          },
        ],
        fluffPatterns: [],
        scoringRules: [],
        customFields: [],
        metadata: {
          lastUpdated: new Date(),
          version: 1,
          updatedBy: 'system',
        },
      };

      const keywords = getAllKeywords(research);
      expect(keywords).toHaveLength(4); // emergency, urgent, hiring, jobs (duplicates removed)
      expect(keywords).toContain('emergency');
      expect(keywords).toContain('urgent');
      expect(keywords).toContain('hiring');
      expect(keywords).toContain('jobs');
      expect(keywords.every((k) => k === k.toLowerCase())).toBe(true); // All lowercase
    });

    it('should compile fluff patterns to RegExp objects', () => {
      const research: ResearchIntelligence = {
        scrapingStrategy: {
          primarySource: 'website',
          secondarySources: [],
          frequency: 'per-lead',
          enableCaching: true,
        },
        highValueSignals: [],
        fluffPatterns: [
          {
            id: '1',
            pattern: 'All rights reserved',
            description: 'Copyright notice',
          },
          {
            id: '2',
            pattern: 'Privacy Policy',
            description: 'Privacy link',
          },
          {
            id: '3',
            pattern: '[invalid regex', // Invalid regex should be filtered
            description: 'Bad pattern',
          },
        ],
        scoringRules: [],
        customFields: [],
        metadata: {
          lastUpdated: new Date(),
          version: 1,
          updatedBy: 'system',
        },
      };

      const regexes = getFluffRegexes(research);
      expect(regexes).toHaveLength(2); // Invalid regex excluded
      expect(regexes[0].test('All rights reserved 2025')).toBe(true);
      expect(regexes[1].test('Check our Privacy Policy')).toBe(true);
    });

    it('should handle invalid regex patterns gracefully', () => {
      const research: ResearchIntelligence = {
        scrapingStrategy: {
          primarySource: 'website',
          secondarySources: [],
          frequency: 'per-lead',
          enableCaching: true,
        },
        highValueSignals: [],
        fluffPatterns: [
          {
            id: '1',
            pattern: '[[[invalid',
            description: 'Bad pattern',
          },
        ],
        scoringRules: [],
        customFields: [],
        metadata: {
          lastUpdated: new Date(),
          version: 1,
          updatedBy: 'system',
        },
      };

      // Should not throw, should return empty array
      expect(() => getFluffRegexes(research)).not.toThrow();
      expect(getFluffRegexes(research)).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty highValueSignals array', () => {
      const research: ResearchIntelligence = {
        scrapingStrategy: {
          primarySource: 'website',
          secondarySources: [],
          frequency: 'per-lead',
          enableCaching: true,
        },
        highValueSignals: [],
        fluffPatterns: [],
        scoringRules: [],
        customFields: [],
        metadata: {
          lastUpdated: new Date(),
          version: 1,
          updatedBy: 'system',
        },
      };

      expect(calculateMaxScore(research)).toBe(0);
      expect(getAllKeywords(research)).toEqual([]);
    });

    it('should handle null/undefined values', () => {
      expect(isResearchIntelligence(null)).toBe(false);
      expect(isResearchIntelligence(undefined)).toBe(false);
      expect(isHighValueSignal(null)).toBe(false);
      expect(isFluffPattern(undefined)).toBe(false);
    });

    it('should reject negative scoreBoost values', () => {
      const invalid = {
        id: 'test',
        label: 'Test',
        description: 'Test',
        keywords: ['test'],
        platform: 'website',
        priority: 'HIGH',
        action: 'increase-score',
        scoreBoost: -10, // Invalid: negative
      };

      expect(isHighValueSignal(invalid)).toBe(false);
    });

    it('should reject scoreBoost > 100', () => {
      const invalid = {
        id: 'test',
        label: 'Test',
        description: 'Test',
        keywords: ['test'],
        platform: 'website',
        priority: 'HIGH',
        action: 'increase-score',
        scoreBoost: 150, // Invalid: > 100
      };

      expect(isHighValueSignal(invalid)).toBe(false);
    });

    it('should require at least one keyword in HighValueSignal', () => {
      const invalid = {
        id: 'test',
        label: 'Test',
        description: 'Test',
        keywords: [], // Invalid: empty array
        platform: 'website',
        priority: 'HIGH',
        action: 'increase-score',
        scoreBoost: 10,
      };

      expect(isHighValueSignal(invalid)).toBe(false);
    });

    it('should validate custom field key format (snake_case)', () => {
      const validField = {
        key: 'valid_field_name',
        label: 'Valid Field',
        type: 'string',
        description: 'A valid field',
        extractionHints: ['hint'],
        required: false,
      };

      const invalidField1 = {
        ...validField,
        key: 'Invalid-Field', // Invalid: kebab-case
      };

      const invalidField2 = {
        ...validField,
        key: 'InvalidField', // Invalid: PascalCase
      };

      const invalidField3 = {
        ...validField,
        key: '123_invalid', // Invalid: starts with number
      };

      // Note: We'd need to test these through CustomFieldSchema.parse()
      // For now, just verify the regex in the schema catches these
    });
  });
});
```

**File:** `tests/unit/scraper-intelligence/industry-templates.test.ts` (CREATE)

```typescript
import { describe, it, expect } from '@jest/globals';
import {
  hasResearchIntelligence,
  getResearchIntelligence,
  getTemplateById,
  getResearchIntelligenceById,
  getTemplatesWithResearch,
  validateResearchIntelligence,
  INDUSTRY_TEMPLATES,
  type IndustryTemplate,
} from '@/lib/persona/industry-templates';
import type { ResearchIntelligence } from '@/types/scraper-intelligence';

describe('Industry Template Research Intelligence Helpers', () => {
  describe('hasResearchIntelligence', () => {
    it('should return false for templates without research', () => {
      const template: IndustryTemplate = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        category: 'Test',
        coreIdentity: { title: '', positioning: '', tone: '' },
        cognitiveLogic: { framework: '', reasoning: '', decisionProcess: '' },
        knowledgeRAG: { static: [], dynamic: [] },
        learningLoops: {
          patternRecognition: '',
          adaptation: '',
          feedbackIntegration: '',
        },
        tacticalExecution: {
          primaryAction: '',
          conversionRhythm: '',
          secondaryActions: [],
        },
        // No research field
      };

      expect(hasResearchIntelligence(template)).toBe(false);
    });

    it('should return true for templates with research', () => {
      const research: ResearchIntelligence = {
        scrapingStrategy: {
          primarySource: 'website',
          secondarySources: [],
          frequency: 'per-lead',
          enableCaching: true,
        },
        highValueSignals: [],
        fluffPatterns: [],
        scoringRules: [],
        customFields: [],
        metadata: {
          lastUpdated: new Date(),
          version: 1,
          updatedBy: 'system',
        },
      };

      const template: IndustryTemplate = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        category: 'Test',
        coreIdentity: { title: '', positioning: '', tone: '' },
        cognitiveLogic: { framework: '', reasoning: '', decisionProcess: '' },
        knowledgeRAG: { static: [], dynamic: [] },
        learningLoops: {
          patternRecognition: '',
          adaptation: '',
          feedbackIntegration: '',
        },
        tacticalExecution: {
          primaryAction: '',
          conversionRhythm: '',
          secondaryActions: [],
        },
        research,
      };

      expect(hasResearchIntelligence(template)).toBe(true);
    });
  });

  describe('getResearchIntelligence', () => {
    it('should return null if template has no research', () => {
      const template: IndustryTemplate = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        category: 'Test',
        coreIdentity: { title: '', positioning: '', tone: '' },
        cognitiveLogic: { framework: '', reasoning: '', decisionProcess: '' },
        knowledgeRAG: { static: [], dynamic: [] },
        learningLoops: {
          patternRecognition: '',
          adaptation: '',
          feedbackIntegration: '',
        },
        tacticalExecution: {
          primaryAction: '',
          conversionRhythm: '',
          secondaryActions: [],
        },
      };

      expect(getResearchIntelligence(template)).toBeNull();
    });

    it('should return research object if present', () => {
      const research: ResearchIntelligence = {
        scrapingStrategy: {
          primarySource: 'website',
          secondarySources: [],
          frequency: 'per-lead',
          enableCaching: true,
        },
        highValueSignals: [],
        fluffPatterns: [],
        scoringRules: [],
        customFields: [],
        metadata: {
          lastUpdated: new Date(),
          version: 1,
          updatedBy: 'system',
        },
      };

      const template: IndustryTemplate = {
        id: 'test',
        name: 'Test',
        description: 'Test',
        category: 'Test',
        coreIdentity: { title: '', positioning: '', tone: '' },
        cognitiveLogic: { framework: '', reasoning: '', decisionProcess: '' },
        knowledgeRAG: { static: [], dynamic: [] },
        learningLoops: {
          patternRecognition: '',
          adaptation: '',
          feedbackIntegration: '',
        },
        tacticalExecution: {
          primaryAction: '',
          conversionRhythm: '',
          secondaryActions: [],
        },
        research,
      };

      expect(getResearchIntelligence(template)).toBe(research);
    });
  });

  describe('getTemplateById', () => {
    it('should return null for non-existent template', () => {
      expect(getTemplateById('non-existent-id')).toBeNull();
    });

    it('should return template if it exists', () => {
      // Assuming 'residential-real-estate' exists in INDUSTRY_TEMPLATES
      const template = getTemplateById('residential-real-estate');
      expect(template).not.toBeNull();
      expect(template?.id).toBe('residential-real-estate');
    });
  });

  describe('getResearchIntelligenceById', () => {
    it('should return null for non-existent template', () => {
      expect(getResearchIntelligenceById('non-existent')).toBeNull();
    });

    it('should return null for template without research', () => {
      // Most existing templates won't have research yet
      const template = getTemplateById('residential-real-estate');
      if (template && !template.research) {
        expect(getResearchIntelligenceById('residential-real-estate')).toBeNull();
      }
    });
  });

  describe('getTemplatesWithResearch', () => {
    it('should return only templates with research', () => {
      const templatesWithResearch = getTemplatesWithResearch();
      
      templatesWithResearch.forEach((template) => {
        expect(template.research).toBeDefined();
        expect(template.research).not.toBeNull();
      });
    });

    it('should return empty array if no templates have research', () => {
      // Initially, no templates will have research
      const templatesWithResearch = getTemplatesWithResearch();
      expect(Array.isArray(templatesWithResearch)).toBe(true);
    });
  });

  describe('validateResearchIntelligence', () => {
    it('should validate correct research object', () => {
      const valid: ResearchIntelligence = {
        scrapingStrategy: {
          primarySource: 'website',
          secondarySources: ['linkedin-jobs'],
          frequency: 'per-lead',
          enableCaching: true,
          cacheTtlSeconds: 3600,
        },
        highValueSignals: [
          {
            id: 'test-signal',
            label: 'Test Signal',
            description: 'A test signal',
            keywords: ['test', 'keyword'],
            platform: 'website',
            priority: 'HIGH',
            action: 'increase-score',
            scoreBoost: 15,
          },
        ],
        fluffPatterns: [
          {
            id: 'test-pattern',
            pattern: '.*boilerplate.*',
            description: 'Remove boilerplate',
            context: 'footer',
          },
        ],
        scoringRules: [
          {
            id: 'test-rule',
            name: 'Test Rule',
            description: 'A test rule',
            condition: 'hiring_count > 0',
            scoreBoost: 10,
            priority: 1,
            enabled: true,
          },
        ],
        customFields: [
          {
            key: 'custom_field',
            label: 'Custom Field',
            type: 'string',
            description: 'A custom field',
            extractionHints: ['hint1', 'hint2'],
            required: false,
          },
        ],
        metadata: {
          lastUpdated: new Date(),
          version: 1,
          updatedBy: 'system',
          notes: 'Test notes',
        },
      };

      const result = validateResearchIntelligence(valid);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid research object', () => {
      const invalid = {
        scrapingStrategy: {
          primarySource: 'invalid-source', // Invalid
          secondarySources: [],
          frequency: 'per-lead',
          enableCaching: true,
        },
        // Missing required fields
      };

      const result = validateResearchIntelligence(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should provide detailed error messages', () => {
      const invalid = {
        scrapingStrategy: {
          primarySource: 'website',
          secondarySources: [],
          frequency: 'invalid-frequency', // Invalid
          enableCaching: true,
        },
        highValueSignals: [],
        fluffPatterns: [],
        scoringRules: [],
        customFields: [],
        // Missing metadata
      };

      const result = validateResearchIntelligence(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors.some((err) => err.includes('frequency'))).toBe(true);
      expect(result.errors.some((err) => err.includes('metadata'))).toBe(true);
    });
  });

  describe('Backward Compatibility', () => {
    it('should not break existing templates', () => {
      // All 49 existing templates should still load
      const allTemplates = Object.values(INDUSTRY_TEMPLATES);
      expect(allTemplates.length).toBeGreaterThanOrEqual(49);

      // Each template should have required fields
      allTemplates.forEach((template) => {
        expect(template.id).toBeDefined();
        expect(template.name).toBeDefined();
        expect(template.coreIdentity).toBeDefined();
        expect(template.cognitiveLogic).toBeDefined();
        expect(template.knowledgeRAG).toBeDefined();
        expect(template.learningLoops).toBeDefined();
        expect(template.tacticalExecution).toBeDefined();
      });
    });
  });
});
```

**Requirements:**
- [ ] Both test files created
- [ ] All tests pass (`npm test`)
- [ ] Coverage >90% for new code
- [ ] Edge cases tested (null, undefined, invalid data)
- [ ] Tests run in CI/CD pipeline

#### 5. Update Package.json (if needed)

Ensure Zod is installed:

```bash
npm install zod
```

Check `package.json` for test scripts:

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

#### 6. Run All Checks

```bash
# TypeScript compilation
npm run type-check

# Linting
npm run lint

# Tests
npm test

# Coverage
npm run test:coverage
```

**Requirements:**
- [ ] No TypeScript errors
- [ ] No ESLint errors
- [ ] All tests passing
- [ ] Coverage >90%

---

## ✅ Step 1.1 Acceptance Criteria

Before moving to Step 1.2, verify ALL of the following:

### Code Quality
- [ ] `src/types/scraper-intelligence.ts` created with all types
- [ ] `src/lib/persona/industry-templates.ts` extended with `research?` field
- [ ] All types have JSDoc comments
- [ ] No `any` types used
- [ ] TypeScript compiles with zero errors/warnings
- [ ] ESLint passes with zero errors

### Testing
- [ ] Unit tests created in `tests/unit/scraper-intelligence/types.test.ts`
- [ ] Unit tests created in `tests/unit/scraper-intelligence/industry-templates.test.ts`
- [ ] All tests pass (`npm test`)
- [ ] Test coverage >90% for new code
- [ ] Edge cases tested (null, undefined, empty arrays, invalid regex)

### Validation
- [ ] Zod schemas validate correctly
- [ ] Type guards work as expected
- [ ] Helper functions work correctly
- [ ] Invalid data is rejected

### Backward Compatibility
- [ ] All 49 existing industry templates still work
- [ ] No breaking changes to existing code
- [ ] Optional `research` field doesn't break anything

### Documentation
- [ ] JSDoc added to all interfaces
- [ ] JSDoc added to all helper functions
- [ ] Complex logic explained with comments
- [ ] Type examples provided in JSDoc

### Performance
- [ ] Type guards run in <1ms
- [ ] Helper functions are O(n) or better
- [ ] No memory leaks in test suite

---

## 🔄 AFTER COMPLETING STEP 1.1

### Update This Prompt

1. Mark Step 1.1 as complete:
   - [x] Step 1.1: Extend IndustryTemplate interface

2. Update CURRENT STEP section with Step 1.2 instructions

3. Copy the ENTIRE updated prompt

### Git Commit

```bash
git add .
git commit -m "feat(scraper-intelligence): [Step 1.1] Extend IndustryTemplate with ResearchIntelligence

- Created src/types/scraper-intelligence.ts with complete type system
- Extended IndustryTemplate interface with optional research field
- Added Zod schemas for runtime validation
- Implemented type guards and helper functions
- Added comprehensive JSDoc comments
- Created unit tests with >90% coverage
- All 49 existing templates remain functional (backward compatible)

Types created:
- ResearchIntelligence (main interface)
- ScrapingStrategy
- HighValueSignal
- FluffPattern
- ScoringRule
- CustomField

Helper functions:
- hasResearchIntelligence()
- getResearchIntelligence()
- getTemplateById()
- getResearchIntelligenceById()
- getTemplatesWithResearch()
- validateResearchIntelligence()
- calculateMaxScore()
- getAllKeywords()
- getFluffRegexes()

Tests: 35+ unit tests
Coverage: 94%
Performance: All functions <1ms"

git push origin dev
```

### Inform User

"✅ Step 1.1 Complete!

**What was done:**
- Extended IndustryTemplate interface with research intelligence
- Created comprehensive type system with Zod validation
- Added 9 helper functions for working with research data
- Wrote 35+ unit tests with 94% coverage
- Backward compatible (all existing templates work)

**Files created:**
- `src/types/scraper-intelligence.ts` (520 lines)
- `tests/unit/scraper-intelligence/types.test.ts` (380 lines)
- `tests/unit/scraper-intelligence/industry-templates.test.ts` (290 lines)

**Files modified:**
- `src/lib/persona/industry-templates.ts` (+85 lines)

**Next step:** Step 1.2 - Create Firestore schema for ScraperIntelligence

Ready to continue? Paste the updated prompt in a new session."

---

## 📝 NOTES & LEARNINGS

(AI will add notes here after each step about challenges, decisions, or important context for future steps)

---

END OF STEP 1.1 INSTRUCTIONS

---

# 🚦 STEP 1.2: CREATE FIRESTORE SCHEMA WITH DISTILLATION & TTL ARCHITECTURE

## 📝 Detailed Implementation Instructions

### Goal
Create a two-tier data storage system: temporary scrapes (auto-delete after 7 days) and permanent signals (saved to CRM). This implements the "Distillation & TTL Architecture" for cost optimization.

### Prerequisites
- Step 1.1 completed (ResearchIntelligence types exist)
- Read `src/lib/db/firestore-service.ts` to understand existing patterns
- Review Firestore TTL documentation
- Understand content hashing (SHA-256)

### Implementation Steps

#### 1. Create Temporary Scrapes Types

**File:** `src/types/scraper-intelligence.ts` (ADD to existing file)

```typescript
/**
 * Temporary scrape record (auto-deleted after 7 days)
 * Stores raw HTML/content for verification, then discarded
 */
export interface TemporaryScrape {
  /**
   * Unique ID for this scrape
   */
  id: string;

  /**
   * Organization that initiated the scrape
   */
  organizationId: string;

  /**
   * Workspace context (if applicable)
   */
  workspaceId?: string;

  /**
   * URL that was scraped
   */
  url: string;

  /**
   * Raw HTML content
   */
  rawHtml: string;

  /**
   * Cleaned/processed content (markdown)
   */
  cleanedContent: string;

  /**
   * SHA-256 hash of rawHtml (for duplicate detection)
   */
  contentHash: string;

  /**
   * When this scrape was first created
   */
  createdAt: Date;

  /**
   * When this scrape was last seen (same content hash)
   */
  lastSeen: Date;

  /**
   * When this scrape expires and will be auto-deleted
   * Set to createdAt + 7 days
   */
  expiresAt: Date;

  /**
   * How many times we've seen this exact content
   */
  scrapeCount: number;

  /**
   * Extracted metadata
   */
  metadata: {
    title?: string;
    description?: string;
    author?: string;
    keywords?: string[];
  };

  /**
   * Size of rawHtml in bytes (for cost tracking)
   */
  sizeBytes: number;

  /**
   * Whether this has been verified by client in Training Center
   */
  verified: boolean;

  /**
   * If verified, when was it verified
   */
  verifiedAt?: Date;

  /**
   * Flag for immediate deletion (set when client verifies)
   */
  flaggedForDeletion: boolean;

  /**
   * Related lead/company ID (if extracted)
   */
  relatedRecordId?: string;
}

// Zod schema
export const TemporaryScrapeSchema = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1),
  workspaceId: z.string().optional(),
  url: z.string().url(),
  rawHtml: z.string(),
  cleanedContent: z.string(),
  contentHash: z.string().length(64), // SHA-256 is always 64 hex chars
  createdAt: z.date(),
  lastSeen: z.date(),
  expiresAt: z.date(),
  scrapeCount: z.number().int().positive(),
  metadata: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    author: z.string().optional(),
    keywords: z.array(z.string()).optional(),
  }),
  sizeBytes: z.number().int().positive(),
  verified: z.boolean(),
  verifiedAt: z.date().optional(),
  flaggedForDeletion: z.boolean(),
  relatedRecordId: z.string().optional(),
});

/**
 * Extracted signal (saved permanently to CRM)
 */
export interface ExtractedSignal {
  /**
   * Which high-value signal was detected
   */
  signalId: string;

  /**
   * Label from the signal definition
   */
  signalLabel: string;

  /**
   * Where the signal was found (snippet of text)
   */
  sourceText: string;

  /**
   * Confidence score (0-100)
   */
  confidence: number;

  /**
   * Platform where it was found
   */
  platform: ScrapingPlatform;

  /**
   * When it was extracted
   */
  extractedAt: Date;

  /**
   * Source scrape ID (link to temporary_scrapes)
   */
  sourceScrapeId: string;
}

// Zod schema
export const ExtractedSignalSchema = z.object({
  signalId: z.string().min(1),
  signalLabel: z.string().min(1),
  sourceText: z.string().max(500), // Limit to 500 chars
  confidence: z.number().min(0).max(100),
  platform: z.enum([
    'website',
    'linkedin-jobs',
    'linkedin-company',
    'news',
    'crunchbase',
    'dns',
    'google-business',
    'social-media',
  ]),
  extractedAt: z.date(),
  sourceScrapeId: z.string().min(1),
});
```

**Requirements:**
- [ ] Types added to existing scraper-intelligence.ts
- [ ] Zod schemas defined
- [ ] JSDoc comments comprehensive
- [ ] contentHash field uses SHA-256 (64 chars)
- [ ] expiresAt clearly documented as TTL field

#### 2. Create Firestore Service for Temporary Scrapes

**File:** `src/lib/scraper-intelligence/temporary-scrapes-service.ts` (CREATE)

```typescript
import { db } from '@/lib/db/firebase-admin';
import { logger } from '@/lib/logger/logger';
import crypto from 'crypto';
import type { TemporaryScrape, ExtractedSignal } from '@/types/scraper-intelligence';

const TEMPORARY_SCRAPES_COLLECTION = 'temporary_scrapes';
const TTL_DAYS = 7;

/**
 * Calculate SHA-256 hash of content
 */
export function calculateContentHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Calculate expiration date (now + 7 days)
 */
export function calculateExpirationDate(): Date {
  const now = new Date();
  const expiration = new Date(now.getTime() + TTL_DAYS * 24 * 60 * 60 * 1000);
  return expiration;
}

/**
 * Save or update a temporary scrape with duplicate detection
 */
export async function saveTemporaryScrape(params: {
  organizationId: string;
  workspaceId?: string;
  url: string;
  rawHtml: string;
  cleanedContent: string;
  metadata: TemporaryScrape['metadata'];
  relatedRecordId?: string;
}): Promise<{ scrape: TemporaryScrape; isNew: boolean }> {
  try {
    const { organizationId, workspaceId, url, rawHtml, cleanedContent, metadata, relatedRecordId } = params;

    // Calculate content hash
    const contentHash = calculateContentHash(rawHtml);

    // Check if this exact content already exists
    const existing = await db
      .collection(TEMPORARY_SCRAPES_COLLECTION)
      .where('organizationId', '==', organizationId)
      .where('contentHash', '==', contentHash)
      .limit(1)
      .get();

    if (!existing.empty) {
      // Duplicate found - just update lastSeen and scrapeCount
      const doc = existing.docs[0];
      const existingData = doc.data() as TemporaryScrape;

      const updated: Partial<TemporaryScrape> = {
        lastSeen: new Date(),
        scrapeCount: existingData.scrapeCount + 1,
      };

      await doc.ref.update(updated);

      logger.info(`Duplicate scrape detected for ${url}, updated lastSeen`, {
        contentHash,
        scrapeCount: existingData.scrapeCount + 1,
      });

      return {
        scrape: { ...existingData, ...updated } as TemporaryScrape,
        isNew: false,
      };
    }

    // New content - create new temporary scrape
    const now = new Date();
    const newScrape: TemporaryScrape = {
      id: db.collection(TEMPORARY_SCRAPES_COLLECTION).doc().id,
      organizationId,
      workspaceId,
      url,
      rawHtml,
      cleanedContent,
      contentHash,
      createdAt: now,
      lastSeen: now,
      expiresAt: calculateExpirationDate(),
      scrapeCount: 1,
      metadata,
      sizeBytes: Buffer.byteLength(rawHtml, 'utf8'),
      verified: false,
      flaggedForDeletion: false,
      relatedRecordId,
    };

    await db.collection(TEMPORARY_SCRAPES_COLLECTION).doc(newScrape.id).set(newScrape);

    logger.info(`New temporary scrape created for ${url}`, {
      id: newScrape.id,
      sizeBytes: newScrape.sizeBytes,
      expiresAt: newScrape.expiresAt,
    });

    return { scrape: newScrape, isNew: true };
  } catch (error: any) {
    logger.error('Failed to save temporary scrape', error);
    throw new Error(`Failed to save temporary scrape: ${error.message}`);
  }
}

/**
 * Flag a temporary scrape for immediate deletion (called after client verification)
 */
export async function flagScrapeForDeletion(scrapeId: string): Promise<void> {
  try {
    await db.collection(TEMPORARY_SCRAPES_COLLECTION).doc(scrapeId).update({
      flaggedForDeletion: true,
      verified: true,
      verifiedAt: new Date(),
    });

    logger.info(`Temporary scrape ${scrapeId} flagged for deletion`);
  } catch (error: any) {
    logger.error(`Failed to flag scrape for deletion`, error, { scrapeId });
    throw new Error(`Failed to flag scrape for deletion: ${error.message}`);
  }
}

/**
 * Delete flagged scrapes immediately (called by cleanup job)
 */
export async function deleteFlaggedScrapes(organizationId: string): Promise<number> {
  try {
    const flagged = await db
      .collection(TEMPORARY_SCRAPES_COLLECTION)
      .where('organizationId', '==', organizationId)
      .where('flaggedForDeletion', '==', true)
      .limit(500) // Batch size
      .get();

    let deletedCount = 0;

    for (const doc of flagged.docs) {
      await doc.ref.delete();
      deletedCount++;
    }

    if (deletedCount > 0) {
      logger.info(`Deleted ${deletedCount} flagged temporary scrapes`, { organizationId });
    }

    return deletedCount;
  } catch (error: any) {
    logger.error('Failed to delete flagged scrapes', error, { organizationId });
    throw new Error(`Failed to delete flagged scrapes: ${error.message}`);
  }
}

/**
 * Get temporary scrape by ID
 */
export async function getTemporaryScrape(scrapeId: string): Promise<TemporaryScrape | null> {
  try {
    const doc = await db.collection(TEMPORARY_SCRAPES_COLLECTION).doc(scrapeId).get();

    if (!doc.exists) {
      return null;
    }

    return doc.data() as TemporaryScrape;
  } catch (error: any) {
    logger.error('Failed to get temporary scrape', error, { scrapeId });
    throw new Error(`Failed to get temporary scrape: ${error.message}`);
  }
}

/**
 * Get temporary scrapes for a URL (for training UI)
 */
export async function getTemporaryScrapesByUrl(
  organizationId: string,
  url: string
): Promise<TemporaryScrape[]> {
  try {
    const docs = await db
      .collection(TEMPORARY_SCRAPES_COLLECTION)
      .where('organizationId', '==', organizationId)
      .where('url', '==', url)
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();

    return docs.docs.map((doc) => doc.data() as TemporaryScrape);
  } catch (error: any) {
    logger.error('Failed to get temporary scrapes by URL', error, { organizationId, url });
    throw new Error(`Failed to get temporary scrapes: ${error.message}`);
  }
}

/**
 * Calculate storage cost estimate
 */
export async function calculateStorageCost(organizationId: string): Promise<{
  totalScrapes: number;
  totalBytes: number;
  estimatedMonthlyCostUSD: number;
  projectedSavingsWithTTL: number;
}> {
  try {
    const scrapes = await db
      .collection(TEMPORARY_SCRAPES_COLLECTION)
      .where('organizationId', '==', organizationId)
      .get();

    const totalBytes = scrapes.docs.reduce((sum, doc) => {
      const data = doc.data() as TemporaryScrape;
      return sum + data.sizeBytes;
    }, 0);

    // Firestore pricing: ~$0.18/GB/month
    const costPerGB = 0.18;
    const totalGB = totalBytes / (1024 * 1024 * 1024);
    const estimatedMonthlyCostUSD = totalGB * costPerGB;

    // Without TTL, this would grow indefinitely
    // Estimate: 100 scrapes/day × 30 days = 3000 scrapes
    // With TTL: only last 7 days = 700 scrapes
    // Savings: 3000 - 700 = 2300 scrapes = 77% reduction
    const projectedSavingsWithTTL = estimatedMonthlyCostUSD * 0.77;

    return {
      totalScrapes: scrapes.size,
      totalBytes,
      estimatedMonthlyCostUSD,
      projectedSavingsWithTTL,
    };
  } catch (error: any) {
    logger.error('Failed to calculate storage cost', error, { organizationId });
    throw new Error(`Failed to calculate storage cost: ${error.message}`);
  }
}
```

**Requirements:**
- [ ] Service file created with all CRUD operations
- [ ] Content hashing implemented (SHA-256)
- [ ] Duplicate detection logic works
- [ ] TTL calculation correct (7 days)
- [ ] Flagging for deletion implemented
- [ ] Cost calculator implemented
- [ ] All functions have error handling
- [ ] Structured logging used

#### 3. Create Firestore Indexes and Security Rules

**File:** `firestore.indexes.json` (ADD to existing)

```json
{
  "indexes": [
    {
      "collectionGroup": "temporary_scrapes",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "organizationId", "order": "ASCENDING" },
        { "fieldPath": "contentHash", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "temporary_scrapes",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "organizationId", "order": "ASCENDING" },
        { "fieldPath": "url", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "temporary_scrapes",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "organizationId", "order": "ASCENDING" },
        { "fieldPath": "flaggedForDeletion", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "temporary_scrapes",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "expiresAt", "order": "ASCENDING" }
      ]
    }
  ]
}
```

**File:** `firestore.rules` (ADD to existing)

```javascript
match /temporary_scrapes/{scrapeId} {
  // Only the owning organization can read their scrapes
  allow read: if request.auth != null && 
                 resource.data.organizationId == request.auth.token.organizationId;
  
  // Only the owning organization can create scrapes
  allow create: if request.auth != null && 
                   request.resource.data.organizationId == request.auth.token.organizationId;
  
  // Only the owning organization can update (for flagging)
  allow update: if request.auth != null && 
                   resource.data.organizationId == request.auth.token.organizationId;
  
  // Only the owning organization can delete
  allow delete: if request.auth != null && 
                   resource.data.organizationId == request.auth.token.organizationId;
}
```

**Requirements:**
- [ ] Indexes created for all query patterns
- [ ] Security rules enforce organization isolation
- [ ] Rules tested with Firestore emulator
- [ ] No security vulnerabilities

#### 4. Configure Firestore TTL Policy

**Documentation: Create `docs/FIRESTORE_TTL_SETUP.md`**

```markdown
# Firestore TTL (Time-To-Live) Setup

## Option 1: Firestore Native TTL (Recommended)

Firestore supports automatic deletion based on a TTL field.

### Setup Steps:

1. **Enable TTL in Firebase Console:**
   - Go to Firestore Database
   - Click "TTL" tab
   - Click "Create TTL Policy"
   - Collection: `temporary_scrapes`
   - TTL Field: `expiresAt`
   - Click "Create"

2. **Verify:**
   ```bash
   gcloud firestore fields ttls list --database='(default)'
   ```

3. **Monitor:**
   - TTL deletions happen within 72 hours of expiration
   - Check Firestore usage metrics

## Option 2: Cloud Function Cleanup (Alternative)

If TTL is not available in your region:

**File:** `functions/src/cleanupExpiredScrapes.ts`

```typescript
import * as functions from 'firebase-functions';
import { db } from './firebase-admin';

export const cleanupExpiredScrapes = functions.pubsub
  .schedule('every 24 hours')
  .onRun(async () => {
    const now = new Date();
    
    const expired = await db
      .collection('temporary_scrapes')
      .where('expiresAt', '<=', now)
      .limit(500)
      .get();
    
    let deletedCount = 0;
    
    for (const doc of expired.docs) {
      await doc.ref.delete();
      deletedCount++;
    }
    
    console.log(`Deleted ${deletedCount} expired temporary scrapes`);
    
    return { deletedCount };
  });
```

**Deploy:**
```bash
firebase deploy --only functions:cleanupExpiredScrapes
```
```

**Requirements:**
- [ ] TTL policy configured OR Cloud Function deployed
- [ ] Documentation created
- [ ] Monitoring set up to verify deletions
- [ ] Cost savings verified

#### 5. Write Tests

**File:** `tests/unit/scraper-intelligence/temporary-scrapes.test.ts` (CREATE)

```typescript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  calculateContentHash,
  calculateExpirationDate,
  saveTemporaryScrape,
  flagScrapeForDeletion,
  calculateStorageCost,
} from '@/lib/scraper-intelligence/temporary-scrapes-service';

describe('Temporary Scrapes Service', () => {
  describe('calculateContentHash', () => {
    it('should generate consistent SHA-256 hash', () => {
      const content = '<html><body>Test</body></html>';
      const hash1 = calculateContentHash(content);
      const hash2 = calculateContentHash(content);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 is 64 hex chars
    });

    it('should generate different hashes for different content', () => {
      const content1 = '<html><body>Test 1</body></html>';
      const content2 = '<html><body>Test 2</body></html>';
      
      const hash1 = calculateContentHash(content1);
      const hash2 = calculateContentHash(content2);
      
      expect(hash1).not.toBe(hash2);
    });

    it('should be case-sensitive', () => {
      const content1 = '<HTML><BODY>Test</BODY></HTML>';
      const content2 = '<html><body>Test</body></html>';
      
      const hash1 = calculateContentHash(content1);
      const hash2 = calculateContentHash(content2);
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('calculateExpirationDate', () => {
    it('should set expiration to 7 days from now', () => {
      const now = new Date();
      const expiration = calculateExpirationDate();
      
      const diffMs = expiration.getTime() - now.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      
      expect(diffDays).toBeCloseTo(7, 1); // Allow small time difference
    });

    it('should generate future dates', () => {
      const now = new Date();
      const expiration = calculateExpirationDate();
      
      expect(expiration.getTime()).toBeGreaterThan(now.getTime());
    });
  });

  describe('Duplicate Detection', () => {
    it('should detect duplicate content and update lastSeen', async () => {
      // This would be an integration test with Firestore
      // For unit test, we'd mock the Firestore calls
      
      const params = {
        organizationId: 'test-org',
        url: 'https://example.com',
        rawHtml: '<html><body>Test</body></html>',
        cleanedContent: 'Test',
        metadata: { title: 'Test Page' },
      };

      // First save - should create new
      const result1 = await saveTemporaryScrape(params);
      expect(result1.isNew).toBe(true);
      expect(result1.scrape.scrapeCount).toBe(1);

      // Second save with same content - should update
      const result2 = await saveTemporaryScrape(params);
      expect(result2.isNew).toBe(false);
      expect(result2.scrape.scrapeCount).toBe(2);
      expect(result2.scrape.id).toBe(result1.scrape.id); // Same document
    });

    it('should create new document if content changes', async () => {
      const params1 = {
        organizationId: 'test-org',
        url: 'https://example.com',
        rawHtml: '<html><body>Test 1</body></html>',
        cleanedContent: 'Test 1',
        metadata: { title: 'Test Page' },
      };

      const params2 = {
        ...params1,
        rawHtml: '<html><body>Test 2</body></html>', // Different content
      };

      const result1 = await saveTemporaryScrape(params1);
      const result2 = await saveTemporaryScrape(params2);

      expect(result1.isNew).toBe(true);
      expect(result2.isNew).toBe(true);
      expect(result1.scrape.id).not.toBe(result2.scrape.id); // Different documents
    });
  });

  describe('Storage Cost Calculation', () => {
    it('should calculate storage costs correctly', async () => {
      const result = await calculateStorageCost('test-org');
      
      expect(result.totalScrapes).toBeGreaterThanOrEqual(0);
      expect(result.totalBytes).toBeGreaterThanOrEqual(0);
      expect(result.estimatedMonthlyCostUSD).toBeGreaterThanOrEqual(0);
      expect(result.projectedSavingsWithTTL).toBeGreaterThanOrEqual(0);
    });

    it('should show significant savings with TTL', async () => {
      const result = await calculateStorageCost('test-org');
      
      // Savings should be ~77% of total cost
      if (result.estimatedMonthlyCostUSD > 0) {
        const savingsPercentage = (result.projectedSavingsWithTTL / result.estimatedMonthlyCostUSD) * 100;
        expect(savingsPercentage).toBeGreaterThan(70);
        expect(savingsPercentage).toBeLessThan(80);
      }
    });
  });
});
```

**Requirements:**
- [ ] Unit tests written for all functions
- [ ] Integration tests for Firestore operations
- [ ] Edge cases tested (empty content, huge content)
- [ ] Duplicate detection tested
- [ ] Cost calculations verified
- [ ] All tests passing

### ✅ Step 1.2 Acceptance Criteria

Before moving to Step 1.3, verify ALL of the following:

- [ ] TemporaryScrape type created with all fields
- [ ] Content hashing implemented (SHA-256)
- [ ] TTL field (expiresAt) set to 7 days from creation
- [ ] Duplicate detection works (updates lastSeen instead of creating new doc)
- [ ] Firestore service created with CRUD operations
- [ ] Firestore indexes created
- [ ] Security rules updated and tested
- [ ] TTL policy configured OR cleanup Cloud Function deployed
- [ ] Documentation created (FIRESTORE_TTL_SETUP.md)
- [ ] Unit tests written and passing (>90% coverage)
- [ ] Integration tests passing
- [ ] Cost calculator works
- [ ] Storage savings projections documented
- [ ] No TypeScript errors
- [ ] No ESLint errors

---

END OF STEP 1.2 INSTRUCTIONS

---

