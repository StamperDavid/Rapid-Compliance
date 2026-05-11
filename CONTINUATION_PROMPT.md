# SalesVelocity.ai — Full-Orchestration Continuation Prompt

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
