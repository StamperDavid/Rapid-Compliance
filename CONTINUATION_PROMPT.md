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

### Recently Completed (February 13, 2026 — Golden Playbook Session)

**All 4 Golden Playbook phases are COMPLETE:**

**Phase 1 — Training Agent-Agnostic + Playbook Integration:**
- `GoldenPlaybook` type added to `src/types/agent-memory.ts` (brand voice DNA, platform rules, correction history, performance patterns, explicit rules, compiled prompt)
- `AgentDomain` type (`'chat' | 'social' | 'email' | 'voice'`) added to `src/types/training.ts`
- `SocialCorrection` type added to `src/types/social.ts`
- `golden-playbook-builder.ts` — create, save, deploy, compile playbook versions
- `golden-playbook-updater.ts` — correction analysis, improvement suggestions, playbook update pipeline
- `correction-capture-service.ts` — capture/query/analyze user edits from approval queue
- `feedback-processor.ts` enhanced with domain-aware analysis (social/email/voice/chat preambles)
- **Content generation now uses active playbook** — `autonomous-posting-agent.ts:generateContent()` loads `getActivePlaybook()` and passes `compiledPrompt` as `systemInstruction` to Gemini
- **Admin content generation** also uses playbook for social content (`/api/admin/growth/content/generate`)
- API routes: `/api/social/playbook` (GET/POST/PUT), `/api/social/corrections` (GET/POST)
- Firestore collections: `goldenPlaybooks`, `socialCorrections`, `playbookUpdates`

**Phase 2 — Correction Capture Pipeline UI:**
- Golden Playbook dashboard page at `/social/playbook` with 5 tabs
- **Playbook Versions tab** — create new versions, view details (brand voice, platform rules, explicit rules, compiled prompt preview), deploy specific versions
- **Corrections Pipeline tab** — stats cards (total/unanalyzed/analyzed/patterns), heuristic pattern detection, expandable correction diff view, batch analysis trigger
- **Update Requests tab** — impact analysis (score improvement, risks, test duration), individual improvement cards with current vs suggested behavior
- Sidebar nav entry added (`BookOpenText` icon, `canTrainAIAgents` permission)

**Phase 3 — Conversational Coaching for Social:**
- `playbook-coaching-service.ts` — heuristic + AI-powered coaching insight generation
  - Analyzes: length patterns, tone shifts, vocabulary replacements, structure changes, platform imbalances, playbook gaps
  - Generates `CoachingInsight[]` with severity, category, evidence, and suggestions
  - AI deep analysis via Gemini for brand voice and messaging alignment patterns
- API endpoint: `/api/social/playbook/coach` (POST)
- **AI Coach tab** in Golden Playbook page — start coaching session, review insights with accept/dismiss buttons, evidence display, session summary

**Phase 4 — Performance-Based Learning:**
- `performance-pattern-service.ts` — analyzes published posts with engagement metrics
  - Detects patterns in: content length, hashtag usage, time of day, platform, structure (questions/lists/CTAs), emojis
  - Correlates content attributes with engagement rates
  - Can apply detected patterns to active playbook
- API endpoint: `/api/social/playbook/performance` (POST analyze, PUT apply)
- **Performance tab** in Golden Playbook page — analyze button, pattern cards with confidence scores, apply-to-playbook action

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
| **Command Center** | Live agent status, recent activity, health gauges, kill switch | P0 | COMPLETE |
| **Content Studio** | Create/edit with platform variants, AI suggestions, specialist feedback | P0 | COMPLETE — Dual-mode autopilot/manual |
| **Approval Queue** | Batch review table (desktop), with bulk approve and risk scoring | P0 | COMPLETE — Batch, Why badge, correction capture |
| **Activity Feed** | What the AI did, what it skipped, why, with early performance signals | P1 | COMPLETE |
| **Analytics** | Unified metrics with platform/campaign/persona filters | P1 | COMPLETE |
| **Agent Rules** | Guardrails, velocity limits, topic restrictions, approval triggers | P1 | COMPLETE |
| **Brand Voice** | Example-based training, knowledge base, test sandbox | P2 | COMPLETE (Training Lab) |
| **Golden Playbook** | Playbook versions, corrections, coaching, performance patterns | P2 | COMPLETE (All 4 phases) |

### Golden Playbook Architecture (COMPLETE)

The Golden Playbook is a versioned, immutable configuration system for the social agent. Key flow:

```
User edits AI draft in Approval Queue
  → CorrectionCaptureService stores diff
  → User triggers "Analyze Corrections"
  → AI identifies patterns (feedback-processor.ts)
  → Generates PlaybookUpdateRequest with improvements
  → User reviews and approves
  → New playbook version created and deployed
  → Content generation uses updated compiledPrompt
```

**Four Training Signals — ALL IMPLEMENTED:**
1. **Correction Capture** — automatic diff storage from approval queue edits
2. **Performance Feedback** — engagement metrics → pattern detection → playbook update
3. **Conversational Coaching** — AI coach analyzes patterns, generates coaching insights
4. **Explicit Rules** — Agent Rules UI → playbook explicit rules

### Social Media Key Files

