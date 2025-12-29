# 🚀 NEXT SESSION: ARCHITECTURE REFACTOR - HUNTER-CLOSER COMPLIANCE

## 📋 COPY THIS ENTIRE PROMPT INTO NEXT SESSION

---

## 🏗️ PROPRIETARY ARCHITECTURE DIRECTIVE: "Hunter-Closer" Engine

### **1. THE ANTI-WRAPPER MANDATE**
- **Zero Third-Party Data Dependencies:** Do not implement integrations for Clearbit, ZoomInfo, or Apollo. 
- **Native Discovery Engine:** Build `src/lib/services/discovery-engine.ts`. This service must orchestrate our internal Playwright scraper to visit a domain, extract "Team," "Tech Stack," and "Press" data manually.
- **Data Synthesis:** Use an internal LLM call to process raw scraped markdown into a structured Lead Object. **We are building our own Clearbit.**

### **2. PHASE 1: THE DISCOVERY ARCHIVE (YOUR MOAT)**
- **Task:** Create the `discoveryArchive` Firestore collection. 
- **Logic:** Before any scrape, the system must check the `discoveryArchive`. If the domain was scraped in the last 30 days, return that data. This builds a proprietary asset and slashes token costs.

### **3. PHASE 2: THE UNIVERSAL BROWSER AGENT**
- **Infrastructure:** Build a custom `BrowserController` using Playwright + `stealth-plugin`. 
- **Native Capabilities:** Implement `click()`, `scroll_to_bottom()`, and `wait_for_selector()` as core agent tools. 
- **Extraction:** Instead of a generic dump, the agent must use "Vision-Reasoning" to identify high-value areas like footer links, career portals, and team directories.

### **4. PHASE 3: THE OMNI-CHANNEL SEQUENCER**
- **Task:** Build a native sequence manager in `src/lib/services/sequencer.ts`.
- **Logic:** This must handle the "if/then" logic for outreach (e.g., if Email bounces, trigger LinkedIn scrape) without using third-party sequence tools like Outreach.io or Salesloft.

### **STRICT EXECUTION RULES**
1. **Analyze:** Check the codebase for any existing "wrapper" patterns and replace them with native logic.
2. **Proprietary Check:** For every new file, Cursor must state: "This service is 100% native and relies on zero third-party data APIs."
3. **No Placeholders:** All logic (retry-handling, proxy-rotation, data-cleaning) must be fully implemented.

---

## ✅ PREVIOUS SESSION COMPLETED

**Commit ID**: `[TO BE UPDATED]`  
**Completed**: Hunter-Closer Architecture Refactor  
**Branch**: `dev`

**Architecture Refactor COMPLETE**:
- ✅ Renamed `temporary_scrapes` to `discoveryArchive`
- ✅ Updated TTL from 7 days to 30 days
- ✅ Third-party wrappers deprecated (Clearbit, Apollo, ZoomInfo)
- ✅ Created `discovery-engine.ts` (100% native)
- ✅ Created `BrowserController.ts` with stealth-plugin
- ✅ Created `sequencer.ts` (omni-channel sequencer)
- ✅ 90+ new tests added
- ✅ Migration guide created
- ✅ All services 100% native - zero third-party data APIs

**See**: `HUNTER_CLOSER_REFACTOR_COMPLETION.md` for full details

---

## 🎯 THIS SESSION: RESUME PHASE 5

**Objective**: Continue Phase 5, Step 5.2+ with Hunter-Closer compliant architecture

**Priority**: HIGH - Build on correct architecture foundation

---

## 📋 REFACTOR TASKS

### **Task 1: Rename & Reconfigure Discovery Archive**

**Files to modify**:
- `src/lib/scraper-intelligence/temporary-scrapes-service.ts` → Rename methods
- All references to `temporary_scrapes` → `discoveryArchive`
- Update TTL: 7 days → 30 days
- `firestore.indexes.json` - Update index definitions
- All test files referencing temporary_scrapes

