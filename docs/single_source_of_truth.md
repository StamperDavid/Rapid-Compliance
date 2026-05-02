# SalesVelocity.ai - Single Source of Truth

**Generated:** January 26, 2026
**Last Updated:** May 2, 2026 (Mission Control component extraction + InlineReviewCard + platform pending-step API). **Component extraction:** `DetailOutputRenderer`, `UpstreamChangedBanner`, `ManualEditOutputBox` moved from `mission-control/page.tsx` into `src/components/mission-control/` (reusable across hubs). **InlineReviewCard** (`src/components/mission-control/InlineReviewCard.tsx`) — embeddable mission-step review card; renders AWAITING_APPROVAL/FAILED step inline inside any platform dashboard. **New API route:** `GET /api/social/platforms/[platform]/pending-mission-step` — returns the most-recent AWAITING_APPROVAL mission tagged with the platform plus its first FAILED step; auth + rate-limit guarded. **`findPendingMissionForPlatform()`** added to `src/lib/orchestrator/mission-persistence.ts` (requires composite Firestore index: `metadata.platform ASC, status ASC, createdAt DESC`). **PlatformDashboard** wired to fetch pending step on mount and on `visibilitychange` re-focus; `InlineReviewCard` renders between `AudienceTrajectoryPanel` and HERO 3-COL grid. tsc + eslint clean, zero new `any` types, zero `eslint-disable` comments.

**Prior Last Updated:** April 30, 2026 (Scheduling rebuild Stages 1–6 + Zoom User-OAuth + content engine refresh: media library, Magic Studio, video editor, music gen, Hedra verify). **New L2 manager (OPERATIONS_MANAGER) + new L3 specialist (SCHEDULING_SPECIALIST)** raise the swarm to 10 L2 managers / 57 specialists / 72 agents total (1 L1 + 10 L2 + 57 L3 + 4 standalone). Three GMs seeded in dev Firestore: `gm_orchestrator_v1` (Jasper, re-seeded with `delegate_to_operations`), `mgm_operations_manager_saas_sales_ops_v1`, `sgm_scheduling_specialist_saas_sales_ops_v1`. **Scheduling system (Stages 1–6) shipped end-to-end:** new `meetingProvider` discriminator (`'zoom' | 'google_meet' | 'teams' | 'none'`) on every meeting record, per-day availability config + `/settings/meeting-scheduler` UI, demo-scheduling checkbox on `/early-access` (lead capture and booking are independent), unified calendar dashboard at `/calendar` reading from 5 sources (meetings, bookings, Google Calendar sync, scheduled posts, CRM activities) with filter chips, editable scheduling messages template at `/settings/scheduling-messages` (8 fields with `{firstName}`/`{meetingDate}`/`{zoomLink}`/etc. variables, defaults preserved when doc absent), full Zoom User-OAuth (`/api/integrations/zoom/{auth,callback,disconnect}`), `/settings/integrations` Zoom card with two-step disconnect, dual-write compat shim to legacy `integrations/all` map doc so the integrations UI shows ✓ Connected without refactor. New Jasper tool `delegate_to_operations` with intent rules (operator picks the time, attendees must already exist in CRM). **Content engine refresh:** Hedra verified live via new `scripts/verify-hedra-live.ts`; AI music generation via Replicate MusicGen (`src/lib/music/music-generation-service.ts` + `/api/content/music/generate` + AI Music tab in `/content/voice-lab`); unified media library (`src/types/media-library.ts` introduces canonical `UnifiedMediaAsset` with `MEDIA_CATEGORIES` enum — legacy `MediaItem` retained for back-compat with the existing video library page; service at `src/lib/media/media-library-service.ts`; browser at `/media`; backfill at `scripts/backfill-media-library.ts`); Magic Studio at `/studio` (single-canvas + command bar + Image/Video/Music/Text tools wired to their generate endpoints + recent-generations sidebar); standalone Video Editor at `/content/video/editor` (timeline trim/split/merge, drag-positioned text overlays, brightness/contrast/saturation/hue per clip, transitions, FFmpeg render via `/api/video/editor/render`). **Architectural / standing-rule fixes:** `useAdminSdk` opt-in flag added to `getIntegrationCredentials`, `saveIntegrationCredentials`, `disconnectIntegration` (and `createLead`) so public/server-context routes work without `request.auth`; `oauth-state.ts` migrated to Admin SDK throughout; `AdminFirestoreService.set` and `.get` are now generic (`<T extends object>`) so typed callers don't need `Record<string, unknown>` casts; sidebar nav additions (Calendar in Dashboard section; Studio + Video Editor + Media Library in Marketing section). **New standing rules logged to memory this session:** finish each thing to production-ready before moving on; never read credentials from screenshots — use Copy buttons; destructive UI actions need two-step confirmation; estimate in parallel-agent-hours, not solo dev-weeks.

**Prior — April 29, 2026 (evening, ~12-hour fake-AI sweep + UI redesign teed up).** **Major fake-AI sweep closed:** ~15 patterns audited and fixed across 3 layers (manager-layer fake aggregation, specialist partial-LLM coverage, fake-LLM costumes on deterministic services). **Manager fakery fixed in 7 manager files:** RevenueDirector (fabricated specialist KPIs broadcast to Jasper as real → now computed from real signals or null), ReputationManager (hardcoded 85% responseRate + invented star/sentiment fallbacks → nullable), CommerceManager ($0-everything revenue brief → nullable), MarketingManager (regex+weights "platform scoring" → LLM-first via OpenRouter), OutreachManager (BLOCKED stubs → honest FAILED + extracted constants), BuilderManager (hardcoded asset URLs + fabricated metrics → nullable), MasterOrchestrator (optimistic 'HEALTHY' default → 'UNKNOWN'). **Specialist completeness:** GROWTH_STRATEGIST (1/6 → 6/6 actions LLM-driven via 5 new Zod schemas + callGMLLM helper), TREND_SCOUT (1/5 → 4/5; get_cached_signals stays deterministic by design). **AI-costume cleanup:** VOICE_AI_SPECIALIST + 3 commerce specialists (Pricing/Catalog/Payment) honestly relabeled — stripped decorative systemPrompt/tools/outputSchema/maxTokens/temperature. **8 Jasper tool stubs handled:** update_pricing wired to AdminFirestoreService, get_analytics restricted to ['overview'] enum, provision_organization + generate_content + draft_outreach_email + generate_report + DEPLOY_SPECIALIST + add_url_source REMOVED from tool list. **5 dead-end Firestore writers DELETED:** relationship-mapping.ts, predictive-scoring-training.ts, ab-testing/ directory, video-job-service.ts (obsolete after produce_video rewire), admin/video/render route. lead-nurturing.ts surgically edited (trackLeadActivity + createLeadSegment + getLeadsInSegment removed — last returned hardcoded ['lead1','lead2','lead3'] regardless of input). **Dashboard cleanup:** /api/admin/stats hardcoded swarm cap (47), pendingTickets=0, monthlyRevenue=0 → real AGENT_REGISTRY queries + nullable. Mission Control "Email Campaigns" label bug for every social step → platform-aware routing on toolArgs.platform. **Tier-2 structural fix — verify-script suite:** 33 misleading direct-service verifies renamed via `git mv` (verify-X-post-live → verify-X-credentials-direct, verify-Y-is-real → verify-Y-gm-load) with honest headers updated; **4 NEW product-path verifies** that drive the actual orchestration chain (verify-{twitter|bluesky|mastodon}-orchestrated-post-live + verify-outreach-orchestrated-live, plus shared driver scripts/lib/orchestrated-social-verify.ts) — all 4 PASS live. **The bug that proved everything: media not attaching to social posts.** Operator caught visually that orchestrated-post images didn't render. Three separate "function accepts media, layer below silently drops it" bugs in autonomous-posting-agent.ts: Twitter `_mediaUrls` underscore-ignored, Bluesky postRecord({text}) only, Mastodon postStatus({status,visibility}) only. Three sub-agents added uploadMediaFromUrl + postWithMedia methods to TwitterService (OAuth 1.0a /1.1/media/upload — also fixed a separate latent Bearer-auth bug on the existing uploadMedia), BlueskyService (AT Protocol uploadBlob + embed.images), MastodonService (POST /api/v2/media + media_ids). autonomous-posting-agent updated to actually pass mediaUrls through. **Verified live:** three real posts WITH IMAGES on three brand accounts (X 2049673177023004930, Bluesky 3mkojzxuim52h, Mastodon 116491235033176961). social_post step duration jumped from <1s to ~2.1-2.4s per platform — that delta is real upload work. **X OAuth 1.0a port** in TwitterService (commit 6e707940) — was using only Bearer auth which X rejects on POST /tweets. Ported HMAC-SHA1 signing into makeRequest. **Connected-platforms gating:** new src/lib/orchestrator/connected-platforms-context.ts reads _platform-state.ts at request time and injects "POSTABLE platforms" + "NOT connected — exclude" sections into Jasper's system prompt. No GM edit; stays current as connections come online. **Video tools wired** (produce_video / generate_video / assemble_video): VIDEO_SPECIALIST.script_to_storyboard → createProject → saveApprovedStoryboard → generateAllScenes (Hedra). assemble_video uses ffmpeg-utils for FFmpeg concat + Firebase Storage upload. **TWITTER_X_EXPERT GM v3** deployed atomically — surgical PE-style edit replaces v2's passive "Count carefully" 280-char rule with explicit pre-output audit step + ≤270 safety target + named cost of failure. Source feedback tfb_twitter_thread_char_limit_1777473795232. Rollback via deployIndustryGMVersion('TWITTER_X_EXPERT','saas_sales_ops',2). **CI auto-deploy for Firestore indexes:** .github/workflows/firestore-indexes.yml shipped; firestore.indexes.json now adds composite indexes for missions(status,createdAt) + socialPosts(platform,createdAt). Workflow run #2 deployed both successfully. **One-time setup pending:** operator runs firebase login:ci, stores token as FIREBASE_TOKEN GitHub secret. After that, all future index changes auto-deploy on merge to main. **Pending token rotation:** Firebase CI token was pasted in the Apr 29 evening transcript — must be rotated before launch per `memory/project_rotate_secrets_in_transcript.md`. **Next session is INTENTIONALLY scoped to UI redesign of Content Generator + Social Hub** — backend is in known-good state, do NOT audit/refactor/test backend code there. Specific design problems already audited: no /content/ hub page exists; image-generator is 16-line stub renders the video StudioModePanel; CONTENT_GENERATOR_TABS mixes tools and video-sub-pages as siblings; "Create with AI" button is a nav link (should be embedded chat panel scoped=content); Content Generator's "Calendar" tab points to video-batch-scheduler (real social calendar lives at /social/calendar). Architecture decisions made: "Create with AI" uses Option B (Jasper with scope hint, ~1 day); Content Library MVP at /content/library aggregates blog/video/missions/assets unified-timeline (~3-4 days); ONE chat-panel component, not N per hub (Linear pattern). See CONTINUATION_PROMPT.md "Next Session Focus" section for full handoff.

**Prior — April 29, 2026 (early AM)** — **Creator-track platform additions: Discord + Twitch built end-to-end**. Both shipped: full LLM-backed specialists (DISCORD_EXPERT with `generate_content` + `compose_dm_reply`; TWITCH_EXPERT with `generate_content` only — Whispers inert, intentionally no DM action). Brand DNA baked into both Golden Masters per Standing Rule #1, seeded to Firestore + verified via `scripts/verify-brand-dna-injection.ts` (54/54 passing). Posting services wrap Discord REST v10 (channel messages, scheduled events, webhooks, channel listing) and Twitch Helix (modify-channel-info, chat-announcements, clip creation, schedule segments, follower/stream metrics). Composers + post-previews + `_platform-state.ts` entries shipped. OAuth handlers added to `social-oauth-service.ts` (`generateDiscordAuthUrl`, `generateTwitchAuthUrl`, exchange + profile fetch); auth/callback routes wired for both. New `/api/social/discord/channels` route powers the channel-picker dropdown. Manager registered both specialists (delegation rules, factory, inbound DM map for Discord, single-platform map for both). `apiKeys.social` schema + `APIServiceName` extended with `discord` + `twitch`. `_platform-state.ts` cleanup: Reddit flipped `coming_soon` → `parked` per Tier 3 verdict; Google Business `specialistId` reconciled to `GOOGLE_BUSINESS_EXPERT`. Phase 1 paperwork drafts produced (paste-ready) for Pinterest Developer Platform, LinkedIn MDP/CMA (note: legacy MDP scopes deprecated for new apps — Community Management API is the current product), and Google OAuth verification for YouTube scopes (CASA security assessment $3K-$15K/yr trigger flagged). Platforms NOT in this addition (rejected for core product, logged as spinoff candidates): Patreon, Substack, Snapchat, Kick — all too creator-heavy. **Pending operator-side only**: register central Discord developer app + Twitch developer app to obtain bot token / client_id / secret, then run save-config scripts and live-verify with real post.

**Prior — April 28, 2026** — **Platform viability re-tiered after research-validated audit**. Owner called out 2× operator-time waste on incompatible platforms (Telegram + Reddit). Built binding 6-check rubric in `memory/project_platform_viability_matrix.md`. **Tier 1 (posting + DM viable):** Bluesky ✅ LIVE, Mastodon ✅ LIVE, X ⚠ outbound-only, Facebook + Instagram (Meta gated). **Tier 2 (posting only):** LinkedIn (MDP gated), YouTube, Threads, Pinterest, Google Business. **Tier 3 (skip/delete):** Reddit MARKED FOR DELETION (commercial API blocked, $10K+/mo enterprise), Telegram MARKED FOR DELETION (US SMB irrelevant), TikTok defer (DM US-blocked), WhatsApp Business defer (customer-init only), Truth Social PARKED (Cloudflare wall). Rule: apply rubric BEFORE any new platform setup. SendGrid Pro 100K active for multi-tenant subuser infra. Multi-tenant flip targeted for May 4-10 2026.

**Last Updated (prior — April 27, 2026 overnight + morning, ~14 hours):** Mastodon LIVE end-to-end in BOTH directions (inbound DM round-trip + outbound post). Jasper at v13 with new 2-step social-post planning rule. Vision-aware DM compose shipped (specialists now SEE attached images via OpenRouter/Claude vision). Three caching/safety bug classes fixed. Truth Social parked (Cloudflare TLS wall). Bluesky inbound DM still live. X webhook delivery still broken X-side. Major changes that session:

1. **Mastodon outbound + inbound LIVE end-to-end.** First fully Jasper-orchestrated social post landed: https://mastodon.social/@SalesVelocity_Ai/116474951515339832 (content + DALL-E image, via 2-step plan: delegate_to_marketing → social_post). Real inbound DM round-trip verified (DM in → MASTODON_EXPERT.compose_dm_reply → mission in Mission Control → operator clicks Send Reply → reply lands in sender thread, properly threaded under original DM, mention rendered as `@handle` not numeric ID). Code is generic Mastodon-API; works against mastodon.social, hachyderm.io, fosstodon.org, etc.
2. **Marketing Manager single-platform fast-path** built and verified. When `delegate_to_marketing` gets a single platform + topic (not a multi-platform CampaignGoal), bypasses `orchestrateCampaign` and dispatches directly to the platform specialist's `generate_content`, then auto-resolves an accompanying image via `generateAndStoreSocialPostImage` (operator-provided URL respected → no DALL-E spend; otherwise DALL-E + Firestore cache). Mirrors the existing inbound-DM fast-path. Branch A (no media) verified at 35.5s; Branch B (operator URL) at 14.3s.
3. **Jasper GM v13 deployed.** Operator-delegated surgical PE-style edit replaces v12 line `"NOTE: For SOCIAL MEDIA POSTS, use social_post directly."` with multi-paragraph 2-step social post directive. Even with verbatim text, even with operator-provided media, Jasper MUST plan delegate_to_marketing → social_post. Single-step plans calling social_post directly are FORBIDDEN. Source feedback: `tfb_jasper_2step_social_post_1777259809358`. Rollback: `deployJasperGMVersion(12, '<reason>')`.
4. **MASTODON_EXPERT + BLUESKY_EXPERT v2 GMs.** Both got `generate_content` action via the shared compose-dm-reply mixin pattern. Mastodon is also vision-aware (sees attached images). Both registered in Marketing Manager's specialist registry, factory list, delegationRules, and inbound-DM platform map. Mastodon also has its own `case 'mastodon'` in `autonomous-posting-agent` calling `MastodonService.postStatus`.
5. **Vision-aware DM compose shipped.** ChatMessage type widened across the AI stack (`string | ChatMessageContentPart[]`) to support OpenAI/OpenRouter multipart content. compose-dm-reply-shared mixin detects image attachments on the inbound DM and switches the user message to a multipart array (text + image_url blocks) so Claude actually receives the image as vision input. Mastodon dispatcher extracts `media_attachments` from the inbound status and forwards. Same TODO marker placed in X dispatcher (untested until X webhook delivery resumes). OpenAI provider, Anthropic provider, Gemini provider all handle the wider type (Anthropic + Gemini flatten array content to text since their direct-call paths in this codebase are string-only; vision flow goes through OpenRouter).
6. **Image-resolution rule applied to BOTH blogs and posts.** Operator-provided URL → used AS-IS, no DALL-E call, no API spend. Only when no media is provided does generation fire. Fixed a pre-existing bug in the blog flow that was generating unconditionally. Same `providedMediaUrls` parameter on `delegate_to_content` and `delegate_to_marketing`.
7. **Truth Social PARKED.** Truth Social fronts its Mastodon-compatible API with Cloudflare bot management that fingerprints the TLS handshake itself (not headers). Node fetch fails, so Vercel serverless 403s in production. **No best-practice path exists**: no official API, no developer portal, no partner program; none of Hootsuite/Buffer/Later/Sprout support the platform. Code preserved (renamed to `mastodon` since it was always generic Mastodon-API). GM marked inactive, OAuth pending creds moved to `truth_social_parked` slot. Re-evaluate if Truth Social opens server-side access.
8. **Defensive visibility/kind guards on every DM dispatcher.** "Auto-reply applies to private DMs only, never public mentions/replies/retweets" rule now load-bearing in code (Mastodon: `visibility !== 'direct'` skip; Bluesky: chat-message-shape assertion; X: `kind !== 'direct_message_events'` skip).
9. **Three infrastructure bug classes fixed.**
   - **Next.js fetch cache** — added `cache: 'no-store'` to every external API fetch in mastodon/bluesky/twitter-dm services + bluesky dispatcher's raw fetch calls. Cause: Next was caching empty `/api/v1/conversations` response, subsequent polls returned stale empty arrays.
   - **api-key-service stale cache** — TTL reduced 5min → 60s, added public `clearCache()` method, added Firestore `onSnapshot` listener for real-time invalidation. Out-of-band Firestore writes from save scripts now propagate to running server in sub-second time.
   - **`parseSocialPostArgs` platform whitelist** — was hardcoded `twitter|linkedin` only. Now accepts all 15 platforms from `SOCIAL_PLATFORMS`. Fixed silent stripping of non-default platforms to undefined → 'twitter' default → wrong API call.
10. **`social_post` step-output reference resolution.** Jasper's 2-step plans emit `"step_1_output_primaryPost"` and `"step_1_output_mediaUrls"` as references; the step runner doesn't auto-resolve. The `social_post` handler now detects the pattern and pulls actual values from the prior `delegate_to_marketing` step's `toolResult`.
11. **send-dm-reply Mastodon recipient + threading fix.** Was passing numeric account ID as recipient (mention rendered as plain text, no notification). Now uses `senderHandle` for the mention + `in_reply_to_id` for threading.
12. **Defensive Firestore query rewrites + index file updates.** `/api/social/agent-status` and `/api/social/engagement` had `where + orderBy` queries on `social_posts` requiring composite indexes never deployed — log spam every 30s. Rewrote to single-field `where` + JS sort/slice. Added matching composites to `firestore.indexes.json` for future `firebase deploy --only firestore:indexes`.
13. **Memory updates.** `feedback_check_platform_api_posture_first.md` (verify official API + scheduler support BEFORE integrating). `feedback_business_account_setup_step_by_step.md` (walk operator through business-account setup step-by-step before OAuth).

---

**Prior — April 26, 2026 (afternoon):** Bluesky live end-to-end. Inbound DM architecture redesigned: dispatcher → specialist direct (skips Jasper + manager) for DMs only. compose_dm_reply on 6 specialists via shared mixin. Training loop validated. Major changes that session:

