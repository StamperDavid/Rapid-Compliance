# Paste this at the start of the next fresh-context session

---

Continue from the Apr 25-26 overnight session. Read these in order before doing anything:

1. `memory/MEMORY.md` (the index)
2. `memory/project_session_handoff_apr25_overnight.md` (full handoff)
3. `memory/project_jasper_only_job_is_intent.md` (the standing rule that was just violated)
4. `memory/feedback_audit_against_jasper_rules_dont_assume_from_names.md` (why I caught it last time)
5. `memory/feedback_finish_one_thing_before_moving_to_next.md`
6. `memory/project_live_test_monitoring_setup.md` (arm the monitor immediately)
7. `CONTINUATION_PROMPT.md` (project-level state, lead task block at the top)

Then run STEP 0 from CONTINUATION_PROMPT.md without being asked: start the dev server if needed, arm the four monitors, confirm Jasper v12 + Copywriter v3 + Email Specialist v2 are active, and report ready.

## The lead task

Last session built an `inbound-social-dispatcher` cron at `src/app/api/cron/inbound-social-dispatcher/route.ts` that auto-replies to inbound X DMs by calling OpenRouter directly. That bypasses Jasper, which violates his core "interpret intent + delegate" rule. The cron is disabled in vercel.json. **Do not re-enable it.**

Build the correct path:

1. Webhook receives DM → stores in `inboundSocialEvents` (already works — `src/app/api/webhooks/twitter/route.ts`)
2. New dispatcher polls unprocessed DM events and invokes Jasper via a "synthetic trigger" mechanism (build this — service-mode endpoint or direct mission-doc write)
3. Jasper's `propose_mission_plan` → `delegate_to_marketing` → Marketing Manager → X Expert specialist composes the reply
4. Reply lands in Mission Control as a step result for operator review
5. New `send_social_reply` tool (build this in JASPER_TOOLS) sends the approved reply via the X DM API using OAuth 1.0a User Context
6. Source `inboundSocialEvent` marked processed with reply text + messageId

Acceptance: send a fresh DM to `@salesvelocityai` from a different account → within 1-2 min a mission appears in Mission Control → operator approves → reply lands in the sender's thread.

The OAuth 1.0a header builder + DM send code already exists in `scripts/run-inbound-social-dispatcher.ts` and the disabled route — copy from there, do not rebuild.

The X Expert specialist's Golden Master will need an edit to add a DM-reply playbook (short, brand-voiced, ≤240 chars, context-specific). Operator-delegated GM edit per `feedback_delegation_vs_self_training`.

## Open environmental items

- **Twilio toll-free verification** is under review — owner waits on Twilio. Don't try to send SMS until status flips to "verified."
- **SendGrid** is fully wired with salesvelocity.ai domain auth — emails deliver to Gmail Updates today.
- **X organic posting** is verified — `https://x.com/salesvelocityai/status/2048224495564202398` is live.
- **X DM webhook receipt** is verified — `inboundSocialEvents` collection contains 2 test events.
- **Jasper v12** is the active orchestrator GM; **Copywriter v3** and **Email Specialist v2** are the active specialist GMs.

## Constraints

- No `eslint-disable`, no `@ts-ignore`, no stubs, no NOT_WIRED returns.
- Do not edit Jasper's GM unless the operator explicitly delegates the edit. Standing Rule #2.
- Architecture audit before adding any new orchestrator-layer tool — read the case handler, verify it delegates rather than does work, surface conflicts to the operator. See `feedback_audit_against_jasper_rules_dont_assume_from_names.md`.
- When asked to simplify or summarize, plain prose under 6 lines. No tables, no headers in summaries.
- Finish each integration completely before moving to the next. "Done" means real-world verified, not credentials saved. See `feedback_finish_one_thing_before_moving_to_next.md`.

HEAD on origin/dev at start of next session: latest commit including this prompt + the disabled dispatcher + updated SSOT and CONTINUATION_PROMPT.md.
