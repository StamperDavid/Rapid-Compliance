# SalesVelocity.ai — Full-Orchestration Continuation Prompt

> **Updated:** April 29, 2026 (evening, ~12-hour fake-AI sweep + UI redesign teed up for next session).
> **Status snapshot:**
>   - **Backend health: GREEN.** Major fake-AI sweep closed today — ~15 patterns audited and fixed across managers, specialists, tool handlers, dashboards, dead-end Firestore writers, and verify scripts. Backend orchestration verified end-to-end via three real posts WITH IMAGES on three live brand accounts (Apr 29 evening run).
>   - **NEXT SESSION FOCUS: UI redesign of Content Generator + Social Hub.** Backend is in a known-good state — do NOT audit, refactor, or test backend code in the next session. Specific scope captured below in "Next Session Focus" section.
>   - **Three real posts with images** (Apr 29 evening orchestrated test, fix proven live):
>     - X: https://x.com/salesvelocityai/status/2049673177023004930
>     - Bluesky: https://bsky.app/profile/salesvelocity.bsky.social/post/3mkojzxuim52h
>     - Mastodon: https://mastodon.social/@SalesVelocity_Ai/116491235033176961
>   - **Jasper still at v13** + new runtime context injection: connected-platforms list flows through `/api/orchestrator/chat` so "all platforms" only fans out to platforms with state in [live_full, live_dm_blocked, live_no_dm] from `_platform-state.ts` (currently Bluesky / Mastodon / X — not LinkedIn / Meta / others).
>   - **TWITTER_X_EXPERT at v3** (280-char rule strengthened with explicit pre-output audit + ≤270 safety target).
>   - **CI auto-deploy for Firestore indexes** is now live (`.github/workflows/firestore-indexes.yml`). One-time setup pending: operator runs `firebase login:ci`, stores token as `FIREBASE_TOKEN` GitHub secret. After that, every future `firestore.indexes.json` change auto-deploys on merge to main.
>   - **One pending token rotation:** Firebase CI token was pasted in the Apr 29 evening transcript to set up the workflow. Per `memory/project_rotate_secrets_in_transcript.md`, must be rotated before launch (task #43).

---

# 🎯 TODAY'S WINS (April 29, 2026 evening — ~12-hour session)

## 1. Fake-AI sweep — ~15 patterns audited + fixed across 3 layers

7-agent parallel audit identified the structural rot the operator had been getting burned by: agents themselves call LLMs correctly, but the layers AROUND them (managers, tool handlers, dashboards, verify scripts) had been faking it.

**Manager-layer fake aggregation** (the worst — managers fabricated metrics + broadcast to Jasper as real specialist data):
- `RevenueDirector.synthesizeRevenueBrief` (`src/lib/agents/sales/revenue/manager.ts:1916-1935`) — invented avgBANTScore=72, responseRate=0.28, avgDiscount=12, avgReadinessScore=78, resolutionRate=0.72, plus hardcoded conversion ratios (0.65/0.75/0.40). Now computes from real signal counts; null where data isn't real. Confidence drops when fields are null instead of staying artificially high.
- `ReputationManager.calculateBrandHealth` (`src/lib/agents/trust/reputation/manager.ts:2197-2274`) — hardcoded `responseRate = 85`, invented 60/25/8/4/3 star fallback distribution, invented 50/30/20 sentiment fallback. Now nullable + zeros instead of inventions. Downstream consumers skip-when-null.
- `CommerceManager.generateRevenueBrief` (`src/lib/agents/commerce/manager.ts:838-854`) — returned $0 MRR / $0 ARR / $0 transactionVolume across the board (looked indistinguishable from a failing real business). Now nullable until Stripe wired.
- `MarketingManager.determinePlatformStrategy` (`src/lib/agents/marketing/manager.ts:2161-2302`) — regex+weights table pretending to be analysis (TikTok+50, X+30, FB+20, LinkedIn+15). Now LLM-first via OpenRouter; hardcoded scoring labeled fallback only.
- `OutreachManager.handleCartRecovery` (line 2391) — flipped from `BLOCKED` placeholder to honest FAILED status with "No specialist registered for CART_RECOVERY action." Ghosting recovery escalation extracted to `GHOSTING_RECOVERY_ESCALATION_PATH` const.
- `BuilderManager.buildAssetPackage` — returned `null` instead of `/assets/logo.png` fallback URLs. `generateMinimalBlueprint` no longer fabricates `estimatedConversionRate: 0.05` or `confidence: 0.6` — both nullable now with warnings on null hits downstream.
- `MasterOrchestrator.determineManagerHealth` — extended union with `'UNKNOWN'`, no-activity branch returns `'UNKNOWN'` instead of optimistic `'HEALTHY'`. Hardcoded duration estimates extracted to `TASK_DURATION_ESTIMATES_MS` const.

**Specialist partial-LLM coverage** (specialists that imported OpenRouter but only used it for some advertised actions):
- `GROWTH_STRATEGIST` — was 1/6 actions LLM-driven (DEMOGRAPHIC_TARGETING). Now 6/6 (BUSINESS_REVIEW, SEO_STRATEGY, AD_SPEND_ANALYSIS, CHANNEL_ATTRIBUTION, STRATEGIC_BRIEFING all wired). 5 new Zod schemas + `callGMLLM` helper. Threshold logic preserved as logged fallback.
- `TREND_SCOUT` — was 1/5 actions LLM-driven (`scan_signals`). Now `analyze_trend`, `trigger_pivot`, `track_competitor` also LLM-driven. `get_cached_signals` stays deterministic by design (pure cache filter).

**Specialist fake-LLM costumes** (modules that wore AI-agent shape but never called an LLM):
- `VOICE_AI_SPECIALIST` (Twilio dispatcher), `PRICING_STRATEGIST`, `CATALOG_MANAGER`, `PAYMENT_SPECIALIST` (Stripe/Shopify/Woo dispatchers) — honestly relabeled. Stripped decorative `systemPrompt`, `tools`, `outputSchema`, `maxTokens`, `temperature` from each (kept as zeros for type compliance with comment that SpecialistConfig is shaped to assume every specialist is LLM-driven, future structural cleanup).

**Jasper tool stubs handled** (8 tools that returned canned responses without doing real work):
- `update_pricing` → wired to `AdminFirestoreService.update` on platform-config doc.
- `get_analytics` → restricted `reportType` enum to `['overview']` (other branches were empty stubs).
- `provision_organization`, `generate_content`, `draft_outreach_email`, `generate_report`, `DEPLOY_SPECIALIST` (action-handler), `add_url_source` (lead-research-tools) — REMOVED from Jasper's tool list (definitions deleted from `JASPER_TOOLS` array AND case handlers deleted).

**Dead-end Firestore writers DELETED** (modules writing to collections nothing read):
- `src/lib/crm/relationship-mapping.ts`, `src/lib/crm/predictive-scoring-training.ts`, `src/lib/ab-testing/ab-test-service.ts` (whole directory), `src/lib/video/video-job-service.ts`, `src/app/api/admin/video/render/route.ts`. `src/lib/analytics/lead-nurturing.ts` surgically edited: `trackLeadActivity` + `createLeadSegment` + `getLeadsInSegment` + `LeadSegment` interface removed (the last returned hardcoded `['lead1', 'lead2', 'lead3']` regardless of segment criteria).

**Dashboard cleanup:**
- `/api/admin/stats` (`src/app/api/admin/stats/route.ts:261-282`) — hardcoded swarm count cap (47), `pendingTickets = 0`, `monthlyRevenue = 0` placeholders → real queries from `AGENT_REGISTRY` (which the Apr 29 03:58 commit rebuilt to 70 agents) + nullable fields where source not yet wired.

**Mission Control "Email Campaigns" label bug:**
- `src/app/(dashboard)/mission-control/_components/dashboard-links.ts` had stale mapping causing every social step to display "View in Email Campaigns." Now branches on `toolArgs.platform`: social platforms → `/social` (Social Hub), otherwise → `/email/campaigns`. `getDashboardLink` signature extended with `toolArgs` param; both call sites updated.

## 2. Verify-script suite restructured (Tier-2 structural rot)

Every prior `verify-X-live.ts` hand-built auth and POSTed directly to platform APIs, completely bypassing TwitterService / BlueskyService / MastodonService, the social_post tool, the Marketing Manager, and Jasper. That's the trap that hid today's X OAuth-flow bug for weeks despite "verify-twitter-post-live.ts" passing.

**33 misleading verify scripts renamed via `git mv`** (commit `5941f132`):
- 13 `.ts`: `verify-{platform}-post-live` → `verify-{platform}-credentials-direct`
- 19 `.js`: `verify-{x}-is-real` → `verify-{x}-gm-load` (these prove GM load, not delegation — Bug L is still latent because none verify the manager actually invokes the specialist)
- Plus rename for 2 generate-content live scripts → `-direct`
- `verify-mastodon-dm-live` → `verify-mastodon-dm-direct-orchestration` (was honest about being the architecture-violation path)
- `verify-outreach-sequence-action` → `verify-email-specialist-compose-direct`
- `verify-email-pipeline-live` → `verify-email-pipeline-credentials-direct`

**33 file headers rewritten honestly** (commit `75843709`): each says what it DOES test, what it does NOT test, and points at the real product-path verify or flags KNOWN GAP if none exists.

**4 NEW product-path verifies that drive the actual orchestrated chain:**
- `scripts/verify-twitter-orchestrated-post-live.ts`
- `scripts/verify-bluesky-orchestrated-post-live.ts`
- `scripts/verify-mastodon-orchestrated-post-live.ts`
- `scripts/verify-outreach-orchestrated-live.ts`
- Plus shared driver at `scripts/lib/orchestrated-social-verify.ts`

**All 4 PASS end-to-end live** with real posts on three brand accounts + real LLM-composed outreach email.

## 3. The bug that exposed everything: media not attaching to social posts

The first orchestrated test landed posts on all three platforms — but the operator caught visually that **the images were missing**. Logs showed `mediaUrls` was passed correctly through every step. Tracing revealed three separate "function accepts media, layer below silently drops it" bugs in `src/lib/social/autonomous-posting-agent.ts`:
- **Twitter:** `private async postToTwitter(postId, content, _mediaUrls?, accountId?)` — the underscore prefix on `_mediaUrls` is the TypeScript convention for "intentionally unused." Twitter media upload wasn't even attempted.
- **Bluesky:** `blueskyService.postRecord({ text: content })` — only text was passed; mediaUrls silently dropped.
- **Mastodon:** `mastodonService.postStatus({ status: content, visibility: 'public' })` — same; media never passed.

Three parallel sub-agents wired real media-upload methods on each service:
- `TwitterService.uploadMediaFromUrl` (uses OAuth 1.0a `/1.1/media/upload` — also fixed a separate latent bug where the previous `uploadMedia` was using Bearer auth which X rejects) + `postTweetWithMedia({ text, mediaUrls })`.
- `BlueskyService.uploadBlobFromUrl` (AT Protocol `com.atproto.repo.uploadBlob`, raw bytes) + `postRecordWithImages({ text, mediaUrls })` + `BlueskyBlobRef` type.
- `MastodonService.uploadMediaFromUrl` (POST `/api/v2/media`, multipart) + `postStatusWithMedia({ status, mediaUrls, ... })`. Accepts both 200 (sync image) and 202 (async video — id still valid for attaching).

`autonomous-posting-agent.ts` updated to actually pass `mediaUrls` through. Each platform caps at 4 attachments and slices/warns on overage.

**Verified live Apr 29 evening:** images attached on all three brand-account posts. social_post step duration jumped from <1s to 2.1-2.4s per platform — that delta is real upload work (fetch bytes from Firebase Storage, upload to platform, get media id, attach to post).

## 4. X OAuth 1.0a port (the morning's halt-on-X bug)

The morning's first orchestrated multi-platform test halted on the X step with `403 OAuth 2.0 Application-Only is forbidden`. Root cause: `TwitterService.makeRequest` only knew Bearer auth; X's POST `/2/tweets` requires user-context auth. Verify script worked because it hand-built OAuth 1.0a HMAC headers separately.

Ported the OAuth 1.0a signing logic into `TwitterService` (commit `6e707940`):
- `oauth1PercentEncode` + `buildOAuth1Header` helpers
- `makeRequest` now prefers OAuth 1.0a when its 4 creds present; falls back to Bearer for reads
- `postTweet` pre-flight check + error message updated
- Both factory functions (`createTwitterService` + `createTwitterServiceForAccount`) load consumerKey/consumerSecret/accessTokenSecret from apiKeys
- `TwitterConfig` + `apiKeys.social.twitter` + `apiKeys.integrations.twitter` types extended

## 5. Connected-platforms gating (LinkedIn excluded from "all platforms")

Morning test had Jasper fan out to LinkedIn (not OAuth-connected), and the mission halted there. Built runtime context injection in `/api/orchestrator/chat` (commit `6e707940`):
- `src/lib/orchestrator/connected-platforms-context.ts` reads `_platform-state.ts` `PLATFORM_CONFIG` and buckets platforms into POSTABLE (state in [live_full, live_dm_blocked, live_no_dm]) vs NOT-CONNECTED.
- Chat route appends a "## Currently connected social platforms (POSTABLE)" + "## NOT connected — do NOT plan posts for these" section to the system prompt at request time.
- No GM edit needed — the list stays current as connections come online.

## 6. Video tools wired (`produce_video` + `generate_video` + `assemble_video`)

These were `NOT_WIRED` stubs returning canned "Video Specialist rebuild in progress" errors despite the underlying `VIDEO_SPECIALIST` agent being real (Task #24 rebuild Apr 11). Wired to real services (commit `6e707940`):
- `produce_video` — full pipeline: `VIDEO_SPECIALIST.script_to_storyboard` → `createProject` → `saveApprovedStoryboard` → `generateAllScenes` (Hedra dispatch).
- `generate_video` — re-dispatches renders for an existing project's saved scenes.
- `assemble_video` — fetches completed Hedra scene URLs via `getHedraVideoStatus`, runs FFmpeg concat via `ffmpeg-utils`, uploads final video to Firebase Storage.
- 4 normalizers (`normalizeAspectRatio`, `normalizeResolution`, `normalizeVideoType`, `normalizeTargetPlatform`) map Jasper's loose strings onto strict pipeline unions.
- Real Hedra render test on `produce_video` still pending (task #27 — costs ~$5-15 in Hedra credits + 5-15 min per render).

## 7. TWITTER_X_EXPERT GM v3 — 280-char rule strengthened

Surgical PE-style edit per Standing Rule #2. Replaces v2's passive "EVERY tweet text field MUST be 280 characters or fewer. Count carefully." with explicit pre-output audit step + ≤270 safety target + named cost of failure ("schema validation will reject the entire output"). Deployed atomically v2 → v3 (`scripts/deploy-twitter-expert-gm-v3-thread-char-limit.ts`). Source feedback: `tfb_twitter_thread_char_limit_1777473795232`. Rollback: `deployIndustryGMVersion('TWITTER_X_EXPERT', 'saas_sales_ops', 2)`.

## 8. Firestore index automation (CI auto-deploy)

`firestore.indexes.json` had two missing composite indexes that fired `FAILED_PRECONDITION` errors on Mission Control polling and Social Hub polling: `missions(status, createdAt)` and `socialPosts(platform, createdAt)`. Both added to the file (commit `e288ab53`). `.github/workflows/firestore-indexes.yml` shipped (commits `957dc3ac`, `51e6980a` Node 24 bump) — auto-deploys indexes whenever `firestore.indexes.json` changes on `main`. **One-time setup pending** to fully unblock: operator runs `firebase login:ci` interactively, stores the resulting token as `FIREBASE_TOKEN` GitHub secret. After that, all future index additions deploy automatically.

Both indexes were deployed manually via the workflow's `workflow_dispatch` trigger (run #2 succeeded in 42s). Polling errors stopped within ~3 min as Firestore finished building.

---

# 🎯 NEXT SESSION FOCUS — UI redesign of Content Generator + Social Hub

The next session is INTENTIONALLY scoped to UI work. Backend is in a known-good state. **Do NOT audit, refactor, or test backend code in the next session.**

## Specific UI problems already audited (file:line refs)

**Content Generator structural smells:**
1. **No `/content/` hub page exists.** Opens to nowhere; sub-routes are siblings with no unifying surface. (No `src/app/(dashboard)/content/page.tsx` file.)
2. **Image Generator (`src/app/(dashboard)/content/image-generator/page.tsx`) is 16 lines of stub.** Imports the video studio's `StudioModePanel` and renders it standalone. No image-specific UI, no library, no history.
3. **`CONTENT_GENERATOR_TABS` (`src/lib/constants/subpage-nav.ts:188`) mixes tools and video-sub-pages as siblings:** Video / Calendar (video!) / Image / Editor (video!) / Library (video!) / Audio Lab. The middle three are video-sub-pages presented as first-class peers to the tools.
4. **"Create with AI" button is a navigation link to AI Workforce.** Should be embedded chat panel scoped to Content Manager.

**Calendar confusion:**
- The "Calendar" tab in Content Generator's nav points to `/content/video/calendar` — a video-production batch scheduler (BatchProject docs).
- The actual unified social content calendar already exists at `/social/calendar` (`src/app/(dashboard)/social/calendar/page.tsx`) — month/week/day views, platform/status filters, click-to-detail. Works.
- Recommendation: rename Content Generator's "Calendar" tab to "Video Schedule" or remove from the nav (it lives under Video anyway).

**Social Hub layout/design:** operator hasn't given specifics yet — drive a real test of the Social Hub via the live dev server, capture friction points, then redesign based on real friction (not abstract "good practices").

## Architectural decisions already made (don't re-litigate)

- **"Create with AI" architecture: Option B — Jasper-with-scope-hint** (the light path). Button opens an embedded chat panel inside the page (no navigation). Chat sends `scope: "content"` to the existing `/api/orchestrator/chat`. Jasper still plans, scoped to Content Manager's tools only via a system-prompt scope directive. ~1 day of work; chat-panel UI is the bulk, backend = small param.
- **Manager call: Content Manager** (not Marketing Manager) for the Content Generator surface. Content scope = blog/video/text/music/image. Marketing handles social posting + ads (future scoped chat for Social Hub).
- **Content Library MVP** (`/content/library` — does NOT exist yet): single page aggregating blog drafts (from blog collection) + video pipeline projects + missions with content-shaped step outputs (social posts, emails) + brand assets. Unified timeline, type badge, "View" → routes to original surface. NO tags / search / reuse / versions in MVP. ~3-4 days.
- **One chat-panel component, not N per hub.** Linear-style universal pattern: one `<ScopedChatPanel>` component, props that scope it (which manager, what context, what page invoked it). Re-use everywhere.
- **Specialist expansions** (NOT for the UI session, captured as task #39): newsletters (EMAIL_SPECIALIST), carousel posts (per-platform specialists), short-form / captions (VIDEO_SPECIALIST), press releases / case studies (BLOG_WRITER), Content Manager personality upgrade for memes/punchy/casual.
- **Translation** deferred until international tenants exist (post multi-tenant flip). Build prompts with `language` as first-class arg now (task #41).

## Hard guardrails for next session

- **No backend agent / specialist / GM edits.**
- **No Standing Rule #2 GM changes.**
- **No Brand DNA reseeds** — Standing Rule #1 stays put.
- **No commits without explicit operator request.**
- **No re-testing of backend integrations** the previous session verified.
- If you find a backend bug while doing UI work, log it (in the open-issues table below) and move on.

## First actions for the next session

1. Read `CLAUDE.md` (project standing rules)
2. Read `memory/MEMORY.md` (auto-memory index — context on operator preferences + recent handoffs)
3. Read `memory/project_live_test_monitoring_setup.md` (use the **Apr 29 evening updated filter** that includes `[ToolTrace]` — previous filter missed the per-step events)
4. Verify environment: `git status` clean on `dev`; dev server running on port 3000 (start via direct node call if not — pattern in monitoring memory)
5. Confirm Jasper GM v13 + TWITTER_X_EXPERT v3 active: `npx tsx scripts/dump-jasper-gm.ts | grep "GM id="` and `npx tsx scripts/dump-twitter-expert-gm.ts | grep "GM id="`
6. Surface understanding to operator concisely: list the audited problems above, confirm scope is UI only, ask what specific friction to tackle first OR offer to drive a real Social Hub UI test together

---

# 🎯 PRIOR WINS — historical context

# 🎯 PRIOR WINS (April 26 evening → April 27 morning)

## 1. Mastodon inbound DM auto-reply — real round-trip closed

Real DM from `@Rapidcompliance_US` → cron poll picks it up → MASTODON_EXPERT.compose_dm_reply produces brand-voice reply → mission lands in Mission Control → operator clicks Send Reply → reply lands in sender's DM thread on mastodon.social, properly threaded under the original DM, mention rendered as `@Rapidcompliance_US` (handle, not numeric ID).

Pipeline (text-only DM):
```
Mastodon /api/v1/conversations (cron, every 1 min, cache: no-store)
  → inboundSocialEvents doc (kind=direct_message_events, visibility=direct guard enforced)
  → orchestrateInboundDmReply
    → MASTODON_EXPERT.compose_dm_reply (real LLM via OpenRouter Claude)
  → Mission written to Firestore in COMPLETED state
  → operator clicks Send Reply in Mission Control
  → /api/orchestrator/missions/[id]/send-dm-reply
    → MastodonService.sendDirectMessage (real handle + in_reply_to_id for threading)
  → reply published as direct-visibility status
```

Pipeline (DM with image attached, vision-aware):
```
Same as above, with these added wrinkles:
  → cron extracts media_attachments from status, normalizes to image|video|audio|unknown
  → orchestration service forwards mediaAttachments[] to specialist payload
  → compose-dm-reply-shared mixin builds multipart user message
    (text block + image_url blocks for image-type attachments)
  → OpenRouter routes to Claude with vision input
  → AI reasons about the actual image, not just the alt text
```

## 2. Mastodon outbound post via Jasper orchestration — real post landed

First fully Jasper-orchestrated social post: https://mastodon.social/@SalesVelocity_Ai/116474951515339832
Content + DALL-E image, 2-step plan, end-to-end via:
```
User prompt → Jasper v13 plans 2 steps with media required
  → Step 1: delegate_to_marketing(platform=mastodon, verbatimText, topic, providedMediaUrls?)
    → Marketing Manager single-platform fast-path
      → MASTODON_EXPERT.generate_content (real LLM, ~10s)
      → generateAndStoreSocialPostImage (DALL-E + Firestore cache, ~30s)
        — UNLESS providedMediaUrls populated → operator's URL used as-is, no DALL-E spend
    → returns { primaryPost, imageUrl, mediaUrls }
  → Step 2: social_post(platform=mastodon, content=step_1_output_primaryPost,
                         mediaUrls=step_1_output_mediaUrls)
    → step_N_output references resolved by social_post handler
    → MastodonService.postStatus → real Mastodon API
```
The Marketing Manager fast-path supports any platform — only the OAuth + posting service implementation differs per platform.

## 3. Jasper GM v13 deployed (operator-delegated)

Surgical PE-style edit: replaces v12 line `"NOTE: For SOCIAL MEDIA POSTS, use social_post directly."` with a multi-paragraph 2-step social post directive. Source feedback: `tfb_jasper_2step_social_post_1777259809358` (status: applied). Rollback: `deployJasperGMVersion(12, '<reason>')`. Deploy script: `scripts/deploy-jasper-gm-v13-2step-social-post.ts`.

## 4. MASTODON_EXPERT + BLUESKY_EXPERT v2 GMs — full coverage

Both got `generate_content` action via the shared compose-dm-reply mixin pattern. v2 GMs reseeded with Brand DNA baked in per Standing Rule #1.

## 5. Image-resolution rule applied to BOTH blogs and social posts

Operator-provided image URL → used AS-IS, no DALL-E call, no API spend. Only when no media is provided does generation fire. Same logic in:
- `src/lib/content/blog-featured-image.ts` (fixed pre-existing bug — was firing unconditionally)
- `src/lib/content/social-post-image.ts` (new, mirrors blog helper)
- `delegate_to_content` accepts `providedMediaUrls`
- `delegate_to_marketing` accepts `providedMediaUrls`

## 6. Truth Social parked completely

Fully diagnosed and parked. Truth Social fronts its Mastodon-compatible API with Cloudflare bot management that fingerprints the TLS handshake itself (not headers). Node fetch fails, so Vercel serverless 403s in production. **No best-practice path exists**: no official API, no developer portal, no partner program; none of Hootsuite/Buffer/Later/Sprout support the platform; existing access tools (truthbrush, Apify, ScrapeCreators) are unofficial reverse-engineering with account-ban risk.

Code is preserved in case Truth Social ever opens up. The Truth Social code was generic Mastodon-API anyway, so the actual specialist + service was renamed to `MASTODON_EXPERT` / `mastodon-service` and that integration powers mastodon.social, hachyderm.io, etc.

## 7. Defensive guards on every DM dispatcher

The "auto-reply applies to private DMs ONLY, never public mentions" rule is now load-bearing in code, not just implicit in API design:
- **Mastodon dispatcher** — explicit `if (status.visibility !== 'direct') skip` guard
- **Bluesky dispatcher** — chat-message-shape assertion (chat lexicon is DM-only by spec; the assertion catches future API drift)
- **X dispatcher** — explicit `if (event.kind !== 'direct_message_events') skip` plus the existing Firestore `where('kind', '==')` filter

## 8. Three infrastructure bug classes fixed

| Bug | Cause | Fix | Why it bit us |
|---|---|---|---|
| `parseSocialPostArgs` platform whitelist | Hardcoded to `twitter\|linkedin` only | Now accepts all 15 platforms enumerated in `SOCIAL_PLATFORMS` | Mastodon→Twitter routing → 403 |
| `social_post` step refs literal | Step runner passes args verbatim; literal string `"step_1_output_primaryPost"` reached MastodonService | `social_post` handler resolves the pattern from prior `delegate_to_marketing` step's `toolResult` | Reply text was the literal ref string |
| send-dm-reply Mastodon recipient | Numeric account ID passed as recipient | Use `senderHandle` instead, plus `in_reply_to_id` for threading | Recipient never got notified |
| `apiKeyService` stale cache | 5min TTL; direct Firestore writes from save scripts bypassed invalidation | Reduced TTL → 60s, added `clearCache()` public method, added Firestore `onSnapshot` listener for real-time invalidation | DM dispatcher couldn't see fresh Mastodon token after exchange |
| Next.js fetch cache | No `cache: 'no-store'` on external API fetches | Added on every fetch in mastodon/bluesky/twitter-dm services + bluesky dispatcher | Empty `/api/v1/conversations` cached, subsequent polls returned stale empty |
| `social_posts` Firestore index spam | `where(status) + orderBy(time)` requires composite index, never deployed | Rewrote queries to single-field where + JS sort/slice; added the indexes to `firestore.indexes.json` for future Firebase deploy | Log filled with `FAILED_PRECONDITION` every 30s |

## 9. Memory updates

- `feedback_check_platform_api_posture_first.md` — before integrating any new social platform, check official API + scheduler support FIRST. Truth Social was 2hrs of wasted code before discovering the Cloudflare wall.
- `feedback_business_account_setup_step_by_step.md` — when integrating any new platform, walk operator through business-account creation step-by-step (signup link, exact field values, business profile setup, DM settings, email verification) BEFORE jumping to OAuth/API. Brand presence IS the integration.

---

# 🛑 OPEN ISSUE — X webhook delivery is broken (X-side, unchanged)

**Symptom**: Inbound DMs to `@salesveloc42339` arrive in the brand inbox on X but X never POSTs them to our webhook URL. Initial events fired briefly during setup, then nothing.

**Root cause hypothesis (unverifiable from our side)**: Brand account is <day-old + failed initial reply attempts may have triggered silent throttling. X's webhook delivery has internal logs we can't see.

**Action**: file X dev support ticket. Reference: subscription_id `2048327771349532672`, webhook_id `2048332975511879680`, brand user_id `2048199442067755008`, app id `32832766`. **Polling workaround forbidden by owner.**

**Latency requirement (when delivery resumes)**: end-to-end ≤10 seconds. Current cron-based dispatcher (every 1 min) adds up to 60s. Webhook-driven inline dispatch is the right architecture; the receiver should call orchestrateInboundDmReply directly when it persists the inbound event.

---

# 📋 PLATFORM VIABILITY MATRIX (revised Apr 27 2026 — tier-based, research-validated)

**Critical change from previous session:** Apr 27 2026 the owner called out 2× operator-time waste on platforms that turned out to be incompatible with our SaaS commercial use case (Telegram + Reddit). New rule: **apply the platform viability rubric BEFORE any operator setup walkthrough.** See `memory/project_platform_viability_matrix.md` for the binding rubric.

The 6-check rubric:
1. Public API for posting + reading?
2. Commercial access without enterprise-budget approval ($10K+/mo)?
3. Self-service or pre-approval-gated?
4. Supports our shape (cross-account SaaS posting on behalf of clients, inbound DM auto-reply)?
5. UI-side filter that nullifies API value (e.g. X Chat encryption)?
6. User base aligned with US SMB target?

A platform must pass ALL 6 to make Tier 1 or Tier 2.

## TIER 1 — Posting + DM both viable for SaaS (PURSUE FULLY)

| Platform | Status today | DM use case | Approval gate |
|---|---|---|---|
| **Bluesky** | ✅ both directions LIVE Apr 27 (real outbound + inbound DM round-trip) | open chat lexicon, polling | none — open API |
| **Mastodon** | ✅ both directions LIVE Apr 27 (vision-aware DM compose) | direct visibility statuses, polling | none — open protocol |
| **X (Twitter)** | ⚠ outbound LIVE; inbound DM blocked at receiver per Apr 27 cost decision | LEGACY DMs only (X Chat E2E encrypted, API can't see); spam-filtered by X UI | Pay-Per-Use ($25 floor) |
| **Facebook Messenger** | external block | customer-initiated 24h window — fits auto-reply pattern | Meta Business Verification (3-7 days typical, 1-2 wk worst case) |
| **Instagram** | external block | same Meta gate as FB, instagram_manage_messages | Meta Business Verification (bundled w/ FB) |

## TIER 2 — Posting only, no DM, valuable for distribution (PURSUE)

| Platform | Approval gate | Notes |
|---|---|---|
| **LinkedIn** | Marketing Developer Platform (1-3 wk, selective) | DM API requires Partner status — months/never; treat as POSTING ONLY |
| **YouTube** | Google OAuth verification (1-4 wk) | No DM concept on YouTube; community posts |
| **Threads** | Meta gate (bundled with FB/IG) | Threads public API exposes posts/reads only — DMs not in API |
| **Pinterest** | Developer Portal review (1-3 days, fastest external) | DM API exists but Pinterest is discovery, not conversation — defer DM |
| **Google Business** | Google Profile verify (postcard 5-14 d, phone faster) + GCP OAuth | No DM concept (Business Profile is publish-only) |

## TIER 3 — Skip / Delete (NOT VIABLE for our use case)

| Platform | Reason | Status |
|---|---|---|
| **Reddit** | Commercial API "effectively impossible" without $10K+/mo enterprise. Devvit is community-scoped. Verified Apr 27. | **MARKED FOR DELETION** — see `memory/project_reddit_parked.md`. Code exists (REDDIT_EXPERT + GM + scripts) pending cleanup. Brand account `u/HuckleberryIII9199` dormant. |
| **Telegram** | US SMB <10% adoption. Requires personal phone for SMS verification. No commercial brand-account flow. | **MARKED FOR DELETION** — see `memory/project_telegram_marked_for_deletion.md`. Code exists (TELEGRAM_EXPERT + GM + scripts) pending cleanup. |
| **TikTok** | DM API US-EXCLUDED. Content Posting API selective approval. Audience misalignment for B2B SMB targeting. | DEFER — re-evaluate if Gen Z SMB pivot |
| **WhatsApp Business** | Customer-initiated only (24h window). Narrow use case for marketing/outreach. Better fit for inbound customer support. | DEFER — re-evaluate when customer-support automation is on roadmap |
| **Truth Social** | Cloudflare TLS-fingerprint wall blocks Node fetch in production. No path forward. | PARKED (existing) |

## Competitive validation (Apr 27 2026)

The tier matrix was cross-checked against established competitors:

- **Sintra.ai** (closest competitor — AI agent for SMBs): supports only Facebook + Instagram POSTING. NO DMs. NO other social platforms. Our scope already exceeds theirs (Bluesky + Mastodon both directions live).
- **ManyChat** (DM automation leader): Instagram, Facebook Messenger, WhatsApp DM only. Validates customer-initiated 24h-window DM auto-reply as the proven commercial pattern.
- **Hootsuite + Buffer + Sprout Social** (multi-platform standard): all support FB/IG/LinkedIn/X/YouTube/TikTok. Sprout adds Threads. **None support Reddit or Telegram for marketing automation** — confirms Tier 3 verdict.

## Other comms channels

| Channel | Outbound | Inbound | E2E | Notes |
|---|---|---|---|---|
| **Email (SendGrid)** | ✅ Pro 100K active Apr 27 | partial | ✅ outbound LIVE Apr 27 (real send verified, inbox placement, no "via sendgrid.net" indicator — domain auth working) | Domain auth on em3994.salesvelocity.ai + em2756.rapidcompliance.us. Single sender dstamper@salesvelocity.ai. Subuser infra ready for multi-tenant flip. Inbound parse endpoint exists; not yet routed through Jasper inbound-comms framework. |
| **SMS (Twilio)** | ⚠ | ⚠ | ❌ | Toll-free verification still under Twilio review. CTIA opt-in checkbox shipped on `/onboarding/industry`. Inbound SMS receive webhook still TODO once verification clears. |

## What unblocks what (revised)

| Action (off-Claude / external) | Unblocks | Expected timeline |
|---|---|---|
| **Meta Business Verification** | Facebook + Instagram + Threads (3 platforms in 1 application) | 3-7 days typical, 1-2 wk worst case |
| **LinkedIn Marketing Developer Platform** | LinkedIn POSTING (DM is enterprise-gated, treat as posting only) | 1-3 weeks, selective approval |
| **YouTube / Google OAuth verification** | YouTube community posts | 1-4 weeks (slowest gate) |
| **Pinterest Developer Portal** | Pinterest pin posting | 1-3 days (fastest gate) |
| **Google Business Profile claim/verify + GCP OAuth** | Google Business local posts | days (postcard mail can be 5-14 d) |
| **Twilio toll-free verification** | SMS bidirectional + inbound webhook | under Twilio review (no operator action) |
| **X dev support ticket** | X DM webhook delivery — but practical value is low (X Chat blocks 95%+ of legitimate DMs anyway, legacy DMs are mostly spam) | days (deprioritized) |

**Operator priority order tonight (week-to-launch deadline):**
1. **Pinterest Developer Portal** (fastest, 1-3 d)
2. **Meta Business Verification** (biggest single unlock — FB + IG + Threads, 3-7 d)
3. **LinkedIn MDP** (selective, start clock now)
4. **YouTube / Google verification** (slowest, start clock now)
5. **Google Business Profile verification** (start postcard process)
6. Skip: Reddit, Telegram, TikTok DM, WhatsApp Business, Truth Social

---

# 🔴 STEP 0 — Automatic setup when this session opens (do without being asked)

1. **Read memory in this order** — ground truth:
   - `memory/MEMORY.md` (the index)
   - The most recent session-handoff memory (Apr 27)
   - `memory/project_jasper_only_job_is_intent.md`
   - `memory/feedback_finish_one_thing_before_moving_to_next.md`
   - `memory/feedback_check_platform_api_posture_first.md` (NEW Apr 26)
   - `memory/feedback_business_account_setup_step_by_step.md` (NEW Apr 26)
   - `memory/project_live_test_monitoring_setup.md`
   - `memory/project_manager_auto_review_disabled.md`
   - `memory/project_email_domain_dev_vs_launch.md` — rapidcompliance.us during dev, salesvelocity.ai at launch
   - `memory/project_rotate_secrets_in_transcript.md`

2. **Check `D:/rapid-dev/.next` cache.** If stale after a merge, `rm -rf D:/rapid-dev/.next`.

3. **Check if a dev server is running on :3000.** If yes, leave it. If not, start via direct node call (npm shim breaks stdio redirect on Windows bash):
   ```
   cd "D:/rapid-dev" && node "./node_modules/next/dist/bin/next" dev > "D:/rapid-dev/dev-server.log" 2>&1
   ```
   Use `run_in_background: true`. Wait for "Ready in" before proceeding.

4. **Arm the expanded log monitor immediately.** Filter spec is in `memory/project_live_test_monitoring_setup.md`. `Monitor` tool, `persistent: true`, `timeout_ms: 3600000`.

5. **Confirm active GMs:**
   ```
   npx tsx scripts/dump-jasper-gm.ts | grep "GM id="
   npx tsx scripts/dump-copywriter-gm.ts | grep "GM id="
   npx tsx scripts/dump-email-specialist-gm.ts | grep "GM id="
   ```
   Expect: `jasper_orchestrator_v13`, `sgm_copywriter_saas_sales_ops_v3`, `sgm_email_specialist_saas_sales_ops_v2`.

   Plus social specialists at v2:
   ```
   sgm_mastodon_expert_saas_sales_ops_v2
   sgm_bluesky_expert_saas_sales_ops_v2
   ```

6. **Tell the operator** "Ready. Monitor armed. Jasper v13 + MASTODON_EXPERT v2 + BLUESKY_EXPERT v2 confirmed active." — don't wait to be asked.

---

# 🧭 NEXT-SESSION OPTIONS (ranked by actionability)

The user's preference is to finish ONE thing completely before moving to the next. The Mastodon round-trip is closed; the next options are:

## Today-actionable (no external clocks)

1. **Bluesky outbound posting fresh verification** — same flow we verified for Mastodon, code path supports it (autonomous-posting-agent's `case 'bluesky'`). Real test post to @salesvelocity.bsky.social, ~5 min of operator time.
2. **Mastodon vision DM verify** — send a fresh DM from another account WITH an image attached. Watch the AI compose a reply that actually addresses the image. Closes the vision-aware specialist proof.
3. **Posting-only platforms** (no DM dimension): YouTube, Threads, Pinterest organic posting. Marketing Manager fast-path already supports them in code; needs OAuth + posting service per platform. ~1-2 hours each.

## Externally blocked (waiting on clocks)

4. **LinkedIn DM send wiring** — needs MDP application started (off-Claude task)
5. **Meta FB/IG DM send wiring** — needs Business Verification kicked off (off-Claude task)
6. **Reddit specialist + DM polling** — wait for the 24h account-age gate to lift (Apr 26 4PM signup → ~Apr 27 4PM). REDDIT_EXPERT needs to be built; code stub for posting exists in autonomous-posting-agent.
7. **SMS bidirectional** — Twilio toll-free verification still pending review
8. **X DM webhook delivery** — X support ticket

## Architecture / cleanup

9. **Latency reduction for inbound DM polling** — ≤10s requirement. Bluesky and Mastodon both poll every 60s; webhooks would be near-instant but neither platform offers them for chat. Options: Firestore listener bridge + worker, or accept polling cadence.
10. **Marketing Manager `checkIntelligenceSignals` error** — pre-existing low-severity error logged on every Marketing Manager invocation. Doesn't block flow but spams logs.

---

# 📦 COMMITS LANDED THIS SESSION (branch `dev`)

In chronological order tonight:

| SHA | Title |
|---|---|
| `99ab7704` | feat(mastodon): inbound DM auto-reply integration + park Truth Social |
| `41d26c38` | feat(social-orchestration): single-platform post fast-path + image-resolution rule |
| `664f5856` | fix(social_post): accept all 15 platforms + resolve step_N_output references |
| `3cae8b6b` | docs: CONTINUATION_PROMPT updated for Apr 26-27 overnight wins (early) |
| `5e8125e6` | fix(send-dm-reply): use Mastodon handle (not numeric id) as mention recipient + thread DMs |
| `a492b77f` | fix(infra): three caching/safety bugs caught during Mastodon round-trip test |
| `05134fc3` | feat(dm-vision): specialists actually see attached images on inbound DMs |
| `67dc8015` | fix(social-status): stop FAILED_PRECONDITION spam on agent-status + engagement polls |

Plus Jasper GM v13 deployed via `scripts/deploy-jasper-gm-v13-2step-social-post.ts` (Firestore write, not in git).

---

# THE ROADMAP — sequenced for single-tenant-done → multi-tenant

Multi-tenant conversion with a broken single-tenant loop is a nightmare. Order of operations is fixed:

## Stage A.6 — Inbound DM auto-reply via Jasper ✅ DONE earlier session

## Stage A.7 — Outbound social post via Jasper ✅ DONE this session (Apr 27)

Real Mastodon post landed via 2-step Jasper plan. Fast-path supports any platform. Bluesky outbound just needs the verification test.

## Stage B — Twilio toll-free SMS verification (under Twilio review)

Owner has resubmitted with corrected info + new opt-in URL. Once approved, SMS sending unblocks. While waiting:
- Verify SMS opt-in checkbox actually persists `tcpa_consent` end-to-end with a real account creation
- Build SMS receive webhook (must go through Jasper, not auto-reply directly). Reuse the inbound-DM-orchestration pattern; `compose_dm_reply`-style specialist action becomes a generic inbound-comms framework.

## Stage C — Connect remaining social accounts

Per the matrix above — actionable today: posting-only platforms (YouTube, Threads, Pinterest organic). Blocked on external approvals: LinkedIn (MDP), Meta (Business Verification), Reddit (account age + REDDIT_EXPERT build), TikTok (US-excluded for DMs).

For EACH platform, the bar is: real post landed on the platform from the live system. Not "credentials saved."

## Stage D — Specialist GMs trained on each platform's organic + paid playbook

Each marketing-department specialist needs platform-specific algorithm knowledge baked into its Golden Master. Operator-delegated GM edits, one specialist per session.

## Stage E — Paid ads on each platform

Separate setup from organic posting:
- X Ads — separate Ads API approval queue
- Meta Ads — Meta Business Suite + Ads Manager
- TikTok Ads — TikTok Ads Manager
- LinkedIn Ads — Campaign Manager
- YouTube/Google Ads — Google Ads account

Each requires its own ad account, billing, policy review.

## Stage F — Multi-tenant conversion

Only after Stages A-E are clean. Re-add `organizationId` parameter throughout data access helpers, re-enable multi-tenant Firestore rules, per-tenant Brand DNA, per-tenant GM versioning, tenant provisioning + onboarding.

---

# THE ROLE SPLIT (binding)

| **Driven autonomously by Claude (mechanics)** | **Driven by operator (content + quality judgment)** |
|---|---|
| Did Jasper plan correctly? | Is the blog actually good? |
| Did the right specialists get invoked? | Does the video tone match the brand? |
| Did the workflow run end-to-end without errors? | Does the email copy convert? |
| Did deliverables land in the expected places? | Is the social post on-brand? |
| Did cleanup work between runs? | Does the campaign feel cohesive? |
| Are there hangs, retries, silent failures, zombie work? | Did the system understand WHAT the user wanted? |
| **Architecture violations** | **Final approve/reject on every edge case** |

**When Claude finds an orchestration failure:** fix it autonomously per CLAUDE.md guardrails. Do not interrupt the operator until either (a) a deliverable is ready for human review, or (b) all queued fixes are complete. **Architecture violations get DISABLED first, then surfaced to the operator with a proper rebuild plan — never papered over.**

**No half-finished work, no "not blocking" deferrals, no shortcuts.** The operator has called this out repeatedly — stick with it.

---

# AUTOMATED TEST HARNESSES

**Existing — planning + lifecycle:**
- `scripts/verify-prompt-matrix.ts` — 49 prompts, planning-layer coverage. Last: 242/245 at 5 iter.
- `scripts/verify-prompt-matrix-e2e.ts` — full mission-lifecycle E2E.
- `scripts/verify-mission-execution-lifecycle.ts` — plan approval + retry + halt + resume.

**Existing — outbound:**
- `scripts/verify-twitter-post-live.ts` — fires a real test tweet via OAuth 1.0a User Context.
- `scripts/verify-bluesky-post-live.ts` — fires a real test post.
- `scripts/verify-mastodon-post-live.ts` — fires a real test status (direct service call).
- `scripts/verify-mastodon-orchestrated-post-live.ts` — drives the Marketing Manager fast-path end-to-end. **Branch A** (no media) and **Branch B** (operator URL) both verified.
- `scripts/verify-mastodon-generate-content-live.ts` — MASTODON_EXPERT generate_content via real LLM.
- `scripts/verify-bluesky-generate-content-live.ts` — same for BLUESKY_EXPERT.
- `scripts/verify-email-pipeline-live.ts` — real SendGrid send.
- `scripts/verify-sequence-outreach-wiring.ts` — synthetic lead_created → real per-recipient sequence jobs.

**Existing — inbound DM:**
- `scripts/verify-mastodon-dm-live.ts` — synthetic inbound DM event → orchestration → mission COMPLETED.
- `scripts/verify-bluesky-dm-live.ts` — same for Bluesky.
- `scripts/verify-jasper-dm-reply-live.ts` — full Jasper-mediated DM path (X).

**Diagnostics shipped this session:**
- `scripts/debug-mastodon-inbox.ts` — poll conversations directly
- `scripts/debug-mastodon-notifications.ts` — check filtered-notifications policy
- `scripts/debug-mastodon-dispatcher-trace.ts` — step-by-step dispatcher logic
- `scripts/debug-mastodon-recent-statuses.ts` — see what was actually posted
- `scripts/accept-mastodon-pending-requests.ts` — one-shot, accept all pending DM requests
- `scripts/update-mastodon-notification-policy.ts` — set all 5 policy axes to accept
- `scripts/dump-mission-step.ts` — Firestore step inspector
- `scripts/dump-recent-missions.ts` — last 5 missions
- `scripts/connect-mastodon.ts`, `register-mastodon-app.ts`, `exchange-mastodon-code.ts` — OAuth flow
- `scripts/save-mastodon-config.ts` — save credentials directly when token already exists
- `scripts/park-truth-social.ts` — one-shot Truth Social parking

---

# CLEANUP DISCIPLINE — between runs

```
npx tsx scripts/cleanup-test-data-recursive.ts --confirm
```

Preserves demo + live work, deletes test pollution across all collections (missions, workflows, workflowSequenceJobs, campaigns, sequences, scene_previews, missionGrades, trainingFeedback, conversations, **inboundSocialEvents**, etc.). First run on Apr 25 cleared 123 docs.

Paid artifacts (Hedra videos, DALL-E, Apollo, X tweets at $0.015-0.20) — either skip in matrix or accept the spend. Owner has X auto-reload on with $25 floor.

---

# MONITORING

Full filter spec + supplementary monitor scripts in `memory/project_live_test_monitoring_setup.md`. Arm the main Monitor on every dev server restart. Start `monitor-node-health`, `track-api-costs --tail`, `detect-zombie-work --tail` for live Mission Control testing; skip for background matrix runs.

---

# KNOWN OPEN ISSUES (current)

| ID | Description | Severity | Status |
|---|---|---|---|
| ~~inbound-social-dispatcher architecture~~ | ✅ Closed earlier session | — | DONE |
| ~~Real inbound-DM round-trip pending~~ | ✅ Closed Apr 27 — Mastodon round-trip live | — | DONE |
| X webhook delivery | X-side; brand inbox receives DMs but X never POSTs to webhook URL | HIGH | Owner action: file X dev support ticket |
| Mastodon vision DM real-image test | Code path verified by static review + commit; needs an actual image-attached DM round-trip to fully prove | Medium | Owner: send a DM with an image attached |
| Twilio toll-free SMS | Resubmitted with CTIA opt-in URL — under review | Medium | Owner waits on Twilio; nothing to do until response |
| Marketing Manager `checkIntelligenceSignals` error | Pre-existing: `Cannot read properties of undefined (reading 'includes')` at `base-specialist.ts:77`. Surfaces on every Marketing Manager invocation, doesn't block flow. | Low | Investigate pendingSignals shape vs classifier expectation |
| Reddit dev app gate | New-account 24h gate blocked Apr 26 attempt | Medium | Wait + retry. After app, build REDDIT_EXPERT specialist + DM polling cron. |
| Bluesky outbound post fresh verify | Outbound code path exists; not re-tested under Jasper v13 | Low | Run `scripts/verify-bluesky-post-live.ts` or drive via Jasper prompt |
| Latency requirement (≤10s for inbound DMs) | Bluesky + Mastodon poll every 60s; X webhook would be instant if delivery worked | Medium | Webhook-style architecture for non-X platforms (Firestore listener bridge?) |
| Bug F | Only COMPETITOR_RESEARCHER — no INDUSTRY_RESEARCHER | Medium | Every "research our product" prompt scrapes competitors instead |
| Bug H | Zombie work after mission cancel/halt | Medium | `detect-zombie-work.ts` flags it |
| Bug L | Content Manager registers BLOG_WRITER / PODCAST_SPECIALIST / MUSIC_PLANNER but never invokes them | Medium | Audit all managers for unreachable specialists |
| `social_posts` composite indexes not deployed | `firestore.indexes.json` updated; needs `firebase deploy --only firestore:indexes` | Low | Code-level fix already shipped (queries no longer require composite); deploy is a perf optimization |
| Apollo Technographic Scout | Tries to scrape topic strings as URLs | Low | Errors but doesn't halt |
