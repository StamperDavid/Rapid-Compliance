# Handoff: Content Generator + Social Hub UI Redesign

> **Created:** April 29, 2026 (late evening, after a long session)
> **Branch:** dev (HEAD `e288ab53`, main is at the same commit)
> **For:** A fresh Claude Code context window picking up UI redesign work

---

## Where we are coming in

Today (Apr 29) closed a major fake-AI sweep across the system. ~15 patterns found and fixed (managers fabricating numbers, specialists wearing AI costumes without LLM calls, tool stubs returning canned responses, dashboard hardcoded data, dead-end Firestore writers, misleading verify scripts). Plus end-to-end product-path validation: real social posts (with images) landing on X/Bluesky/Mastodon driven through Jasper chat → plan → approve → execute.

**Backend orchestration is healthy.** The remaining work is UX/UI — and during testing the operator surfaced specific design issues with the Content Generator and Social Hub that warrant a redesign rather than patching.

This handoff is for that redesign work. It is intentionally not for backend bugs.

## What you should NOT do in this session

- **No backend agent / specialist / GM edits.** Backend is in a known-good state. Don't audit, don't refactor, don't wire new tools. If you find a backend bug while doing UI work, log it and move on.
- **No Standing-Rule-#2 GM changes.** Today fixed a lot; don't reseed agents.
- **No premature commits.** Operator commits explicitly when satisfied.
- **No new chat panels per hub.** ONE reusable chat-panel component, scoped by where it's invoked. (Linear-style universal command bar pattern.) See decisions below.

## Operator's stated frustrations (the design problems)

1. **"How messed up the Content Generator is."** Confirmed by audit:
   - **No `/content/` hub page exists.** No top-level surface to open into.
   - **Image Generator is 16 lines of stub:** literally imports the video studio's `StudioModePanel` and renders it standalone. No image-specific UI, no image library, no history. File: `src/app/(dashboard)/content/image-generator/page.tsx`.
   - **`CONTENT_GENERATOR_TABS` (`src/lib/constants/subpage-nav.ts:188`) mixes tools and video-sub-pages as siblings:**
     ```
     Video (tool)         /content/video
     Calendar (video!)    /content/video/calendar
     Image (tool)         /content/image-generator
     Editor (video!)      /content/video/editor
     Library (video!)     /content/video/library
     Audio Lab (tool)     /content/voice-lab
     ```
     Calendar/Editor/Library are video-sub-pages presented as first-class peers to the other tools. UX smell.
   - **The "Create with AI" button is a navigation link to AI Workforce.** It should be an embedded chat panel scoped to Content Manager.

2. **"Why is the content calendar in the Content Generator rather than the Social Hub?"**
   The answer: **the actual unified social content calendar already exists at `/social/calendar`** (file: `src/app/(dashboard)/social/calendar/page.tsx`). It's a real big-calendar with month/week/day views, platform/status filters, click-to-detail. It works.

   The "Calendar" in the Content Generator nav points to `/content/video/calendar` — which is a *video-production batch scheduler* (week-by-week BatchProject docs for the video pipeline). Different beast. Same label = confusing.

   Recommendation: rename the Content Generator's "Calendar" tab to "Video Schedule" or remove it from the nav entirely (it lives under Video anyway).

3. **"Social Hub layout/design needs redesign too."**
   Operator hasn't given specifics yet. Drive a real test of the Social Hub via the live dev server (operator-driven, screen capture / screenshots) to surface specific friction. Then redesign based on real friction, not abstract "good practices."

## Decisions already made about the redesign (carry these forward)

These were debated and settled in the previous session. Don't re-litigate.

### "Create with AI" button
- **Architecture: Option B — Jasper-with-scope-hint** (the light path).
- Button opens an **embedded chat panel inside the page** (not navigation away).
- Chat hits the existing `/api/orchestrator/chat` route with a new `scope` param.
- Jasper still plans, but is constrained to the relevant department's tools only via a system-prompt scope directive.
- **Content Generator → scope=content** → Content Manager's tools (blog/video/audio/image/etc).
- (Future) Social Hub → scope=marketing → Marketing Manager's tools.
- ~1 day: chat-panel UI is the bulk; backend = small param pass-through.

### Content Library (`/content/library` — does NOT exist yet)
- **MVP (~3-4 days):** single page aggregating blog drafts (from blog collection) + video pipeline projects + missions with content-shaped step outputs (social posts, emails) + brand assets. Unified timeline, type badge, "View" → routes to original surface.
- **No tags/search/reuse/versions in MVP.** Just unified visibility.
- v2 (1-2 weeks): tagging, search, "duplicate as new", folders. Separate task.

