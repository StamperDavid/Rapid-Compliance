# SalesVelocity.ai Platform - Continuation Prompt

## Context
Repository: https://github.com/StamperDavid/Rapid-Compliance
Branch: dev
Last Commit: Latest on `dev` branch

## Current State (February 7, 2026)

### Architecture
- **Single-tenant penthouse model** — org ID `rapid-compliance-root`, Firebase `rapid-compliance-65f87`
- **52 AI agents** (48 swarm + 4 standalone) with hierarchical orchestration
- **4-role RBAC** (owner/admin/manager/member) with 47 permissions
- **157 physical routes**, **216 API endpoints**, **433K lines of TypeScript**

### What's Done
- Single-tenant conversion: COMPLETE (-71K lines, -185 files)
- SalesVelocity.ai rebrand: COMPLETE
- CSS variable theme system: COMPLETE
- Agent hierarchy with full manager orchestration: COMPLETE
- 4-role RBAC with API gating and sidebar filtering: COMPLETE
- Stabilization Roadmap: COMPLETE (all 15 tasks across 3 tiers)
- Social Media Growth Engine (Phases 1-6): COMPLETE — metrics collector, growth analyst, LISTEN/ENGAGE capabilities, GROWTH_LOOP orchestration, content recycling
- **Autonomous Business Operations Upgrade (ALL 8 PHASES): COMPLETE** — Event Router, Operations Cycle Cron, Event Emitters, Manager Authority (quality gates, mutations, cross-department protocol), Revenue Pipeline Automation, Outreach Autonomy, Content Production Hub, Intelligence Always-On, Builder/Commerce Reactive Loops, Contextual Artifact Generation, Jasper Command Authority

### What's In Progress
- Nothing currently in progress. All major upgrade tracks are complete.

### What's Next
- Platform stabilization and integration testing of the autonomous operations
- End-to-end testing of event routing chains (e.g., email reply → classification → Revenue Director → Content Manager → Outreach Manager)
- Production deployment verification (cron scheduling via Vercel/external scheduler)
- UI polish and dashboard enhancements for the executive briefing system

---

## Key Files
| File | Purpose |
|------|---------|
| `CLAUDE.md` | Binding governance for all Claude Code sessions |
| `docs/single_source_of_truth.md` | Authoritative architecture doc |
| `ENGINEERING_STANDARDS.md` | Code quality requirements |
| `AGENT_REGISTRY.json` | AI agent configurations (52 agents) |
| `src/lib/constants/platform.ts` | DEFAULT_ORG_ID and platform identity |

## Documentation Inventory (Clean)

