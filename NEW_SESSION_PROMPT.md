# Paste this into a new Claude Code window to start UI redesign work

---

You are starting a fresh session focused on UI redesign work for the SalesVelocity.ai Social Hub and Content Generator surfaces. This is intentionally separated from the backend session that closed yesterday (April 29, 2026). Backend is in a known-good state — do not audit or refactor backend code in this session.

## Step 0 — Ground yourself before doing anything else

Read these in order:

1. **`HANDOFF_UI_REDESIGN.md`** at the repo root — the full brief from the previous session. It captures:
   - Today's wins (so you don't try to re-fix what's working)
   - Specific design problems already audited (with file:line refs)
   - Architectural decisions already made (so you don't re-litigate)
   - What NOT to do
   - Concrete first actions

2. **`CLAUDE.md`** — project standing rules (engineering standards, design system compliance, hooks, etc.)

3. **`memory/MEMORY.md`** — auto-memory index. Skim for context on the operator's preferences, recent session handoffs, and the system's history.

4. **`memory/project_live_test_monitoring_setup.md`** — when you watch the dev server during operator-driven UI tests, use the **Apr 29 evening updated filter** (includes `[ToolTrace]`).

## Step 1 — Verify working environment

Run these in parallel before talking to the operator:

- `git status` — should be clean, branch `dev`
- `git log --oneline -5` — most recent commit should be `51e6980a` or later
- Check if dev server is running on port 3000 — if not, start it via the standard direct-node-call pattern (per the live-test monitoring memory)
- Confirm Jasper Golden Master is at v13: `npx tsx scripts/dump-jasper-gm.ts | grep "GM id="`

## Step 2 — Tell the operator you're ready

Once setup is confirmed, surface your understanding back to them concisely:

> "Read the handoff. I see [content/no hub page, image generator stub, video tabs sibling-positioned, etc]. Backend is healthy and not in scope. First move per the handoff is to drive a real UI test together so I can capture friction points before we redesign — want to do that, or do you have a specific issue you want to tackle first?"

Then wait for their direction.

## Working model

- The operator is your dev team partner, not a hands-off PM. Discuss before redesigning.
- "Code change vs AI training" framing applies: when something looks wrong, identify which fix path applies before doing.
- Compare to known competitors when relevant: Buffer / Hootsuite / Sintra (closest competitor) for social, Linear / Notion for command-bar UX patterns.
- ONE chat-panel component, not N per hub. Linear pattern.
- Don't propose Patreon / Substack / Snapchat / Kick / Reddit / Telegram / Truth Social — see the platform viability matrix in memory.
- Don't make commits unless explicitly asked.
- Don't re-test backend integrations that the previous session verified — assume X / Bluesky / Mastodon orchestrated post + outreach compose work end-to-end.

## Hard guardrails

- **No Standing Rule #2 GM edits** — this is a UI session, not a training session.
- **No Brand DNA reseeds** — Standing Rule #1 stays put.
- **No reverse engineering of fixes from the prior session** — if you find a backend bug, log it, don't fix it.
- **No commits until explicitly requested.**
- **No mocking** — if something needs real data, surface it; don't fabricate.

## Quick context the operator may reference

- Brand: **SalesVelocity.ai** (URL migrated April 28, 2026 from rapidcompliance.us)
- Operator email: dstamper@rapidcompliance.us
- Multi-tenant flip target: week of May 4-10, 2026
- TikTok app submission: still pending (icon, demo video, scopes — operator's task)
- Three live brand social accounts with images attached: @salesvelocityai (X), @salesvelocity.bsky.social (Bluesky), @SalesVelocity_Ai on mastodon.social — those last live posts from Apr 29 evening are demo-quality and can be screenshot for TikTok submission material
- Dev server: lives in `D:/rapid-dev` worktree on port 3000; primary worktree is `D:/Future Rapid Compliance`

## What's queued for after this redesign session

These are NOT yours to handle in this session — just so you know what's coming:
- Watermarking + character-reference image pipeline for social-post images (separate work, ~2-4h)
- Real Hedra render test on `produce_video` (real Hedra spend ~$5-15)
- DM dispatcher architecture decision (rebuild vs codify the scoped exception)
- Specialist expansions (newsletters, carousels, shorts, captions, press releases, personality)
- Translation / localization wiring
- Multi-tenant flip itself

---

That's the full briefing. Read the handoff doc, verify environment, surface your understanding to the operator, then start on the first concrete move they direct you to.
