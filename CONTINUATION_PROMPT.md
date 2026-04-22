# SalesVelocity.ai — Full-Orchestration Verification Plan

> **Updated:** April 22, 2026 evening — reflects current state after Jasper plan-fidelity rebuild + training-loop end-to-end verification.
> **Status:** Mission Control orchestration mechanically verified at 100% compliance. Ready for full automated coverage of campaign-class flows.

---

# 🔴 SESSION RESUME — Read this first

Everything in this section is the most recent state and overrides older sections where they conflict. Do not ask the owner to remind you of anything in here.

## TL;DR — where we are right now

- **Jasper's plan-step rule compliance is at 100%** verified across two prompts and 15 iterations (proven via `scripts/verify-jasper-plan-fidelity.ts`). Active GM is `gm_orchestrator_v6`.
- **Training loop closes end-to-end** for both Jasper (orchestrator) and specialists (e.g. BLOG_WRITER v2 deployed today from operator grade).
- **Intent classification** now goes through the LLM-backed Intent Expander (Haiku 4.5, GM-backed). The legacy regex classifier is RETIRED. queryType + tools come from one LLM call.
- **PromptRevisionPopup** opens INLINE on plan-edit/delete/reorder with line-diff highlighting and a prefilled rewrite textarea.
- **Standing rules preserved end-to-end:** every GM change still requires a human grade or plan correction; nothing self-improves silently.
- **44 of 45 specialists are clean** of the rule/competing-mention pattern that destroyed Jasper's compliance. Only Jasper had it; he's now fixed.
- **Prompt Engineer GM was upgraded** (`scripts/seed-prompt-engineer-gm.js`) so all FUTURE training automatically scrubs competing mentions when adding forbidden-X rules.

## What this session does

**Run the full automated orchestration verification plan** — see "THE PLAN" section below. Drive autonomously where mechanics are involved. Stop only when there's a deliverable that requires the operator's content-quality judgment.

---

# STEP 0 — Automatic setup when this session opens (do without being asked)

1. **Read memory in this order** — these are the ground truth:
   - `memory/MEMORY.md` (the index)
   - `memory/project_jasper_only_job_is_intent.md`
   - `memory/project_live_test_monitoring_setup.md`
   - `memory/project_manager_auto_review_disabled.md`
   - Any session-handoff memory dated April 22 if present

2. **Check `D:/rapid-dev/.next` cache.** If present and stale, `rm -rf D:/rapid-dev/.next` so HMR picks up clean.

3. **Check if a dev server is running on :3000.** If yes, leave it. If not, start it via direct node call (npm shim breaks stdio on Windows/Git Bash):
   ```
   cd "D:/rapid-dev" && node "./node_modules/next/dist/bin/next" dev > "D:/rapid-dev/dev-server.log" 2>&1
   ```
   Use `run_in_background: true`.

4. **Arm the expanded log monitor immediately.** Use Monitor tool, `persistent: true`, `timeout_ms: 3600000`. Filter:
   ```
   tail -f "D:/rapid-dev/dev-server.log" 2>/dev/null | grep -v --line-buffered -E "feature_config|entity_config|chrome.devtools|orchestrator/missions\?limit" | grep -E --line-buffered "Ready in|\[phase\]|\[llm\]|\[dfor\]|\[delegate\]|Detected content intent|Activating specialists|propose_mission_plan|LLM analysis failed|Step failed|halting mission|POST /api/orchestrator/chat|plan/approve|Intelligence insights|Skipping|Mission cancelled|newStatus=FAILED|newStatus=COMPLETED|createMissionWithPlan|PLAN_PENDING|FAILED_PRECONDITION|429 Too Many|rate.?limit|0 of 0 specialists| 5[0-9][0-9] in |TypeError|ReferenceError|Unhandled|SyntaxError|PlanEditTraining|prompt-engineer-agent|PROMPT_ENGINEER|BlogFeaturedImage|Passing intelligence research context|Blog post persisted|Query classified|queryType|conversational|advisory|Web Scraper.*Error|JasperGMService|JasperPlanFeedback"
   ```

5. **Verify supplementary monitors are running.** If any are missing, start them in background:
   - `npx tsx scripts/monitor-node-health.ts` — emits ALERT lines on memory/HTTP issues
   - `npx tsx scripts/track-api-costs.ts --tail` — emits `[cost-alert]` lines
   - `npx tsx scripts/detect-zombie-work.ts --tail` — emits `[zombie-alert]` lines

6. **Confirm Jasper GM v6 is active.** Quick check:
   ```
   node -e "const a=require('firebase-admin');a.initializeApp({credential:a.credential.cert(require('./serviceAccountKey.json'))});a.firestore().collection('organizations/rapid-compliance-root/goldenMasters').where('agentType','==','orchestrator').where('isActive','==',true).limit(1).get().then(s=>{const d=s.docs[0].data();console.log('active:',s.docs[0].id,'v',d.version,'len:',(d.systemPrompt||'').length);process.exit(0)})"
   ```
   Expect: `active: gm_orchestrator_v6 v v6 len: 44559` (or higher version if iterations have run since).

