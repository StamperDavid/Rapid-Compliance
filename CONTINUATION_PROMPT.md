# SalesVelocity.ai — Full-Orchestration Verification Plan

> **Updated:** April 26, 2026 (early morning).
> **Status:** Email + SMS + X organic posting + X DM webhook all wired and verified live. Twilio toll-free verification under review. **One architecture violation flagged for next session: inbound-social-dispatcher bypasses Jasper.** Disabled but not yet rebuilt.

---

# 🔴 SESSION RESUME — Read this first

Everything here overrides older sections. Do not ask the operator to remind you of anything in this block.

## TL;DR — where we are right now

- **Jasper orchestrator is at v12.** `orchestrate_campaign` tool deleted across the codebase (it violated Jasper's "interpret intent + delegate" rule). Multi-channel campaigns now plan as parallel `delegate_to_*` calls. 10-of-10 department delegations live.
- **Copywriter specialist is at v3.** Strict per-email length caps (`subjectLine` ≤ 80, `previewText` ≤ 120). Drift bug killed in 3/3 spot-check.
- **Email Specialist is at v2** with new `compose_outreach_sequence` action — coherent N-email cold drips personalized per prospect. Verified live (3-email sequence, narrative arc held, 103s).
- **Email pipeline live.** SendGrid + domain auth on `salesvelocity.ai` (5 CNAMEs + DMARC TXT in GoDaddy DNS). Live test sent + delivered to a real Gmail.
- **SMS pipeline plumbed but blocked.** Twilio account + key + phone `+18449553015` saved. **Toll-free verification was rejected**, was resubmitted with corrected business type, DBA, three sample messages per category, and a real CTIA-compliant opt-in URL `https://www.salesvelocity.ai/onboarding/industry`. **Currently under Twilio review** — "in progress" status.
- **CTIA SMS opt-in checkbox shipped on `/onboarding/industry`.** Renders only when phone is entered, full disclosure label, never auto-checked. Account creation POSTs to new `/api/onboarding/record-sms-consent` route which writes to `tcpa_consent` via adminDb.
- **X (Twitter) brand account fully wired.** `@salesvelocityai` exists, dev portal app approved with OAuth 2.0 + OAuth 1.0a credentials, profile polished, $25 of credits loaded with auto-reload. **Real test tweet posted** (status id `2048224495564202398`). X is purely pay-per-use now: $0.015/tweet, $0.20/tweet with URL.
- **X Account Activity webhook registered + verified.** `https://rapidcompliance.us/api/webhooks/twitter` validates CRC + verifies signatures, writes inbound events to `inboundSocialEvents` Firestore. Test DM + follow event both landed within seconds. Webhook id `2048240842830401536`.
- **🔴 Architecture violation in `inbound-social-dispatcher` cron.** It was built to auto-reply to DMs via direct OpenRouter call — bypasses Jasper entirely. Owner correctly rejected it. **Disabled in vercel.json.** File header rewritten to flag the violation. Do NOT re-enable.

## What's verified working vs what's pending

| Capability | Status |
|---|---|
| Jasper planning (right tools, right shape) | ✓ Matrix 242/245 (99%) at 5 iter |
| Plan approval + per-step approval gate | ✓ Verified via `scripts/verify-mission-execution-lifecycle.ts` |
| Specialist execution → deliverable in Firestore | ✓ Layer-1 sweep 36/39 (92%) post-fix |
| Workflow scheduling (emails fire on cadence) | ✓ workflow-001 + workflow-002 pass 2/2 |
| Email sending (real delivery to a real inbox) | ✓ Live test landed in Gmail |
| Outreach sequence generation (per-prospect cold drip) | ✓ 3-email arc generated in 103s |
| Outreach sequence dispatch on `lead_created` | ✓ Verified via `scripts/verify-sequence-outreach-wiring.ts` |
| X organic posting | ✓ Live test tweet posted |
| X DM webhook receipt | ✓ Two test events landed in Firestore |
| SMS sending | ✗ Blocked on Twilio toll-free verification (under review) |
| **DM auto-response via Jasper** | **✗ ARCHITECTURE VIOLATION — must build the proper Jasper-mediated path** |
| Customer X OAuth (Architecture A) | ✗ Requires X Basic tier $200/mo — defer to launch |
| X Ads (paid) | ✗ Separate Ads API approval queue — not started |
| Social platforms beyond X (LinkedIn, Meta, TikTok, YouTube, Bluesky, Reddit, Pinterest, Truth Social) | ✗ Code wired, account/OAuth setup pending |

---

# 🔴 STEP 0 — Automatic setup when this session opens (do without being asked)

1. **Read memory in this order** — ground truth:
   - `memory/MEMORY.md` (the index)
   - The session-handoff memory dated April 25-26
   - `memory/project_jasper_only_job_is_intent.md`
   - `memory/feedback_audit_against_jasper_rules_dont_assume_from_names.md`
   - `memory/feedback_finish_one_thing_before_moving_to_next.md`
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
   Expect: `jasper_orchestrator_v12`, `sgm_copywriter_saas_sales_ops_v3`, `sgm_email_specialist_saas_sales_ops_v2`.

6. **Tell the operator** "Ready. Monitor armed. Jasper v12 + Copywriter v3 + Email Specialist v2 confirmed active." — don't wait to be asked.

---

# 🔴 LEAD TASK NEXT SESSION — Build Jasper-mediated inbound DM auto-reply

The `inbound-social-dispatcher` cron route exists at `src/app/api/cron/inbound-social-dispatcher/route.ts` and is **disabled** (removed from vercel.json). Do NOT re-enable it as-is — it bypasses Jasper. Build the proper architecture instead.

## Correct architecture (build this)

```
X DM arrives
  ↓
/api/webhooks/twitter receives, verifies signature
  ↓
Stores raw event in inboundSocialEvents collection (already works)
  ↓
NEW dispatcher polls inboundSocialEvents (or Firestore listener)
  ↓
For each unprocessed DM event:
  - Build a synthetic user message for Jasper:
      "Inbound X DM from @<sender>: '<text>'. Plan a response."
  - Invoke Jasper via the same chat API path the UI uses
      (POST /api/orchestrator/chat with a system-flagged synthetic user)
  ↓
Jasper.propose_mission_plan
  ↓
Plan: delegate_to_marketing → Marketing Manager → X Expert specialist composes reply
  ↓
Reply lands in Mission Control as a step result
  ↓
Operator approves (or auto-approve when confidence threshold met)
  ↓
NEW tool `send_social_reply` (or specialist-internal call) sends reply via X DM API
  ↓
Mission completes. Conversation logged to CRM. inboundSocialEvent marked processed.
```

## What needs to be built

1. **Synthetic Jasper-trigger mechanism.** A way for non-user events (webhooks, cron) to invoke a Jasper mission with a pre-formed user prompt. Right now the `/api/orchestrator/chat` route requires an authenticated user session. Either:
   - Add a service-mode endpoint that accepts a synthetic event payload + a service token (rotate the cron's CRON_SECRET, plus a special header `x-synthetic-trigger: true` so we can audit it).
   - Or: have the dispatcher write directly to the `missions` collection with a pre-built plan in `PLAN_PENDING_APPROVAL` state. Less elegant but simpler.

2. **`send_social_reply` tool** (or `send_x_dm`). Add to JASPER_TOOLS. Args: `targetParticipantId`, `replyText`, `inboundEventId`. Executor calls X DM API via OAuth 1.0a User Context (the OAuth flow already exists in scripts/verify-twitter-post-live.ts and scripts/run-inbound-social-dispatcher.ts — copy that). Marks the source `inboundSocialEvent` as processed when the send succeeds.

3. **X Expert specialist GM update** — the Marketing department's X Expert specialist needs its Golden Master to know how to compose a DM reply that's brand-voiced, short (≤240 chars), context-specific. Operator-delegated GM edit per `feedback_delegation_vs_self_training`.

4. **Mission Control rendering** for inbound-DM missions. Should already work since they're just regular missions with steps, but verify the inbound DM context shows up in the step view so the operator can see the original message before approving the reply.

5. **A new dispatcher cron** that:
   - Polls `inboundSocialEvents` where `processed=false` AND `kind='direct_message_events'` AND no Mission has been created for it yet
   - Invokes the synthetic-Jasper-trigger
   - Marks the event as `mission_initiated` (separate flag from `processed`) so it doesn't re-fire while the mission is in progress

## Verification when done

- Send a fresh DM to `@salesvelocityai` from a different account
- Within 1-2 min: a new mission appears in Mission Control titled "Inbound X DM response"
- Plan: delegate_to_marketing (X Expert composes reply)
- Approve the plan
- Specialist composes a reply
- Approve the reply
- `send_social_reply` tool fires; the reply lands in the original sender's DM thread
- `inboundSocialEvent` is marked `processed: true` with the reply text + messageId

---

# THE ROADMAP — sequenced for single-tenant-done → multi-tenant

Multi-tenant conversion with a broken single-tenant loop is a nightmare. Order of operations is fixed:

## Stage A.6 — Inbound DM auto-reply via Jasper (NEXT SESSION, the lead task above)

## Stage B — Twilio toll-free SMS verification (under review by Twilio)

Owner has resubmitted with the corrected info + the new opt-in URL. Once approved, SMS sending unblocks. While waiting:
- **Verify** the SMS opt-in checkbox actually persists `tcpa_consent` end-to-end with a real account creation flow on the live deployed site
- **Build** SMS receive webhook (Twilio sends inbound SMS to a webhook on our app — same architectural decision as DMs: must go through Jasper, not auto-reply directly)

## Stage C — Connect remaining social accounts

Per the audit done last session: 11 platforms have wired code. X organic + DM ingest now live. Still pending:
- **Tonight-easy:** Bluesky (5 min), Reddit (30 min), Truth Social (30 min)
- **Day-1:** Meta (Facebook + Instagram + Threads via single Business Suite OAuth)
- **Mid-week:** Pinterest, YouTube, LinkedIn (RapidAPI fallback)
- **1-2 weeks:** TikTok app review (parallel-path now)

For EACH platform, the bar is: real post landed on the platform from the live system. Not "credentials saved."

## Stage D — Specialist GMs trained on each platform's organic + paid playbook

Each marketing-department specialist (X Expert, LinkedIn Expert, Facebook Ads Expert, etc.) needs platform-specific algorithm knowledge baked into its Golden Master. Operator-delegated GM edits, one specialist per session.

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
| **Architecture violations like the inbound-social-dispatcher** | **Final approve/reject on every edge case** |

**When Claude finds an orchestration failure:** fix it autonomously per CLAUDE.md guardrails. Do not interrupt the operator until either (a) a deliverable is ready for human review, or (b) all queued fixes are complete. **Architecture violations get DISABLED first, then surfaced to the operator with a proper rebuild plan — never papered over.**

---

# AUTOMATED TEST HARNESSES

**Existing:**
- `scripts/verify-prompt-matrix.ts` — 49 prompts, planning-layer coverage. Last: 242/245 at 5 iter.
- `scripts/verify-prompt-matrix-e2e.ts` — full mission-lifecycle E2E. Last Layer-1 sweep: 36/39 real pass post-fix.
- `scripts/verify-twitter-post-live.ts` — fires a real test tweet via OAuth 1.0a User Context.
- `scripts/verify-email-pipeline-live.ts` — fires a real email through SendGrid + sequence-scheduler.
- `scripts/verify-sequence-outreach-wiring.ts` — synthetic lead_created → real per-recipient sequence jobs.
- `scripts/check-twitter-inbound-events.ts` — read-only DM event inspector.
- `scripts/cleanup-test-data-recursive.ts` — preserves demo-* and isDemo:true; deletes everything else.

**To build next session:**
- Whatever harness proves the Jasper-mediated DM reply path works end-to-end. (Send a DM → mission appears → approve → reply lands in the sender's DM thread.)

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
| **inbound-social-dispatcher architecture** | Direct LLM auto-reply bypasses Jasper. Disabled in vercel.json. | **Critical** | **Lead task next session.** |
| Twilio toll-free SMS | Resubmitted with CTIA opt-in URL — under review | Medium | Owner waits on Twilio reviewer; nothing to do until response |
| campaign-001 flake | Jasper occasionally substitutes a second `delegate_to_content` for the outreach drip step | Low | Pre-existing, ~5% at 20 iter. Surgical PE edit candidate |
| Bug F | Only COMPETITOR_RESEARCHER — no INDUSTRY_RESEARCHER | Medium | Every "research our product" prompt scrapes competitors instead |
| Bug H | Zombie work after mission cancel/halt | Medium | `detect-zombie-work.ts` flags it |
| Bug L | Content Manager registers BLOG_WRITER / PODCAST_SPECIALIST / MUSIC_PLANNER but never invokes them | Medium | Audit all managers for unreachable specialists |
| FULL_PACKAGE timeout (closed?) | Was failing; classifier + parallelism fix shipped. Verify still clean on next sweep. | Low | Closed pending re-test |
| Apollo Technographic Scout | Tries to scrape topic strings as URLs | Low | Errors but doesn't halt |
| Cleanup script gaps | Doesn't yet touch every collection by default | Low | Extend when E2E runner produces new pollution shapes |
| `multi-004` planner shape | Jasper picks `delegate_to_content` instead of expected `produce_video` for video deliverables. **FIXTURE bug, not planner bug** per `feedback_jasper_delegation_is_always_correct.md`. Update fixture to accept `delegate_to_content`. | Low | Trivial fixture fix |