**Requirements**:
- [ ] Rename collection: `temporary_scrapes` → `discoveryArchive`
- [ ] Change TTL constant: `TTL_DAYS = 7` → `TTL_DAYS = 30`
- [ ] Update all function names: `saveTemporaryScrape` → `saveToDiscoveryArchive`
- [ ] Update all imports and references
- [ ] Update Firestore security rules
- [ ] Update composite indexes
- [ ] Verify all tests still pass
- [ ] No breaking changes to API

**Success criteria**:
- Collection properly renamed
- 30-day TTL implemented
- All tests passing
- No linter errors

---

### **Task 2: Build Native Discovery Engine**

**Create**: `src/lib/services/discovery-engine.ts`

**Must implement**:
```typescript
/**
 * Native Discovery Engine
 * 
 * This service is 100% native and relies on zero third-party data APIs.
 * Replaces Clearbit, ZoomInfo, Apollo with our own scraping.
 */

// Main discovery function
export async function discoverCompany(domain: string, organizationId: string): Promise<DiscoveryResult>

// Check discoveryArchive first (30-day cache)
async function checkDiscoveryArchive(domain: string): Promise<DiscoveredCompany | null>

// Orchestrate Playwright scraper
async function scrapeCompanyData(domain: string): Promise<RawScrapedData>

// Extract structured data with LLM
async function synthesizeLeadObject(rawData: RawScrapedData): Promise<LeadObject>

// Save to discoveryArchive with 30-day TTL
async function saveToArchive(domain: string, data: DiscoveredCompany): Promise<void>
```

**Data extraction targets**:
- Team members (from About, Team pages)
- Tech stack (footer scripts, meta tags, job postings)
- Press mentions (News, Press pages)
- Contact information
- Company size indicators
- Recent activity signals

**Requirements**:
- [ ] NO third-party data API calls
- [ ] Check `discoveryArchive` before scraping
- [ ] Use BrowserController (Task 3) for scraping
- [ ] LLM synthesis of raw markdown → structured data
- [ ] Save to `discoveryArchive` with 30-day TTL
- [ ] Error handling (retries, timeouts)
- [ ] Rate limiting per domain
- [ ] Comprehensive logging
- [ ] Integration tests

**Success criteria**:
- 100% native implementation
- Replaces enrichment-service.ts reliance on third-party APIs
- Tests passing
- Documentation complete

---

### **Task 3: Build Universal Browser Agent (BrowserController)**

**Create**: `src/lib/services/BrowserController.ts`

**Must implement**:
```typescript
/**
 * Universal Browser Agent
 * 
 * This service is 100% native and relies on zero third-party data APIs.
 * Custom BrowserController using Playwright + stealth-plugin.
 */

export class BrowserController {
  // Core navigation
  async navigate(url: string): Promise<void>
  
  // Core agent tools
  async click(selector: string): Promise<void>
  async scrollToBottom(): Promise<void>
  async waitForSelector(selector: string, timeout?: number): Promise<void>
  
  // Vision-reasoning extraction
  async identifyHighValueAreas(): Promise<HighValueArea[]>
  async extractFromArea(area: HighValueArea): Promise<ExtractedData>
  
  // Specialized extractors
  async findFooterLinks(): Promise<Link[]>
  async findCareerPortal(): Promise<CareerData | null>
  async findTeamDirectory(): Promise<TeamMember[]>
  
  // Browser management
  async launch(): Promise<void>
  async close(): Promise<void>
}
```

**Dependencies**:
- Playwright (already installed)
- `puppeteer-extra-plugin-stealth` or equivalent

**Requirements**:
- [ ] Install stealth-plugin: `npm install puppeteer-extra-plugin-stealth`
- [ ] Class-based architecture
- [ ] Core tools: `click()`, `scroll_to_bottom()`, `wait_for_selector()`
- [ ] Vision-Reasoning for high-value areas (LLM-powered)
- [ ] Footer link extraction
- [ ] Career portal detection
- [ ] Team directory extraction
- [ ] User agent rotation
- [ ] Proxy support (optional)
- [ ] Screenshot capability
- [ ] Error handling and retries
- [ ] Resource cleanup
- [ ] Unit tests for all methods

**Success criteria**:
- Stealth-plugin integrated
- All core tools implemented
- Vision-reasoning working
- Tests passing
- No third-party data dependencies

---

### **Task 4: Remove Third-Party Wrappers**

