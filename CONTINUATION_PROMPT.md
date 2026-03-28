# SalesVelocity.ai — Manual QA & Launch Readiness Plan

**Always** review CLAUDE.md rules before starting a task

## Context
Repository: https://github.com/StamperDavid/Rapid-Compliance
Branch: dev
Last Updated: March 27, 2026
**Status: MANUAL QA IN PROGRESS — Pre-launch validation**

## Mission

Walk through every feature and function of the platform end-to-end. Find and fix bugs. Identify design improvements. Validate launch readiness. Then convert back to multi-tenant and launch.

## How This Works

- David tests each phase manually in the browser at `localhost:3000`
- Reports findings (bugs, broken features, UX observations, design ideas) back to Claude
- Claude diagnoses from code, fixes bugs, implements improvements
- Each phase is marked with metrics as it completes
- After all phases pass, we proceed to multi-tenant conversion and launch

---

## Architecture Snapshot

- **162 pages** (143 dashboard + 18 public + 1 auth)
- **429+ API routes**
- **59 AI agents** (46 swarm + 7 standalone + 6 QA)
- **16 operational systems**
- **4-role RBAC** (owner/admin/manager/member, 47 permissions)
- **Single-tenant penthouse** → will convert to multi-tenant after QA

---

## Phase Tracker

| Phase | System | Tests | Pass | Fail | Observations | Status |
|-------|--------|-------|------|------|-------------|--------|
| 0 | Foundation & Auth | 11 | 10 | 0 | 1 skipped (signup — multi-tenant) | COMPLETE |
| 1 | Jasper & Mission Control | 18 | — | — | — | IN PROGRESS |
| 2 | CRM & Sales Pipeline | 22 | — | — | — | NOT STARTED |
| 3 | Email & Communications | 16 | — | — | — | NOT STARTED |
| 4 | Social Media | 14 | — | — | — | NOT STARTED |
| 5 | Website Builder & Blog | 18 | — | — | — | NOT STARTED |
| 6 | Video & Creative Studio | 20 | — | — | — | NOT STARTED |
| 7 | Voice AI & Calls | 10 | — | — | — | NOT STARTED |
| 8 | Payments & E-Commerce | 18 | — | — | — | NOT STARTED |
| 9 | Workflows & Automation | 12 | — | — | — | NOT STARTED |
| 10 | Forms & Data Capture | 10 | — | — | — | NOT STARTED |
| 11 | SEO & Growth | 14 | — | — | — | NOT STARTED |
| 12 | Analytics & Reporting | 12 | — | — | — | NOT STARTED |
| 13 | Settings & Configuration | 16 | — | — | — | NOT STARTED |
| 14 | Team, Coaching & Performance | 10 | — | — | — | NOT STARTED |
| 15 | Public Pages & Onboarding | 14 | — | — | — | NOT STARTED |
| 16 | Cross-System Integration | 10 | — | — | — | NOT STARTED |
| **TOTAL** | | **236** | **—** | **—** | **—** | |

---

## Phase 0: Foundation & Auth (12 tests)

**Goal:** Verify the platform boots, auth works, RBAC enforces, and navigation is correct.

| # | Test | Steps | Expected | Result | Notes |
|---|------|-------|----------|--------|-------|
| 0.1 | App loads | Navigate to `localhost:3000` | Landing page renders, no console errors | PASS | Dev passcode gate shows first (by design), then landing page loads |
| 0.2 | Login flow | Click Login → enter credentials → submit | Redirects to dashboard, user context loaded | PASS | Slow on cold compile (~15s), works after cache warm |
| 0.3 | Dashboard loads | After login, dashboard page renders | Shows widgets, stats, no blank panels | PASS | KPIs render. Recent Activity blank (fresh env, expected). Commerce/Analytics are nav-link cards by design. **Jasper Setup Assistant fixed:** wrong Firestore path for API keys + broken persona/knowledge base links |
| 0.4 | Sidebar navigation | Click each top-level nav item | All 9 sections expand/navigate correctly | PASS | |
| 0.5 | Owner permissions | As owner, visit `/settings/users` | Full access, can manage all users | PASS | **4 bugs fixed:** (1) GET didn't filter soft-deleted users. (2) Pending invites not shown in list. (3) Deleting an invite hit wrong endpoint (404). (4) SendGrid sender identity unverified — recreated and verified `dstamper@salesvelocity.ai` via API. Invite emails now sending. |
| 0.6 | RBAC — restricted page | As member role, visit `/settings/api-keys` | Access denied or appropriate gating | PASS | Tested with admin account — System nav section hidden for non-owner roles. RBAC sidebar gating confirmed working. |
| 0.7 | Logout flow | Click logout | Redirected to login, session cleared | PASS | |
| 0.8 | Signup flow | Visit `/signup`, create new account | Account created, onboarding starts | SKIP | Standalone signup not applicable in single-tenant mode. Invite flow is the correct user-add path. Revisit when multi-tenant is re-enabled. |
| 0.9 | Forgot password | Visit `/forgot-password`, enter email | Reset email sent (or appropriate message) | PASS | Firebase Auth sends reset email. Lands in spam (from noreply@rapid-compliance-65f87.firebaseapp.com). |
| 0.10 | Session persistence | Login, close tab, reopen `localhost:3000` | Still logged in (token not expired) | PASS | Session persists — `/dashboard` loads logged in after closing/reopening tab. |
| 0.11 | API auth enforcement | Open DevTools → hit `/api/orchestrator/chat` without auth | Returns 401, not 500 | PASS | POST returns 401 as expected. GET returns 200 (no GET handler — harmless). |
| ~~0.12~~ | ~~Feature toggle system~~ | REMOVED | N/A | N/A | Feature toggles replaced with nav restructure — no longer applicable. |

