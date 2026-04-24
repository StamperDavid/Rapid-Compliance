# SalesVelocity.ai — Full-Orchestration Verification Plan

> **Updated:** April 23, 2026 evening — Jasper v11 call-shape fix shipped, matrix regression at 99%. Plan now sequences E2E runner → account connections → true end-to-end testing → multi-tenant conversion.
> **Status:** Planning-layer verified at 242/245 (99%) across 49 matrix prompts. Execution layer not yet automated end-to-end.

---

# 🔴 SESSION RESUME — Read this first

Everything here overrides older sections. Do not ask the operator to remind you of anything in this block.

## TL;DR — where we are right now

- **Jasper orchestrator is at v11.** Call-shape rule deployed April 23 — `steps` is a native JSON array, `toolArgs` fields are native objects, never stringified. Fixed the reputation-001 bug (3/20 → 20/20 at 20 iter).
- **Intent Expander is at v2** (`sgm_intent_expander_saas_sales_ops`). LLM-backed, Haiku 4.5. Legacy regex classifier retired.
- **Prompt matrix is the regression suite.** 49 prompts across 19 categories in `scripts/fixtures/prompt-matrix.json`. Last full run: 242/245 (99%). Only residual flake is `campaign-001` (pre-existing, ~5% fail rate, unrelated to v11).
- **Mission Control rebuild M1–M8 is LIVE** — plan pre-approval, sequential auto-execute with retry, downstream-changed flag, manual edit, inline scrap, full training loop (grade → PE → deploy → rollback) all in Mission Control.
- **Training loop is end-to-end operational** — grade → Prompt Engineer proposes surgical edit → 3-box popup → approve → new GM version deployed → rollback available inline. 9 manager GMs + 37 specialist rebuilds + Prompt Engineer meta-specialist shipped.
- **Standing rules preserved:** every GM change still requires a human grade or explicit operator delegation. Nothing self-improves silently.

## What's been verified vs what hasn't

| Layer | Status |
|---|---|
| Jasper planning (right tools, right shape) | ✓ Verified via matrix, 99% at 5 iter |
| Plan approval + per-step approval gate | ✓ Verified via `scripts/verify-mission-execution-lifecycle.ts` |
| Specialist execution → deliverable in Firestore | ⚠️ Verified for some flows (blog, reputation-response), not all |
| External delivery (social post hits X, email hits inbox) | ✗ Blocked on OAuth account connections |
| End-to-end automation for regression testing | ✗ Blocked on E2E runner build (~2 hrs) |

---

# STEP 0 — Automatic setup when this session opens (do without being asked)

1. **Read memory in this order** — ground truth:
   - `memory/MEMORY.md` (the index)
   - Any session-handoff memory dated April 23 (midday + evening)
   - `memory/project_jasper_only_job_is_intent.md`
   - `memory/project_live_test_monitoring_setup.md`
   - `memory/project_manager_auto_review_disabled.md`

2. **Check `D:/rapid-dev/.next` cache.** If stale after a merge, `rm -rf D:/rapid-dev/.next`.

3. **Check if a dev server is running on :3000.** If yes, leave it. If not, start via direct node call (npm shim breaks stdio redirect on Windows bash):
   ```
   cd "D:/rapid-dev" && node "./node_modules/next/dist/bin/next" dev > "D:/rapid-dev/dev-server.log" 2>&1
   ```
   Use `run_in_background: true`.

4. **Arm the expanded log monitor immediately.** Filter spec is in `memory/project_live_test_monitoring_setup.md`. `Monitor` tool, `persistent: true`, `timeout_ms: 3600000`.

5. **Confirm Jasper v11 is active:**
   ```
   npx tsx scripts/dump-jasper-gm.ts | grep "GM id="
   ```
   Expect: `GM id=jasper_orchestrator_v11 version=v11 len=51618` (or higher if iterated since).

6. **Tell the operator "Ready. Monitor armed. Jasper v11 confirmed active."** — don't wait to be asked.

---

# THE ROADMAP — sequenced for single-tenant-done → multi-tenant

