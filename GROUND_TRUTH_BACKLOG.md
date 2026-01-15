# GROUND TRUTH BACKLOG
## The Honest Inventory - Hard-Hardening Phase

**Last Updated:** 2026-01-14
**Phase:** Hard-Hardening
**Reality Check:** Jasper has been doing EVERYTHING alone. The swarm never existed.

---

## THE BRUTAL TRUTH

| Metric | Count |
|--------|-------|
| **Total Specialists Required** | 17 |
| **Actually Built** | 0 |
| **Ghost Files (Stubs Only)** | 17 |
| **Managers Required** | 6 |
| **Managers Built** | 0 (All SHELL) |
| **Signal Bus** | 1 (Just built - FUNCTIONAL) |
| **Total Functional LOC in Swarm** | ~300 (Signal Bus + Base Classes) |
| **Total Ghost/Boilerplate LOC** | ~1,200 |

---

## HIERARCHY STATUS

```
JASPER (Chief Orchestrator) ✅ ACTIVE - But overloaded
│
├─ MARKETING_MANAGER ⚠️ SHELL
│  ├─ TIKTOK_EXPERT      ❌ GHOST
│  ├─ X_EXPERT           ❌ GHOST
│  ├─ FACEBOOK_EXPERT    ❌ GHOST
│  ├─ LINKEDIN_EXPERT    ❌ GHOST
│  └─ SEO_EXPERT         ❌ GHOST
│
├─ BUILDER_MANAGER ⚠️ SHELL
│  ├─ UX_UI_ARCHITECT    ❌ GHOST
│  ├─ FUNNEL_ENGINEER    ❌ GHOST
│  └─ ASSET_GENERATOR    ❌ GHOST
│
├─ INTELLIGENCE_MANAGER ⚠️ SHELL
│  ├─ COMPETITOR_ANALYST     ❌ GHOST
│  ├─ SENTIMENT_ANALYST      ❌ GHOST
│  └─ TECHNOGRAPHIC_SCOUT    ❌ GHOST
│
├─ COMMERCE_MANAGER ⚠️ SHELL
│  ├─ PRICING_STRATEGIST     ❌ GHOST
│  └─ INVENTORY_MANAGER      ❌ GHOST
│
├─ OUTREACH_MANAGER ⚠️ SHELL
│  ├─ EMAIL_SPECIALIST       ❌ GHOST
│  └─ SMS_SPECIALIST         ❌ GHOST
│
└─ CONTENT_MANAGER ⚠️ SHELL
   ├─ COPYWRITER             ❌ GHOST
   └─ CALENDAR_COORDINATOR   ❌ GHOST
```

---

## CRITICAL PATH ITEMS

### Priority 1: Intelligence (Must build first - feeds everything else)
| Agent | File | Status | Functional LOC | Blocks |
|-------|------|--------|----------------|--------|
| Intelligence Manager | `src/lib/agents/intelligence/manager.ts` | SHELL | 0 | All intelligence |
| Competitor Analyst | `src/lib/agents/intelligence/competitor/specialist.ts` | GHOST | 0 | Market analysis |
| Technographic Scout | `src/lib/agents/intelligence/technographic/specialist.ts` | GHOST | 0 | Tech stack detection |
| Sentiment Analyst | `src/lib/agents/intelligence/sentiment/specialist.ts` | GHOST | 0 | Social listening |

### Priority 2: Builder (Website generation)
| Agent | File | Status | Functional LOC | Blocks |
|-------|------|--------|----------------|--------|
| Builder Manager | `src/lib/agents/builder/manager.ts` | SHELL | 0 | All building |
| Funnel Engineer | `src/lib/agents/builder/funnel/specialist.ts` | GHOST | 0 | Conversion funnels |
| UX/UI Architect | `src/lib/agents/builder/ux-ui/specialist.ts` | GHOST | 0 | Wireframes |

### Priority 3: Marketing (Customer acquisition)
| Agent | File | Status | Functional LOC | Blocks |
|-------|------|--------|----------------|--------|
| Marketing Manager | `src/lib/agents/marketing/manager.ts` | SHELL | 0 | All marketing |
| SEO Expert | `src/lib/agents/marketing/seo/specialist.ts` | GHOST | 0 | Search ranking |
| TikTok Expert | `src/lib/agents/marketing/tiktok/specialist.ts` | GHOST | 0 | TikTok content |
| X Expert | `src/lib/agents/marketing/x/specialist.ts` | GHOST | 0 | Twitter content |
| Facebook Expert | `src/lib/agents/marketing/facebook/specialist.ts` | GHOST | 0 | Facebook ads |
| LinkedIn Expert | `src/lib/agents/marketing/linkedin/specialist.ts` | GHOST | 0 | B2B content |