---

## Phase 1: Jasper Orchestrator & Mission Control (18 tests)

**Goal:** Jasper responds, calls tools, creates missions, and Mission Control displays them correctly.

| # | Test | Steps | Expected | Result | Notes |
|---|------|-------|----------|--------|-------|
| 1.1 | Jasper opens | Click Jasper chat icon | Chat panel opens, welcome message shows | PASS | |
| 1.2 | Simple conversation | Type "Hello, what can you do?" | Jasper responds with capabilities, no tool calls | PASS | Clean capabilities overview, no tool calls. |
| 1.3 | Tool invocation | "Show me my recent leads" | Jasper calls CRM tool, returns real data | PASS | Tools called: score_leads, get_system_state, enrich_lead. Empty results (fresh env). Response should say "no leads found" more explicitly — prompt tuning item. |
| 1.4 | Delegation | "Create a blog post about AI in sales" | Jasper delegates to content team, mission created | PARTIAL | Blog saved via `save_blog_draft` (works). **Bugs fixed:** (1) Blog editor crash — `section.columns` guard. (2) Review link → Mission Control. (3) `delegate_to_content` label → "Content" not "Video Studio". (4) Review page rendered raw JSON → now shows readable specialist report. **Known issue:** `delegate_to_content` agent broken — copywriter expects `method` but manager sends `action`, 6/7 specialists fail. Jasper prompt updated to use `save_blog_draft` directly for blog posts. Content agent contract mismatch needs dedicated fix. |
| 1.5 | Mission appears | After 1.4, navigate to `/mission-control` | One mission visible with correct title | PASS | Shows in History tab. Live tab filters out completed missions >10min — fixed deep-link to always include targeted mission. |
| 1.6 | No duplicate missions | Check mission list after 1.4 | Exactly ONE mission, not two or more | PASS | 3 missions in history, no duplicates. |
| 1.7 | Mission steps | Click on the mission from 1.4 | Steps visible (RUNNING → COMPLETED), correct tool names | PASS | 2 steps shown: Content + Save Blog Draft, both COMPLETED with progress bar. |
| 1.8 | Mission SSE streaming | Watch mission while Jasper works | Status updates in real-time without refresh | | |
| 1.9 | Review link | After delegation completes, check Jasper's response | Contains clickable review link to the output page | | |
| 1.10 | Mission cancel | Create a mission, then click Cancel | Mission status changes to FAILED, "Cancelled by user" | | |
| 1.11 | Mission delete | Click delete on a completed mission | Mission removed from list | | |
| 1.12 | Clear all | Click "Clear All" on completed/failed missions | All terminal missions removed | | |
| 1.13 | Mission history | Navigate to `/mission-control/history` | Past missions listed with filters | | |
| 1.14 | Campaign creation | "Build a campaign: blog + video + social post about X" | Campaign created with multiple deliverables | | |
| 1.15 | Campaign review | Navigate to mission-control with campaign filter | All deliverables shown as cards with approve/reject | | |
| 1.16 | Error display | Trigger an error (e.g., ask about unconfigured service) | Jasper shows the real error message, not a generic one | | |
| 1.17 | Model selection | Change model in Jasper settings | Subsequent responses use selected model | | |
| 1.18 | Retry on failure | If OpenRouter fails, check behavior | Jasper retries (up to 2x) before showing error | | |

---

## Phase 2: CRM & Sales Pipeline (22 tests)