7. **Tell the operator "Ready. Monitor armed. Jasper v6 confirmed active."** — don't wait to be asked.

---

# THE ROLE SPLIT (binding for this plan)

| **Driven autonomously by Claude (mechanics)** | **Driven by operator (content + quality judgment)** |
|---|---|
| Did Jasper plan correctly? | Is the blog actually good? |
| Did the right specialists get invoked? | Does the video tone match the brand? |
| Did the workflow run end-to-end without errors? | Does the email copy convert? |
| Did deliverables land in the expected places? | Is the social post on-brand? |
| Did cleanup work between runs? | Does the campaign feel cohesive? |
| Are there hangs, retries, silent failures, zombie work? | Did the system understand WHAT the user wanted? |

**Workflow per feature:**
1. Claude runs an automated end-to-end orchestration test (one iteration; not 5 unless verifying compliance fix)
2. Claude reports mechanics: steps executed, errors, deliverable URLs/paths
3. **Operator reviews the actual deliverable**
4. **Operator grades it** — feeds the training loop
5. If MECHANICS broke: Claude fixes autonomously, re-runs, reports
6. If CONTENT QUALITY is bad: operator grades, system trains, re-run

**When Claude finds an orchestration failure:** fix it autonomously per CLAUDE.md guardrails (no eslint-disable, no @ts-ignore, no stubs). Notate the fix in the running session report. **Do not interrupt the operator until either: (a) a deliverable is ready for human review, or (b) you've completed all the orchestration fixes in your queue.**

---

# THE PLAN — full automated orchestration coverage

## Stage A: Finish the original 5-prompt QA pass

| # | Prompt | Tests | Deliverable for owner review |
|---|---|---|---|
| 3 | "Create a 60-second video explaining how SalesVelocity.ai helps small businesses automate their sales outreach." | Video pipeline (Hedra/Kling/Character Studio) | The video render |
| 4 | "Create a blog post AND 5 social media posts about the benefits of AI-powered lead scoring for B2B sales teams." | Multi-deliverable mission, parallel specialists | Blog at /website/blog + 5 social posts at /social/command-center |
| 5 | "Help me with marketing." | Advisory mode — should ASK clarifying question, NOT draft a plan | Jasper's chat reply |

**For each:** automate the chat call (mirror `scripts/verify-jasper-plan-fidelity.ts` pattern), capture the plan, verify mechanics, ping operator with the deliverable.

**Expected gotchas (already known):**
- **Bug F (memory):** Jasper has only `COMPETITOR_RESEARCHER`, no `INDUSTRY_RESEARCHER` — every "research our product" request scrapes competitors. May need an `INDUSTRY_RESEARCHER` specialist.
- **Bug H (memory):** zombie work after cancel — work continues post-terminal-state. Detected by `scripts/detect-zombie-work.ts`.
- Video pipeline (Hedra) writes to Firestore + costs API credits — see cleanup section.

## Stage B: Full campaign orchestration

Test the "do everything" prompt — one mission, multiple deliverable classes:

> "Launch a full campaign for our AI-powered lead scoring product targeting B2B sales teams: research the market, write a blog post, draft 5 social posts, create a 60-second video, and prepare a 3-email outreach drip."

**Verify:**
- Plan includes: delegate_to_intelligence, delegate_to_content, delegate_to_marketing, produce_video, delegate_to_outreach, create_campaign
- All steps run sequentially with proper handoff
- Intelligence output flows into BLOG_WRITER, social, video, email
- All deliverables persisted with correct campaignId
- No duplicate Apollo scans, no zombie work, no orphaned missions

**Operator review:** the deliverables together — does the campaign feel cohesive? Same voice across blog/social/video/email?

## Stage C: Individual feature pipelines

Test each in isolation with an automated harness:

| Pipeline | Single-prompt test | Pass criteria |
|---|---|---|
| Voice AI outreach | "Call this lead and qualify them" | voice_agent fires, transcript stored, no errors |
| E-commerce | "Create a product listing for X" | delegate_to_commerce, product persisted |
| Website builder | "Build me a landing page for X" | delegate_to_builder, page in Firestore |
| SEO | "Update SEO config for spring campaign" | get_seo_config + update path |
| Reputation management | "Respond to this review" | delegate_to_trust, response generated |
| Workflow engine | "Set up a workflow for new lead → email → wait 3 days → follow up" | workflow doc created |
| Forms | "Create a contact form for the homepage" | form persisted |
| SMS | "Send an SMS to this lead" | sms specialist, message persisted |

**Most of these are not yet exercised. Expect to find bugs.** Each gets one automated run, mechanics verified, deliverable surfaced for operator review.

## Stage D: Re-train + re-verify any failed flows

Each time the operator grades a deliverable as needing improvement:
1. Training loop captures correction
2. Specialist GM updated
3. Claude re-runs the same flow autonomously
4. Compares old vs new deliverable for the operator to judge if the training stuck

---

# CLEANUP DISCIPLINE — between runs

