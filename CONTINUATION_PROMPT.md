# SalesVelocity.ai — Full-Orchestration Verification Plan

> **Updated:** April 24, 2026 afternoon — E2E runner shipped, Content Manager EMAIL_SEQUENCE rebuild (Option B) shipped, `create_workflow` gap discovered and queued as next session's lead task.
> **Status:** Planning-layer 99% clean. Execution-layer Layer-1 sweep at 22/24 real pass. Workflow scheduling (`create_workflow` tool) is the only remaining blocker on the nurture/drip/newsletter features.

---

# 🔴 SESSION RESUME — Read this first

Everything here overrides older sections. Do not ask the operator to remind you of anything in this block.

## TL;DR — where we are right now

- **Jasper orchestrator is at v11.** Call-shape rule + parser hardening keeps `propose_mission_plan` clean. reputation-001 fixed 3/20 → 20/20.
- **Copywriter specialist is at v2.** New `generate_email_sequence` action ships N-email sequences with subject/preview/body/cta/timing. Shipped April 24 along with the Content Manager EMAIL_SEQUENCE intent routing — the 10-minute FULL_PACKAGE hang on `contentType="email_sequence"` is gone.
- **Intent Expander is at v2** (`sgm_intent_expander_saas_sales_ops_v2`). LLM-backed, Haiku 4.5.
- **Prompt matrix + E2E runner are both live.** `scripts/verify-prompt-matrix.ts` tests planning (242/245 at 5 iter). `scripts/verify-prompt-matrix-e2e.ts` drives plan → approve → execute → deliverable extraction against the live dev server (22/24 real pass on the Layer-1 sweep).
- **Mission Control rebuild M1–M8 is LIVE.** Plan pre-approval, sequential auto-execute with retry, downstream-changed flag, manual edit, inline scrap, full training loop (grade → PE → deploy → rollback) all in Mission Control.
- **Training loop is end-to-end operational.** 9 manager GMs + 38 specialist rebuilds + Prompt Engineer meta-specialist shipped.
- **Standing rules preserved.** Every GM change still requires a human grade or explicit operator delegation. Nothing self-improves silently.

## What's been verified vs what hasn't