**Goal:** Full CRUD on contacts, leads, deals. Scoring, enrichment, and pipeline stages work.

| # | Test | Steps | Expected | Result | Notes |
|---|------|-------|----------|--------|-------|
| 2.1 | Leads list | Navigate to `/leads` | List loads with existing leads (or empty state) | | |
| 2.2 | Create lead | Click "New Lead" → fill form → save | Lead created, appears in list | | |
| 2.3 | Lead detail | Click on a lead | Detail page shows all fields, activity timeline | | |
| 2.4 | Edit lead | Edit lead fields → save | Changes persist on reload | | |
| 2.5 | Delete lead | Delete a lead | Removed from list, gone on reload | | |
| 2.6 | Lead scoring | Check lead score on detail page | Score (0-100) displayed, BANT factors shown | | |
| 2.7 | Lead enrichment | Click "Enrich" on a lead | Enrichment data populates (company, social, etc.) | | |
| 2.8 | Lead research | Navigate to `/leads/research` | Research tool loads, search works | | |
| 2.9 | Lead discovery | Navigate to `/leads/discovery` | Discovery page loads, can search for prospects | | |
| 2.10 | ICP page | Navigate to `/leads/icp` | Ideal Customer Profile page renders | | |
| 2.11 | Contacts list | Navigate to `/contacts` | List loads correctly | | |
| 2.12 | Create contact | Create new contact with full details | Contact saved, all fields persist | | |
| 2.13 | Contact detail | Click into contact → check all tabs | Tabs load: overview, activity, deals, emails | | |
| 2.14 | Deals list | Navigate to `/deals` | Pipeline view or list view loads | | |
| 2.15 | Create deal | Create new deal, assign to contact/lead | Deal created with stage, value, contact link | | |
| 2.16 | Deal stages | Drag deal to different pipeline stage | Stage updates, persists on reload | | |
| 2.17 | Deal detail | Click into deal | Full detail: value, stage, contacts, timeline | | |
| 2.18 | Search | Use search on leads/contacts/deals | Results relevant, fast response | | |
| 2.19 | Filters | Apply filters (status, score, date) | List filters correctly | | |
| 2.20 | Bulk actions | Select multiple leads → bulk action | Action applies to all selected | | |
| 2.21 | Lead scoring config | Navigate to `/lead-scoring` | Scoring rules page loads, editable | | |
| 2.22 | Conversations | Navigate to `/conversations` | Conversation list loads | | |

---

## Phase 3: Email & Communications (16 tests)

**Goal:** Email campaigns send, track opens/clicks, templates work, unsubscribe functions.

| # | Test | Steps | Expected | Result | Notes |
|---|------|-------|----------|--------|-------|
| 3.1 | Campaign list | Navigate to `/email/campaigns` | List loads with campaigns (or empty state) | | |
| 3.2 | Create campaign | Click "New Campaign" → build email → save | Campaign created as draft | | |
| 3.3 | Email builder | Navigate to `/marketing/email-builder` | Builder loads with template options | | |
| 3.4 | Send campaign | Send a campaign to a test list | Email delivered (check inbox or logs) | | |
| 3.5 | Campaign detail | Click into a campaign | Stats: sent, opened, clicked, bounced | | |
| 3.6 | Open tracking | Open a sent email | Open count increments in campaign stats | | |
| 3.7 | Click tracking | Click a link in a sent email | Click count increments, redirect works | | |
| 3.8 | Unsubscribe | Click unsubscribe link in email | `/unsubscribe` page loads, confirms opt-out | | |
| 3.9 | Email writer | Navigate to `/email-writer` | AI email composition tool loads | | |
| 3.10 | Email templates | Navigate to `/settings/email-templates` | Templates list, can create/edit | | |
| 3.11 | Nurture sequences | Navigate to `/nurture` | Sequences list loads | | |
| 3.12 | Create nurture | Create new nurture sequence with steps | Sequence saved with timing rules | | |
| 3.13 | Nurture stats | Navigate to `/nurture/[id]/stats` | Stats page renders with data | | |
| 3.14 | Outbound hub | Navigate to `/outbound` | Outbound management loads | | |
| 3.15 | Sequences | Navigate to `/outbound/sequences` | Sequences list loads | | |
| 3.16 | SMS settings | Navigate to `/settings/sms-messages` | SMS configuration page loads | | |

---

## Phase 4: Social Media (14 tests)

**Goal:** Social posting works for all wired platforms, scheduling, approvals, analytics.

