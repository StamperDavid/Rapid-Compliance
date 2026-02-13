# SalesVelocity.ai Platform - Continuation Prompt

**Always** review CLAUDE.md rules before starting a task

## Context
Repository: https://github.com/StamperDavid/Rapid-Compliance
Branch: dev
Last Session: February 13, 2026

## Current State

### Architecture
- **Single-tenant penthouse model** — org ID `rapid-compliance-root`, Firebase `rapid-compliance-65f87`
- **52 AI agents** (48 swarm + 4 standalone) with hierarchical orchestration
- **4-role RBAC** (owner/admin/manager/member) with 47 permissions
- **167 physical routes**, **242 API endpoints**, **430K+ lines of TypeScript**
- **NOT yet deployed to production** — everything is dev branch only

### Code Health
- `tsc --noEmit` — **PASSES (zero errors)**
- `npm run lint` — **PASSES (zero errors, zero warnings)**
- `npm run build` — **PASSES (production build succeeds)**

### Recently Completed
- Jasper video routing fixed — `create_video` and `get_video_status` tools working, HeyGen default provider
- Video service rewired to pull API keys from Firestore (not `process.env`)
- Academy section added (`/academy` page, sidebar nav)
- Multi-engine video selector implemented — per-scene engine dropdown in Approval step
- Engine registry with cost metadata, provider-status API, scene-generator multi-engine routing
- `heygenVideoId` → `providerVideoId` refactor across all types and components
- **Social media system audit completed** — full assessment of UI, APIs, services, and agent layer
- **All 7 social media pages built** — Command Center (kill switch, velocity gauges), Content Studio (dual-mode), Approval Queue (batch, correction capture, Why badge), Activity Feed, Analytics, Agent Rules, Training Lab
- **2 new API endpoints** — `/api/social/agent-status` (GET/POST), `/api/social/activity` (GET)
- **Kill switch implemented** — `agentEnabled` boolean in AutonomousAgentSettings, enforced in `executeAction()`

---

## PRIMARY TASK: AI-Automated Social Media Platform

### Vision: Supervised Autonomy with Manual Override

The social media system follows the **"Tesla Autopilot" model** — AI drives by default, but the user can grab the wheel at any moment. The transition between autopilot and manual must be seamless (one click, not a navigation change).

**Design Principles:**
- **AI is the default driver, not the only option** — every automated action has a visible manual equivalent
- **The user is a "passenger" by default** — screens show "here's what the AI is doing" not "here's a blank canvas"
- **Manual controls are present but visually recessive** when AI is driving, promoted when user takes over
- **Three-layer hierarchy**: Rules (human-set, absolute) → AI Autonomy (operates within rules) → Manual Override (always available)
- **The coaching loop is the differentiator** — corrections make the AI smarter over time

### Target Page Structure

| Page | Purpose | Priority | Status |
|------|---------|----------|--------|
| **Command Center** | Live agent status, recent activity, health gauges, kill switch | P0 | ✅ COMPLETE (Feb 13) |
| **Content Studio** | Create/edit with platform variants, AI suggestions, specialist feedback | P0 | ✅ COMPLETE (Feb 13) — Dual-mode autopilot/manual |
| **Approval Queue** | Batch review table (desktop), with bulk approve and risk scoring | P0 | ✅ COMPLETE (Feb 13) — Batch, Why badge, correction capture |
| **Activity Feed** | What the AI did, what it skipped, why, with early performance signals | P1 | ✅ COMPLETE (Feb 13) |
| **Analytics** | Unified metrics with platform/campaign/persona filters | P1 | ✅ COMPLETE (Feb 13) |
| **Agent Rules** | Guardrails, velocity limits, topic restrictions, approval triggers | P1 | ✅ COMPLETE (Feb 13) |
| **Brand Voice** | Example-based training, knowledge base, test sandbox (Training Lab = mostly done) | P2 | ✅ COMPLETE (pre-existing Training Lab) |

### Key UI Requirements