Multi-tenant conversion with a broken single-tenant loop is a nightmare. Order of operations is fixed:

## Stage A — Build the E2E runner (~2 hrs)

Fills the biggest gap: the matrix tests planning but not execution. The runner makes every matrix prompt a full "plan → approve → execute → deliverable" loop.

**Shape** (designed, not yet built):
- Firebase custom-token exchange for the operator's UID → ID token
- POST `/api/orchestrator/chat` with the prompt
- Poll Firestore for the mission hitting `PLAN_PENDING_APPROVAL`
- POST approve-all-steps + approve the plan
- Poll for terminal state (`COMPLETED` / `FAILED` / `AWAITING_APPROVAL` halt)
- Extract deliverable refs, write a JSON result file
- Fire-and-abort HTTP for the approve call (it blocks) with parallel Firestore poll
- 30-min timeout, cancel path, `AWAITING_APPROVAL` halt handling

Deliverable: `scripts/verify-prompt-matrix-e2e.ts`. Existing `verify-prompt-matrix.ts` stays as the fast planning-only regression.

## Stage B — Connect real accounts

### Social OAuth
Meta (FB+IG), LinkedIn, X. Each is ~5 min of dashboard work + existing OAuth scaffolding in the repo. Meta OAuth sub-platform split already shipped (commit `4fbd9ec7`).

### Email — **start this before social because it's slower**
Email connection has layers social doesn't have:

| Layer | Why it matters |
|---|---|
| OAuth (Gmail or Microsoft Graph / M365) | Agent reads inbox, sends, manages threads |
| Domain auth (SPF + DKIM + DMARC) | Skip = every campaign lands in spam |
| Deliverability warm-up | Can't cold-blast 1000 from a fresh account |
| Suppression + unsubscribe compliance | CAN-SPAM / GDPR / CASL — legally required |
| Bounce + complaint webhook | Sender reputation tanks if unhandled |

**Start email domain auth first** — DNS propagation + warm-up is days, not minutes. Social can be connected later in an afternoon.

## Stage C — Full matrix at E2E depth

Run the 49-prompt matrix through the E2E runner instead of the planning-only harness. Every prompt goes all the way to published / sent / posted (or a safe test destination). Expected output: a per-prompt E2E pass/fail plus deliverable URLs/paths.

## Stage D — Manual weekend prompt testing (operator)

Things the matrix can't judge: tone, brand voice, cohesion across deliverables, edge cases from real prospect interactions. Operator drives this with Jasper on localhost:3000, grades inline, training loop feeds back into GM versions.

## Stage E — Multi-tenant conversion (me)

Only after A–D are clean. The Penthouse single-tenant state gets re-tenantized:
- Re-add `organizationId` parameter throughout data access helpers (`getSubCollection` already uses `PLATFORM_ID` — flip that to a context variable)
- Re-enable multi-tenant firestore rules
- Per-tenant Brand DNA, per-tenant GM versioning (specialist GMs already keyed by industry — this is closer than it looks)
- Tenant provisioning + onboarding flow (owner clients purchase their own deployment)

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

**When Claude finds an orchestration failure:** fix it autonomously per CLAUDE.md guardrails. Do not interrupt the operator until either (a) a deliverable is ready for human review, or (b) all queued fixes are complete.

---

# AUTOMATED TEST HARNESSES

**Existing:**
- `scripts/verify-prompt-matrix.ts` — 49 prompts, planning-layer coverage, flags `--id`, `--category`, `--iterations`. Last result: 242/245 at 5 iter.
- `scripts/propose-matrix-corrections.ts` + `apply-matrix-corrections.ts` — automated grade → PE → deploy pipeline for matrix training targets.
- `scripts/diagnose-jasper-planning.ts` — deep-diagnostic for flaky prompts, dumps raw propose_mission_plan args.
- `scripts/verify-mission-plan-lifecycle.ts` — M4 plan editing (22 assertions).
- `scripts/verify-mission-execution-lifecycle.ts` — M3.6/M3.7 sequential execution + retry + halt + resume (32 assertions).
- `scripts/verify-upstream-changed-flag.ts` — M5 downstream flag propagation (14 assertions).
- `scripts/verify-prompt-edit-changes-behavior.ts` — proves PE edits change specialist output, not just GM bytes.
- `scripts/verify-no-grades-no-changes.ts` — Standing Rule #2 runtime proof.