| # | Test | Steps | Expected | Result | Notes |
|---|------|-------|----------|--------|-------|
| 4.1 | Social activity | Navigate to `/social/activity` | Activity feed loads | | |
| 4.2 | Post to Twitter/X | Create and publish a post to Twitter | Post published, appears in activity | | |
| 4.3 | Post to LinkedIn | Create and publish to LinkedIn | Post published (if OAuth connected) | | |
| 4.4 | Post to Bluesky | Create and publish to Bluesky | Post published (if API key set) | | |
| 4.5 | Post scheduling | Schedule a post for future time | Post saved as scheduled, appears in calendar | | |
| 4.6 | Social calendar | Navigate to `/social/calendar` | Calendar view with scheduled posts | | |
| 4.7 | Social analytics | Navigate to `/social/analytics` | Analytics dashboard with engagement data | | |
| 4.8 | Content approvals | Navigate to `/social/approvals` | Approval queue loads | | |
| 4.9 | Command center | Navigate to `/social/command-center` | Command center renders | | |
| 4.10 | Agent rules | Navigate to `/social/agent-rules` | Agent configuration page loads | | |
| 4.11 | Social listening | Navigate to `/social/listening` | Listening dashboard loads | | |
| 4.12 | Multi-platform post | Create one post, select multiple platforms | Post sent to all selected platforms | | |
| 4.13 | Social campaigns | Navigate to `/social/campaigns` | Campaigns list loads | | |
| 4.14 | Social playbook | Navigate to `/social/playbook` | Playbook page loads | | |

---

## Phase 5: Website Builder & Blog (18 tests)

**Goal:** Pages create/edit, widgets render, blog works, SEO controls function.

| # | Test | Steps | Expected | Result | Notes |
|---|------|-------|----------|--------|-------|
| 5.1 | Pages list | Navigate to `/website/pages` | Pages list loads | | |
| 5.2 | Create page | Create a new page with title and slug | Page created, visible in list | | |
| 5.3 | Page editor | Open page in `/website/editor` | Drag-drop editor loads with widget palette | | |
| 5.4 | Add widgets | Add 3-4 different widget types to a page | Widgets render correctly in editor | | |
| 5.5 | Save and preview | Save page → preview | Public page renders with all widgets | | |
| 5.6 | AI page generation | Use AI to generate a page | Page created with content and layout | | |
| 5.7 | Domain management | Navigate to `/website/domains` | Domain config page loads | | |
| 5.8 | Navigation editor | Navigate to `/website/navigation` | Nav editor loads, can add/reorder items | | |
| 5.9 | Templates | Navigate to `/website/templates` | Template gallery loads | | |
| 5.10 | Website settings | Navigate to `/website/settings` | Settings page loads with config options | | |
| 5.11 | SEO controls | Navigate to `/website/seo` | SEO management page loads | | |
| 5.12 | Blog list | Navigate to `/website/blog` | Blog posts list loads | | |
| 5.13 | Blog editor | Navigate to `/website/blog/editor` | Blog editor loads with formatting tools | | |
| 5.14 | Create blog post | Write and publish a blog post | Post published, visible on public blog | | |
| 5.15 | Blog categories | Navigate to `/website/blog/categories` | Categories management loads | | |
| 5.16 | Public blog | Visit public blog URL | Blog renders with published posts | | |
| 5.17 | Storefront | Navigate to `/website/store` | Store page loads with products | | |
| 5.18 | Audit log | Navigate to `/website/audit-log` | Audit log loads with activity | | |

---

## Phase 6: Video & Creative Studio (20 tests)

**Goal:** Video pipeline works end-to-end — storyboard → generation → assembly. Studio generates images.