**Command Center (Missing — Build From Scratch):**
- Agent status panel: "AI is active, 3 posts queued, next post in 47 min"
- Activity log: "Posted to Twitter at 2:14 PM, engagement score: high"
- Decision transparency: "Skipped posting at 11 AM — velocity limit reached"
- Health gauges: "12/50 Twitter actions today" (circular meters for velocity limits)
- Global kill switch: prominent, persistent button to pause all automated posting
- Platform connection status with real OAuth state (not mock data)

**Content Studio (Partial — Needs Dual-Mode):**
- **Autopilot mode** (default): Queue of AI-generated drafts with agent reasoning, scheduled times
- **Manual mode** (one toggle): Full composer — pick platform, write copy, attach media, choose time, post
- Same screen, different emphasis — not separate pages
- Platform variants as tabs (not multi-column canvas — avoids decision paralysis)
- Inline specialist feedback when editing platform-specific drafts

**Approval Queue (Exists — Needs Upgrade):**
- Batch review table (Gmail-style list view) for desktop — scan 15+ posts at a glance
- Bulk approve for posts that look fine
- Click into individual posts only when they need attention
- Sort/filter by platform, risk score, campaign
- "Why" badge: highlight the exact phrase that triggered a flag
- Correction capture: when user edits a draft, store the diff for training

**Activity Feed (Missing — Build From Scratch):**
- What was posted, when, and why the AI chose that timing
- What the AI decided NOT to post and why
- Early performance signals (engagement in first hour)
- Actions taken (replies, retweets, etc.)
- Curated narrative, not raw logs

**Agent Rules UI (Missing — Backend Ready):**
- Visual editor for guardrails that currently live in `/api/social/settings`
- Topic restrictions, velocity limits, approval triggers
- Per-platform rules
- "Never post about X", "Always require approval for pricing mentions"
- Policy editor that feels as important as content

**Manual Posting Capabilities (Must Be Present Everywhere):**
- Manual compose with rich text, media upload, link preview
- Per-platform customization (not just "post everywhere identical")
- Schedule to specific date/time with timezone
- Draft saving
- Post now / schedule / add to queue — three distinct actions
- Queue reorder by drag-and-drop
- Pause/resume individual posts or entire queue

---

### Current State Audit (February 12, 2026)

#### What's Working (Backend — 60-70% Complete)

| Component | Status | Key Files |
|-----------|--------|-----------|
| **Autonomous Posting Agent** | REAL — posts, queues, schedules to Twitter | `src/lib/social/autonomous-posting-agent.ts` |
| **Twitter Integration** | PRODUCTION — full API v2, OAuth 2.0, media upload | `src/lib/integrations/twitter-service.ts` |
| **Compliance Guardrails** | ENFORCED — velocity limits, sentiment blocking, escalation | `autonomous-posting-agent.ts` (lines 148-262) |
| **Sentiment Analysis** | REAL — Gemini AI + keyword fallback, batch processing | `src/lib/social/sentiment-analyzer.ts` |
| **Approval Workflow** | REAL — full status tracking, comments, approve/reject/revise | `src/lib/social/approval-service.ts` |
| **Social Listening** | REAL (Twitter) — cron-based collection, sentiment analysis | `src/lib/social/listening-service.ts` |
| **Media Upload** | REAL — Firebase Storage, platform-specific validation | `src/lib/social/media-service.ts` |
| **Account Management** | REAL — multi-account CRUD, default selection | `src/lib/social/social-account-service.ts` |
| **Agent Config** | REAL — runtime configurable, Firestore-backed, cached | `src/lib/social/agent-config-service.ts` |
| **Queue Management** | REAL — add, process, reorder, post immediately | `/api/social/queue` |
| **Scheduling** | REAL — future publish, cron pickup | `/api/social/schedule` |
| **Calendar Aggregation** | REAL — merges posts from 3 sources | `/api/social/calendar` |
| **Metrics Collection** | REAL — cron job collects Twitter engagement | `/api/cron/social-metrics-collector` |
| **Content Generation** | REAL — Gemini AI via `generateContent()` | `autonomous-posting-agent.ts` (lines 1465-1516) |