Run after every test that creates real artifacts:
```
npx tsx scripts/cleanup-qa-test-data.ts --yes
```

**What it cleans:** non-demo leads + terminal missions in the last 60 minutes.
**What it does NOT clean (yet):** test blog posts, test campaigns, test videos, test Hedra renders.

**For features that produce paid artifacts (Hedra videos, DALL-E images, Apollo enrichments):**
- Either skip them or accept the spend (operator confirmed this is OK)
- The Hedra/DALL-E renders WILL pile up in Firestore — extend `cleanup-qa-test-data.ts` to handle these too if they accumulate

**Test data identifiers:** look for `isDemo: false` (or absent) on records created during the session window.

---

# AUTOMATED TEST HARNESSES

Existing:
- `scripts/verify-intent-expander-behavior.ts` — 20 fixtures against the LLM expander
- `scripts/verify-jasper-plan-fidelity.ts` — N iterations of any prompt against active Jasper GM
- `scripts/audit-gm-conflicts.ts` — scans every active GM for rule/competing-mention conflicts

To build (Stage A-C):
- `scripts/verify-video-orchestration.ts` — fires a video request, captures plan, awaits Hedra completion, reports mechanics
- `scripts/verify-multi-deliverable.ts` — multi-deliverable mission, verifies parallel specialist execution
- `scripts/verify-advisory-mode.ts` — advisory prompts → assert NO plan drafted, just chat reply
- `scripts/verify-full-campaign.ts` — full-campaign orchestration, verifies all deliverable classes land

**Pattern to follow** (matches existing scripts): load active GM → call OpenRouter directly with same model + tools the chat route uses → parse the propose_mission_plan args → verify steps → report.

---

# MONITORING (gaps to be aware of)

The log monitor catches: server lifecycle, LLM calls, plan transitions, errors, manager activations, plan-edit training proposals, GM service writes.

It does NOT catch:
- Browser console errors (UI hydration, fetch failures from client) — operator must paste these
- Mission Control UI rendering bugs — operator must screenshot
- Node memory pressure (tracked separately by `monitor-node-health.ts`)
- API spend (tracked separately by `track-api-costs.ts --tail`)
- Zombie work after cancel/halt (tracked separately by `detect-zombie-work.ts --tail`)

**On first sign of UI-side misbehavior:** STOP guessing, ASK operator for browser console + screenshot.

---

# KNOWN OPEN ISSUES (carry-over)

| ID | Description | Severity | Where |
|---|---|---|---|
| Bug F | Only COMPETITOR_RESEARCHER exists — no INDUSTRY_RESEARCHER | Medium | Affects every "research our product" prompt |
| Bug H | Zombie work after mission cancel/halt | Medium | `detect-zombie-work.ts` flags it |
| query_docs returns nothing | The actual docs corpus is empty / query syntax mismatch | Medium | Step wastes time if Jasper still includes it |
| Apollo Technographic Scout | Tries to scrape topic strings as URLs | Low | Surfaced in 4/22 mission, errors but doesn't halt |
| Cleanup script gaps | Doesn't touch blog posts, campaigns, videos | Medium | Will pile up during testing |

---

# STANDING RULES (binding — never violate)

- **#1 (Brand DNA in GM):** every LLM agent's GM has Brand DNA baked in at seed time. Reseed via `node scripts/reseed-all-gms.js` after Brand DNA edits.
- **#2 (No grades = no GM changes):** GMs only change via human grade → Prompt Engineer edit → human approval → new version. Verified by `scripts/verify-no-grades-no-changes.ts`.
- **No eslint-disable, no @ts-ignore, no stubs.**
- **No silent guardrail bypasses.** Per memory: "if code can't pass cleanly, STOP and ask."
- **Commit per CLAUDE.md format.** Co-author: `Claude Opus 4.7 (1M context) <noreply@anthropic.com>`. Push to `dev`. Then sync into `D:/rapid-dev` via `git merge origin/dev --no-edit`. Never copy files between worktrees manually.
- **Jasper's only job is intent interpretation.** Every layer around him must serve that.

---

# EXPECTED OPERATOR INTERACTIONS DURING THIS SESSION

The operator will be pinged when:
1. A deliverable is ready for content-quality review (a blog, video, email, etc. landed and needs human judgment)
2. An orchestration question requires their decision (e.g. "video pipeline costs $0.50 per generation — proceed with 3 test runs?")
3. The full automated coverage completes — final report

The operator should NOT be pinged when:
- A trivial fix is being applied (size cap, typo, missing import)
- A re-run after fix is happening
- Cleanup is running
- An intermediate step is loading

---

# AT END OF SESSION

1. Write a session-handoff memory file under `memory/` summarizing:
   - What automated coverage was added
   - What flows passed mechanically (with iteration counts)
   - What failed mechanically and was fixed (with commit refs)
   - What deliverables are awaiting operator review
   - Any new known issues discovered
2. Update this CONTINUATION_PROMPT.md with the new state
3. Confirm everything is committed + pushed to `origin/dev` and synced into `D:/rapid-dev`
