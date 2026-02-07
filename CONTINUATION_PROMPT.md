# SalesVelocity.ai Platform - Continuation Prompt

## Context
Repository: https://github.com/StamperDavid/Rapid-Compliance
Branch: dev
Last Commit: `d782368d` feat: restore SUBSCRIPTION_SPECIALIST as graceful stub

## Current State (February 7, 2026)

### Architecture
- **Single-tenant penthouse model** — org ID `rapid-compliance-root`, Firebase `rapid-compliance-65f87`
- **51 AI agents** (47 swarm + 4 standalone) with hierarchical orchestration
- **4-role RBAC** (owner/admin/manager/member) with 47 permissions
- **157 physical routes**, **215 API endpoints**, **430K lines of TypeScript**

### What's Done
- Single-tenant conversion: COMPLETE (-71K lines, -185 files)
- SalesVelocity.ai rebrand: COMPLETE
- CSS variable theme system: COMPLETE
- Agent hierarchy with full manager orchestration: COMPLETE
- 4-role RBAC with API gating and sidebar filtering: COMPLETE

### What's In Progress
- **Stabilization Roadmap** — see `docs/single_source_of_truth.md` section "Stabilization Roadmap"
- The system has 100 TODO comments, 76 files with mock data, zero error boundaries, and minimal accessibility
- The goal is to solidify existing functionality before adding new features
- **Sophie Growth Engine Upgrade** — Social media agents need transformation from passive schedulers to autonomous account operators (see spec below)

---

## Trigger Phrases

### Stabilization (Default)
```
Execute Stabilization Roadmap. Read CLAUDE.md first, then docs/single_source_of_truth.md — focus on the "Stabilization Roadmap" section. Begin with the next incomplete Tier 1 task. Do not skip to Tier 2 until Tier 1 is verified complete.
```

### Sophie Growth Engine Upgrade
```
Execute Sophie Growth Engine Upgrade. Read CLAUDE.md first, then CONTINUATION_PROMPT.md — scroll to "Sophie-Class Social Media Growth Engine Spec" section. Begin with Phase 1 (Wire Intelligence + Metrics Collection). Do not skip phases.
```

---

## Key Files
| File | Purpose |
|------|---------|
| `CLAUDE.md` | Binding governance for all Claude Code sessions |
| `docs/single_source_of_truth.md` | Authoritative architecture doc with Stabilization Roadmap |
| `ENGINEERING_STANDARDS.md` | Code quality requirements |
| `AGENT_REGISTRY.json` | AI agent configurations (51 agents) |
| `src/lib/constants/platform.ts` | DEFAULT_ORG_ID and platform identity |

## Documentation Inventory (Clean)

