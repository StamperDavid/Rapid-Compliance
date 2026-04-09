# SalesVelocity.ai — Pre-Multi-Tenant Completion Plan

**Always** review CLAUDE.md rules before starting any task.
**Design System Compliance (CLAUDE.md section 2) is BINDING** — all new UI must use PageTitle, text-foreground, responsive grids, Button component, etc.

## Context
Repository: https://github.com/StamperDavid/Rapid-Compliance
Branch: dev
Last Updated: April 8, 2026
**Status: SOLIDIFYING PLATFORM BEFORE MULTI-TENANT CONVERSION**

## What Was Completed (April 8, 2026 Session)

### Design System Foundation
- Added shadcn-compatible component tokens to globals.css (--background, --foreground, --card, --muted, --destructive, --input, --ring)
- Extended tailwind.config.ts with full token mapping
- Created Typography components: PageTitle, SectionTitle, SubsectionTitle, CardTitle, SectionDescription, Caption (`src/components/ui/typography.tsx`)
- Created PageContainer component (`src/components/ui/page-container.tsx`)
- **67 dashboard pages** converted from inline styles to design system Tailwind classes
- Design System Compliance added as binding rule in CLAUDE.md section 2

### Navigation Restructure (COMPLETED)
- **Outreach section eliminated** — Email Studio (with Sequences/Templates as tabs) and Calls moved to Marketing
- **Catalog section eliminated** — Products & Services moved to CRM, Coupons to Marketing, Subscriptions to CRM
- **CRM reduced from 12 items to 7:** Leads, Contacts, Companies, Deals, Conversations, Products & Services, Subscriptions
- **Marketing now has 8 items:** Campaigns, Social Hub, Content Generator, Email Studio, Calls, Forms, Workflows, Coupons
- AI Workforce and System changed to standalone direct links (no dropdown)
- Integrations link removed from sidebar footer (already in Settings)
- ThemeToggle removed from footer (no light mode CSS exists yet)
- Sidebar hrefs fixed: Pages→/website/pages, Blog Posts→/website/blog, Domains→/website/domains

### New Pages Built (Phase 1)
- `/tasks` — full CRUD, priority badges, status filters, create modal, completion toggle
- `/activities` — timeline view, type filters, pagination
- `/coupons` — card grid, status toggle, create/delete modals
- `/subscriptions` — plan display, billing portal, upgrade CTA
- `/website/domains` — rewritten with design system, DNS records, verification, add/remove

### Orphaned Pages Deleted
- `/academy/courses`, `/academy/courses/[id]`, `/academy/certifications` — wrong model, Academy page is correct as-is (video tutorial library)