| Layer | Status |
|---|---|
| Jasper planning (right tools, right shape) | ✓ Verified via matrix, 99% at 5 iter |
| Plan approval + per-step approval gate | ✓ Verified via `scripts/verify-mission-execution-lifecycle.ts` |
| Specialist execution → deliverable in Firestore | ✓ Layer-1 sweep 22/24 real pass (advisory, factual, conversational, reputation, forms, adversarial all 100%; workflow blocked on create_workflow) |
| Workflow scheduling (emails fire on cadence) | ✗ **Blocked on `create_workflow` tool being unimplemented — next session's lead task** |
| External delivery (social post hits X, email hits inbox) | ✗ Blocked on OAuth account connections (operator's parallel track) |
| End-to-end automation for regression testing | ✓ E2E runner shipped (`scripts/verify-prompt-matrix-e2e.ts`) |

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

5. **Confirm Jasper v11 + Copywriter v2 are active:**
   ```
   npx tsx scripts/dump-jasper-gm.ts | grep "GM id="
   npx tsx scripts/dump-copywriter-gm.ts | grep "GM id="
   ```
   Expect: `GM id=jasper_orchestrator_v11 version=v11` and `GM id=sgm_copywriter_saas_sales_ops_v2 version=2` (or higher).

6. **Tell the operator "Ready. Monitor armed. Jasper v11 + Copywriter v2 confirmed active."** — don't wait to be asked.

---

# THE ROADMAP — sequenced for single-tenant-done → multi-tenant

Multi-tenant conversion with a broken single-tenant loop is a nightmare. Order of operations is fixed:

## 🔴 Stage A.5 — Build the `create_workflow` tool (NEXT SESSION, ~2-3 hrs)

**The only blocker left on the nurture/drip/newsletter features.** Jasper's prompt references `create_workflow` as a required step for any cadence-based email sequence, but the tool was never implemented. `workflow-001` and `workflow-002` halt at step 2 with `"Unknown tool: create_workflow"`.

### What "done" looks like
- Tool schema in `src/lib/orchestrator/jasper-tools.ts` (name, parameters: trigger, cadence/steps, contentSource, sequenceType, optional conditions)
- Executor case handler that validates args, writes a `workflow` record to Firestore with enough detail for a scheduler to fire each email at the right time, returns `{ status, workflowId, reviewLink }`
- Workflow data model in `src/types/workflow.ts` (or extend existing)
- Persistence via `getSubCollection('workflows')`
- **Scheduler that actually fires the emails on schedule** — check `src/lib/workflow-engine/` (if it exists) or stand up a cron/queue. Owner was explicit: "not faking or ignoring."
- Integration with `send_email` or `delegate_to_outreach` for the actual per-recipient delivery when the cadence hits
- Update workflow-001 / workflow-002 matrix fixtures to expect `create_workflow` (already expected — these prompts just fail today) — no fixture change needed, just verify
- E2E verification: `npx tsx scripts/verify-prompt-matrix-e2e.ts --category=workflow --iterations=1` must pass 2/2 with COMPLETED status on both

### Out of scope for Stage A.5
- Building a fancy visual workflow editor UI
- Supporting non-email workflow node types (SMS, voice calls, conditional branches) — keep the first version email-only
- Webhook-triggered workflows from third-party systems
- A/B testing or multi-variant scheduling
- Reseeding the Copywriter or Jasper GMs (the prompts already reference `create_workflow` correctly)

### Standing rules to respect
- **Rule #1 (Brand DNA baked into GM):** no Brand DNA work here; this is a code+tool build, not a prompt edit.
- **Rule #2 (no grades = no GM edits):** this session does not edit any active GM. If a GM edit becomes necessary (e.g. to adjust Jasper's prompt about workflow usage), that's a separate scope.
- **No eslint-disable, no @ts-ignore, no stubs.** If the workflow engine doesn't exist yet, write it for real — do not fake a "workflow scheduled" response without real scheduling.

## Stage A — E2E runner (DONE April 24)

`scripts/verify-prompt-matrix-e2e.ts` drives the full mission loop: Firebase custom-token → chat POST → Firestore poll for PLAN_PENDING_APPROVAL → approve-all → approve (fire-and-abort) → terminal state poll → deliverable extraction. Flags: --id, --category, --categories, --exclude-categories, --iterations, --timeout.

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
- `scripts/verify-prompt-matrix.ts` — 49 prompts, planning-layer coverage. Last: 242/245 at 5 iter.
- `scripts/verify-prompt-matrix-e2e.ts` — full mission-lifecycle E2E (auth → plan → approve → execute → deliverable). Last Layer-1 sweep: 22/24 real pass.
- `scripts/propose-matrix-corrections.ts` + `apply-matrix-corrections.ts` — automated grade → PE → deploy pipeline.
- `scripts/diagnose-jasper-planning.ts` — deep-diagnostic for flaky prompts.
- `scripts/dump-jasper-gm.ts` + `scripts/dump-copywriter-gm.ts` — read-only utilities for auditing the active GMs.
- `scripts/verify-mission-plan-lifecycle.ts` / `verify-mission-execution-lifecycle.ts` / `verify-upstream-changed-flag.ts` — M3-M5 infrastructure.
- `scripts/verify-prompt-edit-changes-behavior.ts` — behavioral proof that PE edits change output.
- `scripts/verify-no-grades-no-changes.ts` — Standing Rule #2 runtime proof.

**To build next session:**
- The `create_workflow` tool itself + its Firestore persistence + its scheduler (see Stage A.5 above).

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
| `create_workflow` unimplemented | Jasper's prompt tells him to call it for cadence-based sequences; tool was never built | **High** | **Lead task for next session (Stage A.5).** |
| campaign-001 flake | Jasper occasionally substitutes a second `delegate_to_content` for the outreach drip step | Low | Pre-existing, ~5% at 20 iter. Surgical PE edit candidate. |
| Bug F | Only COMPETITOR_RESEARCHER — no INDUSTRY_RESEARCHER | Medium | Every "research our product" prompt scrapes competitors instead. |
| Bug H | Zombie work after mission cancel/halt | Medium | `detect-zombie-work.ts` flags it. |
| Bug L | Content Manager registers BLOG_WRITER / PODCAST_SPECIALIST / MUSIC_PLANNER but never invokes them | Medium | Audit all managers for unreachable specialists before fixing individually. |
| Logo save-to-theme-editor bug | Homepage logo didn't persist to theme editor | Low | Operator flagged April 24. |
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