**Root docs** (5 files): CLAUDE.md, README.md, ENGINEERING_STANDARDS.md, COMPETITIVE_ANALYSIS_BRIEFING.md, SOCIAL-MEDIA-AI-SPEC.md
**docs/** (3 files): single_source_of_truth.md, playwright-audit-2026-01-30.md, test-results-summary.md
**docs/master_library/** (16 files): Per-feature audit summaries from Feb 5, 2026
**docs/archive/** (16 files): Historical records — do not reference for architectural decisions
**.claude/agents/** (6 files): QA and architecture agent prompts

**Deleted** (February 6, 2026): CONTINUATION_PROMPT.md (old), SYSTEM_TRANSFER_MANIFEST.md, PATH_SYNC_REPORT.md, WORKFLOW_STATE_IMPLEMENTATION.md, LEGACY_ROUTE_REDIRECTS.md, eslint-output.txt, tsc-output.txt, app_structure.txt, rule-breakdown.txt, unique-files-with-unused-vars.txt, docs/audit_dashboard_connectivity.md

---
---

# Sophie-Class Social Media Growth Engine Spec

> Added: February 7, 2026
> Source: Core Identity Audit session — full codebase analysis of agent capabilities, gap identification, and upgraded architecture design

## The Problem

The 5 marketing specialists (TWITTER_EXPERT, LINKEDIN_EXPERT, TIKTOK_EXPERT, FACEBOOK_EXPERT, SEO_EXPERT) generate sophisticated content but **do not operate accounts**. They cannot read engagement data, cannot reply to comments, cannot engage with industry accounts, cannot detect trends, and cannot learn from what worked. The AUTONOMOUS_POSTING_AGENT is a queue processor — it posts and forgets.

Current pipeline (one-way, broken):
```
Goal → Plan → Generate → Post → (nothing)
```

Target pipeline (closed-loop, autonomous):
```
RESEARCH → CREATE → PUBLISH → ENGAGE → ANALYZE → MUTATE → REPEAT
```

Reference model: **Sophie from Sintra AI** — an autonomous social media employee, not a scheduling tool. The human sets a goal ("Grow LinkedIn authority in AI sales automation by 20% this quarter"). The agents figure out the how, execute it, measure it, and pivot autonomously.

### 6 Critical Gaps

| # | Gap | What's Missing |
|---|-----|----------------|
| 1 | **No Listening** | System broadcasts posts but never reads engagement metrics, comments, or mentions back |
| 2 | **No Feedback Loop** | Posts go out, system never learns which performed well or why |
| 3 | **No Engagement Automation** | Can't reply to comments, like posts, follow targets, or DM prospects |
| 4 | **No Trend Detection** | TREND_SCOUT exists but isn't wired to marketing — no opportunistic content |
| 5 | **No Content Recycling** | No library, no repurposing, no evergreen rotation |
| 6 | **No Platform Coverage** | TikTok, Facebook, Instagram — content generated, never executed |

---

## Existing Infrastructure (Do NOT Rebuild)

| Asset | File | LOC | Status |
|-------|------|-----|--------|
| Twitter API v2 | `src/lib/integrations/twitter-service.ts` | 744 | Production — OAuth 2.0, posting, timeline with public_metrics, rate limiting |
| Autonomous Posting Agent | `src/lib/social/autonomous-posting-agent.ts` | 974 | Production — queue, scheduling, Twitter + LinkedIn posting |
| Social Post Service | `src/lib/social/social-post-service.ts` | 366 | Production — Firestore CRUD for posts |
| Marketing Manager | `src/lib/agents/marketing/manager.ts` | 1973 | Functional — campaign orchestration, SEO-social feedback loop |
| Twitter Expert | `src/lib/agents/marketing/twitter/specialist.ts` | 1209 | Functional — threads, hooks, ratio assessment |
| LinkedIn Expert | `src/lib/agents/marketing/linkedin/specialist.ts` | 1511 | Functional — post optimization, 3-tier personalization |
| TikTok Expert | `src/lib/agents/marketing/tiktok/specialist.ts` | 1063 | Functional — viral hooks, video pacing |
| Facebook Expert | `src/lib/agents/marketing/facebook/specialist.ts` | 1717 | Functional — ad creative, audience matching |
| SEO Expert | `src/lib/agents/marketing/seo/specialist.ts` | 1488 | Functional — keyword research, SERP analysis |
| TREND_SCOUT | `src/lib/agents/intelligence/trend/specialist.ts` | 1587 | Functional — broadcasts TREND_EMERGING signals (NOT wired to marketing) |
| SENTIMENT_ANALYST | `src/lib/agents/intelligence/sentiment/specialist.ts` | 834 | Functional — sentiment scoring, crisis detection (NOT wired to marketing) |
| Content Calendar | `src/lib/agents/content/calendar/specialist.ts` | 1331 | Functional — scheduling, cross-platform sync |
| MemoryVault | `src/lib/agents/shared/memory-vault.ts` | 864 | Production — pub/sub, insights, signals, cross-agent messaging |
| Webhook Verification | `src/lib/security/webhook-verification.ts` | — | Production — HMAC, signature verification |
| Cron Framework | `src/app/api/cron/scheduled-publisher/route.ts` | — | Production — Bearer token auth |
| PostMetrics Schema | `src/types/social.ts` | — | **Defined but empty** — fields exist, never populated |

**Key facts:**
- `getTimeline()` already returns `public_metrics` (likes, retweets, replies, impressions) — available but never stored
- `PostMetrics` interface exists but is never populated
- `processScheduledPosts()` exists in AutonomousPostingAgent but is never called
- MemoryVault `PERFORMANCE` category is ready for analytics data
- TREND_SCOUT already broadcasts signals — Marketing Manager just doesn't subscribe

---

## Implementation Phases

### Phase 1: Wire Intelligence + Metrics Collection (Foundation)

**1a. Engagement Metrics Collector Service**
- Create a service that fetches engagement data for published posts
- Use `TwitterService.getTimeline()` (already returns public_metrics)
- Match tweets to stored `social_posts` by `platformPostId`
- Update `PostMetrics` fields in Firestore with real data
- Store historical snapshots for delta tracking

**1b. Cron Endpoint `/api/cron/social-metrics-collector`**
- Authenticate via `CRON_SECRET` (same pattern as `/api/cron/scheduled-publisher`)
- Call metrics collector service (every 1-4 hours)
- Also trigger `processScheduledPosts()` (currently dormant)

**1c. Wire TREND_SCOUT → MARKETING_MANAGER**
- Marketing Manager subscribes to `TREND_EMERGING` signals via `getPendingSignals()`
- HIGH/CRITICAL trend → enter `OPPORTUNISTIC` mode → generate timely content → fast-track publish

**1d. Wire SENTIMENT_ANALYST → MARKETING_MANAGER**
- Subscribe to `BRAND_SENTIMENT_SHIFT` signals
- Negative spike → `CRISIS_RESPONSE` mode: pause publishing, generate response
- Positive spike → `AMPLIFICATION` mode: boost frequency, share positive mentions

### Phase 2: GROWTH_ANALYST (New Agent)

**Create `src/lib/agents/marketing/growth-analyst/specialist.ts`**

New L3 specialist under MARKETING_MANAGER. Agent ID: `GROWTH_ANALYST`.

Task types:
- `AGGREGATE_METRICS` — Read PERFORMANCE data from all platform specialists, normalize
- `CALCULATE_KPIS` — Follower Growth Rate, Engagement Rate, Virality Coefficient, Content Velocity
- `IDENTIFY_PATTERNS` — Which content types/topics/formats/times correlate with growth
- `GENERATE_MUTATIONS` — Produce mutation directives for each specialist:
  - `CONTENT_MIX_SHIFT` — Change ratio of content categories
  - `TONE_ADJUSTMENT` — Shift voice/style based on audience response
  - `POSTING_CADENCE` — Adjust frequency and timing
  - `FORMAT_PIVOT` — Prefer formats that perform (e.g., threads over single tweets)
  - `HASHTAG_STRATEGY` — Add/remove tags based on reach data
  - `TOPIC_KILL` — Stop producing content on underperforming topics
- `TRACK_OBJECTIVES` — Compare metrics against human-set growth objective
- `CONTENT_LIBRARY` — Track published content, tag top performers, flag recycling candidates
- `WEEKLY_REPORT` — Synthesize analysis into executive summary

Register in `src/lib/agents/index.ts` and `AGENT_REGISTRY.json`. Add to MARKETING_MANAGER specialist list.

### Phase 3: LISTEN Capabilities on Specialists

Add LISTEN task types to each platform specialist's `execute()` method:

**All specialists get:**
- `FETCH_POST_METRICS` — Pull engagement data for published posts
- `FETCH_MENTIONS` — Find brand mentions and conversations
- `FETCH_TRENDING` — Platform-specific trending topics in our industry
- `FETCH_AUDIENCE` — Follower count, growth rate, demographics

**Platform-specific additions:**
- TWITTER: `MONITOR_COMPETITORS` (track competitor tweets via user timeline endpoint)
- LINKEDIN: `FETCH_PROFILE_VIEWS`, `MONITOR_THOUGHT_LEADERS`
- TIKTOK: `FETCH_TRENDING_SOUNDS`, `MONITOR_CREATORS`
- FACEBOOK: `FETCH_AD_PERFORMANCE`, `FETCH_AUDIENCE_BREAKDOWN`

Each LISTEN task writes results to MemoryVault as `PERFORMANCE` category entries.

### Phase 4: ENGAGE Capabilities

**TWITTER_EXPERT engage tasks:**
- `REPLY_TO_COMMENTS` — Contextual replies to comments on our tweets
- `REPLY_TO_MENTIONS` — Respond to brand mentions (positive: thank, negative: address)
- `ENGAGE_INDUSTRY` — Like + thoughtful reply on industry leader posts
- `QUOTE_TWEET_STRATEGY` — Quote-tweet conversations with our take

**LINKEDIN_EXPERT engage tasks:**
- `REPLY_TO_COMMENTS` — Respond to comments on company posts
- `ENGAGE_PROSPECTS` — Comment on posts by target decision-makers
- `CONNECTION_NURTURE` — Value-add messages to new connections (value first, never pitch)

**TIKTOK_EXPERT engage tasks:**
- `REPLY_TO_COMMENTS` — Reply to video comments (first hour is algorithm-critical)
- `DUET_STRATEGY` — Identify trending videos to duet/stitch
- `CREATOR_OUTREACH` — Identify micro-influencers for collaboration

**FACEBOOK_EXPERT engage tasks:**
- `REPLY_TO_AD_COMMENTS` — Respond to comments on ads (social proof)
- `COMMUNITY_MANAGEMENT` — Monitor and engage in relevant groups

**Upgrade AUTONOMOUS_POSTING_AGENT** with new action types:
- `REPLY` — Execute reply to specific post/comment
- `LIKE` — Like a target post
- `FOLLOW` — Follow a target account
- `REPOST` — Retweet / LinkedIn share
- `RECYCLE` — Re-publish top performer with new hook after 30-day cooldown

**Compliance guardrails (mandatory):**
- Engagement velocity limits (max N actions/hour to avoid bot detection)
- DM only accounts that engaged with us first
- Sentiment gate before auto-replying
- Human escalation for complaints or legal language

### Phase 5: Content Recycling + Loop Orchestration

**Content Library & Recycling (in GROWTH_ANALYST):**
- Track all published content in MemoryVault (CONTENT category) with performance data
- Tag top performers (engagement rate > 2x average)
- After 30-day cooldown, flag as recyclable
- Generate "remix" briefs — same message, new hook/angle — route back through CREATE

**Marketing Manager orchestration modes:**

| Mode | Trigger | Behavior |
|------|---------|----------|
| `CAMPAIGN_SPRINT` | Human command | Current behavior — single campaign (keep as-is) |
| `GROWTH_LOOP` | Growth objective set | Continuous: LISTEN → ANALYZE → CREATE → PUBLISH → ENGAGE → repeat |
| `OPPORTUNISTIC` | TREND_SCOUT signal | Interrupt flow, fast-track trending content |
| `CRISIS_RESPONSE` | SENTIMENT_ANALYST signal | Pause publishing, deploy damage control |

**GROWTH_LOOP cycle:**
1. LISTEN — Dispatch LISTEN tasks to all specialists in parallel
2. ANALYZE — Send data to GROWTH_ANALYST for pattern analysis + mutation generation
3. MUTATE — Read mutation directives, distribute to specialists
4. CREATE — Dispatch content creation (existing behavior, now informed by mutations)
5. PUBLISH — Route through AUTONOMOUS_POSTING_AGENT with smart timing
6. ENGAGE — Dispatch engagement tasks based on LISTEN data
7. Wait for next cycle interval (configurable: 1x/day, 2x/day)
8. Repeat from step 1

### Phase 6: Finalize

- Update `AGENT_REGISTRY.json` (new agent count: 52 = 48 swarm + 4 standalone)
- Update `docs/single_source_of_truth.md` with new architecture
- Run `npm run lint`, `npx tsc --noEmit`, `npm run build`
- Commit to dev, push, sync worktrees per CLAUDE.md protocol

---

## Architecture Contracts (Read These Files First)

| File | LOC | What to Learn |
|------|-----|---------------|
| `src/lib/agents/types.ts` | 83 | AgentMessage, AgentReport, Signal interfaces |
| `src/lib/agents/base-specialist.ts` | 110 | Abstract methods every specialist must implement |
| `src/lib/agents/base-manager.ts` | 163 | Delegation rules, specialist management |
| `src/lib/agents/shared/memory-vault.ts` | 864 | Full cross-agent communication API |
| `src/lib/agents/index.ts` | 236 | Agent ID enum, factory pattern |
| `src/lib/agents/marketing/manager.ts` | 1973 | Marketing Manager (you're extending this) |
| `src/lib/agents/marketing/twitter/specialist.ts` | 1209 | Example specialist pattern to follow |
| `src/lib/integrations/twitter-service.ts` | 744 | Twitter API already available |
| `src/lib/social/autonomous-posting-agent.ts` | 974 | Posting infrastructure to upgrade |
| `CLAUDE.md` | — | **Binding governance — read first** |

## Constraints (from CLAUDE.md — binding)

- **Zero-Any Policy** — No `any` types. Proper generics and discriminated unions.
- **Do NOT modify** `eslint.config.mjs`, `tsconfig.json`, `.husky/`
- **Do NOT add** `eslint-disable` or `@ts-ignore` comments
- **Zod validation** on all new API endpoints
- **Service layer architecture** — business logic in services, not routes
- **All agents extend BaseSpecialist** — implement all abstract methods
- **All cross-agent communication through MemoryVault** — no direct agent calls
- **Commit format:** `feat: <description>` with `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`