| # | Test | Steps | Expected | Result | Notes |
|---|------|-------|----------|--------|-------|
| 6.1 | Video hub | Navigate to `/content/video` | Video management page loads | | |
| 6.2 | Video library | Navigate to `/content/video/library` | Library loads with existing videos (or empty) | | |
| 6.3 | Create video project | Ask Jasper to "make a video about X" | Jasper calls list_avatars → produce_video | | |
| 6.4 | Storyboard review | After 6.3, review the storyboard in Mission Control | Storyboard visible with scenes, scripts, thumbnails | | |
| 6.5 | Scene preview images | Check storyboard scenes | Preview images render (base64 from Firestore) | | |
| 6.6 | Approve storyboard | Click approve on storyboard | Status updates, ready for generation | | |
| 6.7 | Generate video | Ask Jasper to generate (after approval) | Video generation starts via Hedra API | | |
| 6.8 | Generation progress | Watch generation status | Progress updates (polling or SSE) | | |
| 6.9 | Assembly | After scenes generated, ask Jasper to assemble | FFmpeg stitching runs, final video produced | | |
| 6.10 | Video editor | Navigate to `/content/video/editor` | CapCut-style editor loads | | |
| 6.11 | Editor timeline | Add clips to timeline, reorder | Drag-and-drop works, order persists | | |
| 6.12 | Text overlays | Add text overlay to video | Overlay renders in preview | | |
| 6.13 | Image generator | Navigate to `/content/image-generator` | Image generation UI loads | | |
| 6.14 | Generate image | Enter prompt → generate | Image generated via configured provider | | |
| 6.15 | Character Studio | Navigate to video characters page | Character list loads with avatars | | |
| 6.16 | Clone Wizard | Start "Clone Yourself" flow | 5-step wizard: face upload → voice record → create | | |
| 6.17 | Voice Lab | Navigate to `/content/voice-lab` | Voice lab loads with recording/playback | | |
| 6.18 | Video calendar | Navigate to `/content/video/calendar` | Calendar view loads | | |
| 6.19 | Music library | Check background music in video editor | Music tracks available and playable | | |
| 6.20 | Simple/Advanced mode | Toggle between simple and advanced style pickers | Both modes render, preference persists | | |

---

## Phase 7: Voice AI & Calls (10 tests)

**Goal:** Voice infrastructure loads, call interface works, TTS functions.

| # | Test | Steps | Expected | Result | Notes |
|---|------|-------|----------|--------|-------|
| 7.1 | Calls list | Navigate to `/calls` | Call history loads | | |
| 7.2 | Make a call | Navigate to `/calls/make` | Call interface loads with dialer | | |
| 7.3 | Voice training | Navigate to `/voice/training` | Training center loads | | |
| 7.4 | Jasper voice mode | Enable voice in Jasper chat | TTS reads Jasper's responses | | |
| 7.5 | Voice settings | Navigate to `/settings/ai-agents/voice` | Voice configuration loads | | |
| 7.6 | TTS preview | Play a TTS preview in voice lab | Audio plays in browser | | |
| 7.7 | Voice live mode | Toggle live conversation mode in Jasper | VAD detects speech, Jasper responds | | |
| 7.8 | ElevenLabs status | Check if ElevenLabs key is configured | Key present → voice features enabled | | |
| 7.9 | Twilio status | Check if Twilio credentials configured | Status shown in settings | | |
| 7.10 | Call agent config | Check voice agent BANT qualification setup | Configuration page loads | | |

---

## Phase 8: Payments & E-Commerce (18 tests)

**Goal:** Products, checkout, Stripe integration, orders, invoices, coupons all work.

| # | Test | Steps | Expected | Result | Notes |
|---|------|-------|----------|--------|-------|
| 8.1 | Products list | Navigate to `/products` | Products list loads | | |
| 8.2 | Create product | Create new product with price | Product saved, visible in list | | |
| 8.3 | Edit product | Edit product details | Changes persist | | |
| 8.4 | Services | Navigate to `/products/services` | Services list loads | | |
| 8.5 | Storefront settings | Navigate to `/settings/storefront` | Storefront config loads | | |
| 8.6 | Orders list | Navigate to `/orders` | Orders list loads | | |
| 8.7 | Checkout flow | Trigger a checkout (Stripe test mode) | Checkout session created, redirects to Stripe | | |
| 8.8 | Order completion | Complete a test payment | Order created in Firestore with status | | |
| 8.9 | Invoice generation | After order, check for invoice | Invoice PDF generated and accessible | | |
| 8.10 | Subscription create | Create a subscription product → subscribe | Subscription active in Stripe + Firestore | | |
| 8.11 | Subscription cancel | Cancel an active subscription | Subscription cancelled, status updated | | |
| 8.12 | Coupon system | Navigate to `/settings/promotions` | Coupon management loads | | |
| 8.13 | Create coupon | Create a discount code | Coupon saved, usable at checkout | | |
| 8.14 | Apply coupon | Apply coupon during checkout | Discount applied correctly | | |
| 8.15 | Billing settings | Navigate to `/settings/billing` | Billing/subscription management UI loads | | |
| 8.16 | Subscription settings | Navigate to `/settings/subscription` | Subscription tier management loads | | |
| 8.17 | Webhook handling | Simulate Stripe webhook (CLI or event) | Firestore updated correctly | | |
| 8.18 | Proposals builder | Navigate to `/proposals/builder` | Proposal builder loads | | |

---

## Phase 9: Workflows & Automation (12 tests)

**Goal:** Workflows create, trigger, execute actions, and log results.