1. **Bluesky integration live** — `@salesvelocity.bsky.social` brand account created, app password saved at `apiKeys/social.bluesky`, `BlueskyService` extended with `sendDirectMessage` via `chat.bsky.convo.*` lexicons (uses `api.bsky.chat` host with `atproto-proxy: did:web:api.bsky.chat#bsky_chat`). Verified: live test post landed at https://bsky.app/profile/salesvelocity.bsky.social/post/3mkg4mlezs22s; live test DM landed in `@rapidcompliance.bsky.social`'s inbox. New cron `/api/cron/jasper-bluesky-dm-dispatcher` (every 1 min) polls `chat.bsky.convo.listConvos` for unread messages — Bluesky has no chat webhook, polling is the only mechanism they expose.
2. **Architecture redesign — DM-only Jasper bypass.** Owner-confirmed scoped exception to "everything goes through Jasper." Inbound social-media DMs now take a direct path: dispatcher cron → platform specialist composes → mission record written directly to Firestore in `COMPLETED` state. No Jasper LLM call, no Marketing Manager fast-path, no plan-approval rubber-stamp gate. Reasoning: inbound DMs have machine-detected, fixed intent ("compose a reply") so Jasper's intent-interpretation brain has nothing to add. Outbound posts, scheduled campaigns, workflow runs, user-typed Jasper prompts, and inbound SMS all still go through full Jasper orchestration — exception is scoped to social DMs. Implementation: `src/lib/social/inbound-dm-orchestration-service.ts` (`orchestrateInboundDmReply(input)`). Memory: `feedback_no_jasper_bypass_even_for_simple_replies.md` updated with the scoped exception clause.
3. **`compose_dm_reply` now on every DM-capable specialist via shared mixin.** New `src/lib/agents/social/compose-dm-reply-shared.ts` exports `executeComposeDmReply(req, ctx, opts)` — handles schemas, prompt scaffolding, OpenRouter call, truncation backstop, Zod validation. Each specialist supplies its own GM (own systemPrompt with platform-specific DM REPLY PLAYBOOK + Brand DNA per Standing Rule #1) and platform options (label, maxReplyChars, playbookCharsTarget, brandUrl, forbidEmoji). Specialists wired: TWITTER_X_EXPERT, BLUESKY_EXPERT, LINKEDIN_EXPERT, FACEBOOK_ADS_EXPERT, INSTAGRAM_EXPERT, PINTEREST_EXPERT. Skipped (no usable DM API): YouTube, TikTok, Truth Social. Reddit + Threads will be added when those specialists are built.
4. **InboundDmPlatform type unified** — `'x' | 'bluesky' | 'linkedin' | 'facebook' | 'instagram' | 'pinterest'` across orchestration service, `Mission.sourceEvent.kind`, `send-dm-reply` route, and Mission Control rendering. Lookup tables centralize specialist + sourceEvent.kind + platform-label mapping.
5. **Mission Control human-readable inbound-DM step view.** `DetailOutputRenderer` detects `mode='INBOUND_DM_REPLY'` shape and renders sender, customer's message, composed reply (primary-bordered), confidence + escalation flags, collapsible reasoning. SendDmReplyButton renders inline in the step detail panel alongside StepGradeWidget (M2b grading), ManualEditOutputBox (M6 edit-output), and version history.
6. **`@salesvelocity` X handle clarification baked into docs.** X auto-generated handle `@salesveloc42339`; display name "SalesVelocity.ai". Tweet URL `x.com/salesvelocityai/...` redirects but the API + verify_credentials report the real handle.
7. **Training loop validated end-to-end.** Submitted three test grades on a Bluesky reply mission and verified the Prompt Engineer's correct behavior per Standing Rule #2: (a) 5-star + positive note → status `clarification_needed`, no GM edit; (b) 1-star + vague note ("test of grading") → `clarification_needed`, no edit; (c) 1-star + actionable correction ("≤2 sentences") → real PE proposal generated, popup shown to operator. Operator-side approve/reject is the only path to GM edits — no silent drift. PE refuses both vague-positive AND vague-negative grades; only specific behavioral deltas reach the prompt revision UI.
8. **Outbound posting verified on both platforms.** X test tweet at `2048334667120861392`. Bluesky test post at `3mkg4mlezs22s`. Verify scripts: `scripts/verify-twitter-post-live.ts`, `scripts/verify-bluesky-post-live.ts`, `scripts/verify-bluesky-dm-live.ts`.
9. **Bluesky session always re-minted.** `BlueskyService.ensureSession` no longer reuses cached `accessJwt` from Firestore (which goes stale within hours). Each first-use call mints fresh via `createSession`. Caught when send-dm-reply 502'd with `ExpiredToken` after the saved JWT aged out.
10. **`apiKeyService.getServiceKey('bluesky')` wired** — case was missing, causing `createBlueskyService()` to silently return null in production. Now resolves `keys.social?.bluesky`.
11. **Multiple cleanup + diagnostic scripts shipped** — `clear-stale-inbound-dm-events.ts`, `cleanup-bluesky-test-residue.ts`, `find-recent-inbound-events.ts`, `find-recent-dm-missions.ts`, `dump-one-mission.ts`, `check-recent-training-feedback.ts`, `find-improvement-by-id.ts`, `dump-improvement-requests.ts`.

**Open from this morning's session (April 26 overnight) — unchanged:**

1. **Inbound X DM auto-reply rebuilt via the proper Jasper path** — replaces the disabled `inbound-social-dispatcher` that called OpenRouter directly. New cron `/api/cron/jasper-dm-dispatcher` polls `inboundSocialEvents` every 1 minute → calls `/api/orchestrator/synthetic-trigger` (cron-secret + `x-synthetic-trigger:true` + scope `inbound_dm_reply`) → which drives the same `/api/orchestrator/chat` route the UI uses (synthetic auth opt-in via new `requireAuthOrSynthetic` helper) → Jasper's plan-gate forces `propose_mission_plan` → single-step plan: `delegate_to_marketing` carrying a new `inboundContext` field → MarketingManager fast-paths to TwitterExpert.compose_dm_reply (skipping orchestrateCampaign) → X Expert produces brand-voiced reply with reasoning + confidence + suggestEscalation → step COMPLETED with composedReply → Mission Control's new SendDmReplyButton lets the operator review, edit, and click "Send reply" → `/api/orchestrator/missions/[id]/send-dm-reply` reads sender id from `inboundSocialEvents`, dispatches via OAuth 1.0a, marks event processed. New `send_social_reply` Jasper tool wraps the same send for direct plan-driven sends. **Live verified end-to-end:** `scripts/verify-jasper-dm-reply-live.ts` walks a synthetic event through the full path, X Expert produces a valid reply, OAuth 1.0a signed call to X DM API returns 403 ("recipients could not be found") for the fake sender id (proving auth + endpoint shape).
2. **X Expert GM v2 deployed** (`scripts/deploy-twitter-expert-gm-v2.ts`) — operator-delegated edit per `feedback_delegation_vs_self_training`. Surgical PE-style insertion of a "DM REPLY PLAYBOOK" section before the `## Hard rules` anchor. supportedActions extended with `compose_dm_reply`. v1 prompt 5298 chars → v2 prompt 8545 chars. Brand DNA preserved verbatim. Rollback via `deployIndustryGMVersion('TWITTER_X_EXPERT', 'saas_sales_ops', 1)`.
3. **Auto-approve toggle WIRED NOW (default OFF)** — per-channel automation config at `organizations/${PLATFORM_ID}/automation/inbound`. New `/settings/automation` page with a Switch component flips `xDmReply.autoApprove`. When OFF (default), every inbound DM waits for operator review in Mission Control. When ON, the synthetic-trigger drives `approveAllPlanSteps + approvePlan + runMissionToCompletion + send-dm-reply` programmatically — same Jasper→Manager→specialist delegation path, just no operator click. Mission gets stamped with `autoApprove: 'inbound_dm_reply'` for audit. Per `feedback_no_jasper_bypass_even_for_simple_replies`, the toggle is a future capability gated behind operator-validated quality; the delegation path itself is unchanged whether the toggle is on or off.
4. **Mission schema extended** — `Mission.autoApprove`, `Mission.sourceEvent` fields stamped on every inbound mission for traceability. New helper `stampMissionSourceAndAutoApprove()` in mission-persistence.ts.
5. **Reusable twitter-dm-service** — extracted OAuth 1.0a header builder + DM POST + `markInboundEventReplied` helper from the disabled dispatcher into `src/lib/integrations/twitter-dm-service.ts`. Used by the `send_social_reply` tool, the `/send-dm-reply` endpoint, and the verification harness — single source of truth for DM dispatch.
6. **Disabled dispatcher kept as reference** — `src/app/api/cron/inbound-social-dispatcher/route.ts` stays in the repo with header marker; not in vercel.json's cron list.

**Prior session (Apr 25-26 overnight, integration day):** Jasper GM v12 deployed (orchestrate_campaign deleted across 9 files). Email Specialist v2 with compose_outreach_sequence. SendGrid live with domain auth. Twilio toll-free under Twilio review. X account fully wired with $25 credits, live test tweet posted, Account Activity webhook registered + verified DM/follow ingestion.

**Standing rules respected throughout** — Jasper still ONLY interprets and delegates. No silent GM auto-edits. SMS opt-in is CTIA-compliant. Brand DNA baked into every GM at seed time. **Prior — April 24 midday:** E2E runner shipped (`scripts/verify-prompt-matrix-e2e.ts`) + Content Manager EMAIL_SEQUENCE intent rebuild + Copywriter v2 (generate_email_sequence action). **Prior — April 24 evening:** Stage A.5 shipped: `create_workflow` tool live end-to-end. workflow-001 + workflow-002 pass 2/2. **Prior — April 23, 2026:** Jasper v11 call-shape fix + parser hardening. Matrix planning regression 242/245 (99%) at 5 iter. **Prior — April 15, 2026:** Mission Control M1-M8 complete.
**Branches:** `dev` (latest)
**Status:** AUTHORITATIVE - All architectural decisions MUST reference this document
**Architecture:** Single-Tenant Penthouse Model (development strategy — multi-tenant SaaS product)
**Audit Method:** 6 parallel code-reading agents (March 28, 2026) verifying route counts, auth coverage, social media status, gap resolution, agent/collection counts, and security/RBAC claims against actual source code

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Status](#current-status-february-28-2026)
3. [Ironclad Architecture Rules](#ironclad-architecture-rules) **[BINDING]**
4. [Single-Tenant Architecture](#single-tenant-architecture-complete)
5. [Verified Live Route Map](#verified-live-route-map)
6. [Agent Registry](#agent-registry)
7. [Unified RBAC Matrix](#unified-rbac-matrix)
8. [Security Audit Findings](#security-audit-findings)
9. [Tooling Inventory](#tooling-inventory)
10. [Infrastructure Systems](#infrastructure-systems)
11. [Integration Status](#integration-status)
12. [Firestore Collections](#firestore-collections)
13. [Architecture Notes](#architecture-notes)
14. [Data Contracts Reference](#data-contracts-reference)
15. [Autonomous Verification](#autonomous-verification)
16. [Document Maintenance](#document-maintenance)

---

## Executive Summary

### Platform Statistics

| Metric | Count | Status |
|--------|-------|--------|
| Physical Routes (page.tsx) | 207 | Verified April 30, 2026 (incl. /calendar, /studio, /content/video/editor, /media, /settings/{meeting-scheduler,scheduling-messages}, etc.) |
| API Endpoints (route.ts) | 507 | Verified April 30, 2026 (incl. /api/integrations/zoom/{auth,callback,disconnect}, /api/calendar/events, /api/content/{music,video,asset-generator}/generate, /api/video/editor/render, /api/booking POST, /api/media) |
| AI Agents | 72 | **72 FUNCTIONAL (1 Jasper L1 + 10 L2 managers + 57 L3 specialists + 4 standalone)** — adds OPERATIONS_MANAGER + SCHEDULING_SPECIALIST (Apr 30) |
| RBAC Roles | 4 | owner / admin / manager / member |
| TypeScript Files | ~1,746 | Verified March 28, 2026 |
| Type Definition Files (src/types/) | 56 | 831+ interfaces/types across all files |
| UI Components (src/components/) | 250 | Production-grade React components |
| Firestore Collections | 243 | Active (53 root-level + 190 org-scoped) |

**Architecture:** Single-tenant Penthouse Model (development strategy). SalesVelocity.ai is a multi-tenant SaaS product — clients will purchase their own deployment. Penthouse simplifies development; multi-tenancy will be re-enabled.

### Technology Stack

- **Framework:** Next.js 14.2.33 (App Router)
- **Hosting:** Vercel (Status: **DEPLOYED** — dev → main → Vercel auto-deploy)
- **Database:** Firebase Firestore (single-tenant: `rapid-compliance-65f87`)
- **Authentication:** Firebase Auth with custom claims
- **AI Gateway:** OpenRouter (100+ models)
- **Voice:** VoiceEngineFactory (ElevenLabs, Unreal Speech)
- **Payments:** Stripe (primary, fully wired) + 11 additional providers (Paddle, Adyen, Chargebee, Hyperswitch, PayPal, Square, Authorize.Net, 2Checkout, Mollie, Razorpay, Braintree)

### Codebase Scale (March 20, 2026)

| Metric | Count |
|--------|-------|
| **TypeScript Files** | 1,746 |
| **Estimated Code Lines** | ~350,000+ |
| **Test Files** | 110 (4 unit/integration in src/ + 106 Playwright/config in tests/) |

**Breakdown by Directory (TypeScript):**

| Directory | Files | Purpose |
|-----------|-------|---------|
| `src/lib/` | ~500+ | Core business logic, services, agents |
| `src/components/` | ~250 | UI components |
| `src/app/api/` | ~436 | API routes |
| `src/app/(dashboard)/` | ~120+ | Dashboard pages |
| `src/types/` | ~54 | TypeScript definitions (831 interfaces/types) |
| `src/hooks/` | ~23 | React hooks |

### AI Governance Layer

**File:** `CLAUDE.md` (Project Root)
**Status:** ✅ AUTHORITATIVE
**Scope:** All Claude Code sessions in this project

The Claude Code Governance Layer defines binding operational constraints for AI-assisted development:

| Constraint | Description |
|------------|-------------|
| **Linting Lock** | NO modification of ESLint, TypeScript config, pre-commit hooks, or lint-staged |
| **Zero-Any Policy** | No `any` types in TypeScript; no new `eslint-disable` or `@ts-ignore` comments |
| **Best Practices** | Adherence to ENGINEERING_STANDARDS.md, Zod validation, service layer architecture |
| **Sub-Agent Protocol** | Mandatory use of specialized agents (Explore, Plan, Architect, CodeScout, fixer, Reviewer, steward) |
| **Session Sync** | End-of-session commits to `dev` branch with SSOT update when applicable |

**Key Governance Files:**

| File | Purpose | Modification Status |
|------|---------|---------------------|
| `CLAUDE.md` | AI instruction set | **BINDING** |
| `ENGINEERING_STANDARDS.md` | Code quality requirements | Reference |
| `eslint.config.mjs` | Linting rules | 🔒 **LOCKED** |
| `tsconfig.json` | TypeScript config | 🔒 **LOCKED** |
| `tsconfig.eslint.json` | ESLint-scoped tsconfig (src/ only, excludes .next) | Operational |
| `.husky/*` | Pre-commit hooks | 🔒 **LOCKED** |

**Pre-Commit Gate Requirements:**
- `npm run lint` must pass (uses `cross-env NODE_OPTIONS=--max-old-space-size=8192`)
- `npx tsc --noEmit` must pass (W2 Build Gate)
- `npm run build` must succeed
- No new `any` types introduced
- No new eslint-disable comments added

**ESLint Memory Configuration:**
- ESLint uses `tsconfig.eslint.json` (scoped to `src/` only) to avoid loading `.next` build cache (~5.3GB)
- All lint scripts in `package.json` use `cross-env NODE_OPTIONS=--max-old-space-size=8192`
- Pre-commit hook (`.husky/pre-commit`) exports `NODE_OPTIONS` with 8GB heap
- Full lint completes in ~1m42s with zero OOM

### Recent Major Milestones

> All milestone details (Sessions 1-31) have been archived. Key achievements:
> - **Hedra Video Fix** — Replaced 3-step TTS dance with inline `audio_generation`. Confirmed Kling O3 T2V produces speaking characters. hedra-node SDK rejected as outdated. Full system review completed. (March 15)
> - **Campaign Orchestration Pipeline Layer 1+2 DONE** — Campaign + CampaignDeliverable models, 4 API routes, `create_campaign` Jasper tool, deliverable auto-tracking on produce_video/save_blog_draft/social_post, Campaign Review UI at `/mission-control?campaign={id}`. (March 15)
> - **System-wide audit** — 1,582 files, 376 API routes, 0 `any` types, 0 TODOs, 0 security issues. Code quality rated excellent. (March 15)
> - **Voice Lab & Custom Avatars** — Recording studio, voice library, avatar photo upload to Firestore `custom_avatars`, voice assignment, CUSTOM badges (March 6)
> - **Lead Research AI upgrade** — Apollo free-tier org search, 8-tool AI chat with comprehensive system prompt, 5 tool rounds (March 6)
> - Growth Command Center — 6 pages, 11 API routes, 3 crons (March 2)
> - Production deployment to Vercel via main branch (Session 30)
> - Nav consolidation: 13 sections → 9 (Sessions 25-27)
> - All 36 features across 8 sprints built to production-ready (Sessions 20-24)

### Video System Architecture (Updated March 21, 2026)

- **Hedra is the sole video engine.** Two generation modes:
  - **Prompt-only:** Kling O3 Standard T2V — generates speaking characters with native audio from text prompt. No portrait needed.
  - **Avatar mode:** Character 3 — portrait + inline `audio_generation` for controlled lip-sync with exact script and voice.
- **Inline TTS** replaces separate 3-step TTS dance. Single API call to Hedra.
- **87 models available** (58 video, 29 image). Key lip-sync models: Character 3 (auto duration), Omnia (8s), Avatar (10min), VEED Fabric (5min).
- **69 voices** including ElevenLabs, MiniMax, and custom clones via `type: "voice_clone"`.
- **Character Studio** stores client characters in Firestore (portraits, voices, metadata). Hedra's element API is read-only via API key — custom characters must live in our system.
- **Clone Wizard** (`src/components/video/CloneWizard.tsx`) — 5-step guided wizard for face+voice cloning. Webcam/upload for face, MediaRecorder/upload for voice, ElevenLabs voice clone, auto-link to avatar profile, auto-set as default. Accessible from AvatarPicker "Clone Yourself" CTA.
- **Auto-Captions** (`src/lib/video/caption-service.ts`) — 3 styles (Bold Center, Bottom Bar, Karaoke) generated from Deepgram word-level timestamps. Toggle in Assembly step.
- **Simple/Advanced Mode** — `SimpleStylePicker.tsx` (10 preset cards) vs full `CinematicControlsPanel` (97+ options). Mode persists in localStorage, defaults to simple.
- **Background Music** (`src/lib/video/music-library.ts`) — 15 royalty-free tracks across 6 categories, volume slider, auto-duck toggle. Audio mixed via FFmpeg `sidechaincompress`.
- **Assembly Progress** — Firestore-backed progress tracking with 4 phases (download → probe → stitch → upload), polled every 2s with animated progress bar.
- **5 Starter Templates** — Weekly Sales Update, Product Demo, Testimonial, Social Ad, Company Announcement.
- **Prompt pipeline:** `hedra-prompt-agent.ts` and `hedra-prompt-translator.ts` — correct inline TTS field structure enforced, cinema-quality prompt generation for both avatar and T2V modes.
- **Core business value:** Clients clone themselves (face + voice) to automate daily video content. Cinema-quality enterprise ads at a fraction of traditional cost.

### AI Creative Studio (COMPLETE — March 16, 2026)

**Inspiration:** RenderZero AI Studio — professional-grade cinematic AI image/video generation with deep creative controls.
**Status:** BUILT and integrated into the video pipeline. Web-native at `/content/`, surpassing RenderZero's desktop app with SaaS convenience + campaign integration.

**What's Built:**
- 250+ cinematic presets (49 camera bodies, 43 lighting setups, 30 film stocks, 100+ movie looks, 20+ art styles)
- Multi-provider backend: Hedra (primary), Fal.ai (Flux), Google Imagen 3, DALL-E 3, Kling 3.0 — fallback chain with retry-on-auth-failure
- Full creative workspace: `CinematicControlsPanel` (5 sections), `VisualPresetPicker`, `ConstructedPromptDisplay`, `CharacterElementsTool`, `RenderQueuePanel`
- Character library with Firestore persistence, up to 4 characters per scene
- Per-generation cost logging to Firestore (fire-and-forget)
- BYOK model — clients use their own API keys (already in Firestore via `/settings/api-keys`)
- Campaign-integrated — studio generations feed directly into campaign deliverables

**Key Files:**
- `src/lib/ai/cinematic-presets.ts` — 250+ preset library with prompt mappings
- `src/lib/ai/provider-router.ts` — BYOK provider selection and routing
- `src/components/studio/` — Shared cinematic control components
- 7 API routes: `/api/studio/generate`, `/api/studio/generate/[generationId]`, `/api/studio/providers`, `/api/studio/providers/validate`, `/api/studio/presets`, `/api/studio/characters`, `/api/studio/cost`

**Provider Matrix:**

| Provider | Capability | Models | Cost Range |
|----------|-----------|--------|------------|
| Hedra | Image + Avatar video | Character 3, Kling O3, Nano Banana Pro T2I | $0.05–$0.15 |
| Fal.ai | Image gen (fast) | Flux, SDXL, Stable Diffusion | $0.01–$0.05/image |
| Google AI Studio | Image gen | Imagen 3 | $0.01–$0.04/image |
| DALL-E 3 | Image gen (quality) | DALL-E 3 | $0.04–$0.12/image |
| Kling 3.0 | Video gen | Kling 3.0 | $0.03–$0.10/video |

### Campaign Orchestration Pipeline (Layers 1–4 DONE — March 15, 2026)

Jasper orchestrates full marketing campaigns: research → strategy → produce all content → unified review.

**Built (Layers 1+2):**
- `Campaign` + `CampaignDeliverable` types with Zod schemas (`src/types/campaign.ts`)
- Full Firestore CRUD service with auto-status promotion (`src/lib/campaign/campaign-service.ts`)
- 4 API routes: `POST/GET /api/campaigns`, `GET/PATCH /api/campaigns/[campaignId]`, `POST/GET .../deliverables`, `PATCH .../deliverables/[deliverableId]`
- `create_campaign` Jasper tool + `campaignId` param on `produce_video`, `save_blog_draft`, `social_post`
- Campaign Review UI at `/mission-control?campaign={id}` — deliverable cards, approve/reject/feedback, "Approve All", progress bar
- Firestore: `organizations/{PLATFORM_ID}/campaigns/{campaignId}` + `.../deliverables/{deliverableId}`

**Built (Layers 3+4):**
- **Layer 3 — Auto-Publish Pipeline:** Approved deliverables auto-publish: blog drafts → published post, social → posted via social agent, video/image → saved to media library. Zero manual steps after approval.
- **Layer 4 — Feedback Loop:** Rejected deliverables with reviewer feedback auto-create revision missions via `mission-persistence.ts`. Each rejection spawns a new tracked mission so Jasper iterates until approval.

---

## Training Loop + Mission Control Rebuild Status (April 15, 2026)

This section is the most recent authoritative snapshot. Everything below in the "Current Status (March 28, 2026)" section is still valid for the platform-wide QA scorecard; this section supersedes it specifically for the agent swarm, manager review layer, and Mission Control grading/rollback pathways.

### Training loop — OPERATIONAL end-to-end

The Phase 3 training loop and the Mission Control M1 + M2 rebuild are both live on `origin/dev`. A human operator can now grade any completed step in Mission Control, the Prompt Engineer proposes a surgical edit to the specialist that actually produced the work, the operator picks one of three options in a 3-box popup (Keep current / Agent's suggestion / My rewrite), approve triggers an atomic deploy of a new Golden Master version, and a past version can be rolled back from the same panel with a single confirmation.

Standing rules codified in `CLAUDE.md`:

1. **Standing Rule #1 — Brand DNA baked into every Golden Master at seed time.** No runtime merging. When Brand DNA is edited, every GM is reseeded via `node scripts/reseed-all-gms.js`. Shared helper: `scripts/lib/brand-dna-helper.js`.
2. **Standing Rule #2 — No grades = no Golden Master changes. Ever.** The only path by which a specialist prompt can change in production is: human grade → TrainingFeedback record → Prompt Engineer surgical edit → human approval → new GM version → deploy. There is zero automated self-improvement. Enforced by `scripts/verify-no-grades-no-changes.ts` at runtime.
3. **Jasper delegates to managers, never calls specialists directly.** Enforced by removing 4 bypass tools from Jasper's allowlist + pattern matcher + `jasper-thought-partner.ts` system prompt. Lead Research and Discovery Hub chat endpoints retain access to those tool definitions for their own purposes.
4. **Finish each thing to production-ready before moving on** (Apr 30 2026). "Done" means walked end-to-end with real credentials and a real artifact (real meeting booked, real video rendered, real OAuth round-trip). No "ready for next?" while the current item is unverified. Adjacent capabilities count as separate items; name them explicitly.
5. **Never read credentials from screenshots — use Copy buttons** (Apr 30 2026). When integrating a new service or rotating a secret, paste from the provider's Copy button, not from a screenshot of the dashboard. OCR mistakes have caused full debugging detours on token-shape errors that were really transcription errors.
6. **Destructive UI actions need two-step confirmation** (Apr 30 2026). Disconnect, delete, archive, scrap — every one of these requires an explicit second click in a confirmation dialog. The Zoom disconnect (Apr 30) is the reference implementation.
7. **Estimate in parallel-agent-hours, not solo dev-weeks** (Apr 30 2026). When scoping work, assume the operator runs N sub-agents in parallel. Rough rule: 4 hours of three concurrent agents ≈ 1 calendar day for a solo dev. Don't quote multi-week timelines that ignore parallelism.

### Agent inventory (post-rebuild)

| Layer | Count | Status |
|---|---|---|
| Specialist rebuilds complete | **57 of 57** | 100% — all real LLM agents with Firestore Golden Masters |
| Specialist Golden Masters seeded | **57 + 1** | 57 active specialists + the Prompt Engineer meta-specialist. Includes `sgm_scheduling_specialist_saas_sales_ops_v1` (Apr 30). |
| Manager Golden Masters seeded | **10 of 10** | Architect, Builder, Commerce, Content, Intelligence, Marketing, Operations (NEW Apr 30 — `mgm_operations_manager_saas_sales_ops_v1`), Outreach, Reputation, Revenue. Master Orchestrator skipped by design (it delegates to managers, not specialists — review happens one level down). |
| Manager review gates wired | **10 of 10** | All managers route specialist calls through `delegateWithReview`. (Note: `reviewOutput()` itself is currently disabled per `project_manager_auto_review_disabled` — synthetic PASS short-circuits while operator reviews every step manually in Mission Control. DO NOT "restore" — re-enable only after shadow-mode training data is collected.) |
| Jasper department delegations LIVE | **10 of 10** | 9 `delegate_to_*` managers + `delegate_to_agent` + new `delegate_to_operations` (Apr 30). The `orchestrate_campaign` shortcut tool was removed Apr 25 2026 — it violated Jasper's delegation principle. Multi-channel campaigns now plan as parallel `delegate_to_*` calls. |
| Pirate-test verified specialists | **7 of 57** | Alex + Copywriter + Sentiment Analyst + Review Specialist + Deal Closer + Email Specialist + LinkedIn Expert. All 7 passed — proof the GM is loaded from Firestore at runtime. |
| Behavior-change verified specialists | **1 of 57** | Copywriter — `scripts/verify-prompt-edit-changes-behavior.ts` proves v1 vs v2 produce demonstrably different output on the same task, not just different bytes in Firestore. |

### Key files for the training loop

- **`src/lib/agents/base-manager.ts`** — `reviewOutput()` is a real async LLM call that loads the manager's GM from Firestore. Per-report WeakMap cache prevents double-billing on retries. Includes the M2a accumulator (`specialistsUsedByTask: Map<string, Set<string>>`) that tracks every specialist delegation per task and auto-injects the list into `createReport`.
- **`src/lib/agents/prompt-engineer/specialist.ts`** — meta-specialist that translates human corrections into surgical prompt edits. Uses Claude Opus 4.6 for best instruction-editing reasoning. Single action `propose_prompt_edit`. Hard rules: never touches Brand DNA, never adds sections, never rewrites more than one section per edit, never loses specialist identity.
- **`src/lib/training/grade-submission-service.ts`** — orchestrator for the grade → edit → approve → deploy pipeline. Every specialist GM write flows through this service.
- **`src/lib/training/training-feedback-service.ts`** — Firestore storage for grades. Collection: `organizations/{orgId}/trainingFeedback`. Lifecycle: `pending_review → applied | discarded | clarification_needed`.
- **`src/lib/training/specialist-golden-master-service.ts`** — versioned specialist GMs with industry-scoped rollback via `listIndustryGMVersions` + `deployIndustryGMVersion` + `createIndustryGMVersionFromEdit`.
- **`src/lib/training/manager-golden-master-service.ts`** — parallel service for manager GMs (new collection `managerGoldenMasters`). 60-second cache. Used by `BaseManager.reviewOutput()` at runtime.
- **`src/components/training/PromptRevisionPopup.tsx`** — rewritten in M1 to the 3-box-with-radios shape. Backward-compatible prop interface so all three existing consumers (MissionGradeCard, StepGradeWidget, CampaignReview) continue working without changes. `onApprove` callback now emits an optional `source: 'agent' | 'user'` and `newProposedText` for downstream consumers that need to rebuild the backend's `approvedEdit` shape.
- **`src/app/(dashboard)/mission-control/_components/StepGradeWidget.tsx`** — M2b rewrite. Reads `specialistsUsed` from the step, routes grades to the correct specialist via `/api/training/grade-specialist`. Multi-specialist dropdown when 2+ specialists contributed to the step. Falls back to no-op (records the rating without firing Prompt Engineer) when the step has no specialist target.
- **`src/app/(dashboard)/mission-control/_components/SpecialistVersionHistory.tsx`** — M2d rollback UI. Inline panel per specialist with version list + single-confirmation rollback.
- **`src/app/api/training/grade-specialist/`** — 4 API routes: `POST /` (submit grade), `POST /[id]/approve`, `POST /[id]/reject`, `GET /` (list feedback). Plus M2c's `GET /[specialistId]/versions` and `POST /[specialistId]/rollback`. All gated by `requireRole(['owner', 'admin'])`.

### Verification scripts (all passing on real Firestore)

- **`scripts/verify-content-manager-review.ts`** — Content Manager good/bad fixture test (M1 era). 2 of 2 pass.
- **`scripts/verify-managers-review.ts`** — Outreach + Intelligence + Revenue Director good/bad fixtures. 6 of 6 pass. 8 of 8 total across 4 managers.
- **`scripts/verify-prompt-engineer.ts`** — full grade → surgical edit → deploy → read-back → rollback round-trip. Passing.
- **`scripts/verify-no-grades-no-changes.ts`** — runs 4 real specialist executions (Sentiment Analyst × 3 + Alex × 1) and asserts zero GM / TrainingFeedback state changes. Standing Rule #2 runtime enforcement. Passing.
- **`scripts/verify-prompt-edit-changes-behavior.ts`** — proves prompt edits actually change what the LLM produces. Runs Copywriter on v1 with a specific task, grades it, deploys v2, runs Copywriter on the same task, compares outputs. v2 has `+6.34` concrete-feature density per 1000 words vs v1, 0 pirate markers in both (jargon already absent in v1), different h1 / hero heading / section content. Passing.
- **`scripts/verify-rollback.ts`** — full rollback loop: create v2 → approve → list versions → `deployIndustryGMVersion(target=1)` → verify v1 active + v2 deactivated + active prompt matches v1 exactly. Passing.
- **`scripts/pirate-test-alex.ts`** — unfakeable proof Alex reads his GM from Firestore at runtime. Swaps GM to pirate dialect, calls Alex, confirms pirate output, restores. Passing.
- **`scripts/pirate-test-specialists.ts`** — generic pirate-test harness with CLI filter for 6 representative specialists. 6 of 6 pass.

### What's NOT done yet on Mission Control

- **M3 — Per-step pause during execution** (biggest remaining piece, ~3-4 days). Today a mission runs `IN_PROGRESS → COMPLETED` automatically when all tool calls finish. Target: each step runs, pauses with status `AWAITING_APPROVAL`, waits for operator approval/edit/rerun, then the next step starts. Requires changing the execution model in `chat/route.ts` from "fire all tool calls in one LLM turn" to a queue-based runner (`advanceMission(missionId)` called once per step approval). User explicitly requested a `LEGACY_MISSION_EXECUTION_MODEL` feature flag with heavy notation so the old model can coexist during rollout and be cleanly removed later.
- **M4 — Plan pre-approval** (~2 days). New Jasper tool `propose_mission_plan` that writes the full step list to Firestore in new status `PLAN_PENDING_APPROVAL` WITHOUT executing any tools. Operator reviews, edits individual steps in the plan view (re-order / delete / change summary per Q1/C), approves, execution starts. Simple single-step missions skip the plan review.
- **M5 — Downstream-changed flag** (~1 day). When a step is rerun, all steps after it in the mission get a "upstream changed — re-review?" marker. Operator clicks into each flagged step and picks "Still good, keep this output" or "Rerun with updated upstream". Not auto-invalidating because some downstream steps don't actually depend on upstream.
- **M6 — Quick manual edit path** (~1 day). "Edit output directly" button on the step detail panel for small fixes that aren't worth training the agent on. New `MissionStep.manuallyEdited: boolean` field for audit trail.
- **M7 — Scrap buttons** (~half day). Plan review screen + step review panel. In-flight cancel already exists and is wired to `POST /api/orchestrator/missions/[id]/cancel`.
- **M8 — Cleanup** (~half day). Delete or convert `/settings/ai-agents/swarm-training` to dev-only test harness. Update `CLAUDE.md` with completion status. Update memory files. Final tsc + lint + run every verify script.

### Architectural bugs found and corrected (April 15, 2026 session log)

These are the mistakes the previous sessions left in the codebase that this session caught and fixed. Historical lessons:

1. **Standalone grading page was the wrong surface.** An earlier session built `/settings/ai-agents/swarm-training` as a destination where the operator navigates and pastes specialist output to grade. The correct architecture is inline grading on the Mission Control step detail panel, where the operator is already reviewing work in context. Standalone page is now a dev-only test harness.
2. **StepGradeWidget hardcoded `agentType: 'orchestrator'`.** Every step-level correction routed to Jasper's top-level GM regardless of which specialist produced the bad output. Copywriter kept producing the same bad copy while the review gate kept rejecting it — the training loop was broken at the root. M2b fixed the routing.
3. **Jasper had 4 direct-specialist tools that bypassed managers entirely.** `create_video`, `scrape_website`, `research_competitors`, `scan_tech_stack`. The specialist calls skipped the Phase 1 review gate and orphaned their step records (tool name ≠ specialist ID). M2.0 removed them from Jasper's allowlist + pattern matcher + thought-partner prompt + mission trigger list.
4. **Mission step `delegatedTo` field stored tool names, not specialist IDs.** `delegate_to_content` became `"CONTENT"` (department name), not `"COPYWRITER"` (actual specialist). M2a added `specialistsUsed: string[]` as a separate field populated by `BaseManager`'s accumulator. The old `delegatedTo` field is kept for backward compat; `specialistsUsed` is the authoritative target list for grading.
5. **No rollback UI existed.** The backend primitive `deployIndustryGMVersion` could activate any past version, but there was no API to list versions and no UI to trigger the rollback. M2c + M2d shipped the full rollback path.

---

## Current Status (March 28, 2026 — Full Code Audit)

### Production Readiness: ~90% (Honest Assessment — March 28, 2026)

**What's ready:** Jasper orchestration (46 tools, 9 delegation routes, all real), Mission Control (SSE streaming, review links, approval gates), CRM (lead scoring, enrichment, deal pipeline), website builder (35+ widgets, AI generation, migration), workflows, forms, coaching, RBAC (100% route coverage — 366 standard auth + 50 alternative auth + 20 intentionally public), payments via Stripe (full lifecycle), social media (14 platforms wired into dispatcher with real API implementations), onboarding (5-step wizard with auto-save), invoice generation (Playwright PDF), email unsubscribe route, billing settings page, team invite flow + role management UI, campaign CRUD (including DELETE), all 12 payment webhook handlers.

**What's NOT ready:** Music library has 15 tracks with placeholder Firebase Storage URLs (need real audio files uploaded). Video cascade delete (deleting a project doesn't clean up orphaned scene records). CSP header not configured (HSTS is active). Rate limiting is in-memory only (needs Redis for multi-instance). No visual workflow or form builder (config-based only). MFA setup flow missing. Paddle subscription cancel/manage via API.

| Area | Status |
|------|--------|
| Single-tenant architecture | **COMPLETE** — Firebase kill-switch, PLATFORM_ID constant, workspace paths eradicated |
| 4-role RBAC | **ENFORCED** — 100% of 436 routes protected (366 standard auth + 50 alternative auth + 20 intentionally public), 53 permissions, sidebar filtering |
| Agent hierarchy | **100% COMPLETE** — 72 agents (1 L1 orchestrator + 10 L2 managers + 57 L3 specialists + 4 standalone), counts authoritative from auto-generated `agent-registry.ts`. Includes new OPERATIONS_MANAGER + SCHEDULING_SPECIALIST (Apr 30 2026). |
| Jasper delegation | **COMPLETE** — 46 tools (9 delegate_to_*, 37 utility). All tool handlers execute real services. 2 minor stubs (`generate_content`, `draft_outreach_email`) redirect to specialized endpoints. Mission Control SSE streaming + Campaign Review live |
| CRM & Sales | **COMPLETE** — Lead scoring (0-100 BANT), proprietary enrichment (500x cheaper than Clearbit), 6-stage deal pipeline with signal bus, smart sequencer with score-based timing |
| Type safety | **CLEAN** — `tsc --noEmit` passes. Zero `any`, zero `@ts-ignore`, zero `@ts-expect-error` |
| Build pipeline | **CLEAN** — `npm run build` passes, `npm run lint` zero warnings |
| Dashboard UI | **194 pages** with 12-module feature toggle system |
| Revenue & Commerce | **COMPLETE** — Stripe fully wired (1270-line webhook handler, subscriptions, checkout). 11 additional providers have checkout + payment processing. All 12 have real webhook handlers with signature verification (HMAC-SHA256). Invoice generation via Playwright PDF + Firebase Storage upload. Coupon system comprehensive (platform + merchant + AI authorization). Tier enforcement active (4 tiers with limits). **GAP:** Chargebee has webhook but no payment implementation file. Paddle missing cancel/manage subscriptions via API. |
| Video System | **85% READY** — Hedra API real and working. Scene generation (prompt + avatar modes), FFmpeg assembly, project persistence, batch generation. Audio mixing in stitcher-service is real (segment selection, BPM detection, beat markers, fade config). **GAP:** Music library has 15 tracks with placeholder Firebase Storage URLs (need real audio files uploaded). |
| Voice AI | **85% READY** — 4 telephony providers (Vonage, Bandwidth confirmed; Twilio/Telnyx class files unverified). AI conversation agent with BANT qualification, TTS (ElevenLabs + Unreal Speech), TCPA compliance. TwiML endpoint is production-grade (334 lines, Twilio sig verification, voicemail detection, AI agent integration, human fallback transfer). |
| Social Media | **TIERED VIABILITY (revised Apr 27 2026)** — code wired for 14 platforms in `postToPlatform()` dispatcher, but commercial-API research re-tiered them. **Tier 1 (posting + DM viable):** Bluesky ✅ LIVE, Mastodon ✅ LIVE, X ⚠ outbound-only (X Chat encryption blocks API DMs), Facebook + Instagram (Meta Business Verification gated). **Tier 2 (posting only):** LinkedIn (MDP gated, DM enterprise-only), YouTube, Threads (Meta gated), Pinterest (Dev Portal gated), Google Business (Profile verify gated). **Tier 3 (skip/delete):** Reddit (commercial API "effectively impossible" without $10K+/mo enterprise — MARKED FOR DELETION), Telegram (US SMB <10% adoption — MARKED FOR DELETION), TikTok (DM US-blocked, posting selective), WhatsApp Business (customer-init only), Truth Social (Cloudflare wall — PARKED). See `memory/project_platform_viability_matrix.md` for binding rubric. |
| Email & Newsletters | **90% READY** — SendGrid + Resend + SMTP sending works. Open/click tracking, CAN-SPAM footer. Unsubscribe route exists (`/api/public/unsubscribe` — GET renders page, POST processes). Campaign stats update from SendGrid webhooks via `FieldValue.increment()`. |
| Website Builder | **85% READY** — 35+ widgets, drag-drop editor, AI page generation, site cloning/migration, public rendering, SEO controls, blog. **GAPS:** Scheduled publishing cron missing, image upload mechanism, form widgets lack submission handlers. |
| Onboarding | **80% READY** — 5-step wizard (industry → niche → account → features → setup) with Zustand + localStorage persistence between steps. Auto-save on step advancement via `/api/onboarding/progress` PATCH. Atomic Firestore writeBatch at step 3 (account creation) and step 5 (API key + persona building). **GAP:** Progress is localStorage-based (device-specific) — no server-side resume across devices. |
| Workflows | **90% READY** — 12 action types, condition evaluation, timeout protection, cron scheduling. No visual builder (config-based). |
| Forms | **90% READY** — Full CRUD, submission handling, CRM lead creation, reCAPTCHA, honeypot. No visual builder. |
| SEO | **75% READY** — Serper + DataForSEO APIs wired. robots.txt, llms.txt, sitemap generation. **GAPS:** Keyword research UI, rank tracking dashboard, site audit runner, content optimization suggestions. |
| Settings | **85% READY** — API keys fully functional. Integrations functional. Billing settings page with subscription management UI. Team management with email invite flow (`/api/users/invite`) and role reassignment UI (`/settings/users`). **GAP:** Brand kit persistence unclear. |
| Testing | **IMPROVED** — 110 test files (4 unit/integration in src/ + 106 Playwright/config in tests/) |
| Security | **MOSTLY COMPLETE** — HSTS enabled, rate limiting (in-memory), webhook signature verification (Stripe HMAC-SHA256, SendGrid ECDSA, Twilio HMAC-SHA1, Gmail Bearer token), input sanitization via Zod. **GAP:** CSP header NOT configured (only HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy are set). |

### Domain Readiness Scorecard (March 28, 2026 — Code-Verified Audit)

| Domain | Score | Status |
|--------|-------|--------|
| Authentication & RBAC | 10/10 | READY — 100% route coverage (366 standard + 50 alternative + 20 intentional public), 53 permissions, custom claims with Firestore fallback |
| Jasper Orchestrator | 9.5/10 | READY — 46 tools, 9 delegation routes, fire-and-forget mission tracking, model fallback chain |
| Mission Control | 9/10 | READY — SSE streaming, 3-panel layout, deep-linking, approval gates. No output editing (read-only). |
| CRM & Sales | 9/10 | READY — Lead scoring, proprietary enrichment, deal pipeline, smart sequencer. Firestore indexes need manual setup. |
| Social Media | 7/10 | TIER-RE-EVALUATED Apr 27 2026 — code wired for 14 platforms but commercial-API posture re-tiered them. Reddit + Telegram MARKED FOR DELETION (commercial blocked / market irrelevant). Bluesky + Mastodon LIVE both directions. Tier 1+2 platforms still need external approvals (Meta Verification, LinkedIn MDP, Google verification, etc.). See `project_platform_viability_matrix.md` memory for binding rubric. |
| Website Builder | 8.5/10 | READY — 35+ widgets, AI generation, migration, public rendering. Needs scheduled publish cron. |
| Workflows & Automation | 9/10 | READY — 12 action types, conditions, cron scheduling, timeout protection. No visual builder. |
| Forms | 9/10 | READY — Full CRUD, submissions, CRM integration, reCAPTCHA, honeypot. No visual builder. |
| Coaching & Performance | 8.5/10 | READY — AI-powered insights via OpenRouter, real Firestore data, team analytics. |
| Payments & Commerce | 9/10 | READY — Stripe fully wired. All 12 providers have real webhook handlers with signature verification. Invoice generation via Playwright PDF. Coupon system, tier enforcement, e-commerce checkout all working. **Gaps:** Chargebee missing payment implementation. Paddle subscription cancel/manage via API missing. |
| Email & SMS | 9/10 | READY — SendGrid/Resend/SMTP working, open/click tracking, CAN-SPAM footer. Unsubscribe page exists. Campaign stats auto-update from webhooks. |
| Video System | 8.5/10 | MOSTLY READY — Hedra API real, scene generation, FFmpeg assembly, real audio mixing. **Gap: Music library has 15 tracks with placeholder Firebase Storage URLs.** |
| Voice AI | 8.5/10 | READY — 4 providers, AI agent, TTS. TwiML is production-grade (334 lines, sig verification, AI conversation, voicemail handling, human fallback). |
| Onboarding | 8/10 | READY — 5-step wizard with Zustand + localStorage persistence. Auto-save on step advancement. Atomic Firestore writes at steps 3 and 5. **Gap:** localStorage-only (no cross-device resume). |
| SEO | 7.5/10 | PARTIAL — Serper + DataForSEO wired. robots.txt/llms.txt/sitemap. Missing keyword UI and rank tracking. |
| Settings | 8.5/10 | READY — API keys work. Billing settings with subscription management. Team management with invite flow and role reassignment UI. **Gap:** Brand kit persistence unclear. |
| Security | 8/10 | MOSTLY READY — HSTS, rate limiting (in-memory), webhook signature verification (4 providers), Zod input sanitization. **Gap: CSP header NOT configured.** |
| API Validation (Zod) | 9.5/10 | READY (99% coverage) |
| Testing | 8/10 | READY (110 test files) |

### Launch Gaps (March 28, 2026 — Code-Verified Audit)

#### Previously Critical — NOW RESOLVED
The following items were listed as critical gaps in the March 26 audit. All have been verified as FIXED in code:
- ~~Social media posting broken~~ → **FIXED:** All 14 platforms wired into `postToPlatform()` with real API implementations
- ~~Onboarding data loss~~ → **FIXED:** 5-step wizard with auto-save via `/api/onboarding/progress` PATCH + Zustand/localStorage persistence
- ~~Sequencer test-mode bypass~~ → **FALSE POSITIVE:** No `NODE_ENV === 'test'` bypass exists at sequencer.ts lines 816-1001. Those lines contain legitimate email/SMS/LinkedIn/phone action handlers.
- ~~Invoice generation missing~~ → **FIXED:** `src/lib/ecommerce/invoice-generator.ts` — Playwright HTML→PDF, Firebase Storage upload, public URL return
- ~~Email unsubscribe page 404~~ → **FIXED:** `/api/public/unsubscribe` (GET renders page, POST processes unsubscribe with token verification + suppression recording + sequence unenrollment)
- ~~Campaign stats stale~~ → **FIXED:** `/api/webhooks/email/route.ts` lines 237-317 update stats via `FieldValue.increment()` on webhook events
- ~~8 webhook handler stubs~~ → **FIXED:** All payment webhook handlers have real implementations with signature verification
- ~~Billing settings page stub~~ → **FIXED:** Full subscription management UI with portal access
- ~~Team management incomplete~~ → **FIXED:** Email invite flow (`/api/users/invite`) + role reassignment UI (`/settings/users`)
- ~~Campaign DELETE missing~~ → **FIXED:** DELETE handler at `/api/campaigns/[campaignId]/route.ts`
- ~~Env var validation~~ → **FIXED:** Uses nullish coalescing (`clientId ?? ''`)

#### High Priority (Pre-Launch)
| Gap | Details | Effort |
|-----|---------|--------|
| **CSP header missing** | Content-Security-Policy not configured in next.config.js. HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy are all set — but CSP is absent. | Half day |
| **Video music library placeholders** | 15 tracks defined but URLs point to non-existent Firebase Storage paths (`music/upbeat-drive.mp3` etc.). Need real audio files uploaded. | 1 day |
| **Video cascade delete** | Deleting a project doesn't clean up orphaned scene records in Firestore | Half day |
| **Paddle subscription API** | Can create via checkout but can't cancel/manage subscriptions via API | 1 day |
| **Chargebee implementation** | Listed in PAYMENT_PROVIDERS constant and has webhook handler, but no payment processing implementation file | 1 day |
| **Nextdoor + Rumble** | Only 2 social platforms without any code. Lower priority — 14 of 16 target platforms are implemented. | 1-2 days |

#### Medium Priority (Post-Launch OK)
| Gap | Details |
|-----|---------|
| **Visual workflow builder** | Workflows work via config but no drag-drop canvas |
| **Visual form builder** | Forms work via config but no drag-drop editor |
| **SEO keyword research UI** | DataForSEO integration exists but no keyword entry/tracking dashboard |
| **SEO rank tracking** | No daily position tracking visualization |
| **Rate limiting in-memory** | Won't scale multi-instance — wire Redis |
| **Firestore composite indexes** | Need manual setup via console for sorted queries at scale |
| **MFA enforcement** | `mfaEnabled` field exists but no setup flow |
| **Dashboard data caching** | Each load hits Firestore — add 5-min TTL cache |
| **Cross-device onboarding resume** | Onboarding saves to localStorage (device-specific). Server-side progress persistence would enable cross-device resume. |
| **Multi-tenant re-enablement** | Design org isolation for SaaS product launch |

### Open Items — Legacy Punch List (Pre-March 20)

#### Tier 1: CRITICAL (Code fixes — actively harmful or demo-breaking)

| # | Area | Issue | Status |
|---|------|-------|--------|
| 1 | **Facebook agent fake data** | Removed Math.random() metrics + shareInsight calls | ✅ FIXED Mar 9 |
| 2 | **Twitter agent fake data** | Wired real TwitterService; shareInsight only with real API data | ✅ FIXED Mar 9 |
| 3 | **CRM event triggers disabled** | Replaced client SDK with admin SDK; triggers now query Firestore correctly | ✅ FIXED Mar 9 |
| 4 | **Email tracking not recorded** | Replaced client SDK with admin SDK; opens/clicks now persist | ✅ FIXED Mar 9 |
| 5 | **Signal persistence now durable** | Signal persistence now durable — writeSignal awaits Firestore confirmation. Workflow execution was already tracked. | ✅ FIXED Mar 10 |
| 6 | **Cross-manager routing fake** | Returns honest "not yet wired" instead of fake success | ✅ FIXED Mar 9 |
| 7 | **Social posting DEV MODE** | Returns 503 error when credentials missing (was fake 200) | ✅ FIXED Mar 9 |
| 8 | **Commerce payment fake** | Returns error when Stripe unconfigured (was fake checkout session) | ✅ FIXED Mar 9 |
| 9 | **Voice outreach blocked** | Already returns honest BLOCKED status — not a lie | ⚠️ KNOWN |

#### Tier 2: Functional Gaps (Silent failures, empty responses)

| # | Area | Issue | Status |
|---|------|-------|--------|
| 10 | **Lead nurturing** | scheduleStep implemented with admin SDK; cron pickup works | ✅ FIXED Mar 9 |
| 11 | **Deal pipeline chart** | Time series now uses real deal data | ✅ FIXED Mar 9 |
| 12 | **GMB agent** | Returns empty array with warning (Google Places API needed) | ✅ FIXED Mar 9 |
| 13 | **Review manager** | Queries real Firestore reviews collection | ✅ FIXED Mar 9 |
| 14 | **Catalog sync** | Returns honest error instead of success:true with zero synced | ✅ FIXED Mar 9 |
| 15 | **Video system** | Phase 1 complete — Hedra-only engine, TTS fixed, all engines stripped | ✅ FIXED Mar 9 |
| 16 | **Vertex AI tuning** | Throws honest error about missing credentials | ✅ FIXED Mar 9 |
| 17 | **Workflow triggers** | Warning logs added; config-only until Cloud Functions deployed | ✅ FIXED Mar 9 |
| 18 | **score_leads tool** | Real scoring implemented — queries leads, scores, writes back | ✅ FIXED Mar 9 |

#### Tier 3: External Blockers (Need credentials or third-party action)

| # | Area | What's Needed |
|---|------|---------------|
| 18 | **Stripe** | Production API keys (bank account setup) |
| 19 | **Facebook/Instagram** | Meta Developer Portal approval |
| 20 | **LinkedIn** | Marketing Developer Platform approval |
| 21 | **Twilio** | Account verification for voice calls |
| 22 | **Email DNS** | SPF/DKIM/DMARC for salesvelocity.ai |
| 23 | **Domain** | CNAME/A records to Vercel, SSL |
| 24 | **OAuth apps** | Production redirect URIs |

#### Tier 4: Technical Debt (Post-launch OK)

| # | Issue | Status |
|---|-------|--------|
| 25 | Placeholder tests | ✅ FIXED Mar 9 — only 6 existed (not 115), removed |
| 26 | Zod validation coverage | **COMPLETE (March 20)** — Full sweep verified 173/175 POST/PUT/PATCH routes have inline Zod schemas. 2 fixes applied. Coverage: ~99%. |
| 27 | 37 skipped tests (need external services) | 34 skipped tests — 16 E2E timing (Firebase auth slow), 13 need API keys (external), 1 Jest limitation. All have proper conditional skip logic. \| DOCUMENTED |
| 28 | Search uses Firestore full-scan (no Algolia) | ✅ FIXED Mar 10 — admin SDK, parallel queries, per-schema caps (200), relevance scoring, early termination |
| 29 | Admin DAL `verifyAccess()` is a no-op | ✅ FIXED Mar 10 — dead code removed |
| 30 | SMTP was a stub — now real via nodemailer | ✅ FIXED Mar 10 — only SMTP was a stub; now real via nodemailer. Square, Vonage, Resend, and Calendly were already real implementations. |

### Active Roadmap (March 28, 2026)

**Previously listed Week 1-2 items — ALL RESOLVED:**
- ~~Wire 8 social platforms~~ → DONE (all 14 wired)
- ~~Onboarding auto-save~~ → DONE (auto-save on step advancement)
- ~~Unsubscribe page~~ → DONE (`/api/public/unsubscribe`)
- ~~Remove sequencer test guards~~ → FALSE (no test guards found)
- ~~Invoice generation~~ → DONE (`invoice-generator.ts`)
- ~~Campaign stats from webhooks~~ → DONE (webhook handler increments stats)
- ~~Campaign DELETE~~ → DONE
- ~~Billing settings page~~ → DONE

**Current Priority (Pre-Launch):**

| Priority | Focus | Status | Effort |
|----------|-------|--------|--------|
| **CSP header** | Add Content-Security-Policy to next.config.js security headers | TODO | Half day |
| **Music library audio files** | Upload real audio files to Firebase Storage for 15 tracks | TODO | 1 day |
| **Video cascade delete** | Clean up orphaned scene records when deleting a project | TODO | Half day |
| **Paddle subscription management** | Add cancel/manage via API | TODO | 1 day |
| **Chargebee payment implementation** | Add payment processing code (webhook handler already exists) | TODO | 1 day |

**Completed (Archived):**

| Focus | Date |
|-------|------|
| Stub Eradication (8 issues) | March 25 |
| Jasper Config Awareness + Inline Setup | March 25 |
| Campaign Dashboard + Templates | March 25 |
| Payment System (12 providers) | March 25 |
| AI Creative Studio | March 16 |
| Campaign Orchestration (Layers 1-4) | March 15 |
| Video System (Phases 1-4) | March 10 |
| Tier 1-4 Punch List | March 9-10 |

**Blocked (External Dependencies):**

| Focus | Blocker |
|-------|---------|
| Facebook/Instagram | Meta Developer Portal approval (code is DONE — Graph API v19.0 integrated, needs production app review) |
| LinkedIn official posting | Marketing Developer Platform approval (RapidAPI fallback works, official API needs app approval) |
| YouTube/TikTok | API credential setup (code is DONE — Data API v3 + Content Posting API integrated, needs OAuth app creation) |
| Stripe go-live | Bank account setup for production keys |
| Nextdoor/Rumble | No implementation yet — low priority (14 of 16 platforms done) |

### Completed Sprints (All)

> Sprints 1-17 archived. Sprints 18+ listed below.

| Sprint | Summary | Date |
|--------|---------|------|
| **18-23** | Mission Control (live SSE, cancel, delegation), AI Search Optimization, Website Migration, Security Hardening | Feb 24 |
| **24** | Admin SDK Migration — 64 API routes migrated | Feb 25 |
| **25-28** | Workspace eradication, nav cleanup, feature toggles, onboarding overhaul | Feb 27 |
| **—** | Demo seed Part 4, Growth Command Center, Golden Masters, Coaching | Mar 2 |
| **—** | Lead Research consolidation — 4 tools → 1 page, leads tab nav fixed | Mar 5 |

### Completed Roadmaps (Archived)

All roadmaps fully complete. Details in git history and `docs/archive/`.

---

## Ironclad Architecture Rules

> **Status:** BINDING — These rules are non-negotiable architectural constraints. Any code that violates them is a **bug** and must be corrected immediately. No exception, no discussion.

---

### Rule 1: The "One Company" Rule

**`rapid-compliance-root` is the ONLY valid organization ID in this system. Period.**

| Aspect | Detail |
|--------|--------|
| **Constant** | `DEFAULT_ORG_ID = 'rapid-compliance-root'` in `src/lib/constants/platform.ts` |
| **Company Config** | `COMPANY_CONFIG = { id: 'rapid-compliance-root', name: 'SalesVelocity.ai' }` |
| **Firebase Project** | `rapid-compliance-65f87` (enforced by `CriticalConfigurationError` kill-switch) |
| **Validation Helpers** | `PLATFORM_ID` constant; `getSubCollection()` builds platform-scoped Firestore paths |

**Enforcement:**
- All Firestore paths, API routes, and service classes use `DEFAULT_ORG_ID` exclusively
- `CriticalConfigurationError` in `src/lib/firebase/config.ts` halts the application if any other Firebase project is detected at runtime
- All Firestore path helpers (`getSubCollection`, `getPlatformCollection`) use `PLATFORM_ID` internally — no dynamic org routing

**Bug Definition:** Any code that introduces dynamic organization IDs, org-switching logic, tenant selection, multi-org routing, or parameterized org resolution is a **bug**. There is no org picker. There is no tenant dropdown. All paths use `PLATFORM_ID` constant.

---

### Rule 2: Unified AI Workforce Registry

**The 72 AI Agents are managed through a single global registry (src/lib/agents/agent-registry.ts, auto-generated) + .claude/agents/ prompts, not per-user.**

| Aspect | Detail |
|--------|--------|
| **Registry File** | `AGENT_REGISTRY.json` (project root — authoritative manifest) |
| **Runtime Registry** | `src/lib/agents/index.ts` (factory functions, swarm wiring) |
| **Firestore: Agent Config** | `organizations/rapid-compliance-root/agentConfig/{agentId}` |
| **Firestore: Golden Masters** | `organizations/rapid-compliance-root/goldenMasters/{masterId}` |
| **Firestore: Training Data** | `organizations/rapid-compliance-root/trainingData/{dataId}` |

**Hierarchy:**

```
MASTER_ORCHESTRATOR (L1 - Swarm CEO)
├── ARCHITECT_MANAGER     (L2) → 3 specialists
├── BUILDER_MANAGER       (L2) → 4 specialists
├── COMMERCE_MANAGER      (L2) → 4 specialists
├── CONTENT_MANAGER       (L2) → 6 specialists
├── INTELLIGENCE_MANAGER  (L2) → 6 specialists
├── MARKETING_MANAGER     (L2) → 19 specialists (incl. all platform Experts + GROWTH_STRATEGIST + PAID_ADS_SPECIALIST)
├── OPERATIONS_MANAGER    (L2) → 1 specialist  (NEW Apr 30 — SCHEDULING_SPECIALIST)
├── OUTREACH_MANAGER      (L2) → 3 specialists (EMAIL, SMS, VOICE_AI)
├── REPUTATION_MANAGER    (L2) → 4 specialists
└── REVENUE_DIRECTOR      (L2) → 6 specialists (incl. AI_CHAT_SALES_AGENT)

Plus PROMPT_ENGINEER (L3 meta-specialist — handles surgical GM edits)

Standalone (4): JASPER, AI Chat Sales Agent (Alex), VOICE_AGENT_HANDLER,
               AUTONOMOUS_POSTING_AGENT
```

**Total: 72 Agents (1 L1 + 10 L2 managers + 57 L3 specialists + 4 standalone). Counts authoritative from `src/lib/agents/agent-registry.ts` (auto-generated; CI fails on drift).**

**Governance:** Agents are deployed, trained, and configured at the **platform level**. The `AgentInstanceManager` (`src/lib/agent/instance-manager.ts`) creates ephemeral session instances from Golden Masters — these are temporary runtime objects, not persistent per-user registries.

**Bug Definition:** Any code that creates user-scoped agent registries or duplicate agent manifests outside the global registry is a **bug**.

---

### Rule 3: Theme Governance — CSS Variables Only

**All UI components MUST use CSS variables for colors. Hard-coded hex values are FORBIDDEN in component code.**

| Aspect | Detail |
|--------|--------|
| **Variable Source** | `src/app/globals.css` (`:root` block) |
| **Admin Scope** | `.admin-theme-scope` class — overrides `--color-*` with `--admin-color-*` |
| **Client Scope** | `:root` (document-level) via `useOrgTheme()` hook |
| **Admin Hook** | `useAdminTheme()` — loads from `platform_settings/adminTheme` |
| **Client Hook** | `useOrgTheme()` — loads from `organizations/rapid-compliance-root/themes/default` |

**Required Pattern (CORRECT):**
```css
color: var(--color-primary);
background: var(--color-bg-main);
background: rgba(var(--color-primary-rgb), 0.5);
border-color: var(--color-border-main);
```

**Forbidden Pattern (BUG):**
```css
color: #6366f1;
background: #000000;
background: rgb(99, 102, 241);
border-color: #1a1a1a;
```

**Core CSS Variable Families:**

| Family | Variables | Purpose |
|--------|-----------|---------|
| Primary | `--color-primary`, `--color-primary-light`, `--color-primary-dark`, `--color-primary-rgb` | Brand primary color |
| Secondary | `--color-secondary`, `--color-secondary-light`, `--color-secondary-dark` | Brand secondary color |
| Accent | `--color-accent`, `--color-accent-light`, `--color-accent-dark` | Accent highlights |
| Semantic | `--color-success`, `--color-warning`, `--color-error`, `--color-info` | Status indicators |
| Background | `--color-bg-main`, `--color-bg-paper`, `--color-bg-elevated` | Surface backgrounds |
| Text | `--color-text-primary`, `--color-text-secondary`, `--color-text-disabled` | Typography colors |
| Border | `--color-border-main`, `--color-border-light`, `--color-border-strong` | Border colors |
| Neutral | `--color-neutral-100` through `--color-neutral-900` | Gray scale |

**Theme Isolation Guarantee:**
- Changing a client theme at `/settings/theme` does NOT affect the Admin Dashboard
- Admin UI is wrapped in `.admin-theme-scope` which overrides all `--color-*` with `--admin-color-*`
- CSS cascading ensures admin variables always win within the admin container

**Known Exception:** `AdminSidebar.tsx` uses `iconColor` CSS variable strings (e.g., `var(--color-primary)`, `var(--color-success)`) in its navigation config for Lucide icon coloring. These are static navigation constants in the config array — migrated from hex strings to CSS variables as of Session 25.

**Bug Definition:** Any component that uses literal hex codes, `rgb()` values, or hard-coded color strings for theming instead of CSS variables is a **bug**.

---

### Rule 4: Navigation Hierarchy — Consolidated Sidebar

**All navigation lives in a single `AdminSidebar` component. The legacy "God Mode" sidebar is dead. Do not resurrect it.**

| Aspect | Detail |
|--------|--------|
| **Source** | `src/components/admin/AdminSidebar.tsx` |
| **Sections** | 9 navigation sections, ~40 sidebar items |
| **Width** | 280px expanded / 64px collapsed |
| **Theming** | 100% CSS variable-driven via `var(--color-*)` |
| **Routing** | All static routes — no dynamic org parameters in sidebar links |
| **Footer** | Integrations (plug icon → `/settings/integrations`), Settings (gear icon → `/settings`), and Help/Academy (help icon → `/academy`) |
| **Tab Navigation** | `SubpageNav` component provides route-based tabs on hub/parent pages |

**Consolidated Navigation Structure (February 27, 2026 — Redundancy Cleanup):**

| # | Section | Sidebar Items | Sub-pages (via SubpageNav tabs) |
|---|---------|---------------|----------------------------------|
| 1 | **Home** | Dashboard, Team | Dashboard tabs: Dashboard, Executive Briefing, Workforce HQ; Team tabs: Leaderboard, Tasks, Performance |
| 2 | **CRM** | Leads, Contacts, Companies, Deals, Conversations | Leads tabs (layout): All Leads (`/entities/leads`), Lead Research (`/leads/research`), Scoring (`/lead-scoring`) |
| 3 | **Outreach** | Sequences, Campaigns, Email Studio, Calls | Email Studio tabs: Email Writer, Nurture, Email Builder, Templates |
| 4 | **Marketing** | Social Hub, Content Generator, Proposals, Forms, Workflows | Social Hub tabs (layout): Command Center, Campaigns, Calendar, Approvals, Listening, Agent Rules, Playbook; Content Generator tabs: Video, Image, Editor, Library, Audio Lab; Proposals tabs: Proposals, Builder |
| 5 | **Commerce** | Products, Orders, Storefront | — |
| 6 | **Website** | Website | Website tabs (layout): Editor, Pages, Templates, Blog, SEO, Navigation, Settings, Audit Log; Blog sub-tabs: Posts, Editor, Categories; SEO sub-tabs: SEO, Competitors, Domains |
| 7 | **AI Workforce** | AI Workforce | Mission Control tabs (layout): Live, History; Training Hub tabs: AI Training, Voice, Social, SEO; Models tabs: Datasets, Fine-Tuning |
| 8 | **Analytics & Growth** | Overview, Growth, A/B Testing | Analytics tabs (layout): Overview, Revenue, CRM Analytics, E-Commerce, Attribution, Workflows, Sequences, Compliance, Competitor Research |
| 9 | **System** (owner-only) | System | System tabs: System Health, Impersonate |

**Footer:** Integrations → `/settings/integrations`, Settings → `/settings`, Academy → `/academy`

**SubpageNav Architecture:**
- **Component:** `src/components/ui/SubpageNav.tsx` — Route-based tab bar using `usePathname()`
- **Centralized Config:** `src/lib/constants/subpage-nav.ts` — 21 tab arrays
- **11 layout.tsx files** render SubpageNav automatically: social, analytics, website, website/blog, website/seo, mission-control, ai, coaching, team, growth, leads
- **Cross-route pages** import from centralized constants and render inline SubpageNav (e.g., entities/leads page shows LEADS_TABS)

**Lead Research Consolidation (March 5, 2026):**
- `/leads/icp`, `/leads/discovery`, `/scraper` → all redirect to `/leads/research`
- `/leads` → redirects to `/entities/leads` (All Leads entity page)
- `entities/[entityName]/page.tsx` renders LEADS_TABS when `entityName === 'leads'`
- `leads/layout.tsx` renders LEADS_TABS for all `/leads/*` sub-routes

**History:** 13 sections → 9 sections (Sessions 25-27). 11 layout.tsx files render SubpageNav. 21 tab arrays in centralized config. 12 pages redirect to canonical routes.

**Bug Definition:** Any code that creates parallel navigation structures, reintroduces God Mode sidebars, builds shadow navigation components, or splits sidebar logic into disconnected files is a **bug**.

---

### Rule 5: Firebase Flat Pathing

**Firestore uses a flat pathing model. `users` and `platform_settings` are root-level collections. Organization data nests under the single `rapid-compliance-root` document.**

**Root-Level Collections (Flat — NOT nested under any org):**

| Collection | Path Pattern | Purpose |
|------------|-------------|---------|
| `users` | `users/{userId}` | User profiles and auth data |
| `platform_settings` | `platform_settings/{settingId}` | Global platform configuration (admin theme, feature flags) |
| `platform_metrics` | `platform_metrics/{metricId}` | Platform-wide analytics metrics |
| `health` | `health/{healthId}` | System health check records |
| `discoveryQueue` | `discoveryQueue/{itemId}` | Lead discovery queue items |
| `admin` | `admin/{configId}` | Admin-level configurations |
| `slack_workspaces` | `slack_workspaces/{workspaceId}` | Slack OAuth workspace configs |

**Organization-Scoped Collections (under single org root):**

| Collection | Path Pattern | Purpose |
|------------|-------------|---------|
| Agent Config | `organizations/rapid-compliance-root/agentConfig/{agentId}` | AI agent settings |
| Golden Masters | `organizations/rapid-compliance-root/goldenMasters/{masterId}` | Trained AI model snapshots |
| Themes | `organizations/rapid-compliance-root/themes/default` | Client theme configuration |
| CRM Records | `organizations/rapid-compliance-root/{entity}/{id}` | Entity records (flat, no workspace nesting) |
| Schemas | `organizations/rapid-compliance-root/schemas/{schemaId}` | Data schemas (flat, no workspace nesting) |
| Email Campaigns | `organizations/rapid-compliance-root/emailCampaigns/{campaignId}` | Email campaign data |
| Nurture Sequences | `organizations/rapid-compliance-root/nurtureSequences/{sequenceId}` | Nurture sequence data |
| Signals | `organizations/rapid-compliance-root/signals/{signalId}` | Agent signal bus events |

**Collection Helpers (in `src/lib/firebase/collections.ts`):**

```typescript
orgCol(collection)         → organizations/rapid-compliance-root/{collection}
orgDoc(collection, id)     → organizations/rapid-compliance-root/{collection}/{id}
```

All helpers are hardcoded to `DEFAULT_ORG_ID`. There is no dynamic org parameter. Workspace-scoped path builders (`workspacePath`, `entityRecordsPath`) have been fully eradicated — 53 files migrated to flat org-scoped paths as of February 27, 2026.

**Bug Definition:** Any code that constructs Firestore paths with dynamic organization IDs, nests `users` or `platform_settings` under an organization document, or creates per-user root-level collections for data that belongs at org scope is a **bug**.

---

## Single-Tenant Architecture (COMPLETE)

**Status:** FULLY COMPLETE — February 2, 2026 | **Net Result:** -185 files, -71,369 lines of code

SalesVelocity.ai is a **multi-tenant SaaS product** currently running on the Penthouse Model (single-tenant development strategy). Multi-tenancy will be re-enabled after core features are stable. All data paths use `PLATFORM_ID` constant.

**Security:** Firebase kill-switch in `src/lib/firebase/config.ts` — only `rapid-compliance-65f87` project allowed, `CriticalConfigurationError` halts on mismatch. Routes use `/(dashboard)/*` layout. Legacy URLs redirect via middleware.

> Migration details, backend status tables, and conversion phase records archived in `docs/archive/`.

---

## Verified Live Route Map

### Route Distribution (April 30, 2026)

| Area | Routes | Dynamic Params | Status |
|------|--------|----------------|--------|
| Dashboard (`/(dashboard)/*`) | ~135+ | 8 | **Flattened** single-tenant (incl. social, mission-control, content, settings, **calendar, studio, media, content/video/editor, settings/{meeting-scheduler,scheduling-messages,integrations}**) |
| Public (`/(public)/*`) | ~22 | 1 (`[formId]`) | Marketing + auth pages (incl. **/early-access** with demo-scheduling checkbox) |
| Dashboard sub-routes (`/dashboard/*`) | 16 | 0 | Analytics, coaching, marketing, performance |
| Store (`/store/*`) | ~6 | 1 (`[productId]`) | E-commerce storefront + checkout |
| Onboarding (`/onboarding/*`) | 5 | 0 | 5-step onboarding: industry category, niche drill-down, account creation, feature selection, API key setup |
| Auth (`/(auth)/*`) | 1 | 0 | Admin login |
| Academy (`/academy/*`) | 3 | 1 (`[id]`) | Learning hub, courses, certifications |
| Other (`/preview`, `/profile`, `/sites`) | 3 | 2 | Preview tokens, user profile, site builder |
| **TOTAL** | **207** | **~13** | **Verified April 30, 2026** |

**DELETED:** `src/app/workspace/` (95 pages) and `src/app/admin/*` (92 pages) - legacy routes removed/consolidated into `(dashboard)`

### Admin Routes (ARCHIVED — Consolidated into Dashboard)

> **Note:** The standalone `/admin/*` page routes (92 pages) were removed during consolidation. All administrative functionality now lives within the `/(dashboard)/*` route group, accessible via RBAC role-gating (`owner`/`admin` roles). Admin API routes (`/api/admin/*`) still exist for backend operations.
>
> **Admin Login:** `/(auth)/admin-login` — Firebase admin auth
### Dashboard Routes (127 in /(dashboard)/* - Flattened Single-Tenant)

> **Note:** All dashboard routes use `PLATFORM_ID = 'rapid-compliance-root'` internally via `getSubCollection()`.

**Core Navigation:**
- `/dashboard`, `/settings`, `/analytics`, `/templates`
- `/battlecards`, `/email-writer`, `/lead-scoring`, `/living-ledger`
- `/conversations`, `/workforce`, `/crm` (unified CRM with entity tabs)

**CRM Entities:**
- `/crm` (unified: leads, companies, contacts, deals, products, quotes, invoices, payments, orders, tasks via `?view=` param)
- `/leads/new`, `/leads/[id]`, `/leads/[id]/edit`
- `/leads/research` (3-column Lead Research page — AI chat, results, URL sources)
- `/leads/icp` → redirects to `/leads/research`
- `/leads/discovery` → redirects to `/leads/research`
- `/deals`, `/deals/new`, `/deals/[id]`, `/deals/[id]/edit`
- `/contacts/new`, `/contacts/[id]`, `/contacts/[id]/edit`
- `/products`, `/products/new`, `/products/[id]/edit`
- `/orders` (NEW Feb 12 — full order management with table, filters, detail drawer)
- `/entities/[entityName]` (entity config gating — disabled entities show "not enabled" banner with Enable button for admin, "contact admin" for users)

**Entity Config System (NEW Feb 28):**
- 5 Always-On: `leads`, `contacts`, `companies`, `deals`, `tasks` — cannot be toggled off
- 5 CRM Extended: `products`, `quotes`, `invoices`, `payments`, `orders` — toggleable, default ON
- 13 Industry-Specific: `drivers`, `vehicles`, `compliance_documents`, `projects`, `time_entries`, `customers`, `inventory`, `properties`, `showings`, `cases`, `billing_entries`, `patients`, `appointments` — toggled by category defaults
- Schema Editor dims disabled entities (50% opacity), hides "View Data", shows "Enable in Settings" link
- Settings > Features page has 5 tabs: Your Business → Features → **CRM Entities** → API Keys → Summary
- Stored in Firestore: `organizations/{PLATFORM_ID}/settings/entity_config`

**Marketing & Outbound:**
- `/email/campaigns`, `/email/campaigns/new`, `/email/campaigns/[campaignId]`
- `/nurture`, `/nurture/new`, `/nurture/[id]`, `/nurture/[id]/stats`
- `/ab-tests`, `/ab-tests/new`, `/ab-tests/[id]`
- `/outbound/sequences`
- `/social/campaigns` (Content Studio — dual-mode autopilot/manual), `/social/training`, `/social/approvals` (batch review, correction capture, "Why" badge), `/social/calendar`, `/social/listening`
- `/social/command-center` (kill switch, velocity gauges, agent status, activity feed), `/social/analytics` (dashboard), `/social/agent-rules` (guardrails editor)

**Deleted Duplicates (February 26, 2026):**
- `/marketing/ab-tests` — duplicate of `/ab-tests`
- `/outbound/email-writer` — duplicate of `/email-writer`
- `/identity/refine` — duplicate of `/settings/ai-agents/persona`

**Redirected Pages:**
- `/integrations` → `/settings/integrations`
- `/ai-agents` → `/workforce`
- `/settings/workflows` → `/workflows`
- `/outbound` → `/email-writer`
- `/leads` → `/entities/leads` (All Leads entity page with LEADS_TABS)
- `/contacts` → `/crm?view=contacts`
- `/social/activity` → `/social/command-center`
- `/analytics/pipeline` → `/analytics/sales`
- `/website/seo/ai-search` → `/website/seo`
- `/leads/icp` → `/leads/research` (March 5 — consolidated into Lead Research)
- `/leads/discovery` → `/leads/research` (March 5 — consolidated into Lead Research)
- `/scraper` → `/leads/research` (March 5 — consolidated into Lead Research)

**Unified Calendar (NEW April 30):**
- `/calendar` — Single-pane calendar dashboard. Reads from 5 sources via `src/lib/calendar/event-aggregator.ts`: meetings (`meetingProvider` discriminated), bookings, Google Calendar sync, scheduled social posts, CRM activities. Filter chips for source type and date range. Backend: `GET /api/calendar/events`.

**Magic Studio + Media Library (NEW April 30):**
- `/studio` — Magic Studio composer. Single-canvas layout + command bar + tool palette (Image / Video / Music / Text). Each tool wired to its respective generate endpoint. Recent-generations sidebar persists per session.
- `/media` — Unified media library browser. Reads from `src/lib/media/media-library-service.ts` (canonical `UnifiedMediaAsset` shape; legacy `MediaItem` retained for back-compat). Backend: `/api/media` (GET list/search, POST upload), `/api/media/[id]` (GET, DELETE), `/api/media/persist`. Backfill script: `scripts/backfill-media-library.ts`.

**Video & Voice Lab:**
- `/content/video` (Video Studio — Hedra-only engine + Character Studio + AI Video Director)
- `/content/video/library` (Video Library gallery with grid view, filter tabs, detail expansion, edit/download/delete actions)
- `/content/video/editor` (Standalone Video Editor — timeline trim/split/merge, drag-positioned text overlays, brightness/contrast/saturation/hue per clip, transitions, FFmpeg render via `/api/video/editor/render`. Has a dedicated sidebar entry as of Apr 30. Accepts project clips or direct URL list.)
- `/content/voice-lab` (Voice Lab — recording studio, voice library with ElevenLabs voices, **AI Music tab** wired to Replicate MusicGen via `src/lib/music/music-generation-service.ts` + `/api/content/music/generate`)
- **Character Studio** — reusable character library: custom + Hedra stock characters, reference images, green screen clips, voice assignment, role/style tags. Auto-syncs all Hedra characters into avatar picker on mount.
- **AI Video Director** — `produce_video`, `assemble_video`, `edit_video`, and `manage_media_library` Jasper tools, per-scene character assignment, Hedra prompt translator, scene review workflow (approve/reject/feedback/regenerate), brand preference memory.
- **Current Status: FUNCTIONAL** — Hedra sole engine. Phases 1-4 complete (March 10). Video Editor, Media Library, and 2 new Jasper tools operational.

**Growth Command Center (NEW March 2):**
- `/growth/command-center` — Overview dashboard: stat cards (competitors, keywords, AI visibility), competitive landscape, keyword movers, strategy status, activity feed
- `/growth/competitors` — Competitor cards, discover by niche, add/analyze/remove, domain authority trends
- `/growth/keywords` — Keyword ranking table with position/change/volume/CPC/difficulty, bulk add, check ranking
- `/growth/strategy` — 3-tier strategy comparison (Aggressive/Competitive/Scrappy), approve/reject, budget config, cheaper alternatives
- `/growth/ai-visibility` — AI search visibility score, query results, competitor presence, run check
- `/growth/activity` — Timeline activity feed with type filtering and icon/color coding

**Intelligence Discovery Hub (NEW March 24):**
- `/intelligence/discovery` — 3-panel layout: Jasper chat (left), findings grid (center), operation log (right)
- 9 Jasper discovery tools: list_discovery_sources, configure_source, start_operation, get_operation_status, get_findings_summary, convert_findings_to_leads, scrape_website, research_competitors, scan_tech_stack
- Source templates: FMCSA, State Business Filings, SAM.gov
- Multi-hop enrichment: Google → website → social → AI synthesis
- Approval workflow: approve/reject/bulk-approve, auto-approve above confidence threshold
- CRM integration: convert approved findings to leads (acquisitionMethod: 'intelligence_discovery'), CSV export
- Scheduled monitoring: cron every 6h for active sources
- 11 API routes under `/api/intelligence/discovery/`

**AI Workforce:**
- `/mission-control` (NEW Sprint 18 — 3-panel live delegation tracker: sidebar, timeline, step detail)
- `/mission-control/history` (NEW Sprint 18 — paginated completed mission table)

**Settings (21 sub-routes):**
- `api-keys`, `accounting`, `storefront`, `promotions`
- `email-templates`, `sms-messages`, `theme`, `users`
- `security`, `integrations` (NEW Apr 30 — Zoom User-OAuth card with two-step disconnect; existing OAuth providers list also surfaced here), `webhooks`, `custom-tools`, `workflows`
- `lead-routing`, `meeting-scheduler` (REAL IMPL Apr 30 — per-day availability config UI), `scheduling-messages` (NEW Apr 30 — 8 editable templates with `{firstName}`/`{meetingDate}`/`{meetingTime}`/`{duration}`/`{zoomLink}`/`{orgName}`/`{operatorName}` variables)
- `features` (5 tabs: Your Business → Features → CRM Entities → API Keys → Summary)
- `ai-agents/*` (6 routes: hub, business-setup, configuration, persona, training, voice)

> **Note:** `/settings/billing` and `/settings/subscription` pages exist with subscription management UI. `/settings/organization` removed (single-tenant).

**Website Builder:**
- `/website/editor`, `/website/pages`, `/website/domains`, `/website/seo`, `/website/seo/competitors`
- `/website/settings`, `/website/templates`, `/website/navigation`, `/website/audit-log`
- `/website/blog`, `/website/blog/categories`, `/website/blog/editor`

**Website Migration Pipeline (Sprint 21):**
- Deep scraper with section-level extraction (`src/lib/website/deep-scraper.ts`)
- AI-powered Site Blueprint Extractor (`src/lib/website/site-blueprint-extractor.ts`)
- Full migration orchestration service with mission events (`src/lib/website/site-migration-service.ts`)
- Jasper tool: `migrate_website` — natural-language "clone this site" delegation

### Dashboard Sub-Routes (16 in /dashboard/*)

```
/dashboard/analytics                # Workspace analytics [FULL - 278 lines]
/dashboard/coaching                 # Coaching hub
/dashboard/coaching/team            # Team coaching
/dashboard/conversation             # Conversation intelligence
/dashboard/marketing/email          # Email marketing
/dashboard/marketing/social         # Social marketing
/dashboard/performance              # Performance metrics
/dashboard/playbook                 # Sales playbook
/dashboard/risk                     # Risk management
/dashboard/routing                  # Lead routing
/dashboard/sales/deals              # Deals pipeline
/dashboard/sales/leads              # Leads management
/dashboard/sequence                 # Sequence management
/dashboard/settings                 # Settings
/dashboard/swarm                    # AI swarm control
/dashboard/system                   # Admin hub [FULL - 203 lines]
```

### Public Routes (16)

```
/(public)/                          # Landing page
/(public)/about                     # About page
/(public)/blog                      # Blog
/(public)/contact                   # Contact form
/(public)/demo                      # Demo request
/(public)/docs                      # Documentation
/(public)/f/[formId]                # Public form submission
/(public)/faq                       # FAQ
/(public)/features                  # Features
/(public)/forgot-password           # Password reset
/(public)/login                     # User login
/(public)/pricing                   # Pricing page
/(public)/privacy                   # Privacy policy
/(public)/security                  # Security page
/(public)/signup                    # User signup
/(public)/terms                     # Terms of service
```

### Route Issues

No open route issues. All previously identified stub pages and duplicate destinations have been resolved.

---

## Agent Registry

### Agent Swarm Overview

**Total Agents:** 72 (1 L1 orchestrator + 10 L2 managers + 57 L3 specialists + 4 standalone) — counts authoritative from auto-generated `src/lib/agents/agent-registry.ts` (regenerate via `npx tsx scripts/generate-agent-registry.ts`; CI fails on drift).
- **Master Orchestrator (L1):** 1 — Swarm CEO
- **Department Managers (L2):** 10 — Architect, Builder, Commerce, Content, Intelligence, Marketing, **Operations** (NEW Apr 30), Outreach, Reputation, Revenue Director. Master Orchestrator skipped by design (it delegates to managers, not specialists).
- **Specialists (L3):** 57 — all real LLM-backed agents with Firestore Golden Masters. Includes the new **SCHEDULING_SPECIALIST** under Operations.
- **Standalone (4):** Jasper (orchestrator/chat brain), AI Chat Sales Agent (Alex), Voice Agent Handler, Autonomous Posting Agent.

Note: 6 Claude Code QA agents exist in `.claude/agents/` but those are development-time tools for running audits, not production agents in the platform. They are NOT counted in the 72.

| Status | Count | Description |
|--------|-------|-------------|
| FUNCTIONAL (Swarm) | 46 | **100% SWARM COMPLETION** - All agents fully operational |
| FUNCTIONAL (Standalone) | 6 | Jasper (Internal Assistant), Voice Agent, Autonomous Posting Agent, Chat Session Service, AI Chat Sales Agent, Growth Strategist |
| FUNCTIONAL (Claude Code QA) | 6 | qa-data-integrity, qa-growth-outreach, qa-platform-infrastructure, qa-revenue-commerce, saas-architect, saas-auditor |
| GHOST | 0 | All specialists have been implemented |

### Master Orchestrator (1) - L1 Swarm CEO

| Agent ID | Class Name | Domain | Status | Notes |
|----------|------------|--------|--------|-------|
| MASTER_ORCHESTRATOR | MasterOrchestrator | Swarm Coordination | FUNCTIONAL | **Swarm CEO** - 2000+ LOC implementing Command Pattern for task dispatching, Saga Pattern for multi-manager workflows with compensation, processGoal() hierarchical task decomposition, intent-based domain routing engine with 9 intent categories, cross-domain synchronization with dependency graph resolution, getSwarmStatus() global state aggregation from all 9 managers, MemoryVault integration for goal insights |

### Managers (10) - L2 Orchestrators

| Agent ID | Class Name | Domain | Status | Notes |
|----------|------------|--------|--------|-------|
| INTELLIGENCE_MANAGER | IntelligenceManager | Research & Analysis | FUNCTIONAL | Dynamic orchestration engine with parallel execution, graceful degradation |
| MARKETING_MANAGER | MarketingManager | Social & Ads | FUNCTIONAL | **Industry-agnostic Cross-Channel Commander** - 1200+ LOC with dynamic specialist resolution (6 specialists: TIKTOK_EXPERT, TWITTER_X_EXPERT, FACEBOOK_ADS_EXPERT, LINKEDIN_EXPERT, SEO_EXPERT, GROWTH_ANALYST), Brand DNA integration, SEO-social feedback loop, intelligence signal wiring (TREND_SCOUT, SENTIMENT_ANALYST), GROWTH_LOOP orchestration cycle, OPPORTUNISTIC/CRISIS_RESPONSE/AMPLIFICATION modes, parallel execution |
| BUILDER_MANAGER | BuilderManager | Site Building | FUNCTIONAL | **Autonomous Construction Commander** - 1650+ LOC with dynamic specialist resolution (3 specialists: UX_UI_ARCHITECT, FUNNEL_ENGINEER, ASSET_GENERATOR), Blueprint-to-Deployment workflow, pixel injection (GA4, GTM, Meta Pixel, Hotjar), build state machine (PENDING_BLUEPRINT → ASSEMBLING → INJECTING_SCRIPTS → DEPLOYING → LIVE), Vercel deployment manifest generation, SignalBus `website.build_complete` broadcast, parallel execution, graceful degradation |
| COMMERCE_MANAGER | CommerceManager | E-commerce | FUNCTIONAL | **Transactional Commerce Commander** - 1400+ LOC with dynamic specialist resolution (4 specialists: PAYMENT_SPECIALIST, CATALOG_MANAGER, PRICING_STRATEGIST, INVENTORY_MANAGER), Product-to-Payment checkout orchestration, CommerceBrief revenue synthesis (Transaction Volume), MemoryVault tax/currency settings, parallel execution, graceful degradation |
| OUTREACH_MANAGER | OutreachManager | Email & SMS | FUNCTIONAL | **Omni-Channel Communication Commander** - 1900+ LOC with dynamic specialist resolution (EMAIL_SPECIALIST, SMS_SPECIALIST), Multi-Step Sequence execution, channel escalation (EMAIL → SMS → VOICE), sentiment-aware routing via INTELLIGENCE_MANAGER, DNC compliance via MemoryVault, frequency throttling, quiet hours enforcement, SignalBus integration |
| CONTENT_MANAGER | ContentManager | Content Creation | FUNCTIONAL | **Multi-Modal Production Commander** - 1600+ LOC with dynamic specialist resolution (4 specialists: COPYWRITER, CALENDAR_COORDINATOR, VIDEO_SPECIALIST, ASSET_GENERATOR), TechnicalBrief consumption from ARCHITECT_MANAGER, Brand DNA integration (avoidPhrases, toneOfVoice, keyPhrases), SEO-to-Copy keyword injection, ContentPackage synthesis, validateContent() quality gate, SignalBus `content.package_ready` broadcast, parallel execution, graceful degradation |
| ARCHITECT_MANAGER | ArchitectManager | Site Architecture | FUNCTIONAL | **Strategic Infrastructure Commander** - 2100+ LOC with dynamic specialist resolution (3 specialists), Brand DNA integration, MemoryVault Intelligence Brief consumption, SiteArchitecture + TechnicalBrief synthesis, SignalBus `site.blueprint_ready` broadcast, parallel execution, graceful degradation |
| REVENUE_DIRECTOR | RevenueDirector | Sales Ops | FUNCTIONAL | **Sales Ops Commander** - 1800+ LOC with dynamic specialist resolution (5 specialists), Golden Master persona tuning, RevenueBrief synthesis, objection library battlecards, cross-agent signal sharing |
| REPUTATION_MANAGER | ReputationManager | Trust & Reviews | FUNCTIONAL | **Brand Defense Commander** - 2000+ LOC with dynamic specialist resolution (4 specialists: REVIEW_SPECIALIST, GMB_SPECIALIST, REV_MGR, CASE_STUDY), automated review solicitation from sale.completed signals, AI-powered response engine with star-rating strategies, GMB profile optimization coordination, ReputationBrief trust score synthesis, webhook.review.received signal handling, Review-to-Revenue feedback loop |
| OPERATIONS_MANAGER | OperationsManager | Scheduling & Calendar Integrity | FUNCTIONAL — **NEW April 30, 2026** | Scheduling-only manager. GM seeded as `mgm_operations_manager_saas_sales_ops_v1` with Brand DNA baked in. Capabilities: meeting_creation, meeting_rescheduling, meeting_cancellation, calendar_integrity, availability_enforcement, attendee_validation. Currently delegates to a single specialist (SCHEDULING_SPECIALIST). Routed via Jasper's `delegate_to_operations` tool with intent rules: operator picks the time, attendees must already exist in the CRM. Reads availability from per-day config service + writes meetings with `meetingProvider` discriminator. |

> **Note:** All 10 managers and the MASTER_ORCHESTRATOR are now FUNCTIONAL with complete specialist orchestration, cross-agent signal communication, and saga-based workflow coordination. **100% Swarm Completion achieved.**

### Specialists (57) - L3 Workers

> **Note (April 30, 2026):** This SSOT lists the historical core domain breakdowns below. The full authoritative list of all 57 specialists (with their parent manager and capabilities) lives in `src/lib/agents/agent-registry.ts` — it is auto-generated and CI fails on drift, so reference it for the canonical roster. Domains added since the original audit include all platform Experts (Bluesky, Discord, Facebook Ads, Google Business, Instagram, LinkedIn, Mastodon, Pinterest, Reddit, Telegram, Threads, TikTok, Twitch, Twitter/X, WhatsApp Business, YouTube), GROWTH_STRATEGIST, PAID_ADS_SPECIALIST, BLOG_WRITER, MUSIC_PLANNER, PODCAST_SPECIALIST, AI_CHAT_SALES_AGENT (under Revenue), VOICE_AI_SPECIALIST, PROMPT_ENGINEER (meta-specialist), and the new SCHEDULING_SPECIALIST under Operations.

#### Intelligence Domain (5)

| Agent ID | Class Name | Capabilities | Status |
|----------|------------|--------------|--------|
| COMPETITOR_RESEARCHER | CompetitorResearcher | Cross-comparative competitive intelligence (real Serper SERP + DataForSEO + scraper, single multi-competitor LLM synthesis) | FUNCTIONAL — Task #63 rebuild |
| SENTIMENT_ANALYST | SentimentAnalyst | 5-action LLM sentiment analyst (analyze_sentiment, analyze_bulk, track_brand, detect_crisis, analyze_trend) via discriminated union schemas | FUNCTIONAL — Task #65 rebuild |
| TECHNOGRAPHIC_SCOUT | TechnographicScout | Hybrid 60-signature regex tech detection + LLM strategic interpretation (maturity, spend estimation, integration opportunities, sales intelligence) | FUNCTIONAL — Task #64 rebuild |
| SCRAPER_SPECIALIST | ScraperSpecialist | Hybrid LLM analyst over real `scrapeWebsite`/`scrapeAboutPage`/`scrapeCareersPage` collectors; produces structured ScrapeAnalysisResult (industry, valueProposition, targetCustomer, strategicObservations) | FUNCTIONAL — Task #62 rebuild |
| TREND_SCOUT | TrendScout | Hybrid LLM signal synthesis on top of real Serper/News/DataForSEO/LinkedIn/Crunchbase collectors; produces market sentiment + ranked pivot recommendations grounded in specific signal IDs | FUNCTIONAL — Task #66 rebuild |

#### Marketing Domain (6)

| Agent ID | Class Name | Capabilities | Status |
|----------|------------|--------------|--------|
| TIKTOK_EXPERT | TikTokExpert | Viral content, trends, LISTEN/ENGAGE | FUNCTIONAL |
| TWITTER_EXPERT | TwitterExpert | Threads, engagement, LISTEN/ENGAGE | FUNCTIONAL |
| FACEBOOK_EXPERT | FacebookAdsExpert | Ad copy, targeting, LISTEN/ENGAGE | FUNCTIONAL |
| LINKEDIN_EXPERT | LinkedInExpert | B2B posts, outreach, LISTEN/ENGAGE | FUNCTIONAL |
| SEO_EXPERT | SEOExpert | Keywords, optimization, **domain analysis** (traffic, backlinks, referring domains, competitors), crawl analysis, keyword gap, 30-day strategy | FUNCTIONAL |
| GROWTH_ANALYST | GrowthAnalyst | Performance analytics, KPIs, mutation directives, content library, weekly reports | FUNCTIONAL |

#### Builder Domain (4)

| Agent ID | Class Name | Capabilities | Status |
|----------|------------|--------------|--------|
| UX_UI_ARCHITECT | UxUiArchitect | Interface design | FUNCTIONAL |
| FUNNEL_ENGINEER | FunnelEngineer | Conversion funnels | FUNCTIONAL |
| ASSET_GENERATOR | AssetGenerator | Graphics, assets | FUNCTIONAL |
| WORKFLOW_OPTIMIZER | WorkflowOptimizer | Process automation | FUNCTIONAL |

#### Architect Domain (3)

| Agent ID | Class Name | Capabilities | Status |
|----------|------------|--------------|--------|
| UX_UI_STRATEGIST | UXUISpecialist | Site UX/UI (strategic design direction) | FUNCTIONAL |
| FUNNEL_STRATEGIST | FunnelPathologist | Funnel analysis (strategic diagnosis) | FUNCTIONAL |
| COPY_STRATEGIST | CopySpecialist | Website copy (strategic messaging direction) | FUNCTIONAL |

> **Implementation Details:** Manager orchestration logic (pipelines, signal broadcasting, specialist coordination) is documented in the source code. See each manager's `manager.ts` file for details.

#### Commerce Domain (4)

| Agent ID | Class Name | Capabilities | Status |
|----------|------------|--------------|--------|
| PAYMENT_SPECIALIST | PaymentSpecialist | Checkout sessions, payment intents, refunds | FUNCTIONAL |
| CATALOG_MANAGER | CatalogManagerSpecialist | Product CRUD, variants, search | FUNCTIONAL |
| PRICING_STRATEGIST | PricingStrategist | Dynamic pricing, discounts, totals | FUNCTIONAL |
| INVENTORY_MANAGER | InventoryManagerAgent | Stock management, demand forecasting | FUNCTIONAL |

> Commerce orchestration details in `src/lib/agents/commerce/manager.ts`.

#### Outreach Domain (2)

| Agent ID | Class Name | Capabilities | Status |
|----------|------------|--------------|--------|
| EMAIL_SPECIALIST | EmailSpecialist | Email campaigns | FUNCTIONAL |
| SMS_SPECIALIST | SmsSpecialist | SMS outreach | FUNCTIONAL |

> Outreach orchestration details in `src/lib/agents/outreach/manager.ts`.

#### Operations Domain (1) — NEW April 30, 2026

| Agent ID | Class Name | Capabilities | Status |
|----------|------------|--------------|--------|
| SCHEDULING_SPECIALIST | SchedulingSpecialist | `create_meeting`, `reschedule_meeting`, `cancel_meeting` — checks per-day availability config, validates attendees against CRM, writes meeting record with `meetingProvider` discriminator (zoom/google_meet/teams/none), composes confirmation/reminder copy from editable scheduling-messages templates | FUNCTIONAL — Stage 1–6 rebuild (Apr 30) |

> Operations orchestration details in `src/lib/agents/operations/manager.ts`. GM: `sgm_scheduling_specialist_saas_sales_ops_v1`. Source files: `src/lib/agents/operations/scheduling/specialist.ts`, `src/lib/meetings/scheduler-engine.ts`, `src/lib/calendar/event-aggregator.ts`.

#### Content Domain (3)

| Agent ID | Class Name | Capabilities | Status |
|----------|------------|--------------|--------|
| COPYWRITER | Copywriter | Marketing copy (real LLM, Sonnet 4.6, Firestore GM) | FUNCTIONAL — Task #23 rebuild |
| CALENDAR_COORDINATOR | CalendarCoordinator | Multi-platform publishing schedules with dual date mode (explicit or AI-determined) (real LLM, Sonnet 4.6, Firestore GM, single action `plan_calendar`) | FUNCTIONAL — Task #25 rebuild |
| VIDEO_SPECIALIST | VideoSpecialist | Shot-by-shot storyboards (real LLM, Sonnet 4.6, Firestore GM, single action `script_to_storyboard`) | FUNCTIONAL — Task #24 rebuild |

#### Sales Domain (5)

| Agent ID | Class Name | Capabilities | Status |
|----------|------------|--------------|--------|
| MERCHANDISER | MerchandiserSpecialist | Product merchandising | FUNCTIONAL |
| OUTREACH_SPECIALIST | OutreachSpecialist | Sales outreach | FUNCTIONAL |
| LEAD_QUALIFIER | LeadQualifierSpecialist | Lead scoring | FUNCTIONAL |
| DEAL_CLOSER | DealCloserSpecialist | Closing strategies | FUNCTIONAL |
| OBJ_HANDLER | ObjectionHandlerSpecialist | Objection handling | FUNCTIONAL |

> Revenue Director tuning logic details in `src/lib/agents/sales/revenue/manager.ts`.

#### Trust Domain (4)

| Agent ID | Class Name | Capabilities | Status |
|----------|------------|--------------|--------|
| GMB_SPECIALIST | GMBSpecialist | Google My Business, local SEO | FUNCTIONAL |
| REVIEW_SPECIALIST | ReviewSpecialist | Review management | FUNCTIONAL |
| REV_MGR | ReviewManagerSpecialist | Review response | FUNCTIONAL |
| CASE_STUDY | CaseStudyBuilderSpecialist | Case study creation | FUNCTIONAL |

> Reputation Manager orchestration details in `src/lib/agents/trust/reputation/manager.ts`.

### Standalone Agents (4) - Outside Swarm Hierarchy

> **Note:** As of the auto-generated `agent-registry.ts`, only 4 agents carry tier `STANDALONE`: Jasper, Voice Agent Handler, Autonomous Posting Agent, and Chat Session Service. AI Chat Sales Agent (Alex) was reclassified as an L3 specialist under REVENUE_DIRECTOR (`AI_CHAT_SALES_AGENT`) and Growth Strategist as an L3 under MARKETING_MANAGER (`GROWTH_STRATEGIST`) — both still appear in the table below for backward-compatibility narrative, but their authoritative tier classification is L3.

These agents operate independently of the L1/L2/L3 swarm hierarchy:

| Agent | Type | Path | Status | Description |
|-------|------|------|--------|-------------|
| Jasper | Internal AI Assistant & Swarm Commander | Firestore `goldenMasters/` + `src/lib/orchestrator/jasper-tools.ts` | FUNCTIONAL | Jasper — the founder's internal AI assistant and swarm commander. **55 tools** across delegation, intelligence, content, video, and platform categories. Delegates to all 10 domain managers via `delegate_to_*` tools (incl. **`delegate_to_operations`** NEW Apr 30 — operator picks the time, attendees must already exist in CRM). Video: `produce_video`, `assemble_video`, `edit_video` (opens Standalone Video Editor, pre-loads clips), `manage_media_library` (list/search/add media assets with type/category filters). Does NOT handle customer-facing sales (that's the AI Chat Sales Agent). Relays Growth Strategist briefings. |
| AI Chat Sales Agent (Alex) | Customer-Facing Sales Agent — REAL LLM (Task #59) | `src/lib/agents/sales-chat/specialist.ts` | FUNCTIONAL | Customer-facing AI sales agent. Pure LLM specialist with a single action `respond_to_visitor` that produces both a conversational reply AND a structured intent/qualification/nextAction/rationale in one LLM call. REQUIRED Golden Master — refuses to run until `scripts/seed-sales-chat-agent-gm.js` has been executed against Firestore. Stateless (optional caller-provided `conversationHistory` + `priorQualification`). Two independent GM paths: **(1)** the JSON-output-mode specialist GM (`specialistGoldenMasters/sgm_ai_chat_sales_agent_saas_sales_ops_v1`) consumed by Jasper's `routeSalesChatAgent` delegation; **(2)** the free-form conversational Training Lab GM (`goldenMasters/gm_sales_chat_v1`) seeded via `/api/training/seed-sales-chat-gm` and consumed by the website chat widget (`/api/chat/public`) + Facebook Messenger (`/api/chat/facebook`) via `AgentInstanceManager`. Both paths coexist and serve different callers. |
| Growth Strategist | Chief Growth Officer | `src/lib/agents/growth-strategist/specialist.ts` | FUNCTIONAL | Cross-domain business intelligence agent. Aggregates data from all analytics sources (revenue, SEO, social, email, pipeline). Produces strategic directives for domain managers. Briefings accessible through Jasper. Data aggregator: `src/lib/agents/growth-strategist/data-aggregator.ts`. |
| Voice Agent Handler | Voice AI Agent | `src/lib/voice/voice-agent-handler.ts` | FUNCTIONAL | Hybrid AI/human voice agent with two modes: **Prospector** (lead qualification) and **Closer** (deal closing with warm transfer). API routes: `src/app/api/voice/ai-agent/` |
| Autonomous Posting Agent | Social Media Automation | `src/lib/social/autonomous-posting-agent.ts` | FUNCTIONAL | `postToPlatform()` routes to 14 platforms via switch statement (lines 862-1037): Twitter, LinkedIn, Facebook, Instagram, YouTube, TikTok, Bluesky, Threads, Truth Social, Telegram, Reddit, Pinterest, WhatsApp Business, Google Business. Each platform has a real service with proper API calls. Only Nextdoor and Rumble are unsupported (return error). |
| Chat Session Service | Agent Infrastructure | `src/lib/agent/chat-session-service.ts` | FUNCTIONAL | Manages real-time AI chat sessions and agent instance lifecycle. `AgentInstanceManager` (`src/lib/agent/instance-manager.ts`) handles ephemeral agent instances spawned from Golden Masters. Supports `agentType` parameter for Golden Master selection. |

### Agent File Locations

```
src/lib/agents/
├── index.ts                    # Swarm registry & exports
├── types.ts                    # Agent type definitions
├── base-specialist.ts          # Base specialist class
├── base-manager.ts             # Base manager class
├── orchestrator/
│   └── manager.ts              # MASTER_ORCHESTRATOR (Swarm CEO) - L1 Orchestrator
├── shared/
│   ├── index.ts
│   └── memory-vault.ts  # Cross-agent memory
├── intelligence/
│   ├── manager.ts
│   ├── competitor/specialist.ts
│   ├── sentiment/specialist.ts
│   ├── technographic/specialist.ts
│   ├── scraper/specialist.ts
│   └── trend/specialist.ts
├── marketing/
│   ├── manager.ts
│   ├── tiktok/specialist.ts
│   ├── twitter/specialist.ts
│   ├── facebook/specialist.ts
│   ├── linkedin/specialist.ts
│   └── seo/specialist.ts
├── builder/
│   ├── manager.ts
│   ├── ux-ui/specialist.ts
│   ├── funnel/specialist.ts
│   ├── assets/specialist.ts
│   └── workflow/specialist.ts
├── architect/
│   ├── manager.ts
│   ├── ux-ui/specialist.ts
│   ├── funnel/specialist.ts
│   └── copy/specialist.ts
├── commerce/
│   ├── manager.ts
│   ├── payment/specialist.ts
│   ├── subscription/specialist.ts
│   ├── catalog/specialist.ts
│   ├── pricing/specialist.ts
│   └── inventory/specialist.ts
├── outreach/
│   ├── manager.ts
│   ├── email/specialist.ts
│   └── sms/specialist.ts
├── content/
│   ├── manager.ts
│   ├── copywriter/specialist.ts
│   ├── calendar/specialist.ts
│   └── video/specialist.ts
├── sales/
│   ├── revenue/manager.ts
│   ├── merchandiser/specialist.ts
│   ├── outreach/specialist.ts
│   ├── qualifier/specialist.ts
│   ├── deal-closer/specialist.ts
│   └── objection-handler/specialist.ts
└── trust/
    ├── reputation/manager.ts
    ├── gmb/
    │   ├── index.ts
    │   ├── specialist.ts
    │   └── README.md
    ├── review/specialist.ts
    ├── review-manager/specialist.ts
    └── case-study/specialist.ts

# Standalone Agent Files (outside swarm)
src/lib/orchestrator/jasper-tools.ts          # Jasper internal AI assistant tools
src/lib/agents/sales-chat/specialist.ts       # AI Chat Sales Agent (customer-facing)
src/lib/agents/growth-strategist/specialist.ts # Growth Strategist (Chief Growth Officer)
src/lib/agents/growth-strategist/data-aggregator.ts # Cross-domain data aggregation
src/lib/voice/voice-agent-handler.ts          # Voice AI Agent (Prospector/Closer)
src/lib/social/autonomous-posting-agent.ts    # Autonomous Social Posting
src/lib/agent/chat-session-service.ts         # Chat Session Service
src/lib/agent/instance-manager.ts             # Agent Instance Manager
src/app/api/chat/facebook/route.ts            # Facebook Messenger webhook
```

---

## Unified RBAC Matrix

### Role Hierarchy (4-Role RBAC — Phase 11)

| Role | Level | Description |
|------|-------|-------------|
| `owner` | 3 | Master key — full system access, can delete org, impersonate users |
| `admin` | 2 | Full access minus org deletion and user impersonation |
| `manager` | 1 | Team lead — CRM, marketing, sales, limited user/data management |
| `member` | 0 | Individual contributor — own records, limited read access |

**Source of Truth:** `src/types/unified-rbac.ts` — `UNIFIED_ROLE_PERMISSIONS` constant
**Legacy Compatibility:** `src/types/permissions.ts` re-exports from unified-rbac.ts (31-field subset)

### Permission Categories (4-Role RBAC)

#### Platform Administration (8 permissions)

| Permission | owner | admin | manager | member |
|------------|-------|-------|---------|--------|
| canAccessPlatformAdmin | YES | YES | - | - |
| canManageAllOrganizations | YES | YES | - | - |
| canViewSystemHealth | YES | YES | - | - |
| canManageFeatureFlags | YES | YES | - | - |
| canViewAuditLogs | YES | YES | - | - |
| canManageSystemSettings | YES | YES | - | - |
| canImpersonateUsers | YES | - | - | - |
| canAccessSupportTools | YES | YES | - | - |

#### Organization Management (5 permissions)

| Permission | owner | admin | manager | member |
|------------|-------|-------|---------|--------|
| canManageOrganization | YES | YES | - | - |
| canManageBilling | YES | YES | - | - |
| canManageAPIKeys | YES | YES | - | - |
| canManageTheme | YES | YES | YES | - |
| canDeleteOrganization | YES | - | - | - |

#### User Management (4 permissions)

| Permission | owner | admin | manager | member |
|------------|-------|-------|---------|--------|
| canInviteUsers | YES | YES | YES | - |
| canRemoveUsers | YES | YES | - | - |
| canChangeUserRoles | YES | YES | - | - |
| canViewAllUsers | YES | YES | YES | - |

#### Data Management (7 permissions)

| Permission | owner | admin | manager | member |
|------------|-------|-------|---------|--------|
| canCreateSchemas | YES | YES | - | - |
| canEditSchemas | YES | YES | YES | - |
| canDeleteSchemas | YES | YES | - | - |
| canExportData | YES | YES | YES | YES |
| canImportData | YES | YES | YES | - |
| canDeleteData | YES | YES | - | - |
| canViewAllRecords | YES | YES | YES | - |

#### CRM Operations (5 permissions)

| Permission | owner | admin | manager | member |
|------------|-------|-------|---------|--------|
| canCreateRecords | YES | YES | YES | YES |
| canEditRecords | YES | YES | YES | YES |
| canDeleteRecords | YES | YES | YES | - |
| canViewOwnRecordsOnly | - | - | - | YES |
| canAssignRecords | YES | YES | YES | - |

#### Workflows & Automation (3 permissions)

| Permission | owner | admin | manager | member |
|------------|-------|-------|---------|--------|
| canCreateWorkflows | YES | YES | YES | - |
| canEditWorkflows | YES | YES | YES | - |
| canDeleteWorkflows | YES | YES | - | - |

#### AI Agents & Swarm (4 permissions)

| Permission | owner | admin | manager | member |
|------------|-------|-------|---------|--------|
| canTrainAIAgents | YES | YES | YES | - |
| canDeployAIAgents | YES | YES | YES | - |
| canManageAIAgents | YES | YES | - | - |
| canAccessSwarmPanel | YES | YES | YES | - |

#### Marketing (3 permissions)

| Permission | owner | admin | manager | member |
|------------|-------|-------|---------|--------|
| canManageSocialMedia | YES | YES | YES | - |
| canManageEmailCampaigns | YES | YES | YES | - |
| canManageWebsite | YES | YES | YES | - |

#### Sales (5 permissions)

| Permission | owner | admin | manager | member |
|------------|-------|-------|---------|--------|
| canViewLeads | YES | YES | YES | YES |
| canManageLeads | YES | YES | YES | - |
| canViewDeals | YES | YES | YES | YES |
| canManageDeals | YES | YES | YES | - |
| canAccessVoiceAgents | YES | YES | YES | - |

#### Reports & Analytics (4 permissions)

| Permission | owner | admin | manager | member |
|------------|-------|-------|---------|--------|
| canViewReports | YES | YES | YES | YES |
| canCreateReports | YES | YES | YES | - |
| canExportReports | YES | YES | YES | - |
| canViewPlatformAnalytics | YES | YES | YES | - |

#### Settings (2 permissions)

| Permission | owner | admin | manager | member |
|------------|-------|-------|---------|--------|
| canAccessSettings | YES | YES | YES | - |
| canManageIntegrations | YES | YES | - | - |

#### E-Commerce (3 permissions)

| Permission | owner | admin | manager | member |
|------------|-------|-------|---------|--------|
| canManageEcommerce | YES | YES | YES | - |
| canProcessOrders | YES | YES | YES | YES |
| canManageProducts | YES | YES | YES | - |

### Navigation Section Visibility (9 Sections — 4-Role RBAC)

**9 Consolidated Sections** in `AdminSidebar.tsx` (permission-gated per role via `filterNavigationByRole()`):

| Section | owner | admin | manager | member | Key Permission |
|---------|-------|-------|---------|--------|----------------|
| 1. Home | YES | YES | YES | YES | - |
| 2. CRM | YES | YES | YES | YES* | canViewLeads, canViewDeals |
| 3. Outreach | YES | YES | YES | - | canManageLeads, canManageEmailCampaigns |
| 4. Content | YES | YES | YES | - | canManageSocialMedia |
| 5. AI Workforce | YES | YES | YES | - | canDeployAIAgents, canTrainAIAgents |
| 6. Commerce | YES | YES | YES | YES* | canProcessOrders |
| 7. Website | YES | YES | YES | - | canManageWebsite |
| 8. Analytics | YES | YES | YES | YES* | canViewReports |
| 9. System | YES | - | - | - | owner-only |

**Footer items** (Settings, Academy) visible to all roles. Settings hub page internally gates Compliance & Admin items to owner/admin via `canManageOrganization`.

*Member sees limited items based on specific permissions

### RBAC Source Files

- **Definitions:** `src/types/unified-rbac.ts` (single source of truth)
- **Legacy re-export:** `src/types/permissions.ts` (thin compatibility layer)
- **Sidebar filtering:** `src/components/admin/AdminSidebar.tsx` → `filterNavigationByRole()`
- **API middleware:** `src/lib/auth/api-auth.ts` → `requireRole()`
- **Claims mapping:** `src/lib/auth/claims-validator.ts` → `validateRole()`
- **Client hooks:** `src/hooks/useUnifiedAuth.ts`, `src/hooks/useAuth.ts`

---

## Security Audit Findings

### Authentication Flow

#### Client-Side (`useUnifiedAuth` hook)

```
1. Firebase user signs in
   ↓
2. Get Firebase ID token
   ↓
3. Check Firestore USERS collection
   ├─ If document exists → Load user profile
   │  └─ Extract role (owner|admin|manager|member)
   └─ If document missing → User is unauthenticated
   ↓
4. Set permissions via getUnifiedPermissions(role)
   ↓
5. Return UnifiedUser + UnifiedPermissions
```

#### Server-Side (`src/lib/auth/api-auth.ts`)

```
1. Extract Bearer token from Authorization header
   ↓
2. Verify token using Firebase Admin SDK
   ↓
3. Extract custom claims from decoded token
   ├─ role, admin flag
   ↓
4. If no role in claims → Try Firestore lookup
   ├─ Check USERS collection for user document
   ↓
5. Return AuthenticatedUser with uid, email, role
   ↓
6. Route-level checks (requireRole) enforce access
```

### API Protection Functions

| Function | Purpose | Returns |
|----------|---------|---------|
| `requireAuth(request)` | Basic authentication | 401 if invalid token |
| `requireRole(request, allowedRoles[])` | Role-based access (4-role RBAC) | 403 if role not in whitelist |
| `optionalAuth(request)` | Non-blocking authentication | User or null |

### Client-Side Auth Pattern (`useAuthFetch` hook)

**File:** `src/hooks/useAuthFetch.ts`

All client-side API calls MUST use `authFetch()` instead of bare `fetch()`. The hook automatically attaches the Firebase Bearer token via the `useUnifiedAuth` hook's `getIdToken()`.

```typescript
const authFetch = useAuthFetch();
const res = await authFetch('/api/some-endpoint');
```

**Coverage (as of Session 33):** All 65 dashboard pages and components use `authFetch`. The intentionally unauthenticated client calls are `PublicLayout.tsx → /api/chat/public` (public chatbot widget, now powered by AI Chat Sales Agent Golden Master) and `/api/chat/facebook` (Facebook Messenger webhook).

### Security Strengths

| Strength | Implementation | Files |
|----------|----------------|-------|
| Single-Tenant Security | All requests operate under DEFAULT_ORG_ID | `claims-validator.ts`, `api-auth.ts` |
| 4-Role RBAC | owner/admin/manager/member with differentiated permission matrices | `unified-rbac.ts` |
| Token Verification | Firebase Admin SDK validates ID tokens server-side | `api-auth.ts` |
| Layout-Level Auth | Admin routes protected at layout level before render | `admin/layout.tsx` |
| Permission Matrix | Comprehensive 53-permission definitions per role | `unified-rbac.ts` |
| Client-Side Auth | All dashboard fetch calls use `useAuthFetch` with Bearer tokens | `useAuthFetch.ts`, 65 consumer files |

### Security Concerns

**Resolved Issues (9 total):** All CRITICAL security findings have been resolved — 82 unprotected API routes hardened (Session 4), OAuth CSRF + encryption fixed (Session 9), rate limiting + CAPTCHA enforced (Session 9), CAN-SPAM unsubscribe route created (Session 9), 53 bare fetch calls migrated to `authFetch` (Session 33), system status auth handshake fixed (Jan 29). See git history for details.

**Phase 2 Hardening (March 20, 2026):**
- `set-claims` endpoint: expanded from admin-only to all 4 roles (owner/admin/manager/member)
- Mollie webhook: HMAC signature verification + rate limiting added
- Email send: `from` address domain allowlist (salesvelocity.ai, rapidcompliance.us)
- Rate limiting added to 5 admin routes: templates, scraper/start, test-api-connection, promotions, pricing-tiers
- Admin templates: auth pattern switched from `requireUserRole` to `verifyAdminRequest` for consistency
- Workflow Zod schemas: replaced 5x `z.record(z.unknown())` with strict typed schemas
- BaseAgentDAL: accepts both client and admin Firestore types (eliminated 7 unsafe casts)

**Remaining Open Issues:** None — all previously identified security issues are resolved. See git history for details.

### API Route Protection Summary

**Audit Date:** March 28, 2026
**Total Routes:** 436

| Protection Type | Count | Details |
|----------------|-------|---------|
| Standard auth (requireAuth, requireRole, etc.) | 366 (84%) | `requireAuth`, `requireRole`, `verifyAdminRequest`, `requirePermission`, manual `verifyIdToken` |
| Alternative auth (webhooks, cron, OAuth) | 50 (11%) | 19 webhook endpoints (HMAC signature verified), 13 cron endpoints (CRON_SECRET), 8 OAuth callbacks (state token validation), 10 other (Twilio sig, Basic Auth, Bearer token) |
| Intentionally public | 20 (5%) | Public web content (RSS, sitemap, robots.txt), health/version, public forms, email tracking pixels, invite validation, booking, public chat |
| Missing auth (security risk) | 0 (0%) | **All routes accounted for** |

**Auth systems in use:**
- `requireAuth` from `@/lib/auth/api-auth` — primary dashboard auth (verifies Firebase token, returns `{ user }` or 401)
- `requireRole` from `@/lib/auth/api-auth` — role-gated access (extends requireAuth with role check)
- `verifyAdminRequest` from `@/lib/api/admin-auth` — admin routes (token + admin role verification)
- `requireUserRole` from `@/lib/auth/server-auth` — server-side role enforcement
- Manual `getAuth(adminApp).verifyIdToken(token)` — used in workflows and lead-scoring routes

**Utility:** `scripts/find-unprotected.ps1` — PowerShell script to scan for routes missing auth patterns

**Utility:** `scripts/nuke-demo-data.ts` — Cleanup script that wipes ALL demo/seed data from Firestore. Covers 60+ collections across Parts 1-4 plus top-level `users`. Three-layer identification: `demo-` ID prefix, `isDemo: true` flag, `(Demo)` in names. Run with `--execute` to delete (dry-run by default).

#### Demo Data Seed Scripts (4 parts, ~290 documents total)

All demo data has `isDemo: true`, `demo-` prefixed IDs, and `(Demo)` in display names for clean removal.

| Script | Collections | Docs | Coverage |
|--------|-------------|------|----------|
| `scripts/seed-demo-account.ts` (Part 1) | 8 | ~85 | CRM: contacts, leads, deals, activities, products, email campaigns, nurture sequences, analytics |
| `scripts/seed-demo-account-part2.ts` (Part 2) | 16+ | ~65 | Platform: workflows, forms, pages, blog posts, social posts, orders, team tasks, site config |
| `scripts/seed-demo-account-part3.ts` (Part 3) | 32 | ~103 | Remaining: records, members, companies, schemas, sequences, chat sessions, users, playbooks, 20+ more |
| `scripts/seed-demo-account-part4.ts` (Part 4) | 15+ | ~82 | Growth Command Center, AI Workforce, team coaching, playbooks (correct shape), A/B tests, calls, video pipeline, battlecards |

**Part 4 collections:** `growthCompetitorProfiles`, `growthCompetitorSnapshots`, `growthKeywordRankings`, `growthStrategies`, `growthAiVisibility`, `growthActivityLog`, `teams`, `members` (+5), `conversationAnalyses` (+24), `users` (+5), `playbooks` (3 correct shape), `abTests`, `calls`, `video_pipeline_projects`, `agentRepProfiles`, `agentPerformance`, `specialistImprovementRequests`, `seoResearch` (+2 battlecards), `teamTasks` (+8)

**Pre-launch cleanup:** Run `npx tsx scripts/nuke-demo-data.ts --execute` to remove all demo data across all 4 parts.

### Admin Account Bootstrap

To properly configure an admin account, Firebase custom claims must be set:

```bash
# Run the bootstrap script (one-time setup)
node scripts/bootstrap-platform-admin.js
```

This script:
- Sets Firebase custom claims: `{ role: "admin", admin: true }`
- Updates Firestore user document with standardized role
- Verifies claims were successfully applied

**Note:** Custom claims provide the primary authentication mechanism. The 4-role RBAC system uses owner (level 3), admin (level 2), manager (level 1), and member (level 0).

### Protected Route Patterns

#### Middleware Routing (`src/middleware.ts`)

| Route Pattern | Authentication | Enforcement |
|---------------|----------------|-------------|
| `/admin/*` | Any user (layout enforces role) | Admin Layout |
| `/workspace/platform-admin/*` | N/A | 308 redirect to `/admin/*` |
| `/sites/*` | Not required | Middleware rewrite |
| `/api/*` | Skipped at middleware | Per-route enforcement |

#### Admin Layout Enforcement (`src/app/admin/layout.tsx`)

- Unauthenticated → `/admin-login`
- Non-admin role → `/(dashboard)/dashboard`
- Only admin-level users (owner or admin role) allowed through

### Public Routes (No Auth Required)

```
/                    # Landing page
/login               # User login
/admin-login         # Admin login
/signup              # User signup
/security            # Security page
/privacy             # Privacy policy
/terms               # Terms of service
```

### Files Containing RBAC Logic

**Authentication & Authorization:**
- `src/lib/auth/api-auth.ts` - API endpoint auth middleware
- `src/lib/auth/auth-service.ts` - Firebase auth operations
- `src/lib/auth/claims-validator.ts` - Claims-based authorization
- `src/lib/auth/server-auth.ts` - Server-side auth utilities

**Type Definitions:**
- `src/types/unified-rbac.ts` - Unified role/permission definitions
- `src/types/admin.ts` - Admin-specific types
- `src/types/permissions.ts` - Legacy permission types

**Client Hooks:**
- `src/hooks/useUnifiedAuth.ts` - Primary client-side auth hook
- `src/hooks/useAuth.ts` - Legacy auth hook (has demo mode)
- `src/hooks/useAdminAuth.ts` - Admin-specific auth hook

---

## Tooling Inventory

### API Routes (507 Total — Verified April 30, 2026)

| Category | Count | Path Pattern | Status |
|----------|-------|--------------|--------|
| Admin | 21 | `/api/admin/*` | Mostly functional |
| Analytics | 8 | `/api/analytics/*` | Functional |
| Agent | 4 | `/api/agent/*` | Partial |
| Battlecard | 4 | `/api/battlecard/*` | Functional |
| Billing | 3 | `/api/billing/*` | Functional |
| Campaigns | 4 | `/api/campaigns/*` | Functional (NEW March 15 — Campaign Orchestration Pipeline) |
| Coaching | 2 | `/api/coaching/*` | Functional |
| CRM | 9 | `/api/crm/*` | Functional |
| Cron | 4 | `/api/cron/*` | Functional (+3 Growth crons March 2) |
| Growth | 11 | `/api/growth/*` | Functional (NEW March 2) |
| Discovery | 1 | `/api/discovery/*` | Functional |
| E-commerce | 5 | `/api/ecommerce/*` | Functional (orders path fixed Feb 12) |
| Email | 4 | `/api/email-writer/*`, `/api/email/*` | Functional |
| Health | 2 | `/api/health/*` | Functional |
| Integrations | 18 | `/api/integrations/*` | Functional |
| Lead Scoring | 3 | `/api/lead-scoring/*` | Functional |
| Leads | 3 | `/api/leads/*` (icp, discovery, feedback) | Functional |
| Lead Research | 6 | `/api/leads/research/*` (chat, url-sources, schedule, schedule/run, export, root) | Functional (NEW March 5) |
| Learning | 2 | `/api/learning/*` | Partial |
| Meetings | 1 | `/api/meetings/*` | Functional |
| Onboarding | 3 | `/api/onboarding/*` | Functional (data prefill, status checklist) |
| Orchestrator | 7 | `/api/orchestrator/*` | Functional (Sprint 18: +missions, +missions/[missionId]; Sprint 23: +stream, +cancel) |
| Outbound | 3 | `/api/outbound/*` | Functional |
| Performance | 1 | `/api/performance/*` | Functional |
| Playbook | 1 | `/api/playbook/*` | Functional |
| Proposals | 1 | `/api/proposals/*` | Functional |
| Recovery | 1 | `/api/recovery/*` | Functional |
| Reports | 1 | `/api/reports/*` | Partial |
| Risk | 1 | `/api/risk/*` | Functional |
| Schemas | 6 | `/api/schema*/*` | Functional |
| SEO | 4 | `/api/seo/*` | Functional (domain-analysis, strategy, research GET/POST) |
| Settings | 1 | `/api/settings/webhooks` | Functional (NEW Feb 12) |
| Social | 15 | `/api/social/*` | Functional (EXPANDED Feb 13 — added agent-status, activity, OAuth auth/callback, accounts verify) |
| Team | 1 | `/api/team/tasks/[taskId]` | Functional (NEW Feb 12) |
| Other | ~120 | Various | Mixed |

### Key API Endpoints

#### Orchestrator (Jasper AI)

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/orchestrator/chat` | POST | Jasper conversation (now includes `missionId` in response metadata for delegation tracking) | FUNCTIONAL |
| `/api/orchestrator/missions` | POST/GET | Create mission + list missions (paginated, status filter) | FUNCTIONAL (Sprint 18) |
| `/api/orchestrator/missions/[missionId]` | GET | Get single mission for polling | FUNCTIONAL (Sprint 18) |
| `/api/orchestrator/missions/[missionId]/stream` | GET | SSE real-time mission streaming (Firestore onSnapshot) | FUNCTIONAL (Sprint 23) |
| `/api/orchestrator/missions/[missionId]/cancel` | POST | Cancel an active mission (sets FAILED + 'Cancelled by user') | FUNCTIONAL (Sprint 23) |
| `/api/orchestrator/system-health` | GET | System health | FUNCTIONAL |
| `/api/orchestrator/feature-toggle` | POST | Feature flags | FUNCTIONAL |

#### Admin Operations

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/admin/organizations` | GET/POST | Organization CRUD | FUNCTIONAL |
| `/api/admin/users` | GET | User listing | FUNCTIONAL |
| `/api/admin/provision` | POST | Provision new org | FUNCTIONAL |
| `/api/admin/platform-pricing` | GET/PUT | Pricing config | FUNCTIONAL |
| `/api/admin/platform-coupons` | GET/POST | Coupon management | FUNCTIONAL |

#### Entity & Feature Configuration (NEW Feb 28)

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/entity-config` | GET/PUT | CRM entity toggle config (auth required, Zod validated) | FUNCTIONAL |
| `/api/features` | GET/PUT | Feature module toggles | FUNCTIONAL |
| `/api/features/business-profile` | GET/PUT | Business profile for onboarding | FUNCTIONAL |

#### Voice & AI

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/voice/*` | Various | Voice agent operations (Twilio/Telnyx) | FUNCTIONAL |
| `/api/agent/config` | GET/PUT | Agent configuration | FUNCTIONAL |
| `/api/agent/knowledge/upload` | POST | Knowledge base upload | FUNCTIONAL |

#### Video & Voice Lab (25+ routes) — Hedra-Only, Phases 1-3 COMPLETE

**Current Status: FUNCTIONAL** — Hedra sole engine. Character Studio, AI Video Director, brand preference memory, Standalone Video Editor, and Media Library all operational.

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/video/avatar-profiles` | GET/POST | Character profile CRUD (lists user + stock Hedra profiles) | FUNCTIONAL |
| `/api/video/avatar-profiles/[profileId]` | GET/PATCH/DELETE | Single profile ops | FUNCTIONAL |
| `/api/video/avatar-profiles/sync-hedra` | POST | Import Hedra characters (auto-synced on picker mount) | FUNCTIONAL |
| `/api/video/avatar-profiles/hedra-characters` | GET | Browse Hedra character library | FUNCTIONAL |
| `/api/video/voices` | GET | List ElevenLabs voices | FUNCTIONAL |
| `/api/video/voice-clone` | POST | Clone voice via ElevenLabs | FUNCTIONAL |
| `/api/video/voice-preview` | POST | Preview TTS audio | FUNCTIONAL |
| `/api/video/defaults` | GET/PUT | Default avatar/voice settings | FUNCTIONAL |
| `/api/video/generate-scenes` | POST | Generate video scenes (Hedra-only, dual TTS paths) | FUNCTIONAL |
| `/api/video/regenerate-scene` | POST | Regenerate a single failed/rejected scene | FUNCTIONAL |
| `/api/video/poll-scenes` | POST | Poll generation status | FUNCTIONAL |
| `/api/video/decompose` | POST | Decompose script to scenes | FUNCTIONAL |
| `/api/video/assemble` | POST | FFmpeg clip assembly with xfade transitions | FUNCTIONAL |
| `/api/video/brand-preferences` | GET/POST | Brand preference memory (approved/rejected prompts, style corrections) | FUNCTIONAL |
| `/api/video/tts-audio` | POST | Synthesize TTS audio (ElevenLabs/UnrealSpeech) | FUNCTIONAL |
| `/api/video/grade-scene` | POST | Auto-grade a completed scene (download → ffmpeg audio → Deepgram transcription → LCS diff) | FUNCTIONAL |
| `/api/video/scene-review` | POST | Submit human review (1-5 stars + feedback) → Training Center pipeline | FUNCTIONAL |
| `/api/video/project/*` | Various | Video project CRUD (save, list, get) | FUNCTIONAL |

#### Media Library (NEW March 10)

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/media` | GET | List/search media assets with type and category filters (videos, images, audio with subcategories) | FUNCTIONAL |
| `/api/media` | POST | Upload and register a new media asset | FUNCTIONAL |
| `/api/media/[mediaId]` | GET | Retrieve a single media item by ID | FUNCTIONAL |
| `/api/media/[mediaId]` | DELETE | Delete a media item and its associated storage object | FUNCTIONAL |
| `/api/media/persist` | POST | Persist a media asset to Firestore (used by Magic Studio + content engine) | FUNCTIONAL (NEW Apr 30) |

#### Scheduling, Calendar & Zoom (NEW April 30)

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/integrations/zoom/auth` | GET | Initiate Zoom User-OAuth flow (PKCE, scope-locked) | FUNCTIONAL |
| `/api/integrations/zoom/callback` | GET | OAuth callback — exchanges code for tokens, writes per-integration doc, dual-writes summary into legacy `integrations/all` map for `/settings/integrations` UI compat | FUNCTIONAL |
| `/api/integrations/zoom/disconnect` | POST | Two-step disconnect — clears tokens + removes Zoom key from `integrations/all` map | FUNCTIONAL |
| `/api/calendar/events` | GET | Unified calendar feed — aggregates 5 sources (meetings, bookings, Google Calendar sync, scheduled posts, CRM activities) | FUNCTIONAL |
| `/api/booking` | GET/POST | Public booking endpoint. GET returns availability slots; POST creates booking + meeting record (Zoom or `meetingProvider: 'none'`) | FUNCTIONAL — POST upgrade Apr 30 |
| `/api/settings/scheduling-messages` | GET/PUT | Get / save the 8-field editable template doc at `organizations/{PLATFORM_ID}/settings/schedulingMessages` | FUNCTIONAL |

#### Content Engine — Music, Video, Asset Generation (NEW April 30)

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/content/music/generate` | POST | AI music generation via Replicate MusicGen (`src/lib/music/music-generation-service.ts`) | FUNCTIONAL |
| `/api/content/video/generate` | POST | Magic Studio video generation entry point | FUNCTIONAL |
| `/api/content/asset-generator/generate` | POST | Magic Studio image/asset generation entry point | FUNCTIONAL |
| `/api/video/editor/render` | POST | Standalone Video Editor render — FFmpeg-backed assembly with timeline trim/split, text overlays, color/transition effects | FUNCTIONAL |

#### Social Media Platform (NEW Feb 12)

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/social/accounts` | GET/POST/PUT/DELETE | Multi-account management | FUNCTIONAL |
| `/api/social/settings` | GET/PUT | Agent config tuning | FUNCTIONAL |
| `/api/social/media/upload` | POST | Media upload to Firebase Storage | FUNCTIONAL |
| `/api/social/media/[mediaId]` | GET/DELETE | Media retrieval and deletion | FUNCTIONAL |
| `/api/social/approvals` | GET/POST/PUT | Approval workflow management | FUNCTIONAL |
| `/api/social/calendar` | GET | Content calendar aggregation | FUNCTIONAL |
| `/api/social/listening` | GET/PUT | Social listening mentions | FUNCTIONAL |
| `/api/social/listening/config` | GET/PUT | Listening configuration | FUNCTIONAL |
| `/api/cron/social-listening-collector` | GET | Social listening cron job | FUNCTIONAL |
| `/api/social/agent-status` | GET/POST | Agent status dashboard + kill switch toggle | FUNCTIONAL (NEW Feb 13) |
| `/api/social/activity` | GET | Chronological activity feed from posts/approvals/queue | FUNCTIONAL (NEW Feb 13) |
| `/api/social/posts` | GET/POST/PUT/DELETE | Social post CRUD | FUNCTIONAL (existing) |
| `/api/social/oauth/auth/[provider]` | GET | Initiate OAuth flow (Twitter PKCE, LinkedIn OAuth 2.0) | FUNCTIONAL (NEW Session 6) |
| `/api/social/oauth/callback/[provider]` | GET | OAuth callback handler with token exchange + encryption | FUNCTIONAL (NEW Session 6) |
| `/api/social/accounts/verify` | POST | Verify social account connection status | FUNCTIONAL (NEW Session 6) |

#### Growth Command Center (NEW March 2)

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/growth/competitors` | GET/POST | List/add competitors | FUNCTIONAL |
| `/api/growth/competitors/discover` | POST | Discover competitors by niche via CompetitorResearcher | FUNCTIONAL |
| `/api/growth/competitors/[competitorId]` | GET/DELETE/POST | Get/remove/re-analyze competitor | FUNCTIONAL |
| `/api/growth/keywords` | GET/POST | List/add keywords for SERP tracking | FUNCTIONAL |
| `/api/growth/keywords/bulk` | POST | Bulk add keywords | FUNCTIONAL |
| `/api/growth/keywords/[keywordId]` | GET/DELETE/POST | Get/remove/check keyword ranking | FUNCTIONAL |
| `/api/growth/strategy` | GET/POST | Get latest / generate 3-tier growth strategy | FUNCTIONAL |
| `/api/growth/strategy/approve` | POST | Approve strategy tier → dispatches to Marketing Manager | FUNCTIONAL |
| `/api/growth/strategy/reject` | POST | Reject strategy with feedback | FUNCTIONAL |
| `/api/growth/ai-visibility` | GET/POST | AI search visibility history / run check | FUNCTIONAL |
| `/api/growth/activity` | GET | Activity feed with type filtering | FUNCTIONAL |
| `/api/cron/growth-keyword-tracker` | GET | Daily keyword ranking check (5AM UTC) | FUNCTIONAL |
| `/api/cron/growth-competitor-monitor` | GET | Weekly competitor scan (Mon 3AM UTC) | FUNCTIONAL |
| `/api/cron/growth-ai-visibility` | GET | Weekly AI visibility sweep (Wed 4AM UTC) | FUNCTIONAL |

#### Lead Research (NEW March 5)

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/leads/research/chat` | POST | AI chat with 8-tool lead research subset (Claude 3.5 Sonnet via OpenRouter) | FUNCTIONAL |
| `/api/leads/research/url-sources` | GET/POST/DELETE | CRUD for URL sources to scrape for business intelligence | FUNCTIONAL |
| `/api/leads/research/schedule` | GET/PUT | Research schedule config (frequency, auto-approve threshold) | FUNCTIONAL |
| `/api/leads/research/schedule/run` | POST | Manually trigger discovery batch using active ICP profile | FUNCTIONAL |
| `/api/leads/research/export` | GET | CSV export of batch results with field selection and status filtering | FUNCTIONAL |

**Lead Research Tools (8-tool subset):** `scan_leads` (Apollo free-tier org search), `enrich_lead`, `score_leads`, `scrape_website`, `research_competitors`, `scan_tech_stack` (from Jasper) + `update_icp_profile`, `add_url_source` (new). Defined in `src/lib/orchestrator/lead-research-tools.ts`. AI chat uses Claude 3.5 Sonnet via OpenRouter with 5 tool-calling rounds.

**Components (13):** `LeadResearchPage`, `ResearchChatPanel`, `ChatMessageList`, `ChatMessage`, `ChatInput`, `IcpSummaryBadge`, `ResearchControls`, `ResultsPanel`, `ResultCard`, `ResultsBulkActionBar`, `UrlSourcesPanel`, `UrlSourceItem`, `IcpSettingsDrawer` — all in `src/components/lead-research/`.

**Hook:** `src/hooks/useLeadResearch.ts` — centralized state for chat, ICP profiles, batches, results, URL sources, schedule, field selections, CSV export.

#### Intelligence Discovery Hub (NEW March 24)

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/intelligence/discovery/sources` | GET/POST | List sources + templates / Create source (from template or scratch) | FUNCTIONAL |
| `/api/intelligence/discovery/sources/[sourceId]` | GET/PUT/DELETE | CRUD for individual source configuration | FUNCTIONAL |
| `/api/intelligence/discovery/operations` | GET/POST | List operations / Create new scraping operation | FUNCTIONAL |
| `/api/intelligence/discovery/operations/[operationId]` | GET | Get operation detail + stats | FUNCTIONAL |
| `/api/intelligence/discovery/operations/[operationId]/findings` | GET | List findings for operation (paginated, filterable) | FUNCTIONAL |
| `/api/intelligence/discovery/findings/[findingId]` | GET/PATCH | Get finding detail / Update approval status | FUNCTIONAL |
| `/api/intelligence/discovery/findings/[findingId]/enrich` | POST | Trigger multi-hop enrichment (fire-and-forget async) | FUNCTIONAL |
| `/api/intelligence/discovery/findings/convert` | POST | Bulk convert approved findings to CRM leads | FUNCTIONAL |
| `/api/intelligence/discovery/findings/export` | GET | CSV export of findings (paginated, approval filter) | FUNCTIONAL |
| `/api/intelligence/discovery/actions` | GET | Audit log of discovery actions | FUNCTIONAL |
| `/api/intelligence/discovery/chat` | POST | AI chat with 9 discovery tools (Claude 3.5 Sonnet via OpenRouter) | FUNCTIONAL |
| `/api/cron/discovery-source-monitor` | GET | Scheduled source monitoring every 6h | FUNCTIONAL |

**Discovery Tools (9):** `list_discovery_sources`, `configure_source`, `start_operation`, `get_operation_status`, `get_findings_summary`, `convert_findings_to_leads`, `scrape_website`, `research_competitors`, `scan_tech_stack`. Defined in `src/lib/orchestrator/intelligence-discovery-tools.ts`.

**Services:** `discovery-service.ts` (CRUD), `discovery-source-service.ts` (sources + templates), `approval-service.ts` (auto-approve, stats), `lead-converter.ts` (finding → lead mapping, CSV export), `multi-hop-enricher.ts` (enrichment orchestration), `confidence-merger.ts` (cross-source confidence scoring).

**Components (8):** `DiscoveryHub`, `DiscoveryChatPanel`, `FindingsGrid`, `FindingRow`, `FindingsBulkActionBar`, `OperationLogPanel`, `ActionDetailDrawer`, `SourceConfigDrawer` — all in `src/components/intelligence-discovery/`.

**Hook:** `src/hooks/useIntelligenceDiscovery.ts` — centralized state for sources, operations, findings, selection, approval, enrichment, conversion, CSV export, and chat.

#### Website Migration Pipeline (NEW Sprint 21)

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/website/migrate` | POST | Website migration pipeline — clone external site via deep scrape, blueprint extraction, and AI page assembly | FUNCTIONAL (Sprint 21) |

#### SEO Research Persistence (NEW February 26, 2026)

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/api/seo/research` | GET | List saved SEO research (filter by type/domain, paginated) | FUNCTIONAL |
| `/api/seo/research` | POST | Save new research document (Zod validated) | FUNCTIONAL |
| `/api/seo/domain-analysis` | POST | Domain analysis + fire-and-forget persist to Firestore | FUNCTIONAL (updated) |
| `/api/seo/strategy` | POST | 30-day strategy + fire-and-forget persist to Firestore | FUNCTIONAL (updated) |
| `/api/battlecard/competitor/discover` | POST | Competitor discovery + fire-and-forget persist | FUNCTIONAL (updated) |
| `/api/battlecard/generate` | POST | Battlecard generation + fire-and-forget persist | FUNCTIONAL (updated) |

**Pattern:** All SEO/competitor API routes now fire-and-forget persist results to the `seoResearch` Firestore collection after returning the response. Client pages load saved research on mount so data survives page refreshes.

### API Implementation Notes

The following endpoints have working infrastructure (rate limiting, caching, auth) but use **mock data** for core business logic:

| Endpoint | Issue | Priority |
|----------|-------|----------|
| `/api/coaching/team` | Team member query returns hardcoded IDs | **FALSE POSITIVE** — Queries Firestore teams collection with sales_rep fallback |
| ~~`/api/crm/deals/[dealId]/recommendations`~~ | **RESOLVED** — Auth user extraction + workspaceId from query param | ~~MEDIUM~~ |
| `/api/crm/deals/monitor/start` | Monitor lifecycle not fully implemented | LOW |
| `/api/webhooks/gmail` | Auto-meeting booking has TODO | LOW |
| `/api/voice/twiml` | Audio fallback uses placeholder URL | LOW |

**Resolved API Issues:** All previous gaps resolved across Sessions 7-37. See git history for details.

**Meeting Record Schema (April 30, 2026):**

Every meeting record now carries a `meetingProvider` discriminator so the unified calendar dashboard and future provider adapters can dispatch without a schema migration.

```typescript
// src/lib/meetings/scheduler-engine.ts
export type MeetingProvider = 'zoom' | 'google_meet' | 'teams' | 'none';

interface MeetingRecord {
  // ... attendees, assignee, status, etc.
  meetingProvider: MeetingProvider;
  zoomMeetingId?: string;     // present iff meetingProvider === 'zoom'
  zoomJoinUrl?: string;
  zoomStartUrl?: string;
}
```

`'zoom'` is the only provider with a working integration today; the discriminator exists so Google Meet / Teams adapters can land later without touching every consumer. `'none'` is set when the operator books a meeting without a video conference URL (in-person, phone, or async).

**Unified Media Library Schema (April 30, 2026):**

`src/types/media-library.ts` defines two shapes side-by-side:

- **`UnifiedMediaAsset`** — Canonical shape for all NEW code. Every content engine agent (Copywriter, Alex, Video Pipeline, Voice Lab, Scraper) reads/writes this. Stored at `organizations/{PLATFORM_ID}/media/{id}`.
  - `type: 'image' | 'video' | 'audio' | 'document'`
  - `category: MediaAssetCategory` — one of 14 enumerated values in `MEDIA_CATEGORIES` (logo, social-graphic, banner, avatar-portrait, photo, graphic, music-track, voiceover, sound, video-clip, final-render, thumbnail, screenshot, other)
  - `tags: string[]`, `name`, `url`, `thumbnailUrl?`, `mimeType`, `dimensions?`, `source: 'ai-generated' | 'user-upload' | 'imported' | 'derived'`
- **`MediaItem`** — `@deprecated` legacy shape retained for back-compat with the existing `/content/video/library` page and `EditorMediaPanel`. New code MUST use `UnifiedMediaAsset`. A projection helper exists in the same file to map `UnifiedMediaAsset` → legacy `MediaItem`.

Backfill of pre-existing media assets is handled by `scripts/backfill-media-library.ts`.

**Scheduling Messages Templates (April 30, 2026):**

`organizations/{PLATFORM_ID}/settings/schedulingMessages` holds 8 editable copy fields:
`earlyAccessSuccessTitle`, `earlyAccessSuccessBody`, `demoConfirmationEmailSubject`, `demoConfirmationEmailBody`, `zoomMeetingTopic`, `zoomMeetingAgenda`, `reminder24hSubject`, `reminder24hBody`, `reminder1hSubject`, `reminder1hBody`.

Template variables supported in any field via `{name}` syntax: `{firstName}`, `{fullName}`, `{meetingDate}` (e.g. "Tuesday, Nov 4"), `{meetingTime}` (e.g. "2:00 PM"), `{duration}` (minutes), `{zoomLink}`, `{orgName}`, `{operatorName}`. When the doc doesn't exist (fresh deployment, never edited), helpers in `src/lib/meetings/scheduling-messages-service.ts` return the hardcoded `DEFAULT_MESSAGES` so existing flows continue identically.

**Integrations dual-write compat shim (April 30, 2026):**

The new per-integration credential model writes tokens + metadata to a per-integration doc (one doc per integration). The existing `/settings/integrations` UI page still reads from a single `integrations/all` map doc keyed by integration id. To avoid a UI refactor on launch, the Zoom callback dual-writes a slim summary (status + connectedEmail/Name/At metadata) to the legacy `integrations/all` map so the integrations card shows ✓ Connected without a refactor. Tokens stay only in the per-integration doc. The two-step disconnect clears both. Future integrations should follow the same dual-write pattern until the UI is migrated to `listConnectedIntegrations`.

**`useAdminSdk` opt-in flag (April 30, 2026):**

`getIntegrationCredentials`, `saveIntegrationCredentials`, `disconnectIntegration` (in `src/lib/integrations/integration-manager.ts`) and `createLead` now accept an optional `useAdminSdk: true` flag. When set, both reads and writes route through the Firebase Admin SDK, bypassing Firestore security rules. **REQUIRED** for any code path that runs without an authenticated request context (public webhooks, public endpoints like `/early-access`, server-to-server crons). Default (`useAdminSdk: false` / omitted) preserves the original client-SDK behavior so auth-gated callers are unaffected. `oauth-state.ts` is fully migrated to Admin SDK as part of this same fix.

`AdminFirestoreService.set` and `.get` are now generic (`<T extends object>`) so typed callers don't need `Record<string, unknown>` casts.

**Onboarding Pipeline (February 27, 2026):**

The onboarding flow now calls `POST /api/agent/process-onboarding` on Step 4 (API key setup) with enriched data:
- `industryCategory`, `industryCategoryName` — from 15-category selection
- `industryTemplateId`, `industryTemplateName` — from 50 niche template drill-down
- `injectionAnswer`, `injectionVariable` — from industry-specific injection question
- `customNiche` — freeform text for categories with no templates (e.g., Automotive)
- The route forwards these to `processOnboarding()` → `buildBaseModel()` → system prompt generation
- Injection answers are interpolated into the system prompt under "Industry-Specific Context"
- New mapping file: `src/lib/persona/category-template-map.ts` (15 categories, 50 template IDs)
- `OnboardingCategory` interface now includes `defaultEntities?: string[]` for entity config during onboarding

**Industry-Driven Configuration (March 10, 2026):**

Industry selection now drives 5 system layers automatically:
1. **Feature Modules** — `getIndustryFeatureConfig(categoryId)` enables industry-relevant modules (e.g., video for real estate, e-commerce for retail). All modules default ON; 3 always-on (CRM, conversations, workflows).
2. **Entity Config** — `buildEntityConfigForCategory(categoryId)` enables industry-specific CRM entities (e.g., `properties`/`showings` for real estate, `cases`/`billing_entries` for legal).
3. **Persona Blueprints** — `CATEGORY_TO_BLUEPRINT` mapping (15 categories → 12 blueprint IDs) enriches agent personality with industry tone, greeting variants, specialist triggers, and communication style.
4. **Industry Templates** — Auto-resolved from category when not explicitly set. 50 templates across 7 files with cognitiveLogic, tacticalExecution, knowledgeRAG, and research intelligence. MutationEngine applies conditional transformations based on onboarding answers.
5. **Dashboard Wizard** — Now uses `ONBOARDING_CATEGORIES` (15 categories) instead of 13 hardcoded options with mismatched IDs.

Key files:
- `src/lib/constants/feature-modules.ts` — `INDUSTRY_FEATURE_DEFAULTS`, `getIndustryFeatureConfig()`
- `src/lib/constants/entity-config.ts` — `CATEGORY_ENTITY_DEFAULTS`, `buildEntityConfigForCategory()`
- `src/lib/agent/onboarding-processor.ts` — `CATEGORY_TO_BLUEPRINT`, auto-resolve templateId, blueprint enrichment
- `src/lib/db/provisioner/blueprints/industry-personas.ts` — 12 persona blueprints
- `src/lib/persona/category-template-map.ts` — 15 categories, 50 template ID mappings

**Entity Configuration System (February 28, 2026):**

CRM entity visibility is now configurable per-industry. The system mirrors the feature module pattern (6 layers):
- **Types:** `src/types/entity-config.ts` — `EntityTier`, `EntityMetadata`, `EntityConfig`
- **Constants:** `src/lib/constants/entity-config.ts` — `ALWAYS_ON_ENTITIES`, `ENTITY_METADATA` (18 entries), `CATEGORY_ENTITY_DEFAULTS` (15 categories)
- **Validation:** `src/lib/validation/entity-config-schemas.ts` — `entityConfigSchema`, `updateEntityConfigSchema`
- **Service:** `src/lib/services/entity-config-service.ts` — Firestore CRUD at `settings/entity_config`
- **Store:** `src/lib/stores/entity-config-store.ts` — Zustand with `isEntityEnabled()`, backward compat (no config = all enabled)
- **Hook:** `src/hooks/useEntityConfig.ts` — auto-load on first mount
- **API:** `src/app/api/entity-config/route.ts` — GET/PUT with auth + Zod
- **UI gating:** Entity page shows "not enabled" banner; Schema Editor dims disabled entities; Settings > Features has new "CRM Entities" tab

**Admin SDK Migration (February 25, 2026):**

All 64 API routes that were using the client-side `FirestoreService` have been migrated to `AdminFirestoreService` (Firebase Admin SDK). This resolves PERMISSION_DENIED errors in production where server-side routes were incorrectly using the client SDK which is subject to Firestore security rules.

**Affected areas:** admin, analytics, agent, chat, checkout, contacts, coupons, custom-tools, ecommerce, email tracking, integrations, leads, learning, notifications, orchestrator, outbound, public, reports, settings, setup, social, subscriptions, team, training, webhooks, voice fallback.

**Smoke test:** 48/48 passing (100%) after migration.

**API Keys to Firestore:** All service API keys (OpenRouter, SendGrid, Stripe, Twilio, ElevenLabs, HeyGen, Serper, DataForSEO, Twitter/X, Slack, PageSpeed) are now stored in Firestore via `apiKeyService` rather than `.env` files. `process.env` remains as fallback for development and for system secrets (webhook verification keys, Firebase admin credentials, encryption keys).

### Testing Infrastructure (Audit: January 30, 2026)

#### Test Frameworks Installed

| Framework | Version | Purpose | Status |
|-----------|---------|---------|--------|
| Jest | ^30.2.0 | Unit tests, Jest E2E | FUNCTIONAL |
| Playwright | ^1.57.0 | Browser E2E testing | ✅ OPERATIONAL |
| @playwright/test | ^1.57.0 | Playwright test runner | ✅ OPERATIONAL |

#### Playwright Configuration

**File:** `playwright.config.ts`

| Setting | Value | Status |
|---------|-------|--------|
| testDir | `./tests/e2e` | ✅ Configured |
| testMatch | `**/*.spec.ts` | ✅ CONFIGURED |
| baseURL | `http://localhost:3000` | ✅ Configured |
| reporter | `html` | ✅ Configured |
| projects | 5 (chromium, firefox, webkit, mobile) | ✅ Configured |

**RESOLVED (January 30, 2026):** Added `testMatch: '**/*.spec.ts'` to isolate Playwright specs from Jest E2E tests. Test discovery now functional.

#### Test File Naming Conventions

| Pattern | Framework | Directory | Count |
|---------|-----------|-----------|-------|
| `*.spec.ts` | Playwright | `tests/e2e/` | 91 |
| `*.test.ts` | Jest | `src/lib/*/__tests__/` | 4 |

**Playwright E2E Tests (18 specs, ~165 tests):**
- `website-builder.spec.ts` (16 tests)
- `voice-engine.spec.ts` (22 tests)
- `admin-gateway.spec.ts` (Admin login/theme audit)
- `admin-content-factory.spec.ts` (Content & AI management audit)
- `admin-routes-audit.spec.ts` (46-route visual audit with trace)
- `auth-login.spec.ts` (Auth flow tests)
- `website-pages-list.spec.ts` (Website pages tests)
- `website-editor-visual.spec.ts` (Editor visual tests)
- `website-blog-system.spec.ts` (Blog system tests)
- `website-domain-seo.spec.ts` (Domain & SEO tests)
- `website-navigation-settings.spec.ts` (Nav settings tests)
- `website-templates-audit-log.spec.ts` (Templates & audit tests)
- `crm-dashboard.spec.ts` ✅ **Session 28** (24 tests: dashboard, CRM entities, navigation, empty state)
- `ecommerce-store.spec.ts` ✅ **Session 28** (29 tests: catalog, cart, checkout, success/cancel flows)
- `settings-pages.spec.ts` ✅ **Session 28** (7 suites: subscription, billing, integrations, storefront, workflows, AI agents)
- `social-analytics.spec.ts` ✅ **Session 28** (5 suites: command center, calendar, analytics, pipeline, outbound)

**Jest Unit Tests:**
- `tests/lib/pricing/subscription-tiers.test.ts` ✅ **Session 28** (24 tests)
- `tests/lib/workflow/workflow-actions.test.ts` ✅ **Session 28** (21 tests)
- `tests/lib/schema/formula-sanitization.test.ts` ✅ **Session 28** (20 tests)

**Jest E2E Tests (Separate Runner):**
- `email-sequences.e2e.test.ts`
- `ecommerce-checkout.e2e.test.ts`
- `ui-pages.e2e.test.ts`

#### Test Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `test` | `jest` | Unit tests |
| `test:e2e` | `jest --testPathPattern=e2e --runInBand` | Jest E2E |
| `test:playwright` | `playwright test` | ✅ Playwright E2E |
| `test:playwright:ui` | `playwright test --ui` | ✅ Playwright UI mode |

#### Readiness Status

| Criterion | Status |
|-----------|--------|
| Playwright installed | ✅ PASS |
| Config file exists | ✅ PASS |
| Test discovery | ✅ PASS (91 Playwright spec files + 4 Jest unit test files across 5 browser projects) |
| Autonomous testing | ✅ OPERATIONAL |

**Full Audit Report:** `docs/playwright-audit-2026-01-30.md`

### E2E Test Infrastructure (Supplementary)

**Playwright Activation:** ✅ OPERATIONAL (January 30, 2026). Config: `testMatch: '**/*.spec.ts'` isolates Playwright from Jest. 5 browser projects.

**E2E Cleanup Protocol:** ✅ ACTIVE. Location: `tests/helpers/e2e-cleanup-utility.ts`. All test data uses `E2E_TEMP_` prefix. `E2ECleanupTracker` handles recursive Firestore cleanup with `listCollections()` discovery. 7 protected org IDs hardcoded. Batch size: 400 ops.

---

## Infrastructure Systems

> **Audit Note (January 27, 2026):** These systems are fully implemented but were previously undocumented.

### Rate Limiting

**Implementation:** In-memory rate limiting with configurable windows per endpoint.

| Endpoint Category | Limit | Window | File |
|-------------------|-------|--------|------|
| Health endpoints | 10 req | 60s | `src/lib/rate-limit/rate-limiter.ts` |
| Billing webhooks | 100 req | 60s | `/api/billing/webhook/route.ts` |
| Coaching/team | 20 req | 60s | `/api/coaching/team/route.ts` |
| Lead routing | 10 req | 60s | `/api/routing/route-lead/route.ts` |
| Notifications | 50 req | 60s | `/api/notifications/send/route.ts` |

**Response:** HTTP 429 with `Retry-After` header when limit exceeded.

### Notification System

**Location:** `src/lib/notifications/notification-service.ts`

| Feature | Description |
|---------|-------------|
| **Multi-Channel** | Slack, Email, Webhook, In-App |
| **Templates** | Template-based notification content |
| **Preferences** | User preference respect (quiet hours, channels, categories) |
| **Retry Logic** | Exponential backoff with configurable retries |
| **Smart Batching** | Batches notifications for efficiency |
| **Delivery Tracking** | Analytics for sent/delivered/failed |

**API Endpoints:**
- `POST /api/notifications/send` - Send notification
- `GET /api/notifications/list` - List notifications
- `GET/PUT /api/notifications/preferences` - Manage preferences

### Background Processing

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `/api/cron/scheduled-publisher` | CRON_SECRET env var | Scheduled content publishing |

**Note:** Vercel cron jobs can trigger this endpoint on a schedule.

### Response Caching

| Endpoint | TTL | Cache Key Pattern |
|----------|-----|-------------------|
| `/api/coaching/team` | 1 hour | `team-insights-{teamId}-{period}` |

**Implementation:** In-memory cache with automatic TTL expiration.

### Lead Routing System (FUNCTIONAL)

**Location:** `src/app/api/routing/route-lead/route.ts`, `src/lib/crm/lead-routing.ts`

**Status:** PRODUCTION - Fully implemented with Firestore-backed routing rules

**Algorithm:** Priority-based rule evaluation with configurable strategies:

| Strategy | Description | Use Case |
|----------|-------------|----------|
| **Round Robin** | Cycles through assigned users sequentially | Fair distribution |
| **Territory** | Routes by state/country/industry match | Geographic assignment |
| **Skill-based** | Matches lead language to rep skills | Specialized handling |
| **Load Balance** | Assigns to rep with lowest workload | Capacity optimization |
| **Default** | Round-robin across active org members | Fallback when no rules match |

**Process Flow:**
1. Authenticate via `requireOrganization` (Bearer token)
2. Verify `canAssignRecords` permission (RBAC)
3. Fetch lead from Firestore (`organizations/rapid-compliance-root/leads/{leadId}`) via flat collection helper
4. Evaluate routing rules by priority (`organizations/{PLATFORM_ID}/leadRoutingRules`)
5. Apply matching strategy (round-robin → territory → skill → load-balance)
6. Update `lead.ownerId` with assigned rep
7. Create audit log entry via `logStatusChange()`
8. Emit `lead.routed` signal to Signal Bus

**Rate Limiting:** 10 requests/minute per organization+lead combination

**Required Permission:** `canAssignRecords` (available to: admin only)

**Routing Rules Collection Schema:**
```typescript
{
  id: string;
  platformId: string;        // Always PLATFORM_ID
  name: string;
  enabled: boolean;
  priority: number;  // Higher = evaluated first
  routingType: 'round-robin' | 'territory' | 'skill-based' | 'load-balance' | 'custom';
  assignedUsers: string[];  // User IDs eligible for assignment
  conditions?: RoutingCondition[];
  metadata?: {
    territories?: { userId, states?, countries?, industries? }[];
    skills?: { userId, skills[] }[];
    maxLeadsPerUser?: number;
    balancingPeriod?: 'day' | 'week' | 'month';
  };
}
```

### Error Tracking & Logging

**Location:** `src/lib/logger/logger.ts`, `src/lib/logging/api-logger.ts`

- Structured logging with context (file, function, metadata)
- Error tracking with stack traces
- Logger instance passed to every API endpoint
- Activity logging for CRM operations (`src/lib/crm/activity-logger.ts`)

---

## Integration Status

### Integration Audit (Verified March 28, 2026)

| Integration | Status | Details |
|-------------|--------|---------|
| **Twitter/X** | **TIER 1 — Outbound LIVE** | Direct API v2, OAuth2 PKCE, posting, media upload, timeline, search, mentions. Outbound posting verified live. Inbound DMs dropped at receiver Apr 27 (X Chat E2E blocks 95%+; legacy DMs that DO reach are spam). |
| **LinkedIn** | **TIER 2 — Posting only, gated** | Dual-mode: official LinkedIn API v2 + RapidAPI fallback. OAuth 2.0. Post to profiles/organizations. **Needs MDP approval (1-3 wk).** DM is Partner-status-only — treat as POSTING ONLY. |
| **Facebook** | **TIER 1 — Posting + DM, gated** | Meta Graph API v19.0, page token auth, feed & photo posting + Messenger DM via 24h customer-init window. **Needs Meta Business Verification (3-7 d typical, 1-2 wk worst).** |
| **Instagram** | **TIER 1 — Posting + DM, gated** | Instagram Graph API (Meta), 2-step container→publish, image/video/carousel + DM via instagram_manage_messages. **Bundled with Facebook in Meta Business Verification.** |
| **YouTube** | **TIER 2 — Posting only, gated** | YouTube Data API v3, OAuth 2.0, resumable upload, community posts. **Needs Google OAuth verification (1-4 wk).** No DM concept on YouTube. |
| **TikTok** | **TIER 3 — Defer** | Content Posting API v2, OAuth 2.0, video/photo publishing. **DM API is US-EXCLUDED. Posting Content API is selective approval.** Defer unless Gen Z SMB pivot. |
| **Bluesky** | **TIER 1 — LIVE both directions** | AT Protocol, app password OAuth, text posts with rich text. ✅ Real outbound + inbound DM round-trip Apr 27. No commercial restrictions. |
| **Threads** | **TIER 2 — Posting only, gated** | Meta Threads API v1.0, 2-step container→publish, text/image/carousel. **Bundled with Meta Business Verification.** Threads public API exposes posts/reads only — DMs not in API. |
| **Truth Social** | **PARKED** | Mastodon-compatible API spec, but Cloudflare TLS-fingerprint wall blocks Node fetch in production. No path forward without browser-class TLS infra. Code preserved. |
| **Telegram** | **MARKED FOR DELETION** | Telegram Bot API, bot token auth — works technically. **Tier 3: US SMB market <10% adoption. No commercial brand-account flow (requires personal phone for SMS). Don't invest more time.** Code (TELEGRAM_EXPERT specialist + GM + scripts) pending cleanup. |
| **Reddit** | **MARKED FOR DELETION** | Reddit OAuth API, subreddit posting — but **Tier 3: commercial API access "effectively impossible" without enterprise budget ($10K+/mo). Devvit alternative is community-scoped, not cross-subreddit.** Confirmed Apr 27 2026 from public sources. Code (REDDIT_EXPERT specialist + GM + scripts) pending cleanup. Brand account `u/HuckleberryIII9199` dormant. |
| **Pinterest** | **TIER 2 — Posting only, gated** | Pinterest API v5, OAuth 2.0, pin creation with images. **Needs Developer Portal review (1-3 days, fastest external gate).** DM API exists but Pinterest is discovery, not conversation — defer DM. |
| **WhatsApp Business** | **TIER 3 — Defer** | Meta Graph API v18.0, text/template/media — works technically. **Customer-initiated only (24h window). Narrow use case for marketing/outreach.** Defer until customer-support automation is on roadmap. |
| **Google Business** | **TIER 2 — Posting only, gated** | Google Business Profile API v4, OAuth 2.0, local business posts with media. **Needs Google Profile verify (postcard 5-14 d, phone faster) + GCP OAuth.** No DM concept (Profile is publish-only). |
| **Stripe** | **REAL** | Full API — `checkout.sessions.create()`, `products.create()`, `prices.create()`, `paymentLinks.create()`, PaymentElement checkout (3DS), payment intents, webhook `payment_intent.succeeded`. Production-ready. |
| **PayPal** | **REAL** | Orders API v2, Billing Plans + Subscriptions API, payouts API v1, OAuth token exchange. Full subscription lifecycle (create plan, create subscription, verify, cancel). |
| **Square** | **REAL** | SDK — `payments.create()`, `customers.create()`. Catalog-based subscription plans + payment links. Full subscription lifecycle. |
| **Authorize.Net** | **REAL** | Accept Hosted payment page, ARB (Automated Recurring Billing), `authCaptureTransaction`. Full subscription lifecycle via hosted page + Firestore session tracking. |
| **2Checkout (Verifone)** | **REAL** | REST API v6.0 — `EES_TOKEN_PAYMENT`, HMAC-MD5 authentication, 3DS redirect support. Single transactions. |
| **Mollie** | **REAL** | Payments API v2 — redirect-based hosted checkout, webhook with HMAC-SHA256 signature verification. European payment methods (iDEAL, SEPA, Bancontact). |
| **Paddle** | **REAL** | Merchant of Record — `paddle-provider.ts` (216 LOC). Checkout + payment processing. Webhook handler with HMAC-SHA256 signature. **Gap:** Subscription cancel/manage via API not implemented. |
| **Adyen** | **REAL** | Direct processor — `adyen-provider.ts` (257 LOC). Drop-in component, checkout + processing. Webhook handler with HMAC signature verification. |
| **Chargebee** | **PARTIAL** | Webhook handler exists with basic auth verification. **Gap:** No payment processing implementation file — webhook only. |
| **Hyperswitch** | **REAL** | Open-source payment orchestration — `hyperswitch-provider.ts` (239 LOC). Smart routing to cheapest processor. Webhook handler with HMAC signature. |
| **Razorpay** | **REAL** | India/global — `razorpay-provider.ts` (306 LOC). Checkout + processing. Webhook handler with HMAC-SHA256 signature. |
| **Braintree** | **REAL** | PayPal subsidiary — `braintree-provider.ts` (349 LOC). Checkout + processing. Webhook handler with HMAC-SHA256 signature. |
| **Email (SendGrid)** | **REAL** | Primary provider. `@sendgrid/mail` SDK, tracking pixels, click tracking. |
| **Email (Resend)** | **STUB** | Type definitions exist but no implementation file |
| **Email (SMTP)** | **REAL** | Nodemailer — real SMTP transport (fixed Mar 10) |
| **Voice (Twilio)** | **REAL** | Twilio SDK — call initiation, control, conferencing. |
| **Voice (Telnyx)** | **REAL** | Direct API — 60-70% cheaper than Twilio. |
| **TTS (ElevenLabs)** | **REAL** | `api.elevenlabs.io/v1`, 20+ premium voices. |
| **TTS (Unreal Speech)** | **REAL** | Alternative cost-effective TTS. |
| **Video (Hedra)** | **REAL** | Hedra Character-3 API — sole video engine. Character Studio (custom + stock), dual TTS (Hedra native + ElevenLabs), AI Video Director (produce/assemble), per-scene characters, brand preference memory, scene review workflow. Phases 1-3 complete. |
| **Firebase** | **REAL** | Auth + Firestore, single-tenant `rapid-compliance-65f87`. |
| **OpenRouter** | **REAL** | AI gateway, 100+ models. |
| **Google OAuth** | **REAL** | Calendar, Gmail integration. |
| **Microsoft OAuth** | **REAL** | Outlook, Teams integration. |
| **Slack OAuth** | **REAL** | Channel notifications. |
| **Social Engagement (POST)** | **REAL** | 14 platforms wired into `postToPlatform()` dispatcher with real API implementations. |
| **Social Engagement (REPLY/LIKE/FOLLOW/REPOST)** | **REAL (Twitter)** | Wired to Twitter API v2: likeTweet, retweet, followUser, postTweet w/ replyToTweetId. Non-Twitter platforms pending. |
| **Social OAuth (Twitter)** | **REAL** | PKCE flow with code challenge, auth URL generation, code exchange, profile fetch. AES-256-GCM token encryption. |
| **Social OAuth (LinkedIn)** | **REAL** | OAuth 2.0 authorization code flow, token exchange, profile fetch. AES-256-GCM token encryption. |
| **Email (Gmail)** | **REAL** | Google APIs OAuth2 — list, send, watch, history sync to CRM |
| **Email (Outlook)** | **REAL** | Microsoft Graph — list, send, calendar events, free/busy |
| **Slack** | **REAL** | `@slack/web-api` — channels, messages, files, users |
| **Microsoft Teams** | **REAL** | Microsoft Graph — teams, channels, messages, meetings |
| **Shopify** | **REAL** | Admin API 2024-01 — inventory, cart, products |
| **HubSpot** | **REAL** | CRM v3 API — contact sync |
| **Salesforce** | **REAL** | REST API v58.0 — lead creation |
| **Xero** | **REAL** | OAuth2, invoices, contacts, payments |
| **QuickBooks** | **REAL** | OAuth2, invoices, customers, company info |
| **Zoom** | **REAL — User-OAuth (Apr 30 2026)** | Full User-level OAuth — `/api/integrations/zoom/{auth,callback,disconnect}`. Per-integration token doc + dual-write summary into legacy `integrations/all` map for `/settings/integrations` UI compat. Two-step disconnect. Used by SCHEDULING_SPECIALIST + Operations Manager for meeting creation. |
| **Twilio Verify** | **REAL** | OTP/2FA verification |
| **Apollo.io** | **REAL** | Free-tier org search (`/api/v1/organizations/search`), company enrichment. Person enrichment requires paid plan. |
| **Clay.com** | **KEY STORED** | API key configured. REST API deprecated by Clay — webhook-based integration only. |
| **Fal.ai** | **REAL** | AI Creative Studio — Flux, SDXL, Stable Diffusion image generation. BYOK via provider-router. |
| **Google AI Studio** | **REAL** | AI Creative Studio — Imagen 3 image generation. BYOK via provider-router. |
| **Kling 3.0 (Direct)** | **REAL** | AI Creative Studio + direct video generation API with JWT auth. BYOK. |

### SEO Data Integrations (NEW: February 23, 2026)

| Service | Status | API Endpoints Used | Capabilities |
|---------|--------|--------------------|--------------|
| **DataForSEO** | **REAL** | `domain_rank/live`, `ranked_keywords/live`, `backlinks/summary/live`, `backlinks/referring_domains/live`, `competitors_domain/live`, `search_volume/live`, `serp/organic/live`, `on_page/instant_pages` | Domain traffic estimation, ranked keyword lists, backlink profiles, referring domain identification, organic competitor discovery, keyword volume/CPC, SERP analysis, on-page audit |
| **Serper** | **REAL** | `search` (Google SERP), keyword position checking | SERP results, position tracking for specific domain+keyword pairs |
| **Google PageSpeed** | **REAL** | PageSpeed Insights API v5 (mobile + desktop) | Core Web Vitals (LCP, FID, CLS, FCP, TTFB, TBT), performance/accessibility/SEO scores |
| **Google Search Console** | **REAL** | Search Analytics API, URL Inspection | Top keywords by clicks/impressions, top pages, indexing status (requires OAuth connection) |

**Routing:** Jasper detects domain analysis requests via traffic/visitor/backlink keywords + domain extraction regex → Marketing Manager → SEO Expert `domain_analysis` action → 5 concurrent DataForSEO calls.

### Jasper Mission Control (LIVE — Sprint 18 + Campaign Review)

**Routes:** `/mission-control` (live view), `/mission-control?campaign={id}` (Campaign Review), `/mission-control/history` (completed missions)

Live "Air Traffic Control" for Jasper's multi-step delegations. SSE streaming via Firestore `onSnapshot()`, cancel capability, 3-panel layout (sidebar, timeline, step detail). 13 delegation tools instrumented with `toolArgs`/`toolResult` tracking. Fire-and-forget instrumentation never breaks chat response.

**Campaign Review (NEW):** When `?campaign=` URL param is present, renders CampaignReview component showing all deliverables as cards with inline preview, approve/reject/feedback buttons, "Approve All", and progress bar. Polls for real-time updates.

**Key files:** `src/lib/orchestrator/mission-persistence.ts` (types + CRUD), `src/lib/campaign/campaign-service.ts` (campaign + deliverable CRUD), `src/hooks/useMissionStream.ts` (SSE client), `src/app/(dashboard)/mission-control/` (UI + CampaignReview).
**Firestore:** `organizations/{PLATFORM_ID}/missions/{missionId}`, `organizations/{PLATFORM_ID}/campaigns/{campaignId}` + `.../deliverables/{deliverableId}`
**Statuses:** Mission: PENDING → IN_PROGRESS → COMPLETED/FAILED. Steps: PENDING → RUNNING → COMPLETED/FAILED/AWAITING_APPROVAL. Deliverables: drafting → pending_review → approved/rejected/revision_requested → published.

### Previously Planned Integrations (NOW LIVE)

All previously planned integrations are now implemented:
- **Salesforce CRM** — REAL (lead sync via `sobjects/Lead` API)
- **HubSpot** — REAL (contact sync via CRM v3 API)
- **Xero Accounting** — REAL (OAuth, invoices, contacts)
- **PayPal Payments** — REAL (orders, capture, payouts)

### Dashboard-Swarm Connectivity

- `GET /api/system/status` exposes `SwarmStatus` with `ManagerBrief[]` from `getSwarmStatus()`
- `useSystemStatus` hook polls every 30s, consumed by `SwarmMonitorWidget`
- All agent IDs aligned between backend registry and frontend

---

## Firestore Collections

### Root Collections (11 primary)

| Collection | Purpose |
|------------|---------|
| `organizations` | Tenant definitions |
| `users` | User profiles |
| `health` | System health records |
| `admin` | Admin configurations |
| `platform_metrics` | Platform-wide metrics |
| `platform_settings` | Global settings |
| `discoveryQueue` | Lead discovery queue |
| `slack_workspaces` | Slack workspace configs |
| `slack_oauth_states` | OAuth state tokens |
| `slack_channels` | Slack channel mappings |
| `slack_messages` | Message history |

### Organization Sub-Collections (50+ listed below, 190 total paths via getSubCollection)

```
organizations/{PLATFORM_ID}/
├── records/                  # CRM records (flat, workspace nesting removed Feb 27)
├── sequences/                # Email sequences
├── campaigns/                # Marketing campaigns
├── workflows/                # Automation workflows
├── products/                 # E-commerce products
├── orders/                   # Order history
├── conversations/            # Chat history
├── trainingData/             # AI training data
├── baseModels/               # AI model configs
├── schemas/                  # Custom schemas
├── apiKeys/                  # API keys
├── integrations/             # Integration configs
├── merchant_coupons/         # Merchant coupons
├── members/                  # Organization members
├── settings/                 # Org settings (feature_config, business_profile, entity_config)
├── agentConfig/              # Agent configurations
├── goldenMasters/            # Golden master agents
├── signals/                  # Agent signals
├── socialAccounts/           # Social media accounts (NEW Feb 12)
├── socialMedia/              # Social media uploads (NEW Feb 12)
├── socialApprovals/          # Social approval workflow (NEW Feb 12)
├── socialListening/          # Social listening mentions (NEW Feb 12)
├── socialSettings/           # Social agent config (NEW Feb 12)
├── seoResearch/              # SEO & competitor research persistence (NEW Feb 26 — domain_analysis, strategy, competitor_discovery, battlecard)
├── forms/                    # Form builder forms
│   ├── fields/               # Form fields
│   ├── submissions/          # Form submissions
│   ├── analytics/            # Form analytics
│   └── views/                # View events
├── formTemplates/            # Form templates
├── websites/                 # Website configs
├── pages/                    # Website pages
├── domains/                  # Custom domains
├── blogPosts/                # Blog content
├── brandDNA/                 # Brand configuration
├── memoryVault/              # Agent shared memory (Firestore-backed, cold-start safe)
├── missions/                 # Mission Control tracking (NEW Sprint 18 — user-facing delegation state)
├── growthCompetitors/        # Growth Command Center — competitor profiles (NEW March 2)
├── growthCompetitorSnapshots/ # Competitor snapshots over time (NEW March 2)
├── growthKeywords/           # Keyword tracking entries with ranking history (NEW March 2)
├── growthStrategies/         # 3-tier growth strategies (Aggressive/Competitive/Scrappy) (NEW March 2)
├── growthAiVisibility/       # AI search visibility check results (NEW March 2)
├── growthActivityLog/        # Activity feed events for Growth Command Center (NEW March 2)
├── lead-research-url-sources/ # URL sources for Lead Research page (NEW March 5)
├── lead-research-config/     # Lead Research schedule config (NEW March 5)
├── avatar_profiles/          # Character profiles — reference images, green screen clips, voice assignment (REWORKING → Character Studio)
├── custom_avatars/           # Legacy custom avatars (DEPRECATED — migrating to avatar_profiles)
├── tts_audio/                # Synthesized TTS audio clips served via /api/video/tts-audio (24hr expiry)
├── icp-profiles/             # Ideal Customer Profile definitions for lead research (NEW March 5)
├── media/                    # Media library: videos, images, audio with subcategories (NEW March 10)
├── videoProjects/            # Video projects with scenes and storyboards
├── scene_previews/           # Scene preview images (base64 in Firestore)
├── sceneGradings/            # Video scene auto-grade results (Deepgram + LCS diff) (NEW March 19)
├── brandPreferences/         # Video brand preference memory (approved/rejected prompts)
├── campaigns/                # Campaign orchestration (NEW March 15)
│   └── deliverables/         # Campaign deliverables with status tracking
├── customTools/              # Custom API tool definitions
├── socialPosts/              # Social media posts
└── provisionerLogs/          # Provisioning logs
```

### Total: 243 Unique Collection Paths (53 root-level constants + 190 org-scoped via getSubCollection)

---

## Architecture Notes

### Build System (W2 Security Gate)

**Status:** RESOLVED (January 29, 2026)

The build pipeline now enforces **mandatory TypeScript type-checking** as a non-bypassable prerequisite:

```json
"build": "tsc --noEmit && next build"
```

| Gate | Command | Behavior |
|------|---------|----------|
| Type Check | `tsc --noEmit` | Fails build on ANY type error |
| Next.js Build | `next build` | Only runs if type-check passes |

**Security Implications:**
- Prevents deployment of code with type inconsistencies
- Eliminates W2 risk (type errors bypassing CI)
- Ensures compile-time safety before production artifacts are generated

**No Bypass Policy:** The `--noEmit` flag ensures type-checking runs without generating output files. There are no suppression flags. All type errors must be resolved before `next build` executes.

### Single-Tenant Model (Penthouse)

> **See also:** [Ironclad Architecture Rules](#ironclad-architecture-rules) — Rules 1 and 5

- **One organization:** `rapid-compliance-root` is the only org in the system (Rule 1)
- All Firestore data scoped to `organizations/rapid-compliance-root/` or flat root collections (Rule 5)
- Feature visibility configurable at the platform level
- All 72 AI agents operate under the single org identity (Rule 2)
- `DEFAULT_ORG_ID` constant used by all service classes — no dynamic org resolution
- All service classes use `PLATFORM_ID` constant directly — no dynamic org parameters

### Middleware Routing Strategy

The middleware (`src/middleware.ts`) uses **Role-Based Segment Routing**:

1. All `/admin/*` paths allowed through middleware
2. Authentication & authorization handled by `/admin/layout.tsx`
3. Non-admin users redirected to workspace by layout, not middleware
4. Prevents 404s from middleware redirecting to non-existent paths

### Sidebar Architecture

> See [Rule 4: Navigation Hierarchy](#rule-4-navigation-hierarchy--consolidated-sidebar) for the authoritative 9-section navigation structure with all sidebar items and SubpageNav tab definitions.

#### Key Components

| Component | Location | Status |
|-----------|----------|--------|
| **AdminSidebar** | `src/components/admin/AdminSidebar.tsx` | 9 sections + footer |
| **SubpageNav** | `src/components/ui/SubpageNav.tsx` | 11 layouts, 21 tab arrays |
| **UnifiedSidebar** | `src/components/dashboard/UnifiedSidebar.tsx` | Admin routes only |
| **Tab Config** | `src/lib/constants/subpage-nav.ts` | Centralized tab definitions |

**Route groups:** `/(dashboard)/*` (main app), `/admin/*` (platform admin), `/sites/*`, `/store/*` — all use `PLATFORM_ID` internally.

### Theme Architecture

> See **Rule 3** for CSS variable governance. Admin and client themes use independent pipelines:
> - Admin: `useAdminTheme()` → `.admin-theme-scope` → `platform_settings/adminTheme`
> - Client: `useOrgTheme()` → `:root` → `organizations/{PLATFORM_ID}/themes/default`
> - Theme Editor: `/(dashboard)/settings/theme` (client-facing). Admin theme editor not yet built.

### State Management Architecture

The platform uses a **layered state management** approach:

| Layer | Technology | Scope | Persistence |
|-------|------------|-------|-------------|
| Component UI | `useState`, `useMemo` | Component | None |
| App-wide Auth | `useUnifiedAuth()` hook | App | Firebase |
| App-wide Theme | `useAdminTheme()`, `useOrgTheme()` | App | Firestore |
| Global UI | Zustand stores | Global | localStorage |
| Route Context | Layout files | Route tree | None |

#### Zustand Stores

| Store | Location | Purpose |
|-------|----------|---------|
| `useOnboardingStore` | `src/lib/stores/onboarding-store.ts` | 4-step onboarding flow (industry → niche → account → apikey → complete). Tracks selectedCategory, selectedTemplate, injectionAnswer, customNiche, apiKeyConfigured |
| `useOrchestratorStore` | `src/lib/stores/orchestrator-store.ts` | AI assistant UI state |
| `usePendingMerchantStore` | `src/lib/stores/pending-merchants-store.ts` | Lead capture & abandonment tracking |

#### Sidebar Reactivity Pattern

AdminSidebar and UnifiedSidebar achieve reactivity through:
1. **Role-based filtering:** `filterNavigationByRole()` gates sections and items by role/permission
2. **Path-based active state:** `usePathname()` from Next.js with special hub route matching (Social Hub, Training Hub, Models, Analytics)
3. **CSS variable injection:** Theme changes via `container.style.setProperty()` update instantly
4. **React.memo sub-components:** Prevents unnecessary re-renders
5. **SubpageNav tabs:** `usePathname()` drives active tab state on hub pages

### Agent Communication

Agents communicate via **MemoryVault** (Firestore-backed since Feb 8, 2026):
- Cross-agent memory sharing
- Signal broadcasting
- Insight sharing
- Cold-start safe: `read()` and `query()` await Firestore hydration before returning
- TTL cleanup runs every 4 hours via operations-cycle cron
- Location: `src/lib/agents/shared/memory-vault.ts`

### Agent Memory Hierarchy

| Layer | Status | Details |
|-------|--------|---------|
| **Working memory** | Have it | In-process variables during a single task execution |
| **Shared operational state (MemoryVault)** | **Complete** | Cross-agent signals, insights, context. Firestore-backed, survives cold starts (commit e388c151) |
| **Customer/entity memory** | Have it | CRM data in Firestore collections (records, deals, contacts) |
| **Conversation memory** | **COMPLETE (commit b1c50e8f)** | ConversationMemory service — unified retrieval of past customer interactions across all channels. Location: `src/lib/conversation/conversation-memory.ts` |
| **Episodic memory** | Not built | Agents recalling specific past interactions and learning from outcomes |
| **Semantic/vector memory** | Not built | Embedding-based retrieval for similarity search across knowledge |

### Conversation Storage (Current State)

| Channel | Firestore Collection | Persisted? | Agent-Queryable? |
|---------|---------------------|------------|-----------------|
| Chat widget | `chatSessions/{id}/messages` | Yes | No — agents don't query it |
| Jasper (orchestrator) | `orchestratorConversations/{id}/messages` | Yes | No — UI-only |
| SMS | `smsMessages` | Yes (individual records) | No — not threaded, not agent-accessible |
| Voice AI | In-memory only | **No — lost when call ends** | No |
| Email | Campaign metadata only | Partial (no body) | No |

**Gap Resolved (commit b1c50e8f):** ConversationMemory service now provides unified retrieval across all channels. Agents can query conversation history with auto-analysis and Lead Briefing generation. Voice transcripts persist to Firestore, and all channels are agent-queryable.

> **Manager orchestration internals** (Intelligence, Marketing, Master Orchestrator pipelines, intents, saga templates, brief structures) are documented in the source code. See `src/lib/agents/*/manager.ts` files for implementation details.

---

## Data Contracts Reference

### Core Type Definitions

| Type | Location | Purpose |
|------|----------|---------|
| `UnifiedUser` | `src/types/unified-rbac.ts` | Authenticated user with role, permissions |
| `UnifiedPermissions` | `src/types/unified-rbac.ts` | 53 permission flags per role |
| `AccountRole` | `src/types/unified-rbac.ts` | `'owner' \| 'admin' \| 'manager' \| 'member'` (4-role RBAC) |
| `Organization` | `src/types/organization.ts` | Tenant definition with plan, branding, settings |
| `Lead` | `src/types/crm-entities.ts` | CRM lead with scoring, enrichment |
| `Deal` | `src/types/crm-entities.ts` | CRM deal with stage history, value |
| `Contact` | `src/types/crm-entities.ts` | CRM contact with address, social |
| `Schema` | `src/types/schema.ts` | Custom entity schema definition |
| `AdminThemeConfig` | `src/hooks/useAdminTheme.ts` | Admin theme colors, branding |
| `ThemeConfig` | `src/types/theme.ts` | Full theme with typography, layout |

### Standard Entity Schemas (35 total)

**Source:** `src/lib/schema/standard-schemas.ts`

The Schema Editor and entity table pages dynamically render from `STANDARD_SCHEMAS`. Each schema defines id, name, icon, and typed fields (text, email, currency, singleSelect, lookup, etc.). Picklist values for all singleSelect fields are in `PICKLIST_VALUES`.

| Category | Schemas | Count |
|----------|---------|-------|
| **CRM Core** | leads, companies, contacts, deals, products, quotes, invoices, payments, orders, tasks | 10 |
| **Transportation & Compliance** | drivers, vehicles, compliance_documents | 3 |
| **Service Business** | projects, time_entries | 2 |
| **E-Commerce** | customers, inventory | 2 |
| **Real Estate** | properties, showings | 2 |
| **Legal Services** | cases, billing_entries | 2 |
| **Healthcare / Wellness** | patients, appointments | 2 |
| **Platform Core** | activities, campaigns, sequences, workflows, forms, pages, blog_posts, domains, coupons, proposals, subscriptions, email_templates | 12 |

Cross-entity references use `lookup` fields with `config: { linkedSchema: '...' }` (e.g., showings → properties, compliance_documents → drivers/vehicles, billing_entries → cases, subscriptions → contacts).

### Zod Validation Schemas

| Schema | Location | Purpose |
|--------|----------|---------|
| `emailSendSchema` | `src/lib/validation/schemas.ts` | Email delivery request validation |
| `leadScoringSchema` | `src/lib/validation/schemas.ts` | Lead scoring API input |
| `CreateWorkflowSchema` | `src/lib/workflow/validation.ts` | Workflow creation validation |
| `AnalyticsRequestSchema` | `src/lib/analytics/dashboard/validation.ts` | Analytics query parameters |
| `sequenceStepSchema` | `src/lib/sequence/validation.ts` | Email sequence step definition |
| `TriggerConditionSchema` | `src/lib/workflow/validation.ts` | Workflow trigger conditions |

### Key Interfaces

```typescript
// Core user type
interface UnifiedUser {
  id: string;
  email: string;
  displayName: string;
  role: AccountRole;  // 'owner' | 'admin' | 'manager' | 'member'
  platformId: string;       // Always PLATFORM_ID
  status: 'active' | 'suspended' | 'pending';
  mfaEnabled: boolean;
}

// Theme configuration
interface AdminThemeConfig {
  colors: {
    primary: { main: string; light: string; dark: string; contrast: string };
    secondary: { main: string; light: string; dark: string; contrast: string };
    background: { main: string; paper: string; elevated: string };
    text: { primary: string; secondary: string; disabled: string };
    border: { main: string; light: string; strong: string };
  };
  branding: { platformName: string; logoUrl: string; primaryColor: string };
}
```

---

## Autonomous Verification

> E2E tests (91 Playwright specs) cover auth flows, admin gateway, website builder, CRM, e-commerce, social, settings, and voice. Run via `npm run test:playwright`. See `tests/e2e/` for specs. 4 Jest unit test files cover orchestration, mutation engine, event routing, and analytics helpers.

---

## Document Maintenance

### Update Protocol

This document MUST be updated when:

1. **Route Changes:** New pages added, routes removed, or paths changed
2. **Agent Changes:** New agents added, agents deprecated, or status changed
3. **RBAC Changes:** New permissions, role modifications, or access changes
4. **Integration Changes:** New integrations added or existing ones modified
5. **Collection Changes:** Firestore schema modifications

### Mandatory Cleanup Rule

**All temporary audit logs, discovery documents, or draft architecture files MUST be deleted or archived within 24 hours of creation.**

This prevents documentation drift and ensures single_source_of_truth.md remains the sole authoritative reference.

### Update Procedure

```bash
# After any codebase change affecting this document:
1. Verify change against this document
2. Update relevant section(s)
3. Update "Generated" date at top
4. Commit with message: "docs: update single_source_of_truth.md - [change description]"

# For temporary audit/discovery documents:
1. Create in project root during session
2. Extract relevant findings into this document
3. Move original to docs/archive/legacy/ within 24 hours
4. Update archive README.md
```

### Archived Documents

Legacy documentation moved to: `docs/archive/legacy/`

**Forensic Audits:**
- `GROUND_TRUTH_DISCOVERY.md` - Jan 20, 2026 forensic audit
- `FEATURE_PARITY_AUDIT.md` - Admin vs workspace parity audit
- `FORENSIC_AUDIT_V3.md` - God Mode removal record
- `FORENSIC_AUDIT_BRIEFING.md` - Initial forensic briefing

**Architecture:**
- `SYSTEM_MAP_JAN_2026.md` - Previous route audit
- `SYSTEM_BLUEPRINT.md` - Previous architecture guide
- `ARCHITECTURE_GRAPH.md` - Previous dependency map
- `orchestrator-system-blueprint.md` - Jasper AI blueprint

**Operational:**
- `REDIRECT_*.md` - Redirect implementation docs
- `VERIFIED.md` - Progress log
- `workflow_state.md` - Temporary state

See `docs/archive/legacy/README.md` for full archive index.

---

**END OF SINGLE SOURCE OF TRUTH**

*Document generated by Claude Code multi-agent audit - January 26, 2026*
*Last updated: March 28, 2026 — Full 6-agent accuracy audit. Corrected 40+ stale claims against actual source code. Updated metrics (194 pages, 436 API routes, 1,746 TS files, 250 components, 58 agents, 53 permissions). Resolved all 6 "Critical Gaps" (all were already fixed in code). Updated social media from 4/10 to 8.5/10 (14 platforms wired). Updated onboarding from 6/10 to 8/10 (5-step with auto-save). Updated auth coverage to 100% (366 standard + 50 alternative + 20 intentional public). Corrected CSP claim (not implemented). Production readiness updated from ~80% to ~90%.*

> Session changelogs, launch gap analysis, and completed roadmap details archived in `docs/archive/`.
