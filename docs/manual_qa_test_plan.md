# SalesVelocity.ai — Manual QA & Y Combinator Readiness Walkthrough

> **Purpose:** Touch every page, every button, every toggle in the platform before the YC application goes in. Surface every gap _now_ — not at submission.
> **Built from:** 8 parallel sub-agent inventories of the dev branch (Apr 30 2026).
> **Format:** Sequential phases. Within each phase, ordered checklists. `🛑` = known gap to fix or accept before YC. `⚠️` = behaves but watch carefully. `✅` = should just work.
> **Use:** Walk top-to-bottom in one or two sittings. Mark every box. Anything left unchecked at YC-time is a surprise risk.

---

## Phase 0 — Pre-flight Setup

Before clicking anything in the app:

- [ ] `git status` clean on `dev` branch (no half-finished work mixed in)
- [ ] `npm run lint` passes
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run build` succeeds (catches prod-only failures dev mode hides)
- [ ] `next dev` running, http://localhost:3000 loads without console errors
- [ ] Live test monitoring armed (per memory `project_live_test_monitoring_setup.md`) — grep filter on dev-server.log
- [ ] Logged in as `dstamper@rapidcompliance.us` (auth identity, not sending identity — per memory)
- [ ] Browser dev tools open: Console + Network tabs visible
- [ ] Test data sanity-check: at least 3 leads, 2 contacts, 1 deal, 1 company in CRM (or seed before starting)

🛑 **Critical**: You are testing the **penthouse** (single-tenant). The multi-tenant flip is targeted week of May 4–10. Anything tenant-coupled that "works for `rapid-compliance-root`" must be re-tested when multi-tenant is back on.

---

## Phase 1 — Public Marketing Site (cold-start UX, what YC reviewers see first)

Open an **incognito window** for this phase. The visitor's first impression is the YC reviewer's first impression.

### 1.1 Homepage `/`
- [ ] Loads cleanly, hero copy matches "$299/mo flat, BYOK, all features unlocked"
- [ ] "Reserve my spot" CTA → `/early-access`
- [ ] "See Demo" CTA → `/demo`
- [ ] Testimonials section renders (verify no placeholder / lorem ipsum)
- [ ] Footer links to /terms, /privacy, /contact

### 1.2 Pricing `/pricing`
- [ ] Single $299/mo card; BYOK explanation present
- [ ] "Get early access" → `/early-access`
- [ ] Fair-use limits read correctly (50k records, 100 agents, 10k posts, 5k emails/day)

### 1.3 Features `/features`
- [ ] All 9 feature category cards render with icons
- [ ] CTA → `/early-access`

### 1.4 Early Access `/early-access` (lead capture form)
- [ ] Form fields: name*, email*, company, role (5 options), use case, referral
- [ ] Honeypot field `website` is hidden (inspect DOM)
- [ ] Submit minimally (name+email only) → `POST /api/public/early-access` returns 200
- [ ] Submit again with **demo scheduling checkbox** ON
  - [ ] Next 10 weekdays appear
  - [ ] Pick a slot → confirms via `POST /api/booking`
  - [ ] Success screen shows Zoom link if Zoom OAuth is connected
  - [ ] Verify lead appears in CRM under `/leads`
  - [ ] Verify booking appears in dashboard calendar
- [ ] Try double-booking the same slot from a second incognito window → expect 409 / "slot taken" UX
- [ ] Submit with the honeypot filled in → expect spam reject (silent)

### 1.5 Contact `/contact`
- [ ] Submit → lands in Firestore `contactSubmissions` + email notification fires (check inbox)

### 1.6 Book `/book`
- [ ] Standalone booking wizard: date → time → details → confirmed
- [ ] Confirms with Zoom meeting ID

### 1.7 Demo `/demo`
- [ ] Live chat with public AI agent
- [ ] Try suggested questions (pricing, BYOK, setup time)
- [ ] Verify response is on-brand, not generic — checks Brand DNA bake-in for the public agent

### 1.8 Auxiliary public pages — quick smoke
- [ ] `/about` — renders
- [ ] `/faq` — renders
- [ ] `/docs` — renders
- [ ] `/security` — renders
- [ ] `/terms`, `/privacy` — last-updated dates current
- [ ] `/blog` — renders (verify no broken posts)
- [ ] `/unsubscribe` — renders

### 1.9 Auth surface
- [ ] `/login` — email/password works → redirects `/dashboard`
- [ ] `/login` — wrong password shows correct error
- [ ] `/forgot-password` — email triggers Firebase reset
- [ ] `/signup` — without `?invite=...` redirects to `/early-access` (gate works)
- [ ] `/signup?invite={validToken}` — invite acceptance flow:
  - [ ] Pre-filled email, role badge shown
  - [ ] Fill displayName, companyName, password
  - [ ] Submit → Firebase user created → `/api/users/invite/{id}` POST → custom claims applied → `getIdToken(true)` forces refresh → redirects to `/`
  - [ ] **Rollback test**: temporarily break the invite endpoint, retry signup → confirm Firebase user is deleted on failure (memory of cleanup logic)
- [ ] `/auth/admin-login` — admin login works → `/api/admin/verify` gate applies → redirects to `/dashboard`
- [ ] **Bug per agent report**: `/api/admin/verify` route file was not located. Smoke this — if the page hangs at "Verifying...", admin login is broken. 🛑

---

## Phase 2 — Onboarding Wizard

Sign up a fresh test user (or impersonate one without onboarding completed):

- [ ] First post-login load → wizard appears (or `/dashboard/onboarding` accessible)
- [ ] Walk all 24 steps end-to-end
- [ ] Confirm autosave fires on each step (`/api/onboarding/progress` PATCH)
- [ ] Refresh mid-wizard → resume from same step
- [ ] At least one step captures Brand DNA fields (per memory: signup itself does NOT capture Brand DNA — wizard does)
- [ ] On final submit → org doc populated, Brand DNA in `organizations/{orgId}.brandDNA`
- [ ] Test "skip" affordances: which steps are skippable? Note any required steps with no skip path
- [ ] Try to access `/dashboard` mid-wizard — does middleware gate it, or is access leaky?

🛑 **Risk per agent report**: Brand DNA may be incomplete after wizard if a user skips it. Per Standing Rule #1, every GM is seeded with Brand DNA. **Verify**: if Brand DNA is incomplete, do GMs still seed (with empty fields)? Run `node scripts/verify-brand-dna-injection.ts` after wizard completion.

🛑 **Replay path**: Onboarding cannot be re-run after completion (no UI). If a user wants to update Brand DNA, they go to `/settings/brand-dna`. Confirm that path works (Phase 4.6 covers it).

---

## Phase 3 — Dashboard Hub + Sidebar Navigation

### 3.1 Sidebar (`AdminSidebar.tsx`)
- [ ] 8-section navigation: Dashboard, CRM, Marketing, Website, AI Workforce, System (owner-only), Settings, Academy
- [ ] Theme toggle works
- [ ] Sign out works
- [ ] Mobile drawer toggle works (resize to ~768px)
- [ ] Owner-only items hidden when impersonating a non-owner

### 3.2 Main Dashboard `/dashboard`
- [ ] 6 KPI cards render with real numbers (Pipeline, Active Deals, Leads, Win Rate, Conversations, AI Agents)
- [ ] Click each KPI → navigates to detail page
- [ ] Conversations Monitor card live
- [ ] AI Workforce status card live
- [ ] **Unified Calendar** — meetings + demos + scheduled posts + CRM activity all aggregated
  - [ ] Today's meetings visible
  - [ ] Click meeting → opens detail
- [ ] Sales pipeline 4-stage bar chart matches data in `/deals`
- [ ] Recent Activity (3 items max)
- [ ] Tasks list (5 pending, priority-dotted)
- [ ] Commerce + Analytics strips at bottom
- [ ] DASHBOARD_TABS sub-nav works (Executive Briefing, Team, Analytics, Growth, Playbook, Compliance Reports, Battlecards)

### 3.3 Executive Briefing `/executive-briefing`
- [ ] Loads → `GET /api/orchestrator/executive-briefing` returns 200
- [ ] Department status pills color-coded
- [ ] Pending approvals visible if any
- [ ] Approve / Reject buttons fire `POST /api/orchestrator/approval/{id}/{decision}` (only fire if you actually want to approve — these have side effects)
- [ ] Command history (20 most recent) renders

### 3.4 Performance `/performance`
- [ ] Period selector: Week/Month/Quarter
- [ ] Refresh button refetches `POST /api/performance/analytics`
- [ ] PerformanceOverview, Benchmarks, TopPerformers, Trends cards all populated
- [ ] Empty-state and error retry work

### 3.5 Analytics `/analytics`
- [ ] Period: 7d/30d/90d/all
- [ ] 4 cards (Revenue, Pipeline, Ecommerce, Workflows) load in parallel
- [ ] One failed endpoint doesn't tank the whole page (test by throttling network)

### 3.6 Playbook `/playbook`
- [ ] List loads from `/api/playbook/list`
- [ ] Click a playbook → patterns + talk tracks render
- [ ] Adoption metrics show per playbook
- 🛑 No playbook **creation** UI was found. Verify whether playbooks are seeded only or if there's a hidden create path.

### 3.7 Academy `/academy`
- [ ] Category tabs work (8 categories)
- [ ] Tutorials with videos play
- [ ] Tutorials without videos show "Video coming soon" — count how many. ⚠️ If most tutorials have no video, YC reviewers will notice.

### 3.8 Growth Command Center `/growth/command-center`
- [ ] Competitors list (≤20)
- [ ] Keywords list (≤50)
- [ ] AI visibility checks (last 5)
- [ ] Activity feed (last 10)
- [ ] All 5 endpoints succeed; if one fails the section silently shows empty — flag this 🛑

### 3.9 Intelligence Discovery `/intelligence/discovery`
- [ ] DiscoveryHub component loads, shows insight cards or actionable items

### 3.10 Coaching `/coaching`
- [ ] Toggle Human Reps ↔ AI Agents
- [ ] Period selector + AI model selector work
- [ ] Generate insights for one rep → renders performance score, strengths/weaknesses, recommendations
- [ ] AI Agents view: link to Training Center works

### 3.11 System `/system` (admin-only)
- [ ] Health % displayed, services list with latency
- [ ] Refresh button works
- [ ] Non-admin user gets denied (test with impersonated member)

### 3.12 Living Ledger `/living-ledger`
- 🛑 Stub page per agent report. If stub: hide from sidebar before YC, OR populate with real data.

### 3.13 Battlecards `/battlecards`
- 🛑 Stub page per agent report. Same call: ship-with-data or hide.

### 3.14 Compliance Reports `/compliance-reports`
- 🛑 Original Rapid Compliance branding. Loads from Firestore but collection is likely empty in dev. **Decision before YC**: ship populated, hide, or relabel.

### 3.15 Risk `/risk`
- [ ] Enter deal ID → "Predict Risk" → results render (factors, interventions, model used: GPT-4o)
- [ ] "Load demo data" sets `demo-deal-001` for safe demo
- [ ] Mark intervention completed/dismissed → `PATCH /api/risk/interventions` fires

---

## Phase 4 — Settings (29 entries — every toggle, every save)

Walk through `/settings` index card-by-card. The agent report flagged **multiple destructive actions without two-step confirmation** in violation of project rule. Catch them all here.

### 4.1 Settings Index `/settings`
- [ ] All section cards visible per role (admin/owner sees full set)
- [ ] FEATURE_MODULES dynamic cards render
- [ ] Featured "Features & Modules" card at top (admin/owner only)

### 4.2 Account `/settings/account`
- [ ] Inline-edit name, email, phone, title, timezone, date format → autosave each
- [ ] "Change Password" expand → strength meter + match validation
- [ ] **Sign out** in top-right works
- [ ] **Delete Account** danger zone:
  - [ ] Owner sees "transfer ownership first" instead of delete button (verify gate)
  - [ ] Non-owner: type "DELETE MY ACCOUNT" + password → button fires
  - 🛑 Not a true two-step click after typing — single confirmation suffices. **Decide**: add second-click guard or accept.

### 4.3 Organization `/settings/organization`
- [ ] All identity + address + social fields save via `PATCH /api/organization/profile`
- [ ] Sticky bottom save bar appears when dirty, disappears after save

### 4.4 Billing `/settings/billing`
- [ ] Current plan card shows tier + status correctly
- [ ] Usage metrics load (`GET /api/admin/usage`)
- [ ] "Manage Billing" → opens Stripe Portal in new tab
- [ ] "Upgrade" → `/settings/subscription`
- 🛑 **Cancel Subscription** is single-click — no two-step. Verify whether Stripe Portal cancel is the real path; if so, hide the in-app cancel. If not, add two-step.
- 🛑 **Reactivate** is single-click too.

### 4.5 Subscription `/settings/subscription`
- [ ] Tier comparison renders
- [ ] Upgrade flow → checkout session → returns to `/checkout/complete`

### 4.6 Brand DNA `/settings/brand-dna`
- [ ] All fields save (companyDescription, industry, uniqueValue, targetAudience, competitors, toneOfVoice, communicationStyle, keyPhrases, avoidPhrases)
- [ ] Save toast: "AI tools will now use your brand voice"
- 🛑 **No "Reseed all GMs" button** — operator must run `node scripts/reseed-all-gms.js` from CLI to actually propagate Brand DNA. **Decision before YC**: add the button, OR add a banner that says "After saving, run the reseed script — instructions here". Current state silently lies (saves succeed, but specialists keep old voice until reseed). ⚠️ This is a Standing Rule #1 trap.

### 4.7 Brand Kit `/settings/brand-kit`
- [ ] Logo, colors, typography, intro/outro for video — verify uploads land in storage and render in `/content/video`

### 4.8 API Keys `/settings/api-keys`
- [ ] OpenRouter banner present (recommended path)
- [ ] All 40 service cards render
- [ ] Save key → masked bullets show on next load
- [ ] **Test** button per service → verify success/error
- [ ] **Delete** button per service → 🛑 single-click, no confirmation. Cumulatively easy to wipe a key by mistake. Add confirm.
- [ ] Custom API keys section: 🛑 stubbed (state defined, not rendered). Either ship or remove the dead state.

### 4.9 Theme `/settings/theme`
- [ ] 8 presets apply
- [ ] Color/typography/layout/branding tabs all save
- [ ] Logo + favicon upload (note: stored as base64 in Firestore — large logos may bloat doc size ⚠️)
- [ ] Export Theme JSON works
- [ ] No "Reset to Default" — verify if this is acceptable

### 4.10 Users `/settings/users`
- [ ] Member table renders with roles + statuses
- [ ] "Invite User" → email + role → invite email sends
- [ ] Pending invite cancel works
- [ ] **Role change** is immediate on dropdown change ⚠️ — no undo. Confirm OK or add Save.
- [ ] **Remove User** is modal-confirmed but single-click in modal 🛑 — should require explicit second click per project rule.
- [ ] Edit user permissions modal: Custom Overrides toggles save
- [ ] Owner detection works (only owner can transfer ownership)

### 4.11 Security `/settings/security`
- [ ] 2FA toggle + IP restrictions (textarea) + Session timeout + Audit retention all save
- [ ] Audit logs table populated (or empty-state if none)
- ⚠️ Enabling 2FA forces enrollment org-wide with no warning UX — verify this is intentional before flipping.

### 4.12 Webhooks `/settings/webhooks`
- [ ] Create webhook modal works
- [ ] Active toggle → fires immediately (no confirm) — acceptable for webhook-active state
- [ ] **Test** button hits the endpoint with mode='no-cors' (silent fire — verify endpoint received)
- [ ] **Delete** is two-step (Delete → Confirm/Cancel) ✅ — only setting where two-step is implemented.

### 4.13 Integrations `/settings/integrations`
- See **Phase 5** for full per-platform walkthrough.

### 4.14 Email Templates `/settings/email-templates`
- 🛑 File too large for the inventory agent to fully map. Walk through manually:
  - [ ] List templates
  - [ ] Edit one — check rich text editor, placeholder vars, test send button
  - [ ] Save + preview

### 4.15 Features `/settings/features`
- [ ] 5-tab consultative onboarding (Your Business → Features → CRM Entities → API Keys → Summary)
- [ ] Auto-suggestion logic fires (sellsOnline → storefront, etc.)
- [ ] "Save & Continue" advances tabs
- [ ] "Always On" CRM entities are read-only
- [ ] Toggle a feature module off → confirm sidebar nav hides the corresponding section
- [ ] Final Launch button → `/dashboard`

### 4.16 Module `/settings/module/[slug]`
- [ ] One module deep — pick `crm` or `email-outreach`
- [ ] Per-module config saves

### 4.17 Storefront `/settings/storefront`
- [ ] Enable Store toggle
- [ ] All checkout/payment toggles save
- [ ] Tax rate input accepts numerics

### 4.18 Custom Tools `/settings/custom-tools`
- [ ] Create tool with HTTPS URL → save
- [ ] HTTP non-localhost rejected
- [ ] Query params rejected
- [ ] Toggle enabled
- 🛑 **Wiring unclear**: agent CRUD works, but is the tool actually invokable mid-mission? Verify by adding a tool and asking Jasper to use it.

### 4.19 Lead Routing `/settings/lead-routing`
- [ ] Round-robin / assignment rules UI
- [ ] Save fires `/api/lead-routing` (verify)
- [ ] Trigger by creating a lead → verify owner gets assigned per rule

### 4.20 Automation `/settings/automation`
- [ ] Inbound channel auto-reply rules (per memory: must route through Jasper, never bypass)
- [ ] Toggle DM auto-approve OFF/ON — confirm OFF is default (per memory)

### 4.21 Scheduling Messages `/settings/scheduling-messages`
- [ ] Edit early-access success card copy
- [ ] Edit demo confirmation email subject + HTML body — placeholders ({firstName}, {meetingDate}, {meetingTime}, {duration}, {zoomLink}, {orgName})
- [ ] Edit Zoom topic + agenda
- [ ] Edit 24h reminder + 1h reminder
- [ ] Save → verify persisted via `PUT /api/settings/scheduling-messages`
- [ ] **End-to-end reminder test**: book a meeting 25h out → wait for cron `scheduled-reminders` (every 5 min) → verify 24h reminder email arrives. Then 1h before, verify 1h reminder. ⚠️ Per memory `fc325846` — this cron was wired Apr 30; first prod-like exercise.

### 4.22 SMS Messages `/settings/sms-messages`
- [ ] Automated SMS trigger configuration
- [ ] Save fires correctly
- [ ] Twilio toll-free under review per memory — sends may bounce until approved 🛑

### 4.23 AI Agents `/settings/ai-agents`
- See **Phase 12** for the full agent + training walkthrough.

### 4.24 Promotions `/settings/promotions`
- [ ] Redirects to `/coupons` — verify redirect lands correctly

### 4.25 Music Library `/settings/music-library`
- [ ] Upload royalty-free track → appears in library
- [ ] Available in `/content/video/voice-lab` audio picker

### 4.26 Workflows `/settings/workflows`
- [ ] Settings-level workflow toggles (vs the workflow builder at `/workflows`)
- [ ] Save persists

### 4.27 Accounting `/settings/accounting`
- [ ] QuickBooks/Xero/FreshBooks/Wave selector
- [ ] Sync settings (one-way vs two-way)

---

## Phase 5 — Integrations (`/settings/integrations` + `/integrations` hub)

The agent inventory found **only Zoom has the two-step disconnect** the project rule requires. All others are single-click 🛑. Decision point: roll out the two-step pattern, or accept and document.

For each integration: open the card, click Connect, follow OAuth, verify Connected badge, then click Disconnect. Note disconnect behavior.

### 5.1 Working integrations (live)
- [ ] **Zoom** — gold-standard two-step disconnect ✅. Connect → meeting in `/book` test → disconnect (5s auto-disarm).
- [ ] **Stripe** — paste `sk_test_...` → "Test" → Connected. Run a test payment via storefront. Disconnect.
- [ ] **PayPal** — paste credentials → Connected. Webhook handler at `/api/webhooks/paypal`.
- [ ] **Gmail** — OAuth → Connected → email shown. Test send. Disconnect 🛑 single-click.
- [ ] **Outlook (email)** — OAuth → Connected. Send test. Disconnect.
- [ ] **Google Calendar** — OAuth → Connected. Auto-create event from CRM. Disconnect.
- [ ] **Outlook Calendar** — OAuth → Connected. Two-way sync verify. Disconnect.
- [ ] **Slack** — OAuth → Connected → team name shown. Send test message via workflow. Disconnect.
- [ ] **Microsoft Teams** — OAuth flow. ⚠️ Send capability not yet implemented per agent report — connect works, sending doesn't. Either ship send or label "Coming Soon".
- [ ] **QuickBooks** — OAuth → Connected. Sync invoice. 🛑 No disconnect endpoint — verify disconnect actually does anything.
- [ ] **Xero** — Same as QB. 🛑 No disconnect endpoint.
- [ ] **Bluesky** — Paste handle + app password → Connected (validates against AT Protocol). Test post.
- [ ] **Mastodon** — Paste instance + token → Connected. Test post.
- [ ] **X / Twitter** — OAuth flow OR manual key entry. Test post tweet. **DM is enterprise-only** per memory — DM compose plumbing exists but inert. ⚠️ Make sure no UI promises DM functionality.
- [ ] **Google Search Console** — OAuth → Connected. Fetch GSC metrics.
- [ ] **Zapier** — Webhook-based. Create Zap pointing at SV webhook → trigger event → verify.

### 5.2 Coming Soon (gated externally) — verify the gating UX, not the underlying API
- [ ] **LinkedIn** — Coming Soon, "Marketing Developer Platform approval (1–3 weeks)" reason text shown
- [ ] **Facebook** — Coming Soon, "Meta device-trust gate (Apr 28). Retry no sooner than May 1–2" reason
- [ ] **Instagram** — Same Meta gate
- [ ] **Threads** — Same Meta gate
- [ ] **TikTok** — Coming Soon, "Content Posting API + Login Kit submission in progress. Pending app icon, demo video, scope selection" reason
- [ ] **YouTube** — Coming Soon, "Google OAuth verification (1–4 weeks)" reason
- [ ] **Pinterest** — Coming Soon, "Developer Portal approval (1–3 days)" reason
- [ ] **Discord** — Coming Soon, "Central Discord Developer App not yet registered" reason
- [ ] **Twitch** — Coming Soon, "Central Twitch Developer App not yet registered" reason
- [ ] **Google Business** — Coming Soon, "GMB verification + GCP OAuth approval" reason
- [ ] **WhatsApp Business** — Coming Soon, "Customer-initiated 24h messaging window" reason

For each Coming Soon: verify the **Connect button is disabled** (not just hopeful) — otherwise a YC reviewer clicks and sees a real OAuth wall.

### 5.3 Parked (not coming back unless rules change)
- [ ] **Reddit** — Parked, "$10K+/mo enterprise tier" reason. Connect button hidden or disabled.
- [ ] **Telegram** — Parked, "US SMB <10% adoption — marked for deletion Apr 27 2026" reason. 🛑 **Memory says marked for deletion** — decision before YC: actually delete (touches ~12 files) or leave parked.
- [ ] **Truth Social** — Parked, "Cloudflare TLS-fingerprint wall" reason.
- [ ] **Lemon8** — Skip per memory; should not appear in UI at all.

### 5.4 Cross-integration checks
- [ ] `/settings/integrations` summary count of "Connected" matches actual Firestore state
- [ ] Disconnect of Zoom does NOT leave stale entry in `integrations/all` legacy map (per agent report — Zoom dual-writes, watch for desync)
- [ ] Re-connect after disconnect works (no stale token issues)

---

## Phase 6 — CRM Stack

### 6.1 Leads
- [ ] `/leads` → list, columns, filters (owner/status/source), search, pagination, CSV export
- [ ] **Create lead** at `/leads/new`:
  - [ ] Required fields validate
  - [ ] Duplicate check fires after email/phone (1s debounce) → `POST /api/crm/duplicates`
  - [ ] Data quality score visible
  - [ ] Auto-enrich on save
- [ ] **Detail view** `/leads/[id]`:
  - [ ] Score badge (HOT/WARM/COLD)
  - [ ] ActivityTimeline aggregates emails/calls/meetings/notes/system events
  - [ ] Predictive Score Breakdown sidebar
  - [ ] **Send Email** mailto link
  - [ ] **Make Call** → `/calls/make?phone=X&contactId={id}` 🛑 (verify `/calls/make` exists — agent report says page may not be implemented)
  - [ ] **Add to Sequence** 🛑 navigation-only stub. No enrollment fires. Either wire it up or remove the button before YC.
  - [ ] **Convert to Deal** ✅ — fully wired. Click → modal → creates deal, redirects to `/deals/[id]`
- [ ] CSV import button → does the mapping UI exist? Or just upload? 🛑 verify
- [ ] Sub-pages: `/leads/discovery`, `/leads/icp`, `/leads/proposals`, `/leads/research` — touch each

### 6.2 Contacts
- [ ] `/contacts` list works
- [ ] Create contact (no duplicate check, no quality score — known gap)
- [ ] Detail view minimal — last activity date only, no full timeline 🛑

### 6.3 Companies
- [ ] `/companies` list with rollup stats (contacts, deals, LTV)
- [ ] Create modal works
- [ ] 🛑 No edit form, no detail page — either ship or hide. YC reviewer clicking a company row will hit a 404.

### 6.4 Deals
- [ ] Pipeline (kanban) view: 6 stages, counts + values
- [ ] Table view + CSV export
- [ ] Create deal at `/deals/new`
- [ ] Detail view:
  - [ ] **Health Score** card with factors + warnings + recommendations
  - [ ] **Mark Won** → modal confirm → `PUT /api/deals/{id}` with `closed_won`
  - [ ] **Mark Lost** → modal with REASON field required
  - [ ] **Schedule Meeting** 🛑 navigation-only stub
- [ ] Edit form works
- [ ] Sub-routes: `/deals/invoices`, `/deals/orders`, `/deals/payments`, `/deals/tasks`
- 🛑 No drag-drop kanban — cards are read-only. Decide: ship or accept.

### 6.5 Activities `/activities`
- [ ] All-tab + per-type filter tabs (Emails/Calls/Meetings/Notes/Tasks/System)
- [ ] Click activity → links to related entity
- [ ] Pagination (Load More)
- 🛑 No date filter, no keyword search, no export — accept or fix

### 6.6 Tasks `/tasks`
- [ ] Filter tabs (All/Todo/InProgress/Blocked/Completed) with counts
- [ ] Create task modal
- [ ] Toggle complete checkbox → `PUT /api/team/tasks/{id}`
- 🛑 No edit form, no bulk actions, no user-picker for assignedTo (text input only)

### 6.7 Calls `/calls`
- [ ] Call log table loads
- [ ] Recording playback (if `recordingUrl` exists)
- 🛑 `/calls/make` page — verify it exists. If not, every "Make Call" button in CRM is broken.

### 6.8 Conversations `/conversations`
- [ ] Active sessions panel: real-time subscription updates
- [ ] Click session → messages render
- [ ] **Take Over** button → request handoff
- 🛑 Where does the human-agent take-over interface live? If nowhere, the button is decorative.
- [ ] History tab: filter by completed/transferred, flagged-for-training tags

### 6.9 Lead Scoring `/lead-scoring`
- [ ] Analytics dashboard (grade distribution, priority breakdown, averages, top intent signals)
- [ ] Filters: priority, grade, sort
- [ ] Lead score cards
- [ ] Rules panel modal:
  - [ ] Create rule set (name + description only)
  - 🛑 No weight editor, no criteria editor — incomplete UI

### 6.10 Nurture `/nurture`
- [ ] Campaign list with status badges
- [ ] Click "Edit" → `/nurture/[id]` 🛑 — page implementation not visible. Verify or hide.
- [ ] Click "Stats" → `/nurture/[id]/stats` 🛑 — same.

### 6.11 Team / Workforce
- [ ] `/team/leaderboard`, `/team/tasks`, `/workforce/performance` — all present, all populated

---

## Phase 7 — Content + Magic Studio + Media

### 7.1 Content Hub `/content`
- [ ] Sub-nav tabs (Studio / Editor / Calendar / Library / Voice Lab)
- [ ] Each tab navigates correctly

### 7.2 Magic Studio `/content/video/studio`
- [ ] **Tool palette**: Image / Video / Music / Text — each switches active slot, preserves prompt + result
- [ ] **Image generation**: prompt + aspect ratio → result on canvas, saved to recent sidebar
- [ ] **Video — Prompt mode**: prompt + aspect + duration → result
- [ ] **Video — Avatar mode**: upload portrait → drag onto canvas → generate lip-sync
- [ ] **Music**: prompt + duration + style → result audio playable
- [ ] **Text**: prompt + kind → text result
- [ ] **Recent sidebar**: previous generations across all tools, drag-onto-canvas works (esp. avatars for video)
- [ ] Verify Brand DNA influences output (recognizable tone — per Standing Rule #1)

### 7.3 Video Pipeline `/content/video`
- [ ] Pipeline stepper: Storyboard → Generation → Assembly → Post-Production → Publish
- [ ] Reachability gates work (can't skip Storyboard if brief empty)
- [ ] Project save / load modals
- [ ] Template picker
- 🛑 TODO line 480: "wire to a Copywriter route once path finalized"

### 7.4 Video Editor `/content/video/editor`
- [ ] Timeline scrubbing
- [ ] Text overlay tool
- [ ] Effects panel
- [ ] Export to MP4

### 7.5 Video Library `/content/video/library`
- [ ] Grid of generated videos
- [ ] Filter, preview, download, delete

### 7.6 Voice Lab `/content/voice-lab`
- [ ] Voice cloning (record sample → clone)
- [ ] TTS preview
- [ ] AI Music Studio (if separate)

### 7.7 Image Generator `/content/image-generator`
- [ ] Confirm this is a wrapper around Magic Studio image tool — or a separate path. If separate, walk it.

---

## Phase 8 — Outbound (Email / SMS / Sequences / Campaigns)

### 8.1 Email Campaigns `/email/campaigns`
- [ ] List with status badges (Draft/Scheduled/Sent), stats (sent / open / click)
- [ ] Create at `/email/campaigns/new`: name, subject, body, scheduledFor
- [ ] Submit → `POST /api/email/campaigns`
- 🛑 Body is plain textarea — no rich text editor, no template picker, no recipient selector visible. Either ship the editor or document "MVP, plain-text only".
- [ ] Send to a real test address (use your own inbox)
- [ ] Verify SendGrid path: from `em2756.rapidcompliance.us` per memory (dev), not salesvelocity.ai (launch)

### 8.2 Email Writer `/email-writer`
- [ ] AI-generated email types: Intro / Follow-up / Proposal / Close / Re-engagement
- [ ] Stats grid (Generated / Sent / Avg Open Rate / Avg Reply Rate)
- [ ] Generate one of each type — verify Brand DNA voice
- [ ] Send via the card → email actually delivers
- ⚠️ EmailWriterCard component not deeply mapped — verify recipient picker pulls from CRM contacts.

### 8.3 Sequences `/sequences/analytics`
- [ ] 4 view tabs (Overview / Sequences / Channels / Monitoring)
- [ ] Summary metrics populated
- [ ] Top performers leaderboard
- [ ] Channel breakdown (Email / LinkedIn / SMS / Phone)
- [ ] Step-level drilldown
- [ ] Real-time SequenceExecution monitor
- [ ] CSV export buttons (4 exporters)

### 8.4 Campaigns `/campaigns`
- [ ] Campaign cards with status (researching / strategizing / producing / pending_review / approved / published)
- [ ] Deliverable type icons (blog / video / email / image / social_post / research / strategy)
- [ ] Click → detail / review (Mission Control link)
- [ ] **Create Campaign** button → walk the create flow

### 8.5 SMS
- [ ] Compose + send through `/api/sms/send`
- [ ] Twilio toll-free under review per memory — sends may bounce 🛑

### 8.6 Outbound `/outbound`
- [ ] Whatever lives here — probably a hub. Touch each card.

---

## Phase 9 — Social + Approvals + Calendar

### 9.1 Social Hub `/social`
- [ ] AI Activity strip (globally paused / agent disabled / healthy state — verify all 3 by toggling)
- [ ] 6 metric tiles populate
- [ ] 7-day calendar mini
- [ ] Platforms list with state pills (live_full / live_dm_blocked / live_no_dm / coming_soon / parked / no_specialist)
- [ ] Quick actions: Create with AI / View Calendar / Approval Queue / Listening
- [ ] Recent activity feed

### 9.2 Per-platform composer `/social/platforms/[platform]`
- [ ] For each LIVE platform: compose post → preview matches platform-native format → publish → verify on the actual platform
- [ ] Try posting to a Coming Soon platform — should be gated

### 9.3 Calendar `/social/calendar`
- [ ] Multi-view (month/week/day/agenda)
- [ ] Platform filter
- [ ] Status filter
- [ ] Drag-to-reschedule fires `PUT /api/social/posts` — note: no confirmation modal (live action) ⚠️

### 9.4 Approvals `/social/approvals`
- [ ] Status tabs with counts
- [ ] Highlight-on-flag (orange highlight on flagged keyword in content)
- [ ] Edit content inline → diff captured
- [ ] Approve / Reject / Request Revision buttons
- [ ] Bulk select + bulk actions
- [ ] Verify correction capture feeds the training pipeline

### 9.5 Listening `/social/listening`
- [ ] Mention monitoring
- [ ] Sentiment analysis
- [ ] Configure keywords

---

## Phase 10 — Forms / Website Builder / Workflows

### 10.1 Forms `/forms`
- [ ] List + filters + bulk actions + CSV export
- [ ] Create from each of 6 templates
- [ ] **Form editor** `/forms/[id]/edit`: drag-drop fields, properties, settings, preview
- [ ] Publish → live URL accessible from incognito
- [ ] Submit form → entry in Firestore + email notification + (if configured) workflow trigger / CRM sync

### 10.2 Website — Pages `/website/pages`
- [ ] List + filter (Draft/Published)
- [ ] Create blank page
- [ ] **AI Generate page** modal: prompt + page type → generated content → review → save
- [ ] **Clone Website** modal: paste URL + max pages → async clone → pages appear with brand colors detected
- [ ] Duplicate page works
- [ ] Delete with confirmation

### 10.3 Website — Editor `/website/editor`
- [ ] Drag-drop section library
- [ ] Inline text edit
- [ ] Image upload → renders
- [ ] Color picker / font selector
- [ ] Device preview toggle (Desktop / Tablet / Mobile)
- [ ] Save / Publish

### 10.4 Website — Blog `/website/blog`
- [ ] Calendar view
- [ ] Post list with views/comments stats
- [ ] Categories management

### 10.5 Website — Blog Editor `/website/blog/editor`
- [ ] Title, slug auto-gen
- [ ] Featured image
- [ ] Rich text body
- [ ] SEO panel (meta description, focus keyword, readability score)
- [ ] Schedule (future date)
- [ ] Publish → RSS feed updates → verify `/blog/feed.xml`

### 10.6 Website — Domains `/website/domains`
- [ ] Add custom domain → DNS records shown
- [ ] Verify button polls DNS

### 10.7 Website — SEO `/website/seo` + `/website/seo/competitors` + `/website/seo/ai-search`
- [ ] Domain analysis runs
- [ ] Keyword research
- [ ] Content brief generation
- [ ] Competitor tracking add/remove
- [ ] AI Search insights

### 10.8 Website — Navigation `/website/navigation`
- [ ] Drag-drop menu reorder
- [ ] Submenu nesting
- [ ] Save → verify on public site

### 10.9 Website — Audit Log `/website/audit-log`
- [ ] Read-only history of edits

### 10.10 Workflows `/workflows`
- [ ] List with status badges
- [ ] Toggle Active/Paused — verify cron `workflow-scheduler` (every 5 min) picks up status change
- [ ] Create via `/workflows/builder`:
  - [ ] Drag triggers + actions onto canvas
  - [ ] Connect nodes
  - [ ] Configure each
  - [ ] Save + Publish
- [ ] Verify `create_workflow` tool path: ask Jasper to create a 3-day email sequence → verify it appears here as real Workflow doc + sequenceJobs in Firestore
- [ ] Test execution: trigger a workflow manually → step through `/workflows/[id]/runs`

### 10.11 Templates & Scoring `/templates`
- [ ] Apply industry template → confirm workflows + email templates populate
- [ ] Score a deal → verify factors + tier (Hot/Warm/At-Risk/Cold)
- [ ] Generate forecast (30/60/90 day) with quota → verify chart

### 10.12 Storefront `/store` + `/products` + `/orders` + `/coupons` + `/subscriptions`
- [ ] Products: create with price + image
- [ ] Orders: list + status update
- [ ] Coupons: create + apply at checkout
- [ ] Subscriptions: list + cancel flow
- [ ] **End-to-end**: storefront page → cart → Stripe checkout → return → order created in CRM → invoice sent → payment recorded

### 10.13 A/B Tests `/ab-tests`
- [ ] Create A/B test
- [ ] Allocate traffic
- [ ] View results

### 10.14 Voice (`/voice`)
- [ ] Outbound dialer
- [ ] Inbound handler
- [ ] Call review UI
- [ ] Test live call (use a test phone number you own)

### 10.15 Scraper `/scraper`
- [ ] Input URL → scraper output
- [ ] Verify polite crawl behavior (no platform bans)

---

## Phase 11 — Mission Control + Agent Swarm + Training

This is the core differentiator. Spend extra time here. **Standing Rule #2 verification is the most important YC-relevant proof.**

### 11.1 Mission Control `/mission-control`
- [ ] 3-panel layout renders (sidebar / timeline / detail)
- [ ] Live Badge pulses
- [ ] **Plan Pre-Approval (M4)**:
  - [ ] Trigger a mission (use Jasper command bar) → lands in PLAN_PENDING_APPROVAL
  - [ ] Review plan in PlanReviewPanel
  - [ ] Approve one step
  - [ ] Edit a step's args/summary → confirm Jasper proposal popup if PE returned one
  - [ ] Delete a step → confirm correction captured
  - [ ] Reorder via drag-drop
  - [ ] **"Approve all steps"** then **"Run plan"**
- [ ] **Sequential auto-execute (M3.6/M3.7)**:
  - [ ] Watch steps execute one-by-one
  - [ ] Force a step failure (use a tool that needs missing creds) → expect auto-retry once
  - [ ] Second failure → mission halts to AWAITING_APPROVAL
  - [ ] Verify per-step approval gate before resume
- [ ] **Step Grading (M2b)**:
  - [ ] Click stars 1–5 → immediate `POST /api/orchestrator/missions/[id]/grade`
  - [ ] Click "Why?" → textarea + multi-specialist picker (if multiple specialistsUsed)
  - [ ] Save → fires Prompt Engineer
  - [ ] PromptRevisionPopup appears (3-box: Keep / Agent / My rewrite)
  - [ ] **Approve "Agent's suggestion"** → new GM version created (verify in `/settings/ai-agents/training/golden`)
- [ ] **Specialist Version History (M2d)**:
  - [ ] Click specialist badge on a graded step
  - [ ] Version list renders with active badge
  - [ ] Rollback to a previous version → confirm dialog → next call uses old prompt
- [ ] **Manual edit (M6)**:
  - [ ] Click "Edit output directly" on a COMPLETED step
  - [ ] Replace text → save → `manuallyEdited` audit flag set
  - [ ] Verify Prompt Engineer NOT fired (this is quick-fix, not training)
- [ ] **Upstream changed flag (M5)**:
  - [ ] Rerun an upstream step → downstream step shows UpstreamChangedBanner
  - [ ] Click "Still good — keep this output" → flag clears
  - [ ] OR click "Rerun" → step re-executes with new context
- [ ] **Inline scrap (M7)**:
  - [ ] Plan view: scrap a step
  - [ ] Halted step: scrap the whole mission
- [ ] **Mission Grade Card** at bottom:
  - [ ] Stars + textarea
  - [ ] Submit → if explanation given, Prompt Engineer proposal for **Jasper's GM** appears

### 11.2 Mission Control Sub-pages
- [ ] `/mission-control/review?mission=X&step=Y` — full-page step review (read-only)
- [ ] `/mission-control/history` — paginated list of completed missions

### 11.3 Settings → AI Agents `/settings/ai-agents`
- [ ] Hub with 3 cards (Persona / Training / Voice)

### 11.4 Persona `/settings/ai-agents/persona`
- [ ] Knowledge base sources list
- [ ] Personality config
- [ ] Capabilities toggles

### 11.5 Training Center `/settings/ai-agents/training`
- [ ] View mode: Customer ↔ Swarm
- [ ] Customer view: Jasper + Sales Chat
- [ ] Swarm view: 34 specialist dropdown
- [ ] 7 tabs (Performance / Improvements / Review / Chat / Materials / History / Golden)
- [ ] Each tab populates with real data (or empty-state if no training yet)

### 11.6 Golden Master Version History
- [ ] List all versions with createdBy, createdAt, notes
- [ ] Active badge on current
- [ ] Expand → full system prompt visible
- [ ] Diff 2 versions → side-by-side LCS line diff
- [ ] **Rollback** → creates new version pointing at old prompt

### 11.7 Voice & Speech `/settings/ai-agents/voice`
- [ ] Voice provider config (ElevenLabs etc.)
- [ ] TTS settings save

### 11.8 Standing Rule #2 end-to-end proof (the YC-defining moment)
Run this as a single chained walk:
1. [ ] Trigger a mission → execute a step
2. [ ] Grade it 2 stars + explanation: "tone too aggressive for our brand"
3. [ ] Pick the specialist target (or auto-pick if single)
4. [ ] Wait for Prompt Engineer proposal popup
5. [ ] Approve "Agent's suggestion"
6. [ ] Confirm new GM version v2 active in Training Center
7. [ ] Trigger a new mission of the same shape
8. [ ] Verify behavior changed — softer tone, demonstrably different output
9. [ ] Run `scripts/verify-prompt-edit-changes-behavior.ts` — should pass
10. [ ] Run `scripts/verify-no-grades-no-changes.ts` — should pass (no grade = no change)

This loop is the heart of the platform. **If any step here is broken, YC review fails.** 🛑

### 11.9 Brand DNA reseed loop (Standing Rule #1)
- [ ] Edit Brand DNA in `/settings/brand-dna` → save
- [ ] Run `node scripts/reseed-all-gms.js` from terminal
- [ ] Confirm all 34 specialist GMs + Jasper orchestrator GM updated
- [ ] Run `scripts/verify-brand-dna-injection.ts` → all GMs have new Brand DNA block
- [ ] Trigger a new mission → output uses new voice

🛑 **YC bait**: a reviewer asking "what happens when you edit Brand DNA?" — answer must be a button click, not a CLI command. Add the reseed button to the Brand DNA settings page before submitting.

---

## Phase 12 — System / Admin / Cron / Health

### 12.1 System `/system`
- [ ] Health % + per-service latency
- [ ] Refresh works
- [ ] Schemas sub-route works
- [ ] Admin tool links functional

### 12.2 System / Impersonate `/system/impersonate`
- [ ] Search users
- [ ] Pick + reason → start session
- [ ] Banner appears in dashboard layout when impersonating
- [ ] End session → returns to original user
- [ ] Cannot impersonate self or other owners
- [ ] All sessions logged

### 12.3 Cron jobs (verify each fires)
Read `vercel.json` for full schedule. The high-value crons to actively verify:

- [ ] `scheduled-reminders` (every 5 min) — book meeting → wait → 24h + 1h reminder emails arrive
- [ ] `workflow-scheduler` (every 5 min) — multi-day sequence → verify SequenceJobs fire on time
- [ ] `process-sequences` (hourly) — outbound email sequences fire
- [ ] `scheduled-publisher` (every 5 min) — scheduled social posts publish
- [ ] `social-metrics-collector` (every 3 hr)
- [ ] `operations-cycle?cycle=operational` (every 4 hr) — autonomous business cycle, 5 ops steps. Manual trigger: hit endpoint with CRON_SECRET to avoid waiting
- [ ] `operations-cycle?cycle=strategic` (daily midnight) — 8 strategic steps
- [ ] `operations-cycle?cycle=executive` (weekly Sun midnight) — 4 executive steps
- [ ] `intelligence-sweep` (daily 6am)
- [ ] `social-listening-collector` (every 6 hr)
- [ ] `growth-keyword-tracker` (daily 5am)
- [ ] `growth-competitor-monitor` (Mon 3am)
- [ ] `growth-ai-visibility` (Wed 4am)
- [ ] `discovery-source-monitor` (every 6 hr)
- [ ] `jasper-dm-dispatcher` (every minute) — DM queue
- [ ] `jasper-bluesky-dm-dispatcher` (every minute)
- [ ] `jasper-mastodon-dm-dispatcher` (every minute)
- [ ] `run-scheduled-missions` (every 15 min) — schedule a mission for 20 min out, verify it runs
- [ ] `workflow-entity-poll` (every 5 min)

For each: verify `CRON_SECRET` Bearer auth rejects unauthenticated calls. ⚠️ Anyone hitting your cron endpoints without the secret should get 401.

### 12.4 Notifications
- [ ] In-app notification dropdown populates
- [ ] `/api/notifications/preferences` save works
- [ ] `POST /api/notifications/send` (admin/owner only) — send a test, verify channels (email/SMS/push/in-app) all fire if configured
- ⚠️ Rate limit is in-memory (50/min per org) — won't survive multi-instance scaleout. Acceptable for YC dev demo; flag for prod.

### 12.5 Health checks
- [ ] `GET /api/health` — public, returns service breakdown
- [ ] `GET /api/health/detailed` — expanded metrics

---

## Phase 13 — Billing & Stripe

### 13.1 Subscription create
- [ ] Pick a paid tier from `/settings/subscription` → checkout session opens
- [ ] Pay with Stripe test card `4242 4242 4242 4242`
- [ ] Returns to `/checkout/complete` → Stripe webhook `customer.subscription.created` fires → subscription doc updated to active
- [ ] Verify in `/settings/billing` — tier reflects new plan

### 13.2 Coupon
- [ ] Create coupon in `/settings/promotions` (or `/coupons`)
- [ ] Apply at checkout → discount applied
- 🛑 Coupons are Stripe-only per agent report. Other payment providers ignore the field. Decide.

### 13.3 Stripe webhook
- [ ] Trigger `customer.subscription.updated` via Stripe CLI → SV `subscriptions` doc updates
- [ ] Trigger `customer.subscription.deleted` → status flips to cancelled
- [ ] Trigger `charge.refunded` → revenue analytics reflect
- [ ] Verify event stored in `stripe_events` collection (audit trail)
- [ ] Verify 200 returned on permanent failures, 500 on transient (Stripe retries)
- 🛑 No replay mechanism if a webhook permanently fails. Document or build a recovery script.

### 13.4 Cancel / Reactivate
- [ ] Cancel via in-app `/settings/billing` button — confirm Firestore + Stripe both updated
- [ ] Reactivate flow → Stripe + Firestore stay in sync
- [ ] Try cancelling via Stripe Portal directly — webhook should still update SV

### 13.5 Provider-agnostic check
- [ ] PayPal flow (if enabled)
- [ ] Authorize.Net (if enabled)
- 🛑 Other providers (Square, Paddle, Chargebee) — ship if used, hide if not. Don't leave dead code paths.

---

## Phase 14 — Profile / Sites / Store / Preview routes

These live under `src/app/` (not in `(dashboard)`) and may be public-facing:
- [ ] `/profile` — user public profile?
- [ ] `/sites/[siteSlug]` — published websites? Verify SSR/static rendering
- [ ] `/store/...` — public storefront? Verify checkout works for an end-buyer
- [ ] `/preview/...` — page/post preview before publish

---

## Phase 15 — End-to-End Customer Journey (the YC story)

Walk one fictional customer through the entire platform top to bottom in a single sitting. This is the demo you'll show YC.

1. **Visit homepage** → fill early-access → schedule demo
2. **Demo arrives** → join Zoom → talk through platform
3. **Receive invite** → accept signup → walk onboarding → fill Brand DNA
4. **Connect integrations** — at minimum Stripe + Gmail + Calendar + 1 social platform
5. **Import leads** (CSV) → verify duplicates flagged
6. **Run lead through the full lifecycle**:
   - Lead created → enriched → scored
   - Convert lead → Deal
   - Schedule meeting via Jasper
   - Generate proposal email via Email Writer
   - Send via Gmail
   - Track open + click
   - Update deal stage → Mark Won
   - Auto-create invoice
   - Stripe payment recorded
7. **Run a campaign**:
   - Jasper command: "Launch a 3-day email sequence promoting our new feature to leads tagged 'engaged'"
   - Walk plan approval → execution → grading → GM version evolution
8. **Generate content**:
   - Magic Studio: image + video + caption for 3 social platforms
   - Approve in social approvals queue
   - Schedule posts
   - Verify they actually publish
9. **Build a website page** via AI generate → publish to custom domain
10. **Voice AI inbound call** — receive call → AI handles → transcript saved → CRM updated

If any step in this chain breaks: priority-1 fix before YC.

---

## Phase 16 — Known Gaps Triage (decide before YC)

Below are every gap surfaced across the 8 inventories. Each needs a decision: **fix**, **hide**, or **accept and document**.

### 16.1 Two-step destructive confirmations missing (project-rule violations)
| Surface | Action | Severity |
|---|---|---|
| `/settings/account` | Delete Account (text-confirm only, no second click) | LOW (gated by typing) |
| `/settings/users` | Remove User (modal but single-click) | MED |
| `/settings/users` | Role change (immediate on dropdown change, no undo) | HIGH |
| `/settings/api-keys` | Delete key (single click, no confirm) | HIGH |
| `/settings/integrations` | Disconnect (single click) on every integration except Zoom | HIGH (project rule) |
| `/settings/billing` | Cancel Subscription (single click) | HIGH |
| `/settings/billing` | Reactivate (single click) | LOW |
| `/settings/webhooks` | Active toggle (single click) | LOW (recoverable) |
| `/social/calendar` | Drag-to-reschedule (immediate fire) | LOW |

**Recommendation**: Roll out the Zoom two-step pattern across all of these in one PR before YC. ~1 hour of work; preempts the "this app is dangerous" reviewer reaction.

### 16.2 Stub / partial pages
| Page | Status | Recommendation |
|---|---|---|
| `/living-ledger` | Stub | Hide from sidebar |
| `/battlecards` | Stub | Hide or populate |
| `/compliance-reports` | Stub UI, original Rapid Compliance branding | Decide: relabel + hide, or wire compliance |
| `/companies/[id]` | Detail page missing | Build minimal detail or hide rows from being clickable |
| `/calls/make` | Page may not exist | Verify; if missing, every "Make Call" button is a 404 |
| `/nurture/[id]` and `/nurture/[id]/stats` | Editor not visible | Build or hide |
| Custom Tools (`/settings/custom-tools`) | CRUD works, agent invocation unclear | Verify Jasper can call a custom tool; if not, mark "Coming Soon" |
| Lead Scoring rules editor | Name/desc only, no weight UI | Build or hide |
| Email campaign body | Plain textarea, no rich editor | Document MVP, or ship rich text |
| Conversations "Take Over" | No human-agent interface | Build or remove button |

### 16.3 Navigation-only stubs (CTAs that go nowhere useful)
| Surface | Button | Issue |
|---|---|---|
| `/leads/[id]` | "Add to Sequence" | Routes but no enrollment fires |
| `/leads/[id]` | Empty-state "Score Your Leads" | No onClick handler |
| `/deals/[id]` | "Schedule Meeting" | Routes but booking not wired in deal context |
| `/contacts/[id]` | "Make Call" | Depends on `/calls/make` existing |

### 16.4 Standing-rule traps
| Issue | Risk |
|---|---|
| Brand DNA save with no UI reseed → specialists keep stale voice | Standing Rule #1 violation surfaces as inconsistent demo |
| Manager auto-review intentionally OFF (commented out) | Per memory — leave commented; do NOT "restore" if a fixer agent suggests it |
| `/settings/automation` auto-approve toggle | Default OFF per memory; never default ON |

### 16.5 External / blocked items (visible status, no path to ship before YC)
- LinkedIn (1–3 weeks for Marketing Developer Platform approval)
- TikTok (pending app icon, demo video, scope selection)
- YouTube (Google OAuth verification, 1–4 weeks)
- Pinterest (Developer Portal approval, 1–3 days — could ship)
- Discord, Twitch, Google Business (need central dev app registration — could ship in <1 day)
- Meta family — unblock no sooner than May 1–2 per memory
- Twilio toll-free under review

**Decision**: For YC submission, the "Coming Soon" UX is fine as long as it's honest. Make sure no "Connected" badge fakes any of these.

### 16.6 Memory gates
- Telegram + Reddit marked for deletion (per memory) — actually delete vs leave parked? ~12 files for Telegram.
- Multi-tenant flip is week of May 4–10 — anything tested in penthouse mode needs to be re-verified post-flip.

---

## Phase 17 — Orchestrated / Automated Re-test (after manual)

The manual walk catches surprises. The orchestrated re-run is for regression hardening so YC questions ("what happens when X?") can be answered with confidence.

### 17.1 Playwright-scriptable paths (high ROI)
- [ ] Sign up / login / forgot password
- [ ] Onboarding wizard end-to-end
- [ ] CRM lead → contact → deal → won flow
- [ ] Campaign create → schedule → status updates
- [ ] Form publish + submit cycle
- [ ] Website page AI generate → publish
- [ ] Settings save round-trips (theme, security, brand-dna, organization)
- [ ] Mission Control plan approval → step grading → GM version creation

### 17.2 Backend integration tests already in repo (run all)
- [ ] `scripts/verify-brand-dna-injection.ts`
- [ ] `scripts/verify-no-grades-no-changes.ts`
- [ ] `scripts/verify-prompt-edit-changes-behavior.ts`
- [ ] `scripts/verify-managers-review.ts`
- [ ] `scripts/verify-content-manager-review.ts`
- [ ] `scripts/verify-prompt-engineer.ts`
- [ ] `scripts/verify-mission-plan-lifecycle.ts`
- [ ] `scripts/verify-mission-execution-lifecycle.ts`
- [ ] `scripts/verify-upstream-changed-flag.ts`

### 17.3 Cron manual triggers (script a one-shot harness)
Build a single `scripts/manual-cron-fire.ts` that, given a cron route name + the CRON_SECRET, fires the cron. Saves waiting hours.

### 17.4 What stays manual (cannot be automated cheaply)
- OAuth callbacks (third-party browsers + 2FA)
- Real email/SMS deliverability checks (need real inbox)
- Voice AI calls (need real phone)
- Stripe webhook signature verification (use Stripe CLI in `stripe listen` mode for the run)
- Brand DNA "voice match" subjective grading

---

## Pre-Submission Checklist

Before clicking submit on the YC application:

- [ ] All Phase 1–15 boxes ticked
- [ ] All Phase 16 items have an explicit decision (fix / hide / accept)
- [ ] All 🛑 markers resolved
- [ ] No `console.error` on any walked route
- [ ] No `404` on any sidebar link
- [ ] No "TODO" or "Coming Soon" copy where it shouldn't be
- [ ] All secrets pasted in Claude transcripts during integration setup are **rotated** (per memory `project_rotate_secrets_in_transcript.md`)
- [ ] `git status` clean, all work pushed to `dev`
- [ ] `docs/single_source_of_truth.md` updated with this session's deltas

---

## Appendix A — File References (for fast jumping during walkthrough)

- Sidebar: `src/components/admin/AdminSidebar.tsx`
- Mission Control: `src/app/(dashboard)/mission-control/page.tsx` (2513 lines)
- Mission Control review: `src/app/(dashboard)/mission-control/review/page.tsx`
- Mission Control history: `src/app/(dashboard)/mission-control/history/page.tsx`
- Step grade widget: `src/app/(dashboard)/mission-control/_components/StepGradeWidget.tsx`
- Specialist version history: `src/app/(dashboard)/mission-control/_components/SpecialistVersionHistory.tsx`
- BaseManager: `src/lib/agents/base-manager.ts`
- Master Orchestrator: `src/lib/agents/orchestrator/manager.ts`
- Prompt Engineer: `src/lib/agents/prompt-engineer/specialist.ts`
- Brand DNA settings: `src/app/(dashboard)/settings/brand-dna/page.tsx`
- Reseed script: `scripts/reseed-all-gms.js`
- Cron schedule: `vercel.json`
- Settings index: `src/app/(dashboard)/settings/page.tsx`
- API keys settings: `src/app/(dashboard)/settings/api-keys/page.tsx`
- Integrations hub: `src/app/(dashboard)/settings/integrations/page.tsx`
- Booking: `src/app/api/booking/route.ts`
- Scheduled reminders cron: `src/app/api/cron/scheduled-reminders/route.ts`
- Operations cycle cron: `src/app/api/cron/operations-cycle/route.ts`
- Magic Studio: `src/app/(dashboard)/content/video/studio/`
- Forms: `src/app/(dashboard)/forms/`
- Workflows: `src/app/(dashboard)/workflows/`
- Risk: `src/app/(dashboard)/risk/page.tsx`
- Coaching: `src/app/(dashboard)/coaching/page.tsx`
- System impersonate: `src/app/(dashboard)/system/impersonate/page.tsx`

---

*Built from 8 parallel inventory passes. Updated whenever the surface meaningfully changes.*