| File | Purpose |
|------|---------|
| `src/lib/social/autonomous-posting-agent.ts` | Core agent — posting, queue, schedule, compliance, **playbook-aware generation** |
| `src/lib/social/golden-playbook-builder.ts` | Create, save, deploy, compile playbook versions |
| `src/lib/social/golden-playbook-updater.ts` | Correction analysis → improvement suggestions → playbook updates |
| `src/lib/social/correction-capture-service.ts` | Capture/query/analyze user edits from approval queue |
| `src/lib/social/playbook-coaching-service.ts` | Heuristic + AI coaching insight generation |
| `src/lib/social/performance-pattern-service.ts` | Engagement metrics → content pattern detection |
| `src/lib/social/agent-config-service.ts` | Runtime config — velocity limits, keywords, settings |
| `src/lib/social/sentiment-analyzer.ts` | Gemini AI + keyword fallback sentiment analysis |
| `src/lib/social/approval-service.ts` | Approval workflow — flag, review, approve/reject |
| `src/lib/social/engagement-metrics-collector.ts` | Twitter engagement metrics collection |
| `src/lib/integrations/twitter-service.ts` | Twitter API v2 — OAuth 2.0, posting, media, search |
| `src/lib/training/feedback-processor.ts` | Domain-aware AI training analysis (social/email/voice/chat) |
| `src/types/social.ts` | SocialCorrection, PostMetrics, all social types |
| `src/types/agent-memory.ts` | GoldenPlaybook, PlaybookPerformancePattern, PlaybookCorrection types |
| `src/types/training.ts` | AgentDomain, ImprovementSuggestion, ImpactAnalysis types |
| `src/app/(dashboard)/social/playbook/page.tsx` | Golden Playbook UI — 5 tabs (Versions, Corrections, Updates, Coach, Performance) |
| `src/app/api/social/playbook/route.ts` | Playbook CRUD — GET list/active, POST create, PUT deploy |
| `src/app/api/social/corrections/route.ts` | Corrections — GET list/counts/patterns, POST analyze |
| `src/app/api/social/playbook/coach/route.ts` | Coaching — POST generate session |
| `src/app/api/social/playbook/performance/route.ts` | Performance — POST analyze, PUT apply patterns |
| `src/app/api/social/approvals/route.ts` | Approvals — **captures corrections on edit** |
| `src/app/(dashboard)/social/command-center/page.tsx` | Command Center — kill switch, velocity gauges |
| `src/app/(dashboard)/social/campaigns/page.tsx` | Content Studio — dual-mode autopilot/manual |
| `src/app/(dashboard)/social/approvals/page.tsx` | Approval Queue — batch, Why badge, correction capture |
| `src/app/(dashboard)/social/activity/page.tsx` | Activity Feed |
| `src/app/(dashboard)/social/analytics/page.tsx` | Analytics Dashboard |
| `src/app/(dashboard)/social/agent-rules/page.tsx` | Agent Rules editor |
| `src/app/(dashboard)/social/training/page.tsx` | Social AI Training Lab |

---

## WHAT'S NEXT (Recommended Priorities)

### Remaining Social Media Gaps

| Component | Gap Size | Notes |
|-----------|----------|-------|
| **Connected Accounts (real OAuth)** | LARGE | UI shows hardcoded mock data, no real OAuth flow |
| **Media Manager in posts** | MEDIUM | Upload API exists, no UI to browse/attach media |
| **Social REPLY/LIKE/FOLLOW/REPOST** | MEDIUM | Compliance checks work but actual execution returns fake success |
| **LinkedIn posting** | MEDIUM | Falls back to manual task creation (RapidAPI unreliable) |
| **Facebook/Instagram** | LARGE | Type defs only, no implementation |

### Other Platform Work

| Area | Description |
|------|-------------|
| **Video Pipeline** | Storyboard → HeyGen bridge, scene stitching, screenshot capture |
| **Production Deployment** | Vercel production, Firebase rules, domain setup |
| **E-commerce** | Stripe integration completion, checkout flows |
| **Website Builder** | AI-powered page generation, template system |

---

## SECONDARY TASK: Video Production Pipeline

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
- AI auto-selection logic
- Luma Dream Machine and Kling integrations

---

## Known Issues

| Issue | Details |
|-------|---------|
| 3 service tests failing | Missing Firestore composite indexes. Fix: `firebase login --reauth` then `firebase deploy --only firestore:indexes` |
| Render pipeline fully mocked | `render-pipeline.ts` returns fake responses. Real integrations are in `video-service.ts` |
| Asset Generator is a shell | Returns placeholder URLs, no actual image generation |
| No screenshot capture service | Needed for platform tutorial videos |
| Outbound webhooks are scaffolding | Settings UI exists but backend dispatch not implemented |
| Social accounts UI is mock | Hardcoded connected/disconnected status, no real OAuth |
| Social REPLY/LIKE/FOLLOW/REPOST stubbed | Compliance checks work but actual execution returns fake success |
| LinkedIn posting limited | Falls back to manual task creation (RapidAPI unreliable) |

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
| `src/lib/training/feedback-processor.ts` | AI-powered training session analysis (domain-aware) |
| `src/lib/agent/instance-manager.ts` | Ephemeral agent spawn + customer memory |
| `src/types/agent-memory.ts` | Golden Master, GoldenPlaybook, CustomerMemory, AgentInstance types |
| `src/types/training.ts` | Training session, analysis, improvement suggestion, AgentDomain types |
| `vercel.json` | 7 cron entries for autonomous operations |