#### What's Stubbed (Backend)

| Component | Status | Details |
|-----------|--------|---------|
| REPLY action | Compliance checks REAL, execution STUBBED | Sentiment/escalation works, actual reply posting TODO |
| LIKE action | STUBBED | Returns success, no API call |
| FOLLOW action | STUBBED | Returns success, no API call |
| REPOST action | STUBBED | Returns success, no API call |
| LinkedIn posting | FALLBACK | Tries RapidAPI, falls back to manual task creation |
| Facebook/Instagram | TYPE DEFS ONLY | No implementation |
| DM compliance | STUBBED | "Account has engaged with us first" check TODO |

#### What's Working (Frontend — 30-40% Complete)

| Page | Status | What Works | What's Missing |
|------|--------|------------|----------------|
| **Command Center** (`/social/command-center`) | ✅ FUNCTIONAL (Feb 13) | Kill switch banner, velocity gauges (SVG circular meters), agent status, platform connections, activity feed, auto-refresh 30s | Real-time WebSocket (uses polling) |
| **Content Studio** (`/social/campaigns`) | ✅ UPGRADED (Feb 13) | Dual-mode autopilot/manual toggle, AI queue visibility, scheduled posts, recently published, post CRUD, scheduling modal | Mock account data in manual mode |
| **Approvals** (`/social/approvals`) | ✅ UPGRADED (Feb 13) | Batch selection, bulk approve/reject, "Why" badge with flagged phrase highlighting, correction capture (stores original + corrected content), editable drafts | No sort/filter by risk score |
| **Activity Feed** (`/social/activity`) | ✅ FUNCTIONAL (Feb 13) | Filter tabs (All/Published/Scheduled/Flagged/Failed), event cards with type icons, platform badges, timestamps | No early performance signals yet |
| **Analytics** (`/social/analytics`) | ✅ FUNCTIONAL (Feb 13) | Summary stats, 7-day SVG bar chart, platform breakdown, post performance table | No time-series drill-down |
| **Agent Rules** (`/social/agent-rules`) | ✅ FUNCTIONAL (Feb 13) | General toggles, velocity limits, daily limits, sentiment block keywords (chip input), escalation triggers, save to API | No per-platform rule overrides |
| **Training Lab** (`/social/training`) | FUNCTIONAL (strongest page) | Multi-tab settings, AI test generation, history, knowledge upload, brand DNA | Already covers Brand Voice needs well |
| **Calendar** (`/social/calendar`) | FUNCTIONAL | react-big-calendar, filtering, modal details, drag-drop infrastructure | No agent markers, no new post creation from calendar |
| **Listening** (`/social/listening`) | FUNCTIONAL | Mention feed, sentiment badges, keyword config, status management | No competitive analysis view |

#### What's Missing (Frontend)

| Component | Gap Size | Notes |
|-----------|----------|-------|
| ~~**Command Center page**~~ | ~~CRITICAL~~ | ✅ RESOLVED (Feb 13) — Kill switch, velocity gauges, agent status, platform connections, activity feed |
| ~~**Activity Feed page**~~ | ~~CRITICAL~~ | ✅ RESOLVED (Feb 13) — Chronological feed with filter tabs |
| ~~**Agent Rules UI**~~ | ~~CRITICAL~~ | ✅ RESOLVED (Feb 13) — Visual guardrails editor with velocity limits, keywords, toggles |
| **Connected Accounts (real OAuth)** | LARGE | UI shows hardcoded mock data, no real OAuth flow |
| **Media Manager in posts** | MEDIUM | Upload API exists, no UI to browse/attach media |
| **Coaching/Feedback Loop** | CRITICAL | See Golden Playbook section below |
| ~~**Analytics Dashboard**~~ | ~~LARGE~~ | ✅ RESOLVED (Feb 13) — Summary stats, 7-day chart, platform breakdown, post performance |
| ~~**Kill Switch**~~ | ~~LARGE~~ | ✅ RESOLVED (Feb 13) — `agentEnabled` toggle on Command Center + agent-status API |

---

