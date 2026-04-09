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

### Phase 2: Build Companies & Email Templates — COMPLETED (April 9, 2026)
- `src/types/company.ts` — Full Company type with address, size, status
- `src/lib/crm/company-service.ts` — CRUD + search + company rollup (contact/deal counts, LTV)
- `src/app/api/crm/companies/` — GET/POST list + GET/PUT/DELETE by ID
- `src/app/(dashboard)/companies/page.tsx` — Dedicated page with DataTable, create modal, bulk delete
- `src/types/email-template.ts` — Unified `UserEmailTemplate` type (reconciled 3 conflicting shapes)
- `src/lib/email/email-template-service.ts` — CRUD + renderTemplate() for variable substitution
- `src/app/api/email-templates/` — Full CRUD API
- Sidebar updated: Companies → `/companies` (was `/entities/companies`)

### Phase 3: Build Quotes/Invoices/Payments — COMPLETED (April 9, 2026)
Revenue flow: **Deal → Quote → Invoice → Payment** (each entity links to the previous)
- `src/types/quote.ts` — Quote with QuoteLineItem, QuoteLineItemInput, status lifecycle
- `src/types/invoice.ts` — CRM Invoice (separate from ecommerce), reuses QuoteLineItem
- `src/types/payment.ts` — CRM Payment records with method tracking
- `src/lib/crm/quote-service.ts` — CRUD, totals calculation, quote-to-invoice conversion
- `src/lib/crm/invoice-service.ts` — CRUD, payment recording, status auto-update
- `src/lib/crm/payment-service.ts` — CRUD, auto-updates linked invoice
- API routes for all three: `/api/crm/quotes/`, `/api/crm/invoices/`, `/api/crm/payments/`
- Special: `POST /api/crm/quotes/[quoteId]/convert` — converts accepted quote to invoice

**Tab wiring completed:**
- Leads hub: All Leads | **Proposals / Quotes** | Intelligence Hub | Scoring
- Deals hub: All Deals | **Orders** | **Invoices** | **Payments** | **Tasks** | Risk
- Dashboard hub: Dashboard | **Activities** | Executive Briefing | Workforce HQ | Team

### Phase 4: Wire Orphaned Pages + Settings Cleanup — COMPLETED (April 9, 2026)
| Page | Wired To |
|------|----------|
| `/living-ledger` | Added as "Living Ledger" tab on Deals hub + SubpageNav added to page |
| `/settings/brand-kit` | Added card to Settings > Customization section |
| `/settings/meeting-scheduler` | Added card to Settings > Core Configuration section |
| `/settings/music-library` | Added card to Settings > Customization section (admin-only backend) |
| `/tools/[toolId]` | Already wired — Settings > Integrations > Custom Tools links to `/settings/custom-tools` |

**Settings cleanup (approved plan executed):**
- Removed "Analytics & Reporting" section (was just a nav shortcut to /analytics)
- Merged "Outbound Sales" subscription into Billing card description
- Removed "Advanced → Workflows" and "Advanced → AI Agents" (accessible via sidebar)
- Updated Promotions link to `/coupons` (where the page actually lives)
- Removed Impersonate from Compliance (already at `/system/impersonate` via System page)
- Result: **8 settings sections** (down from 11)

### Phase 5: Light Mode — COMPLETED (April 9, 2026)
- `html.light` CSS block in globals.css overrides 30+ variables (backgrounds, text, borders, component tokens, sidebar, admin scope)
- ThemeToggle re-enabled in sidebar footer (between Help and Sign Out)
- Uses `next-themes` class-based switching (`darkMode: 'class'` in Tailwind)
- Brand colors (primary, secondary, accent, semantic) stay consistent across modes
- Light backgrounds: #f8fafc (main), #ffffff (paper/card), #f1f5f9 (elevated/muted)
- Light text: #0f172a (primary), #64748b (secondary), #94a3b8 (disabled)
- Light borders: #e2e8f0 (main), #cbd5e1 (light), #94a3b8 (strong)

### Phase 6: Fix Ecommerce Disconnects — COMPLETED (April 9, 2026)
1. **checkout-service.ts switched from client SDK to AdminFirestoreService** — all 6 `FirestoreService.*` calls replaced with `AdminFirestoreService.*` (server-side Admin SDK). Fixed `shipping` field collision bug (was overwriting numeric cost with shipping info object — now correctly uses `shippingInfo` key).
2. **Order shapes unified** — `/api/checkout/complete` now creates canonical orders with `orderNumber`, `customer` (firstName/lastName/email), full `OrderItem[]` with productId/sku/variants, `fulfillmentStatus`, `subtotal`/`tax`/`shipping`/`discount`/`total` line items, `shippingInfo`, and `payment` with `OrderPayment` shape. Shared `checkout-types.ts` with `buildOrderData()` helper used by all 4 payment forms (Stripe, Adyen, Hyperswitch, Paddle).
3. **Razorpay and Braintree added to checkout maps** — both providers added to `PROVIDER_MAP` (initiate), `VERIFIER_MAP` (complete), and `checkoutCompleteSchema` validation enum. `razorpay` also added to `PaymentProvider` type union.
4. **Discount code input added to storefront checkout** — coupon input field in order summary with apply/remove via `/api/ecommerce/cart/discount` API. Shows applied codes as removable tags and discount line item when active.
5. **Webhook handlers already existed** — Chargebee, Square, Hyperswitch, Braintree, and Razorpay all had full implementations.

### Phase 7: Kill `any` Types in API Routes — COMPLETED (April 9, 2026)
- All `any` types in API routes were already eliminated in prior sessions. Zero instances found via grep.

### Phase 8: Fix Inline Firestore Paths — COMPLETED (April 9, 2026)
- 67 inline `organizations/${PLATFORM_ID}/xxx` paths across 48 files replaced with `getSubCollection('xxx')` from `src/lib/firebase/collections.ts`
- 4 remaining are Firebase Storage paths (not Firestore) — correctly excluded
- Settings doc paths use `${getSubCollection('settings')}/doc-name` pattern
- Nested sub-collection paths use `${getSubCollection('parent')}/${id}/child` pattern
- All files import `getSubCollection` from `@/lib/firebase/collections`

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
