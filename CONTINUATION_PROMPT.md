# SalesVelocity.ai — Full-Orchestration Continuation Prompt

---

# 🟢 GOVERNING PLAN (Jun 16 2026) — PARITY CERTIFICATION IS THE SPINE

**This section governs everything below it.** The active plan is no longer "ship features" —
it is **harden every existing vertical until it is certified as good or better than a named
competitor.** No new features are added until the certification registry is green. Everything
below this block (the video / Shot Doc spec, character system, etc.) is preserved working
context and is now reframed as **Vertical #1 (Video)** running through the rubric defined here.

## The new definition of "done"
A feature is NOT done because it compiles, lints, or the UI looks wired. A feature is done only
when it earns a **Parity Certificate**. "Code shipped" ≠ done. "Certified" = done.

## The Parity Certificate (the rubric — all 7 required, or it's not signed)
1. **Named benchmark.** The owner picks the competitor + the exact capability set being matched
   (e.g. "Email = Klaviyo core campaigns + flows"). No benchmark → no cert.
2. **Capability map FIRST (not name-matching).** Before any gap analysis, map the competitor's
   feature vocabulary → our equivalent capability by *what it does for the user*, never by label.
   Mapping is many-to-many. Only a capability that exists NOWHERE in our system is a real gap.
   See memory: parity-is-floor-not-ceiling.
3. **Functional parity ledger.** Every table-stakes capability of the incumbent marked:
   Matched / Consciously-declined (THEIR feature we don't need, with a reason) / Gap-to-close.
   Zero open gaps to certify. NEVER cut one of OUR abilities to match them — our extras are
   protected ("as good OR BETTER, AND MORE").
4. **Quality graded against theirs.** For every mapped capability, OUR version is judged against
   the QUALITY of THEIR version. Existence is cheap; "as good or better than their version" is
   the bar.
5. **Real-path proof.** A verify script drives the ACTUAL product path on REAL infrastructure
   (real Firestore via Admin SDK, real send/post/payment/render landing) — never "UI looks
   wired." This is the antidote to the dual-data-path lie (browser works / server silently
   returns []).
6. **Brand-DNA proof + non-technical usability.** Output carries the tenant's voice (the bake).
   A non-technical SMB owner can do it unaided: plain English, clarifying questions, no silent
   failure, and a manual UI path for every AI path.
7. **The named "better" + owner signature.** Each cert states the one thing where we BEAT the
   incumbent. The owner walks it once and signs. Nothing is done until he signs.

## The process loop (per vertical)
- **Audit (parallel, read-only).** Subagents audit the vertical against the named competitor and
  produce the capability map + gap ledger. Auditing CAN fan out across many verticals at once
  (cheap, read-only) to build the full honest gap map early.
- **Fix (serial, owner in the loop).** ONE vertical at a time. Claude orchestrates, subagents do
  the brunt, Claude reviews EVERY output before it counts, owner approves direction. Fixing is
  NOT parallelized across verticals — breadth-first is what produced the 60%-everywhere state.
- **Prove.** Write the real-path verify script. Not provable on real infra → not done.
- **Certify.** Owner walks + signs. Move on and don't look back.

## Phase 0 — prerequisite before certifying ANY vertical
1. **Honest inventory / triage** of the whole surface: every feature labeled
   **Live / Connected-but-unproven / Scaffold / Dead.** We don't yet know the true denominator.
2. **Fix the data-path debt** (client Firebase SDK on server routes → silent []). Until server
   paths are trustworthy, every cert is potentially fiction.
("Phase 0" is a prerequisite step in THIS plan — do not confuse it with the video build's
internal P0–P4 phases further below, which are scoped only to the Shot Doc feature.)

## The Certification Registry (single source of "are we there yet")
A living matrix: every vertical × its named competitor × status (uncertified / in-cert /
certified, date signed). A vertical with no cert is NOT shippable and NOT claimed as done.

## Sequencing (owner owns the order + the benchmark choices)
- **Phase 0 first** (inventory + data-path foundation).
- **Vertical #1 = Video / Shot Doc** (the detailed spec below — it's closest to the bar already,
  so it rides its momentum through the rubric and becomes the template for what "certified" feels
  like). Benchmark TBD by owner (e.g. Synthesia / Arcads / OpenArt).
- Then the remaining verticals one at a time, value-ordered (proposed: onboarding/identity →
  CRM + lead capture → one outreach channel → social → website → commerce → reputation →
  scheduling → analytics). Owner confirms order + each benchmark.

## Binding rules (memory-backed, govern every cert)
- Parity is the FLOOR not the ceiling; protect our extras; map by capability not name.
- Standing Rule #1 (Brand DNA baked at seed, never runtime) + #2 (no GM change without a human
  grade) are inviolable — no AI participant may "optimize" them away.
- Plain English to non-technical SMB owners; AI must ask clarifying Qs + never fail silently.
- Every AI capability has a manual UI equivalent.

---

# 🟢 PHASE 0 — HONEST INVENTORY + DATA-PATH DEBT LEDGER (Jun 17 2026)

This is the Phase 0 deliverable mandated by the Governing Plan (the prerequisite before any
vertical is certified). Produced by a 8-way parallel read-only audit of the whole surface.
Status vocabulary: **LIVE** (proven end-to-end on real infra) · **CONNECTED-BUT-UNPROVEN**
(wired to a real backend, no real-infra proof captured) · **SCAFFOLD** (UI only / mocked /
returns stub) · **DEAD** (orphaned/unreachable/superseded). NOTE: most of the surface is
**CONNECTED-BUT-UNPROVEN** — real code, real Admin SDK, but not yet driven on real infra by a
verify script. That is exactly what each Parity Certificate must convert to LIVE.

## The Certification Registry (single source of "are we there yet")
Every vertical is **UNCERTIFIED** until it earns a 7-point Parity Certificate. Benchmarks below
are PROPOSALS for the owner to confirm (he owns the order + the benchmark choices).