### Golden Playbook Architecture (Anti-Drift System for Social Agents)

#### Problem

The existing **Golden Master + Ephemeral Spawn** pattern works for the customer chat agent (reactive, conversational). But the social media agent is **generative** (creates content proactively) and **long-running** (not session-based). Direct pattern copy doesn't fit.

The social agent currently uses `AgentConfigService` with mutable config and no versioning — drift risk is high.

#### Solution: Golden Playbook

A versioned, immutable configuration system for the social agent, parallel to Golden Master but designed for generative agents.

```
organizations/
  rapid-compliance-root/
    goldenPlaybooks/
      gp_timestamp_random/
        id, version (v1, v2, v3...), isActive
        brandVoiceDNA        ← from Training Lab
        platformRules        ← per-platform behavior
        correctionHistory    ← learned from user edits
        performancePatterns  ← what content works
        explicitRules        ← user-defined guardrails
        compiledPrompt       ← assembled from all above
        trainedScenarios, trainingScore
        createdAt, deployedAt
```

**Key Difference from Golden Master:** The social agent doesn't spawn ephemeral instances. It's a long-running agent that **references** the active playbook on every content generation cycle. The playbook is versioned and immutable — every config change creates a new version with rollback capability.

#### Four Training Signals

```
1. CORRECTION CAPTURE (Inline — Zero Extra Effort)
   ├─ AI generates draft
   ├─ User edits it in approval queue
   ├─ System diffs original vs. user's edit
   ├─ Stores: { original, corrected, platform, context }
   └─ Implicit training — corrections accumulate automatically

2. PERFORMANCE FEEDBACK (Automated)
   ├─ Post goes live → metrics cron collects engagement
   ├─ System tags high/low performers
   ├─ Correlates content patterns with performance
   └─ "Posts with questions in the hook get 2.3x engagement"

3. CONVERSATIONAL COACHING (Extends Existing Training Infrastructure)
   ├─ User opens coaching session with social agent
   ├─ "Write me a LinkedIn post about our email feature"
   ├─ Agent generates → user critiques → agent revises
   ├─ Session analyzed by existing feedback-processor.ts
   └─ Suggestions fed into playbook update pipeline

4. EXPLICIT RULES (Direct Input via Agent Rules UI)
   ├─ User sets rules in guardrails editor
   ├─ "Never use emojis on LinkedIn"
   ├─ Hard constraints, not learned behavior
   └─ Stored in playbook, enforced at generation time
```

#### Implementation Phases

**Phase 1 — Make Training Agent-Agnostic:**
- Add `agentType: 'chat' | 'social' | 'email' | 'voice'` to `TrainingSession` type in `src/types/training.ts`
- Add `agentType` to `GoldenMasterUpdateRequest`
- Create `GoldenPlaybook` type in `src/types/agent-memory.ts` (parallel to `GoldenMaster`)
- Create `golden-playbook-builder.ts` following pattern of `golden-master-builder.ts`
- Make `feedback-processor.ts` aware of agent domains (different analysis prompts per type)

**Phase 2 — Correction Capture:**
- On approval queue edit: store diff `{ original, corrected, platform, postType, context }`
- Firestore path: `organizations/{PLATFORM_ID}/socialCorrections/{id}`
- After N corrections, batch-analyze using existing feedback pipeline
- Generate improvement suggestions → human reviews → deploys to new playbook version

**Phase 3 — Conversational Coaching for Social:**
- Extend Training Lab with "Social Agent" tab alongside existing BaseModel training
- Reuse chat interface but talk to social agent ("Generate a Twitter thread about X")
- Sessions flow through same `feedback-processor.ts` → `golden-playbook-updater.ts`

**Phase 4 — Performance-Based Learning:**
- Metrics cron already collects engagement data
- Add weekly analysis job: identify top/bottom performers
- Correlate content patterns (hook style, CTA type, post length, timing) with performance
- Suggest playbook updates based on what's working

#### Existing Infrastructure to Reuse