| # | Test | Steps | Expected | Result | Notes |
|---|------|-------|----------|--------|-------|
| 9.1 | Workflows list | Navigate to `/workflows` | Workflow list loads | | |
| 9.2 | Create workflow | Click "New Workflow" → configure | Workflow created with trigger + actions | | |
| 9.3 | Workflow detail | Click into a workflow | Config visible: trigger, conditions, actions | | |
| 9.4 | Workflow builder | Navigate to `/workflows/builder` | Visual builder loads | | |
| 9.5 | Trigger test | Manually trigger a workflow | Workflow executes, actions fire | | |
| 9.6 | Run history | Navigate to `/workflows/[id]/runs` | Execution history with status per run | | |
| 9.7 | Conditions | Add conditional logic to workflow | Conditions evaluate correctly during run | | |
| 9.8 | Email action | Workflow with "send email" action | Email sent when triggered | | |
| 9.9 | CRM action | Workflow with "update lead" action | Lead updated when triggered | | |
| 9.10 | Scheduled trigger | Create workflow with cron trigger | Workflow runs on schedule | | |
| 9.11 | Webhook trigger | Create workflow with webhook trigger | POST to webhook URL triggers workflow | | |
| 9.12 | Workflow settings | Navigate to `/settings/workflows` | Workflow settings page loads | | |

---

## Phase 10: Forms & Data Capture (10 tests)

**Goal:** Forms create, publish, submit, and feed into CRM.

| # | Test | Steps | Expected | Result | Notes |
|---|------|-------|----------|--------|-------|
| 10.1 | Forms list | Navigate to `/forms` | Forms list loads | | |
| 10.2 | Create form | Create new form with fields | Form saved, visible in list | | |
| 10.3 | Edit form | Navigate to `/forms/[formId]/edit` | Form editor loads with existing fields | | |
| 10.4 | Publish form | Publish form → get embed URL | Public form URL generated | | |
| 10.5 | Submit form | Visit public form URL → fill → submit | Submission recorded | | |
| 10.6 | Submissions list | View form submissions in dashboard | All submissions visible with data | | |
| 10.7 | CRM auto-create | Submit form with email field | Lead auto-created in CRM from submission | | |
| 10.8 | reCAPTCHA | Check spam protection on public form | CAPTCHA present and functional | | |
| 10.9 | Embedded form | Visit `/f/[formId]` | Embeddable form renders | | |
| 10.10 | Templates | Navigate to `/templates` | Form templates available | | |

---

## Phase 11: SEO & Growth (14 tests)

**Goal:** SEO tools work, keyword research returns data, rank tracking charts render, growth dashboard functional.

| # | Test | Steps | Expected | Result | Notes |
|---|------|-------|----------|--------|-------|
| 11.1 | Keywords page | Navigate to `/growth/keywords` | 3 tabs: Tracker, Research, Rank History | | |
| 11.2 | Keyword research | Enter seed keyword → search | Suggestions returned with volume data | | |
| 11.3 | Track keyword | Click "Track" on a suggestion | Keyword added to tracker tab | | |
| 11.4 | Rank history | Switch to Rank History tab → select keywords | Line chart renders with position data | | |
| 11.5 | Growth strategy | Navigate to `/growth/strategy` | Strategy page loads | | |
| 11.6 | Competitor tracking | Navigate to `/growth/competitors` | Competitor profiles load | | |
| 11.7 | Growth activity | Navigate to `/growth/activity` | Activity feed loads | | |
| 11.8 | Growth command center | Navigate to `/growth/command-center` | Command center renders | | |
| 11.9 | AI visibility | Navigate to `/growth/ai-visibility` | AI visibility dashboard loads | | |
| 11.10 | Website SEO | Navigate to `/website/seo` | SEO controls load | | |
| 11.11 | Competitor SEO | Navigate to `/website/seo/competitors` | Competitor analysis page loads | | |
| 11.12 | AI search insights | Navigate to `/website/seo/ai-search` | AI search optimization page loads | | |
| 11.13 | SEO training | Navigate to `/seo/training` | Training page loads | | |
| 11.14 | Intelligence discovery | Navigate to `/intelligence/discovery` | Discovery hub loads | | |

---

## Phase 12: Analytics & Reporting (12 tests)

**Goal:** All analytics dashboards render with real data, charts load, filters work.