### Key Architecture Decisions Made
1. **Quotes + Proposals = merged** → "Proposals/Quotes" becomes a tab on the Leads page
2. **Every purchase is a deal** — even e-commerce checkout auto-creates a Closed Won deal with Order, Invoice, Payment attached
3. **Orders = tab on Deals** (not standalone, because every order is part of a deal)
4. **Invoices = tab on Deals**
5. **Payments = tab on Deals**
6. **Tasks = tab on Deals (deal-related) + standalone /tasks page for "My Tasks" linked from Dashboard**
7. **Activities = tab on Dashboard page** (system-wide activity log)
8. **Intelligence Hub = tab on Leads page** ("Research")
9. **Academy = read-only video tutorial library** for learning the platform. Clients cannot edit. Separate from "Tutorial" video type in the content generator (client-created tutorials).
10. **Products/Services belong in CRM** — they're sales tools attached to deals, not a separate "Catalog"
11. **Subscriptions = customer subscriptions** (the client's customers), NOT the client's own SalesVelocity.ai subscription

---

## REMAINING WORK — Prioritized

### Phase 2: Build Companies & Email Templates (type + service + API + page)
**Companies** needs:
- Proper `Company` type in `src/types/` (currently minimal in duplicate-detection.ts)
- `company-service.ts` with CRUD
- `/api/crm/companies/` routes (GET list, POST create, GET by ID, PUT, DELETE)
- Dedicated `/companies` page (currently served by generic entity page)
- Contact roll-up, deal association, lifetime value display

**Email Templates** needs:
- User-editable `EmailTemplate` type (distinct from static sales templates and ecommerce inline templates)
- `getEmailTemplatesCollection()` in collections.ts
- CRUD service
- `/api/email-templates/` routes
- Page with template editor, variable support, preview
- NOTE: Three conflicting EmailTemplate shapes exist — reconcile into one

### Phase 3: Build Quotes/Invoices/Payments with Cross-Entity Linking
**Quotes** — ZERO infrastructure exists. Needs type, service, collection, full API. Links to deals, contacts, line items from Products & Services.
**Invoices (standalone CRM)** — Ecommerce invoice generator exists (PDF for orders). CRM invoice entity needs separate type/service/API linking to quotes, deals, contacts.
**Payments (standalone CRM)** — Ecommerce payment processing exists. CRM payment records linking to invoices, deals, contacts need to be built.

The revenue flow: Deal → Quote → Invoice → Payment. Each step must link to the previous.

### Phase 4: Wire Orphaned Pages
| Page | What It Is | Where to Wire |
|------|-----------|---------------|
| `/living-ledger` | AI-powered deal health monitoring + next best actions | Need to understand purpose better — read the code first |
| `/settings/brand-kit` | Brand asset management (logo, colors, fonts for video/content) | Add card to Settings hub |
| `/settings/meeting-scheduler` | Meeting booking config (demo calls, discovery calls) | Add card to Settings hub |
| `/settings/music-library` | Music library for video production | Tab in Content Generator |
| `/tools/[toolId]` | Custom tool viewer (iframe wrapper for 3rd party apps) | Wire from /settings/custom-tools |

### Phase 5: Light Mode
- Build light-mode CSS variable overrides in globals.css (`:root.light { ... }`)
- Re-enable ThemeToggle in sidebar footer
- Test all 161+ pages in light mode

### Phase 6: Fix Ecommerce Disconnects
- Two checkout flows create orders with different shapes — unify
- Coupon input missing from storefront checkout UI
- Storefront checkout uses client SDK (will fail with Firestore security rules)
- Missing webhook handlers: Chargebee, Square, Hyperswitch, Braintree
- Razorpay and Braintree not in checkout initiate/complete maps

### Phase 7: Kill 36 `any` Types in API Routes
- 36 occurrences across 28 API route files need proper typing

### Phase 8: Fix 82 Inline Firestore Paths
- 82 files build collection paths with template literals instead of using `getSubCollection()` helpers

### Phase 9: Multi-Tenant Conversion
1. `getSubCollection(orgId, sub)` refactor — add orgId param, update 1,224 call sites
2. `AuthUser` gets `orgId` — auth layer resolves tenant from user record or custom claims
3. `apiKeyService.getKeys()` must use its orgId parameter (currently ignores it)
4. `BaseAgentDAL.getPlatformSubCollection()` needs orgId parameter
5. OAuth state params in QuickBooks + Zoom — use resolved orgId, not hardcoded constant
6. Jasper system prompts — dynamically inject org identity at runtime

### Phase 10: QA & Launch
- Run QA phases 1-16 (244 test cases, only Phase 0 complete)
- Golden Master learning loop (Phase 2 from CONTINUATION_PROMPT_PHASE2.md)
- Missing API keys: Stripe .env, Fal.ai, DataForSEO, Twilio phone
- Dogfood as tenant #1
- Onboard beta customers

---

## Settings Page Cleanup (Approved)
- Remove "Analytics & Reporting" section (it's a nav shortcut, not a setting)
- Merge "Outbound Sales" into Core Configuration → Billing
- Move "Advanced → Workflows" config into the Workflows page itself (gear icon/settings tab)
- Move "Advanced → AI Agents" to Feature Modules (already accessible via AI Workforce sidebar)
- Update "E-Commerce → Promotions" link to point to `/coupons`
- Move "Compliance & Admin → Impersonate" to System page (owner only)
- Result: 7 settings sections instead of 11

## Consolidation Notes (NOT YET IMPLEMENTED — Owner must approve)
- CRM sidebar could be further reduced if Proposals/Quotes become a tab on Leads
- Email Studio should absorb Sequences and Templates as tabs (discussed, nav updated, tab wiring TBD)
- Activities should become a Dashboard tab (discussed, not yet wired)
- Tasks should be a tab on Deals for deal-specific tasks (discussed, not yet wired)