| Component | Location | Reuse For |
|-----------|----------|-----------|
| Training types | `src/types/training.ts` | Add `agentType` field |
| Feedback processor | `src/lib/training/feedback-processor.ts` | Analyze social training sessions |
| Golden master builder | `src/lib/agent/golden-master-builder.ts` | Pattern for playbook builder |
| Golden master updater | `src/lib/training/golden-master-updater.ts` | Pattern for playbook updater |
| Instance manager | `src/lib/agent/instance-manager.ts` | Pattern for prompt compilation |
| Training UI | `src/app/(dashboard)/settings/ai-agents/training/page.tsx` | Extend with social agent tab |
| Agent memory types | `src/types/agent-memory.ts` | Add GoldenPlaybook type |

---

### Social Media Key Files

| File | Purpose |
|------|---------|
| `src/lib/social/autonomous-posting-agent.ts` | Core agent — posting, queue, schedule, compliance |
| `src/lib/integrations/twitter-service.ts` | Twitter API v2 — OAuth 2.0, posting, media, search |
| `src/lib/social/sentiment-analyzer.ts` | Gemini AI + keyword fallback sentiment analysis |
| `src/lib/social/approval-service.ts` | Approval workflow — flag, review, approve/reject |
| `src/lib/social/listening-service.ts` | Twitter mention collection + sentiment analysis |
| `src/lib/social/media-service.ts` | Firebase Storage media upload + validation |
| `src/lib/social/social-account-service.ts` | Multi-account CRUD + default selection |
| `src/lib/social/agent-config-service.ts` | Runtime config — velocity limits, keywords, settings |
| `src/types/social.ts` | All social media type definitions |
| `src/app/(dashboard)/social/command-center/page.tsx` | Command Center — kill switch, velocity gauges, agent status (612 lines) |
| `src/app/(dashboard)/social/campaigns/page.tsx` | Content Studio — dual-mode autopilot/manual |
| `src/app/(dashboard)/social/approvals/page.tsx` | Approval Queue — batch, Why badge, correction capture (656 lines) |
| `src/app/(dashboard)/social/activity/page.tsx` | Activity Feed — chronological AI activity (354 lines) |
| `src/app/(dashboard)/social/analytics/page.tsx` | Analytics Dashboard — stats, charts, performance (568 lines) |
| `src/app/(dashboard)/social/agent-rules/page.tsx` | Agent Rules — visual guardrails editor (611 lines) |
| `src/app/(dashboard)/social/training/page.tsx` | AI Training Lab (1,926 lines, strongest UI page) |
| `src/app/(dashboard)/social/calendar/page.tsx` | Visual post calendar |
| `src/app/(dashboard)/social/listening/page.tsx` | Social listening dashboard |
| `src/components/social/SocialCalendar.tsx` | react-big-calendar wrapper with dark theme |
| `src/components/social/CalendarToolbar.tsx` | Calendar navigation + filters |
| `src/components/social/CalendarEventCard.tsx` | Calendar event rendering |
| `src/styles/social-calendar.css` | 278 lines dark theme calendar CSS |
| `src/app/api/social/queue/route.ts` | Queue API — add, process, post immediately |
| `src/app/api/social/schedule/route.ts` | Schedule API — create, list, cancel |
| `src/app/api/social/approvals/route.ts` | Approvals API — list, create, update status |
| `src/app/api/social/calendar/route.ts` | Calendar API — aggregated events |
| `src/app/api/social/accounts/route.ts` | Account management API |
| `src/app/api/social/media/upload/route.ts` | Media upload API |
| `src/app/api/social/settings/route.ts` | Agent config API |
| `src/app/api/social/agent-status/route.ts` | Agent status dashboard + kill switch toggle |
| `src/app/api/social/activity/route.ts` | Chronological activity feed |
| `src/app/api/social/listening/route.ts` | Listening API — mentions + sentiment |
| `src/app/api/social/listening/config/route.ts` | Listening config API |
| `src/app/api/cron/social-listening-collector/route.ts` | Cron — collect Twitter mentions |

---

## SECONDARY TASK: Video Production Pipeline

(Moved from primary — still needs completion but social media is current focus)