**Root docs** (5 files): CLAUDE.md, README.md, ENGINEERING_STANDARDS.md, COMPETITIVE_ANALYSIS_BRIEFING.md, SOCIAL-MEDIA-AI-SPEC.md
**docs/** (3 files): single_source_of_truth.md, playwright-audit-2026-01-30.md, test-results-summary.md
**docs/master_library/** (16 files): Per-feature audit summaries from Feb 5, 2026
**docs/archive/** (16 files): Historical records — do not reference for architectural decisions
**.claude/agents/** (6 files): QA and architecture agent prompts

---

## Autonomous Business Operations — Key Files Created/Modified

These files were created or significantly modified during the 8-phase upgrade (Feb 7, 2026):

| File | Phase | What It Does |
|------|-------|-------------|
| `src/lib/orchestrator/event-router.ts` | 1a | Declarative rules engine — 25+ event rules mapping business events → Manager actions via SignalBus |
| `src/app/api/cron/operations-cycle/route.ts` | 1b | 3-tier cron: 4h operational, 24h strategic, weekly executive cycles |
| `src/lib/agents/base-manager.ts` | 2 | Extended with `reviewOutput()`, `applyPendingMutations()`, `requestFromManager()` |
| `src/lib/agents/revenue/manager.ts` | 3 | Auto-progression engine, intelligence-to-outreach bridge, win/loss feedback loop |
| `src/lib/agents/outreach/manager.ts` | 4 | Reply → action chains, adaptive timing, ghosting recovery |
| `src/lib/outbound/sequence-engine.ts` | 4b | Engagement-based adaptive timing replacing fixed delays |
| `src/lib/agents/content/manager.ts` | 5a, 7 | Central production hub with priority queue + contextual artifact generation |
| `src/lib/agents/intelligence/manager.ts` | 5b | Daily parallel sweeps (competitor, trend, sentiment, technographic) |
| `src/app/api/cron/intelligence-sweep/route.ts` | 5b | Daily intelligence sweep cron endpoint |
| `src/lib/agents/builder/manager.ts` | 6a | Analytics-driven page optimization (bounce/conversion/exit thresholds) |
| `src/lib/agents/commerce/manager.ts` | 6b | Cart abandonment recovery, loyalty tiers, pricing monitoring |
| `src/lib/orchestrator/jasper-command-authority.ts` | 8 | Executive briefings, approval gateway, command issuance |
| `src/lib/orchestrator/index.ts` | 8 | Updated exports for Jasper Command Authority |

---
---

# Autonomous Business Operations Spec (COMPLETED)

> Added: February 7, 2026 | **Status: ALL 8 PHASES IMPLEMENTED**
> Source: Full codebase audit of all 52 agents — gap analysis between structural hierarchy (what exists) and managerial autonomy (what's needed)

## The Problem (RESOLVED)

The 48-agent swarm has a complete structural hierarchy (1 Orchestrator + 9 Managers + 38 Specialists) with sophisticated capabilities across all departments. Agents have been upgraded from **task executors to autonomous managers** via the 8-phase implementation below.

**Previous state:** ~70% infrastructure, ~15% autonomous behavior.
**Current state:** ~95% infrastructure, ~85% autonomous behavior.

The agents can generate excellent content, qualify leads, classify email replies, analyze sentiment, score prospects, and produce mutation directives — but the step where those outputs trigger the *next* agent's action is manual or missing.

### Diagnosis

| Layer | Infrastructure | Autonomous Behavior | Verdict |
|-------|---------------|---------------------|---------|
| Hierarchy | 9/10 | 3/10 | Org chart exists, management behavior doesn't |
| Perception | 6/10 | 2/10 | Can collect data, doesn't feed it back into decisions |
| Interaction | 5/10 | 2/10 | Can reply/engage, doesn't do it autonomously |
| Mutation | 4/10 | 1/10 | One-shot template compile, no continuous evolution |
| Cross-Talk | 7/10 | 2/10 | SignalBus + MemoryVault built, no passengers |
| Event Triggers | 3/10 | 1/10 | Webhook ingestion exists, no event routing |

### The Test

> "If the LinkedIn Scraper fails to find an email address for a high-value prospect, which Manager Agent is responsible for deciding the next move, and what are its three alternative options?"

If the system gives a boring technical error → it's still a sequencer.
If the Intelligence Manager detects the failure, signals the Revenue Director, who evaluates the lead's BANT score, and delegates to Marketing Manager to engage via LinkedIn comment/DM while asking Outreach Manager to try SMS → that's a managerial system.

---

## The Vision: Autonomous Business Operating System

You set quarterly objectives. The system runs the business. Jasper (the AI assistant) is your interface — it briefs you on what happened, asks for decisions on things that need human judgment, and commands the swarm on your behalf.

### How Each Department Should Operate

**Intelligence Manager** — Proactively monitors the market daily. Detects competitor launches, target company funding, industry trends. Pushes signals to Revenue Director, Marketing Manager, and Content Manager without being asked.

**Revenue Director** — Runs the pipeline autonomously. When Intelligence finds a prospect: auto-creates lead → auto-qualifies via BANT → auto-transitions stages → auto-assigns outreach → auto-deploys objection handling → auto-triggers deal closing.

**Outreach Manager** — Manages unified inbox. Reply classified as "interested" → tells Revenue Director to advance stage + tells Content Manager to prepare proposal + drafts response. Sequence underperforming → tells Copywriter to rewrite templates.

**Marketing Manager** — Runs continuous growth cycles. Monitors metrics → detects what's working → mutates strategy → produces content → publishes → engages → repeats autonomously.

**Content Manager** — Operates a content production line. Receives briefs from Marketing (social), Outreach (email templates), Revenue (proposals), Reputation (review responses). Tracks performance and adjusts.

**Builder Manager** — Monitors website analytics. Conversion drops on a landing page → tells Architect to redesign → rebuilds the page. New campaign launched → auto-creates matching landing page.

**Commerce Manager** — Monitors cart abandonment → triggers recovery sequences. Watches pricing performance → adjusts. Customer hits loyalty threshold → generates discount → pushes through Outreach.

**Reputation Manager** — Monitors reviews continuously. Auto-responds to 3-5 star. Escalates 1-2 star. 5-star review → signals Marketing to repurpose as social proof. Case study produced → tells Content to distribute.

**Architect Manager** — Analyzes funnel performance. Conversion bottleneck detected → produces redesign recommendation → feeds to Builder for implementation.

---

## Existing Infrastructure (Do NOT Rebuild)

### Signal Infrastructure (Ready)
| Asset | File | Status |
|-------|------|--------|
| SignalBus | `src/lib/orchestrator/signal-bus.ts` | Production — BROADCAST, DIRECT, BUBBLE_UP, BUBBLE_DOWN signals, pending queue, history |
| MemoryVault | `src/lib/agents/shared/memory-vault.ts` | Production — 9 categories (INSIGHT, SIGNAL, CONTENT, PROFILE, STRATEGY, WORKFLOW, PERFORMANCE, CONTEXT, CROSS_AGENT) |
| BaseManager | `src/lib/agents/base-manager.ts` | Production — delegation rules, specialist management |
| Master Orchestrator | `src/lib/agents/orchestrator/manager.ts` | Production — Command Pattern, Saga Pattern, intent routing |

### Perception (Partially Wired)
| Asset | File | Status |
|-------|------|--------|
| Metrics Collector Cron | `src/app/api/cron/social-metrics-collector/route.ts` | Production — runs every 2-4 hours |
| Growth Analyst | `src/lib/agents/marketing/growth-analyst/specialist.ts` | Production — KPIs, patterns, mutation directives |
| Reply Handler | `src/lib/outbound/reply-handler.ts` | Production — 16 intent types, sentiment scoring, auto-response |
| Gmail Webhook | `src/app/api/webhooks/gmail/route.ts` | Production — push notifications, reply classification |
| SendGrid Inbound | `src/app/api/webhooks/email-inbound/route.ts` | Production — inbound parse, auto-actions at confidence > 85% |
| Sentiment Analyst | `src/lib/agents/intelligence/sentiment/specialist.ts` | Production — sentiment scoring, crisis detection |
| Trend Scout | `src/lib/agents/intelligence/trend/specialist.ts` | Production — trend signals, wired to Marketing Manager |

### Interaction (Partially Wired)
| Asset | File | Status |
|-------|------|--------|
| Autonomous Posting Agent | `src/lib/social/autonomous-posting-agent.ts` | Production — POST, REPLY, LIKE, FOLLOW, REPOST, RECYCLE with velocity limits |
| Email Specialist | `src/lib/agents/outreach/email/specialist.ts` | Production — send, track, A/B test, spam check |
| SMS Specialist | `src/lib/agents/outreach/sms/specialist.ts` | Production — campaigns, two-way, compliance |
| Sequence Engine | `src/lib/outbound/sequence-engine.ts` | Production — hourly cron, enrollment lifecycle |
| Lead Scoring | `src/lib/services/lead-scoring-engine.ts` | Production — multi-factor (company + person + intent + engagement), 7-day cache |

### Mutation (Exists But Static)
| Asset | File | Status |
|-------|------|--------|
| Mutation Engine | `src/lib/services/mutation-engine.ts` | Production — one-time compile (template + onboarding → mutated template). NOT continuous. |
| Self-Corrector | `src/lib/ai/verification/self-corrector.ts` | Production — verifies responses against knowledge base |
| Growth Analyst Mutations | (in growth-analyst/specialist.ts) | Production — generates CONTENT_MIX_SHIFT, TONE_ADJUSTMENT, POSTING_CADENCE, FORMAT_PIVOT, HASHTAG_STRATEGY, TOPIC_KILL directives. Stored in MemoryVault. **Never automatically applied.** |

---

## Implementation Phases

### Phase 1: Event Router + Company Operations Cycle (Foundation)

This is the single most important change. Without it, nothing autonomous works.

**1a. Event Router Service**

Create `src/lib/orchestration/event-router.ts`

A rules engine that watches for real-world events and dispatches work to the appropriate Manager via SignalBus.

Event rules structure:
```typescript
interface EventRule {
  id: string;
  event: string;           // e.g., 'email.reply.received', 'post.metrics.updated'
  condition: string;       // e.g., 'intent === "interested"', 'engagementRate > 5'
  action: {
    targetManager: ManagerId;
    command: string;
    payload: Record<string, unknown>;
  };
  priority: 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';
  enabled: boolean;
}
```

Initial event rules to implement:

**Revenue Events:**
| Event | Condition | Action |
|-------|-----------|--------|
| `email.reply.received` | intent = `interested` | Revenue Director: advance lead stage |
| `email.reply.received` | intent = `needs_more_info` | Content Manager: generate assets → Outreach Manager: reply with attachments |
| `email.reply.received` | intent = `objection` | Revenue Director: deploy Objection Handler → Outreach Manager: send rebuttal |
| `email.reply.received` | intent = `meeting_request` | Revenue Director: advance to NEGOTIATION, trigger meeting booking |
| `lead.bant_score.updated` | score crosses 70 | Revenue Director: auto-transition to OUTREACH stage |
| `deal.closed.won` | — | Reputation Manager: start review solicitation, Commerce Manager: process payment |
| `deal.closed.lost` | — | Revenue Director: log win/loss, Objection Handler: update battlecards |

**Outreach Events:**
| Event | Condition | Action |
|-------|-----------|--------|
| `email.sequence.underperforming` | open rate < 10% for 3 days | Copywriter: rewrite subject lines, Outreach Manager: swap templates |
| `email.engagement.ghosting` | 5+ opens, no reply within 48hrs | Outreach Manager: trigger pattern-break email |
| `email.engagement.hot` | opened within 1 hour | Outreach Manager: accelerate next step timing |

**Marketing Events:**
| Event | Condition | Action |
|-------|-----------|--------|
| `post.metrics.updated` | engagement > 5x average | Content Manager: produce follow-up content |
| `post.metrics.updated` | engagement < 1% for 7 days | Growth Analyst: emergency analysis + mutations |
| `trend.detected` | urgency = HIGH | Marketing Manager: OPPORTUNISTIC mode |
| `sentiment.spike` | negative | Marketing Manager: CRISIS_RESPONSE mode |

**Commerce Events:**
| Event | Condition | Action |
|-------|-----------|--------|
| `cart.abandoned` | no checkout within 1 hour | Outreach Manager: recovery sequence |
| `customer.loyalty.threshold` | spend crosses tier | Merchandiser: generate offer → Outreach Manager: send |

**Builder Events:**
| Event | Condition | Action |
|-------|-----------|--------|
| `page.bounce_rate.high` | bounce > 60% | Architect Manager: redesign recommendation → Builder Manager: rebuild |
| `campaign.launched` | new campaign from Marketing | Builder Manager: create matching landing page |

**Reputation Events:**
| Event | Condition | Action |
|-------|-----------|--------|
| `review.received` | rating 3-5 | Review Specialist: auto-respond |
| `review.received` | rating 1-2 | Review Specialist: draft response → queue for human approval via Jasper |
| `review.received` | rating 5 | Marketing Manager: repurpose as social proof |

**1b. Company Operations Cycle Cron**

Create `src/app/api/cron/operations-cycle/route.ts`

Scheduled management cycle that runs the business between human interactions:

```
Every 4 hours — OPERATIONAL CYCLE:
  1. Intelligence:  Check for new market signals, competitor activity
  2. Revenue:       Progress pipeline (advance/stall/disqualify leads based on data)
  3. Marketing:     Check growth metrics, apply pending mutations, queue next content
  4. Outreach:      Process pending replies, check sequence performance, escalate channels
  5. Reputation:    Check new reviews, respond, update brand health score

Every 24 hours — STRATEGIC CYCLE:
  6. Growth Analyst: Full KPI report across all departments
  7. Revenue Director: Pipeline health + conversion rate analysis
  8. Marketing Manager: Content performance + mutation recommendations
  9. Intelligence Manager: Market shift briefing
  10. Each Manager: Read cross-department signals, adjust strategy

Weekly — EXECUTIVE CYCLE:
  11. Orchestrator: Aggregate all department reports
  12. Compare performance against quarterly objectives
  13. Generate executive briefing for Jasper to present
  14. Identify underperforming departments and recommend interventions
```

**1c. Event Emitters**

Update existing webhooks and services to emit events into the Event Router:
- `src/app/api/webhooks/email-inbound/route.ts` → emit `email.reply.received`
- `src/app/api/webhooks/gmail/route.ts` → emit `email.reply.received`
- `src/app/api/cron/social-metrics-collector/route.ts` → emit `post.metrics.updated`
- `src/lib/services/lead-scoring-engine.ts` → emit `lead.bant_score.updated`
- Reply handler → emit events based on classification

### Phase 2: Manager Authority Upgrade

Upgrade `BaseManager` to give all 9 Managers three new capabilities:

**2a. Review Before Execute (Quality Gate)**

Add `reviewOutput()` method to BaseManager that each Manager can override:
- Marketing Manager: Check content against Brand DNA, verify spam score < 20
- Outreach Manager: Verify DNC compliance, check send frequency
- Revenue Director: Validate BANT calculation, verify outreach personalization

If output fails review → send back to specialist with feedback for revision (max 2 retries, then escalate to Jasper).

**2b. Read and Apply Mutations**

At the start of each operations cycle, each Manager reads pending mutation directives from MemoryVault that target their domain:
- Marketing Manager reads CONTENT_MIX_SHIFT, TONE_ADJUSTMENT, POSTING_CADENCE, FORMAT_PIVOT, HASHTAG_STRATEGY, TOPIC_KILL
- Outreach Manager reads EMAIL_SUBJECT_STRATEGY, SEND_TIME_OPTIMIZATION, CHANNEL_PREFERENCE
- Revenue Director reads QUALIFICATION_THRESHOLD, OUTREACH_FRAMEWORK_PREFERENCE

Mutations are applied to specialist parameters (content mix ratios, cadence settings, etc.), NOT to LLM system prompts. Mutations are logged to MemoryVault with before/after states for auditability.

**2c. Cross-Department Request Protocol**

Add `requestFromManager()` to BaseManager that sends structured requests to other Managers via SignalBus DIRECT signals:
- Revenue Director → Content Manager: "Generate a proposal deck for prospect X by next cycle"
- Marketing Manager → Content Manager: "Produce 3 social posts about trending topic Y"
- Reputation Manager → Marketing Manager: "Distribute this 5-star review as social proof"

Uses existing SignalBus DIRECT type. Receiving Manager adds request to its next cycle queue.

### Phase 3: Revenue Pipeline Automation

Make the Revenue Director's lead pipeline state machine self-driving:

**3a. Auto-Progression Engine**
- When `lead.bant_score.updated` fires and score >= 70: auto-transition INTELLIGENCE → OUTREACH
- When positive engagement signals accumulate: advance to NEGOTIATION
- When no activity for 14 days in OUTREACH: flag for Jasper review
- When deal signals detected: auto-trigger Deal Closer

**3b. Intelligence-to-Outreach Bridge**
- When Intelligence Manager completes scraping a prospect, auto-signal Revenue Director
- Revenue Director evaluates completeness (has scraper data + competitor data + social profiles + verified contact)
- If threshold met: auto-delegate to Outreach Specialist with full intelligence brief

**3c. Win/Loss Feedback Loop**
- On deal close (won or lost): auto-update Objection Handler battlecards
- Winning patterns → shared to Outreach Specialist as preferred frameworks
- Losing patterns → shared to Merchandiser for discount strategy adjustment

### Phase 4: Outreach Autonomy

**4a. Reply → Action Chains**
- Wire reply handler classification to Event Router (from Phase 1)
- `interested` → Revenue Director advances stage + Outreach Manager drafts follow-up
- `needs_more_info` → Content Manager generates personalized assets (HeyGen video + PDF proposal using scraped company data) → Outreach Manager sends reply with attachments
- `objection` → Objection Handler generates rebuttal → Outreach Manager sends
- `meeting_request` → Calendar booking triggered → Revenue Director advance to NEGOTIATION

**4b. Adaptive Timing**
- Replace fixed sequence delays (Day 3, Day 6, Day 10) with engagement-based timing
- Opened within 1 hour → accelerate next step
- Not opened in 5 days → extend delay
- 5+ opens, no reply → trigger pattern-break email instead of next sequence step
- Modify `processNextStep()` in sequence engine to check engagement data before executing

**4c. Ghosting Recovery**
- Track "high open / no reply" pattern (5+ opens, 0 replies within 48 hours)
- Trigger COPYWRITER_SPECIALIST to generate a "pattern break" email (different tone, different angle)
- If ghosting persists after pattern break → channel escalate (EMAIL → SMS → VOICE)

### Phase 5: Content Production Line + Intelligence Always-On

**5a. Content Manager as Central Production Hub**
- Receives briefs from all departments (not just Marketing)
- Revenue Director: "Need a proposal for [company]" → Copywriter + Video Specialist produce assets
- Marketing Manager: "Create follow-up thread for viral post" → Copywriter drafts
- Reputation Manager: "Distribute this case study" → Calendar Coordinator schedules
- Content Manager maintains a production queue, prioritized by urgency

**5b. Intelligence Manager Always-On Mode**
- Schedule daily intelligence sweeps: competitor monitoring, funding announcements, hiring signals, tech stack changes
- Every signal discovered → written to MemoryVault as SIGNAL entry
- Revenue Director consumes signals for proactive lead discovery
- Marketing Manager consumes signals for trend-responsive content
- Create cron endpoint: `src/app/api/cron/intelligence-sweep/route.ts`

### Phase 6: Builder/Commerce Reactive Loops

**6a. Analytics-Driven Page Optimization**
- Builder Manager monitors landing page analytics (if GA4/analytics wired)
- Bounce rate > 60% → signal Architect Manager for redesign
- Conversion drop at specific funnel step → Funnel Pathologist diagnoses → Builder rebuilds

**6b. Commerce Automation**
- Cart abandonment detection → triggers Outreach Manager recovery sequence
- Pricing Strategist monitors conversion rates → adjusts pricing recommendations
- Merchandiser auto-generates loyalty offers when customer spend crosses tier thresholds

### Phase 7: Contextual Artifact Generation (Advanced)

The "Sintra killer" feature — requires Phases 1-4 to be complete:

- Reply handler classifies `needs_more_info` from a prospect
- Event Router fires → Content Manager receives request with full prospect context (from scraper data)
- Video Specialist generates personalized HeyGen video for that company
- Copywriter generates tailored PDF proposal based on their tech stack and pain points
- Outreach Manager auto-replies with both attachments within minutes

This works because: HeyGen integration exists, PDF generation exists, reply handler exists, scraper data exists — they just need to be connected via the Event Router.

### Phase 8: Jasper Command Authority

Upgrade Jasper from task submitter to command authority:

**8a. Briefing System**
- When user opens the platform, Jasper reads the latest executive cycle report
- Presents: "While you were away, I processed 12 inbound replies — 3 interested leads advanced to outreach. LinkedIn engagement up 14%. Two 5-star reviews responded to. Here's what needs your attention..."

**8b. Approval Gateway**
- Some actions queue for human approval through Jasper:
  - Responding to 1-2 star reviews
  - Sending large campaigns (> 100 recipients)
  - Pricing changes
  - Actions where agent confidence < 80%
- Jasper presents the pending action, user approves/rejects, system executes

**8c. Command Authority**
- Jasper can issue commands to any Manager: "Revenue Director, pause outreach on lead X"
- Jasper can override autonomous decisions: "Marketing Manager, don't post about topic Y"
- Jasper can set objectives: "Marketing Manager, grow LinkedIn engagement 20% this quarter"

---

## Architecture Contracts (Read These Files First)

| File | LOC | What to Learn |
|------|-----|---------------|
| `src/lib/agents/types.ts` | 83 | AgentMessage, AgentReport, Signal interfaces |
| `src/lib/agents/base-specialist.ts` | 110 | Abstract methods every specialist must implement |
| `src/lib/agents/base-manager.ts` | 163 | Delegation rules, specialist management — **you're upgrading this** |
| `src/lib/agents/shared/memory-vault.ts` | 864 | Full cross-agent communication API |
| `src/lib/orchestrator/signal-bus.ts` | — | Signal routing — BROADCAST, DIRECT, BUBBLE_UP, BUBBLE_DOWN |
| `src/lib/agents/index.ts` | 236 | Agent ID enum, factory pattern |
| `src/lib/agents/orchestrator/manager.ts` | 2000+ | Master Orchestrator — Command Pattern, Saga Pattern |
| `src/lib/orchestrator/jasper-tools.ts` | — | Jasper's 9 delegation tools |
| `src/lib/orchestrator/jasper-thought-partner.ts` | — | Jasper's conversation engine |
| `src/lib/outbound/reply-handler.ts` | 500+ | Email reply classification — 16 intents |
| `src/lib/services/lead-scoring-engine.ts` | 800+ | Multi-factor lead scoring |
| `CLAUDE.md` | — | **Binding governance — read first** |

## Constraints (from CLAUDE.md — binding)

- **Zero-Any Policy** — No `any` types. Proper generics and discriminated unions.
- **Do NOT modify** `eslint.config.mjs`, `tsconfig.json`, `.husky/`
- **Do NOT add** `eslint-disable` or `@ts-ignore` comments
- **Zod validation** on all new API endpoints
- **Service layer architecture** — business logic in services, not routes
- **All agents extend BaseSpecialist** — implement all abstract methods
- **All cross-agent communication through MemoryVault/SignalBus** — no direct agent calls
- **Professional naming only** — no mascot names, no cutesy terminology. Agent names describe function.
- **Commit format:** `feat: <description>` with `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`

## Naming Convention

- **Jasper** — the AI assistant (not "Jasper Golden Master")
- **Golden Master** — the versioned agent template system (internal technical term, not a name)
- All agents are named by function: Revenue Director, Marketing Manager, Growth Analyst, etc.
- No Sintra-style mascot naming. No "Sophie," "Emmie," or similar.