| # | Test | Steps | Expected | Result | Notes |
|---|------|-------|----------|--------|-------|
| 12.1 | Analytics hub | Navigate to `/analytics` | Main analytics page loads | | |
| 12.2 | Sales analytics | Navigate to `/analytics/sales` | Sales charts and metrics render | | |
| 12.3 | Pipeline analytics | Navigate to `/analytics/pipeline` | Pipeline visualization loads | | |
| 12.4 | Revenue analytics | Navigate to `/analytics/revenue` | Revenue metrics and charts render | | |
| 12.5 | Attribution | Navigate to `/analytics/attribution` | Attribution model loads | | |
| 12.6 | E-commerce analytics | Navigate to `/analytics/ecommerce` | E-commerce metrics render | | |
| 12.7 | Workflow analytics | Navigate to `/analytics/workflows` | Workflow stats load | | |
| 12.8 | Sequence analytics | Navigate to `/sequences/analytics` | Sequence performance data loads | | |
| 12.9 | Performance | Navigate to `/performance` | Performance dashboard loads | | |
| 12.10 | Executive briefing | Navigate to `/executive-briefing` | Briefing page renders with data | | |
| 12.11 | Compliance reports | Navigate to `/compliance-reports` | Reports page loads | | |
| 12.12 | Living ledger | Navigate to `/living-ledger` | Financial ledger loads | | |

---

## Phase 13: Settings & Configuration (16 tests)

**Goal:** All settings pages load, configurations save, API keys manage correctly.

**Note:** Verify the Schema Editor (`/schemas`) is correctly wired and adapts to user profile field changes (phone, title, timezone added during profile page rebuild). Ensure custom entities and fields persist and render correctly across the system.

| # | Test | Steps | Expected | Result | Notes |
|---|------|-------|----------|--------|-------|
| 13.1 | Settings home | Navigate to `/settings` | Settings hub loads with all categories | | |
| 13.2 | Account settings | Navigate to `/settings/account` | Profile, name, email editable | | |
| 13.3 | API keys | Navigate to `/settings/api-keys` | All provider keys shown, add/edit works | | |
| 13.4 | Add API key | Add a new API key (e.g., test key) | Key saved, shows in list | | |
| 13.5 | Brand DNA | Navigate to `/settings/brand-dna` | Brand identity config loads | | |
| 13.6 | Brand kit | Navigate to `/settings/brand-kit` | Brand assets page loads | | |
| 13.7 | Theme settings | Navigate to `/settings/theme` | Theme customization loads | | |
| 13.8 | Feature toggles | Navigate to `/settings/features` | Module toggle switches work | | |
| 13.9 | Integrations | Navigate to `/settings/integrations` | Integrations page loads, OAuth connect buttons | | |
| 13.10 | Security settings | Navigate to `/settings/security` | Security config loads | | |
| 13.11 | User management | Navigate to `/settings/users` | User list with role management | | |
| 13.12 | Invite team member | Send invite from user management | Invite email sent, accept flow works | | |
| 13.13 | Webhooks config | Navigate to `/settings/webhooks` | Webhook management loads | | |
| 13.14 | Music library admin | Navigate to `/settings/music-library` | Upload status, per-track upload buttons | | |
| 13.15 | Lead routing | Navigate to `/settings/lead-routing` | Routing rules page loads | | |
| 13.16 | Meeting scheduler | Navigate to `/settings/meeting-scheduler` | Calendar integration config loads | | |

---

## Phase 14: Team, Coaching & Performance (10 tests)

**Goal:** Team features, coaching AI, leaderboards, and task management work.

| # | Test | Steps | Expected | Result | Notes |
|---|------|-------|----------|--------|-------|
| 14.1 | Coaching hub | Navigate to `/coaching` | Coaching dashboard loads with AI insights | | |
| 14.2 | Team coaching | Navigate to `/coaching/team` | Team coaching page loads | | |
| 14.3 | Leaderboard | Navigate to `/team/leaderboard` | Leaderboard renders with rankings | | |
| 14.4 | Team tasks | Navigate to `/team/tasks` | Task list loads | | |
| 14.5 | Workforce | Navigate to `/workforce` | Workforce management loads | | |
| 14.6 | Workforce performance | Navigate to `/workforce/performance` | Performance metrics load | | |
| 14.7 | Battlecards | Navigate to `/battlecards` | Sales battlecards load | | |
| 14.8 | Playbook | Navigate to `/playbook` | Business playbook loads | | |
| 14.9 | Academy | Navigate to `/academy` | Academy hub loads | | |
| 14.10 | Certifications | Navigate to `/academy/certifications` | Certifications page loads | | |

---

## Phase 15: Public Pages & Onboarding (14 tests)

**Goal:** All public pages render, onboarding flow completes, legal pages exist.