| # | Vertical | Proposed benchmark | Cert status | Headline blocker(s) |
|---|----------|--------------------|-------------|---------------------|
| 1 | Video / Shot Doc | OpenArt Smart Shot + Arcads (delivered video) | IN-CERT | ~~No final multi-clip stitch~~ **P4 DONE + PROVEN (Jun 17)**; remaining: no explicit script layer (P1); generate-all is synchronous |
| 2 | Identity / Onboarding / Brand | HubSpot setup + Durable-style URL prefill | UNCERTIFIED | Team-tasks collection mismatch; impersonation is a logging shell; dead /onboarding/industry link; Academy unseeded |
| 3 | CRM + Lead capture | HubSpot CRM core | UNCERTIFIED | **Duplicate-detection client-SDK-on-server → silent []**; Conversations + Living Ledger unproven |
| 4 | Outreach (Email/SMS/Sequences/Nurture) | Klaviyo campaigns + flows | UNCERTIFIED | Sequence/nurture engine gated OFF + unproven; **email-template-service client-SDK-on-server**; no visual flow builder |
| 5 | Social | Buffer + Sprout Social | UNCERTIFIED | **schedule/queue client-SDK-on-server**; per-platform posting unproven on live creds |
| 6 | Website builder | Webflow / Framer | UNCERTIFIED | Public /sites/* is client-rendered only (no SSR/SSG → SEO fail); custom domains unproven; store is config-only |
| 7 | SEO / Growth | Semrush | UNCERTIFIED | (strongest area — real DataForSEO/Serper/GSC) agent data sources opaque; schema-markup template-only |
| 8 | Commerce | Stripe Billing + Checkout | UNCERTIFIED | No proven live charge; **checkout config + coupon client-SDK-on-server**; recovery uses in-memory setTimeout (non-durable) |
| 9 | Scheduling / Meetings | Calendly | UNCERTIFIED | Reminders on unverified cron; single video provider (Zoom only); no per-rep booking links |
| 10 | Voice AI / Calls | Vapi / Bland.ai | UNCERTIFIED | ElevenLabs never reaches live call (robotic Polly); **call-context-service client-SDK-on-server**; voice agent NOT GM-driven (Standing Rule #1 violation) |
| 11 | Analytics | HubSpot reports | UNCERTIFIED | Core is real-computed (good); 3 orphaned client-SDK analytics services are a dead future-trap; no snapshot history |
| 12 | Agent swarm / Orchestration | Lindy.ai | UNCERTIFIED | **workflows/workflow-service + chat-session-service client-SDK-on-server**; duplicate lib/workflow (singular) dead dir |
| 13 | Content gen (text/image/music) | Jasper / Copy.ai | UNCERTIFIED | Music blocked on Replicate credit (billing, not code); CM→image/music client hand-off unproven |
| — | Integrations / OAuth / Webhooks / Cron | (foundation) | N/A | 7 OAuth providers + ~19 webhooks + ~24 crons code-complete but unproven; Zoom token stored plaintext; inbound-social-dispatcher cron missing from vercel.json |

## DATA-PATH DEBT LEDGER (Phase 0 part 2 — fix BEFORE certifying any vertical)
Root cause: `src/lib/db/firestore-service.ts` (`FirestoreService`) is the **client SDK**. On a
server path it has no auth context → Firestore rules silently return `[]` / writes fail silently.
The fix in every case = swap to `AdminFirestoreService` / `adminDb` (same API surface; mind the
`set` semantics: client defaults `merge:true` + auto-stamps `createdAt/updatedAt`, Admin defaults
`merge:false` + stamps nothing — pass `merge:true` and stamp explicitly with `FieldValue.serverTimestamp()`).

**CONFIRMED live server-path bugs (traced server route → service → client SDK):**
| File | Reached from | Impact |
|------|--------------|--------|
| `src/lib/crm/duplicate-detection.ts` | `/api/crm/duplicates` | Dedup always reports "no duplicates" |
| `src/lib/email/email-template-service.ts` | `/api/email-templates`, `/[templateId]` | Template list/CRUD silently empty |
| `src/lib/social/autonomous-posting-agent.ts` (queue/schedule/analytics methods via `FirestoreService`) | `/api/social/schedule`, `/api/social/queue` | Scheduling/queueing writes fail, GET returns [] |
| `src/lib/workflows/workflow-service.ts` | `/api/workflows`, `/[workflowId]` | Primary workflow CRUD silently empty |

VERIFIED on Jun 17 by importer-tracing before fixing (two audit claims were wrong):
- `src/lib/agent/chat-session-service.ts` = **FALSE POSITIVE** — the score-session route imports
  `triggerAgentAnalysis` from production-monitor, NOT this service; the service only *calls* the
  route via fetch and is otherwise imported solely by the `conversations` client page (client SDK
  correct there). Left untouched.
- `src/lib/voice/call-context-service.ts` = **DEAD, not live** — `callContextService.` has zero
  runtime consumers anywhere. Deferred to the Voice-vertical cert (convert when warm-transfer is wired).
| `src/lib/ecommerce/types.ts` `getEcommerceConfig` + `tax-service.ts` + `shipping-service.ts` + `payment-service.ts` | live `checkout-service.processCheckout` | Config reads empty mid-checkout; refund lookup empty |
| `src/lib/pricing/coupon-service.ts` | `agent/tools/discount-tool.ts` (AI agents at runtime) | Coupon validate/apply by agents fails (latent→live once agent tool runs server-side) |
| `src/lib/email/email-service.ts` (dynamic client-SDK import for send-logging) | `/api/email/send` | Send works; send-log persistence may fail silently |

**ORPHANED / DEAD client-SDK (delete after confirming zero importers — future traps, not live bugs):**
`src/lib/analytics/analytics-service.ts`, `ecommerce-analytics.ts`, `workflow-analytics.ts`;
`src/lib/outbound/nurture-service.ts`; `src/lib/forms/form-db-service.ts`;
`src/lib/forms/form-service.ts` (unused client-SDK fns only); `src/lib/ecommerce/product-service.ts`;
`src/lib/workflow` (singular dir — dead duplicate of `src/lib/workflows`).

**FALSE POSITIVES (no fix — `where/orderBy/limit/Timestamp` imported only as constraint-builders/types,
real I/O runs on Admin SDK):** the 7 flagged `/api/*` routes (dashboard/summary, calls, ai/fine-tuning,
ai/datasets, settings/security, nurture, notifications/preferences); all `src/lib/crm/*` except
duplicate-detection; `src/lib/crm/predictive-scoring.ts` (client-only consumer, correct).

## Notable non-data-path defects found (per-vertical fix ledger)
- **Identity:** Team Tasks broken e2e (`tasks` vs `teamTasks` collection mismatch); impersonation never
  mints a custom token (logging shell); `/onboarding/industry` 404s; Academy collection unseeded.
- **Voice:** Standing Rule #1 violation — voice agent uses static `PROSPECTOR_/CLOSER_SYSTEM_PROMPT`
  templates with runtime Brand DNA merge instead of a GM. Must move to a GM (and route ElevenLabs into live calls).
- **Risk/Reputation:** hardcoded fallbacks shown as real (`revenueAtRisk:0`, simulated history, sentiment `50/30/20`) — label honestly or compute.
- **Commerce:** all 11 payment processors are REAL integrations + switchable via `isDefault`; but no live
  charge proven and the "subs stay on original processor when switching" rule is not enforced in code.
- **Video:** P0/P2/P3 (doc structure, renderer, popups) are real & deep; **P1 (script layer) and P4
  (multi-doc final stitch) are NOT done** despite being implied complete. generate-all is synchronous (no submit→poll).

## PROGRESS LOG — Vertical #1 (Video) cert in flight
**Jun 21-22 2026 — NO-STITCH realignment + generation hardening + FIRST true E2E run (PROVEN).**
- **Engine no longer stitches.** Owner-confirmed: each shot renders as its OWN clip and all clips
  flow into the editor in play order; the operator stitches there (realigns with the original
  "stitch in the editor" vision — the auto-stitch was the deviation). Per-doc generate route drops
  `stitchShotPlan`; `docHasVideo` now = every shot has a clip (not a stitched `finalVideoUrl`);
  `seedEditorFromProject` hands one clip per shot, in order; review page previews a scene's first
  clip. `stitchShotPlan` itself kept (legacy path) but no longer called by the System B per-doc route.
- **Generation hardened (surfaced by the live run).** `generateAllShots` retries a failed shot once,
  then FLAGS it (`generated.status='failed'` + `error`) and CONTINUES — one bad shot no longer aborts
  the whole video; continue shots chain from the most recent good frame (`priorChainFrame`), degrade
  to a cut if none; persists after EVERY shot (partial progress survives). Fix: lighting-swatch label
  exceeded the 200-char cap and crashed that still (clamped).
- **Character library pollution FIXED.** Creating a character from library images now MOVES them
  (`removeLibraryRecordsByUrls` in createAvatarProfile) — removes the regular-library records (scoped
  to skip category 'character' so AI sheets are safe), mirroring the single-image move route. No more
  manual cleanup.
- **PROVEN:** `scripts/verify-video-e2e-no-stitch.ts` drove brief → System B project → 6 individual
  clips → editor handoff on live fal, **fully green (6/6, no stitch, editor receives all clips in
  order)**. Commits `ceb6bdf1` + `16dcc0a2` (dev), merged into rapid-dev, tsc/lint clean.
- **STILL OPEN for the cert:** VP-C (script form — was falsely "done", never built) → VP-D (script→
  Shot Doc handoff + entry fix + up-front saved-character picker) → VP-E (editor trim handles +
  post-production) → VP-F (cleanup) → OpenArt/Arcads capability-map + gap-ledger + owner sign-off.

**Jun 17 2026 — P4 (final multi-clip stitch) CLOSED + PROVEN.** The #1 gap vs every video
competitor ("generate all" produced loose clips, never a deliverable video) is fixed:
- `stitchShotPlan(plan, ctx)` in `shot-plan-generation-service.ts` — concatenates every generated
  shot IN ORDER into ONE video. Audio-preserving (the generic concat helper dropped audio):
  each clip normalized to a uniform frame (scale/pad/fps/sar) + uniform audio; an audio-less shot
  gets SILENCE synthesized at its exact duration so dialogue clips keep their sound. Ownership rule
  honored (final file → OUR Storage + media library; `plan.finalVideoUrl` never a temp CDN URL).
- New `ShotPlan.finalVideoUrl` (type + Zod + plan-edit union). Wired into
  `/api/content/shot-plan/generate-all` (auto-stitch after all shots; on stitch failure the per-shot
  clips are preserved + a plain-English warning returned — never silent). New manual/retry route
  `/api/content/shot-plan/stitch`.
- UI (`ShotPlanSheet.tsx`): final-video player + Download + a "Build / Rebuild final video" manual
  button (UI-parity), plain-English non-silent errors.
- **Real-infra proof:** `scripts/verify-shot-plan-stitch.ts` (no fal spend — synthesizes test clips
  incl. a no-audio/different-size clip) → stitched 1280x720+audio + 640x480 no-audio into ONE 4.03s
  1280x720 video WITH audio on real Firebase Storage. tsc + lint clean.
- REMAINING for the Video cert: P1 explicit timed-script layer (a `script-generation-service.ts`
  already exists — assess + finish); generate-all submit→poll split (currently synchronous); then the
  formal OpenArt capability-map + gap-ledger + owner walkthrough/sign-off.

---

# 🟢 RESUME HERE — Jun 27 2026 — VERTICAL #2 (CRM) audit + MONETIZATION model

## CRM GAP LEDGER (benchmark: Pipedrive + HubSpot + Reevo) — from read-only audit Jun 27
**Headline: the CRM is genuinely DEEP + real** (Admin SDK data layer, no fakery) — much closer to
parity than video was. Contacts/Companies/Deals/Leads all LIVE + real lead-scoring (1549 LOC),
forecasting, automation, atomic dup-merge, and in-CRM quotes/invoices/payments.
Keys: ✅ matched · ⚠️ GAP (work) · 🛡️ our-extra (protect)

**LIVE (✅):** Contacts/People · Companies · Deals (CRUD/value/probability/stages) · Leads + scoring/
routing · Reporting/forecasting · Automation/workflows · Email send+tracking+templates+sequences ·
CSV import + duplicate-detect/merge · AI lead-scoring/next-best-action/enrichment (rule-based).

**GAPS — the finite work list to certify CRM:**
1. ⚠️ **Drag-drop pipeline kanban** (board is static columns; `@dnd-kit` installed but unused) — Pipedrive's signature interaction
2. ⚠️ **"Log a call/meeting/note" UI button** (backend POST + 25 activity types exist; no button) — table-stakes
3. ⚠️ **Custom-field management UI** (model has `customFields` everywhere; no admin screen to define them)
4. ⚠️ **CSV export** (import is LIVE; export route MISSING)
5. ⚠️ **CRM-native telephony** (click-to-call / call logging bound to contacts; only agent-swarm Twilio today)
6. ⚠️ **Inbound email depth** (send+tracking strong; two-way receive/thread-on-record only partial)
7. ⚠️ **AI bound to records** ("draft this email" / "summarize this call" on a contact — lives in the swarm, not surfaced on records — where HubSpot/Reevo shine)
- ⚠️ **DATA-PATH RISK:** forms→CRM lead-capture (`src/lib/forms/crm-mapping.ts`) uses the CLIENT Firebase SDK with NO `/api` server route — verify leads aren't silently dropped before trusting it.
- 🛡️ **OUR EXTRAS (protect):** in-CRM quotes/invoices/payments (CPQ-adjacent) · next-best-action engine (796 LOC) · trainable multi-factor lead scoring · atomic dup-merge w/ FK re-parenting · skill/territory/load-balance routing.

**ARCHITECTURE DECISION (owner Jun 28): Option 1 — bespoke CRM pages, retire the generic
`/entities` redirect; build AI-forward (Reevo bar).** The `/entities/[entityName]` engine and the
bespoke pages were two parallel ways to show CRM records (contacts went through the generic engine
via a `/contacts → /entities/contacts` redirect; companies/deals were already bespoke). Consolidating
on bespoke pages.

**CRM LEDGER PROGRESS (Jun 28):**
- ✅ **#2 manual activity logging** — `LogActivityModal` (reusable: contact today, deal next) +
  contact detail timeline now shows REAL activities + live refresh. Real-path proven
  (`scripts/verify-activity-logging.ts`: log → persist w/ correct backdate → read back → cleanup).
- ✅ **Bespoke contacts list** (`/contacts/page.tsx` — was a redirect) mirroring companies (DataTable:
  search + bulk-delete + CSV export); rows → `/contacts/[id]`. `/entities/contacts` now redirects to
  `/contacts`. Nav already pointed to `/contacts`.
- ✅ **#4 CSV export (contacts)** — free via the shared DataTable on the new list.
- ▶ **NEXT: Step 2 — AI-forward contact detail** (= gap #7): surface next-best-action + "Draft email"
  + "Summarize activity" on the record (we own the engines; just not surfaced). Then #1 drag-drop
  pipeline, #3 custom-field UI, #5 telephony, #6 inbound email.

## MONETIZATION MODEL — FINALIZED (owner-confirmed Jun 27–28; for the multi-tenant flip)
**TWO subscription types (mutually exclusive):**
1. **BYOK ("advanced") — flat $297/mo.** Client gets + fills their OWN API keys (~12 providers) and
   pays the providers directly. One flat software fee; no credits from us.
2. **Done-For-You (managed) — lower tiered monthly + included credits.** Client uses OUR keys. Each
   tier = a lower base price + a set credit allowance (credits scale up by tier). Burn through it →
   buy OVERAGE credits at a HIGHER rate. The credit markup is our margin. Heavy users naturally
   graduate to BYOK (we stop floating their provider cost).

**PRICING SOURCE — reuse the EXISTING Products & Services catalog** (`products/page.tsx` +
`products/services`), NOT a new price-book. BUT as a **PLATFORM-LEVEL service catalog WE control**:
each AI capability (video, image, voiceover, agent task, …) is a product/service with a credit
price. Clients set THEIR OWN product pricing; they can **NEVER** edit the AI/platform pricing.

**COST TRANSPARENCY — SYSTEM-WIDE (hard requirement, not just the video generator):**
- Client ALWAYS sees their token/credit **balance**.
- BEFORE EVERY generation on EVERY AI across the system (video, image, voice, text, agents — all of
  it) → show the **projected credit/token cost** so they decide informed. No bill shock.
- AFTER → meter actual → deduct from wallet → log to ledger → **spend dashboard** (track expenses).
- **ARCHITECTURE:** every AI call site routes through ONE **cost gateway** (estimate → balance check
  → confirm → meter), so "show projected cost + balance" is consistent everywhere instead of
  bolted onto each feature one at a time.

**PRICING LEVERS (owner-tunable; SET FROM REAL LEDGER DATA, not guesses):** $/credit value · margin
multiplier on the catalog (fat on video/voice, thin/near-free on text) · included credits per DFY
tier (size to typical usage) · overage rate (always > the included effective rate → the upgrade lever).

**BUILD ORDER:** usage ledger (capture real cost per action across ALL AI) → wire the platform
service catalog as the price source → pre-commit estimate + balance UI at EVERY AI call site (the
cost gateway) → credits wallet (prepay / reload / overage deduct) → tiered billing + Stripe + BYOK $297.

**RISK to verify FIRST:** some providers' ToS may forbid reselling their API under a master account
(the DFY tier) — per-provider check before committing.
**STATE:** metering SEAM exists (`recordUsage` in `src/lib/ai/providers/*` + `video/providers/
credentials.ts`; per-tenant keys via `apiKeyService`). Ledger / catalog-wiring / estimate-gateway /
wallet / billing are NOT built.
**NOTED:** `APIKeyService` Firestore-listener flooding ("max retries" → TTL fallback; non-fatal) —
likely a listener-teardown leak in `api-key-service.ts`; harden as part of the BYOK key work.

---

# 🟢 RESUME HERE — Jun 26 2026 — VIDEO: character/style fixes DONE; LOCATION-CONSISTENCY is next

## Proven + committed today (commit `05b3a16a`, synced rapid-dev↔dev)
All verified on real generation runs during the manual walkthrough:
- **Gender lock** — saved characters now carry a `gender` field (schema + service + 2 API
  routes + Character Studio dropdown); the planner INHERITS it instead of guessing (a
  genderless Velocity is why it once rendered a woman). Velocity set to `male` in Firestore.
- **Whole-scene art-style consistency** — a stylized/anime saved character drives the WHOLE
  production's art style (`deriveProductionArtStyle`); the storyboard still + the environment
  hero both honor it (dropped the hardcoded "Photographic, film-grade" and the movieLook/
  filmStock terms for stylized). Fixes the Pixar-character-in-a-photoreal-room clash —
  proven: Velocity + the second character + the ROOM all render consistent Pixar.
- **Logo end-card** — a brand-logo-moment renders a clean solid backdrop (no room/cast) and
  composites the operator's REAL logo. Velocity's reference set to the clean grey-bg FRONT.

## 🎯 VIDEO VERTICAL — GAP LEDGER (the finite list to certify; benchmark PER PIECE)
Keys: ✅ matched · ⚠️ GAP (open) · ❓ needs-verify · 🛡️ our-extra (protect) · ⏸️ deferred

**Piece 1 — Shot Doc** (bar: RenderZero detail + OpenArt Smart Shot visual + per-section editing)
- ✅ AI authors the full shot doc (cast, environment, objects, blocking, prompts, page layout), brand DNA baked
- ✅ Visual shot-doc representation (OpenArt-style) + cinematic controls + ~400 presets
- ✅ (today) gender locked from character · whole-scene art-style consistency · logo end-card on solid bg
- ⚠️ **Blocking map NOT visually obeyed** — stills don't follow the floor-plan layout (windows/props/door). THE big one.
- ❓ Per-section EDITING of the shot doc (owner wants to edit each section) — verify what's editable today
- ⚠️ Character reference-image pollution (scene-stills mixed into the refs) — clean up
- 🛡️ interview-first Content Manager + brand-baked agents

**Piece 2 — Render / engine** (bar: consistent, usable clips)
- ✅ per-shot render (no forced stitch) · 5s action + 2s freeze tail · character + logo compositing — proven E2E today
- ⚠️ location/room consistency shot-to-shot (drifts — ties to the blocking build)
- ⏸️ lip-sync (accepted weak link, deferred)

**Piece 3 — Character / cast** (bar: persistent reusable cast)
- ✅ saved characters · gender · art style · reuse + identity anchors
- ⚠️ reference-set hygiene (scene-stills appended) · auto-append new looks to a profile
- 🛡️ persistent digital cast (Arcads stock-actor model consciously DECLINED)

**Piece 4 — Location / set** (bar: reusable locked sets)
- ✅ saved locations (name, description, reference images), reusable across videos
- ⚠️ top-down-map ingestion + the generator OBEYING it (**Option 1 — the next build below**)
- ⏸️ upload video → auto-build map (deferred)

**Piece 5 — Editor** (bar: AI-powered **CapCut MOBILE** + Premiere Pro)
- ✅ timeline · trim · split-at-playhead · transitions · per-clip effects · text overlays · server-side stitch/export
- ⚠️ CapCut-mobile gaps: music/audio track + volume/fade · speed control · filters · auto-captions · stickers · aspect-ratio/canvas · AI auto-cut
- ⚠️ Premiere gaps: multi-track timeline · audio mixing · color grading · keyframe animation
- ⚠️ (today's bugs) clips don't drop LIVE (refresh needed) · export has no progress/preview · slow project load (~11s)

**Piece 6 — Finish → Post-Production → Publish** (bar: stitch → choose platforms → publish/schedule)
- ✅ stitch + save final to Library works (proven) · social/publishing layer already EXISTS (`src/app/api/social`)
- ⚠️ NO clear "Stitch & Finish" button / progress / final preview
- ⚠️ NO post-production → publish handoff (connect the editor's final video into the social flow: platforms, caption, schedule)

**Other verticals' benchmarks (owner-stated Jun 26 — logged for when Video is certified):** CRM = Reevo /
Pipedrive · Social = Sora + SocialBee / Postrillo / Buffer / ContentStudio / Hootsuite(OwlyWriter) ·
Website builder = AI-powered Elementor Pro.

## 🔵 NEXT FOCUSED BUILD (owner chose "Option 1") — TOP-DOWN-MAP-DRIVEN LOCATION CONSISTENCY
**Goal:** operator uploads/attaches a TOP-DOWN MAP to a saved location; the system *reads/
understands* that map, builds the reusable location from it, and renders every shot consistent
with the map's windows, props, assets, and lighting. (The user PROVIDES the map — no auto-
reconstruction.) This is the real version of the blocking-as-visual-bible fix.

Pieces (honest difficulty):
1. Attach a top-down map image (+ optional photos/video) to a `LocationProfile` — small.
2. **Vision model READS the map → structured `floorPlan`** (walls, windows, named assets +
   positions/zones) + a locked set description — moderate; this is the "understanding" step
   that replaces the planner GUESSING the floorPlan.
3. Named map assets (desk, corkboard, copy machine…) → locked OBJECT reference anchors so each
   prop renders identically every shot — moderate (object-anchor system already exists).
4. Generate eye-level "set renders" of the room FROM the map / each camera position, used as
   the per-shot room anchor that locks walls/windows/lighting — moderate-hard (the payoff).
5. Camera placement on the map already exists (`FloorPlanCanvas`) — repoint it at the saved
   location's map.
**Realistic effort:** a focused multi-week build. **Quality ceiling to set expectations:** image
models approximate spatial layout — set-render anchors get MUCH closer to "matches the map," but
pixel-perfect exact-layout-every-time is at the edge of current models. Start map-provided
(Option 1); the consistency payoff comes first.

## 🔵 ALSO NEXT — EDITOR FINISH FLOW + POST-PRODUCTION PUBLISHING (owner-flagged Jun 26)
Current editor export is opaque: clicking Export silently stitches + saves to Library with a
tiny, missable "Saved to Library — open" pill — **no progress, no in-editor preview of the
final video, and NO next step.** (Underneath it DOES work: the stitch+save runs server-side
~30-40s and the final "Edited Video" lands in the Library as category `final` — proven this
session, mediaId `os5N3UbtvwYqkh3phm3y`.) Owner's intended flow:
**[Finish/Stitch button] → one combined video → POST-PRODUCTION screen → pick platforms →
caption/schedule → publish.**
Pieces (honest):
1. **Editor finish UX** — a clear "Stitch & Finish" button + real progress (the render takes
   ~30-40s) + an in-editor PREVIEW of the final video (not just a pill). Moderate.
2. **Post-production → publish handoff** — the social/publishing layer ALREADY EXISTS
   (`src/app/api/social`: accounts, calendar, connect, approvals, posting). So this is
   CONNECTING the editor's final video into that flow + a post-production UI (platforms,
   caption, schedule), NOT building publishing from scratch. Moderate.
3. **Bugs found this session:** clips don't drop into the editor LIVE as they render (operator
   had to refresh — "clips never drop until refresh"); and `GET /api/video/project/[id]` is
   slow (~11s — it returns the whole heavy project). Small-moderate.

## ⏸️ DEFERRED / LATER (owner: address later)
- **Auto video → top-down map** (photogrammetry / SLAM 3D reconstruction so the operator
  uploads a walkthrough video and the system BUILDS the map). Genuinely hard / likely external
  tooling — its own project. Do AFTER Option 1; it becomes an enhancement (AI-estimate the map),
  not a prerequisite.
- Cleaning leftover scene-still junk out of saved characters' reference sets.

---

# 🟢 RESUME HERE — Jun 20 2026 — VIDEO FRONT-DOOR REWIRE (owner-confirmed decisions)

**Why:** Manual video creation currently DROPS THE USER STRAIGHT ONTO THE SHOT DOC
(`StepStoryboard` → `ShotPlanSheet`) with an empty "Untitled shot" — it skips the RenderZero
scene-detail form entirely (that form, `StudioModePanel`, still exists but is wired only to the
Image Generator page as a one-shot generator, not to the video pipeline). The earlier "phase-out"
of the RenderZero authoring UI was wrong; it is being RECONNECTED as the ordered front door.

**Owner-confirmed pipeline (the spec — locked Jun 20):**
`Prompt → Screenwriter/Director agent → RenderZero form (the timed script, scene-by-scene,
AI-prefilled + human-editable) → "Generate Shot Doc" → Shot Doc agent → review/edit → generate
clips → editor (trim handles make stitching clean) → post-production (tag / reformat per platform /
schedule to social hub calendar).`

**Confirmed design decisions (do not re-litigate):**
1. **Two ordered stages, two brains.** Stage 1 = a dedicated **Screenwriter/Director agent**:
   prompt + baked Brand DNA → a **timed script** (the source of truth for duration + scene/shot
   structure). Stage 2 = the **Shot Doc agent** (the existing `SHOT_PLAN_PLANNER`): approved
   script → the visual Shot Doc. Owner explicitly confirmed a dedicated screenwriter stage (the
   old plan left this as "not a new agent unless owner confirms" — he now confirms). Split exists
   so the cheap creative+timing review (read/edit the script) happens BEFORE expensive keyframe
   render. Standing Rule #1 (Brand DNA baked into the new agent's GM at seed) + #2 apply.
2. **Scenes are STORY BEATS, not locations.** One location can host many scenes. ⇒ Locations are
   a **reusable list at the VIDEO level**; each scene references a `locationId`. Scenes sharing a
   location reuse the same environment look (free visual continuity). Do NOT model one-scene-per-
   location.
3. **The RenderZero form is the editable face of the timed script.** It is multi-scene (the AI
   director decides how many scenes + pre-fills every field; human reviews/edits). It is the
   "every possible detail is accounted for" guarantee so the Shot Doc agent has everything.
4. **No preview-render buttons on the form.** Strip Queue Image / Queue Scene / Queue Video from
   the form's video-pipeline role — generation is the Shot Doc's responsibility. Only forward
   action = "Generate Shot Doc". (The Image Generator page keeps its own generator instance.)
5. **Timed-script fields that DON'T exist yet (the real gap):** per-line spoken dialogue with
   **speaker identity**, **start/end time per line**, **delivery note**; **on-screen text/captions**;
   **per-clip frame-trim handles** (pre-roll/post-roll for clean cuts + audio crossfade — absent
   today; the stitcher just butt-joins); **timed SFX/stingers**. Today voiceover is untracked
   narration.
6. **Consolidate the duplicate brains.** Three agents currently produce overlapping storyboards:
   `SHOT_PLAN_PLANNER` (keep — the modern one), `VIDEO_SPECIALIST` (retire or repurpose),
   `script-generation-service` (fold into the new Screenwriter agent), and `DirectorService`
   (`src/lib/video/engine/director-service.ts` — DEAD hardcoded non-LLM code, delete). One brain
   per stage; no competing storyboards. `VIDEO_EDITOR_SPECIALIST` (OpusClip-style highlight finder)
   is a different stage — keep.

**Approved FIELD LIST (the "every detail" spec — owner approved Jun 20):**
- *Video level (once):* brand (auto from Brand DNA), goal/objective, core message/key points,
  audience, platform(s), runtime, tone/vibe, overall look bible (palette/mood/film look), music
  direction, CTA, cast (saved Characters), **Locations[] (reusable; scenes reference these).**
- *Scene level (story beat; references a locationId):* scene purpose, location(ref), time of day,
  weather/light, environment/hero look, characters present + wardrobe/state, ambience/sound bed,
  scene mood.
- *Shot/cut level (the camera-grade controls that already exist):* shot type, camera/movement,
  focal length, lens type, lighting, film stock/movie look/videographer style, composition, art
  style, action/blocking, duration, transition in/out.
- *Timed-script layer (NEW):* spoken lines {speaker, text, startSec, endSec, deliveryNote},
  on-screen text/captions, per-clip frame-trim handles {preRoll, postRoll}, timed SFX/stingers.

**BUILD SEQUENCE (foundation-first; subagents do the brunt, Claude hard-reviews each before the
next fires; owner reviews each delivery). Each phase: tsc + lint clean, seed-run if a GM changed,
real-path verify script, no shortcuts named-or-hidden.**
- **VP-A — Data model/types (FOUNDATION, do first): ✅ DONE + VERIFIED (Jun 20).** Types in
  `src/types/video-script.ts` (ScriptDocument / ScriptScene[story-beat, locationId] /
  ScriptShot / ScriptLine[speaker,startSec,endSec,deliveryNote] / trim-handles / on-screen-text /
  timed-SFX) + reusable VideoLocation[] + `VideoProject.script?` extension. Reuses CinematicConfig.
  Zod + parity guards + `endSec>startSec` refines. tsc + lint green (re-verified by Claude).
- **VP-B — Screenwriter/Director agent (Stage 1): ✅ DONE + PROVEN LIVE (Jun 20).** New real-LLM
  specialist `src/lib/agents/content/screenwriter/specialist.ts` (`generateScript`) reads
  `gm.systemPrompt` verbatim (no runtime Brand DNA). GM seeded:
  `sgm_screenwriter_director_saas_sales_ops_v1` (Brand DNA baked, 10792→12066 chars). Live proof:
  real Opus call → valid ScriptDocument (4 scenes/7 shots/30s, 1 location reused across beats,
  timed speaker lines + trim handles, on-brand). All prebuild guards green (tsc/lint/brand-dna/
  pirate-coverage/registry). Model: claude-opus-4.6 (top Opus the ModelName union exposes).
- **VP-C — RenderZero form = editable face of the script: ❌ NOT DONE (was falsely marked done
  Jun 20; corrected Jun 22).** `VideoScriptForm.tsx` was **never committed anywhere** (verified:
  no commit on any branch, absent from dev + rapid-dev). The claimed entry-bug fix is also absent —
  `StepStoryboard` still renders `<ShotPlanSheet/>` directly (jumps straight to the Shot Doc). STILL
  TO BUILD: `src/app/(dashboard)/content/video/components/VideoScriptForm.tsx` (multi-scene editable
  face of a ScriptDocument: video-level fields, reusable locations[], story-beat scenes w/ locationId
  SELECT, shots reusing `CinematicControlsPanel`, timed lines w/ speaker SELECT, on-screen text, SFX,
  trim handles; live derived runtime; AI-prefill via the existing `POST /api/content/video-script/
  generate`). Fix `StepStoryboard` to OPEN THE FORM first. FOLD IN: the up-front "use a saved
  character" picker (today's gap — the brief→build path can't bind a library character, so it always
  invents; see Jun 21-22 log) + carry invented-character display names instead of raw ids ("new_1").
- **VP-D — Handoff + entry fix:** "Generate Shot Doc" → Shot Doc agent (SHOT_PLAN_PLANNER) consumes
  the approved script → Shot Doc review. Re-wire the manual-creation entry to OPEN THE FORM (fix the
  bug where it jumps to the Shot Doc). AI-assisted path lands on the same prefilled form.
- **VP-E — Editor handoff w/ trim handles + post-production stage** (tags, platform reformat,
  social-hub calendar).
- **VP-F — Consolidation/cleanup** (retire VIDEO_SPECIALIST + script-generation-service into the new
  agent; delete dead DirectorService).

---

# 🔴 Jun 15 2026 — HEDRA FULLY REMOVED (video engine = fal / Seedance via Shot Plan)

Per the owner's go-ahead, the entire legacy Hedra pipeline was removed. The live video flow is
now the **Shot Plan** tool (Content → Video) → renders each shot on **fal / Seedance** (last-frame
chaining) → hands clips to the standalone editor. Deleted: `hedra-service.ts`,
`hedra-capability-service.ts`, `hedra-prompt-agent.ts`, `hedra-prompt-translator.ts`,
`scene-generator.ts`, the `HEDRA_SPECIALIST` agent, the old wizard steps
(`StepGeneration`/`StepAssembly`/`StepPostProduction`/`StepPublish` + `SceneProgressCard`/
`EngineSelector`/`HedraCharacterBrowser`), and the routes `/api/video/{generate-scenes, poll-scenes,
regenerate-scene, scene-review, scene-preview/save, decompose, calendar/generate-all, assemble,
stream, avatar-profiles/sync-hedra, avatar-profiles/hedra-characters}`. `/api/content/video/generate`
is inert (redirects to Shot Plan). Image gen + Studio image/edit tools repointed to fal (Flux +
Flux Kontext); image auto-select defaults to fal. The `hedra` API-key field → **fal.ai (Seedance)**.
Jasper's `produce_video`/`generate_video`/`assemble_video`/`get_video_status` redirect to the Shot
Plan tool. tsc + lint clean. **Everything below this entry that references Hedra is historical** —
those notes document the work as it happened and are superseded by this entry.

**DEFERRED (owner, Jun 15 — "not tonight"):** the Studio composer's "Video" tool
(`/api/content/video/generate`) and Jasper's in-chat video tools
(`produce_video`/`generate_video`/`assemble_video`/`get_video_status`) are currently **stubbed** —
they return a clear message pointing the operator at the Shot Plan tool rather than generating. They
were NOT rewired to Seedance because their old flow also depended on the now-deleted polling route, so
a correct rewire is its own task. **TODO when picked up:** decide (a) fully wire them to Seedance (the
Studio quick-video route would generate via the fal provider + a sync/persist path; Jasper tools would
build a ShotPlan and call the shot-plan generate flow), or (b) keep them as redirects to the Shot Plan
UI and remove the dead tool surface. Files: `src/app/api/content/video/generate/route.ts`,
`src/lib/orchestrator/jasper-tools.ts` (the four `case` handlers), and the Studio video tab in
`src/app/(dashboard)/content/video/studio/page.tsx` (which still polled the deleted route).

---

# 🔴 RESUME HERE — Jun 14 2026 — SHOT DOC: adaptive cinematic production system (SPEC — awaiting owner sign-off)

**One-line:** Recreate & exceed OpenArt Smart Shot's adaptive production sheet, with NO length
cap. Brief → timed script → one or more ordered **Shot Docs** → chained renders → stitched in
the editor → any length (shorts → feature films / TV series). Each Shot Doc is a data-driven,
self-describing document that reflows to its content, with a master visual overview + click-to-
expand detail popups that double as the edit surface.

**Discovery (from the operator's real OpenArt artifacts, NOT marketing — those were wrong):**
- The document's STRUCTURE changes per video (1 char fills §1 + notes; creature+object adds an
  object MODEL SHEET block and relabels notes "MATERIAL LANGUAGE"; 3 men + a tribe → 3 char
  columns + 1 GROUP column + palette-ref column; multi-location → N environment heroes + a
  continuous cross-location top-down ROUTE strip). ⇒ an intelligence layer AUTHORS the doc's
  shape; a renderer lays out whatever shape it's handed.
- Their tool DID do 5 scenes with one camera route across all locations (artifact 214400).
  Multi-scene is real; the marketing "single-scene only" claim is false for what it produces.
- "High quality" (artifact 221305) = MORE structural reasoning: lead vs supporting cast,
  consolidating ~9 locations into 3 ENVIRONMENT ZONES, and a storyboard header showing
  "(55 SECONDS TOTAL)". Their sheet DERIVES runtime; we make the timed script the source of
  truth so length is unlimited.
- Measured ratios: 4-section doc ≈ 1.49:1 (141853=1.498, 214400=1.493, 221305=1.497); 3-section
  OpenArt sheet = 1.91:1. §1:§2 width = 766:916 ≈ 6:7. Full-body figure H/W ≈ 2.7 (≈3:8);
  close-up ≈ 3:4. Hero ≈ 50% of §2. Storyboard = 5 frames ~16:9. Pipeline is image-first →
  image-to-video (GPT-Image-2 + Seedance 2.0); we're already on fal + Seedance 2.0.

## THREE INTELLIGENCE LAYERS (the part we're missing today)

**1A. Script layer (timed).** Brief (+ saved characters/refs/Brand DNA) → full script with
timing baked in. `ScriptDocument{ title, totalSeconds (derived), scenes[] }`,
`ScriptScene{ index, slug, summary, location, timeOfDay, startSec, endSec, beats[], transitionOut }`,
`ScriptBeat{ action, dialogue?, durationSec, suggestedShotType?, isSceneEnding }`. The script is
the SOURCE OF TRUTH for duration + where scenes end. Runtime emerges; no length slider.

**1B. Segmentation layer (multi-doc).** Reads the timed script → decides HOW MANY Shot Docs +
their order. Heuristic: one doc per scene, OR group consecutive scenes sharing environment+cast
into one doc (like the 3-zone consolidation). Cap per-doc cuts to a legible range (~3–8).
`VideoProject{ id, title, script, docs: ShotDocRef[] (ordered, each remembers which scenes it
covers) }`. Each doc's LAST rendered frame seeds the NEXT doc's first frame (existing
continue/cut mechanism) so the editor stitches in order → unlimited length.

**1C. Document-structure layer (self-describing).** Per doc the planner authors STRUCTURE, not
just content: `subjectBlocks` typed `lead|supporting|group|creature|object` (each: which
reference views — turnaround for people, model-sheet for objects/vehicles, material-language for
creatures — + notes + role + palette); `environmentZones` (label + heroImage + setDesignBullets
+ which cuts occur there; many locations may collapse into fewer zones); `route` (ordered path
across zones for the continuous top-down strip, per-cut camera nodes + arrows + subject paths);
`cuts` (per-cut camera package + durationSec from script + transitionIn + action/dialogue);
`lightingSetups` (one per zone/mood + swatch); moodKeywords; cinematographyNotes; full lookBible;
`adaptiveLabels` (e.g. "Character Notes" vs "Material Language").

## THE INTELLIGENCE IS THE PRODUCT
The planner is a genuine cinematic PRODUCTION DESIGNER that authors a complete pro document on
every request — NOT a form-filler. It must reason about: lead vs supporting cast; consolidating
many locations into ENVIRONMENT ZONES; which reference views each subject needs (turnaround for a
person, MODEL SHEET for a vehicle/object, COSTUME/ACCESSORY DETAIL for wardrobe-heavy characters,
MATERIAL LANGUAGE for creatures); camera grammar; and timing. **Run this planner on Opus 4.8
(claude-opus-4-8), not Sonnet** — it's the most demanding reasoning task in the app and document
quality is gated by model taste. GM still holds the prompt (Standing Rule #1); we just point it at
the top-tier model. Costume/accessory parity is already in motion: FACE CLOSE-UP + COSTUME/
ACCESSORY DETAIL views were added to character-sheet generation Jun 14; the planner decides PER
SUBJECT which detail views matter.

## HARD VISUAL RULES (non-negotiable in the layout engine)
1. **No blank sections, ever.** Missing data → the grid REFLOWS to fill space; never render an
   empty cell or a big blank gap.
2. **No ugly text walls on the master.** The master sheet is VISUAL — images, swatches, tiny
   labels, short captions only.
3. **Prose + deep detail live behind the additional-info icon.** Full character notes, set-design
   lists, cinematography notes, per-cut breakdowns all open in a POPUP, not on the face of the doc.

## RENDERER = RULES-DRIVEN LAYOUT ENGINE (not a fixed poster)
Reads the structure and reflows. Off-white (stone-300) paper, zoom/pan, ≈1.49:1.
- Header: cut count + TOTAL RUNTIME (from script) + palette chips + environment fingerprint.
- §1 Character Reference: splits width across subjectBlocks (+ palette-ref column). 1 subject →
  fills width (spread reference row + large Character Notes + palette). N subjects → N columns
  sized to content (lead/group wider), each = full-body turnaround row over close-up row + name +
  brief notes. Ratios: full-body ≈ 3:8, close-up ≈ 3:4.
- §2 Environment/Set Design: one hero per zone (splits width) + continuous top-down ROUTE strip
  divided per zone w/ per-cut camera nodes + arrows (single scene → one stage; multi → chained).
  Set-design bullets per zone.
- §3 Storyboard: one frame per cut, in order; ~16:9 still + caption (lens·move·size·duration +
  action); header shows "(NN SECONDS TOTAL)".
- §4 Lighting/Mood/Style: swatches (per setup) | mood pills | lens + cinematography notes (richer
  than theirs — every captured field).
- Footer: assembled video prompt + Generate.

## DETAIL LAYER (progressive disclosure) — REPLACES the Review/Edit mode toggle
- Master Shot Doc = visual overview. Click a storyboard frame → popup = that CUT's mini shot doc
  (keyframe, full camera/lens, action, dialogue, prompt, chaining to prev frame) — view + edit.
- Click a section's detail icon → popup = that section fully expanded (every field, per-cut
  overrides, full notes), scrolls on overflow.
- ONE popup level max; popups scroll, never nest. Popups read/write the SAME plan object — edits
  propagate to the master instantly (single source of truth).
- Reuse existing UI as popup bodies: FloorPlanCanvas, per-shot editor, CinematicControlsPanel.
- Multi-scene: scene popup = smaller Shot Doc; cut popup = one cut.

## DATA MODEL
- NEW: ScriptDocument/ScriptScene/ScriptBeat; VideoProject envelope (ordered docs + chaining
  frames). EXTEND ShotPlan → "ShotDoc": subjectBlocks (typed), environmentZones, multi-zone
  route, per-cut durationSec, lightingSetups, adaptiveLabels. Much already exists (cast, objects,
  floorPlan, lightingSwatches, lookBible, shots). Persist project + ordered docs to Firestore
  (autosave already wired for single shotPlan).

## GENERATION PIPELINE (image-first; Seedance 2.0; ownership rule)
Script (LLM) → segment into docs → per doc: characters (turnarounds) → environment heroes/zones →
floor-plan/route backdrop → lighting swatches → storyboard keyframes (Flux/GPT-Image-equivalent)
→ per cut: image→video via Seedance 2.0 chained by last frame → stitch all docs in editor.
Consistency via identity anchors + last-frame seeding. All fal temp assets persisted to Firebase
Storage + createAsset.

## AGENTS (reuse, don't proliferate)
- Repurpose SHOT_PLAN_PLANNER GM into the document-structure author (exists; widen output schema
  + GM, reseed). Script-writing = a step/role on the planner or Content Manager, NOT a new agent
  unless owner confirms. Standing Rules #1/#2 intact (Brand DNA baked at seed; GMs change only via
  graded human edits).

## BUILD PHASES (parallel-agent-hours; each: tsc+lint clean, seed-run if GM changed, verify
   script, owner walkthrough before next)
- **P0 (done / in-flight):** off-white adaptive single-doc renderer w/ measured ratios, char
  columns, turnarounds + face/costume views, planner per-character notes, "Shot Doc" rename.
- **P1:** renderer → true layout engine (subjectBlocks / zones / continuous route); planner emits
  self-describing structure.
- **P2:** detail popups (cut mini-doc + section expand); remove the Review/Edit mode toggle.
- **P3:** timed-script layer + segmentation + VideoProject ordered docs + chaining persistence.
- **P4:** multi-doc stitch in editor → feature length.

## CHARACTER SYSTEM (P-CHAR) — identity vs wardrobe + select/create + auto-save
Core principle (owner, Jun 14): **ALL character detail is ENGINE INPUT first; display is optional.**
The full appearance feeds the generation prompt for accuracy; the master sheet shows only
name/role/thumbnail; everything else lives behind the additional-details popup (viewable + editable
on demand). Data completeness for the engine, progressive disclosure for the eyes.

- **Category fix (the current bug):** today we lock a character's WHOLE appearance (face + outfit).
  Wrong. **Identity = immutable** (face, build, special characteristics: dimples, freckles, scars,
  snaggle tooth, permanent accessory) → locked into every render. **Wardrobe/styling = per-scene**
  → generated to fit the scene/role/period. (Symptom: a Pixar superhero cast into a noir detective
  scene still rendered caped instead of re-dressed in a trench + fedora.)
- **We already have the bones:** `AvatarProfile` (identity) + `CharacterLook[]` (outfits/states) +
  shipped instruction-based image editing (Flux Kontext) = the re-costume tool. Identity-lock logic
  ("lock the face, scene/Look supplies wardrobe") exists in `storyboard-thumbnail.ts` for the old
  path — needs wiring into the new Shot Doc generation.
- **Build:**
  1. Enrich the character description with STRUCTURED fields: immutable physical traits + accessories
     + base wardrobe (so traits like freckles/snaggle tooth persist through every re-costume — they
     are identity, not wardrobe).
  2. Planner (Opus 4.6) authors PER-SCENE wardrobe per cast member, reasoning about role + period +
     genre; emits it into the cut/scene spec.
  3. Generator re-costumes via image-to-image (Flux Kontext) into the scene wardrobe while LOCKING
     face + immutable traits → a scene-specific reference used for that scene's shots.
  4. `composeShotGenerationPrompt` must include identity traits + per-scene wardrobe + accessories
     (engine gets everything).
  5. Select-or-create character picker (reuse `AvatarPicker` + `CharacterForm`; add a plain "create
     new described character" path) + auto-save AI-invented characters to the Library once a keyframe
     gives them a face anchor.
  6. All of the above surfaced ONLY in the additional-details popup, not the master sheet.
- **Wardrobe mode (owner decision pending, recommended default):** per-character flag —
  **"flexible"** (default → re-costume per scene) vs **"signature"** (keep the defining outfit, e.g.
  a superhero suit / mascot / uniform). Planner may override per scene. Maps onto the existing
  exact/inspired/new fidelity.
- **Scout's reuse-first plan (already mapped):** picker "create new" → existing POST route; stop
  `resolveCast` from DROPPING AI-invented picks (keep as `unsaved` so they can be saved + bound);
  "Save to Library" affordance on unsaved cast; Admin-SDK writes via existing service; no new
  collection. Files: `AvatarPicker.tsx`, `CharacterForm.tsx` (reuse), `ShotPlanSheet.tsx` (CastCard),
  `planner.ts` (resolveCast), `shot-plan.ts` (`unsaved` flag + relax refs for unsaved), optional
  `assistant/route.ts` for chat parity.

## PRODUCTION FIELD REGISTRY (P-FIELDS) — audited Jun 14, ALL to be added

Owner mandate: EVERY field below gets (1) a hand-editable INPUT on the RenderZero-styled
dashboard, (2) AI-filled like existing fields (extend the GM completeness mandate + make
required in the LLM schema), (3) representation on the Shot Doc (image / text / popup detail —
heavy detail behind the additional-info icon, not the master face), and (4) sent to the video
engine in the CORRECT way (mapped into composeShotGenerationPrompt for image-relevant fields;
carried as metadata for downstream audio/edit/VFX layers). Touch all 5 layers in lockstep:
input form → `shot-plan.ts` types → planner GM + LLM schema → renderer (master + popup) →
`shot-plan-mapping.ts` prompt composer (+ generation service for re-costuming).

Verdict from the production audit: today's doc is a CINEMATOGRAPHY + BLOCKING sheet; ~10 of 18
departments are unstructured (crammed into free-text notes/description/environment).

PREREQUISITE: a scout is mapping `AvatarProfile`/`CharacterLook` (so we don't duplicate
wardrobe/identity) + WHERE the dashboard input fields live. Place character identity vs look
fields per that result (look fields likely belong on `CharacterLook`, surfaced to the cast member).

### Project-level (sharedChoices) — accuracy header
- `timePeriod` (P0), `genre` (P0), `deliveryFormat` (P1, → drives aspect+pacing),
  `contrastLevel` (P2), `saturationLevel` (P2), `targetDuration` (P2).

### Per-character — IDENTITY (immutable; locked into every render)
- `apparentAge` (P0), `gender` (P0), `ethnicity`/skinTone (P0), `build`/height (P0),
  `distinguishingFeatures[]` (P1: scars/tattoos/freckles/moles), `hairColor` (P0),
  base `facialHair` (P1), `voiceId` (P1, lip-sync layer).

### Per-character/look — WARDROBE & STYLING (mutable per scene)
- `wardrobe` (P0), `accessories[]` (P0), `wardrobeColors[]` (P1, keyed to palette),
  `footwear` (P1), `hairStyle` (P0), `makeupLook` (P1), `sfxMakeup` (P1).
- Wardrobe mode flag: `flexible` (default, re-costume per scene) vs `signature` (keep outfit).

### Per-object — props
- `propRole` (P1: hero/background/dressing), `scale` (P2). (HAVE: refs, description, subjectKind.)

### Per-environment-zone — art dept
- `locationType` (P1: INT/EXT + locale), `architecturalStyle` (P1), `setMateriality[]` (P1),
  `groundSurface` (P2). (HAVE: setDesign[], heroImageUrl.)

### Per-shot — direction / lighting / sound / edit / vfx / movement
- `keyLightDirection` (P1), `practicalLights[]` (P1), `performanceNote` (P1, per-char),
  `eyeline`/gazeTarget (P1), `transitionStyle` (P1: cut/dissolve/match/wipe),
  `actionIntensity` (P1, drives i2v motion), `ambience` (P1), `sfxCues[]` (P1),
  `musicCue` (P2), `vfxElements[]` (P1), `requiresVfx` (P2), `pacing`/`pacingRole` (P2).

### Per-shot CONTINUITY OVERLAY (the missing Script-Supervisor layer — biggest coherence fix)
- `timeOfDay` (P0), `weather` (P0), `storyTime` (P1),
  `characterStateAtShot` (P0: per-char emotional+physical — injured/exhausted/wet),
  `propStateAtShot` (P0: per-object condition — lit→spent, full→empty),
  `costumeStateAtShot` (P0: clean→bloodied→torn), `continuityNotes` (P1).

### TOP-10 P0 to land first
wardrobe+accessories · identity block (age/gender/ethnicity/build) · hairStyle+hairColor ·
timePeriod · genre · timeOfDay · weather · characterStateAtShot · propState · costumeState.

### Planner reframe
Reframe `SHOT_PLAN_PLANNER` GM from "director/cinematographer" → FULL PRODUCTION-TEAM
intelligence (director + production designer + costume + hair/makeup + props + sound +
continuity); extend the COMPLETENESS MANDATE + OUTPUT CONTRACT to populate every new field;
reseed (Standing Rule #1). Build P0 set first, then P1 cluster, then P2.

## SHOT DOC BACKLOG (next tweaks — captured Jun 14, not yet built)
- **Signage / background text control.** Planner authors the EXACT background signage/text
  (using Brand DNA in the GM for on-brand ideas), feeds it to the engine as explicit strings
  ("sign reads 'X'") so it's real words, correctly spelled — and make it editable. Caveat:
  fal/Seedance/Flux text rendering is imperfect even with exact text in the prompt; the 100%
  version is a post-gen text OVERLAY/composite (later option).
- **Scene Key panel** in the floor-plan section's empty side space: a legend listing EVERY
  element in the scene (characters, props, set pieces, signage text, cameras), each editable
  inline. Turns the dead space into the scene's control panel. The floor-plan section becomes
  the full editing hub: ADD/EDIT camera MOVEMENT (route already exists in FloorPlanCanvas; add
  the movement-description + lens edit), and EDIT element descriptions inline — including the
  background signage strings (ties to the signage-text item above).
- **Active-camera clarity.** Each cut maps to one numbered floor-plan camera node, but it's not
  obvious which node shot which storyboard frame. In the Scene Key, label each camera
  ("Cut 3 → 50mm, shooting NE, push-in") and highlight the active one so blocking ↔ final frame
  are clearly linked.
- (Plus the earlier carried tweaks: read-only floor-plan view option, P1/P2 production fields,
  per-zone hero generation for true multi-location.)

## OPEN ITEMS TO CONFIRM WITH OWNER
1. Script-writer = new role, or folded into the planner / Content Manager?
2. Per-doc cut cap + segmentation heuristic (per-scene vs grouped zones)?
3. Keep Hedra path during transition (owner said remove Hedra AFTER shot-doc upgrades)?
4. Wardrobe mode default: flexible-by-default + signature toggle (recommended), or always ask before
   re-costuming?

---

# Jun 12 2026 — PHASE 2 of the Character Library (wire characters into generation)

**Goal:** when the operator picks a saved character (and a Look) in the chat, the system
auto-passes the right face anchor + Look references to Hedra PER SCENE, so the character stays
consistent across every video. Plus: extract pose stills from the operator's chroma-key
full-body video.

**Phase 1 SHIPPED (commit `8de0f531` on dev):** Character Library backend + UI exist;
characters can have alter-ego "Looks" (same face, different outfit, each Look with its own
images/video/audio). Also shipped same batch: instruction-based image editing (Flux Kontext),
"Remove background" (white-key + Fal BiRefNet, honest failure with no key), approval-recognition
fix, delete-bug fix. Everything below the Jun 11 line is prior shipped context.

## VERIFIED FACTS (mapped Jun 12 — do NOT re-investigate from scratch)
- **Character model**: `AvatarProfile` in `src/lib/video/avatar-profile-service.ts`; Firestore
  `organizations/{PLATFORM_ID}/avatar_profiles`. Identity = name + `frontalImageUrl` (face
  anchor) + `description` (DNA) + voiceId/voiceName/voiceProvider. Variants =
  `looks: CharacterLook[]` where `CharacterLook = { id, name, outfitDescription, imageUrls[],
  videoUrls[], audioUrls[], isPrimary }`. API: GET/POST `/api/video/avatar-profiles`,
  PATCH/DELETE `/api/video/avatar-profiles/[profileId]`. UI: `/content/characters` (page.tsx +
  CharacterForm.tsx).
- **Intent subjects**: `IntentSubject` in `src/lib/content/content-intent.ts` =
  `{ name, referenceNames, fidelity, notes }`. Add optional `characterId` (+ `lookId`) to bind a
  subject to a saved character.
- **Chat → build**: `src/app/api/content/assistant/route.ts` — `resolveLibraryReferences()`
  resolves subject ref names from the media library; approved subjects + attachments go to
  `buildStoryboardFromBrief()` in `src/lib/video/storyboard-build-service.ts` (seeds scene-1
  refs). Per-scene resolution: `matchReferenceForScene` / `pickSceneReferenceFromSubjects` in
  `src/lib/video/storyboard-thumbnail.ts`. IDENTITY_LOCK there already = "lock the face,
  scene/Look supplies wardrobe."
- **Hedra**: `src/lib/video/hedra-service.ts` — `generateWithHedra` /
  `generateHedraImageFromReference` / `generateHedraAvatarVideo` accept identity via
  `start_keyframe_id` (start frame) + `reference_image_ids`. i2i already prefers FLUX KONTEXT.
  VERIFIED: `enhance_prompt` defaults **FALSE** on the Hedra API — Hedra does NOT mutate our
  prompts; the prompt-rewriting "agent" is ONLY Hedra's web app (runs/events/agent_thread_id),
  not the API. Don't chase "Hedra is scrambling prompts."
- **Scene**: `PipelineScene` (`src/types/video-pipeline.ts`) already has `avatarId` (per-scene
  character override). Generation: `src/app/api/content/asset-generator/generate/route.ts` +
  `src/lib/video/scene-generator.ts`.

## THE SEAM (build order)
1. **Bind characters in the chat**: surface saved characters (names + DNA) to the Content
   Manager so it references them; when a subject matches a saved Character, carry `characterId`
   (+ chosen `lookId`) through the intent into the build.
2. **Storyboard build**: resolve `characterId` → `frontalImageUrl` (identity anchor) + the chosen
   Look's `imageUrls` (wardrobe) + `outfitDescription`; seed onto scene references and set
   `scene.avatarId`. Identity from the face anchor, wardrobe from the Look.
3. **Scene/image generation**: when `scene.avatarId` is set → resolve profile → pass
   `frontalImageUrl` as `start_keyframe_id` + Look `imageUrls` as `reference_image_ids` to Hedra;
   use `profile.voiceId` for dialogue (Character-3/Omnia).
4. **Chroma-key pose extraction**: new route/tool — take the green-screen full-body video →
   extract pose freeze-frames (ffmpeg/sharp) → save as a Look's pose references in the media
   library. These become start-frames for full-body action shots.
5. (Stretch) **Per-model prompt formatting** in the Hedra Specialist: A-B-C (DNA / scene+Look /
   camera) in the right dialect per model (Veo = camera-first; Kling = subject anchor +
   negatives; Character-3/Omnia = audio-driven facial).

## STANDING RULES (binding)
Brand DNA baked into GMs at seed time, never runtime; NO Golden Master edits without a human
grade; design-system components only (no raw tags/hex/CSS-vars); plain English to the operator;
the conversational AI MUST ask clarifying questions and NEVER fail silently (users are
non-technical SMB owners); subagents do the brunt but VERIFY every output (read the diff + run
tsc + lint), they slip; finish to production-ready, name every shortcut.

## DEV-SERVER / BUILD PROTOCOL
The dev server runs on localhost:3000 OUT OF THE PRIMARY worktree (`D:\Future Rapid Compliance`).
KILL it before `npm run build` (the build clobbers `.next` and breaks the live page). Build with
`NODE_OPTIONS=--max-old-space-size=8192` (it OOMs at the default heap). After build: restart the
dev server + re-arm a persistent Monitor tailing the harness background-output file (NOT the
UTF-16 `dev-server.log`). Commit to `dev` with co-author "Claude Opus 4.8 (1M context)", then
merge dev into rapid-dev.

## DONE
Pick a saved character + Look in the chat → storyboard scenes use the right face + outfit →
generated scenes look like the character consistently across shots → tsc + lint + `npm run build`
green → browser-walk → commit to dev.

---

# 🔴 RESUME HERE — Jun 11 2026 (early AM) — Content Manager image vertical + Media Library overhaul

## ▶ NEXT ACTION (start the next session HERE)
**Slice 1 of "editor-as-destination" is SHIPPED (Jun 11, tsc + lint + `npm run build` all green; pushed
to dev — NOT yet operator browser-walked).** What landed:
- `editor/page.tsx` now reads `?project=`, fetches `/api/video/project/[id]`, and `ADD_CLIP`s every
  completed scene (`status==='completed'` + `videoUrl`) onto the timeline in `sceneNumber` order, with
  duration from the matching `PipelineScene.duration`. Guarded: only seeds when the timeline is empty
  (a `useRef` + `clips.length===0`), so it never clobbers an edit in progress. Header shows a "Loading
  your scenes…" / error pill.
- `StepGeneration.tsx` — on completion, once the finished scenes are PERSISTED (`/api/video/project/save`
  resolves ok), it redirects to `/content/video/editor?project={id}` (`goToEditor`, fires once via ref;
  falls back to legacy `advanceStep` only if there's no `projectId`). The old "Continue to Assembly"
  button is now "Open in Editor". `handleContinue` removed.
- `Preview.tsx` — `<video>` is no longer `muted`, so the baked-in lip-synced dialogue plays in the
  preview. Playback only starts on a user gesture (Space/Play), so autoplay policy is fine.
- Stitching standardizes on `/api/video/editor/render` (editor Export already uses it); `/api/video/assemble`
  left dormant, not deleted.

**⚠️ STILL OWED on Slice 1:** the operator browser-walk — generate a short video → confirm clips land on
the timeline in order → press Play → confirm AUDIO. (Couldn't self-verify: needs auth + a real Hedra
generation.) **NEXT after that = Slice 2** (collapse wizard + selectable transition/SFX/VFX libraries),
then Slice 3a/b/c (publish + platform-native "B" versions; smart auto-reframe shared with viral-clip
maker), effects-by-prompt last. Concrete Slice-1 spec + VERIFIED facts + locked decisions remain in the
"**Slice 1 (keystone, verified Jun 11)**" paragraph below. Everything below is SHIPPED context + roadmap.

**🛠️ Build note (Jun 11):** the dev server runs on localhost:3000 OUT OF THIS PRIMARY worktree
(`D:\Future Rapid Compliance`), not rapid-dev — so `npm run build` here clobbers the live `.next` and
breaks the page. Always KILL the dev server before building, then restart. And `next build` OOM'd in the
type-check phase at the default heap — run it with `NODE_OPTIONS=--max-old-space-size=8192`.

**Context:** Continued the Content Manager work. Video-from-chat was already live; this session
wired the **image-from-chat vertical** and did a full **Media Library** pass. Ended with the
operator frustrated on character STYLE/MATURITY (a generation-quality + targeted-edit gap, below),
choosing to change gears to the **editor + assembly** discussion — which produced the locked editor
scope (see NEXT ACTION above + the EDITOR section below).

## ✅ SHIPPED + VERIFIED this session (tsc + lint clean; proven live in dev-server.log)
- **Image generation from the chat (NEW vertical).** Approve an image request → route's Phase B
  `mediaType === 'image'` branch builds one `imageRequest` per subject (prompt from subject
  name/notes + style; reference resolved from chat attachments or library by filename token-match) →
  client generates each via `/api/content/asset-generator/generate` (which persists to the library).
  - Runs **in PARALLEL** (`Promise.allSettled`, 150s per-image AbortController timeout). The first
    cut was sequential and **stalled after ~2** when one Hedra call hung — parallel fixed it.
    PROVEN: a 6-image batch fired 6 `Hedra image-to-image starting` lines within ~1.5s and all 6 saved.
  - Posts per-image progress in chat ("✓ Image N/6 done") and fires a `media-library-updated` event.
- **Media Library overhaul** (`src/app/(dashboard)/content/video/library/page.tsx`):
  - **Per-tile** (hover): select checkbox, **download** (fetch→blob, real download), **trash**
    (two-step confirm overlay).
  - **Bulk bar** (when items checked): **Download** (zips via `fflate`), **New project** (groups
    selected under a named tag), **Delete** (two-step), Clear.
  - **Video tiles** now show a **first-frame poster** (`#t=0.1`) + **play on hover** + play icon
    (were blank before).
  - **Detail panel is editable**: rename (inline), **category** (dropdown), **description**
    (editable textarea, saves on blur — REPLACED the read-only AI-prompt display per operator),
    **assign to project**.
  - **Live auto-refresh**: listens for `media-library-updated` → re-fetches, so chat-generated
    images appear without a manual reload.
- **`isApproval`** (`content-intent.ts`) now catches "build them / these / those / all / my / some".
- **Schema fix**: `format.durationSeconds` min(1)→**min(0)** — the model emits 0 for images and the
  tight min was silently failing the whole intent parse. Video build guards 0→30.
- **IDENTITY_LOCK reframe** (`storyboard-thumbnail.ts`): lock the **face/identity only**; defer
  wardrobe / setting / pose to the scene description (was forcing the reference's outfit, e.g. civilian
  David came out in the Velocity suit).

## ⚠️ KNOWN GAPS surfaced this session (NOT yet built — discuss/queue)
- **TARGETED EDIT is the big one.** Every approval **rebuilds ALL** scenes/images, never just the
  one the operator asked to change. Burns good outputs + tokens; operator hit this on both storyboards
  ("you changed them all") and images ("build the other four" → rebuilt 6). The client rework path
  (`targetSceneNumber`) still exists; the SERVER stopped emitting it in the intent flow. **Re-add a
  per-item edit path** (intent carries an edit-target → build only that one → return targetSceneNumber).
- **Character maturity/style** — i2i pulls toward an attached example but doesn't guarantee; the
  business-owner set needed several passes (kid-looking → adult → style-match). Generation-quality +
  prompt-richness, not a wiring bug.
- **Image-generator page doesn't display fresh results** — images land in the **Library**; the
  `/content/image-generator` page shows nothing new. Operator expected "take me to the image section."
- **Library refresh fires per-image** (6 events in ~1s → one transient "Failed to fetch" RSC). Harmless;
  **debounce** offered, not yet done.
- **Generate→editor flow + editor depth (SFX/VFX)** — the active discussion. See "Editor + Assembly" below.
- **Logo white-background** — still pending (brand outro composites a non-transparent white plate).

## 🎬 EDITOR = THE FINISHING + PUBLISHING SURFACE — operator vision locked (Jun 11)

**Decision (operator):** The video section collapses to TWO places — the **chat** (request + approve
storyboards) and **the editor**. The separate **Assembly, Post-Production, and Publish** screens are
all **consolidated INTO the editor** (fits "consolidate, don't sprawl"). There is no assembly step —
the editor IS the assembly.

**Flow:** request video → approve storyboards → it generates → **clips auto-land in the editor in
storyboard order** (a starting cut, fully editable) → operator finishes + publishes there.

**The editor = comprehensive, CapCut-mobile-style**, with **selectable libraries** (the emphasis —
pre-made, instant click, NOT generate-from-scratch each time):
- Tons of **transitions**, a **sound-effects** library, a **special-effects** library
- Trim, rearrange, **add images** (drop from library onto timeline), text
- TWO kinds of effects: **library effects** (instant, primary) + **prompt-generated effects** (custom
  AI, slower, power-user extra)

**Audio model (settled — operator corrected my first take):** audio is LAYERED, not merged.
- **Dialogue** is lip-synced into the video AT GENERATION time → welded to its clip, never separated
  (moving it breaks lip-sync). Cuts ride with the clip; cut on pauses (editor shows waveforms).
- **Music** is the ONE continuous layer — a bed laid UNDER the dialogue across the whole cut. Continuity
  for multi-scene moments = same voice + same music bed. Score LAST (after cuts) so it fits the length;
  a mid-edit cut ripples + refits the music tail.
- **SFX/ambience** layered on top. Operator adds/removes music + SFX in the editor.

**Publish panel (inside the editor) — PLATFORM-NATIVE versions (operator chose "B", Jun 11):** operator
picks the platforms (TikTok, YouTube Shorts, Facebook, Instagram Reels, …), and for each can **adopt that
platform specialist's recommendation** (demographic resonance, best posting times, SEO, hashtags, caption
shape) — one click, accept or override. NOT one generic post: each platform gets a **native VERSION**:
- The specialist supplies a **format target** (aspect + length): TikTok/Shorts/Reels → 9:16 short;
  YouTube → 16:9; Facebook flexible.
- The editor render runs **once per platform**, producing a version shaped for each.
- **Reframing** (16:9→9:16 etc.): **Basic** first = aspect crop with an anchor (center default, operator
  can nudge the crop box per platform). **Smart auto-reframe** (subject/face tracking) is heavier and is
  the SAME engine as the **viral-clip maker** — build once, both features use it.
Reuses the existing specialist swarm + publishing pipeline.

**Build order (confirmed direction):**
1. **Editor-as-destination + consolidation** — generate → auto-land in editor; fold assembly/post/publish
   into editor panels; kill the 3 separate screens.
2. **Selectable libraries** — transitions / SFX / VFX presets (the CapCut-style content/UX lift).
3. **Publish panel + PLATFORM-NATIVE versions ("B")** —
   3a. platform multi-select + per-platform specialist recommendation (caption/hashtags/timing) + publish.
   3b. per-platform RENDER (format/aspect + length) with **basic reframe** (center/operator-adjustable crop).
   3c. **smart auto-reframe** (subject/face tracking) — SHARED engine with the viral-clip maker (Bucket 1),
       so sequence it alongside that, not inside the publish work.
4. **Effects-by-prompt** (custom AI layer) — last.

**Slice 1 (keystone, verified Jun 11):** `editor/page.tsx` ignores `?project=` (starts empty) — confirmed
by reading it. `/api/video/editor/render` already stitches clips (the editor Export sends clips+overlays →
one MP4 → Library) — confirmed. So Slice 1 = editor reads `?project=` → fetch project → `ADD_CLIP` per
completed scene in `sceneNumber` order (duration from `PipelineScene.duration`; `SceneGenerationResult`
has none); `StepGeneration` auto-redirects to the editor on completion. Standardize stitching on
`/editor/render`, retire `/api/video/assemble` from the flow (keep route dormant). Editor stays
reducer-based, initialized from the project; Export → Library (project round-trip save = follow-on).

**Editor today HAS:** timeline (V/T/A tracks), trim, split, transitions (cut/fade/dissolve),
color/lighting, text overlays, export, render (`/api/video/editor/render`). So stitching + transitions
+ basic edit largely EXIST; the build is libraries + consolidation + publish panel + intelligence below.

## 🤖 EDITOR/CONTENT AI ROADMAP — operator requirements (layer ON TOP of the editor)

**🔑 DELEGATION MODEL (operator, Jun 11):** every AI capability below is **DELEGATED TO, never operated
directly.** They are **Golden-Master-backed SPECIALISTS** (Brand DNA baked in, Standing Rule #1) that the
**Content Manager delegates to** when the operator expresses intent ("caption this", "pull viral clips",
"clean the dead air") — NOT direct editor buttons/tools. The editor is the operator's HANDS-ON MANUAL
surface (he directly trims/arranges/adds library effects); delegated-AI results LAND in the editor for
manual refinement. Each AI capability still has a MANUAL equivalent in the editor (UI-parity rule).

**Bucket 1 — Editor-intelligence specialists (delegated; operate on a clip). Shared backbone =
transcription, ALREADY wired (Deepgram, from the KB work). Not three from-scratch builds.**
- **Auto-caption** — transcribe → styled captions on the timeline.
- **Dead-air removal** — detect extended silences → ripple them out (Descript-style).
- **Viral-clip maker** — score moments → cut short vertical clips (Opus-Clip-style).
- Each keeps a MANUAL equivalent (UI-parity rule).

**Bucket 2 — Content-automation AI (upstream, in the swarm; ongoing agents, not one-shot features):**
- **Specialist-knowledge → auto-create videos** — platform specialists' demographic/format knowledge
  drives the generation pipeline to produce tuned videos.
- **Trend recognition** — monitor platforms for emerging trends EARLY → surface as marketing
  opportunities → feed the content engine.
- **Human-review gate STAYS** — these propose/create, operator approves before publish (not autonomous
  publishing; consistent with the rest of the swarm + Standing Rules).

**Sequencing:** near-term = editor-as-destination + libraries + publish panel (build order above).
Bucket 1 bolts onto the editor once it's the surface. Bucket 2 is the higher layer after the editor is solid.

---

# ✅ Jun 10 2026 — Reference-conditioned video generation (THE core feature) — [history]

**The goal:** prompt + attach reference materials → content generated **FROM** those materials, not reinvented. Test case: a 30s Pixar-style commercial using the owner's actual **Velocity** (hero) + **Pipedrive** (villain) character art. This session closed the gap from "generic text-to-image that reinvents the characters" → "image-to-image conditioned on the operator's real art."

## ✅ PROVEN this session (real outputs on his Velocity — go look)
- **Image-to-image conditioning WORKS (keystone proof):** `generateHedraImageFromReference` (Flux Kontext Max) reproduced his Velocity re-posed — same suit / purple energy / neon city. Saved at `localhost:3000/velocity-i2i.png`.
- **Image-to-video:** Kling v3 i2v from his Velocity → real video at `localhost:3000/velocity-proof.mp4`.
- **Hedra Specialist** end-to-end: chose Veo 3 on its own reasoning, anchored to his Velocity art.

## ✅ SHIPPED (commits 722b6d64 → a1179ba4, dev + rapid-dev synced)
- **Storage UBLA fix** (download-token URLs, not makePublic) — chat uploads finally work.
- **Auto-save fixes** (generic platform / empty brief.description / short duration) — projects persist + recall.
- **Hedra capability service** (`src/lib/video/hedra-capability-service.ts`) — live catalog of ALL 96 Hedra models (incl. OmniHuman, Kling, Veo 3, Sora 2, Flux Kontext i2i). The deep-knowledge layer.
- **Generalized Hedra driver** (`generateWithHedra` in hedra-service) — drive ANY model with ANY inputs (start/end frame, reference images, audio, TTS).
- **Hedra Specialist agent** (`src/lib/agents/content/hedra/specialist.ts` + `scripts/seed-hedra-specialist-gm.js`) — GM seeded with Brand DNA, registered under Content Manager, the system-wide generation gateway.
- **Reference conditioning wired into storyboard scenes** (`b9c5348b`): `asset-generator/generate` accepts `referenceImageUrl` → image-to-image; `matchReferenceForScene` (storyboard-thumbnail.ts) picks the right character per scene by filename token-match (scene "velocity" ⊂ file "SalesVelocity Hero"; "bully" = "PipeDrive Bully"); ContentAssistant passes the matched ref per scene (pool seeded on scene 1).
- **Media library**: chat uploads register as `UnifiedMediaAsset` records; new `description` + `intendedUse` fields — **HUMAN-authored, AI never generates them** (owner was emphatic); library search includes them.
- **Chat labeling flow**: upload WITH NO prompt → asks project name + description + intended use → stored VERBATIM, batch-numbered (one answer → all files, "Name 1/2/…"), project stored as a tag for filtering. Upload WITH a prompt → creative flow (attachments used as references). Library picker ("Search library") + consolidated hover dropdown (Upload files / Upload a folder / Search library).
- **Deterministic build trigger** (`a1179ba4`): the creative-director front-end kept ROLE-PLAYING the hand-off in prose ("@Video Specialist", shot tables, "the machine is running") and never emitted the delegate block → NO build ever fired. Now the route detects build intent ("make the video", "build it", …) and FORCES `buildStoryboardFromBrief` via a JSON-only `forceDelegate` call. The build no longer depends on the model cooperating.
- UI fixes: attach-dropdown hover-gap, bounded/scrollable chip strip, no-auto-advance on upload, attachment cap 20→100 (a 21-file folder was 400-ing).

## 🔜 IMMEDIATE NEXT — verify the chain end-to-end (the `a1179ba4` fix has NOT had a clean run yet)
1. Hard-refresh → upload references + prompt + **"make the video"** → confirm in the rapid-dev log: `forceDelegate` → `buildStoryboardFromBrief` → storyboards on canvas → `asset-generator/generate` doing **image-to-image** (the scenes must LOOK like his Velocity/Bully, not the generic "Velocity Arrives = random jumping figure" from before).
2. Verify `matchReferenceForScene` reliably picks the right character per scene.

## ⏳ STILL TO BUILD (owner requirements, NOT done)
- **Reference conditioning in the actual VIDEO gen** — right now only storyboard THUMBNAILS are image-conditioned; the scene VIDEO generation (`scene-generator.ts`) still needs i2v conditioned on his characters (OmniHuman / Kling i2v via `generateWithHedra`, start_frame = his character).
- **Logo white-background bug** — the brand outro composites a non-transparent logo (white plate). Fix the logo transparency.
- **Audio stage in the editor** — music + VO + ambience laid over the whole stitched video, ONCE, for seamlessness; mute the model's auto-generated audio (`generate_audio:false`). Storyboard `musicCue`/`ambience` pre-fill it.
- **All generated VIDEOS save to the library** — thumbnails do; finish the final-video persistence (UnifiedMediaAsset pending→ready on Hedra completion, like `/api/content/video/generate`).
- **Library edit + duplicate controls** (copy/change to repurpose) — PATCH supports description/intendedUse/name/tags; needs UI on the Library page.
- **End-product grading** — grading the finished video routes to the right specialist (story → Video Specialist; model/material/prompt → Hedra Specialist). Owner requirement; the training-loop (grade → Prompt Engineer → new GM version) exists but Hedra Specialist isn't wired into grade-routing yet.
- **Library-auto-source (LATER — owner-deferred):** agent pulls references from the library/project automatically WITHOUT attaching. Owner explicitly said prompt+attach is the CURRENT validation; library-auto is future ("eventually my agent will look in here for inspiration").

## Test hygiene (owner re-runs the upload test repeatedly)
To clear between runs: delete media records with tag `reference-material` AND/OR source `ai-generated` created in the last 24h. **NEVER delete storage. NEVER the whole library** (owner stopped me twice for over-deleting). His Velocity in storage: `organizations/rapid-compliance-root/brand-assets/*SalesVelocity.ai_Hero*`. Dev server: localhost:3000 from `D:\rapid-dev` (its own dev-server.log; monitor task watches content/video/asset/brand + errors).

---

# ✅ RESOLVED (Jun 9) — chat attachment upload + the reference-conditioning build above. Original blocker kept below as history:

# 🔴 [historical] Jun 9 AM — BLOCKER: chat file/folder attachment never uploads

**Symptom:** In the Content Assistant chat (`/content/video`), clicking 📎 (single file) or 📁 (folder), picking a file → **NO attachment chip appears, and the upload request NEVER fires.** `grep -c "/api/settings/brand-identity/asset" dev-server.log` = **0 across the whole session** → the request never leaves the browser. No client error in the log either. (Owner hard-refreshed + I restarted the dev server clean — still broken. So it's a real code/runtime issue, NOT staleness.)

**Already ruled out (don't re-check):**
- `uploadOne` code is CORRECT (`ContentAssistant.tsx` ~300): accepts all formats, builds FormData, POSTs `/api/settings/brand-identity/asset` via `authFetch`. No early-reject.
- Buttons wired: paperclip `onClick=fileInputRef.current?.click()` (~823), folder `onClick=folderInputRef.current?.click()` (~834). Inputs present (~803-818), folder input gets `webkitdirectory` via `useEffect([])` (~240). Panel is `aria-hidden`, NOT conditionally rendered, so the inputs ARE in the DOM at mount.
- Chip renders on `attachments.length>0 || uploadingCount>0` (~720-789). `onFileSelected`→`uploadFiles`→`uploadOne` (~384); `onFolderSelected`→`keepRealFolderFiles`→`uploadOne` (~396).
- Server: dev server restarted clean, `fflate` present, HTTP 200. Upload route exists.

**TOP SUSPECTS — check in this order:**
1. **`disabled={loading}` on BOTH attach buttons** (~824, ~835). If `loading` is stuck `true`, clicking is a silent no-op → EXACTLY these symptoms (no chip, no network, no error). Verify `loading` resets; consider NOT gating attach on `loading`.
2. **Instrument the click chain** — add temp `console.log`/`logger` in the button `onClick`, in `onFileSelected`/`onFolderSelected`, and at top of `uploadOne`. The dev `ClientLogBridge` forwards browser logs to `dev-server.log`, so this pinpoints exactly WHERE the chain breaks (click? input.click()? onChange? uploadOne?).
3. Confirm `fileInputRef.current`/`folderInputRef.current` are non-null at click time.
4. Confirm the upload route works server-side (real token).

Files: `src/components/content/ContentAssistant.tsx`; route `src/app/api/settings/brand-identity/asset/route.ts`. Dev server runs on `localhost:3000` from `D:\rapid-dev` (logs to its `dev-server.log`; monitor task watches content/video/asset/brand + errors).

**THEN (once attach works):** owner wants a **30s Pixar-style commercial** — "Velocity" (SalesVelocity superhero) liberates a small-business owner from the "Pipedrive" villain (overpriced, fee-gated, hidden-fee CRM). Emotion = **empowerment**, any SMB owner. The Content Assistant ALREADY produced a strong 3-act `VIDEO_SPECIALIST` delegate brief (Pixar warm lighting, big eyes, Incredibles action; VO ends "Accelerate your growth") — it's in the chat history. He wants to attach a **folder of reference materials** to that build (hence the attach bug is the blocker).

## ✅ SHIPPED tonight (Jun 8–9, all on dev → 585916fb, rapid-dev synced)
Brand: 4 pages → ONE (`/settings/brand`); save fans out to voice/brand-kit/theme; Publish-to-Agents surgical rebake; full Advanced theme controls; Reference Materials upload+understand; colors fixed to REAL design tokens (accent = pink #EC4899, green = success). Video: blank-leading-scene fix, real-logo+tagline brand-outro (`brand-outro.ts`), auto-save + Load Project recall (`useVideoProjectAutoSave`), chat upload that **accepts + UNDERSTANDS all marketing formats** (image vision / audio+video transcript / PDF / **docx+pptx via fflate** / xlsx / text), multi-file + **whole-folder** upload. Dropped 83MB officeparser(OCR) → 833KB fflate.

---

# ✅ SHIPPED June 8, 2026 — Brand consolidation + references-to-agents (commits `00b3ce19`, `a8453762`)
Four brand/theme pages (theme, brand-dna, brand-kit, brand-identity) collapsed into ONE: `/settings/brand`. One Save fans out to AI voice (brandDNA), video kit (brand-kit), and dashboard theme (platform_settings/theme) via bridges; old pages redirect. "Publish to Agents" surgically re-bakes all 67 GMs (preserves training edits). Full CRM-theme controls moved onto the page (Advanced section). Reference Materials: upload image/video/PDF → auto-analyzed (OpenRouter vision / Deepgram transcript / PDF parse → summary, proven live) → baked into every agent's Brand DNA on Publish. See memory `project_brand_identity_single_source_consolidation`.

## 🧪 PRE-MULTI-TENANT TEST QUEUE (owner-deferred, must walk before the multi-tenant flip)
- **Reference Materials end-to-end (Jun 8):** owner had NO brand imagery on hand to test. Before multi-tenant: upload a real image (vision read shows "what your agents see"), a video (transcript), and a PDF (text summary) → fill description/purpose → Save → Publish to Agents → confirm the reference text lands in a GM's baked Brand DNA block (spot-check via Training Lab or `verify-tagline-live`-style read). Also confirm two-step Remove + storage upload of a real asset.
- **Dashboard theme bridge first-save (Jun 8):** confirm the FIRST Brand-page Save aligns the live dashboard colors to the brand palette as intended and does NOT wipe advanced theme knobs (read-bridge should preserve them). Visual check on localhost.

---

# 🏷️ RESUME HERE — BRAND IDENTITY UNIFICATION (June 7–8, 2026) ← CURRENT PRIORITY

## THE DECISION (owner, this session)
Brand identity is fragmented across 5+ stores with **no single source of truth** and silent save-failures (the owner's logo was never actually stored anywhere editable — it's a static `public/logo.png`; image gen was hallucinating a FAKE logo because nothing real was wired in). FIX: build ONE comprehensive **Brand/Identity page** that is the editable source of truth for the tenant's whole brand — voice (Brand DNA), logo, colors, fonts, AND example assets (prior social posts, on-brand ads, brand imagery). Critical for rebrands AND multi-tenant (every tenant = own brand).

## LOCKED ARCHITECTURE (owner + Claude, agreed this session)
- The **Brand/Identity page is the canonical source of truth.** Onboarding DISCOVERS the brand and POPULATES the page (it already writes brand DNA today — extend it).
- **Baking into agent Golden Masters STAYS** (Standing Rule #1 — it keeps agents fast, versioned, drift-proof). The page is the SOURCE the bake reads from; it does NOT replace baking.
- **Editing the page's VOICE auto-triggers a re-bake** of the brand-DNA portion into every agent/specialist GM. Editing VISUALS (logo/colors/fonts) applies LIVE at generation time (no rebake).
- **Example assets → each agent's KNOWLEDGE BASE** (the proven per-agent KB channel) so agents can SEE real examples of on-brand work in their space. Separate channel from the baked voice; complementary.
- Multi-tenant: one Brand/Identity page per tenant + re-bake per tenant. This IS the multi-tenant brand architecture.

## ⚠️ HARD REQUIREMENTS / TRAPS (do NOT repeat past setbacks)
1. **Auto-rebake must NOT clobber training-loop edits (Standing Rule #2).** Re-baking brand DNA must update ONLY the brand-DNA portion of each GM systemPrompt, preserving any human-graded prompt improvements. A naive full reseed WIPES them. THIS IS THE #1 TRAP.
2. **Auto-rebake runs ASYNC + observable** — reseeding 50+ agents is heavy; never block the save or churn silently. Voice change → tracked background job. Visual-only change → no rebake.
3. Standing Rule #1 preserved: runtime agents still read their baked GM, no runtime `getBrandDNA()` (CI guard `check-no-runtime-brand-dna.js` must stay green).
4. **SUBAGENT DISCIPLINE** (owner, emphatic — YC rejection traced to subagent setbacks): subagents do the brunt; Claude RE-RUNS tsc+lint, reads diffs, traces logic on EVERY output before "done". Riskiest pieces (onboarding, rebake) get reviewed SPECS before any live code.

## ✅ DONE (June 7–8, 2026) — all tsc+lint clean, committed + pushed to dev
**BRAND ENGINE — built, PROVEN, and LIVE:**
- **Canonical store**: `src/types/brand-identity.ts` (`BrandIdentity` = voice + companyName/tagline + logo + 11-color palette + fonts + typography + introOutro + exampleAssets) + `src/lib/brand/brand-identity-service.ts` (`getBrandIdentity`/`saveBrandIdentity`, with logo bridge → website → `/logo.png` AND voice bridge → Brand DNA until migrated). Migration `scripts/migrate-to-brand-identity.ts` (dry-run verified; NOT yet `--apply`ed).
- **Surgical re-bake** (`src/lib/brand/rebake-brand-dna.ts`): `swapBrandDNABlock` swaps ONLY the trailing Brand DNA block (marker `## Brand DNA (baked...`), preserving base body + training edits (Standing Rule #2). `createIndustryGMVersionFromBrandRebake` (+ manager mirror) added to the GM services. Unit-proven (`scripts/verify-brand-rebake-swap.ts`) AND live-proven on COPYWRITER with rollback (`scripts/verify-brand-rebake-live.ts`).
- **TAGLINE LIVE across all 67 LLM agents**: "Accelerate your growth" + never-invent-a-tagline rule. Set in Brand DNA (`scripts/set-brand-tagline.ts`), mass-applied surgically (`scripts/rebake-all-gms-brand-dna.ts --apply` → 66 specialists/managers, 0 failed) + Jasper reseed (`seed-jasper-orchestrator-gm.ts --force`). Verified (`scripts/verify-tagline-live.ts`: 67/67; the 6 NOT covered are confirmed-DEAD legacy `gm_*` docs unread by the runtime swarm). Coverage audit (`scripts/audit-gm-coverage.ts`): the "4 missing specialists" (CATALOG/PAYMENT/PRICING/VOICE) are DETERMINISTIC dispatchers (no LLM) → correctly GM-less; MASTER_ORCHESTRATOR same; Jasper runs live on `gm_orchestrator_v1` (healthy, loaded by `agentType=='orchestrator' && isActive`).
- **Brand page** (`/settings/brand`, nav under Settings→Customization): `src/app/(dashboard)/settings/brand/page.tsx` + API `src/app/api/settings/brand-identity/route.ts` (GET requireAuth, PUT requirePermission canManageTheme + Zod). Sections: Company · Voice (+ chip editors for key/avoid phrases & competitors) · Logo (upload persists immediately) · Colors (11) · Fonts. Shows the REAL voice via the bridge. (Caught+fixed in review: logo-url Zod rejected `/logo.png` → fixed; empty-voice → voice bridge.) exampleAssets uploads deferred.

**VIDEO-GEN fixes:**
- Both storyboard paths → ONE Video Specialist (`storyboard-build-service.ts`); fill-every-field + continuity (`storyboard-completeness.ts`, incl. `filters`); script (VO) on each storyboard card.
- NO-FAKE-LOGO: prompt forbids AND strips logo/text/tagline language (`storyboard-thumbnail.ts`); REAL logo composites from `public/logo.png` (disk), now OPT-IN (`applyBrandLogo`, default OFF → only the closing/brand shot, not every scene); fixed on thumbnails + `/api/video/assemble`.
- Content Assistant can REWORK a specific storyboard (`targetSceneNumber` → REPLACE in place, not append) — `ContentAssistant.tsx` + assistant route. Brand-kit logo persists on upload.

## ⬜ WHAT'S LEFT (ordered — START HERE next session)
1. **Wire publish / auto-trigger** — the Brand page edits the canonical store but NOTHING reads it yet. Need: (a) "Publish voice to agents" button → API route running the rebake (extract `rebake-all-gms-brand-dna` logic into `/api/training/rebake-brand-dna` + Jasper); (b) on voice save, write voice back to org `brandDNA` (the source the bake STILL reads) + fire the rebake async (enqueue in `updateBrandDNA` + identity route; job doc + status route; idempotent; partial-failure tolerant). [Spec C: HhTML sentinels optional — marker-to-EOF already works.]
2. **Surgical Jasper rebake** — Jasper has only the blunt base reseed. Add `createJasperGMVersionFromBrandRebake` to `jasper-golden-master-service.ts` (mirror the specialist one, swap the block) so future brand changes don't reseed Jasper bluntly. ~40 lines.
3. **Re-point readers to the canonical store** — content/video read `getBrandKit` (visual); the GM bake reads org `brandDNA` (voice). Re-point via the two chokepoints (`getBrandKit`, `getBrandDNA`) so Brand-page edits actually change generation output. Then run `migrate-to-brand-identity --apply` (FIX it first: it would clobber the already-set `tagline` field with the empty website value).
4. **Example assets** on the Brand page — multi-file upload (posts/ads/imagery) → media library → into each agent's KB (proven per-agent KB channel). Use a new `/api/onboarding/brand-asset`-style Storage route (the `/api/media` multipart path returns base64, not a Storage URL).
5. **Onboarding capture** (spec ready) — add logo/colors/fonts/example-asset uploads; wire the DORMANT `initializeBrandDNAFromOnboarding` (exists, never called). onboarding/page.tsx is a 2,674-line monster → APPEND steps 25/26, extract step components, upload-on-select so the JSON submit stays unchanged.
6. **Retire duplication** — old `/settings/brand-kit` + `/settings/brand-dna` → redirect to `/settings/brand`; optionally delete the 6 dead legacy `gm_*` docs (confirm Training-Lab UI doesn't display them first).

**STILL UNTESTED by owner (video-gen):** "rebuild storyboard 5" rework (built, verified, not browser-tested); closing-shot logo preview (open Q: should the closing scene's thumbnail show the real logo + tagline?).

## KEY FILES
- Canonical store: `src/types/brand-identity.ts`, `src/lib/brand/brand-identity-service.ts`, `src/app/api/settings/brand-identity/route.ts`, `src/app/(dashboard)/settings/brand/page.tsx`.
- Re-bake: `src/lib/brand/rebake-brand-dna.ts`, `createIndustryGMVersionFromBrandRebake` in `src/lib/training/specialist-golden-master-service.ts` (+ manager mirror). Scripts: `rebake-all-gms-brand-dna.ts`, `verify-brand-rebake-{swap,live}.ts`, `audit-gm-coverage.ts`, `verify-tagline-live.ts`, `set-brand-tagline.ts`, `migrate-to-brand-identity.ts`.
- Voice/Brand DNA (the bake source): `src/lib/brand/brand-dna-service.ts` (org root doc field `brandDNA`, NOT a subdoc), baked via `scripts/lib/brand-dna-helper.js`, blunt reseed `scripts/reseed-all-gms.js`. Jasper: `src/lib/orchestrator/jasper-golden-master.ts` (loader) + `scripts/seed-jasper-orchestrator-gm.ts` + `src/lib/training/jasper-golden-master-service.ts`.
- Visual (current readers to re-point): `src/lib/video/brand-kit-service.ts` (`settings/brand-kit`), `src/lib/video/logo-compositor.ts`, `src/app/api/content/asset-generator/generate/route.ts`, `src/app/api/video/assemble/route.ts`.
- Onboarding: `src/app/api/agent/process-onboarding/route.ts`, `src/app/(dashboard)/onboarding/page.tsx`. Per-agent KB: `src/lib/ai/vector-search.ts`, `/api/agent/knowledge/[agentId]`.

---

# 🎬 RESUME HERE — Content Generator VIDEO tab (June 6–7, 2026)

## THE VISION (owner, verbatim intent)
The Video tab must produce **on-brand, cinematic, commercial-quality, photorealistic videos for social media** — so realistic people can't tell they're AI. The tenant's **Brand DNA must be fully expressed**: brand voice (text), brand **colors**, and the **real logo** (exact, not a generated lookalike). This is a REQUIREMENT, not a nice-to-have — every future customer expects the same. "Every field is filled by the AI agent" is a hard requirement (a human may skip fields manually, accepting a less-directed result).

## ARCHITECTURE (built this session — all on dev, see commits)
- The Video tab IS the **storyboard creator** (RenderZero layout, our design system): left = deep per-storyboard controls (Shot / Setting / Cast / Sound / References / **Camera & Look** = the 400-preset `CinematicControlsPanel`, advanced), right = live `ConstructedPromptDisplay` + auto-thumbnail + Hedra model badge; bottom = storyboards stack L→R (drag/dup/delete). Entry screen (old Studio opening retired). Unlimited storyboards → Generate renders each (Hedra) → stitch in order. Engine = **Hedra only**, 2 models (Kling O3 prompt / Character-3 avatar) — never "providers". Memory: `project_video_storyboard_renderzero_layout`.
- **Content chat = the Content Manager's conversational front-end** (NOT a separate agent). It converses, then on "build it" DELEGATES to the real **Video Specialist** (`script_to_storyboard`, GM-governed, Brand DNA baked). `/api/content/assistant` → `VideoSpecialist.execute` → storyboards mapped onto the canvas. Jasper's launcher hidden on `/content/*` (one agent at a time).
- **Video Specialist GM is at v4** (`scripts/seed-video-specialist-gm.js`, reseed with `node scripts/seed-video-specialist-gm.js --force`). v2 = structured fields, v3 = character consistency, v4 = fills `cinematicConfig` (camera/focalLength/lensType/lighting/filmStock/**videographerStyle**/movieLook/composition) from a curated menu. ALL scene fields are REQUIRED in the Zod schema → the AI must fill every field or the build fails.
- **Hedra image fix**: model selection now prefers Flux/Sana (text-to-image, permissive) over GPT-Image (was picking an I2I model → every thumbnail 500'd). Body is top-level. `src/lib/video/hedra-service.ts`.
- **Preset example images**: 390 generated once (`scripts/generate-preset-thumbnails.ts`, resumable) → `src/lib/ai/cinematic-preset-thumbnails.generated.ts` merged into the pickers. Per-medium: **Videographer Style** (18 cinematographers) on Video, Photographer Style on Image (`medium` prop on CinematicControlsPanel).
- **Brand DNA in images**: brand COLORS injected into the image prompt; **real LOGO composited** onto generated images via `src/lib/video/logo-compositor.ts` (sharp, uses brand-kit url/position/opacity/scale) in the asset-generator route. `getBrandKit()` = `src/lib/video/brand-kit-service.ts`.
- Auto-thumbnails fire proactively for any storyboard with content but no preview. Project **aspect-ratio** control in the header drives `brief.aspectRatio` (real output). **Scrap video** button + **delete saved projects** (two-step).

## ⚠️ NEXT STEPS (do these; verify with owner)
1. **Run the full prod build** — the logo-compositing commit (`1beeee30`) was committed on tsc+eslint+hook only (context ran out before `npm run build`). Run `npm run build`, confirm green.
2. **Make sure the real logo is actually uploaded in the brand kit** (`organizations/{PLATFORM_ID}/settings/brand-kit`, logo.url must be an absolute https URL) — compositing no-ops without it. Walk the owner through uploading it if missing.
3. **Test end-to-end with the owner**: scrap → re-run the Content Manager prompt → confirm every storyboard has ALL fields filled (incl Camera & Look), consistent character, brand colors, and the **real logo** on the thumbnails.
4. **Logo on the brand-CARD/CTA scene specifically** (centerpiece, not just corner watermark) + **logo watermark on the FINAL rendered video** (assembly step) — the brand kit is designed for video output; verify/wire it into `/api/video/assemble` + generation.
5. **Cinematic realism**: the headline goal is photoreal commercial quality. Evaluate the actual Hedra VIDEO output (not just thumbnails) for realism; tune prompts/models/Character-3 clone usage.
6. Still open from the broader redesign: Generate → auto-stitch → land in the Editor for review; Image tab (own RenderZero-style screen); Audio Lab music-first; Characters tab.

## WORKING RULES (owner is strict)
- Dev server: `localhost:3000` from `D:\rapid-dev` (it logs to `D:\rapid-dev\dev-server.log`; I tail it via the Monitor tool to watch the owner's actions + system responses live — re-arm it). Owner walks features manually; watch the log + verify DB.
- Verify EVERYTHING: full `npm run build`, check the REAL exit code (grep the log). tsc + eslint before commit.
- Commit to `dev` with co-author "Claude Opus 4.8 (1M context)"; after push, `cd D:\rapid-dev && git merge origin/dev --no-edit` (NO `.next` clear while the server runs — it caused ChunkLoadError; hot-reload picks up merges).
- Reuse existing code; Standing Rules #1 (Brand DNA baked into every GM) and #2 (no GM change without a human grade — but deliberate reseeds via seed scripts are allowed) apply.
- A dev-only ClientLogBridge (`src/components/dev/ClientLogBridge.tsx`) forwards browser errors/route changes to the dev log so the monitor sees both sides.

## Latest commit at handoff: `1beeee30` (dev = GitHub = rapid-dev synced).

---

# 🎯 CURRENT SESSION — Per-agent knowledge bases DONE + penthouse-finish ground truth (June 4, 2026)

## ✅ PENTHOUSE-FINISH PROGRESS (June 4–5) — START HERE on resume
**DONE this session (all committed + pushed to dev):**
- Security: `/api/meetings/list` auth gate (`ab3a6283`). Verified finish-map folded in (`a528467d`).
- **Cut-platform delete** (`6395d07c`): Reddit/Telegram/Truth Social removed (~3,300 lines), WhatsApp kept.
- **Vercel build fixed**: agent-registry regen (was failing last 2 deploys, `934ec38e`); startup log-noise demoted info→debug so build logs are readable (`46eb47b3`).
- **DATA-PATH CONVERSION COMPLETE** (`9e0e7d10`,`e43a29d5`,`92a4b0fd`,`8aa9f316`): all ~37 browser→Firestore pages converted to auth-gated Admin-SDK API routes, INCLUDING the entity-table CRM (`useRecords` → new `/api/entities/[entityName]/records`) which is the real leads/contacts screen (`/leads`,`/contacts` redirect to it). tsc + build green each wave. ONLY deferred: `workflows/builder` + `workflows/new` (builder↔engine schema mismatch — priority-logged below).
- **Schema feature** (`7a9a1683`): pick-list `options` + field `description` now persist + are configurable in the schema editor; entity form renders help-text + real multiSelect. Leads schema backfilled (`154592d9`).
- **Team system** (`5bb92a92`): `GET /api/team/members`, invite-accept now writes the `members` subcollection (was a broken seam — invited users were invisible to leaderboard/routing/mentions), new `'user'` "Team Member" assignee field type (live dropdown), backfills. REAL team = David Stamper (you) + J David Stamper + YC Reviewer; everything else is demo.
- **Demo/test data MANIFEST** (`scripts/inventory-demo-test-data.ts`, `25327b6c`): every collection's seed/test records catalogued. KEEP for now (test on it, no re-seeding), PURGE before production. Note: leads/contacts/deals/companies/team are ALL demo+test — zero real leads.
- **MASTER MANUAL TEST PLAN** assembled (`ca3397e8`): 86 tests, manual + back-end + AI path, all 5 domains (below).

**NEXT — pick up here (order):**
1. ⚠️ **CONTENT GENERATOR REDESIGN — DO FIRST.** Owner (Jun 5): "the entire design is wrong on this." The content-generator section must be corrected/redesigned so it actually makes sense BEFORE walking the Section-C content tests — testing the current design is wasted effort. (Specifics to be captured with owner; pausing the test walk until this is sorted.)
2. **Walk the MASTER MANUAL TEST PLAN** (below), Section A onward — manual first, then the Jasper AI path per vertical. Server on localhost:3000; Claude watches the dev log + verifies DB per step.
3. Fix catalogued KNOWN-BROKEN as hit: Workforce Execute/Logs 404, Companies/Invoices detail 404, Video Studio text stub, Playbook buttons unwired, Risk no deal-picker, compliance-reports empty shell, leads CSV-import no UI button, workflow builder schema mismatch, ElevenLabs key invalid, integrations 3-source state.
4. Payments vertical: owner opens merchant accounts; finish `verify2Checkout` stub + Razorpay/Braintree storefront toggles + subscription-processor-selector writer.
5. Purge demo/test data (run the manifest as a delete) → then multi-tenant flip.

Decisions locked: keep ALL payment processors (single active, switchable); WhatsApp kept; demo data kept for testing then purged; entity-table system is the canonical CRM. Standing order: Claude orchestrates, subagents do the work, Claude verifies every output (tsc + full build, real exit code) before "done".

# 🎨 CONTENT GENERATOR REDESIGN — owner-designed spec (Jun 5 2026). BUILD TO THIS.
Owner verdict: the 6 tabs feel like separate systems; capabilities exist, design/flow don't. Fix one tab at a time, finish + VERIFY each (owner-in-loop, looks + works) before the next.

**Tabs:** Video · Image · Editor · Library · Audio Lab · **Characters (new)**. **STUDIO TAB REMOVED** — its job becomes a cross-tab Content Assistant.

**CORE PRINCIPLE — context is everything** (quality marketing content needs rich context; don't make the client invent it). THREE context channels feed the SAME generation:
1. **Structured fields** — prompt the client for what they'd never specify: location, time of day, lighting, mood, background noise/ambience, extras (characters), wardrobe, camera/shot, action, dialogue/VO, etc. (tailored per content type).
2. **Conversation** — the Content Assistant PROPOSES field values from Brand DNA + campaign (smart defaults), then ASKS for the gaps. Fill fields manually OR talk — same rich result.
3. **Uploaded references** — image / video / text. Reuses existing provider reference inputs (image-to-video, reference-to-video, start+end-frame, image-to-image) + per-agent KB for text.
- **Per-field COPY-FORWARD between scenes** — carry location/lighting/extras/character forward, change only the delta → continuity + longer continuous scenes.

**CONTENT ASSISTANT (replaces Studio tab):** slide-in chat panel on EVERY content tab (toolbar toggle). NOT Jasper — content-scoped. Powered by a **content-director agent = the Content Manager's conversational front-end, OWN Golden Master + Brand DNA baked in** (Standing Rule #1), grade-pipeline-governed (Rule #2). It converses to fill the context fields, then DELEGATES generation to existing content specialists (script writer, copywriter, image/video/music). Tab-aware: hands assembled context into the active tool.

**TAB DESIGNS:**
- **VIDEO** = storyboard pipeline: **Script** (AI writes → you approve) → **Storyboard/Plan** (scenes + context fields + refs + copy-forward) → **Generate** (each scene → Hedra clip) → **Review & Edit** (NEW explicit step — keep/regenerate per clip; today it's buried inside Generation) → **Assemble** (existing `/api/video/assemble`) → **Polish/Post-Prod** (LIGHT guided: brand color + audio level + logo; the Editor tab is the deep manual option) → **Publish**. REUSE: `script-generation-service.ts`, `/api/video/{decompose,generate-scenes,poll-scenes,regenerate-scene,assemble}`, `video_pipeline_projects` (Admin SDK). REMOVE the wrong "Studio/request" opening (`StudioModePanel`) → replace with the Script step. Wire drag-reorder (store action exists, UI not wired).
- **IMAGE** = clean image generator/editor (describe + upload references + edit). STRIP the duplicated video/scene-queue overload.
- **EDITOR** = manual timeline editor (already close to right) — deep video fine-tune.
- **LIBRARY** = deep-filter media library (already close to right) — stores all assets + references + characters.
- **AUDIO LAB** = Suno-style MUSIC first (styles + an AI music agent); voice/clone as secondary.
- **CHARACTERS (new tab)** = create + manage reusable digital clones. Guided flow: record chroma-key video → Hedra avatar/clone; record the PROVEN inflection-capturing voice script (already exists in Audio Lab "Voice Clone Script") → voice clone; save as a named **Character**. Cast a Character into any video scene's extras/characters field (Hedra renders them speaking the line in their voice); copy-forward keeps them consistent across scenes. UNIFIES the currently-split avatar (`/api/video/avatar-profiles`, clone wizard) + voice (Audio Lab).

**BUILD ORDER (finish + verify each before next):** (1) Studio removal + Content Assistant ✅ DONE (`93447148` — slide-in panel on every content tab, Brand-DNA system prompt, OpenRouter; v1 conversation-only, hand-off/fields/uploads still TODO), (2) **Video storyboard step ← NEXT, design locked, build this**, (3) rest of Video pipeline (Script/Review/Polish), (4) Image cleanup, (5) Audio Lab → music-first, (6) Characters tab, (7) Editor/Library polish.

## ▶️ VIDEO STORYBOARD STEP — BUILD SPEC (next task, design locked Jun 5; START HERE for content-gen)
Reshape the EXISTING `src/app/(dashboard)/content/video/components/StepStoryboard.tsx` into a HUMAN-WALKABLE scene builder. **REUSE the advanced model — do NOT reinvent:** `PipelineScene` (`src/types/video-pipeline.ts:111`) + `CinematicConfig` (`src/types/creative-studio.ts:79-95`: shotType, viewingDirection, subjectUnawareOfCamera, lighting, atmosphere, camera, focalLength, lensType, filmStock, aspectRatio, temperature, photographerStyle, movieLook, filters, artStyle, composition), per-scene `avatarId`/`voiceId`, `referenceImages`/`CharacterReference`, the preset library, and store actions `addScene/updateScene/removeScene/reorderScenes` (`src/lib/stores/video-pipeline-store.ts`). The advanced cinematic fields the owner remembered = `CinematicConfig` (modeled after a high-end cinematic prompt tool).

FLOW (manual-first; AI-assist optional):
- Scenes shown as a strip; current scene's context form open. Fields grouped in PLAIN language, mapped onto CinematicConfig + scene plain fields: **Shot** (title, action, dialogue/VO, duration) · **Setting** (location, time of day, weather) · **Look** (lighting, color/mood, style; advanced: focal length, lens, film stock, photographer/movie look, temperature) · **Sound** (background ambience/noise, music cue) · **Cast** (character/clone select per scene → `avatarId`; wardrobe) · **Camera** (shot type, movement, angle) · **References** (drop image/video per scene).
- Content Assistant can pre-fill fields (Brand-DNA defaults + ask gaps).
- **UNLIMITED scenes** (no fixed count): **"+ Add Scene"** (optionally per-field copy-forward "same as previous" for setting/look/cast → longer continuous scenes) or **"Generate Video"**.
- Wire **drag-reorder** to `reorderScenes` (UI handle exists, not wired); duplicate; delete.
- **AUTO-THUMBNAIL (owner detail):** on finishing a scene (Add Scene OR Generate), auto-generate a thumbnail image FROM the scene description (reuse the existing storyboard-preview generation in StepStoryboard / `/api/content/asset-generator/generate`) → set `scene.screenshotUrl` so the operator SEES each scene visually before submitting the project.
- **Engine = Hedra (only video API).** Model inferred per scene: character present → Hedra **Character-3** (avatar); none → Hedra **Kling O3** (prompt-only). Any override labeled "**Hedra model**" — NOT a fake provider list (the `StudioModePanel` "Video API Provider: kling/google/fal" dropdown is MISLABELED; it dies when StudioModePanel is retired).

GENERATE → each scene → Hedra clip (`/api/video/generate-scenes`) → Review & Edit → Assemble/stitch in order (`/api/video/assemble`, already concatenates N scenes).

**LIBRARY round-trip (owner detail):** finished/edited videos save to the Media Library; edits save OVER the original; Library supports copy-and-edit of existing items.

REMOVE the wrong `request`/Studio opening (`StudioModePanel`) — replace with this storyboard-first flow. Persistence = `video_pipeline_projects` (Admin SDK, already API-path). VERIFY: tsc + full `npm run build` (real exit 0) + walk it manually on localhost:3000. Full Video-tab map is in the Jun-5 mapping-agent transcript.

---

# 🧪 MASTER MANUAL TEST PLAN — front-end + back-end + AI orchestration (assembled Jun 5 2026)
HOW TO USE: walk ONE test per turn on localhost:3000. Per test: operator clicks + reports; Claude watches the dev-server log (expect `GET/POST/PATCH /api/... 200`) and verifies the DB; mark **[P]ass / [F]ail / [B]locked-needs-human**. Doctrine: test EVERY feature via BOTH the manual UI AND the Jasper AI path where one exists. NOTE: still testing on demo/seed data (manifest = `scripts/inventory-demo-test-data.ts`); purge before production.

PROGRESS so far this session: Dashboard loads **[P]** (caveat: recent-activity feed empty — missing Firestore composite index on `records`/entityType+createdAt, logged). Leads list loads **[P]**. Entity-CRM data path secured + verified **[P]**. Schema options/help-text + team-member dropdown built + verified **[P]**.

⚠️ KNOWN-BROKEN (catalogued — expected FAILs, don't re-debug from scratch): Companies detail 404 · Invoices detail 404 · Workforce Execute + Logs buttons 404 · Video Studio Text tool = stub (echoes prompt) · Playbook "generate" buttons unwired · Leads CSV import has no UI button (backend exists) · compliance-reports = permanently-empty shell · Risk page no deal picker (type ID by hand) · Workflow builder/new unconverted + schema mismatch (automations OFF) · ElevenLabs key invalid → voice/clone fails · Integrations connection-state inconsistent (3 sources).

## A. CRM & REVENUE
1. Leads list (`/leads`→`/entities/leads`) — M: loads, search/filters work. B: `GET /api/entities/leads/records 200` + `/api/schemas` + `/api/team/members`. AI: "show my newest leads" → read summary.
2. Lead create — M: +Add Lead → fill → Add → row appears. B: `POST /api/entities/leads/records 201`. AI: "add lead Jane Doe jane@acme.com" → mission → approve → created.
3. Lead edit — M: Edit → change Status → Update → reflects. B: `PATCH /api/entities/leads/records/[id] 200`. AI: "mark Jane Doe qualified" → mission.
4. Lead delete — M: Delete → confirm. B: `DELETE /api/leads {ids:[id]} 200`. AI: n/a.
5. Convert-to-deal (`/leads/[id]`) — M: Convert to Deal → confirm → redirect to deal. B: `POST /api/deals 200`. AI: "convert Jane Doe to a deal".
6. Lead CSV import — ⚠️ no UI button found; backend `POST /api/leads/import` only. Flag/verify.
7. Lead scoring (`/lead-scoring`) — M: cards render, create/toggle a rule. B: `GET/POST /api/lead-scoring/rules 200`. AI: "re-score my leads".
8. Contacts (`/contacts`→`/entities/contacts`) — M: list/create/edit/delete. B: entity records routes; delete `DELETE /api/contacts/[id]`. AI: "add contact John Smith at Acme".
9. Companies (`/companies`) — M: list + New Company create. B: `GET/POST /api/crm/companies 200`. AI: "add company Acme Corp".
10. ⚠️ Company detail (`/companies/[id]`) — M: click row → **404 KNOWN-BROKEN**.
11. Deals list (`/deals`) — M: pipeline/list toggle, value total. B: `GET /api/deals 200`. AI: "what's in my pipeline?".
12. Deal create (`/deals/new`) — M: fill → save → card. B: `POST /api/deals 200`. AI: "create deal Acme Renewal $25k".
13. Deal open/edit (`/deals/[id]`) — M: detail + edit value. B: `GET /api/deals/[id]` + `GET /api/crm/deals/[id]/health`; `PATCH /api/deals/[id]`. AI: "bump Acme Renewal to $30k".
14. Deal stage Won/Lost — M: Mark Won / Mark Lost(+reason). B: `POST /api/deals/[id]/stage 200` (+PATCH lostReason). AI: "mark Acme Renewal won".
15. ⚠️ Invoices (`/deals/invoices`) — M: list + create work; click row → detail **404 KNOWN-BROKEN**.
16. Activities (`/activities`) — M: list + log activity. B: `GET /api/crm/activities 200`. AI: "log a call with John Smith".
17. Tasks (`/tasks`) — M: list + Create Task + toggle status. B: `GET/POST /api/team/tasks 200`. AI: "create a task to follow up Acme Friday".
18. Proposals (`/proposals`, `/proposals/builder`) — M: list templates; builder create/save. B: `GET/POST/DELETE /api/proposals/templates 200`. AI: "draft an onboarding proposal template".
19. Products (`/products`) — M: list/create/delete. B: `GET /api/products 200`, `DELETE /api/products/[id]`. AI: "add product Pro Plan $99".
20. Orders (`/orders`) — M: list + open drawer + update status. B: `GET /api/ecommerce/orders 200`, `PUT .../[id]`. AI: "mark order #1234 fulfilled".
21. Coupons (`/coupons`) — M: create / pause-activate / delete; analytics on `/settings/promotions`. B: `GET/POST /api/coupons`, `PUT /api/coupons/[id]/status`, `/api/coupons/analytics`. AI: "create 20% coupon SAVE20".
22. Campaigns (`/campaigns`) — M: New Campaign → template → routes to Mission Control (Jasper-orchestrated). B: `GET /api/campaigns 200`. AI (primary): "create a product-launch campaign".
23. Sequences (`/sequences`→`/outbound/sequences`) — M: create sequence + enroll a lead. B: `/api/outbound/sequences` routes. AI: "enroll Jane Doe in cold-outreach".
24. Nurture (`/nurture`) — M: create/edit/stats. B: `GET /api/nurture 200`. AI: "build a 3-step nurture for trial signups".
25. Battlecards (`/battlecards`) — M: discover competitor → generate → export. B: `POST /api/battlecard/competitor/discover` + `/generate` + `/export 200`. AI: "battlecard vs hubspot.com".
26. ⚠️ Playbook (`/playbook`) — M: generate buttons present but **unwired** — verify/flag. B: `GET /api/playbook/list`; `/[id]/metrics`. AI: "generate a playbook from my top calls".
27. Storefront/payments config (`/settings/storefront`) — M: pick active processor → Save. B: `GET/PUT /api/settings/storefront 200` (writes storefrontConfig + ecommerce/config). AI: n/a.
28. Record manual payment (`/deals/payments`) — M: Record Payment → fill. B: `GET/POST /api/crm/payments 200`. AI: "record $2000 bank transfer from Acme".
29. ⚠️[B] Test checkout — NEEDS-HUMAN live Stripe key. `POST /api/checkout/initiate|complete`.
30. ⚠️[B] Subscription checkout — NEEDS-HUMAN live Stripe. `POST /api/subscriptions/checkout`.

## B. AI AGENTS & MISSION CONTROL (crown jewel — verify Jasper only DELEGATES; no GM change without a human grade)
31. Jasper chat (floating launcher, any page) — M: type "create a lead for Acme" → reply drafts a PLAN + "review in Mission Control" link (NOT a finished lead). B: `POST /api/orchestrator/chat 200` → toolCall `propose_mission_plan` + mission doc `PLAN_PENDING_APPROVAL`.
32. Mission Control plan pre-approval (`/mission-control`) — M: select mission → edit a step's args / reorder / delete → approve each step. B: `/plan/edit-step|reorder|delete-step|approve-step 200`; steps flip `operatorApproved:true`.
33. Sequential execute + per-step gate — M: approve all → Run → steps run top-to-bottom. B: `/plan/approve 200`; with one step unapproved expect **409 + unapprovedStepIds**; status IN_PROGRESS→COMPLETED.
34. Retry → halt — M: a step fails → auto-retry once → 2nd fail halts to AWAITING_APPROVAL w/ scrap+rerun. B: `finalStatus:AWAITING_APPROVAL`, step FAILED; rerun `/steps/[id]/rerun`.
35. Downstream-changed flag — M: rerun an earlier step → downstream shows "upstream changed" → clear or rerun. B: `/steps/[id]/clear-upstream-flag 200`.
36. Edit-output / scrap / rerun — M: Edit output directly (sets manuallyEdited), Cancel Mission (two-step). B: `/steps/[id]/edit-output`, `/cancel 200`.
37. Step grading → Prompt Engineer → new GM version — M: Rate a step → reason → pick target → 3-box popup → approve. B: `/grade` + `POST /api/training/grade-specialist 200` (status EDIT_PROPOSED + feedbackId) → `/feedback/[id]/approve` → TrainingFeedback record + new GM version. (Standing Rule #2: no grade → no GM write.)
38. Version history + rollback — M: "<specialist> — history" → rollback. B: `GET /api/training/grade-specialist/[id]/versions`, `POST .../rollback 200`.
39. Workforce hub (`/workforce`) — M: agent grid/hierarchy + Refresh. B: system-status + `/api/orchestrator/system-health 200`.
40. ⚠️ Workforce Execute button — M: click → `/workforce/execute` **404 KNOWN-BROKEN**.
41. ⚠️ Workforce Logs button — M: click → `/admin/system/logs` **404 KNOWN-BROKEN**.
42. Per-agent Knowledge (`/workforce/agents/[id]/knowledge`) — M: upload file/URL/FAQ, list, delete. B: `GET /api/agent/knowledge/[id] 200`, upload `POST /api/agent/knowledge/upload`. Verify isolation to that agentId.
43. Intelligence/Discovery (`/intelligence/discovery`) — M: run discovery → results. B: 200, no console errors.
44. Coaching (`/coaching`) — M: pick period → Generate coaching → cards. B: generate 200.
45. Executive briefing (`/executive-briefing`) — M: dept summaries + pending approvals render. B: `GET /api/orchestrator/executive-briefing 200`.
46. Performance (`/workforce/performance`) — M: per-specialist metrics + improvement analysis. B: `GET /api/swarm/performance 200`.
47. Training Lab (`/settings/ai-agents/training`) — M: pick agent → GM Versions → Deploy a version. B: `GET /api/training/gm-versions`; `POST /api/training/deploy-golden-master 200`.

## C. CONTENT & SOCIAL
48. Studio image/music/video (`/content/video/studio`) — M: pick Image tool → prompt → generate → canvas + Recent rail. B: `POST /api/content/asset-generator/generate` + `POST /api/media 200`. AI: n/a (manual tool).
49. ⚠️ Studio Text tool — M: generate → **STUB, echoes prompt** (no HTTP call). KNOWN-BROKEN.
50. Image generator (`/content/image-generator`) — M: prompt → image → library. B: same generate+media.
51. Recent generations sidebar — M: click recent → restores to canvas; drag image onto video tool. B: `GET /api/media 200`.
52. Social hub (`/social`) — M: metrics row real (no random), platform pills Live/Coming-Soon. B: parallel 200s (`/api/social/accounts|metrics/overview|agent-status|activity`). Live = Bluesky/Mastodon/X only.
53. ⚠️[B] Connect a platform — NEEDS-HUMAN OAuth; only Bluesky/Mastodon/X have a live path; rest coming_soon.
54. Per-platform composer (`/social/platforms/bluesky`) — M: type → Post, or Generate with AI → edit → Post. B: `POST /api/social/post 200` (published doc); AI draft `POST /api/social/platforms/[p]/generate-post`. AI: "write+post a Bluesky update" → Marketing mgr → BLUESKY_EXPERT → Mission Control.
55. Schedule post + queue — M: set future time → Schedule → appears in queue + `/social/calendar`. B: `POST /api/social/post {scheduledFor} 200`.
56. Social approvals (`/social/approvals`) — M: review flagged drafts → edit (captures correction) → approve/bulk. B: `GET /api/social/approvals 200`.
57. Social listening (`/social/listening`) — M: set keywords/competitors → save; filter mentions. B: `GET /api/social/listening 200`. AI: "reply to latest pricing mention" → approval gate.
58. Social analytics (`/social/analytics`) — M: charts/tables from real data. B: `/api/social/metrics/* 200`.
59. Conversations (`/conversations`) — M: active sessions live; open thread; Take Over; flag-for-training (History). B: Firestore subscription (ChatSessionService) — assert docs, not REST.
60. Calls log (`/calls`) — M: History + Schedule a call. B: `GET /api/calls 200`; schedule `POST /api/voice/calls/schedule 200`. AI: "schedule a call to +1555 tomorrow 2pm".
61. ⚠️[B] Make call (`/calls/make`) — NEEDS-HUMAN Twilio. `POST /api/voice/call`.

## D. EMAIL, GROWTH & MEDIA
62. Email Writer (`/email-writer`) — M: pick type + lead → Generate → subject+body + Recent row. B: email-writer generate 200. AI: "write a follow-up to [lead] about our demo" → delegate_to_content (COPYWRITER).
63. Email campaign create (`/email/campaigns/new`) — M: fill → Create → list. B: `GET /api/email/campaigns 200`; create → emailCampaigns doc. AI: "set up a pricing-announcement campaign".
64. ⚠️[B] Email send — NEEDS-HUMAN SendGrid/Gmail keys. `POST /api/email/send`; or Send-Test in templates.
65. Email templates (`/settings/email-templates`) — M: Custom Templates → designer blocks → Save; delete (two-step). B: `GET/POST/DELETE /api/email/html-templates 200`.
66. Marketing budget (`/marketing/budget`) — M: set budget + per-platform spend → Analyze → recommendations; Apply copies prompt. B: budget-strategist 200; "Pull from CRM" → `/api/contacts`. ⚠️ auto-apply to Google/Meta NOT wired. AI: "rebalance ad budget toward what's converting".
67. SEO settings (`/website/seo`) — M: edit robots/llms, toggle AI bots → Save. B: `POST /api/website/settings 200`. ⚠️[B] GSC connect NEEDS-HUMAN. AI: "write an SEO landing page for [topic]" → delegate_to_builder.
68. ⚠️[B] Voice/Audio lab (`/content/voice-lab`) — M: Designer/Music/Studio generate. B: `/api/voice/tts`, `/api/audio/music`. **NEEDS-HUMAN + ElevenLabs key INVALID → will fail.**
69. Video library (`/content/video/library`) — M: filter/search/detail/two-step delete. B: media list 200. ⚠️[B] clone wizard needs ElevenLabs/avatar keys.
70. Website pages (`/website/pages`) — M: AI Generate or Clone Website → new page → publish. B: `GET/POST /api/website/pages`, `POST /api/website/ai/generate 200`. AI: "build a pricing page" → delegate_to_builder.
71. ⚠️[B] Website domains (`/website/domains`) — NEEDS-HUMAN DNS. `POST /api/website/domain`.
72. Forms (`/forms`) — M: create → add fields + conditional rule → preview hide/show → Publish → submit public form. B: publish `POST /api/forms/[id]/publish`; submit `POST /api/public/forms/[id] 200` → **creates a lead** (verify `leads` doc). AI: n/a.
73. ⚠️[B] Scraper (`/scraper`→`/leads/research`) — M: query/URL → Run → results → export. B: `/api/leads/research 200`. NEEDS-HUMAN live scrape. AI: "research top 5 competitors + pricing" → delegate_to_intelligence.
74. Academy (`/academy`) — M: tutorials grid + category filter + player. B: `GET /api/academy 200` (published only).

## E. PLATFORM, TEAM & INTEGRATIONS
75. Team roster (`/settings/users`) — M: table + stats; change role inline; Edit; Remove (confirm). B: `GET /api/admin/users 200`; `PATCH/DELETE /api/admin/users`.
76. Invite user — M: +Invite User → email + role → Send → Pending row. B: `POST /api/users/invite 201` → invites doc (7-day expiry); role-hierarchy enforced.
77. Team-member dropdown (assignee) — M: open a lead → Assigned To lists REAL teammates by name → select persists. B: `GET /api/team/members 200` (excludes agents/removed). [verify it shows ONLY real team after demo purge]
78. Onboarding (`/onboarding`) — M: website URL → auto-fill → walk 24 steps → Complete → redirect. B: `PATCH /api/onboarding/progress`; `POST /api/agent/process-onboarding 200`. ⚠️[B] Google connect step NEEDS-HUMAN.
79. ⚠️ Integrations (`/settings/integrations`) — M: category pills, Connect a service (OAuth NEEDS-HUMAN). B: `/api/integrations/google|microsoft/status`, `/api/social/accounts`. **FLAG: state from 3 inconsistent sources.**
80. Storefront/payments (`/settings/storefront`) — (see #27).
81. Meetings (`/meetings`) — M: list loads (now auth-gated — verify no redirect loop); Cancel (two-step), Delete (two-step), Refresh; Schedule opens `/book`. B: `GET /api/meetings/list 200`; cancel/delete routes. ⚠️[B] calendar sync NEEDS-HUMAN Google.
82. Workflows (`/workflows`) — M: list + Pause/Activate + Delete. B: `GET /api/workflows 200`, `PATCH/DELETE .../[id]`. ⚠️ builder/new KNOWN-BROKEN (unconverted + schema mismatch; automations OFF) — test list/toggle/delete only.
83. Analytics (`/analytics` + subpages) — M: period selector; revenue/pipeline/ecommerce/workflows cards + each subpage loads. B: `/api/analytics/* 200`.
84. System (`/system`) — M: as admin, health grid; as member, Access Denied. B: `GET /api/health 200`.
85. ⚠️ Compliance-reports (`/compliance-reports`) — M: loads → empty state. **KNOWN-BROKEN permanently-empty shell** (nothing writes the collection).
86. ⚠️ Risk (`/risk`) — M: type a Deal ID (or Load Demo Data) → Predict Risk → cards. **FLAG: no deal picker.** B: `POST /api/risk/predict 200`.

---
## MANUAL TEST PLAN — CRM vertical (the spine, original detail; now folded into section A above). Walk one step at a time, operator-in-loop, on localhost:3000. Mark PASS/FAIL as we go.
Doctrine: test each capability via BOTH the manual UI AND the AI (Jasper) path. "Done" = watched it work with real data, not "code looks right".
- **A. App loads** — open localhost:3000, land on dashboard logged in.
- **B. Leads (manual UI):** (1) list loads with data · (2) create a lead via the form → appears in list · (3) open the lead → detail renders · (4) edit → change saves · (5) "Convert to deal" → deal created [NOTE: currently a client-side write — data-path Tier-1 item] · (6) CSV import → rows imported · (7) delete a test lead.
- **C. Contacts:** list / create / open / edit / delete.
- **D. Companies:** list loads · create · **open a company → KNOWN BROKEN (404, no `[id]` page)** — expected fail, already on the fix list.
- **E. Deals:** list / create / open / edit / move stage · **invoices drill-down → KNOWN BROKEN (404, no `[id]`)**.
- **F. Lead scoring:** page loads · recalculate score.
- **G. AI path (Jasper):** in chat, "create a lead for <name> at <company>" → Jasper delegates → Mission Control plan → operator approves → lead appears in CRM. Then grade the step.
Known data-path caveat for this vertical: several of these CRM pages read/write Firestore in the browser (Tier-1 burn-down) — they WORK today but get converted before multi-tenant.

## Shipped + PROVEN this session (commits `583ff92b`, `40f6c5ce`, pushed to dev)
**Per-agent isolated knowledge bases.** Every agent gets its OWN knowledge base — no cross-agent bleed, no bleed into the global Jasper/chat RAG. Pilot agent = **Copywriter (`COPYWRITER`)**.
- `vector-search.ts`: `searchKnowledgeBase`/`storeEmbedding`/`indexKnowledgeBase` take an optional `agentId` (canonical registry id). Per-agent doc, `agentId`-tagged embeddings, stale-cleanup on re-index; global path filters OUT agent-tagged vectors. No agentId = legacy global (backward compatible).
- `rag-service.getAgentKnowledgeContext(agentId, query)` → prompt block. Copywriter wired in `callOpenRouter` to pull its own KB every action.
- API `GET/POST/DELETE /api/agent/knowledge/[agentId]` (files, URLs, FAQs, pasted text, **video/audio auto-transcribed**; merges + re-indexes; id validated vs registry).
- UI `/workforce/agents/[agentId]/knowledge` (upload / list / two-step-delete), reached via a new **"Knowledge"** button on each Workforce agent card.
- **Embeddings now run on OpenAI** `text-embedding-3-small` (768 dims) via the central Firestore key (`apiKeyService`) — the Gemini embed key was failing, so it had been silently on the hash fallback. Proven semantic: related 0.54 cosine, unrelated 0.04.
- **Video/audio → transcript** via Deepgram (`transcribeAudioBuffer`, accepts video containers directly, no ffmpeg). Proven: OpenAI-TTS→Deepgram returned the exact sentence.
- **Live output PROVEN** (`scripts/verify-copywriter-knowledge-live.ts`): an INVENTED guarantee seeded into the Copywriter's KB appeared verbatim in real generated email copy — the full upload→embed→retrieve→inject→generate loop. Three verify scripts total (`verify-per-agent-knowledge.ts` 6/6 isolation, plus the live one).
- **NOT rolled out to the other 73 agents** — waits on an operator manual walkthrough confirming the pilot.
- **Found (separate fix):** the ElevenLabs key stored in Firestore is INVALID (401) — voice/TTS on that provider is dead.

## VERIFIED GROUND TRUTH for the penthouse-finish (measured against CODE on June 4, not docs — re-verify before trusting)
A second AI (Cursor) reviewed the repo; most of its structural claims are TRUE and often understated, but the one it called the multi-tenant blocker is WRONG for current code:
- **Type safety:** `as any` = 0, `@ts-ignore` = 0, eslint-disable = 9. The real "trust me" debt = **232 `as unknown as`** double-casts. (Total `as` ~6,180, mostly legit narrowing.) So "zero shortcuts" is mostly true with 232 exceptions.
- **Tests:** only **4** real test files in `src/` for ~300k LOC; jest installed but unused. **221** one-off `scripts/` (57 `verify-*`) that prove things once then go stale. Need ~5 permanent automated tests over the core flows.
- **God components (no new features until split):** `jasper-tools.ts` 7,639 · `onboarding/page.tsx` 2,674 · `settings/ai-agents/training/page.tsx` 3,237 · `settings/email-templates/page.tsx` 2,578 · several agent managers 2,300–3,572.
- **Design-system violations** concentrated in Mission Control: **612 inline `style={{`** + **111 hardcoded hex** colors.
- **DATA PATH — TWO SEPARATE ISSUES, do NOT conflate (corrected June 4 via direct grep):**
  - (a) The SERVER-side "wrong door" bug (server code using the client SDK → silent Firestore-rule rejections) WAS genuinely fixed June 2–3. That work stands.
  - (b) SEPARATE and STILL OPEN: **browser pages that read/write Firestore directly via the client `FirestoreService`.** Ground truth: `@/lib/db/firestore-service` is imported by **31 dashboard pages** (and **81 files** total in `src`) — NOT 0. Raw `firebase/firestore` appears in **30** dashboard pages (some type-only). The earlier "only TWO pages (academy, dashboard)" claim was WRONG by an order of magnitude (a prior bad grep — five independent sweep agents + a hand grep on June 4 all agree).
  - These pages WORK today (authenticated browser + Firestore rules) so nothing is broken *now*, but each is a multi-tenant isolation concern — worst where a tenant/org id is hard-coded in the path or where the page WRITES. Fix is mechanical + repeatable (same shape as the `/api/meetings/list` auth gate done this session): convert page → `useAuthFetch` → Admin-SDK `/api` route. **This is a REAL workstream (~25–31 pages) and a multi-tenant prerequisite, not a footnote.** Severity-tagged burn-down in progress.
- **Payments — DECISION (June 4): keep ALL providers, do NOT delete (reverses earlier "keep Stripe, park the rest").** Owner wants every major processor set up as a real merchant account, with a **SINGLE ACTIVE card processor switchable at will** (invisible to buyers — buyers pick a METHOD: card / PayPal / wallet, never a processor brand). Reason: Stripe & others freeze funds; processor diversity protects clients. Others stay connected for refunds on past orders. CAVEAT: switching affects NEW transactions only — live subscriptions + vaulted cards are sticky to the processor that created them. Multi-tenant: each tenant picks their own. Up to 11 providers wired across checkout + subscriptions + ecommerce; `verify2Checkout` is a broken stub (always `verified:false`) → real work. Payments = finish-and-verify VERTICAL: (1) owner opens each merchant account (walkthroughs), (2) finish/verify each provider's code, (3) build the active-processor selector + switch logic. See memory `project_payment_processor_single_active_switchable`.
- **Dead cut-platform code — DECISION (June 4): delete Reddit + Telegram + Truth Social; KEEP WhatsApp** (real Meta messaging API, owner wants it). Sweep found ~26 files across Reddit/Telegram/Truth Social/WhatsApp incl. full composer + post-preview components and live `case 'reddit'` / `'whatsapp_business'` branches in the social OAuth auth + callback routes. Delete the three cut platforms' files + prune their branches; **leave WhatsApp wired.** Lemon8 = 0 (correctly never built).

## AGREED FINISH PLAN (single-tenant → fully tested → multi-tenant). NOTE: the data path is ~25–31 pages, NOT a 2-file fix — it is a real workstream and a multi-tenant prerequisite (corrected June 4).
1. **Freeze scope** — no new features until the current set is green (precondition for "done" to mean anything).
2. **Inventory + triage** every page/feature into works / half-works / dead / unknown (fan out with subagents, REVIEW their output). Becomes the real burn-down list here.
3. **Delete the dead:** Reddit + Telegram code, parked payment providers, confirmed-dead routes/files. Less surface to test.
4. **Convert the ~25–31 browser-Firestore pages** to the authenticated API path (HIGH first: client-side writes + hard-coded tenant ids; MEDIUM: reads only). Mechanical + repeatable (same shape as the `/api/meetings/list` gate); fan out with subagents, REVIEW each. True multi-tenant prerequisite. Also fixed this session: `/api/meetings/list` had ZERO auth (leaked every booking's name/email/phone/notes) → now `requireAuth`-gated + both callers send the token (tsc clean, not yet committed).
5. **Lay ~5 automated tests** over core flows (login, add a lead, connect Google, run a mission, send an email) so fixes stop silently breaking each other — replaces hand-run verify scripts for core flows.
6. **Walk verticals end-to-end together** (owner-manual + Claude-guided, one step per turn, one vertical fully done before the next). Spine first: **CRM + Jasper + Mission Control + email**. A vertical isn't done until walked with a real account AND covered by an automated test.
7. **UX/UI consistency pass** — only on verticals that already work. Mission Control's 612 inline styles first.
8. **Multi-tenant flip** — only after the above is green. Anything touching tenant boundaries is built/verified against the multi-tenant design NOW (use `getSubCollection()`, never hardcode the org) so it isn't re-tested twice. The 3 hard gates remain: tenantId threading, tenant-isolated Firestore rules, tenant provisioning. Single-tenant testing cannot catch cross-tenant data leaks — a dedicated isolation pass is still owed at the flip.

## STRATEGIC NOTE (log, do NOT build yet)
Possible direction: keep our own CRM as the clean workspace the AI operates on, PLUS a **one-way import connector** for customers already on HubSpot/Salesforce — instead of forcing the proprietary CRM on everyone or attempting fragile two-way sync with every CRM. Validate with one real customer conversation before writing connector code. Decision hinges on whether the first paying customer already owns a CRM. Two-way sync is a multi-month tar pit; do not let this blow up the freeze-and-finish.

## Testing doctrine (owner, standing)
Test EVERY feature via BOTH the AI-agent path AND the manual UI path. Recursive-delete all test data (deleting a Firestore doc does NOT delete subcollections). Code-shipped ≠ done; nothing is done until PROVEN with real data. ALL api keys live in Firestore (API Keys page), never env vars. Plain English, no jargon/tables when guiding the owner. Check CODE not docs; update docs to match reality.

## DATA-PATH BURN-DOWN — verified June 4 (subagent-produced, Claude spot-checked vs code)
**36 dashboard pages do client-side Firestore** (9 candidate false-positives excluded — they already use `useAuthFetch`). **23 WRITE, 13 read-only.** Root cause: `getSubCollection()` bakes the literal `PLATFORM_ID='rapid-compliance-root'` into every path (`collections.ts:151`, `platform.ts:13`), so the org id is decided in the browser. Fix per page: move the read/write into an Admin-SDK `/api` route so the tenant comes from the authed session. Hand-verified: `getSubCollection`→PLATFORM_ID literal (confirmed), `leads/[id]` client-side **deal creation** (confirmed line 452), `outbound/sequences` raw `${PLATFORM_ID}` path (confirmed line 35).

Severity — Claude's refinement (the agent flattened everything to HIGH because the org id is hard-coded everywhere; but the same hard-coded `getSubCollection` is used SERVER-side too and will be made tenant-aware at the flip. So the real client-side danger is **WRITES** and **raw hard-coded paths that bypass `getSubCollection`**; reads are lower because a tenant-aware helper + isolated rules can cover them):
- **TIER 1 — client WRITES, do first** (browser can mutate data; cross-collection / raw-path worst): `outbound/sequences` (raw path), `leads/[id]` (creates a DEAL client-side), `settings/security` (config + audit logs from browser), `settings/lead-routing`, `settings/sms-messages`, `settings/email-templates`, `settings/accounting`, `proposals` + `proposals/builder`, `contacts/new` + `contacts/[id]/edit`, `deals/new` + `deals/[id]` + `deals/[id]/edit`, `leads/[id]/edit`, `nurture/new` + `nurture/[id]`, `workflows/new` + `workflows/[workflowId]` + `workflows/builder` + `workflows/page`(via service), `ab-tests/new` + `ab-tests/[id]`, `ai/datasets/new`, `ai/fine-tuning/new`, `products/page` + `products/services`(via service), `email/campaigns`(via service).
- **TIER 2 — reads-only** (convert after writes): `dashboard`, `academy`(raw path), `calls`, `compliance-reports`, `contacts/[id]`, `nurture/[id]/stats`, `nurture/page`(via service), `ab-tests/page`, `ai/datasets`, `ai/fine-tuning`.

Effort split (agent's claim — re-confirm per page when doing the work):
- **~9 page-groups = pure REWIRE to an EXISTING route** (cheap): contacts, deals, leads, workflows (`/api/workflows`), email campaigns (`/api/email/campaigns`), email-templates (`/api/email/templates`), outbound/sequences (`/api/outbound/sequences`).
- **~14 page-groups = need a NEW Admin-SDK route built first**: ab-tests, ai/datasets, ai/fine-tuning, nurture (own route, not `/api/leads/nurture`), proposal-template CRUD, academy, dashboard-aggregate, calls, compliance-reports, settings/accounting, settings/lead-routing, settings/security, settings/sms-messages, products catalog CRUD.
- NOTE: `settings/storefront/page.tsx` ALSO writes Firestore client-side (`:151,:182`) — 37th data-path page, found during payments verification.
- ⚠️ **PRIORITY pre-multi-tenant fix — workflow builder/new schema mismatch (found Jun 5):** `workflows/builder/page.tsx` + `workflows/new/page.tsx` write browser→Firestore today and could NOT be converted in the Jun-5 wave. The builder/form emit a workflow shape (flat config, trigger types like `entity.created`, action types like `delay`/`send_email`, plus `_nodePositions`) that the `/api/workflows` route's strict domain schema (`src/lib/workflow/validation.ts`: deal-event trigger enum, nested `config` object, `actions.min(1)`) REJECTS. NOT newly broken — the browser-direct write masked a pre-existing builder↔engine schema mismatch (same "PLURAL Zod" issue flagged Jun 2–3). MUST reconcile BEFORE multi-tenant: either a builder-shaped POST/PUT schema + service path, or a client→domain adapter (+ a home for `_nodePositions`). Open question it raises: do builder-saved workflows actually EXECUTE correctly through the engine given the shape gap? (Latent — automations gated OFF.) The other 2 workflow pages (list, `[workflowId]` edit) WERE converted Jun 5.

## BROKEN BUTTONS & DEAD-ENDS — verified June 4 (subagent + Claude spot-check). 15 confirmed; fix all before launch.
HIGHEST IMPACT:
1. **Workforce "Execute" → `/workforce/execute` 404** (`workforce/page.tsx:522`) — page doesn't exist; primary action on the 73-agent hub is dead for every agent. Build the execute page (POST `/api/orchestrator/command`) or repoint.
2. **Workforce "Logs" → `/admin/system/logs` 404** (`workforce/page.tsx:537`) — no `admin/` route; 2 of 4 buttons on every agent card 404.
3. **Playbook create flow fully inert** — 4 toolbar buttons + empty-state CTA have NO onClick (`playbook/page.tsx:246-268`) despite a working `/api/playbook/generate`. ALSO the metrics panel fetches `/api/playbook/[id]/metrics` which DOESN'T EXIST (`:174`) → always "no adoption metrics". Build the route + wire the buttons.
4. **Companies & Invoices list rows 404 on click** — `companies/page.tsx:203`→`/companies/{id}` and `deals/invoices/page.tsx:165`→`/deals/invoices/{id}`, neither `[id]` route exists. Core CRM drill-down broken. Build the detail pages.
5. **compliance-reports = permanently-empty shell** (`compliance-reports/page.tsx:46`) — nothing writes the `complianceReports` collection (repo-wide grep = only the page). For a product named Rapid Compliance. Build a compliance-scan writer or remove the page.
OTHER CONFIRMED:
- Video Studio `runTextGeneration()` echoes the prompt instead of calling Copywriter (`content/video/studio/page.tsx:611`) — wire to Copywriter via orchestrator.
- Fine-tuning "Deploy Model" button: no onClick AND no deploy backend (`ai/fine-tuning/page.tsx:101`).
- `/api/learning/fine-tune` + `/api/learning/ab-test` — fully built, ZERO UI callers. Wire or delete.
- `/api/battlecard/monitor/start` + `monitor/stats` — orphaned, no UI caller. Wire or delete.
- `/api/recovery/*` (start-campaign, track, recovery-engine) — orphaned AND broken: start-campaign reads a browser-only Zustand `persist` store server-side → always 404s. Rebuild from Firestore + a real trigger, or delete the subsystem.
- Risk page makes you type a Deal ID by hand, no picker (`risk/page.tsx:251`) — add a deal lookup (`/api/deals` exists).
- `deals/[id]` "Schedule meeting" → `/outbound/meetings/schedule` 404 (`deals/[id]/page.tsx:322`).

## PAYMENTS VERTICAL — per-provider state, verified June 4
**ACTIVE-SELECTOR ALREADY EXISTS (one-time checkout):** Firestore `ecommerce/config.payments.providers[]` with exactly one `isDefault:true`; written by the storefront settings page, read by all 3 checkout entry points. Refund routing is by the provider stored on each order (correct = "others stay connected for refunds"). This IS the owner's "single active, switchable" model — just finish it. GAPS: (a) the **subscription** selector (`settings/subscription_config.paymentProvider`) is READ but NEVER WRITTEN → subscriptions frozen on Stripe until we build a writer; (b) storefront save is itself a client-side Firestore write (data-path Tier-1).
**CODE DONE — needs only live keys + a test transaction:** Stripe (chk+subs), PayPal (chk+subs), Square (chk+subs; verify real `location_id`), Paddle (chk+subs+auto-refund), Adyen (chk+auto-refund; set prod url), Hyperswitch (chk+auto-refund; defaults to SANDBOX — set prod baseUrl), Mollie (chk), Chargebee (subs).
**REAL BUILD WORK:**
1. `verify2Checkout` is a STUB always returning `verified:false` (`complete/route.ts:249`) — no 2Checkout order can confirm. Implement Verifone OAuth order-query. HIGHEST.
2. **Razorpay + Braintree** — backend fully DONE incl. auto-refund, but OMITTED from the storefront toggle (`storefront/page.tsx:162-172` lists 9, not these 2) → operator can't select them. Add toggle + default-radio. Small.
3. Subscription active-processor selector has NO writer — build the admin UI/route to set `settings/subscription_config.paymentProvider`. Medium.
4. Authorize.Net one-time flow incomplete — `initiateAuthorizeNet` returns Accept.js creds but the storefront path never calls the charge; ARB-subscription verify depends on a webhook writing `arbSubscriptionId` (prove end-to-end). Medium.
5. Automated refund missing for PayPal, Square, Authorize.Net, 2Checkout, Mollie (`payment-service.ts:592` = manual dashboard) — needed if "stays connected for refunds" must be programmatic.
All 12 provider webhook routes exist with real signature verification (need live secrets + registration, not code).

## CUT-PLATFORM DELETION MAP — verified June 4 (delete Reddit/Telegram/Truth Social; KEEP WhatsApp)
**SAFE-DELETE ORDER (critical):** shared files use exhaustive `Record<SocialPlatform,...>` maps keyed off the `SOCIAL_PLATFORMS` union (`types/social.ts:220-228`). Edit the union + ALL exhaustive Records + credential/api-key unions in ONE atomic batch, THEN delete the whole-files, THEN `tsc --noEmit` to catch any missed key. `whatsapp_business` sits in the same union/records — KEEP it everywhere.
- **WHOLE FILES TO DELETE: 12** — connect routes (telegram, truth_social), integration services (reddit-service, telegram-service), marketing specialist dirs (reddit/, telegram/), 3 composers + 3 post-previews (Reddit/Telegram/TruthSocial). (No reddit connect route / no truth_social service+specialist exist.)
- **SHARED FILES TO PRUNE: 28** — `types/social.ts` (union + credential interfaces), `types/api-keys.ts`, both OAuth routes (`case 'reddit'` only — telegram/truth_social aren't OAuth), `social-oauth-service.ts`, `autonomous-posting-agent.ts`, `media-service.ts`, composer/preview `index.ts` registries + `PlatformComposer`/`PlatformDashboard`/`_platform-state`/`ScheduledPostsQueue` maps, `social/page.tsx`, `SocialPlatformIntegration.tsx`, `agent-registry.ts`, `jasper-tools.ts` (unions/enums/cases), `workforce-templates.ts`, `connected-platforms-context.ts`, `feature-manifest.ts`, etc. (full line-refs in the June-4 agent transcript).
- **LEAVE INTACT** (not platform branches): reddit.com regex in `competitor/specialist.ts`, "Reddit" in an SEO advice string, Truth Social comment in `mastodon-service.ts`.
- Plus 8 `scripts/*` (save/seed/verify for the 3 platforms) — out of `src`, delete alongside.

## CRM UNIFICATION + MONSTER FILES (planned pre-conversion changes — June 4 sweep)
- **CRM is adaptive in TWO disconnected halves:** free-form `customFields` on every record (untyped) + a real no-code schema/object builder (`/schemas`→`/entities`) that does NOT drive the typed Lead/Contact/Deal path (editing "Leads" in the builder changes nothing; picklists even disagree — `Unqualified` vs `lost`). Pipeline stages + lead statuses are HARDCODED enums in 3-4 places — not user-configurable. Merge re-parents children for CONTACTS only (lead/company/deal merges orphan children). Import is leads-only; no general export. **"Adaptive CRM" v1 = unify the two halves + make pipeline/stages configurable.** Define FINITE (custom fields + configurable stages + a few industry templates) — do NOT chase infinite flexibility.
- **Monster files (FREEZE — no new features until split):** `jasper-tools.ts` 7,639 · `settings/ai-agents/training/page.tsx` 3,237 (371 inline styles) · `onboarding/page.tsx` 2,674 · `settings/email-templates/page.tsx` 2,578 · `configuration/page.tsx` 1,432 (178) · `mission-control/review/page.tsx` 1,413 (182) · `mission-control/page.tsx` 1,233 (64) · voice-lab components 1,200–1,800. Split worst 2-3 during finish pass; NOT a conversion blocker.

---

# 🔧 PREVIOUS SESSION — Server-SDK "wrong door" remediation (June 2–3, 2026) — COMPLETE

## The finding
Systemic bug: server-side code (API routes, crons, webhooks, and the lib services they call) used the **client** Firebase SDK instead of the **Admin** SDK. On the server there is no signed-in user, so Firestore security rules silently reject the calls — reads return []/null, writes denied, errors swallowed. Confirmed real (firestore.rules requires `isAuthenticated()` on essentially everything; default-deny at the bottom).

**Why it went unnoticed (it is NOT "never worked"):** (a) a half-finished Apr 30 migration — the bug was found during the YC crunch and the fix (`useAdminSdk` flag / Admin conversion) was applied to only a couple of spots (Zoom, public early-access leads) then dropped (commits `3e2252b0`, `c0a3d851`); plus (b) features built as scaffolding and never test-driven (Quotes/Invoices/Payments, built `196cd1d5` Apr 9). Also: dashboard screens often write to Firestore DIRECTLY from the browser (authenticated → works), which is why everyday CRM create/edit was fine while the duplicate server routes were broken.

## The fix pattern (use for all remaining items)
- Confirm the file is **server-only** (no `'use client'` importer) before converting — Admin SDK cannot be in a browser bundle.
- `FirestoreService.X` → `AdminFirestoreService.X` (same signatures). Search on `await FirestoreService.` to avoid double-prefixing files that already import AdminFirestoreService.
- Keep `where`/`orderBy`/`limit` from `firebase/firestore` — constraint builders; AdminFirestoreService.getAll/getAllPaginated parse them.
- Pagination cursor type: `QueryDocumentSnapshot` from `firebase-admin/firestore`.
- Writes needing serverTimestamp/increment/Timestamp: `FieldValue`/`Timestamp` from `firebase-admin/firestore`.
- AdminFirestoreService.get/getAll default to `FirestoreDocument` — add a generic (`get<Product>(...)`) where the result is assigned to a typed object, and drop now-redundant `as X` casts.
- Verify EACH: `npx tsc --noEmit` + `npx eslint <files>` + commit (quality-gate hook runs tsc/eslint). Run tsc to completion BEFORE committing (concurrent tsc with the commit hook can OOM-crash the hook — just retry the commit).

## DONE this session (committed + pushed to dev)
`2be79c2b` Google OAuth granted-scope persist · `2eba3cb6` social disconnect two-step · `2998bfd0` forms conditional show/hide · `df5f5bf2` TCPA STOP + meeting reminders · `657aefee` OAuth + Gmail services (+ fixed OAuth callback malformed `organizations/*/oauthStates` read path) · `367061d6` quote/invoice/payment services · `8c965ce0` forms builder get/update/publish · `c9355921` leads createLead useAdminSdk (manual + public-form + import) · `c4d1e4bf` deal + contact services (fixes delete deals/contacts + getDeal) · `c1c1208a` enrichment + cache services · `c61a4459` voice TTS config read/save · `4340a4ce` commerce specialists + manager.

## ✅ STILL BROKEN-AND-USED — ALL DONE (June 3–4)
All six remaining items completed, verified (tsc+lint), committed, pushed:
1. notification-service.ts — `c81d586e` (switched to admin Timestamp + Admin SDK; the feared cascade did NOT happen — admin/client Timestamp are structurally compatible).
2. integration-manager view/update/sync/test/list — `3c96e328` (added `useAdminSdk` to the 4 functions lacking it + passed it from all server callers; only Zoom worked before).
3. promotion-service.ts — `dcc72e0a`.
4. golden-master-updater.ts (legacy training apply/deploy) — `dcc72e0a`.
5. lead-service getLead/updateLead + lead-routing.ts engine — `4d5c54b8` (the settings/lead-routing page imports TYPES only → safe to convert the engine).
6. deal-service signal emit → getServerSignalCoordinator — `5daba17d` (best-effort path).

**The client-SDK-on-server "wrong door" remediation for every broken-AND-used surface is COMPLETE.** Remaining = TIER 3 (below) + the multi-tenant flip (Step 2).

## TIER 3 — automation engines (IN PROGRESS, default OFF)
**DONE:**
- `e160ab7a` master kill-switch `areAutomationsEnabled()` (`src/lib/automation/automation-gate.ts`, env `AUTOMATIONS_ENABLED`, default false) gating the 3 crons (workflow-scheduler, workflow-entity-poll, process-sequences) — each no-ops with reason 'automations_disabled'.
- `9811f75d` execution path of both engines → Admin SDK: workflow-engine, schedule/firestore triggers, entity/slack/ai-agent actions, outbound/sequence-engine. Verified tsc + lint + full `npm run build` (no client-bundle leak).

**REMAINING:**
- **workflow-service.ts + workflow-executions-service.ts client/server split** — imported by the BROWSER builder/list pages (work there) AND server CRUD API routes (broken there). Cannot wholesale-convert (breaks the client bundle). Split into a client-safe read module + a server-only Admin module, or have the CRUD routes use Admin directly.
- **PLURAL Zod schemas** — `/api/workflows` POST/PUT validate with the SINGULAR engine's Zod schema and reject builder-shaped workflows. Add PLURAL schemas (mirror `@/types/workflow`, `.passthrough()`, `actions.min(0)`). Builder bypasses the API (writes Firestore directly) so this only affects programmatic API callers.
- **"Preview what's queued"** — read-only dry-run listing scheduled/triggered workflows + ready sequence steps, to review BEFORE flipping the switch on.
- SINGULAR `WorkflowCoordinator.handleSignal` is DEAD CODE (no caller) — safe to delete later; lead/deal SCORING stays (owner confirmed).

**To turn automations ON:** set env `AUTOMATIONS_ENABLED=true` (after previewing what's queued).

## DEAD / "doesn't matter" — DO NOT DELETE without proving unused + owner OK
No live caller: battlecard competitive-monitor, playbook-engine, schema-change-* handlers (`/api/schema-changes` UI unmounted), `/api/learning/ab-test`+`/fine-tune`, HTML `/api/email-templates` route, `/api/notifications/send` route, and dead files (analytics-service, workflow-analytics, ecommerce-analytics, schema-manager, advanced-rag, vertex-tuner, knowledge-analyzer, knowledge-processor-enhanced). gemini-service's client-SDK key read is dead on the server (keys resolve via Admin-first api-key-service — that is WHY AI works).

## Standing context
This remediation is **Step 1** of the May 21 roadmap (fix what's broken) and doubles as prep for **Step 2** (multi-tenant flip — server routes need Admin SDK + a runtime tenantId threaded through getSubCollection). The 3 hard multi-tenant gates remain: tenantId threading, tenant-isolated Firestore rules, tenant provisioning. Communicate in PLAIN ENGLISH — owner has repeatedly asked for no jargon.

---

> **PAUSED:** May 10, 2026 late evening — mid-Google-Ads-walkthrough.
> Operator created the Google Ads account in **Expert Mode** (clicked Skip
> → "Leave campaign creation" — account shell exists, no campaigns yet).
> Blocked on **billing verification**: the credit card on file is the
> operator's wife's card and her Google account holds the verification
> PIN. She is asleep. Tomorrow's resume: get the PIN → verify billing →
> capture customer ID via Copy button (NEVER read from screenshot per
> the credentials rule) → apply for basic developer token at
> https://ads.google.com/aw/apicenter → reconnect Google in SalesVelocity
> Settings so the `adwords` scope is granted → paste customer ID + token
> into Settings → Integrations → Marketing Ads → Google Ads card → run
> `scripts/check-google-ads-status.ts` to confirm `configured=true`.
>
> Current `getGoogleAdsStatus()`: googleAccountConnected=true (dstamper@salesvelocity.ai),
> hasAdwordsScope=false, developerToken=false, customerId=null.
>
> **Updated:** May 10, 2026 — BUDGET_STRATEGIST end-to-end build (UTM capture + CRM aggregation + persistence + widget + Google Ads + Meta Ads + two-step Apply + hourly cron). Operator session resumes after dinner to wire Google Ads / Meta Ads / GA4 creds.
> **Earlier session updated:** May 8, 2026 — full training-loop fix sweep + canonicalization + BUDGET_STRATEGIST shipped (see top section).
> **Earlier session updated:** May 7, 2026 — Sentry production wiring + memory-vault crash fix + StepGradeWidget rebuild + GM seeding audit.
> **Earlier session updated:** May 3, 2026 — social posting bug fix + Social Hub duplicate-tab fix shipped.
> **Earlier session updated:** April 30, 2026 (afternoon — YC pre-submission walkthrough, preserved below).
> **Earlier session updated:** April 29, 2026 (evening, fake-AI sweep — preserved below for context).

---

# 🗺️ PENTHOUSE COMPLETION → MULTI-TENANT FLIP ROADMAP
*(consolidated May 21, 2026 — replaces the May 19 Sprint #1-#7 structure after operator pushback on quality bar: "you have been creating and passing stuff that is super basic rather than creating actual quality stuff that competes in the market". New plan: three parallel workstreams. Old Sprint structure preserved below this section as historical context.)*

**Goal:** finish single-tenant ("penthouse") mode end-to-end at a quality level that competes with Klaviyo, HubSpot, and Buffer in their respective lanes, every feature walked operator-in-loop, BEFORE flipping the codebase to multi-tenant.

**Quality bar — applied to every "done" decision:**
- Code-shipped is NOT done. Real data flowing through it is done.
- Smoke-tested is NOT done. Operator-walked end-to-end is done.
- One starter template per category is NOT done. Competitive parity (50+ tested templates) is done.
- A working feature with no AI leverage when Brand DNA is sitting right there is a placeholder, not "done".

---

## Workstream A — Connect every platform end to end

For each platform: WE create the business account under the SalesVelocity brand. WE apply for the developer app with the right scopes. WE build the OAuth flow into Settings → Integrations so clients click ONE button to connect (central-developer-app architecture, April 28). WE test posting from our own brand to confirm it works. WE train that platform's specialist with platform-specific algorithm knowledge.

- **A.1 Pinterest** — fastest external clock (1-3 days). Apply for developer access, build OAuth, verify a real post lands.
- **A.2 Meta (Facebook + Instagram + Threads)** — one app unlocks three. Blocked since April 28 on Meta dev-portal device-trust. Needs another attempt with a fresh approach (fresh browser profile + VPN if needed).
- **A.3 LinkedIn** — Marketing Developer Program approval. Days to weeks. Posting only — DM is enterprise-tier, permanent gap.
- **A.4 YouTube** — Google OAuth app verification. Weeks of review.
- **A.5 Google Business Profile** — claim + postcard verification (5-14 days mail).
- **A.6 TikTok** — form in-flight; blocked on icon + demo video + product/scope fields.
- **A.7 X (Twitter)** — posting verified. DMs permanently off the table (no consumer DM API at our tier).
- **A.8 Bluesky** — connected. Needs one fresh outbound verify under current Jasper version.
- **A.9 Mastodon** — connected. Vision DM with attached image is the last unverified path.
- **A.10 Discord** — in scope per April 28. Bot/dev registration + OAuth scaffolding to build from scratch.
- **A.11 Twitch** — in scope per April 28. Same shape as Discord.
- **A.12 Delete Reddit + Telegram code** — authorized April 27. ~12 files. Quick cleanup, no external dependency.

Every connect button walks the OAuth flow WITHOUT leaving our app — same shape as Buffer/Hootsuite. Central-developer-app architecture: WE own one developer app per platform; every future tenant OAuths into that same central app. App metadata tenant-agnostic from day one.

---

## Workstream B — Lift quality from "starter" to "competitive"

Every item below is currently below the competitive bar. Target = the named incumbent.

- **B.1 Email Builder upgrade.** Phase 1 shipped (8 templates, basic block editor). Build Phases 2-5: per-block color/font/padding/alignment controls, drag-and-drop block reordering with handles, mobile preview toggle, image upload to Firebase Storage, HTML export, reusable block library, merge-tag picker UI. Target: Klaviyo / Mailchimp.
- **B.2 Email Template Library to 50+.** Build out welcome (5), abandoned-cart (5), win-back (5), newsletter (5), promotional (8), transactional (5), re-engagement (5), event (3), sales (5), nurture sequences (4 multi-step). Every template hand-tuned with proven copy patterns. Target: Klaviyo's library.
- **B.3 Social Composer upgrade.** Currently text + one image. Build: carousels (Instagram, LinkedIn), short-form video composer with auto-captions, AI thumbnail generation, threaded posts (X, Threads, Bluesky), Stories format (IG/FB), Reels format. Per-platform scheduling intelligence based on real audience engagement. Target: Buffer + Later.
- **B.4 CRM AI layer.** AI lead enrichment from public data (wire the existing Scraper Specialist), deal scoring with plain-English reasoning, predictive churn modeling, multi-touch attribution beyond Budget Strategist's first-touch. Target: HubSpot Sales Hub.
- **B.5 Forms upgrade.** Conditional logic ("if Enterprise, show extra fields"), multi-step flows with progress bars, embeddable widget script. Target: Typeform / Tally.
- **B.6 Voice AI end-to-end walkthrough.** Built but never tested. Outbound TCPA-gated dial → real conversation → transcript → CRM logging → follow-up trigger. Gated on Twilio toll-free approval. Target: Air AI / Synthflow.
- **B.7 Workflows polish.** Engine exists. Template gallery + visual editor are basic. Real if-this-then-that builder for non-technical users. Target: Zapier visual builder.
- **B.8 Storefront end-to-end walkthrough.** Exists, never walked. Almost certainly has surface bugs. Target: Shopify Lite.
- **B.9 Website Builder.** Limited templates, no AI assistance. Add AI-assisted layout suggestions, conversion optimization hints, 20+ proven landing-page templates. Target: Webflow / Framer.
- **B.10 Onboarding Wizard walk + repair.** 24 steps. Not fully walked since YC (April 30). Foundation for multi-tenant flip. Target: Stripe onboarding.
- **B.11 Settings audit.** 29 pages. Never audited as a group. Pass through every page, capture bugs, normalize design-system compliance.
- **B.12 Dashboard upgrade.** Functional widgets but visually plain. Tell a story (anomalies, opportunities, threats), not just numbers. Drillable cards + insight surfacing. Target: Mixpanel home + HubSpot dashboard.

---

## Workstream C — Cutting-edge differentiators

Do NOT start C items until B is at parity with the named incumbents.

- **C.1 AI template generation from Brand DNA.** Brand DNA + Email Builder = user lands in their account with 30 emails already written in their voice. Differentiator vs Klaviyo's static library.
- **C.2 Predictive lead scoring with reasoning.** Transparent scoring: "scored 87 because they visited pricing twice this week and opened both of your last emails." Differentiator vs HubSpot's opaque score.
- **C.3 Engagement-based send time optimization.** Per-contact send-time optimization based on personal engagement peaks, not "Tuesday 10am". Differentiator vs Mailchimp segment-level timing.
- **C.4 Cross-channel A/B testing.** Same campaign across email + SMS + social; system reports which channel won which segment with statistical confidence. Differentiator — most tools test within a single channel.
- **C.5 Customer journey visualization.** Funnel map showing where leads drop off. Budget Strategist's source aggregation is the seed; expand to full funnel.
- **C.6 Real-time competitor intelligence feed.** Wire the existing Competitor Researcher agent to a recurring job surfacing competitor moves (launches, pricing, ads) in a daily feed. Differentiator — no incumbent does this in-product.
- **C.7 AI landing page builder with CRO suggestions.** Brand DNA + offer + AI that suggests CRO improvements ("your headline is hiding your value prop, try this"). Differentiator vs static page builders.
- **C.8 Automated UTM hygiene + paid-attribution loop.** Auto-generate tracked links for outbound (email, SMS, social) so every click is attributable end-to-end without manual UTM tagging.
- **C.9 In-product onboarding tour.** New client lands in dashboard, walks through first AI mission with live tooltips. Embedded in product. Differentiator vs separate help docs.

---

## Sequencing

Three workstreams run in PARALLEL. They use different muscles.

1. **Today:** start every external clock in Workstream A — Pinterest, LinkedIn MDP, YouTube OAuth, Google Business Profile postcard, TikTok form completion, Meta dev-portal retry. Five+ parallel clocks running by EOD.
2. **This week + next:** Workstream B foundational items in parallel via subagents (per orchestration mode below). Owner reviews each delivery before next subagent fires. Priority order: B.1 (Email Builder Phase 2-3), B.2 (template library to 50+), B.3 (social composer carousels + video), B.10 (onboarding wizard walk + repair), B.11 (settings audit).
3. **Following:** Workstream C — start with C.1 (AI template generation from Brand DNA — fastest payoff, leverages existing Brand DNA).
4. **Then and only then:** Sprint #7 multi-tenant flip (preserved unchanged below).

---

## In-flight items parked waiting on external

These are current threads paused on third-party clocks. No work needed until external state changes.

- **SendGrid Link Branding cert** for url145.salesvelocity.ai. Support ticket submitted May 21. Waiting on SendGrid to manually trigger LE cert provisioning. Unblocks CAN-SPAM walkthrough.
- **Twilio toll-free verification.** Resubmitted; under review. Unblocks TCPA voice gate, SMS opt-in walkthrough, inbound SMS webhook, first SMS round-trip, Voice AI walkthrough (B.6).
- **Meta developer-portal device-trust.** Paused April 28. Unblocks A.2.
- **Google Ads billing PIN.** Paused May 10. Unblocks the live Budget Strategist walkthrough.

---

## Deferred items (resurface after multi-tenant flip)

- Stripe 14-day trial wire (needs real customer signup post-flip).
- Authorize.Net + 2Checkout verifiers (needs real customer payments).
- Mollie/PayPal/Square/Adyen amount/currency live verification (same).
- Budget Strategist live walkthrough with real Google Ads + Meta Ads spend data (gated on the Google Ads PIN unblock above).

---

## Known bug backlog (surface during walkthrough or fix when adjacent)

- Bug F — missing `INDUSTRY_RESEARCHER`
- Bug H — zombie work after mission cancel/halt
- Bug L — Content Manager unreachable specialists (BLOG_WRITER, PODCAST_SPECIALIST, MUSIC_PLANNER)
- `scan_leads` Apollo filter dropout
- Two missing composite Firestore indexes — deploy `firestore.indexes.json`
- `/social/linkedin` useContext 500
- `AGENT_REGISTRY.json` stale → regenerate from source
- Static-only mode for canonicalization audit → CI wire as build-blocker
- Cosmetic rename `delegateWithReview` → `delegate` across 9 manager subclasses
- Sentry `instrumentation-client.ts` rename (required for Next 15)
- 10 untracked files at repo root (build/dev/health/zombie logs, 3 HTML files, 2 scripts)
- Old `/templates` and `/nurture` orphan routes — either delete page files or wire redirects after Email Builder merges land.

---

## 🤖 Orchestration mode (May 21 standing instruction)

Owner instruction May 21: "use your sub agents to do the brunt of the work but we have had issues with some of their work in the past so you are to review the work of your sub agents." Claude orchestrates; subagents do the bulk; Claude reviews every output BEFORE declaring anything done.

**Pattern:**
- Fan out parallel subagents for any task with ≥3 file-level units sharing a pattern (e.g., 5 OAuth flows, 15 email templates, 29 settings pages).
- Each subagent gets a self-contained brief that includes the named competitive target ("must reach parity with Klaviyo template library", not just "build 5 templates").
- Every subagent output reviewed BEFORE the task is marked done.
- Reviewer specifically checks:
  - Feature parity vs the named incumbent
  - Code quality: no `any` types, no `eslint-disable`, no `@ts-ignore`, no `as unknown as` shortcuts
  - Design-system compliance (typography components, color tokens, responsive grids — per CLAUDE.md)
  - Standing Rule #1 held (Brand DNA baked into any LLM agent's GM at seed time)
  - Standing Rule #2 held (no autonomous GM edits)
- "It compiles" is NOT done. "It would compete with the named incumbent" is done.
- Owner reviews each delivery before the next subagent fires on the same surface.

---

# 🛠️ SESSION — BUDGET_STRATEGIST end-to-end build (May 10, 2026 evening)

## What this session was
PC crash recovery: started by reviewing the May 8 state, then operator
committed to "build the full BUDGET_STRATEGIST agent — not just the UI".
Everything from the data plumbing in through the apply path out was built
in one push. Operator session pauses for dinner; resumes after to walk
through Google Ads / Meta Ads / GA4 credential setup against the
already-built scaffolding.

**4 commits landed on `dev`, all behaviorally verified against live
Firestore. Builds clean. Apply pipeline 9/9 pass. LLM smoke test 35/35
pass. Snapshot persistence 4/4 pass. Conversion aggregator 9/9 normalizer
checks + valid response shape against real Firestore.**

## Commits this session

1. `63804292` — feat(budget): first live verification + UTM capture + CRM aggregation
2. `537eadd9` — feat(budget): persistence + dashboard widget
3. `2c52bbda` — feat(google-ads): integration scaffolding for BUDGET_STRATEGIST
4. `80f982a9` — feat(budget): Meta Ads + Apply pipeline + hourly cron

## What got built (chronological)

**1. Agent — first live LLM call verified.** The May 8 agent had never been
run live. Smoke test (`scripts/verify-budget-strategist-live.ts`) caught
two real schema bugs on the very first call:
- rationale cap of 800 chars rejected the LLM's natural verbosity → raised
  to 1200, added "keep rationale under 1000 chars" prompt hint.
- `manualMissionPrompt: z.string().min(1).max(800).optional()` rejected
  empty strings (which LLMs send instead of omitting). Fixed via Zod
  preprocess that coerces `''` → undefined. Added "OMIT the field entirely"
  to the prompt rules.
- Second run: 35/35 assertions pass, ~$0.04 per call on claude-sonnet-4.6.
- Real output quality: Meta self-reported 19 conversions vs CRM-attributed
  4 → strategist recommended cutting Meta by $800 with "trust the CRM"
  language. Brand DNA voice intact.

**2. UTM capture on every public lead-capture surface.** Operator goal:
real ad-platform conversions need to flow into CRM as source-attributed
leads so BUDGET_STRATEGIST can read them.
- `src/lib/utm-tracking.ts` (NEW) — captures utm_source/medium/campaign/
  term/content from URL, persists across navigation via sessionStorage
  (30-day TTL), surfaces via `buildUtmMetadata()` for form submits.
- `PublicLayout.tsx` calls `persistUtmsIfPresent()` on mount so UTMs survive
  cross-page nav before the eventual lead form.
- `/api/public/early-access` route + page wired to read/persist UTMs.
  Derives `lead.source = "<utm_source>/<utm_medium>"` lowercase.
- `/api/public/contact` route REWRITTEN — previously persisted
  `contactSubmissions` only, no Lead created. Now creates a Lead with the
  same UTM normalization + source field + submission backlink. The dynamic
  `/api/public/forms/[formId]` already did this, so all three surfaces now
  match.

**3. CRM-attributed conversion aggregation.**
- `src/lib/marketing/budget-conversion-aggregator.ts` (NEW) — queries
  `getSubCollection('leads')` filtered by `createdAt` window, normalizes
  source strings to platform keys ("google_ads/cpc" → "google_ads",
  "form" → "direct"), returns per-platform counts. Uses Admin SDK.
- `GET /api/marketing/budget/conversions?windowDays=30` exposes the
  aggregation gated by requireRole(['owner','admin']).
- `scripts/verify-budget-conversion-aggregator.ts` — 9/9 normalizer unit
  checks + live Firestore query (returned 4 leads, all `direct`, because
  UTM capture only shipped today and no UTM-tagged traffic has flowed
  through yet — by-design).
- Budget page "Pull from CRM" button calls /conversions and populates
  matching platform rows' conversion counts automatically. Unmatched CRM
  platforms surface as a callout so operator can add rows.

**4. Snapshot persistence + dashboard widget.**
- New `marketingBudgetSnapshots` collection in `COLLECTIONS` registry +
  `getMarketingBudgetSnapshotsCollection()` getter.
- `src/lib/marketing/budget-snapshot-service.ts` (NEW) — persist,
  getLatest (orderBy createdAt desc + limit 1), listSnapshots.
- Analyze endpoint now persists on success and returns `snapshotId`. Wrapped
  in try/catch so a Firestore hiccup never loses the LLM output the operator
  already paid for.
- `GET /api/marketing/budget/latest` for the dashboard widget.
- `src/components/marketing/MarketingBudgetWidget.tsx` (NEW) — renders
  top 2 highest-impact recommendations with action icons + delta amounts,
  click-through to /marketing/budget, empty state with "Start analysis" CTA,
  insufficient-data warning when conversion volume is low.
- Mounted in dashboard Row 2 alongside Conversations + AI Workforce
  (md:grid-cols-2 → md:grid-cols-2 lg:grid-cols-3).
- `scripts/verify-budget-snapshot-service.ts` — 4/4 round-trip pass against
  live Firestore (persist → getLatest → list → cleanup).

**5. Google Ads integration scaffolding.** Key win: `GOOGLE_FULL_SCOPE_BUNDLE`
already grants the `https://www.googleapis.com/auth/adwords` scope. So
Google Ads doesn't need its own OAuth — just developer token + customer ID
on top of the existing central Google connection.
- `src/lib/integrations/google-ads-service.ts` — GAQL query for spend +
  budgets + conversions over a date range. `updateCampaignBudget` mutates
  the SHARED campaign budget (Google Ads budgets are shared resources
  potentially powering multiple campaigns). Auto-refreshes OAuth tokens.
- `getGoogleAdsConfig` / `saveGoogleAdsConfig` for the developer token +
  customer ID + optional MCC `loginCustomerId`.
- `getGoogleAdsStatus()` returns a composed status snapshot
  (googleAccountConnected, hasAdwordsScope, developerToken,
  customerId, plain-English diagnostic for the UI).
- Routes: `/status`, `/save-config`.
- `GoogleAdsConfigCard` mounted in `/settings/integrations` as a new
  "Marketing Ads" category (per integrate-into-existing-hubs rule).

**6. Meta Ads integration scaffolding.** Separate OAuth (ads_management is
App-Review-gated; can't share with organic FB/IG path).
- `src/lib/integrations/meta-ads-service.ts` — Marketing API client on
  raw fetch. fetchAdSetSpend joins /insights (spend + actions) with /adsets
  (current daily_budget). updateAdSetBudget POSTs daily_budget mutation in
  cents (Meta minor units).
- Full OAuth flow: `/auth` (Facebook OAuth dialog with
  ads_management,ads_read,business_management scope) → `/callback`
  (validate state → short-lived → long-lived ~60d → /me userId → list
  ad accounts → save first one as default).
- `/status`, `/ad-accounts`, `/save-ad-account` routes.
- Tokens encrypted at rest via existing `encryptToken` helper.
- `MetaAdsConfigCard` with Connect button + ad-account picker.

**7. Apply pipeline.**
- `src/lib/marketing/budget-apply-service.ts` — translates a per-platform
  recommendation into per-campaign / per-adset budget changes via
  PROPORTIONAL DISTRIBUTION (preserves the operator's existing campaign
  mix while scaling the total).
- `windowSpendToDailyBudget(spendUsd, windowDays)` converts the
  recommendation's per-window total to a daily-budget number for the API.
- Outcomes: `auto_applied`, `manual_mission_required`, `not_configured`,
  `no_active_campaigns`, `partial_failure`, `failed`. Each with a
  plain-English summary the UI surfaces.
- `POST /api/marketing/budget/apply` with `confirmed: true` literal in
  Zod schema as a server-side guard against bypass of the two-step UI.
  Accepts optional `overrideSpendUsd` for operator-edited amounts.

**8. Two-step Apply button in the budget page.**
- Replaces the prior "auto-apply not wired yet" placeholder.
- First click arms (Cancel + red "Click again to apply" button). 5-second
  auto-disarm. Second click fires.
- Per-leaf budget changes ("Campaign X: $50 → $75/day") rendered on success.
- Falls back to mission-prompt copy when `outcome=manual_mission_required`
  (e.g., for `not_configured` platforms).

**9. Hourly cron refresh.**
- `/api/cron/budget-strategist-refresh` — pulls fresh CRM source
  attribution + (if connected) live spend from Google Ads / Meta Ads,
  uses the LATEST operator-created snapshot as the input template, runs
  analyze, persists with `createdBy='cron'`.
- Graceful early-exit when no operator snapshot exists ("nothing to
  refresh against").
- Schedule: `0 * * * *` in vercel.json. Gated by CRON_SECRET via
  `verifyCronAuth`.

**10. End-to-end verification.**
- `scripts/verify-budget-apply-service.ts` — 9/9 pass: manual platform
  returns mission prompt, unconfigured Google Ads + Meta Ads both
  fall through cleanly with operator-actionable error messages,
  proportional distribution math correct, zero-window edge case handled.
- Real spend → real budget shift is deferred — pipeline is correct
  ahead of credentials.

## Operator action required after dinner

Walk through these with operator step-by-step (per the full-walkthrough
rule):

1. **Google Ads developer token.** Visit https://ads.google.com/aw/apicenter,
   apply for basic access (1-5 business days). Once approved, paste the
   token into Settings → Integrations → Marketing Ads → Google Ads card,
   along with the 10-digit customer ID (top-right of ads.google.com).
2. **Google Ads scope check.** Settings → Integrations → Google Services
   card. If "Reconnect Google" appears, do it — adds the adwords scope
   if missing from prior consent.
3. **Meta Business Verification.** Was paused April 28 on the device-trust
   block per memory. If unblocked, complete verification then submit the
   Meta App for ads_management permission via App Review (days-to-weeks
   queue).
4. **Meta App Review.** Submit the app with a clear ads_management
   use-case. Once approved, click Connect Meta Ads in settings → walks
   the OAuth flow.
5. **First live test.** Once one or both connect, click "Pull from CRM",
   then Analyze on /marketing/budget. Click Apply on a small recommendation
   to confirm the two-step + budget-mutation API path works end-to-end.
   Watch for RATE_EXCEEDED on Google Ads (quota recovers per second).
6. **GA4 (optional, smaller win).** Conversion fallback when CRM source
   isn't populated yet. Add GA4 property ID in a future settings card —
   service stub not yet built (this session ran long enough).

## Shortcuts named per standing rule

- **Operator-edited amounts vs Apply path:** the page lets the operator
  edit recommended amounts. The apply route now respects edits via
  `overrideSpendUsd`. NOT yet verified live with a real platform call.
- **Proportional distribution assumes steady pacing.** A lifetime-budget
  campaign (e.g., promotional bursts) won't behave correctly under the
  "daily budget = windowSpend / windowDays" math. Documented in
  `windowSpendToDailyBudget`. Most campaigns are steady-paced; flag this
  if the operator runs lifetime-budget campaigns regularly.
- **Apply auto-picks the first ad account** on Meta multi-account
  operators. Operator can change via the Change ad account button in
  settings; not surfaced in the OAuth callback itself.
- **Google Ads scope might require reconsent.** The adwords scope is in
  `GOOGLE_FULL_SCOPE_BUNDLE` today, but earlier OAuth flows (before that
  scope was added) won't have it. `getGoogleAdsStatus` correctly flags
  `hasAdwordsScope: false` in that case; operator clicks Reconnect.
- **No live cron test yet.** Cron route compiles and types match; haven't
  exercised it against a real Vercel cron firing. First production run
  hits Sunday 00:00 UTC.
- **GA4 service not built this session.** Same OAuth covers it; scaffolding
  similar to Google Ads (config card for property ID + service for
  /v1beta:runReport) deferred. Won't block first auto-apply tests.

## Files touched this session

New:
- `src/lib/utm-tracking.ts`
- `src/lib/marketing/budget-conversion-aggregator.ts`
- `src/lib/marketing/budget-snapshot-service.ts`
- `src/lib/marketing/budget-apply-service.ts`
- `src/lib/integrations/google-ads-service.ts`
- `src/lib/integrations/meta-ads-service.ts`
- `src/components/integrations/GoogleAdsConfigCard.tsx`
- `src/components/integrations/MetaAdsConfigCard.tsx`
- `src/components/marketing/MarketingBudgetWidget.tsx`
- `src/app/api/marketing/budget/analyze/route.ts` (also: latest, conversions, apply)
- `src/app/api/integrations/google-ads/{status,save-config}/route.ts`
- `src/app/api/integrations/meta-ads/{auth,callback,status,ad-accounts,save-ad-account}/route.ts`
- `src/app/api/cron/budget-strategist-refresh/route.ts`
- `src/app/(dashboard)/marketing/budget/page.tsx`
- 4 verify scripts under `scripts/verify-budget-*.ts`
- `scripts/inspect-ad-api-creds.ts`

Modified:
- `src/lib/agents/marketing/budget/specialist.ts` (schema fix)
- `src/lib/firebase/collections.ts` (new collection + getter)
- `src/components/PublicLayout.tsx` (UTM persistence on mount)
- `src/app/api/public/{early-access,contact}/route.ts` (UTM capture + lead creation)
- `src/app/(public)/{early-access,contact}/page.tsx` (UTM in POST body)
- `src/app/(dashboard)/dashboard/page.tsx` (widget mount + sidebar link)
- `src/app/(dashboard)/settings/integrations/page.tsx` (Marketing Ads category)
- `src/lib/agents/agent-registry.ts` (auto-regenerated for BUDGET_STRATEGIST)
- `vercel.json` (cron entry)
- `CONTINUATION_PROMPT.md` (this update)

---

# 🛠️ SESSION — Training-loop fix sweep + canonicalization + BUDGET_STRATEGIST (May 8, 2026)

## What this session was
Picked up the May 7 handoff with one concrete fix queued: wire the `SPECIALIST_ID_ALIASES` resolver into the GM lookup so the BYOK X_EXPERT grade would stop silently 422-ing. That single fix expanded into a full sweep of the training-loop pipeline as live testing surfaced bugs the May 7 widget rebuild had only half-shipped, then expanded again into a deliberate ID-canonicalization pass after the operator pushed for a systemic fix instead of a band-aid map. Closed the day building BUDGET_STRATEGIST as a production-ready new specialist (with explicit honest scope on what's NOT yet built — dashboard widget, cron, integration APIs).

**8 commits shipped, all on `dev` and synced to `rapid-dev`.**

## What got fixed (chronological, every fix verified live)

**1. Alias resolver — `SPECIALIST_ID_ALIASES` map wired into specialist-golden-master-service.ts** (commit `b7a8cc72`)
- Yesterday's bug: Mission Control grade with `X_EXPERT` (admin/runtime name) silently 422'd because the seed/Firestore name was `TWITTER_X_EXPERT`. Operator believed the grade landed; it had been marked `discarded`. Standing Rule #2 trust violation.
- Fix: `resolveSpecialistIdAlias()` helper applied at every public read/write entry in the GM service (`getActiveSpecialistGM`, `getActiveSpecialistGMByIndustry`, `listIndustryGMVersions`, `listSpecialistGMVersions`, `createIndustryGMVersionFromEdit`, `deployIndustryGMVersion`, `deploySpecialistGM`, `rollbackSpecialistGM`, `createSpecialistGMVersion`, `getOrCreateSpecialistGM`, `invalidateIndustryGMCache`). Cache key uses canonical ID so both names share one cache entry.
- Initial alias map (5 admin-side names → seed-side canonical): X_EXPERT→TWITTER_X_EXPERT, WEB_SCRAPER→SCRAPER_SPECIALIST, ARCHITECT_(COPY|FUNNEL|UX_UI)_STRATEGIST→(COPY|FUNNEL|UX_UI)_STRATEGIST.
- Verify script `scripts/verify-specialist-id-alias-resolver.ts`: 5/5 pass against live Firestore. Live test at 16:20 UTC: `tfb_x_expert_1778257205106` created + Prompt Engineer initialized in 200/30s — exact scenario that 422'd yesterday.

**2. Manager grading backend wire — `_MANAGER` suffix branching** (commit `dda06023`)
- Surfaced live: yesterday's StepGradeWidget rebuild added managers as the FIRST option in the picker, but the backend `/api/training/grade-specialist` route only knew how to look up specialists in `specialistGoldenMasters` — manager grades silently 422'd with "No active Golden Master found for MARKETING_MANAGER:saas_sales_ops" even though `MARKETING_MANAGER` IS seeded (in the parallel `managerGoldenMasters` collection).
- Pattern named: **frontend feature shipped without backend support**. Worth grepping for in future sessions.
- Fix: `submitGrade` and `approvePromptEdit` in `grade-submission-service.ts` branch on `_MANAGER` suffix and route to manager-side functions. Added to `manager-golden-master-service.ts`: `isManagerId()`, `createManagerGMVersionFromEdit()`, `listManagerGMVersions()`, signature-aligned `deployManagerGMVersion()` (now takes version + returns `{success, error?}`). Rollback + version-history routes also branch.
- Verified live at 14:50 UTC: MARKETING_MANAGER grade ran through Prompt Engineer end-to-end (200 in 22s).

**3. Clarification-questions banner shape fix** (commit `bae907d0`)
- Backend returned `result.clarification.questions[]` but widget read `result.questions` — always undefined, banner showed bare "needs more detail" with no actionable info. Same systemic shape: frontend and backend out of sync.
- Fix: widget reads `result.clarification.questions/conflictsDetected/rationale` and renders rich banner with rationale + numbered questions + conflicts.
- Verified live: PE returned 4 specific architectural questions about whether the cross-platform-image issue belonged on MARKETING_MANAGER vs upstream specialists vs Jasper. **The PE's clarification was actually correct architectural reasoning** — surfaced to operator, became the entry point for the auto-review-deletion decision below.

**4. Manager auto-review path DELETED entirely** (commit `4ecbd7ee`, **-1081 / +89 lines**)
- Operator decision (permanent, not "disabled until later"): "we cant trust the ai to review its own work, it is bias". The Apr 18 disabling was the right call but the Apr 18 framing of "restore later when shadow-mode is ready" was wrong — AI grading AI is a permanent design gap, not a calibration gap.
- Removed: `reviewOutput()`, `performLlmReview()`, `buildReviewUserPrompt()`, `parseReviewResponse()`, `MAX_REVIEW_RETRIES`, `reviewResultCache`, the retry/escalation loop, plus `scripts/verify-managers-review.ts` and `scripts/verify-content-manager-review.ts`.
- Kept: `delegateWithReview` name (9 manager subclasses call it — name kept for call-site stability, future cosmetic rename to plain `delegate` is safe), the M2a `specialistsUsed` accumulator, `recordPerformanceEntry` (perf tracker still gets a synthetic PASS/100 to keep its schema intact). Manager Golden Masters + operator-driven training-loop pipeline (StepGradeWidget → grade-specialist with `_MANAGER` branching → Prompt Engineer → human approve → new GM version) remain load-bearing.
- Memory file replaced: `project_manager_auto_review_disabled.md` → `project_manager_auto_review_deleted.md` (do NOT propose re-introducing autonomous manager LLM review under any framing).
- CLAUDE.md Phase 1-4 narrative updated to reflect: managers are dispatchers + perf trackers, not LLM reviewers.

**5. Grade widget UX fixes — single Save click + state reset per round** (commit `57ef6258`)
- Bug 1: clicking a star fired `submitGradeToFirestore` immediately, before the operator could type an explanation or pick a target. Net result: 2-3 unwanted writes per submission, plus operator confusion about which click actually counted.
- Bug 2: `chosenSpecialist` and `explanation` state persisted across rounds — operator picked MARKETING_MANAGER in round 1, then tried to grade X_EXPERT in round 2, dropdown still showed MARKETING_MANAGER, request silently went to wrong agent. **The PE then proposed adding X-platform-specific copy guidance to the MARKETING_MANAGER review prompt** — architecturally nonsensical, would have been a real Standing-Rule-#2 trust violation if applied. (Operator caught it. Rejected the popup. Bug fixed.)
- Fix: star click only sets state and auto-expands the form (no immediate POST). Save button is the only write path. After successful submission, `chosenSpecialist` + `explanation` reset to force a deliberate re-pick on the next round.

**6. Canonicalization — one true name everywhere + back-compat aliases + CI guard** (commits `f45cfaf8`, `d5333df3`)
- Operator pushed for a systemic fix instead of growing the alias map: "give one name to each agent ... however as a human it is just in our nature to ask for something by the wrong name at times ... how do we handle that?"
- Three-layer answer shipped:
  - **Storage layer:** ONE canonical ID per agent across admin UI, runtime delegation, seed scripts, and Firestore. No more dual-truth.
  - **Back-compat alias layer:** the `SPECIALIST_ID_ALIASES` map flipped from "admin → seed" band-aid to a deliberate "legacy → canonical" compatibility layer for historical step records, old TrainingFeedback documents, external scripts, and humans who refer to agents by familiar names. Grows only when LEGACY data exists in Firestore.
  - **CI guard:** `scripts/audit-canonical-specialist-ids.ts` fails the build if any new admin/seed/Firestore-GM misalignment ever sneaks back in. Architectural exclusions (managers, deterministic dispatchers) explicitly listed.
- Renames executed (sed bulk replace across 26 files):
  - `TWITTER_X_EXPERT` → `X_EXPERT` (Twitter was rebranded; drop the stale name)
  - `WEB_SCRAPER` → `SCRAPER_SPECIALIST` (matches all-other-specialists suffix convention)
  - `ARCHITECT_COPY_STRATEGIST` → `COPY_STRATEGIST` (department grouping belongs in UI, not in IDs)
  - `ARCHITECT_FUNNEL_STRATEGIST` → `FUNNEL_STRATEGIST`
  - `ARCHITECT_UX_UI_STRATEGIST` → `UX_UI_STRATEGIST`
- Firestore migration `scripts/migrate-canonical-specialist-ids-may-8-2026.ts`: 3 X-agent GM versions copied to canonical doc IDs, active flag (v3) preserved on the new doc, legacy docs deactivated as historical records (rollback-safe). Other 4 specialists had no legacy docs to migrate (the architect/scraper trio's only mismatch was in admin SpecialistRegistry, not in seeded GMs — handoff prediction confirmed).
- CI guard final state: 34 admin / 55 seed / 21 runtime / 56 live GM, all aligned.

**7. BUDGET_STRATEGIST agent shipped production-ready** (commit `f266545f`)
- Marketing-side specialist that reads per-platform spend + CRM-attributed conversions, emits per-platform recommendations (increase / decrease / hold / pause) with plain-English rationale, confidence scoring, and math-validated allocations. Reports to MARKETING_MANAGER. **NOT** to be confused with PRICING_STRATEGIST (Stripe dispatcher in commerce — totally different agent).
- Standing Rule #1 satisfied: GM seeded with Brand DNA baked in (industry prompt 5,619 chars → 6,692 chars resolved; 11 Brand DNA fields preserved in `brandDNASnapshot` for audit). NO runtime Brand DNA loading.
- Conversion-source trust order baked into the prompt: `crm > ga4 > platform_self_reported`. Self-reported numbers explicitly flagged as sanity-check only.
- Math invariants enforced server-side AFTER the LLM responds: `recommendedSpendUsd` values must sum to within $1 of `totalBudgetUsd`; `deltaUsd` must equal `recommendedSpendUsd - currentSpendUsd`. LLM math failures throw rather than silently mis-allocate.
- For platforms without a budget-change API (SEO retainers, manual LSA top-ups), recommendations carry `requiresManualMissionTask=true` and a plain-English `manualMissionPrompt` the operator copies into Jasper.
- Insufficient-data flagging: when total attributed conversions < 10 over the window, `insufficientData=true` and rationales explicitly tell the operator the recommendations are exploratory until more data accumulates.
- Live load verifier `scripts/verify-budget-strategist-load.ts`: 7/7 pass (GM with Brand DNA baked, MARKETING_MANAGER registers FUNCTIONAL, delegation rule wired, agent-registry + admin SpecialistRegistry entries, CI guard audit aligned).
- Files: `src/types/budget-strategist.ts`, `src/lib/agents/marketing/budget/specialist.ts` (~430 lines, modeled on May 4 INSIGHTS_ANALYST pattern), `scripts/seed-budget-strategist-gm.js`, `scripts/verify-budget-strategist-load.ts`.

## The actual BYOK debug — what surfaced beyond the surface bugs
The operator's original BYOK correction was: "I asked for the post to have the same image on every platform, instead every platform had a different image". After the alias resolver landed, the PE was finally able to run on the correct GM. **Its CLARIFICATION_NEEDED response was the most architecturally insightful output of the day.** Quoted in part:

> "The Marketing Manager is a quality-gate **reviewer** — it grades specialist output but does NOT produce content or generate images itself. The issue you described (different images on every platform instead of the same image) sounds like it originated from the content-producing specialist (e.g., the social media experts) or from the orchestration layer (Jasper) that dispatched the multi-platform post request. ... Should this edit go to the Marketing Manager (to catch and reject mismatched images during review), or should it go to a different specialist (like the content creators or Jasper the orchestrator) who is responsible for actually selecting/generating the images?"

The PE was correct: the BYOK behavior is a **code-level bug** in `MarketingManager.executeMultiPlatformPost` — it loops `executeSinglePlatformPost` per platform, and each iteration independently calls `generateAndStoreSocialPostImage`. Three platforms = three separate DALL-E generations = three different images. No prompt edit on MARKETING_MANAGER fixes this because manager prompts don't drive image generation, the code path does.

**Operator's read after seeing this:** the architecturally correct target for a prompt fix is JASPER's plan generation — Jasper should plan a `delegate_to_content` for image generation FIRST when the operator asks for one shared image, then fan out to platform specialists with `providedMediaUrls=[that image]`. The plumbing for `providedMediaUrls` already exists (May 3 commit `4c620a67`). What's missing is Jasper knowing to use it.

**This is the next architecturally-correct grading test.** Logged as task #8 (re-grade BYOK targeting Jasper for shared-image intent) — pending operator action in a future session, since the original BYOK mission was deleted earlier today.

## Shortcuts taken (named per standing rule)
- **My Monitor filter doesn't catch DELETE events.** When the operator deleted the BYOK mission earlier, my monitor missed it; I later proposed another test against the deleted mission. Operator caught it. Filter needs `DELETE /api/orchestrator` + `Mission deleted|Mission scrapped|status=DELETED` patterns added next session. Don't repeat.
- **Today's CI guard checks live Firestore, not just static files.** That means CI agents running it need access to `serviceAccountKey.json`. If the prod CI environment doesn't have that, the audit needs a static-only fallback mode (read seed scripts + admin registry + agent-registry.ts only, skip Firestore). Wire that fallback before adding the audit to the CI workflow.
- **AGENT_REGISTRY.json was not updated** as part of the canonicalization. Looked at it and saw stale data from before today (still shows `TWITTER_EXPERT`, only 6 specialists per manager). It's documentation-only, not loaded at runtime, so the rename didn't break anything — but it's drifted and worth a separate regenerate-from-source cleanup.
- **BUDGET_STRATEGIST's LLM call hasn't been exercised live.** The load verify proves the wiring; the actual prompt → LLM → JSON-parse → math-validate path hasn't been tested with real data. First prod call will burn ~$0.05-0.20 in OpenRouter credits depending on platform count. Watch for prompt issues on first run.

## Files touched this session
- `src/lib/training/specialist-golden-master-service.ts` (alias resolver + back-compat map rewrite)
- `src/lib/training/manager-golden-master-service.ts` (added `isManagerId`, `createManagerGMVersionFromEdit`, `listManagerGMVersions`, signature-aligned `deployManagerGMVersion`)
- `src/lib/training/grade-submission-service.ts` (manager-aware branching in submitGrade + approvePromptEdit)
- `src/app/api/training/grade-specialist/[specialistId]/rollback/route.ts` (manager-aware branch)
- `src/app/api/training/grade-specialist/[specialistId]/versions/route.ts` (manager-aware branch)
- `src/app/(dashboard)/mission-control/_components/StepGradeWidget.tsx` (UX fixes + clarification banner shape fix)
- `src/lib/agents/base-manager.ts` (auto-review LLM path deleted, -1081 lines)
- `src/lib/agents/operations/manager.ts` + `src/lib/training/manager-golden-master-service.ts` (stale-comment cleanup referencing the gone `reviewOutput()`)
- 26 source files via sed bulk rename (TWITTER_X_EXPERT → X_EXPERT etc.)
- `src/lib/agents/marketing/manager.ts` (BUDGET_STRATEGIST factory + delegation rule)
- `src/lib/agents/agent-registry.ts` (BUDGET_STRATEGIST manifest entry)
- `src/components/admin/SpecialistRegistry.tsx` (BUDGET_STRATEGIST admin entry + ID canonicalization)
- `src/types/budget-strategist.ts` (NEW — BUDGET_STRATEGIST type contracts)
- `src/lib/agents/marketing/budget/specialist.ts` (NEW — BUDGET_STRATEGIST agent)
- `scripts/verify-specialist-id-alias-resolver.ts` (NEW — back-compat resolver verify)
- `scripts/migrate-canonical-specialist-ids-may-8-2026.ts` (NEW — one-time Firestore migration)
- `scripts/audit-canonical-specialist-ids.ts` (NEW — CI guard)
- `scripts/seed-budget-strategist-gm.js` (NEW — Brand-DNA-baking seed)
- `scripts/verify-budget-strategist-load.ts` (NEW — 7-check load verifier)
- `scripts/verify-managers-review.ts` (DELETED — proves the gone path)
- `scripts/verify-content-manager-review.ts` (DELETED — same)
- `CLAUDE.md` (Phase 1-4 section updated to reflect auto-review removal)
- Memory: `project_manager_auto_review_disabled.md` → `project_manager_auto_review_deleted.md` (renamed + rewritten)

## Tomorrow's plan / next session

### High priority (close out training-loop trust)
1. **Re-grade BYOK targeting Jasper for shared-image intent** (task #8) — once a fresh multi-platform mission is run that exhibits the "different image per platform" behavior, the architecturally-correct grade target is Jasper's plan-generation prompt, not MARKETING_MANAGER. Test confirms the canonicalization stack + new picker logic + Jasper-grading path all work together end-to-end.
2. **Patch Monitor filter** to catch DELETE events: add `DELETE /api/orchestrator|Mission deleted|Mission scrapped|status=DELETED` to the live-test monitor pattern. Update `project_live_test_monitoring_setup.md` accordingly.

### BUDGET_STRATEGIST follow-up surface (the real product work)
3. **Dashboard widget UI + full budgeting page** — operator's spec calls for a tile that opens a full page with allocation across SEO, social boosts, PPC, Google LSA, etc. Real UX work.
4. **Hourly cron for live refresh** — the widget needs to refresh from real spend + conversion data periodically. Cron + queue infrastructure already exists; wire BUDGET_STRATEGIST into it once data sources are connected.
5. **Google Ads / Meta Ads / Google LSA budget-shift API integrations** — each is a separate integration story (OAuth flow + webhook + budget-change endpoints). Defer until the recommendation surface is proven valuable.
6. **CRM source attribution wiring** — UTM capture on every public form + GA4 link branding + CRM `source` field standardization. Without this, BUDGET_STRATEGIST's recommendations are exploratory because there's no high-trust conversion ground truth.
7. **Two-step Apply confirmation** — per the destructive-action standing rule, moving money requires two distinct clicks. Ships with the Apply button.

### Architectural follow-ups
8. **AGENT_REGISTRY.json regenerate-from-source** — file is stale (TWITTER_EXPERT, 6 specialists per manager). Regenerate from agent-registry.ts so the documentation matches reality.
9. **Static-only mode for the canonicalization audit** — add a flag to `audit-canonical-specialist-ids.ts` so it can run without Firestore access (for CI environments lacking the service account key). Then wire into the CI workflow as a build-blocker.
10. **Cosmetic rename** of `delegateWithReview` → `delegate` across 9 manager subclasses (auto-review path is gone; name is misleading). Pure cascade refactor when worth doing.

### Multi-tenant readiness checklist (tracked from May 7 handoff, still open)
1. Onboarding flow — operator signup, brand DNA capture, industry selection, OAuth into central platform apps, per-tenant Stripe customer creation
2. Per-tenant API key store
3. Per-tenant GM seeding (automatic seed of all 55 specialist GMs + 10 manager GMs scoped to new tenant's industry, parameterized by tenantId)
4. Per-tenant SendGrid subuser
5. Per-tenant Twilio Messaging Service
6. Tenant-scoped Firestore rules
7. Audit pass for hardcoded `rapid-compliance-root`
8. Billing pipeline
9. BUDGET_STRATEGIST already tenant-aware from day one (uses `getActiveSpecialistGMByIndustry` which goes through `getSubCollection` — multi-tenant flip will work without retrofitting)

### Standing rule audit
- Standing Rule #1 (Brand DNA baked at seed time) — held throughout. BUDGET_STRATEGIST seeded with Brand DNA, all 5 canonicalized agents kept their bake.
- Standing Rule #2 (no autonomous prompt edits) — held. Manager auto-review deletion was a CODE removal, not a prompt edit. All GM mutations today went through the operator-driven grade → PE → approve → deploy pipeline OR through the canonicalization migration (one-time, operator-authorized).

---

# 🛠️ SESSION — Sentry monitoring + Mission Control training-loop fixes (May 7, 2026)

## What this session was
Day picked up after main was rolled back to `62a2090f` on May 4 (Vercel build cascade). Today's tasks: finish post-rollback re-landings (Twilio Messaging Service routing for toll-free SMS), wire Sentry properly, then debug a real Mission Control bug the operator caught — a graded BYOK social-post mission where the operator's correction silently went nowhere because the X_EXPERT GM lookup mismatched the runtime ID. That single observation expanded into a swarm-wide GM seeding audit and a rebuild of the step-level grading UI.

## What got fixed (committed `8e40cb9f` and prior)

**1. Sentry production monitoring is live** (commit `8e40cb9f`)
- `sentry.client.config.ts` created (server + edge configs were already there — only client was missing). DSN-gated via `process.env.NEXT_PUBLIC_SENTRY_DSN`. Filters: extension-injected errors via `denyUrls`, common browser noise via `ignoreErrors`, sensitive headers/query-params stripped in `beforeSend`. Replay-on-error at 100% in prod, 0% in dev. Performance traces at 10% in prod, 100% in dev. Release tagged from `VERCEL_GIT_COMMIT_SHA`.
- DSN env vars added to Vercel for **Production + Preview + Development**. Same DSN added to local `.env.local` so the dev server feeds into the same Sentry project.
- `next.config.js` already wraps with `withSentryConfig` and lists `@sentry/nextjs` in `serverComponentsExternalPackages` — no changes needed there.
- Next deploy to main will activate prod monitoring automatically.

**2. memory-vault crash fix** (`src/lib/agents/shared/memory-vault.ts:777-781`)
- `getPendingSignals` was calling `s.value.affectedAgents.includes(agentId)` without guarding undefined. Legacy SignalEntry docs lacking the field crashed every `MARKETING_MANAGER.checkIntelligenceSignals()` invocation.
- Now: `const affected = Array.isArray(s.value.affectedAgents) ? s.value.affectedAgents : []` then `affected.includes(...)`.
- Closes the prior open-issues table line item (was tagged "Low / surfaces on every Marketing Manager invocation").

**3. StepGradeWidget rebuild** — addresses two real problems caught in the BYOK debug
- **Wrong grade target.** Step `specialistsUsed` for the BYOK multi-platform mission was `["X_EXPERT","BLUESKY_EXPERT","MASTODON_EXPERT"]`. Operator's correction was about CROSS-PLATFORM image consistency ("same image on all platforms"), which is a `MARKETING_MANAGER` concern, not an X_EXPERT prompt issue. Widget previously offered only specialists in the picker. Now: derives manager id from the step's `delegatedTo` field (`MARKETING` → `MARKETING_MANAGER`) and prepends it to the picker as the FIRST option, with help text: "Pick the manager for cross-platform / orchestration rules; pick a specialist for platform-specific copy or formatting."
- **Silent backend rejections.** Backend `/api/training/grade-specialist` returns 422 with `error: "No active Golden Master found for ${id}:${industry}. Seed the specialist before grading."` when `getActiveSpecialistGMByIndustry` finds nothing. Widget previously did `if (!gradeRes.ok) return;` — operator saw the star rating save successfully and had no idea the prompt-edit half silently dropped. Now: a dismissible `pipelineMessage` banner with `error|warn|info` styling surfaces every non-ok response with the backend's exact error text. CLARIFICATION_NEEDED, missing-edit-text, and exception paths all surface their own banner copy.
- New optional `delegatedTo?: string` prop wired from `mission-control/page.tsx`. The star rating still saves to `missionGrades` regardless — the banner only addresses the prompt-edit half.

**4. GM seeding audit script** — `scripts/audit-gm-seeding.ts`
- Cross-references admin registry IDs (`SpecialistRegistry.tsx`), runtime delegation maps (`marketing/manager.ts`), seed-script `SPECIALIST_ID` constants, and live `specialistGoldenMasters` Firestore docs.
- Operator concern was: "all of the gm's should be seeded by now, we need to run a check on them all and ensure it is done for all or else this is pointless testing." Audit ran clean: 10/10 manager GMs live, 55 specialist GMs live for `saas_sales_ops`. The 8 reported "missing" specialists are MOSTLY ALIASES — `X_EXPERT` aliases `TWITTER_X_EXPERT`, `WEB_SCRAPER` aliases `SCRAPER_SPECIALIST`, `ARCHITECT_*_STRATEGIST` aliases the matching `*_STRATEGIST`, `REVENUE_DIRECTOR` is a manager (seeded at manager level), `AUTONOMOUS_POSTING_AGENT` is deterministic automation with no LLM. Only `PRICING_STRATEGIST` is unseeded but it's a deterministic Stripe dispatcher (`src/lib/agents/commerce/pricing/specialist.ts` — `systemPrompt: ''`) so it doesn't need a GM.

## The actual BYOK debug — what the audit + step-record dump revealed
Mission `mission_req_1778182007561_qymsh9` (May 7 19:26 UTC) ran `delegate_to_marketing` with `platforms: [twitter, bluesky, mastodon]` and successfully posted to all three. Each platform got a DIFFERENT image (the operator had explicitly asked for ONE shared image — feature gap, not a bug, since the multi-platform path doesn't currently share-image). Operator graded 1/5 with the explanation "I asked for the post to have the same image on every platform, instead every platform had a different image". The grade routed to `X_EXPERT` (admin/UI naming) but the seeded GM is at `TWITTER_X_EXPERT` (factory/seed naming). Backend correctly returned 422; frontend silently swallowed it; trainingFeedback record was marked `discarded`. The operator believed they had graded; the training loop had never received the feedback.

This is exactly the Standing Rule #2 violation the system was supposed to prevent. Today's UI fix surfaces the failure to the operator. Tomorrow's alias-resolver fix (in `getActiveSpecialistGMByIndustry`) closes the loop server-side.

## Shortcuts taken (named per standing rule)
- The `X_EXPERT → TWITTER_X_EXPERT` alias map is **NOT yet wired into the GM lookup**. The widget surfaces the failure cleanly now, but the underlying lookup still 404s. Tomorrow's first task.
- The `PRICING_STRATEGIST` audit conclusion ("no GM needed because deterministic dispatcher") was based on reading `commerce/pricing/specialist.ts` — but the operator described a DIFFERENT agent they want built (budget allocator). New agent, not a rename of existing. See "Tomorrow's plan" below.
- Sentry's `instrumentation-client.ts` deprecation warning was logged but not addressed — Next 15 will require renaming `sentry.client.config.ts`. Today the file is the right name for Next 14.2.33; next major Next upgrade triggers the rename.
- The retry monitor used GitHub `gh` CLI which turned out to be unauthenticated locally; the build-watch silently produced no events. Operator confirmed build status manually via Vercel dashboard. Sentry build is green.

## Files touched this session
- `sentry.client.config.ts` (NEW)
- `src/lib/agents/shared/memory-vault.ts` (5-line fix)
- `src/app/(dashboard)/mission-control/_components/StepGradeWidget.tsx` (rebuild — picker, error-surface)
- `src/app/(dashboard)/mission-control/page.tsx` (1-line — pass `delegatedTo` prop)
- `scripts/audit-gm-seeding.ts` (NEW)
- `scripts/inspect-byok-mission.ts` + `scripts/find-byok-grade.ts` (debug scripts kept for reproducibility)
- `.env.local` (Sentry DSN added — local only, gitignored)
- Vercel env vars (`SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN` for Prod+Preview+Dev)
- `docs/single_source_of_truth.md` (updated)
- `CONTINUATION_PROMPT.md` (this file — updated)

## Tomorrow's plan (May 8, 2026)
1. **Wire the alias resolver** — `getActiveSpecialistGMByIndustry` (in `src/lib/training/specialist-golden-master-service.ts`) accepts a `SPECIALIST_ID_ALIASES` map and resolves admin-canonical names to seed-canonical names. Map: `X_EXPERT → TWITTER_X_EXPERT`, `WEB_SCRAPER → SCRAPER_SPECIALIST`, `ARCHITECT_COPY_STRATEGIST → COPY_STRATEGIST`, `ARCHITECT_FUNNEL_STRATEGIST → FUNNEL_STRATEGIST`, `ARCHITECT_UX_UI_STRATEGIST → UX_UI_STRATEGIST`. Verify by re-grading the BYOK mission step and confirming the grade lands.
2. **More live testing** — operator runs more Jasper prompts, we monitor for new bugs and fix as they surface.
3. **Full campaign orchestration walkthrough** — once point bugs are clean, walk a full multi-step campaign end-to-end (research → strategy → multi-channel content → publishing → measurement). This is the YC story re-validation.
4. **Spec the BUDGET_STRATEGIST agent** (see below).
5. **Multi-tenant readiness checklist review** (see "Multi-tenant readiness" section below).

## Spec — `BUDGET_STRATEGIST` agent (drafted in this session)

**Role:** Operator-controlled marketing budget allocation. NOT to be confused with `PRICING_STRATEGIST` (Stripe/payment dispatcher).

**Reports to:** `MARKETING_MANAGER` (not `COMMERCE_MANAGER` — this is about marketing spend, not customer billing).

**Inputs / data sources:**
- **Budget number:** operator-entered in a UI. Dashboard widget that, when clicked, opens a full budgeting page with allocation across SEO, social boosts, PPC (Google Ads/Meta Ads), Google Local Service Ads, etc.
- **Spend data:** pulled from each connected platform's API (we'll already have these connections wired by build time).
- **Conversion truth:** primary = our CRM `source` field (UTM-captured at form submit). Fallback = GA4 (UTM-tagged links). Sanity check = each ad platform's self-reported conversion count. Operator's reasoning: "just because a client visits our site from one of our platforms doesn't mean they convert into sales — we need to track which platform actually converts, and this also keeps the platforms honest about their conversions."

**Outputs:**
- Recommendations in plain English ("shift $200 from FB Ads to Google Ads — Google's conversion rate is 4.2× higher this period").
- "Apply" button with two-step confirmation (per the destructive-actions standing rule — moving money is destructive).
- On approval: agent calls each platform's API to actually shift the campaign budget (Google Ads campaign budget, Meta ad-set budget, etc.).
- For platforms without a budget-change API (SEO retainers, manual Google LSA top-ups), the recommendation flows out as a Mission Control task instead of an auto-apply.

**Cadence:**
- Live dashboard widget refreshes hourly via cron.
- Manual refresh button on the widget.

**Architecture rules:**
- **Tenant-aware from day one** — uses `getSubCollection()` and authenticated request `tenantId`, never hardcodes `PLATFORM_ID = 'rapid-compliance-root'`. Multi-tenant flip is targeted for the week of May 4-10; bolt-on later is wasted work.
- **Standing Rule #1** — has its own GM with Brand DNA baked in; no runtime Brand DNA loading.
- **Standing Rule #2** — operator grades drive prompt edits via the same Phase 3 pipeline; no self-improvement.
- Tracking infrastructure (UTM capture on every form, social-account-tagged outbound link IDs so we know WHICH brand account sent the click, CRM `source` field on every lead/contact) ships **before** the agent's recommendations are trusted — agent surfaces "insufficient data, recommendations will improve as conversions accumulate" until the CRM has enough source-attributed records to compare across platforms. Same pattern for organic-vs-paid: agent eventually learns "this platform is great for awareness but never converts to sales — recommend organic-only here, no boost spend".

**Open question for tomorrow:** what does the budgeting page UI actually look like? Pure dashboard tile + drilldown page, or also reachable from the Marketing hub? Probably both.

## Multi-tenant readiness checklist (preview for tomorrow's planning)

Once today's stack (testing → bug fixing → full campaign orchestrations) is verified, the multi-tenant flip needs:

1. **Onboarding flow** — operator signup, brand DNA capture, industry selection, OAuth into central platform apps, per-tenant Stripe customer creation
2. **Per-tenant API key store** — each tenant's `apiKeys/social.{platform}` lives in their org doc, not under `rapid-compliance-root`
3. **Per-tenant GM seeding** — automatic seed of all 55 specialist GMs + 10 manager GMs scoped to the new tenant's industry, with their Brand DNA baked in. Reseed script we already have, parameterized by tenantId
4. **Per-tenant SendGrid subuser** — already targeted (Pro tier picked Apr 27 specifically for this)
5. **Per-tenant Twilio Messaging Service** — each tenant gets their own toll-free number + verification
6. **Tenant-scoped Firestore rules** — strict isolation, no cross-tenant reads
7. **Audit pass for hardcoded `rapid-compliance-root`** — every reference replaced with `getSubCollection()` / authenticated request tenantId
8. **Billing pipeline** — Stripe-driven, tied to onboarding, plan tiers
9. **The BUDGET_STRATEGIST agent** — built tenant-aware from day one so it doesn't need retrofitting

---

# 🛠️ SESSION — Social posting fix + duplicate header (May 3, 2026)

## What this session was
The user tried to record a demo on the live site and Jasper's social posting was broken — Mission Control reported "complete" in 2.2 seconds with nothing actually posted to any platform. Investigation surfaced an architectural gap: the Marketing Manager's `executeSinglePlatformPost` was generating drafts + image but never calling the platform API. Two-step plan resolution code existed (`step_1_output_primaryPost`) but `propose_mission_plan`'s description forbade `social_post` as a step, so Jasper couldn't ever produce the working 2-step shape.

## What got fixed (committed `4c620a67` and `07f8b329`)

**1. Marketing Manager actually publishes now** (`src/lib/agents/marketing/manager.ts`)
- `executeSinglePlatformPost` now calls `autonomous-posting-agent.executeAction({ type: 'POST' })` after the draft+image step. Returns `published: true` + `publishedActionId` + `publishedPlatformActionId` on success; returns `FAILED` with `publishError` on failure (kills silent-success-with-nothing-posted).
- New `executeMultiPlatformPost` method loops the single-platform path per platform and aggregates results. Triggered when `delegate_to_marketing` receives `platforms: [...]` array OR `platform: "all"`. `"all"` expands to active connected accounts via `SocialAccountService.listAccounts()`.

**2. `delegate_to_marketing` accepts a `platforms` array** (`src/lib/orchestrator/jasper-tools.ts:1630`)
- New `platforms: string[]` parameter alongside the existing `platform: string`. Marketing payload passes through.

**3. Bluesky image auto-compression** (`src/lib/integrations/bluesky-service.ts:uploadBlobFromUrl`)
- Bluesky's PDS rejects blobs > 2 MB. Fix auto-resizes JPEG/PNG/WebP via Sharp (1600px max width, JPEG quality 85→40 stepdown with mozjpeg) when bytes exceed 1.9 MB safe margin. Operator no longer has to know per-platform image limits.

**4. Social Hub duplicate tab row** (`src/app/(dashboard)/social/page.tsx`)
- Both the layout AND the page were rendering `<SubpageNav items={SOCIAL_TABS} />`. Removed the page-level one (layout already renders for every social subroute).

## Verified live
End-to-end on local: a single "Create a social media post for Summer 2026 kickoff" prompt produced a multi-platform mission running ~92 seconds (real work, vs. the prior 2.2 s silent fake-complete). Real tweet on @SalesVelocityAi X account, real toot on Mastodon. Bluesky failed in this run on the 2 MB blob limit — that's what triggered the compression patch.

## Shortcuts taken (named per standing rule)
- The Bluesky compression patch was committed without retesting after Sharp resize was added — only the architectural fix was end-to-end verified.
- The `platform: "all"` expansion path was code-added but not specifically exercised in the test (Jasper picked an explicit `platforms: [twitter, bluesky, mastodon]` array on his own).

## Known bugs surfaced but NOT fixed (next session)
- **`scan_leads` Apollo filters silently dropped.** Every query returns the same 25 companies regardless of `industry`/`keywords`/`location`. `{industry:"Lawncare"}`, `{industry:"Landscaping"}`, `{industry:"Environmental Services"}` all return identical results with `totalResults=17,546,296`. Param mapping in `scan_leads → Apollo` API call is broken.
- **Two missing composite Firestore indexes** (one-click create-index URLs in error logs):
  - `audience_snapshots(accountId, platform, dayKey, __name__)` — blocks `/api/social/platforms/[platform]/audience` GET
  - `missions(metadata.platform, status, createdAt)` — blocks `findPendingMissionForPlatform`
- **`/social/linkedin` route doesn't exist** — should 404 but throws a React `useContext` 500 instead. Layout chain has a hooks issue when matched against a missing route.

## Demo video for YC
- Three options surfaced; user did not pick before time ran out: (1) skip demo (it's optional in the YC form), (2) Mission Control walkthrough (safest, shows unique IP), (3) social posting demo (now possible after this session's fix). Open question for next session: did the user submit YC without a demo, or did they record one? Update memory accordingly.

## Files committed
- `src/lib/agents/marketing/manager.ts` (+233 lines: publish path + multi-platform method)
- `src/lib/integrations/bluesky-service.ts` (+46 lines: compression)
- `src/lib/orchestrator/jasper-tools.ts` (+12 lines: platforms array)
- `src/app/(dashboard)/social/page.tsx` (-4 lines: duplicate SubpageNav removed)

## Test commands for next session
- `npx tsc --noEmit` — should be clean
- `npx eslint <files>` — should be clean
- Live test: type "post about [X] to my connected platforms" in Jasper chat, expect `executeMultiPlatformPost` log + per-platform `published=true` results

---

# 🚨 ACTIVE SESSION — YC PRE-SUBMISSION WALKTHROUGH (April 30, 2026)

**YC submission deadline:** Friday May 1, 2026. Today is the only working day.

**Plan:** Walk every page, every button, every feature in the platform top-to-bottom before submission. Fix anything blocking, surface anything questionable.

## Phase progress

| # | Phase | Status |
|---|---|---|
| 0 | Pre-flight (build/lint/tsc clean, dev running, monitor armed) | ✅ DONE |
| 1 | Public marketing site (homepage, pricing, /demo, etc.) | 🔄 IN PROGRESS — homepage + /demo complete; rest pending |
| 2 | Onboarding wizard (24 steps) | ⏸ Pending |
| 3 | Dashboard hub + sidebar nav | ⏸ Pending |
| 4 | Settings (29 pages) | ⏸ Pending |
| 5 | Integrations (~30 platforms) | ⏸ Pending |
| 6 | CRM stack (leads/contacts/deals/companies/activities/tasks/calls/conversations/lead-scoring/nurture) | ✅ DONE — May 1, 2026 (3 Admin SDK fixes shipped; calls bugs #14/#15 logged post-YC) |
| 7 | Content + Magic Studio + media | ✅ DONE — May 1-2, 2026 (~2,100 raw colors swapped to design tokens across ~50 files; duplicate content calendar removed) |
| 8 | Outbound (email/SMS/sequences/campaigns) | ✅ DONE — May 2, 2026 (sequences redirect added; pause/active button hierarchy tokenized; /sms-messages 404 logged as #17) |
| 9 | Social + approvals + calendar | 🔄 IN PROGRESS |
| 10 | Forms / Website builder / Workflows / Storefront / Voice | ⏸ Pending |
| 11 | **Mission Control + Standing Rule #2 proof — CORE YC STORY** | ⏸ Pending (recommend tackle FIRST in next window) |
| 12 | System / Cron / Health | ⏸ Pending |
| 13 | Billing / Stripe / Webhooks | ⏸ Pending |
| 14 | Profile / Sites / Store / Preview routes | ⏸ Pending |
| 15 | End-to-end customer journey | ⏸ Pending |
| 16 | Known-gaps triage (decide fix-or-hide for each before submission) | ⏸ Pending |
| 17 | Orchestrated re-test plan | ⏸ Pending |

## Phase 1 progress — what's been verified this session

- ✅ Homepage `/` — loads, $299 flat showing, "Reserve my spot" + "Ask Alex" CTAs work, 9 feature cards present
- ✅ "See Demo" → "Ask Alex" rename completed
- ✅ /demo — Alex now real, hardcoded brand-tuned opener (the 69-agent pitch), GM scripted with 4 core scripts (Why Us / Easy Setup / Golden Master Flex / Anti-ChatGPT), live catalog injection per turn
- ⏸ /pricing — to verify
- ⏸ /features — to verify
- ⏸ /early-access — to verify (form submit + demo booking)
- ⏸ /contact — to verify
- ⏸ /book — to verify
- ⏸ /about, /faq, /docs, /security, /blog, /unsubscribe, /terms, /privacy — quick smoke
- ⏸ /login + /forgot-password + /signup + /admin-login — auth flows

## Today's wins (April 30 2026 session)

### Build / lint / tsc unblocked
- Production build was OOMing at 4GB heap; added `NODE_OPTIONS=--max-old-space-size=8192` to `package.json` build script
- 14 `@typescript-eslint/no-unnecessary-type-assertion` errors fixed by switching `await AdminFirestoreService.get(...) as Foo | null` pattern to the generic `AdminFirestoreService.get<Foo>(...)`
- TypeCheck clean (only stale `.next/types/` warnings + 4 pre-existing pricing-test errors)

### Pricing centralized to single source of truth — $299 flat
- Created `src/lib/config/pricing.ts` as canonical (PRICING object — flat $299/mo, 14-day trial, BYOK, fair-use limits)
- `src/lib/pricing/subscription-tiers.ts` rewritten to single 'pro' tier; `SubscriptionTierKey` narrowed
- `src/lib/middleware/tier-enforcement.ts` reads from PRICING
- Stripe checkout schema coerces legacy tier names (`starter`, `professional`, `enterprise`) → `'pro'` so old links still work
- Public homepage + `/settings/billing` + `/settings/subscription` + product-knowledge + sales-chat seed route + flow-manager + agent-pricing route + default-config + tests all updated
- Replaced hardcoded `claude-3.5-sonnet` (deprecated on OpenRouter) with `claude-sonnet-4.6` in 7 seed scripts + 2 source files + Firestore agentConfig doc
- Centralized pricing means a future change is one config edit, not a sweep

### Server-routes-must-use-Admin-SDK sweep — caught the silent Alex memory bug
- Pattern from memory `feedback_server_routes_must_use_admin_sdk.md`: server-side client SDK has no auth context → Firestore rules silently deny
- The real Alex conversation-memory bug was in `src/lib/agent/instance-manager.ts` — three methods (`storeActiveInstance`, `archiveInstance`, `notifyHumanAgents`) used the client SDK unconditionally. activeInstances writes silently failed, so every /api/chat/public turn spawned a fresh blank instance and Alex had zero memory across turns. Now uses Admin SDK.
- Same anti-pattern fixed in 6 other paths: `cron/workflow-entity-poll` (silently never fired triggers), `crm/duplicates/merge` (always 404), `voice/call`, `voice/twiml`, `voice/ai-agent`, `voice/ai-agent/speech` — all silent prod bugs.
- `vector-search.ts` (RAG path called every /demo chat turn) — switched 5 reads/writes to Admin SDK, including the `storeEmbedding` write Stream B initially missed.

### Universal product KnowledgeBase architecture
- New collection: `organizations/{orgId}/platformCatalog/current` (renamed from `knowledgeBase/current` to avoid collision with legacy RAG-document collection)
- 27 features × 20 industries seeded from real source files (`src/lib/constants/feature-modules.ts`, persona templates, settings/organization industry list). No fabricated industry talking points.
- Type defs: `src/types/knowledge-base.ts`. Editable data: `src/lib/knowledge-base/universal-knowledge.ts`. Seed: `scripts/seed-platform-catalog.ts`.
- Catalog loader added to `chat/public` route — fetches catalog at every turn via Admin SDK and prepends to system prompt before personality. Alex now has live product knowledge per turn.
- Helper: `src/lib/agent/catalog-formatter.ts` — pure function formats catalog JSON into LLM-readable text.

### GM dehydration — facts out of agent prompts, into KnowledgeBase
- Architectural rule: GM holds personality + sales judgment + objection-handling shape + Brand DNA + JSON output contract. KnowledgeBase holds pricing + feature catalog + industry value props.
- 64 GM seed scripts audited; only 3 had hardcoded facts removed (sales-chat, golden-masters legacy, onboarding). The other 61 were already clean.
- Sales Chat seed (Alex's GM) — pricing tier table, BYOK explanation, trial details, feature list all stripped. Replaced with reference paragraph: "Your live knowledge of pricing, features, industry value props is loaded from the platform's KnowledgeBase document at the start of every turn — never quote from training."
- 4 architectural follow-ups flagged for post-YC: legacy `seed-golden-masters.js` doesn't use brand-dna-helper (Standing Rule #1 violation, pre-existing); `src/app/api/training/seed-sales-chat-gm/route.ts` runtime API also has hardcoded pricing; `seed-onboarding.ts buildSystemPrompt()` doesn't go through brand-dna-helper; `priceRange` field in onboarding feeds persona-builder.
- Reseed completed: Alex GM v2 deployed (15,115 chars resolved with Brand DNA). Brand DNA verify: 55/55 GMs baked correctly (Standing Rule #1 holds).

### Alex's voice — 4 core scripts now in his GM
Owner-written brand voice plugged in directly. Each script is non-negotiable when its trigger topic comes up:
- **Why Us** ("what is this") — "You don't need another chatbot. You need a department." + Character Studio + Mission Control. Signature line: *"You stop being a doer and start being a director."*
- **Easy Setup** ("how hard to set up", "do I need a developer") — onboarding wizard does the heavy lifting; running in under an hour. Signature line: *"No PhD in prompting required."*
- **Golden Master Flex** ("will it sound like me", "quality") — Delta-Snapshots; agents learn brand voice over time. Signature line: *"We get smarter the more we work for you."*
- **Anti-ChatGPT** ("I already use ChatGPT") — "ChatGPT is a blank page and a high-school intern. We are 350,000 lines of custom orchestration code and a 69-agent team with persistent memory." Signature line: *"ChatGPT gives you a paragraph; we give you a department."*
- Demo /demo opener (hardcoded — every chat widget on the internet has one): *"I'm Alex. I represent a synthetic workforce of 69 specialized agents. Most business owners are 'prompting' themselves to death — I'm here to end that. Tell me your industry, and I'll show you exactly how my lead-gen and creative teams would attack your market today."*
- Catalog content corrected: was naming "Jasper" as the customer-facing inbound chat agent; fixed — Jasper is the operator-facing orchestrator, the customer chat agent is what each customer names theirs.

### Verified agent count (per current filesystem)
- 57 specialists + 11 managers + 1 Master Orchestrator (Jasper) = **69 agents total**
- (Registry's `totalAgents: 57` is stale — last audited Feb 27. Apr 29 commit said 70 but actual is 69.)

### Standing rules respected
- Standing Rule #1 (Brand DNA baked at seed time): every reseed today went through `scripts/lib/brand-dna-helper.js`. Verify script: 55/55 GMs baked.
- Standing Rule #2 (only grades trigger GM changes): no auto-improvement loop touched. All seed reseeds were operator-initiated.

### Live monitoring
- Dev server running with persistent monitor (per memory `project_live_test_monitoring_setup.md`). Watching for ERROR / FATAL / Failed to compile / uncaught / API error / Missing or insufficient permissions / OpenRouter / 404 / 500 / ChunkLoadError / hydration. As of latest restart, the chat path produces ZERO permission errors per turn (vs the pre-fix flood).

## Single source-of-truth rule (Apr 30 2026 lesson)

The plan, the active checklist, and current state of any in-progress work ALL live in this file (`CONTINUATION_PROMPT.md`). Saved to memory as `feedback_plans_live_in_continuation_prompt.md`. Default = NO new doc files. The owner asks before any new `docs/*.md` is created. Three parallel docs were created during this session (`docs/manual_qa_test_plan.md`, `docs/yc-morning-report.md`, `docs/knowledgebase-contract.md`) — those have been merged into this file's content above and DELETED to prevent contradicting parallel plans.

---

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
11. **POST-YC TECH DEBT — Finish the server-side Admin-SDK sweep (silent Firestore permission-denied bug)**

    **The bug, in one paragraph.** Firebase has two SDKs. The **Client SDK** (`@/lib/db/firestore-service` → `FirestoreService`) talks to Firestore *as the logged-in browser user* and is gated by Firestore Security Rules. The **Admin SDK** (`@/lib/db/admin-firestore-service` → `AdminFirestoreService`) uses a service-account credential and bypasses rules. Anything running on the server (API routes, lib services called from routes, cron handlers, webhook receivers) has **no logged-in user context**. So when server code uses the Client SDK, Firestore sees "unauthenticated user" and the rules deny every read and write. The error in the dev log is `FirebaseError: Missing or insufficient permissions.` — surface symptom is `7 PERMISSION_DENIED` on writes and silent empty reads on gets. Memory ref: `feedback_server_routes_must_use_admin_sdk.md`.

    **Why it's silent and dangerous.** The wrappers around `FirestoreService.get` typically `try { ... } catch { return null; }`. So a denied read returns `null`, the route falls back to defaults, and the page renders fine — but the user's saved settings appear *not to exist*. Writes throw, and most routes log + swallow. Nothing crashes; nothing visibly breaks; data quietly fails to persist. This is the same class of bug that produced the Apr 30 Alex memory regression (every chat turn spawned a fresh blank instance because `storeActiveInstance` silently failed) and the Apr 28 SocialAccountService bug (handle/cred dual-store wrote to one collection only).

    **Files fixed so far** (3 in this YC-eve session, plus 8 in prior sweeps):
    - `src/lib/services/feature-service.ts` (May 1, 2026 — this session)
    - `src/lib/services/entity-config-service.ts` (May 1, 2026 — this session)
    - `src/lib/social/agent-config-service.ts` (May 1, 2026 — this session)
    - `src/lib/crm/company-service.ts` (May 1, 2026 — this session, monitor caught on `/companies` empty state)
    - `src/lib/crm/activity-service.ts` (May 1, 2026 — this session, monitor caught on `/activities`)
    - `src/lib/team/collaboration.ts` (May 1, 2026 — this session, monitor caught on `/tasks`)
    - `src/lib/social/social-post-service.ts` (May 2, 2026 — this session, monitor caught on `/social`)
    - `src/lib/social/listening-service.ts` (May 2, 2026 — this session, monitor caught on `/social/listening`)
    - `src/lib/social/engagement-metrics-collector.ts` (May 2, 2026 — this session, preemptive based on social-posts collection access)
    - `src/lib/agent/instance-manager.ts` — `storeActiveInstance`, `archiveInstance`, `notifyHumanAgents` (Apr 30)
    - `src/app/api/cron/workflow-entity-poll/route.ts` (Apr 30)
    - `src/app/api/crm/duplicates/merge/route.ts` (Apr 30)
    - `src/app/api/voice/call/route.ts`, `voice/twiml/route.ts`, `voice/ai-agent/route.ts`, `voice/ai-agent/speech/route.ts` (Apr 30)
    - `src/lib/agent/vector-search.ts` (Apr 30 — RAG read/write path on every /demo chat turn)
    - `src/lib/social/social-account-service.ts` (Apr 28)

    **Files still suspected** — `grep -l "from ['\"]@/lib/db/firestore-service['\"]" src` returns **102 hits** (run May 1, 2026). The page/hook/component hits are mostly correct (they run in the browser with auth context) and should NOT be touched. The server-side `lib/*` hits are the suspect set. Estimated **~50–60 server-side files** still on the wrong SDK. Triage rule: any `src/lib/**/*-service.ts` or `src/lib/**/*-engine.ts` that is imported by an `app/api/**/route.ts` or by a cron handler is a candidate.

    **Suspect server-side files (high-priority — services called from API routes):**
    - `src/lib/crm/*` — `activity-service`, `lead-service`, `deal-service`, `contact-service`, `company-service`, `quote-service`, `payment-service`, `invoice-service`, `lead-routing`, `duplicate-detection`
    - `src/lib/social/*` — `autonomous-posting-agent`, `social-oauth-service`, `social-post-service`, `listening-service`, `approval-service`, `engagement-metrics-collector`, `sentiment-analyzer`
    - `src/lib/email/*` — `email-template-service`, `campaign-service`, `email-sync`, `email-builder`
    - `src/lib/ecommerce/*` — `cart-service`, `product-service`, `tax-service`, `shipping-service`
    - `src/lib/integrations/*` — `integration-manager`, `oauth-service`, `gmail-sync-service`, `outlook-sync-service`, `calendar-sync-service`, `email-sync`
    - `src/lib/workflows/*` + `src/lib/workflow/*` — `workflow-service`, `workflow-engine`, `triggers/*`
    - `src/lib/training/*` — `golden-master-updater`
    - `src/lib/agent/*` — `chat-session-service`, `golden-master-builder`, `knowledge-processor-enhanced`
    - `src/lib/agents/*` — `outreach/voice/specialist`, `commerce/catalog/specialist`
    - `src/lib/ai/*` — `fine-tuning/vertex-tuner`, `fine-tuning/openai-tuner`, `fine-tuning/data-collector`, `learning/ab-testing-service`, `learning/continuous-learning-engine`
    - `src/lib/analytics/*` — `analytics-service`, `workflow-analytics`, `ecommerce-analytics`
    - `src/lib/middleware/tier-enforcement.ts`
    - `src/lib/meetings/scheduler-engine.ts`
    - `src/lib/notifications/notification-service.ts`
    - `src/lib/outbound/sequence-engine.ts`, `nurture-service.ts`
    - `src/lib/orchestrator/feature-toggle-service.ts`
    - `src/lib/team/collaboration.ts`
    - `src/lib/promotions/promotion-service.ts`
    - `src/lib/cache/cached-firestore.ts`
    - `src/lib/battlecard/competitive-monitor.ts`
    - `src/lib/compliance/tcpa-service.ts`
    - `src/lib/config/api-keys.ts`
    - `src/lib/ai/fine-tuning/*`

    **Files NOT to touch** (already correctly using Client SDK from browser context):
    - `src/app/(dashboard)/**/page.tsx` — dashboard pages
    - `src/app/profile/page.tsx`, `src/app/store/products/**/*page.tsx`
    - `src/hooks/*` — `useAuth`, `useUnifiedAuth`, `useUnifiedData`, `useRecords`
    - `src/components/AuthProvider.tsx`, `src/components/LookupFieldPicker.tsx`

    **The fix recipe (drop-in for most files).** `FirestoreService.get<T>` and `FirestoreService.set` have identical signatures to `AdminFirestoreService.get<T>` and `AdminFirestoreService.set`. Three-step swap per file:
    1. `import { FirestoreService } from '@/lib/db/firestore-service';` → `import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';`
    2. `FirestoreService.get<T>(...)` → `AdminFirestoreService.get<T>(...)` (same args)
    3. `FirestoreService.set(...)` → `AdminFirestoreService.set(...)` (same args)
    Type-check should stay green. *Caveats:* Admin SDK does not expose Firestore real-time listeners (`onSnapshot`) — if a server file uses one, it's actually a wrong place to listen, not a drop-in swap. Also, queries with custom `where` constraint constructors may need conversion; AdminFirestoreService's `getAll` already handles the common `where`/`orderBy`/`limit` shapes.

    **Verification per file.** After swapping, hit the route that calls the service and watch dev-server.log. The error monitor catches `Missing or insufficient permissions` and `7 PERMISSION_DENIED` — silence on first invocation = good. Don't claim done until the route has actually been exercised.

    **Effort estimate:** Sweep-by-grep + drop-in for ~50 files → roughly 3–5 hours including a smoke test per service. Some files will need real refactoring (any that mix client and server callers, or use `onSnapshot`). Add 1–2 hours of buffer for edge cases.

    **Why this is post-YC, not pre-YC:** Risk of touching 50+ files in the hours before YC submission far exceeds the cost of the current bug class. Page loads work; only certain *save-actions* silently fail. The whack-a-mole approach (live error monitor + fix-as-they-fire) is sufficient to keep the YC demo flow clean.

12. ~~Meeting cancel / reschedule UI on the dashboard~~ — **DONE May 1, 2026 in this session.** EventDetail panel in `UnifiedCalendarSection.tsx` now shows Cancel (two-step confirm) and Reschedule buttons for `meeting`/`booking` events. New `PATCH /api/meetings/[meetingId]` handler cancels the old Zoom meeting + creates a new one at the new time. New `RescheduleDialog` with datetime-local + duration inputs.

13. ~~Dashboard calendar month navigation~~ — **DONE May 1, 2026 in this session.** Custom toolbar built into `UnifiedCalendar.tsx` with prominent Prev / Today / Next buttons + view switcher (month / week / day / agenda). Replaces the small inline default react-big-calendar toolbar that operators were missing.

---

# 📋 POST-YC CORRECTIONS LIST — Bugs surfaced during May 1 walkthrough (fix-list for after submission)

Append-only list. Every bug surfaced during the YC walkthrough but NOT fixed in-session goes here so we have a clean punch list for May 2+ work.

## CRM hub display bugs

14. **`/calls` Call Log — Date column shows "Invalid Date" on every row** (May 1, 2026)
    - All 5 demo entries (John Smith / Rachel Lee / Peter Jones / Tina Wilson / David Kim) render `Invalid Date` in the Date column.
    - Likely cause: demo seed didn't write `createdAt` / `startedAt` in a parseable format, OR the UI is parsing an unexpected field shape (Firestore Timestamp vs ISO string vs `{ _seconds, _nanoseconds }`).
    - Fix path: Read `src/app/(dashboard)/calls/page.tsx`, identify which date field it's reading, normalize via a `toDate()` helper (same pattern as `src/app/api/analytics/workflows/route.ts:12-23`).
    - Then verify the demo seed writes the field correctly.

15. **`/calls` Call Log — Number column empty (`-`) on every row** (May 1, 2026)
    - Demo entries show `-` for the phone Number column.
    - Likely cause: demo seed doesn't populate `phoneNumber` / `to` / `from`, or UI is reading the wrong field.
    - Fix path: same as above — read the page component, identify the field shape, fix in seed or parser.

## Social publish bugs

17. **`/sms-messages` route is 404** (May 2, 2026)
    - Top-level URL `/sms-messages` returns 404. Settings sub-page exists at `/settings/sms-messages` (per `Glob` of `(dashboard)/settings/sms-messages/page.tsx`).
    - Fix path: either add a redirect from `/sms-messages` → `/settings/sms-messages`, or remove any nav references that point to the bare `/sms-messages` URL. Mirror the same pattern as `/sequences` → `/outbound/sequences` redirect that landed in this session.

16. **Bluesky publish — image > 2MB rejected as "blob too big"** (May 1, 2026)
    - Live error: `Invalid app.bsky.feed.post record: blob too big (maximum 2000000, got 2176583) at $.record.embed.images[0].image`
    - Root cause: `src/lib/integrations/bluesky-service.ts` uploads images without checking/compressing against Bluesky's 2 MB blob ceiling.
    - Fix path: Add image-size guard before upload. If > 1.95 MB, resize/recompress (sharp or browser-image-compression) until under the cap. Same fix should be applied at the unified-publish layer so all platforms get per-platform-cap enforcement.
    - Other platform limits to handle in same pass: Twitter/X (5 MB), Mastodon (10 MB default per instance), Instagram (8 MB), Threads (8 MB), LinkedIn (5 MB), Facebook (10 MB).

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
| ~~Marketing Manager `checkIntelligenceSignals` error~~ | ✅ FIXED May 7 — root cause was `s.value.affectedAgents.includes()` on legacy SignalEntry records missing the field. `memory-vault.ts:777-781` now defaults to `[]` when undefined or non-array. | — | DONE |
| Reddit dev app gate | New-account 24h gate blocked Apr 26 attempt | Medium | Wait + retry. After app, build REDDIT_EXPERT specialist + DM polling cron. |
| Bluesky outbound post fresh verify | Outbound code path exists; not re-tested under Jasper v13 | Low | Run `scripts/verify-bluesky-post-live.ts` or drive via Jasper prompt |
| Latency requirement (≤10s for inbound DMs) | Bluesky + Mastodon poll every 60s; X webhook would be instant if delivery worked | Medium | Webhook-style architecture for non-X platforms (Firestore listener bridge?) |
| Bug F | Only COMPETITOR_RESEARCHER — no INDUSTRY_RESEARCHER | Medium | Every "research our product" prompt scrapes competitors instead |
| Bug H | Zombie work after mission cancel/halt | Medium | `detect-zombie-work.ts` flags it |
| Bug L | Content Manager registers BLOG_WRITER / PODCAST_SPECIALIST / MUSIC_PLANNER but never invokes them | Medium | Audit all managers for unreachable specialists |
| `social_posts` composite indexes not deployed | `firestore.indexes.json` updated; needs `firebase deploy --only firestore:indexes` | Low | Code-level fix already shipped (queries no longer require composite); deploy is a perf optimization |
| Apollo Technographic Scout | Tries to scrape topic strings as URLs | Low | Errors but doesn't halt |

---

# 🟡 SPEC — SHOT-DOC LAYOUT VARIETY UPGRADE (Vertical #1 Video parity debt)

**Status:** SPEC ONLY (not started). **Logged as GAP-TO-CLOSE on the Video cert ledger (owner
decision Jun 22 2026)** — binding (Video cannot be certified until it's closed) but not the
immediate next task. Owner is on the Jun 22 2026 STOPGAP ("Option A" — accept a consistent
professional structure; content adaptation already works). See memory
`project_shot_doc_layout_parity_debt`.

## Problem (proven, not assumed)
The SHOT_PLAN_PLANNER GM authors a REAL `plan.layout` every time (it is a real LLM — an object-led
brief correctly produced cast:0 + a watch-specific artStyle), but the layout STRUCTURE is essentially
identical across briefs — same rows/blocks/order, only tiny widthWeight nudges (proven by
`scripts/diag-shot-plan-layout.ts`: watch vs people docs differ only by characters w6 vs w7). On
screen every shot doc looks like the same template. This does not meet the OpenArt Smart Shot bar.

## Research conclusion (deep-research, 104 agents, ~22 sources, adversarially verified — Jun 22 2026)
- **KEEP the structured planner + renderer. Do NOT switch to generating the sheet as an image.**
  Every serious layout system in the literature (LayoutGPT [NeurIPS'23], LayoutNUWA [ICLR'24],
  LayoutCoT [arXiv 2504.10829], MuLCO [CIKM'24], LaySPA [arXiv 2509.16891]) has an LLM author a
  STRUCTURED/serialized layout that a renderer paints — none generate the sheet as an image. Our
  architecture is the validated one.
- **OpenArt's actual mechanism is UNDISCLOSED** — only its models are public (GPT Image-2 + Seedance
  2.0). Do not assert they image-generate or structure the sheet; it is inference. Their Shot Plan is
  an editable, component-itemized, preview-before-render production sheet (consistent with structured).
- **The fixes for template-convergence are TRAINING-FREE and prompt/retrieval-level** (in priority):
  1. **Layout-aware exemplar RETRIEVAL feeding DIVERSE in-context examples** (LayoutCoT). This is the
     #1 move and is exactly the owner's instinct ("give it real examples, let it create its own").
     Our planner ALREADY supports vision few-shot (`layoutExamples`) — it is DISABLED (`LAYOUT_EXAMPLES = []`
     in `scripts/seed-shot-plan-planner-gm.js`). Re-enable it, driven by a curated diverse exemplar set,
     ideally selected per-brief by subject-type / layout similarity.
  2. **Verbalized Sampling** (arXiv 2510.01171, training-free): prompt the planner to emit a
     DISTRIBUTION of N candidate layout structures in one call (not one), then pick/curate — breaks
     single-mode convergence.
  3. **Serialize layouts as code/HTML** (LayoutNUWA) instead of bare numeric weights — harnesses the
     model's latent layout knowledge. Improves per-layout QUALITY; effect on diversity is unproven.
- **REFUTED theories — do NOT build on these:** "structured/JSON output itself causes diversity
  collapse" (refuted), "bare numeric weights / ignoring semantics is the CAUSE of our convergence"
  (refuted), "temperature alone fixes it" (refuted). The Verbalized Sampling "1.6–2.1x diversity"
  figure is from creative writing, NOT layouts — treat as unverified until we A/B it.

## Implementation phases (our code)
- **L0 — Loosen the renderer's homogenizing guardrails** (`ShotPlanDocument.tsx`): the renderer currently
  forces the floorplan to its own tall row + 1.6× width, floors the prompt row, and drops standalone
  notes/palette when a characters block exists. These FLATTEN whatever variety the AI authors. Reduce
  them to true usability FLOORS so the AI's authored rows/weights actually render. (Without this, even a
  varied `plan.layout` renders similar.)
- **L1 — Build a curated DIVERSE exemplar library.** A set of real, structurally-different shot-doc
  layouts (the 7 studied OpenArt sheets as TEXT/structure + our own best builds across subject types:
  single-human, ensemble, object-led, world-led, hero+object). Each = {subjectType/tags, layout JSON,
  optional rendered thumbnail}. Store under Storage/Firestore (the seed already references
  `organizations/rapid-compliance-root/layout-examples/`). Licensing: use our own builds + studied
  craft as text; do not bake copyrighted competitor images into the GM.
- **L2 — Re-enable vision few-shot with per-brief retrieval.** Populate `layoutExamples` (planner already
  consumes it). Start with subject-type-bucketed retrieval (classify the brief → human/object/world/
  ensemble → feed 2–3 DIVERSE exemplars from that bucket); upgrade to layout-similarity retrieval later.
- **L3 — Verbalized Sampling in the planner.** Have the planner emit N=3 candidate `plan.layout`
  structures with a self-rated fit score; auto-pick the best, OR surface them for the operator to choose.
- **L4 — (optional, quality) Code/HTML layout framing.** Evaluate emitting the layout as HTML in the
  prompt exchange; gate on the A/B below — only keep if it measurably helps.
- **Reseed** the SHOT_PLAN_PLANNER GM after any prompt change (Standing Rule #1 — Brand DNA via
  `brand-dna-helper`; layout exemplars are CRAFT, not Brand DNA).

## Verification (definition of done)
- Extend `scripts/diag-shot-plan-layout.ts` into an A/B harness: build briefs across all subject types,
  dump each `plan.layout`, compute a structural signature (row count + block-type sequence + weight
  buckets), and assert (a) DISTINCT signatures across subject types and (b) within-type variation.
- Visual review of the rendered sheets; owner sign-off that they look meaningfully different and good.
- A/B each lever (retrieval on/off, VS on/off, code-framing on/off) — keep only what measurably moves
  the structural-variety metric without hurting quality. Do not assume the research magnitudes.

## Open questions to resolve via internal A/B (no source settled these)
- Curated-diverse-static exemplars vs per-brief similarity-retrieved exemplars — which wins for OUR
  convergence failure mode (likely hybrid: retrieve layout-similar, then verbalized-sample N).
- Real diversity gain of Verbalized Sampling on LAYOUT generation specifically.
- Whether code/HTML framing increases DIVERSITY or only per-layout quality/alignment.

---

# 🟢 VIDEO PARITY CERTIFICATE — CAPABILITY MAP + GAP LEDGER (Jun 22 2026)

Benchmark (owner-confirmed): **OpenArt Smart Shot** (the shot-doc / storyboard craft — our Shot Doc
competes here directly) **+ Arcads** (delivered ad-style video — mostly orthogonal: a talking-head
UGC-ad factory). Cert rubric points #2 (capability map) + #3 (functional parity ledger). Mapped by
WHAT IT DOES FOR THE USER, not by label. Disposition: **Matched** (we have it, proven LIVE) ·
**Matched-unproven** (real code, needs a real-path proof per cert point #5) · **Gap-to-close** ·
**Declined** (their feature, deliberately not ours, with reason). Built from a code inventory + a
benchmark research pass (both reviewed; editor status corrected from the VP-E audit — the live editor
is `/content/video/editor` + `@/components/video-editor/*`, NOT the dead `EditorTimeline.tsx`).

## A. vs OpenArt Smart Shot (Shot Doc is our competing surface)
| OpenArt capability | Our equivalent | Disposition |
|---|---|---|
| One prompt → complete multi-cut video | brief → Screenwriter script → Shot Doc → per-shot clips → editor | **Matched** (LIVE end-to-end, proven `verify-video-e2e-no-stitch`) |
| Editable Shot Plan production sheet shown before render | Shot Doc, fully editable, manual + **per-field "Ask AI"** | **Matched + BETTER** (per-field surgical AI edit) |
| Per-shot breakdown: camera setup, shot type, mood/lighting | storyboard cards + look bible + lighting/mood blocks | **Matched + BETTER** (100+ cinematic presets) |
| Per-shot regeneration without re-rolling the sequence | per-shot regenerate + keyframe preview + Ask-AI | **Matched** |
| Character consistency across cuts | identity-locked reference images + last-frame chaining | **Matched-unproven** (re-anchoring needs a real cross-shot identity proof) |
| Reusable saved characters | Character Library (own characters/clones) | **Matched** |
| Reusable environments (Worlds) | Location Library + locked sets | **Matched** |
| Reference-image conditioning (≤3 refs) | references on plan/shots (no hard 3 cap) | **Matched + BETTER** |
| Auto camera moves (pan/push-in/orbit/dolly) | movement field + camera presets | **Matched** |
| Mood & lighting direction per shot | mood keywords + lighting swatches + per-shot accents | **Matched** |
| Export full video + export individual frames | editor export to library (LIVE) + per-shot keyframes/clips | **Matched** (full-frame still-download = minor Gap) |
| 3–5 distinct cuts, 10–20s | N shots per doc (operator-controlled count) | **Matched** |
| Models (GPT Image-2 + Seedance 2.0) | fal + Seedance (provider abstraction) | **Matched** (comparable stack) |
| **Description-fitting VARIED storyboard layout** | AI authors `plan.layout` but converges to one structure | **Gap-to-close** (the layout spec above). NOTE: OpenArt makes NO public layout-variety claim — this is OUR self-imposed quality bar, not a strict OpenArt table-stake. |

## B. vs Arcads (delivered UGC ad video — largely a DIFFERENT product)
| Arcads capability | Our equivalent | Disposition |
|---|---|---|
| Script → realistic talking actor (tight lip-sync, gestures) | lip-sync pipeline (ElevenLabs voice + sync model) | **Gap-to-close** — this is our accepted WEAK LINK (lip-sync in wide framing unproven; owner reviewing model picks) |
| Large stock AI-actor library (~300+, demographic filters) | Character Library (user's OWN characters) — seeded with a few STARTER characters + a **one-click "Add to Library" on every shot-doc character** (autofills the card + reuses the already-generated images) | **DECLINED-by-design + OUR approach** (Jun 22 2026 owner call): we do NOT copy a stock-actor catalog; instead every video grows the user's reusable cast from characters the system already generated. |
| Batch / bulk variation engine (CSV: hooks×actors×CTAs, parallel) | none | **DECLINED** (Jun 22 2026): different product — we're cinematic multi-scene, not a UGC-ad-variation factory. |
| 30+ language localization with re-synced lips | none | **Gap-to-close** (if pursuing UGC-ad parity) |
| Speech-to-speech (clone your own delivery onto an actor) | none (we have TTS/cloned-voice, not S2S transfer) | **Gap** (lower priority) |
| Vertical 9:16 + multi-platform aspect | aspect-ratio controls exist | **Matched-unproven** (per-shot aspect wiring incomplete) |
| One-click captions / music / transitions / B-roll | editor: text overlays + transitions + effects (LIVE) | **Matched** |
| Storyboard / multi-scene planning | full Shot Doc + multi-doc projects | **OUR EXTRA** (Arcads explicitly LACKS this) |

## C. OUR PROTECTED EXTRAS ("and more" — never strip to match a competitor)
Floor-plan **blocking diagram** (interactive, translates to camera-direction prompt language) ·
**per-field Ask-AI** surgical revision · **deep cinematic controls** (100+ presets across shot/camera/
lens/focal/lighting/look) · **timed script layer** (dialogue + SFX + on-screen text with per-line
timing, before render) · **multi-doc projects** (brief → segmented shot docs → editor assembly) ·
**continuity overlay** (per-shot character/costume/prop state) · **last-frame chaining** (continuity +
identity re-anchor) · **save-for-later + scrap + visible autosave** · our own **in-app editor**.

## D. OPEN GAPS SUMMARY (what blocks the Video cert)
1. **Layout variety** — Gap-to-close (specced above).
2. **Lip-sync quality** — accepted weak link; owner picking the Case-A model. Decide: close or formally decline-for-now.
3. **Real-path PROOFS still owed** (cert point #5): cross-shot character-identity consistency; editor export end-to-end; per-shot aspect ratio; cost-estimate accuracy vs real fal pricing. (These are Matched-unproven → must convert to LIVE.)
4. **Cert paperwork remaining:** the quality-vs-theirs grading per mapped capability (point #4), the named "one thing we beat them on" (point #7), and owner sign-off.

## E. OWNER DECISIONS — RESOLVED (Jun 22 2026)
- **Arcads stock-actor library + batch engine → DECLINED-by-design.** We operate differently and won't
  copy them. INSTEAD, build OUR approach (a gap-to-close on our Character-Library strength):
  1. **One-click "Add to my Library" on every character the system generates for a shot doc** (e.g. the
     BrightPath cast). Clicking it creates a saved Character-Library profile, AUTO-FILLING the card
     (name, role, age/gender/ethnicity/build/hair/wardrobe/etc. from the cast member) and REUSING the
     images already generated for the doc (hero + turnaround/model-sheet views) — no regeneration. There
     is already a `saveToLibrary` opt-in flag + `createAvatarProfile` plumbing to build on; this makes it
     an explicit per-character button on the shot doc, post-generation.
  2. **Seed the Character Library with a few STARTER characters** so it's never empty for a new user.
- **Lip-sync → DECLINED-FOR-NOW (documented weak link).** Video can certify without proven lip-sync;
  revisit after the Case-A model pick. (Consistent with the existing accepted-weak-link treatment.)