**To build:**
- `scripts/verify-prompt-matrix-e2e.ts` — Stage A deliverable. Full plan → execute → deliverable verification for every matrix prompt.

---

# CLEANUP DISCIPLINE — between runs

```
npx tsx scripts/cleanup-qa-test-data.ts --yes
```

Cleans non-demo leads + terminal missions in the last 60 min. Does NOT yet touch test blog posts, campaigns, videos, or Hedra renders — extend when those start piling up during E2E runs.

Paid artifacts (Hedra videos, DALL-E, Apollo) — either skip in matrix or accept the spend (operator confirmed OK). Never confuse demo data (permanent, `isDemo: true`) with test data (ephemeral, session-scoped).

---

# MONITORING

Full filter spec + supplementary monitor scripts in `memory/project_live_test_monitoring_setup.md`. Arm the main Monitor on every dev server restart. Start `monitor-node-health`, `track-api-costs --tail`, `detect-zombie-work --tail` for live Mission Control testing; skip for background matrix runs.

**What the log monitor CAN'T catch:** browser console, UI rendering, node memory, API spend, zombie work. Those have dedicated scripts or require an operator screenshot.

---

# KNOWN OPEN ISSUES (current)

| ID | Description | Severity | Status |
|---|---|---|---|
| campaign-001 flake | Jasper occasionally substitutes a second `delegate_to_content` for the outreach drip step | Low | Pre-existing, ~5% at 20 iter, not a v11 regression. Surgical PE edit candidate. |
| Bug F | Only COMPETITOR_RESEARCHER — no INDUSTRY_RESEARCHER | Medium | Every "research our product" prompt scrapes competitors instead. |
| Bug H | Zombie work after mission cancel/halt | Medium | `detect-zombie-work.ts` flags it. |
| Bug L | Content Manager registers BLOG_WRITER / PODCAST_SPECIALIST / MUSIC_PLANNER but never invokes them | Medium | Owner flagged systemic — audit ALL managers for unreachable specialists before fixing individually. |
| Apollo Technographic Scout | Tries to scrape topic strings as URLs | Low | Errors but doesn't halt. |
| Cleanup script gaps | Doesn't touch blog posts, campaigns, videos | Medium | Extend when E2E runner starts producing them at volume. |

---

# STANDING RULES (binding — never violate)

- **#1 (Brand DNA in GM):** every LLM agent's GM has Brand DNA baked in at seed time. Reseed via `node scripts/reseed-all-gms.js` after Brand DNA edits.
- **#2 (No grades = no GM changes):** GMs only change via human grade → PE edit → human approval → new version. Verified by `scripts/verify-no-grades-no-changes.ts`. Operator-delegated grading pipelines (Claude driving PE end-to-end at explicit owner request) are NOT what this rule guards against — see `memory/feedback_delegation_vs_self_training.md`.
- **No eslint-disable, no @ts-ignore, no stubs.**
- **No silent guardrail bypasses.** If code can't pass cleanly, STOP and ask.
- **Commit per CLAUDE.md §5.** Co-author: `Claude Opus 4.7 (1M context) <noreply@anthropic.com>`. Push to `dev`. Then sync into `D:/rapid-dev` via `git merge origin/dev --no-edit` + `rm -rf .next`. Never copy files between worktrees manually.
- **Jasper's only job is intent interpretation.** Every layer around him must serve that.

---

# AT END OF SESSION

1. Write a session-handoff memory under `memory/` summarizing what shipped, what passed mechanically, what failed and was fixed, what deliverables await operator review, any new known issues.
2. Update this CONTINUATION_PROMPT.md with the new state — **update, don't pile on.**
3. Confirm everything is committed + pushed to `origin/dev` and synced into `D:/rapid-dev`.