### Priority 4: Content & Outreach
| Agent | File | Status | Functional LOC | Blocks |
|-------|------|--------|----------------|--------|
| Content Manager | `src/lib/agents/content/manager.ts` | SHELL | 0 | All content |
| Copywriter | `src/lib/agents/content/copywriter/specialist.ts` | GHOST | 0 | Copy generation |
| Outreach Manager | `src/lib/agents/outreach/manager.ts` | SHELL | 0 | All outreach |
| Email Specialist | `src/lib/agents/outreach/email/specialist.ts` | GHOST | 0 | Email campaigns |

### Priority 5: Commerce
| Agent | File | Status | Functional LOC | Blocks |
|-------|------|--------|----------------|--------|
| Commerce Manager | `src/lib/agents/commerce/manager.ts` | SHELL | 0 | All commerce |
| Pricing Strategist | `src/lib/agents/commerce/pricing/specialist.ts` | GHOST | 0 | Pricing logic |
| Inventory Manager | `src/lib/agents/commerce/inventory/specialist.ts` | GHOST | 0 | Stock management |

---

## ORIGINAL FEATURE INVENTORY (From User's Audit)

| Feature | Frontend | Backend | Actually Works? | New Owner |
|---------|----------|---------|-----------------|-----------|
| Web Scraper | ✅ Functional | ⚠️ Generalist | NO | INTELLIGENCE_MANAGER |
| Competitor Discovery | ✅ Functional | ❌ Missing | NO | COMPETITOR_ANALYST |
| Technographic Detection | ⚠️ Shell | ❌ Missing | NO | TECHNOGRAPHIC_SCOUT |
| Social Listening | ❌ Missing | ❌ Missing | NO | SENTIMENT_ANALYST |
| TikTok Specialist | ⚠️ Shell | ❌ Missing | NO | TIKTOK_EXPERT |
| X (Twitter) Specialist | ⚠️ Shell | ❌ Missing | NO | X_EXPERT |
| Facebook Manager | ⚠️ Shell | ❌ Missing | NO | FACEBOOK_EXPERT |
| Content Calendar | ⚠️ UI Only | ❌ Missing | NO | CALENDAR_COORDINATOR |
| Website Architect | ⚠️ Shell | ❌ Missing | NO | UX_UI_ARCHITECT |
| Funnel Logic Engine | ⚠️ Shell | ❌ Missing | NO | FUNNEL_ENGINEER |
| SEO Optimizer | ⚠️ Shell | ❌ Missing | NO | SEO_EXPERT |
| Copywriter Agent | ⚠️ Shell | ❌ Missing | NO | COPYWRITER |
| Lead Scraper Wiring | ✅ Functional | ❌ Missing | YES (Base) | INTELLIGENCE_MANAGER |
| CRM Pipeline | ✅ Functional | ❌ Missing | YES | - |
| Coupon System | ✅ Functional | ❌ Missing | YES | PRICING_STRATEGIST |
| Email Outreach | ⚠️ Shell | ❌ Missing | NO | EMAIL_SPECIALIST |
| Stripe Integration | ✅ Functional | ❌ Missing | YES | - |
| Product/Inventory | ⚠️ Shell | ❌ Missing | NO | INVENTORY_MANAGER |
| Pricing Strategist | ❌ Missing | ❌ Missing | NO | PRICING_STRATEGIST |
| GMB / Review Mgr | ❌ Missing | ❌ Missing | NO | SENTIMENT_ANALYST |

---

## WHAT WAS BUILT TODAY

### Infrastructure (FUNCTIONAL)
1. **Signal Bus** (`src/lib/orchestrator/signal-bus.ts`) - 300 LOC
   - Hierarchical message passing
   - BROADCAST, DIRECT, BUBBLE_UP, BUBBLE_DOWN signals
   - Agent registration and hierarchy management

2. **Base Classes** (`src/lib/agents/`)
   - `types.ts` - Core type definitions
   - `base-specialist.ts` - Abstract specialist class
   - `base-manager.ts` - Abstract manager class with delegation

3. **AGENT_REGISTRY.json** - Complete swarm manifest

### Ghost Stubs (All marked GHOST - 0 functional LOC each)
- 6 Managers (Shell - config only, no real delegation)
- 17 Specialists (Ghost - throw errors on execute)

---

## RULES FOR HARD-HARDENING

1. **No marking DONE until tested** - Every agent needs real tests
2. **STATUS comments required** - Every file marked with truth
3. **Functional LOC tracked** - Honest count, no hiding
4. **One agent at a time** - Complete before moving on
5. **Signal Bus integration required** - All agents must use the bus
6. **Reports must be structured** - JSON output schema enforced

---

## NEXT ACTIONS

1. [ ] Build COMPETITOR_ANALYST with real web scraping + LLM analysis
2. [ ] Build TECHNOGRAPHIC_SCOUT with real tech detection
3. [ ] Wire Intelligence Manager to actually delegate
4. [ ] Test Signal Bus with real agent communication
5. [ ] Connect to existing RAG/Knowledge systems in `src/lib/agent/`