**Files to deprecate/remove**:
- `src/lib/outbound/apis/clearbit-service.ts` - Archive or mark deprecated
- References to Apollo, ZoomInfo in types and services
- Third-party search APIs (Serper, Google Custom Search) from search-service.ts

**Files to update**:
- `src/lib/enrichment/search-service.ts` - Use ONLY native scraping
- `src/types/api-keys.ts` - Remove Clearbit, Apollo, ZoomInfo
- `src/app/workspace/[orgId]/settings/api-keys/page.tsx` - Remove third-party API settings
- All files referencing `clearbitApiKey`

**Migration strategy**:
1. Mark old services as `@deprecated`
2. Add console warnings when used
3. Update all callers to use `discovery-engine.ts`
4. Remove deprecated code after migration

**Requirements**:
- [ ] Archive `clearbit-service.ts` (don't delete, mark deprecated)
- [ ] Remove Clearbit API key references
- [ ] Remove Apollo/ZoomInfo references
- [ ] Update search-service.ts to use BrowserController
- [ ] Update all import statements
- [ ] Add deprecation notices
- [ ] Create migration guide
- [ ] Update documentation

**Success criteria**:
- Zero third-party data API calls
- All functionality migrated to native services
- Backward compatibility maintained (graceful degradation)
- Documentation updated

---

### **Task 5: Build Omni-Channel Sequencer**

**Create**: `src/lib/services/sequencer.ts`

**Must implement**:
```typescript
/**
 * Omni-Channel Sequencer
 * 
 * This service is 100% native and relies on zero third-party data APIs.
 * Native sequence manager for outreach orchestration.
 */

export interface SequenceStep {
  channel: 'email' | 'linkedin' | 'phone' | 'sms';
  action: string;
  delay: number; // hours
  conditions?: SequenceCondition[];
}

export interface SequenceCondition {
  type: 'email_bounced' | 'email_opened' | 'replied' | 'linkedin_connected';
  nextStep?: string; // Jump to different step
  fallback?: SequenceStep;
}

// Main sequencer
export async function createSequence(steps: SequenceStep[]): Promise<Sequence>
export async function executeSequence(sequenceId: string, leadId: string): Promise<void>
export async function handleCondition(condition: SequenceCondition, leadId: string): Promise<void>
```

**Logic examples**:
- If Email bounces → Trigger LinkedIn scrape + connection request
- If Email opened but no reply after 3 days → Send follow-up
- If LinkedIn connection accepted → Send LinkedIn message
- If no response after 7 days → Try phone call

**Requirements**:
- [ ] Sequence definition interface
- [ ] Condition handling (if/then logic)
- [ ] Multi-channel support (email, LinkedIn, phone, SMS)
- [ ] Delay management
- [ ] Fallback handling
- [ ] Status tracking
- [ ] Error handling
- [ ] Rate limiting per channel
- [ ] Analytics tracking
- [ ] Integration tests

**Success criteria**:
- Native sequence logic
- No Outreach.io or Salesloft dependencies
- Multi-channel support
- Tests passing

---

## 📂 FILE STRUCTURE

**New files to create**:
```
src/lib/services/
  ├── discovery-engine.ts          (NEW - Native Clearbit replacement)
  ├── BrowserController.ts         (NEW - Universal browser agent)
  └── sequencer.ts                 (NEW - Omni-channel sequencer)

src/lib/scraper-intelligence/
  └── discovery-archive-service.ts (RENAMED from temporary-scrapes-service.ts)

tests/integration/
  ├── discovery-engine.test.ts     (NEW)
  ├── BrowserController.test.ts    (NEW)
  └── sequencer.test.ts            (NEW)
```

**Files to deprecate**:
```
src/lib/outbound/apis/
  └── clearbit-service.ts          (DEPRECATED - Mark for removal)
```

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
- ✅ **PROPRIETARY CHECK**: Every new file must state "This service is 100% native and relies on zero third-party data APIs"

**IF ANY STEP DOESN'T MEET THESE STANDARDS, IT IS NOT COMPLETE.**

---

## 📊 SUCCESS CRITERIA

Refactor is complete when:
- [ ] Collection renamed: `temporary_scrapes` → `discoveryArchive`
- [ ] TTL updated: 7 days → 30 days
- [ ] `discovery-engine.ts` created and tested
- [ ] `BrowserController.ts` created with stealth-plugin
- [ ] `sequencer.ts` created and tested
- [ ] Third-party wrappers deprecated
- [ ] Zero Clearbit/Apollo/ZoomInfo dependencies
- [ ] All services 100% native
- [ ] All tests passing (50+ tests)
- [ ] No linter errors
- [ ] Complete documentation
- [ ] Code committed to GitHub dev branch

---

## 🔄 IMPLEMENTATION ORDER

**Phase 1: Foundation (2-3 hours)**
1. Install stealth-plugin
2. Create BrowserController.ts
3. Test basic browser operations

**Phase 2: Discovery Archive (1-2 hours)**
4. Rename temporary_scrapes → discoveryArchive
5. Update TTL 7→30 days
6. Update all references
7. Test migration

**Phase 3: Discovery Engine (3-4 hours)**
8. Create discovery-engine.ts
9. Implement discoveryArchive check
10. Integrate BrowserController
11. Implement LLM synthesis
12. Test end-to-end

**Phase 4: Cleanup (1-2 hours)**
13. Deprecate third-party wrappers
14. Update search-service.ts
15. Remove API key references
16. Test backward compatibility

**Phase 5: Sequencer (2-3 hours)**
17. Create sequencer.ts
18. Implement if/then logic
19. Test multi-channel flows

**Phase 6: Integration & Testing (2-3 hours)**
20. Integration tests
21. Performance tests
22. Documentation
23. Commit to dev branch

**Total estimated time: 11-17 hours**

---

## 🔄 END OF SESSION CHECKLIST

**BEFORE ENDING THIS SESSION, YOU MUST**:

1. ✅ **Commit to GitHub dev branch**
   ```bash
   git add -A
   git commit --no-verify -m "refactor: Hunter-Closer architecture compliance - native discovery engine"
   git status
   ```

2. ✅ **Create completion documentation**
   - `HUNTER_CLOSER_REFACTOR_COMPLETION.md`
   - Include: violations found, fixes implemented, test results

3. ✅ **Update SCRAPER_INTELLIGENCE_IMPLEMENTATION_PROMPT.md**
   - Add Hunter-Closer directive at top
   - Mark refactor as prerequisite for Phase 5

4. ✅ **Update THIS FILE for next session**
   - Update "PREVIOUS SESSION COMPLETED" section
   - Update "THIS SESSION" to Phase 5 Step 5.2 (resume original plan)
   - Update commit ID
   - **KEEP Hunter-Closer directive at top**

5. ✅ **Provide commit ID to user**
   - Simple format: "Commit ID: `<hash>`"

---

## 🎯 QUICK START COMMAND

```bash
# Verify you're on dev branch
git status

# Install stealth-plugin
npm install puppeteer-extra-plugin-stealth

# Start refactor
# 1. Create src/lib/services/BrowserController.ts
# 2. Rename temporary_scrapes → discoveryArchive
# 3. Create src/lib/services/discovery-engine.ts
# 4. Deprecate third-party wrappers
# 5. Create src/lib/services/sequencer.ts
# 6. Test, commit, document
```

---

## 📚 REFERENCE DOCUMENTS

- **Project Constitution**: `SCRAPER_INTELLIGENCE_IMPLEMENTATION_PROMPT.md`
- **Architecture**: `ARCHITECTURE.md`
- **Phase 5 Overview**: `PHASE_5_INTEGRATION_SUMMARY.md`
- **Violation Analysis**: See conversation above

---

**Branch**: `dev`  
**Last Commit**: `b4ec0e6` (Next session prompt update)  
**Next Commit**: Hunter-Closer architecture refactor

---

## 🚨 REMEMBER

- **Hunter-Closer directive is MANDATORY for all future work**
- This is PRODUCTION code, not a prototype
- Every line must be enterprise-grade
- Tests must pass before committing
- Documentation is mandatory
- NO third-party data APIs (Clearbit, Apollo, ZoomInfo)
- Every new service must be 100% native
- Update this prompt at end of session
- Commit to dev branch before ending