### Goal
Tell Jasper "create a video on how to set up an email campaign" and receive a polished, professional video in the video library — with full review and approval at every step.

### What's Built
- Video Specialist, Director Service, HeyGen/Sora/Runway API integrations
- Multi-engine selector (per-scene), engine registry, scene generator
- Video Studio UI (7-step pipeline), storyboard preview
- Jasper `create_video` and `get_video_status` tools
- TTS voice generation, video library storage, Academy page

### What Still Needs Building
- Screenshot capture tool (Puppeteer/Playwright)
- Scene-level editing in Video Studio
- Avatar picker and Voice picker (APIs exist)
- Storyboard → HeyGen bridge (currently calls mock pipeline)
- Scene stitching (ffmpeg)
- AI auto-selection logic (Phase 2)
- Luma Dream Machine and Kling integrations

### Video Key Files
| File | Purpose |
|------|---------|
| `src/lib/video/video-service.ts` | HeyGen/Sora/Runway API integrations |
| `src/lib/video/engine/director-service.ts` | Storyboard generation |
| `src/lib/video/engine/render-pipeline.ts` | Render orchestration (ALL MOCKED) |
| `src/lib/video/engine-registry.ts` | Engine metadata, costs, status |
| `src/lib/video/scene-generator.ts` | Multi-engine scene router |
| `src/app/(dashboard)/content/video/page.tsx` | Video Studio UI |

---

## Known Issues

| Issue | Details |
|-------|---------|
| 3 service tests failing | Missing Firestore composite indexes. Fix: `firebase login --reauth` then `firebase deploy --only firestore:indexes` |
| Render pipeline fully mocked | `render-pipeline.ts` returns fake responses. Real integrations are in `video-service.ts` |
| Asset Generator is a shell | Returns placeholder URLs, no actual image generation |
| No screenshot capture service | Needed for platform tutorial videos |
| Outbound webhooks are scaffolding | Settings UI exists but backend dispatch not implemented |
| Playbook missing API endpoints | `/api/playbook/list` and `/api/playbook/{id}/metrics` return 404 |
| Social accounts UI is mock | Hardcoded connected/disconnected status, no real OAuth |
| Social REPLY/LIKE/FOLLOW/REPOST stubbed | Compliance checks work but actual execution returns fake success |
| LinkedIn posting limited | Falls back to manual task creation (RapidAPI unreliable) |
| No social coaching/feedback loop | Correction capture now stores diffs (Feb 13), but Golden Playbook pipeline not yet built |

---

## Key Files (General)

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Binding governance for all Claude Code sessions |
| `docs/single_source_of_truth.md` | Authoritative architecture doc |
| `ENGINEERING_STANDARDS.md` | Code quality requirements |
| `AGENT_REGISTRY.json` | AI agent configurations (52 agents) |
| `src/lib/constants/platform.ts` | PLATFORM_ID and platform identity |
| `src/lib/orchestration/event-router.ts` | Declarative rules engine — 25+ event rules |
| `src/lib/orchestrator/signal-bus.ts` | Agent-to-agent communication |
| `src/lib/agents/shared/memory-vault.ts` | Shared agent knowledge store (Firestore-backed) |
| `src/lib/api-keys/api-key-service.ts` | Centralized API key retrieval from Firestore |
| `src/lib/orchestrator/jasper-tools.ts` | Jasper's 36+ function-calling tools |
| `src/lib/orchestrator/feature-manifest.ts` | 11 specialists + capabilities + trigger phrases |
| `src/lib/agent/golden-master-builder.ts` | Golden Master versioning + deployment |
| `src/lib/training/golden-master-updater.ts` | Training → Golden Master update pipeline |
| `src/lib/training/feedback-processor.ts` | AI-powered training session analysis |
| `src/lib/agent/instance-manager.ts` | Ephemeral agent spawn + customer memory |
| `src/types/agent-memory.ts` | Golden Master, CustomerMemory, AgentInstance types |
| `src/types/training.ts` | Training session, analysis, improvement suggestion types |
| `vercel.json` | 7 cron entries for autonomous operations |