### One chat-panel component, not N
- Linear-style universal pattern: one `<ScopedChatPanel>` component, props that scope it (which manager, what context, what page invoked it).
- Don't build separate chat panels per hub. Re-use the same component everywhere.

### Specialist expansions (no new agents — extend existing)
These are NOT for this UI session, but they'll affect what content types the chat panel can produce. Captured as tasks #39, #40 in the previous session's task list.

| Existing specialist | Future extension |
|---|---|
| EMAIL_SPECIALIST | newsletters / email campaigns (broadcast) |
| Each platform specialist | carousel post format (LinkedIn/IG) |
| VIDEO_SPECIALIST | short-form / Reels / Shorts + captions |
| BLOG_WRITER | press releases / case studies |
| Content Manager | personality upgrade (playful/casual mode for memes/punchy) |

### Translation
Deferred until international tenants exist (post multi-tenant flip, week of May 4-10). When editing specialist GMs, structure prompts so `language` is a first-class arg.

## Concrete first actions for this session

1. **Read `src/lib/constants/subpage-nav.ts`** — understand the current tab structure across hubs (Content Generator, Social Hub, etc).
2. **Read `src/app/(dashboard)/content/image-generator/page.tsx`** — confirm it's the 16-line stub (it is).
3. **Read `src/app/(dashboard)/social/page.tsx`** — understand what the Social Hub looks like today.
4. **Read `src/app/(dashboard)/social/calendar/page.tsx`** — see what the existing social calendar looks like (good).
5. **Drive a Test 1 walkthrough** with the operator — they paperclip-attach an image, prompt Jasper to post to all 3 platforms. You watch logs (filter spec in `memory/project_live_test_monitoring_setup.md` — make sure you use the Apr 29 evening updated filter that includes `[ToolTrace]`).
6. **As you watch, capture specific UX friction points** — get the operator to screenshot anything that looks off. Build a punch list.
7. **Then design** based on the punch list, not abstract principles.

## Repository state cheatsheet

- Branch: dev, HEAD `e288ab53`
- Main branch: synced to dev
- Worktrees: primary at `D:/Future Rapid Compliance` (this), running dev server at `D:/rapid-dev` on port 3000
- Server log: `D:/rapid-dev/dev-server.log`
- Auth: Firebase login expired in this terminal — `firebase deploy` won't work without `firebase login --reauth`
- Today's commits (chronological):
  - `6e707940` — Video tools wired + X OAuth 1.0a + connected-platforms gating + dashboard labels
  - `bdb443a5` — Manager fakery fixes (Revenue/Reputation/Commerce/Voice + orphan crons)
  - `fddde4e5` — Product-path social-post verifies (X/Bluesky/Mastodon, shared driver)
  - `5941f132` — Bulk fake-AI cleanup (47 files: managers, specialists, tools, admin/stats, 33 verify renames)
  - `75843709` — Dead writer deletions + honest verify headers
  - `5d216389` — Verify-script field-name extractors fixed (after live tests passed)
  - `af6c5d78` — Media-upload wired across X/Bluesky/Mastodon (the "image attached" fix)
  - `e288ab53` — firestore.indexes.json: missions + socialPosts composite indexes added (deploy still pending)

## Open issues NOT to address in this session

- Firestore composite indexes for `missions(status, createdAt)` + `socialPosts(platform, createdAt)` need `firebase deploy --only firestore:indexes` (firebase auth needed first)
- DM dispatcher architecture decision (X/Mastodon/Bluesky use scoped-exception bypass; operator hasn't decided whether to rebuild to match Standing Rule or codify the exception)
- Hedra render test on `produce_video` (real Hedra render, ~$5-15)
- Watermarking + character-reference image pipeline for social-post images (currently social-post images are DALL-E text-prompt only, no logo overlay, no character refs)
- Plan-review UI: show verbatim text + media URL in step rows so operator doesn't have to click into each step (task #33)

## How to interact with the operator

- Be concise. They've been at this all day.
- Do not project mood / "let me end the session for you." Wait for them to say done.
- When something looks like a gap or problem, surface it specifically with file:line references.
- When uncertain about scope of a fix, ask before doing.
- Honor "code change vs AI training" framing per CLAUDE.md when triaging issues.
- Use the live test monitoring memory's filter spec (Apr 29 evening update) to watch the dev server during operator-driven UI tests.

---

Good luck. The big rocks: a coherent Content Generator hub page, a real Image Generator that isn't the video studio in disguise, the embedded "Create with AI" chat panel, the Content Library MVP, and whatever specific Social Hub friction the operator surfaces in real testing.
