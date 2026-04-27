# SalesVelocity.ai — Full-Orchestration Continuation Prompt

> **Updated:** April 27, 2026 (overnight + morning, ~14 hours).
> **Status snapshot:**
>   - **Mastodon LIVE end-to-end** in BOTH directions: real outbound post (status `116474951515339832`) and real inbound DM round-trip (2 missions composed + sent successfully — see commits below).
>   - **Bluesky LIVE end-to-end** for inbound DM (verified earlier session). Outbound posting wired via Marketing Manager fast-path; needs a fresh real round-trip test.
>   - **X**: orchestration code verified live, but X-side webhook delivery still broken (X support ticket needed). Polling workaround forbidden by owner.
>   - **Jasper at v13** (was v12 yesterday). New rule: social posts MUST plan as 2 steps (delegate_to_marketing → social_post). Single-step plans calling social_post directly are forbidden.
>   - **Truth Social PARKED** — Cloudflare TLS fingerprinting blocks Node fetch in production. No path forward without browser-class TLS infra. Code preserved.
>   - **Specialists vision-aware**: MASTODON_EXPERT (and any DM-capable specialist using the shared mixin) now actually SEES image attachments via OpenRouter multipart/Claude vision. Caught when sender attached a brand banner with text "All new Look!" and the AI replied confused-by-text-only.
>   - **Three caching/safety bug classes fixed tonight**: Next.js fetch cache (cache:'no-store' on every external API call), api-key-service stale cache (60s TTL + Firestore onSnapshot real-time invalidation), social_posts query spam (composite-index-free rewrite + indexes added to firestore.indexes.json for future deploy).

---

# 🎯 TODAY'S WINS (April 26 evening → April 27 morning)

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

# 📋 INTEGRATION STATUS MATRIX (current)

Per-platform reality. "Compose" = specialist has compose_dm_reply via mixin. "Send (DM)" = OAuth + DM API send service. "Inbound" = webhook receiver or polling cron writing to inboundSocialEvents. "Outbound (post)" = social_post → autonomous-posting-agent dispatch wired.

| Platform | Compose | Send (DM) | Inbound | Outbound (post) | E2E | Notes |
|---|---|---|---|---|---|---|
| **Mastodon** (mastodon.social, hachyderm.io, etc.) | ✅ | ✅ | ✅ poll | ✅ | ✅ both directions LIVE | Full stack verified Apr 27. Real round-trip on @SalesVelocity_Ai. Vision-aware DM compose shipped (sees image attachments). |
| **Bluesky** | ✅ | ✅ | ✅ poll | ✅ via Marketing fast-path | ✅ inbound; ⚠ outbound needs fresh real test | Inbound verified earlier session. Outbound code path exists (autonomous-posting-agent has bluesky case) but a fresh real-post test post-Jasper-v13 hasn't run. |
| **X (Twitter)** | ✅ | ✅ | ⚠ webhook X-side broken | ✅ | ⚠ inbound blocked X-side | Orchestration code verified live; X webhook delivery itself fails X-side. |
| **LinkedIn** | ✅ | ❌ | ❌ | ✅ via Marketing fast-path | ❌ DM blocked | Send requires Marketing Developer Platform approval (gated, multi-day). Compose mixin done. |
| **Facebook Messenger** | ✅ | ❌ | ❌ | ✅ via Marketing fast-path | ❌ DM blocked | Meta Business Verification required for `pages_messaging` in production. |
| **Instagram** | ✅ | ❌ | ❌ | ✅ via Marketing fast-path | ❌ DM blocked | Same Meta Business Verification gate (`instagram_manage_messages`). Bundled with Facebook (single OAuth when verification clears). |
| **Pinterest** | ✅ | ❌ | ❌ | ✅ via Marketing fast-path | ❌ DM deferred | DM API exists but low priority — Pinterest is discovery, not conversation. |
| **Reddit** | ❌ | ❌ | ❌ | partial (post case in autonomous-posting-agent, no specialist) | ❌ blocked | New-account 24h gate on dev app creation (Apr 26 attempt failed). REDDIT_EXPERT specialist not built yet. |
| **Truth Social** | ✅ (parked) | ❌ | ❌ | ❌ stub | ❌ PARKED | Cloudflare TLS-fingerprint wall. No best-practice path. Code preserved; future-release. |
| **Threads** | ❌ | ❌ | ❌ | ✅ via Marketing fast-path | ❌ DM N/A | Threads public API supports posts/reads only — DMs not exposed. |
| **TikTok** | ❌ | ❌ | ❌ | ✅ via Marketing fast-path | ❌ DM N/A | TikTok DM API in beta, US-EXCLUDED — unusable from a US deployment. |
| **YouTube** | n/a | n/a | n/a | ✅ via Marketing fast-path | n/a | YouTube has no DM concept. Posting only (videos/community posts). |

## Other comms channels

| Channel | Outbound | Inbound | E2E | Notes |
|---|---|---|---|---|
| **Email (SendGrid)** | ✅ | partial | ✅ outbound | Domain auth on `salesvelocity.ai`, real send verified. Inbound parse endpoint exists; not yet routed through Jasper inbound-comms framework. |
| **SMS (Twilio)** | ⚠ | ⚠ | ❌ | Toll-free verification still under Twilio review. CTIA opt-in checkbox shipped on `/onboarding/industry`. Inbound SMS receive webhook still TODO once verification clears. |

## What unblocks what

| Action (off-Claude / external) | Unblocks |
|---|---|
| File X dev support ticket | X DM webhook delivery |
| Wait 24h+ then retry Reddit dev app | Reddit DM integration (and later REDDIT_EXPERT build) |
| Start Meta Business Verification | Facebook + Instagram DM (bundled OAuth flow) |
| Apply for LinkedIn Marketing Developer Platform | LinkedIn DM send |
| Twilio toll-free verification approval | SMS bidirectional + inbound webhook |

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