| # | Test | Steps | Expected | Result | Notes |
|---|------|-------|----------|--------|-------|
| 15.1 | Home page | Visit `/` (logged out) | Landing page renders professionally | | |
| 15.2 | Features page | Visit `/features` | Features showcase loads | | |
| 15.3 | Pricing page | Visit `/pricing` | Pricing tiers displayed | | |
| 15.4 | About page | Visit `/about` | About page renders | | |
| 15.5 | Contact page | Visit `/contact` | Contact form loads and submits | | |
| 15.6 | Demo page | Visit `/demo` | Demo booking page loads | | |
| 15.7 | Blog (public) | Visit `/blog` | Blog listing renders | | |
| 15.8 | FAQ | Visit `/faq` | FAQ page renders | | |
| 15.9 | Terms of service | Visit `/terms` | Legal text renders | | |
| 15.10 | Privacy policy | Visit `/privacy` | Legal text renders | | |
| 15.11 | Security page | Visit `/security` | Security info renders | | |
| 15.12 | Docs | Visit `/docs` | Documentation renders | | |
| 15.13 | Onboarding flow | Login as new user → complete onboarding | All steps complete, auto-save works mid-flight | | |
| 15.14 | Onboarding resume | Start onboarding → close browser → reopen | Resumes from last saved step | | |

---

## Phase 16: Cross-System Integration Tests (10 tests)

**Goal:** Systems work together — end-to-end workflows that cross feature boundaries.

| # | Test | Steps | Expected | Result | Notes |
|---|------|-------|----------|--------|-------|
| 16.1 | Lead → Deal pipeline | Create lead → score → convert to deal | Deal created with lead data carried over | | |
| 16.2 | Form → CRM → Email | Submit form → lead created → nurture sequence starts | Automated email sent to new lead | | |
| 16.3 | Jasper → Video → Campaign | Ask Jasper for campaign → video + blog + social | All deliverables in campaign review, can approve | | |
| 16.4 | Workflow → Email | Trigger workflow → sends email action | Email received with correct content | | |
| 16.5 | Social → Analytics | Post to social → check analytics | Post appears in social analytics | | |
| 16.6 | Checkout → Order → Invoice | Complete checkout → order created → invoice generated | Full commerce flow end-to-end | | |
| 16.7 | Blog → SEO | Publish blog post → check SEO sitemap | Post appears in sitemap.xml | | |
| 16.8 | Voice → CRM | Make a call → check CRM activity | Call logged on contact's activity timeline | | |
| 16.9 | Team invite → RBAC | Invite member → they sign up → verify restricted access | New user has member role, limited sidebar | | |
| 16.10 | Feature toggle cascade | Disable a module → check sidebar + routes + Jasper | Module hidden everywhere, Jasper knows it's off | | |

---

## Bug Tracker

| Bug # | Phase | Test # | Description | Severity | Status | Fix Commit |
|-------|-------|--------|-------------|----------|--------|------------|
| — | — | — | — | — | — | — |

---

## Design Observations

| # | Phase | Area | Observation | Priority | Status |
|---|-------|------|-------------|----------|--------|
| — | — | — | — | — | — |

---

## Post-QA Milestones

| Milestone | Status | Date |
|-----------|--------|------|
| All 236 tests pass | NOT STARTED | — |
| All critical bugs fixed | NOT STARTED | — |
| Design improvements implemented | NOT STARTED | — |
| Multi-tenant conversion planning | NOT STARTED | — |
| Multi-tenant implementation | NOT STARTED | — |
| Production deployment to salesvelocity.ai | NOT STARTED | — |
| Launch | NOT STARTED | — |

---

## Already Fixed This Session

| Item | Details |
|------|---------|
| Jasper mission deduplication | Added `requestId` idempotency key from client — retries reuse same missionId |
| OpenRouter retry on network failure | Added 2x retry with 2s delay on `fetch failed` / timeout / DNS errors |

---

## Completed Work (All Sessions Archived)

- **Pre-Launch Items** (March 27) — SEO keyword research + rank tracking + invite accept + music upload admin
- **Post-Audit Sprint** (March 26) — 13 items resolved across 4 commits
- **Stub Eradication** (March 25) — 8 issues, voice providers, catalog sync, workflows, forms
- **Jasper Intelligence Layer** (March 25) — Config awareness, inline setup guidance
- **Campaign Dashboard** (March 25) — `/campaigns` page, 8 templates, analytics
- **Payment System** (March 25) — 12 providers, webhook handlers, provider-agnostic dispatcher
- **AI Creative Studio** (March 16) — 250+ cinematic presets, multi-provider
- **Campaign Orchestration** (March 15) — Layers 1-4, auto-publish, feedback loop
- **Video System** (March 10) — Hedra sole engine, Clone Wizard, auto-captions, editor
