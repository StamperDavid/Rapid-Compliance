# AI SALES PLATFORM - MASTER FEATURE MAP & LOGIC DNA AUDIT

**Generated:** December 30, 2025  
**Purpose:** Complete structural audit for Master Testing & Manager AI Knowledge Base  
**Codebase Size:** 200k+ lines  
**Analysis Type:** READ-ONLY STATIC ANALYSIS

---

## TABLE OF CONTENTS

1. [Executive Summary](#executive-summary)
2. [Route Mapping - Complete URL Directory](#route-mapping)
3. [Onboarding System - 24-Step Agent Builder](#onboarding-system)
4. [Industry Template Injection - The "Secret Sauce"](#industry-template-injection)
5. [Scraper Intelligence Engine](#scraper-intelligence-engine)
6. [Social AI & Outbound Systems](#social-ai-outbound)
7. [Email Automation & Sequences](#email-automation)
8. [Native Tool Inventory](#native-tool-inventory)
9. [Database Schema & Collections](#database-schema)
10. [Workflow Automation Engine](#workflow-automation)
11. [Manager AI Instructions](#manager-ai-instructions)

---

## EXECUTIVE SUMMARY

This platform is a **multi-tenant AI-powered CRM and sales automation system** built on Next.js 14 (App Router), Firebase/Firestore, and Google Gemini AI. It features:

### Core Architecture
- **Frontend:** Next.js 14 App Router, React 18, TypeScript, Tailwind CSS
- **Backend:** Next.js API Routes, Firebase Admin SDK, Firestore
- **AI Engine:** Google Gemini, RAG (Retrieval-Augmented Generation), Vector Search
- **Auth:** Firebase Authentication with custom middleware
- **Payment:** Stripe integration for subscriptions
- **Automation:** Custom workflow engine, email sequences, SMS (Twilio)

### Key Differentiators
1. **Industry Template System** - Pre-configured CRM setups that physically transform the UI
2. **24-Step Onboarding** - Comprehensive AI agent builder with personality configuration
3. **Scraper Intelligence** - Automated web research with signal detection and lead scoring
4. **Golden Master Architecture** - One master AI agent template spawns ephemeral instances
5. **Website Builder** - Multi-tenant website creation with custom domains
6. **E-commerce Integration** - Full shopping cart, checkout, and order management

---

## ROUTE MAPPING

### App Router Structure (Next.js 14)

#### PUBLIC ROUTES (No Auth Required)
| Route | File Path | Purpose |
|-------|-----------|---------|
| `/` | `src/app/page.tsx` | Landing page |
| `/signup` | `src/app/(public)/signup/page.tsx` | User registration |
| `/login` | `src/app/(public)/login/page.tsx` | User login |
| `/forgot-password` | `src/app/(public)/forgot-password/page.tsx` | Password reset |
| `/about` | `src/app/(public)/about/page.tsx` | About page |
| `/pricing` | `src/app/(public)/pricing/page.tsx` | Pricing page |
| `/blog` | `src/app/(public)/blog/page.tsx` | Blog listing |
| `/docs` | `src/app/(public)/docs/page.tsx` | Documentation |
| `/faq` | `src/app/(public)/faq/page.tsx` | FAQ page |
| `/privacy` | `src/app/(public)/privacy/page.tsx` | Privacy policy |
| `/terms` | `src/app/(public)/terms/page.tsx` | Terms of service |
| `/security` | `src/app/(public)/security/page.tsx` | Security info |

#### WORKSPACE ROUTES (Authenticated, Organization-Scoped)
**Pattern:** `/workspace/[orgId]/...`

##### Dashboard & Analytics
| Route | File Path | Features |
|-------|-----------|----------|
| `/workspace/[orgId]/dashboard` | `src/app/workspace/[orgId]/dashboard/page.tsx` | Main dashboard, KPI widgets, recent activity |
| `/workspace/[orgId]/analytics` | `src/app/workspace/[orgId]/analytics/page.tsx` | Business analytics overview |
| `/workspace/[orgId]/analytics/pipeline` | `src/app/workspace/[orgId]/analytics/pipeline/page.tsx` | Sales pipeline visualization |
| `/workspace/[orgId]/analytics/revenue` | `src/app/workspace/[orgId]/analytics/revenue/page.tsx` | Revenue analytics & forecasting |
| `/workspace/[orgId]/analytics/workflows` | `src/app/workspace/[orgId]/analytics/workflows/page.tsx` | Workflow performance metrics |

##### CRM Core
| Route | File Path | Features |
|-------|-----------|----------|
| `/workspace/[orgId]/leads` | `src/app/workspace/[orgId]/leads/page.tsx` | Lead list view with filters, search, bulk actions |
| `/workspace/[orgId]/leads/new` | `src/app/workspace/[orgId]/leads/new/page.tsx` | Create new lead form |
| `/workspace/[orgId]/leads/[id]/edit` | `src/app/workspace/[orgId]/leads/[id]/edit/page.tsx` | Edit lead details |
| `/workspace/[orgId]/leads/research` | `src/app/workspace/[orgId]/leads/research/page.tsx` | AI-powered lead research interface |
| `/workspace/[orgId]/contacts` | `src/app/workspace/[orgId]/contacts/page.tsx` | Contact list (people) |
| `/workspace/[orgId]/contacts/new` | `src/app/workspace/[orgId]/contacts/new/page.tsx` | Create contact |
| `/workspace/[orgId]/contacts/[id]` | `src/app/workspace/[orgId]/contacts/[id]/page.tsx` | Contact detail view |
| `/workspace/[orgId]/contacts/[id]/edit` | `src/app/workspace/[orgId]/contacts/[id]/edit/page.tsx` | Edit contact |
| `/workspace/[orgId]/deals` | `src/app/workspace/[orgId]/deals/page.tsx` | Deal pipeline board |
| `/workspace/[orgId]/deals/new` | `src/app/workspace/[orgId]/deals/new/page.tsx` | Create deal |
| `/workspace/[orgId]/deals/[id]/edit` | `src/app/workspace/[orgId]/deals/[id]/edit/page.tsx` | Edit deal |

##### Products & E-Commerce
| Route | File Path | Features |
|-------|-----------|----------|
| `/workspace/[orgId]/products` | `src/app/workspace/[orgId]/products/page.tsx` | Product catalog management |
| `/workspace/[orgId]/products/new` | `src/app/workspace/[orgId]/products/new/page.tsx` | Add product |
| `/workspace/[orgId]/products/[id]/edit` | `src/app/workspace/[orgId]/products/[id]/edit/page.tsx` | Edit product |
| `/store/[orgId]/products` | `src/app/store/[orgId]/products/page.tsx` | Public storefront - product listing |
| `/store/[orgId]/products/[productId]` | `src/app/store/[orgId]/products/[productId]/page.tsx` | Public storefront - product detail |
| `/store/[orgId]/cart` | `src/app/store/[orgId]/cart/page.tsx` | Shopping cart |
| `/store/[orgId]/checkout` | `src/app/store/[orgId]/checkout/page.tsx` | Checkout flow |
| `/store/[orgId]/checkout/success` | `src/app/store/[orgId]/checkout/success/page.tsx` | Order confirmation |

##### Outbound & Sequences
| Route | File Path | Features |
|-------|-----------|----------|
| `/workspace/[orgId]/outbound` | `src/app/workspace/[orgId]/outbound/page.tsx` | Outbound campaigns dashboard |
| `/workspace/[orgId]/outbound/sequences` | `src/app/workspace/[orgId]/outbound/sequences/page.tsx` | Email sequence builder |
| `/workspace/[orgId]/outbound/email-writer` | `src/app/workspace/[orgId]/outbound/email-writer/page.tsx` | AI email generation tool |
| `/workspace/[orgId]/sequences/analytics` | `src/app/workspace/[orgId]/sequences/analytics/page.tsx` | Sequence performance analytics |

##### Email Campaigns
| Route | File Path | Features |
|-------|-----------|----------|
| `/workspace/[orgId]/email/campaigns` | `src/app/workspace/[orgId]/email/campaigns/page.tsx` | Email campaign manager |
| `/workspace/[orgId]/email/campaigns/new` | `src/app/workspace/[orgId]/email/campaigns/new/page.tsx` | Create campaign |
| `/workspace/[orgId]/email/campaigns/[campaignId]` | `src/app/workspace/[orgId]/email/campaigns/[campaignId]/page.tsx` | Campaign detail & stats |
| `/workspace/[orgId]/marketing/email-builder` | `src/app/workspace/[orgId]/marketing/email-builder/page.tsx` | Visual email builder |

##### Workflows & Automation
| Route | File Path | Features |
|-------|-----------|----------|
| `/workspace/[orgId]/workflows` | `src/app/workspace/[orgId]/workflows/page.tsx` | Workflow list |
| `/workspace/[orgId]/workflows/new` | `src/app/workspace/[orgId]/workflows/new/page.tsx` | Create workflow (visual builder) |
| `/workspace/[orgId]/workflows/[workflowId]` | `src/app/workspace/[orgId]/workflows/[workflowId]/page.tsx` | Edit workflow |
| `/workspace/[orgId]/workflows/[workflowId]/runs` | `src/app/workspace/[orgId]/workflows/[workflowId]/runs/page.tsx` | Workflow execution history |

##### AI & Training
| Route | File Path | Features |
|-------|-----------|----------|
| `/workspace/[orgId]/onboarding` | `src/app/workspace/[orgId]/onboarding/page.tsx` | **24-Step Agent Builder** |
| `/workspace/[orgId]/ai/fine-tuning` | `src/app/workspace/[orgId]/ai/fine-tuning/page.tsx` | Model fine-tuning dashboard |
| `/workspace/[orgId]/ai/fine-tuning/new` | `src/app/workspace/[orgId]/ai/fine-tuning/new/page.tsx` | Create fine-tuning job |
| `/workspace/[orgId]/ai/datasets` | `src/app/workspace/[orgId]/ai/datasets/page.tsx` | Training dataset manager |
| `/workspace/[orgId]/ab-tests` | `src/app/workspace/[orgId]/ab-tests/page.tsx` | A/B test list |
| `/workspace/[orgId]/ab-tests/new` | `src/app/workspace/[orgId]/ab-tests/new/page.tsx` | Create A/B test |
| `/workspace/[orgId]/ab-tests/[id]` | `src/app/workspace/[orgId]/ab-tests/[id]/page.tsx` | A/B test results |
| `/workspace/[orgId]/conversations` | `src/app/workspace/[orgId]/conversations/page.tsx` | AI conversation history |

##### Website Builder
| Route | File Path | Features |
|-------|-----------|----------|
| `/workspace/[orgId]/website/pages` | `src/app/workspace/[orgId]/website/pages/page.tsx` | Website page manager |
| `/workspace/[orgId]/website/blog` | `src/app/workspace/[orgId]/website/blog/page.tsx` | Blog post manager |
| `/workspace/[orgId]/website/blog/categories` | `src/app/workspace/[orgId]/website/blog/categories/page.tsx` | Blog category manager |
| `/workspace/[orgId]/website/templates` | `src/app/workspace/[orgId]/website/templates/page.tsx` | Template selector |

##### Voice & SMS
| Route | File Path | Features |
|-------|-----------|----------|
| `/workspace/[orgId]/calls` | `src/app/workspace/[orgId]/calls/page.tsx` | Call log & recordings |
| `/workspace/[orgId]/calls/make` | `src/app/workspace/[orgId]/calls/make/page.tsx` | Click-to-call interface |
| `/workspace/[orgId]/nurture` | `src/app/workspace/[orgId]/nurture/page.tsx` | SMS nurture campaigns |
| `/workspace/[orgId]/nurture/new` | `src/app/workspace/[orgId]/nurture/new/page.tsx` | Create SMS campaign |
| `/workspace/[orgId]/nurture/[id]` | `src/app/workspace/[orgId]/nurture/[id]/page.tsx` | SMS campaign details |
| `/workspace/[orgId]/nurture/[id]/stats` | `src/app/workspace/[orgId]/nurture/[id]/stats/page.tsx` | SMS analytics |

##### Settings
| Route | File Path | Features |
|-------|-----------|----------|
| `/workspace/[orgId]/settings/organization` | `src/app/workspace/[orgId]/settings/organization/page.tsx` | Org profile settings |
| `/workspace/[orgId]/settings/users` | `src/app/workspace/[orgId]/settings/users/page.tsx` | Team member management |
| `/workspace/[orgId]/settings/subscription` | `src/app/workspace/[orgId]/settings/subscription/page.tsx` | Billing & subscription |
| `/workspace/[orgId]/settings/api-keys` | `src/app/workspace/[orgId]/settings/api-keys/page.tsx` | API key management |
| `/workspace/[orgId]/settings/integrations` | `src/app/workspace/[orgId]/integrations/page.tsx` | Third-party integrations |
| `/workspace/[orgId]/settings/security` | `src/app/workspace/[orgId]/settings/security/page.tsx` | Security settings, 2FA |
| `/workspace/[orgId]/settings/theme` | `src/app/workspace/[orgId]/settings/theme/page.tsx` | UI theme customization |
| `/workspace/[orgId]/settings/workflows` | `src/app/workspace/[orgId]/settings/workflows/page.tsx` | Workflow settings |
| `/workspace/[orgId]/settings/webhooks` | `src/app/workspace/[orgId]/settings/webhooks/page.tsx` | Webhook configuration |
| `/workspace/[orgId]/settings/storefront` | `src/app/workspace/[orgId]/settings/storefront/page.tsx` | E-commerce settings |
| `/workspace/[orgId]/settings/email-templates` | `src/app/workspace/[orgId]/settings/email-templates/page.tsx` | Email template editor |
| `/workspace/[orgId]/settings/sms-messages` | `src/app/workspace/[orgId]/settings/sms-messages/page.tsx` | SMS template editor |
| `/workspace/[orgId]/settings/accounting` | `src/app/workspace/[orgId]/settings/accounting/page.tsx` | QuickBooks/Xero integration |
| `/workspace/[orgId]/settings/ai-agents/configuration` | `src/app/workspace/[orgId]/settings/ai-agents/configuration/page.tsx` | Agent config |
| `/workspace/[orgId]/settings/ai-agents/persona` | `src/app/workspace/[orgId]/settings/ai-agents/persona/page.tsx` | Agent personality |
| `/workspace/[orgId]/settings/ai-agents/training` | `src/app/workspace/[orgId]/settings/ai-agents/training/page.tsx` | Agent training center |
| `/workspace/[orgId]/settings/ai-agents/business-setup` | `src/app/workspace/[orgId]/settings/ai-agents/business-setup/page.tsx` | Business context setup |

##### Lead Scoring
| Route | File Path | Features |
|-------|-----------|----------|
| `/workspace/[orgId]/lead-scoring` | `src/app/workspace/[orgId]/lead-scoring/page.tsx` | Lead scoring rules & analytics |

##### Schemas (Custom Objects)
| Route | File Path | Features |
|-------|-----------|----------|
| `/workspace/[orgId]/schemas` | `src/app/workspace/[orgId]/schemas/page.tsx` | Custom schema builder (like Salesforce objects) |

#### ADMIN ROUTES
**Pattern:** `/admin/...`

| Route | File Path | Features |
|-------|-----------|----------|
| `/admin/organizations` | `src/app/admin/organizations/page.tsx` | Org management |
| `/admin/organizations/[id]/edit` | `src/app/admin/organizations/[id]/edit/page.tsx` | Edit org |
| `/admin/users` | `src/app/admin/users/page.tsx` | User management |
| `/admin/users/[id]` | `src/app/admin/users/[id]/page.tsx` | User detail |
| `/admin/customers` | `src/app/admin/customers/page.tsx` | Customer list |
| `/admin/analytics` | `src/app/admin/analytics/page.tsx` | Platform-wide analytics |
| `/admin/sales-agent` | `src/app/admin/sales-agent/page.tsx` | Global agent config |
| `/admin/sales-agent/persona` | `src/app/admin/sales-agent/persona/page.tsx` | Global persona |
| `/admin/sales-agent/training` | `src/app/admin/sales-agent/training/page.tsx` | Platform training |
| `/admin/settings/integrations` | `src/app/admin/settings/integrations/page.tsx` | Integration settings |
| `/admin/system/health` | `src/app/admin/system/health/page.tsx` | System health dashboard |
| `/admin/system/logs` | `src/app/admin/system/logs/page.tsx` | System logs |
| `/admin/system/settings` | `src/app/admin/system/settings/page.tsx` | Platform settings |
| `/admin/system/flags` | `src/app/admin/system/flags/page.tsx` | Feature flags |
| `/admin/support/bulk-ops` | `src/app/admin/support/bulk-ops/page.tsx` | Bulk operations |

---

## API ROUTES (154 Endpoints)

### Authentication & Users
| Endpoint | File | Method | Purpose |
|----------|------|--------|---------|
| `/api/auth/login` | N/A (Firebase) | POST | User login |
| `/api/auth/signup` | N/A (Firebase) | POST | User registration |
| `/api/profile` | `src/app/profile/page.tsx` | GET/PUT | User profile |

### Organizations & Workspaces
| Endpoint | File | Method | Purpose |
|----------|------|--------|---------|
| `/api/admin/organizations` | `src/app/api/admin/organizations/route.ts` | GET/POST | List/create orgs |
| `/api/admin/organizations/[orgId]` | `src/app/api/admin/organizations/[orgId]/route.ts` | GET/PUT/DELETE | Org CRUD |
| `/api/admin/users` | `src/app/api/admin/users/route.ts` | GET/POST | User management |
| `/api/setup/create-platform-org` | `src/app/api/setup/create-platform-org/route.ts` | POST | Create platform org |

### Leads & Contacts
| Endpoint | File | Method | Purpose |
|----------|------|--------|---------|
| `/api/workspace/[orgId]/leads` | `src/app/api/workspace/[orgId]/leads/route.ts` | GET/POST | List/create leads |
| `/api/workspace/[orgId]/contacts` | `src/app/api/workspace/[orgId]/contacts/route.ts` | GET/POST | List/create contacts |
| `/api/workspace/[orgId]/deals` | `src/app/api/workspace/[orgId]/deals/route.ts` | GET/POST | List/create deals |
| `/api/leads/research` | `src/app/api/leads/research/route.ts` | POST | AI lead research |
| `/api/contacts/count` | `src/app/api/contacts/count/route.ts` | GET | Contact count |

### Discovery Engine (Scraper Intelligence)
| Endpoint | File | Method | Purpose |
|----------|------|--------|---------|
| `/api/discovery/queue` | `src/app/api/discovery/queue/route.ts` | POST | Queue scraping job |
| `/api/discovery/queue/process` | `src/app/api/discovery/queue/process/route.ts` | POST | Process queue (cron) |

### AI Agent
| Endpoint | File | Method | Purpose |
|----------|------|--------|---------|
| `/api/agent/chat` | `src/app/api/agent/chat/route.ts` | POST | Chat with AI agent |
| `/api/agent/config` | `src/app/api/agent/config/route.ts` | GET/PUT | Agent configuration |
| `/api/agent/knowledge/upload` | `src/app/api/agent/knowledge/upload/route.ts` | POST | Upload knowledge docs |
| `/api/agent/process-onboarding` | `src/app/api/agent/process-onboarding/route.ts` | POST | Process 24-step onboarding |
| `/api/workspace/[orgId]/agent/persona` | `src/app/api/workspace/[orgId]/agent/persona/route.ts` | GET/PUT | Agent persona config |
| `/api/admin/sales-agent/persona` | `src/app/api/admin/sales-agent/persona/route.ts` | GET/PUT | Global agent persona |

### Workflows
| Endpoint | File | Method | Purpose |
|----------|------|--------|---------|
| `/api/workflows` | `src/app/api/workflows/route.ts` | GET/POST | List/create workflows |
| `/api/workflows/[workflowId]` | `src/app/api/workflows/[workflowId]/route.ts` | GET/PUT/DELETE | Workflow CRUD |
| `/api/workflows/execute` | `src/app/api/workflows/execute/route.ts` | POST | Execute workflow |
| `/api/workflows/webhooks/[workflowId]` | `src/app/api/workflows/webhooks/[workflowId]/route.ts` | POST | Webhook trigger |
| `/api/workflows/triggers/schedule` | `src/app/api/workflows/triggers/schedule/route.ts` | POST | Schedule trigger |
| `/api/workflows/triggers/entity` | `src/app/api/workflows/triggers/entity/route.ts` | POST | Entity trigger |

### Email & Sequences
| Endpoint | File | Method | Purpose |
|----------|------|--------|---------|
| `/api/email/send` | `src/app/api/email/send/route.ts` | POST | Send email |
| `/api/email/track/[trackingId]` | `src/app/api/email/track/[trackingId]/route.ts` | GET | Email open tracking |
| `/api/email/track/link` | `src/app/api/email/track/link/route.ts` | GET | Link click tracking |
| `/api/sequences/executions` | `src/app/api/sequences/executions/route.ts` | GET/POST | Sequence executions |
| `/api/sequences/analytics` | `src/app/api/sequences/analytics/route.ts` | GET | Sequence analytics |
| `/api/outbound/sequences` | `src/app/api/outbound/sequences/route.ts` | GET/POST | Outbound sequences |
| `/api/outbound/sequences/enroll` | `src/app/api/outbound/sequences/enroll/route.ts` | POST | Enroll in sequence |
| `/api/outbound/email/generate` | `src/app/api/outbound/email/generate/route.ts` | POST | AI email generation |
| `/api/outbound/reply/process` | `src/app/api/outbound/reply/process/route.ts` | POST | Process email reply |
| `/api/webhooks/email` | `src/app/api/webhooks/email/route.ts` | POST | SendGrid webhook |
| `/api/webhooks/gmail` | `src/app/api/webhooks/gmail/route.ts` | POST | Gmail webhook |

### SMS
| Endpoint | File | Method | Purpose |
|----------|------|--------|---------|
| `/api/sms/send` | `src/app/api/sms/send/route.ts` | POST | Send SMS (Twilio) |

### Voice
| Endpoint | File | Method | Purpose |
|----------|------|--------|---------|
| `/api/voice/call` | `src/app/api/voice/call/route.ts` | POST | Initiate call |
| `/api/voice/twiml` | `src/app/api/voice/twiml/route.ts` | POST | TwiML handler |

### Meetings
| Endpoint | File | Method | Purpose |
|----------|------|--------|---------|
| `/api/outbound/meetings/schedule` | `src/app/api/outbound/meetings/schedule/route.ts` | POST | Schedule meeting |

### E-Commerce
| Endpoint | File | Method | Purpose |
|----------|------|--------|---------|
| `/api/ecommerce/cart` | `src/app/api/ecommerce/cart/route.ts` | GET/POST/PUT | Cart operations |
| `/api/ecommerce/cart/discount` | `src/app/api/ecommerce/cart/discount/route.ts` | POST | Apply discount |
| `/api/ecommerce/checkout` | `src/app/api/ecommerce/checkout/route.ts` | POST | Checkout |
| `/api/ecommerce/checkout/create-session` | `src/app/api/ecommerce/checkout/create-session/route.ts` | POST | Create Stripe session |
| `/api/ecommerce/orders` | `src/app/api/ecommerce/orders/route.ts` | GET/POST | Orders |
| `/api/ecommerce/orders/[orderId]` | `src/app/api/ecommerce/orders/[orderId]/route.ts` | GET/PUT | Order detail |

### Payments & Subscriptions
| Endpoint | File | Method | Purpose |
|----------|------|--------|---------|
| `/api/checkout/create-payment-intent` | `src/app/api/checkout/create-payment-intent/route.ts` | POST | Stripe payment intent |
| `/api/checkout/complete` | `src/app/api/checkout/complete/route.ts` | POST | Complete checkout |
| `/api/subscription` | `src/app/api/subscription/route.ts` | GET/POST | Subscription management |
| `/api/subscription/toggle` | `src/app/api/subscription/toggle/route.ts` | POST | Toggle subscription |
| `/api/subscription/addon` | `src/app/api/subscription/addon/route.ts` | POST | Add subscription addon |
| `/api/subscription/usage` | `src/app/api/subscription/usage/route.ts` | GET | Usage metrics |
| `/api/webhooks/stripe` | `src/app/api/webhooks/stripe/route.ts` | POST | Stripe webhook |

### Website Builder
| Endpoint | File | Method | Purpose |
|----------|------|--------|---------|
| `/api/website/pages` | `src/app/api/website/pages/route.ts` | GET/POST | Pages |
| `/api/website/pages/[pageId]` | `src/app/api/website/pages/[pageId]/route.ts` | GET/PUT/DELETE | Page CRUD |
| `/api/website/pages/[pageId]/preview` | `src/app/api/website/pages/[pageId]/preview/route.ts` | GET | Preview page |
| `/api/website/pages/[pageId]/publish` | `src/app/api/website/pages/[pageId]/publish/route.ts` | POST | Publish page |
| `/api/website/pages/[pageId]/versions` | `src/app/api/website/pages/[pageId]/versions/route.ts` | GET | Page versions |
| `/api/website/blog/posts` | `src/app/api/website/blog/posts/route.ts` | GET/POST | Blog posts |
| `/api/website/blog/posts/[postId]` | `src/app/api/website/blog/posts/[postId]/route.ts` | GET/PUT/DELETE | Post CRUD |
| `/api/website/blog/posts/[postId]/preview` | `src/app/api/website/blog/posts/[postId]/preview/route.ts` | GET | Preview post |
| `/api/website/blog/posts/[postId]/publish` | `src/app/api/website/blog/posts/[postId]/publish/route.ts` | POST | Publish post |
| `/api/website/blog/categories` | `src/app/api/website/blog/categories/route.ts` | GET/POST | Blog categories |
| `/api/website/domains` | `src/app/api/website/domains/route.ts` | GET/POST | Custom domains |
| `/api/website/domains/[domainId]` | `src/app/api/website/domains/[domainId]/route.ts` | GET/PUT/DELETE | Domain CRUD |
| `/api/website/domains/[domainId]/verify` | `src/app/api/website/domains/[domainId]/verify/route.ts` | POST | Verify domain |
| `/api/website/settings` | `src/app/api/website/settings/route.ts` | GET/PUT | Site settings |
| `/api/website/navigation` | `src/app/api/website/navigation/route.ts` | GET/PUT | Navigation menu |
| `/api/website/templates` | `src/app/api/website/templates/route.ts` | GET | Page templates |
| `/api/website/sitemap.xml` | `src/app/api/website/sitemap.xml/route.ts` | GET | Sitemap |
| `/api/website/robots.txt` | `src/app/api/website/robots.txt/route.ts` | GET | Robots.txt |
| `/api/website/blog/feed.xml` | `src/app/api/website/blog/feed.xml/route.ts` | GET | RSS feed |
| `/api/website/audit-log` | `src/app/api/website/audit-log/route.ts` | GET | Change history |

### Analytics
| Endpoint | File | Method | Purpose |
|----------|------|--------|---------|
| `/api/analytics/workflows` | `src/app/api/analytics/workflows/route.ts` | GET | Workflow analytics |
| `/api/analytics/revenue` | `src/app/api/analytics/revenue/route.ts` | GET | Revenue analytics |
| `/api/analytics/forecast` | `src/app/api/analytics/forecast/route.ts` | GET | Revenue forecast |
| `/api/analytics/win-loss` | `src/app/api/analytics/win-loss/route.ts` | GET | Win/loss analysis |

### Lead Scoring
| Endpoint | File | Method | Purpose |
|----------|------|--------|---------|
| `/api/lead-scoring/calculate` | `src/app/api/lead-scoring/calculate/route.ts` | POST | Calculate lead score |
| `/api/lead-scoring/rules` | `src/app/api/lead-scoring/rules/route.ts` | GET/POST | Scoring rules |
| `/api/lead-scoring/analytics` | `src/app/api/lead-scoring/analytics/route.ts` | GET | Scoring analytics |

### Schemas (Custom Objects)
| Endpoint | File | Method | Purpose |
|----------|------|--------|---------|
| `/api/schemas` | `src/app/api/schemas/route.ts` | GET/POST | List/create schemas |
| `/api/schemas/[schemaId]` | `src/app/api/schemas/[schemaId]/route.ts` | GET/PUT/DELETE | Schema CRUD |
| `/api/schemas/[schemaId]/update` | `src/app/api/schemas/[schemaId]/update/route.ts` | PUT | Update schema |
| `/api/schema/[schemaId]/field/[fieldId]/rename-history` | `src/app/api/schema/[schemaId]/field/[fieldId]/rename-history/route.ts` | GET | Field rename history |
| `/api/schema/[schemaId]/field/[fieldId]/convert-type` | `src/app/api/schema/[schemaId]/field/[fieldId]/convert-type/route.ts` | POST | Convert field type |
| `/api/schema-changes` | `src/app/api/schema-changes/route.ts` | GET/POST | Schema changes |
| `/api/schema-changes/impact` | `src/app/api/schema-changes/impact/route.ts` | POST | Impact analysis |
| `/api/schema-debouncer` | `src/app/api/schema-debouncer/route.ts` | POST | Debounce schema updates |

### Integrations
| Endpoint | File | Method | Purpose |
|----------|------|--------|---------|
| `/api/integrations/[integrationId]` | `src/app/api/integrations/[integrationId]/route.ts` | GET/PUT/DELETE | Integration CRUD |
| `/api/integrations/[integrationId]/test` | `src/app/api/integrations/[integrationId]/test/route.ts` | POST | Test integration |
| `/api/integrations/[integrationId]/sync` | `src/app/api/integrations/[integrationId]/sync/route.ts` | POST | Sync integration |
| `/api/integrations/oauth/authorize` | `src/app/api/integrations/oauth/authorize/route.ts` | GET | OAuth start |
| `/api/integrations/oauth/[provider]` | `src/app/api/integrations/oauth/[provider]/route.ts` | GET | OAuth provider |
| `/api/integrations/oauth/callback/[provider]` | `src/app/api/integrations/oauth/callback/[provider]/route.ts` | GET | OAuth callback |
| `/api/integrations/slack/auth` | `src/app/api/integrations/slack/auth/route.ts` | GET | Slack OAuth |
| `/api/integrations/slack/callback` | `src/app/api/integrations/slack/callback/route.ts` | GET | Slack callback |
| `/api/integrations/microsoft/auth` | `src/app/api/integrations/microsoft/auth/route.ts` | GET | Microsoft OAuth |
| `/api/integrations/microsoft/callback` | `src/app/api/integrations/microsoft/callback/route.ts` | GET | Microsoft callback |
| `/api/integrations/quickbooks/auth` | `src/app/api/integrations/quickbooks/auth/route.ts` | GET | QuickBooks OAuth |
| `/api/integrations/quickbooks/callback` | `src/app/api/integrations/quickbooks/callback/route.ts` | GET | QuickBooks callback |

### System & Health
| Endpoint | File | Method | Purpose |
|----------|------|--------|---------|
| `/api/health` | `src/app/api/health/route.ts` | GET | Health check |
| `/api/health/detailed` | `src/app/api/health/detailed/route.ts` | GET | Detailed health |
| `/api/test/admin-status` | `src/app/api/test/admin-status/route.ts` | GET | Admin status check |
| `/api/admin/verify` | `src/app/api/admin/verify/route.ts` | POST | Verify admin |
| `/api/admin/cleanup-test-orgs` | `src/app/api/admin/cleanup-test-orgs/route.ts` | POST | Cleanup test data |

### Cron Jobs
| Endpoint | File | Method | Purpose |
|----------|------|--------|---------|
| `/api/cron/process-sequences` | `src/app/api/cron/process-sequences/route.ts` | POST | Process email sequences |
| `/api/cron/scheduled-publisher` | `src/app/api/cron/scheduled-publisher/route.ts` | POST | Publish scheduled content |

### Reports
| Endpoint | File | Method | Purpose |
|----------|------|--------|---------|
| `/api/reports/execute` | `src/app/api/reports/execute/route.ts` | POST | Execute report |

---

## ONBOARDING SYSTEM

### The 24-Step AI Agent Builder

**File:** `src/app/workspace/[orgId]/onboarding/page.tsx`  
**UI Route:** `/workspace/[orgId]/onboarding`  
**Backend API:** `/api/agent/process-onboarding`

This is the **core onboarding flow** that builds the AI agent's "brain". Each user answer maps to specific database fields in the organization's persona configuration.

#### Step-by-Step Breakdown

##### STEP 1: Business Basics
**UI Section:** Business Identity  
**Fields Collected:**
- `businessName` (string) → `organizations.businessName`
- `industry` (select) → `organizations.industry`
- `website` (string) → `organizations.website`
- `faqPageUrl` (string) → `organizations.faqPageUrl`
- `socialMediaUrls` (array) → `organizations.socialMediaUrls`
- `companySize` (select) → `organizations.companySize`

**Logic:** Scraper automatically crawls the provided `website` and `faqPageUrl` to extract product info, pricing, and common questions.

##### STEP 2: Business Understanding
**Fields:**
- `problemSolved` (text) → `agentPersona.problemSolved`
- `uniqueValue` (text) → `agentPersona.uniqueValue`
- `whyBuy` (text) → `agentPersona.whyBuy`
- `whyNotBuy` (text) → `agentPersona.whyNotBuy`

**Logic:** Used by AI to understand the **value proposition** and handle objections intelligently.

##### STEP 3: Products/Services Overview
**Fields:**
- `primaryOffering` (text) → `agentPersona.primaryOffering`
- `priceRange` (text) → `agentPersona.priceRange`
- `targetCustomer` (text) → `agentPersona.targetCustomer`
- `customerDemographics` (text) → `agentPersona.customerDemographics`

**Logic:** Defines the **ideal customer profile (ICP)** for lead qualification.

##### STEP 4: Product/Service Details
**Fields:**
- `topProducts` (text) → `agentPersona.topProducts`
- `productComparison` (text) → `agentPersona.productComparison`
- `seasonalOfferings` (text) → `agentPersona.seasonalOfferings`
- `whoShouldNotBuy` (text) → `agentPersona.whoShouldNotBuy`

**Logic:** Helps AI recommend the right products and **disqualify** bad-fit leads.

##### STEP 5: Pricing & Sales Strategy
**Fields:**
- `pricingStrategy` (text) → `agentPersona.pricingStrategy`
- `discountPolicy` (text) → `agentPersona.discountPolicy`
- `volumeDiscounts` (text) → `agentPersona.volumeDiscounts`
- `firstTimeBuyerIncentive` (text) → `agentPersona.firstTimeBuyerIncentive`
- `financingOptions` (text) → `agentPersona.financingOptions`

**Logic:** Enables AI to discuss pricing, offer discounts, and mention financing.

##### STEP 6: Operations & Fulfillment
**Fields:**
- `geographicCoverage` (text) → `agentPersona.geographicCoverage`
- `deliveryTimeframes` (text) → `agentPersona.deliveryTimeframes`
- `inventoryConstraints` (text) → `agentPersona.inventoryConstraints`
- `capacityLimitations` (text) → `agentPersona.capacityLimitations`

**Logic:** AI can set proper **delivery expectations** and avoid overselling.

##### STEP 7: Policies & Guarantees
**Fields:**
- `returnPolicy` (text) → `agentPersona.returnPolicy`
- `warrantyTerms` (text) → `agentPersona.warrantyTerms`
- `cancellationPolicy` (text) → `agentPersona.cancellationPolicy`
- `satisfactionGuarantee` (text) → `agentPersona.satisfactionGuarantee`

**Logic:** Builds customer **trust** by being transparent about policies.

##### STEP 8: Agent Goals & Objectives
**Fields:**
- `primaryObjective` (select: sales/support/both) → `agentPersona.primaryObjective`
- `secondaryObjectives` (array) → `agentPersona.secondaryObjectives`
- `successMetrics` (text) → `agentPersona.successMetrics`
- `escalationRules` (text) → `agentPersona.escalationRules`

**Logic:** Determines agent's **mode** (Hunter vs Closer vs Support).

##### STEP 9: Sales Process & Flow
**Fields:**
- `typicalSalesFlow` (text) → `agentPersona.typicalSalesFlow`
- `qualificationCriteria` (text) → `agentPersona.qualificationCriteria`
- `discoveryQuestions` (text) → `agentPersona.discoveryQuestions`
- `closingStrategy` (text) → `agentPersona.closingStrategy`

**Logic:** Defines the **conversation flow** and qualification logic.

##### STEP 10: Objection Handling
**Fields:**
- `commonObjections` (text) → `agentPersona.commonObjections`
- `priceObjections` (text) → `agentPersona.priceObjections`
- `timeObjections` (text) → `agentPersona.timeObjections`
- `competitorObjections` (text) → `agentPersona.competitorObjections`

**Logic:** Pre-programmed **rebuttals** for common objections.

##### STEP 11: Customer Service
**Fields:**
- `supportScope` (text) → `agentPersona.supportScope`
- `technicalSupport` (text) → `agentPersona.technicalSupport`
- `orderTracking` (text) → `agentPersona.orderTracking`
- `complaintResolution` (text) → `agentPersona.complaintResolution`

**Logic:** Defines what the agent **can and cannot** help with.

##### STEP 12: Agent Personality
**Fields:**
- `tone` (select: professional/friendly/casual/technical) → `agentPersona.tone`
- `agentName` (text) → `agentPersona.agentName`
- `greeting` (text) → `agentPersona.greeting`
- `closingMessage` (text) → `agentPersona.closingMessage`

**Logic:** Sets the **brand voice** for all interactions.

##### STEP 13: Behavioral Controls
**Fields:**
- `closingAggressiveness` (slider 1-10) → `agentPersona.closingAggressiveness`
- `questionFrequency` (slider 1-10) → `agentPersona.questionFrequency`
- `responseLength` (select: brief/balanced/detailed) → `agentPersona.responseLength`
- `proactiveLevel` (slider 1-10) → `agentPersona.proactiveLevel`

**Logic:** Fine-tunes agent's **conversational style**.

##### STEP 14: Knowledge Base Upload
**Fields:**
- `uploadedDocs` (files: PDF, Excel, Word) → Processed into `knowledge_base` collection
- `urls` (array) → Scraped and added to knowledge base
- `faqs` (text) → `agentPersona.faqs`
- `competitorUrls` (array) → Scraped for competitive analysis

**Logic:** Documents are parsed, chunked, and **vector embedded** for RAG retrieval.

##### STEP 15: Compliance & Legal
**Fields:**
- `requiredDisclosures` (text) → `agentPersona.requiredDisclosures`
- `privacyCompliance` (checkbox) → `agentPersona.privacyCompliance`
- `industryRegulations` (text) → `agentPersona.industryRegulations`
- `prohibitedTopics` (text) → `agentPersona.prohibitedTopics`

**Logic:** Ensures agent follows **legal requirements** (GDPR, HIPAA, etc.).

##### STEP 16: Advanced Configuration (Optional)
**Fields:**
- `enableAdvanced` (boolean)
- `customFunctions` (array) → `agentPersona.customFunctions`
- `conversationFlowLogic` (text) → `agentPersona.conversationFlowLogic`
- `responseLengthLimit` (number) → `agentPersona.responseLengthLimit`
- `industryTemplate` (select) → Triggers **template injection**
- `knowledgePriority` (array) → `agentPersona.knowledgePriority`

**Logic:** Power users can customize **function calling** and conversation logic.

##### STEP 17: Idle Timeout
**Fields:**
- `idleTimeoutMinutes` (number) → `organizations.idleTimeoutMinutes`

**Logic:** Auto-end inactive conversations after N minutes.

##### STEP 18: Objection Handling Strategies
**Fields:**
- `priceObjectionStrategy` (text) → `agentPersona.priceObjectionStrategy`
- `competitorObjectionStrategy` (text) → `agentPersona.competitorObjectionStrategy`
- `timingObjectionStrategy` (text) → `agentPersona.timingObjectionStrategy`
- `authorityObjectionStrategy` (text) → `agentPersona.authorityObjectionStrategy`
- `needObjectionStrategy` (text) → `agentPersona.needObjectionStrategy`

**Logic:** BANT (Budget, Authority, Need, Timeline) objection frameworks.

##### STEP 19: Customer Sentiment Handling
**Fields:**
- `angryCustomerApproach` (text) → `agentPersona.angryCustomerApproach`
- `confusedCustomerApproach` (text) → `agentPersona.confusedCustomerApproach`
- `readyToBuySignals` (text) → `agentPersona.readyToBuySignals`
- `disengagementSignals` (text) → `agentPersona.disengagementSignals`
- `frustratedCustomerApproach` (text) → `agentPersona.frustratedCustomerApproach`

**Logic:** Sentiment-based **adaptive responses**.

##### STEP 20: Discovery Question Frameworks
**Fields:**
- `budgetQualificationQuestions` (text) → `agentPersona.budgetQualificationQuestions`
- `timelineQuestions` (text) → `agentPersona.timelineQuestions`
- `authorityQuestions` (text) → `agentPersona.authorityQuestions`
- `needIdentificationQuestions` (text) → `agentPersona.needIdentificationQuestions`
- `painPointQuestions` (text) → `agentPersona.painPointQuestions`

**Logic:** BANT qualification questions.

##### STEP 21: Closing Techniques
**Fields:**
- `assumptiveCloseConditions` (text) → `agentPersona.assumptiveCloseConditions`
- `urgencyCreationTactics` (text) → `agentPersona.urgencyCreationTactics`
- `trialCloseTriggers` (text) → `agentPersona.trialCloseTriggers`
- `softCloseApproaches` (text) → `agentPersona.softCloseApproaches`

**Logic:** Sales closing frameworks (assumptive, trial close, etc.).

##### STEP 22: Rules & Restrictions
**Fields:**
- `prohibitedBehaviors` (text) → `agentPersona.prohibitedBehaviors`
- `behavioralBoundaries` (text) → `agentPersona.behavioralBoundaries`
- `mustAlwaysMention` (text) → `agentPersona.mustAlwaysMention`
- `neverMention` (text) → `agentPersona.neverMention`

**Logic:** Hard constraints on agent behavior.

##### STEP 23: Training Metrics Selection
**Fields:**
- `selectedTrainingMetrics` (array) → `agentPersona.selectedTrainingMetrics`

**Logic:** Which KPIs to optimize for (conversion rate, CSAT, etc.).

##### STEP 24: Sales Materials Upload
**Fields:**
- `uploadedSalesMaterials` (files) → `knowledge_base` collection

**Logic:** Final knowledge dump (brochures, case studies, etc.).

### Backend Processing Flow

**API Endpoint:** `POST /api/agent/process-onboarding`  
**Handler:** `src/app/api/agent/process-onboarding/route.ts`

**What Happens:**
1. **Data Validation:** Validates all 24 steps using Zod schemas
2. **Template Selection:** If `industryTemplate` is selected, loads template from `src/lib/persona/industry-templates.ts`
3. **Template Mutation:** Applies mutation rules based on onboarding answers (see [Template Injection](#industry-template-injection))
4. **Document Processing:** Uploaded files are parsed by:
   - `src/lib/agent/parsers/pdf-parser.ts` (PDFs)
   - `src/lib/agent/parsers/excel-parser.ts` (Excel/CSV)
   - Turndown (Word → Markdown)
5. **Knowledge Chunking:** Text is split into 500-token chunks
6. **Vector Embedding:** Each chunk is embedded using Google Gemini embeddings
7. **Firestore Write:** Persona saved to `organizations/[orgId]/agentPersona`
8. **Knowledge Base Write:** Vectors saved to `organizations/[orgId]/knowledge_base`
9. **Website Scraping Queue:** If `website` provided, queues scraping job via `src/lib/services/discovery-engine.ts`
10. **Return:** Agent persona ID and success status

---

## INDUSTRY TEMPLATE INJECTION

### The "Secret Sauce" - How Templates Transform the CRM

**Core Files:**
- `src/lib/persona/industry-templates.ts` - Legacy templates (6 industries)
- `src/lib/persona/templates/*.ts` - New modular templates (49 total)
- `src/lib/persona/templates/types.ts` - Template schema
- `src/lib/persona/templates/mutation-rules.ts` - Dynamic mutation system
- `src/lib/services/mutation-engine.ts` - Template mutation engine

### Template Architecture

Each industry template has:
1. **Core Identity** - Positioning, tone, title
2. **Cognitive Logic** - Reasoning framework, decision process
3. **Knowledge RAG** - Static and dynamic knowledge sources
4. **Learning Loops** - Pattern recognition, adaptation
5. **Tactical Execution** - Primary action, conversion rhythm
6. **Research Intelligence** - Scraping strategy, high-value signals

### Available Templates (49 Total)

**Categories:**
- **Real Estate** (1 template)
- **Healthcare** (3 templates)
- **Home Services** (3 templates)
- **Legacy** (6 templates: General, Transportation, Services, E-commerce, Real Estate, Legal)

### Template Injection Process

**Trigger:** User selects `industryTemplate` in Step 16 of onboarding OR in settings

**Step 1: Template Loading**
```
User selects "real_estate_luxury" template
↓
System loads template from src/lib/persona/templates/real-estate.ts
```

**Step 2: Mutation Rule Evaluation**
```
Mutation Engine evaluates rules based on onboarding data:
IF (companySize === 'large' AND priceRange.includes('luxury'))
THEN boost highValueSignals['property-listings'].scoreBoost by +15
```

**File:** `src/lib/services/mutation-engine.ts`

**Step 3: UI Component Injection**

Templates modify the CRM in these ways:

#### A. Schema Injection
**File:** `src/lib/setup/industry-templates.ts`

**Example: Real Estate Template**
```
Adds custom schemas:
- "Property" object with fields: address, price, bedrooms, bathrooms, sqft, status
- "Showing" object with fields: property_id, contact_id, date_time, feedback
```

**Physical Change:**
- New navigation item appears: "Properties" (instead of generic "Products")
- Custom list views with real estate-specific columns
- Deal object renamed to "Offers" with custom fields (offer_amount, contingencies)

#### B. Field Customization
**Example: Transportation Template**
```
Companies schema gets:
- dot_number (DOT Number)
- mc_number (MC Number)
- fleet_size (Fleet Size)

Products renamed to "Services"
```

**Physical Change:**
- Company detail page shows DOT/MC fields
- Left sidebar shows "Services" instead of "Products"

#### C. AI Agent Prompt Injection
**Example: E-commerce Template**
```
agentPrompt: "You are an e-commerce sales assistant. Help customers find products, answer questions, and complete purchases."
```

**Physical Change:**
- Agent's greeting changes
- Agent prioritizes product recommendations over consultative selling
- Different objection handling (cart abandonment vs price negotiation)

#### D. Workflow Pre-population
**Example: Legal Services Template**
```
Auto-creates workflows:
1. "New Case Intake" - Triggers when Case is created
2. "Billing Reminder" - Sends invoice 7 days before due date
```

**Physical Change:**
- Workflows appear pre-configured in workflow builder
- Can be edited but save time

#### E. Research Intelligence Injection
**This is the most powerful feature**

**File:** `src/types/scraper-intelligence.ts`

**Example: Real Estate Template**
```typescript
research: {
  scrapingStrategy: {
    primarySource: 'website',
    secondarySources: ['linkedin-company', 'google-business'],
    frequency: 'weekly',
    enableCaching: true
  },
  highValueSignals: [
    {
      id: 'luxury-listings',
      label: 'Luxury Property Listings',
      keywords: ['luxury', 'estate', 'mansion', 'waterfront'],
      platform: 'website',
      priority: 'HIGH',
      action: 'increase-score',
      scoreBoost: 20
    },
    {
      id: 'recent-sales',
      label: 'Recent High-Value Sales',
      keywords: ['sold', 'closed', 'million'],
      platform: 'website',
      priority: 'CRITICAL',
      action: 'trigger-workflow',
      scoreBoost: 30
    }
  ]
}
```

**Physical Change:**
When a lead is enriched, the scraper:
1. Crawls their website looking for "luxury", "estate", etc.
2. If found, lead score increases by +20
3. If "sold" + "million" found → triggers "Hot Lead" workflow
4. Creates notification: "🔥 High-value signal detected: Recent $2M sale"

### Mutation Rules System

**File:** `src/lib/persona/templates/mutation-rules.ts`

**Purpose:** Templates are **NOT static**. They adapt based on onboarding answers.

**Example Mutation Rule:**
```typescript
{
  id: 'enterprise-boost',
  name: 'Enterprise Customer Boost',
  condition: (onboarding) => onboarding.companySize === 'large',
  mutations: [
    {
      path: 'research.highValueSignals[hiring].scoreBoost',
      operation: 'add',
      value: 10
    },
    {
      path: 'tacticalExecution.conversionRhythm',
      operation: 'set',
      value: 'consultative-slow-burn'
    }
  ],
  priority: 1
}
```

**Result:** If user says they're targeting large companies, the template automatically:
- Boosts "hiring signals" by +10 (hiring = growth = good lead)
- Changes sales approach from "quick close" to "consultative slow burn"

### Manager AI Instruction - Template Injection

**How to explain this to a client:**

"When you select an industry template, the entire CRM transforms to match your business. For example:

**Real Estate Agent:**
- Your 'Products' menu changes to 'Properties'
- You get custom fields like 'Bedrooms', 'Square Feet', 'Listing Status'
- The AI agent learns to talk like a real estate assistant, not a generic salesperson
- When you add a lead, we automatically check their website for luxury property listings and recent sales
- If we find high-value signals (like a recent $2M sale), we boost their lead score and notify you

**Legal Firm:**
- Your CRM shows 'Cases' instead of 'Deals'
- You can track billable hours, court dates, and case outcomes
- The AI learns legal terminology and compliance requirements
- We auto-create workflows for new case intake and billing reminders

It's like having a custom CRM built for your exact industry, but configured in seconds instead of months."

---

## SCRAPER INTELLIGENCE ENGINE

### Overview
**Purpose:** Automatically research leads/companies by scraping websites and detecting "high-value signals"

**Core Files:**
- `src/lib/scraper-intelligence/scraper-intelligence-service.ts` - Main service
- `src/lib/scraper-intelligence/scraper-runner.ts` - Browser automation (Playwright)
- `src/lib/scraper-intelligence/distillation-engine.ts` - Extract insights from scraped data
- `src/lib/scraper-intelligence/confidence-scorer.ts` - Score data quality
- `src/lib/scraper-intelligence/pattern-matcher.ts` - Detect signals
- `src/lib/scraper-intelligence/training-manager.ts` - ML training
- `src/lib/services/discovery-engine.ts` - Orchestration layer

### Feature: Lead Research

**UI Trigger:** User clicks "Research" button on lead detail page  
**Route:** `/workspace/[orgId]/leads/research`  
**API Endpoint:** `POST /api/leads/research`

**Required User Inputs:**
- Lead ID or Company Website URL

**Execution Flow:**

1. **User Action:** Clicks "Research Lead" button
2. **Frontend Request:**
   ```
   POST /api/leads/research
   {
     leadId: "lead_12345",
     websiteUrl: "https://acmecorp.com" (optional, auto-detected from lead)
   }
   ```

3. **Backend Processing:**
   - **File:** `src/lib/services/discovery-engine.ts`
   - Loads industry template for this org
   - Extracts `research.scrapingStrategy` and `research.highValueSignals`
   - Queues scraping job via `src/lib/scraper-intelligence/scraper-runner.ts`

4. **Scraper Execution:**
   - **File:** `src/lib/scraper-intelligence/scraper-runner.ts`
   - Launches headless Playwright browser
   - Navigates to website
   - Scrapes content based on strategy:
     - **Primary Source:** Company website (always)
     - **Secondary Sources:** LinkedIn, News API, Crunchbase (if configured)
   - Extracts text, metadata, links

5. **Distillation:**
   - **File:** `src/lib/scraper-intelligence/distillation-engine.ts`
   - Removes "fluff" (navigation, footer, ads) using patterns
   - Detects high-value signals (keywords from template)
   - Example: Finds "We're hiring 20 engineers" → triggers "hiring" signal

6. **Scoring:**
   - **File:** `src/lib/scraper-intelligence/confidence-scorer.ts`
   - Calculates lead score based on detected signals
   - Example: hiring signal (+15), recent funding (+25) = +40 total

7. **Storage:**
   - Saves to Firestore:
     - `temporary_scrapes/[scrapeId]` - Raw scraped data (TTL 7 days)
     - `extracted_signals/[signalId]` - Detected signals (permanent)
     - Updates `leads/[leadId].enrichmentData` - Lead enrichment

8. **Response:**
   ```json
   {
     "success": true,
     "leadScore": 85,
     "signals": [
       {
         "id": "hiring",
         "label": "Actively Hiring",
         "description": "Company is hiring 20 engineers",
         "scoreBoost": 15,
         "action": "flag-for-review"
       },
       {
         "id": "funding",
         "label": "Recent Funding",
         "description": "Raised $10M Series A",
         "scoreBoost": 25,
         "action": "trigger-workflow"
       }
     ]
   }
   ```

9. **UI Update:**
   - Lead card shows "🔥 Hot Lead - Score: 85"
   - Badges for "Hiring" and "Recent Funding"
   - Notification: "Lead score increased by +40"

### Feature: Auto-Discovery Queue

**Trigger:** Cron job (runs every hour)  
**API Endpoint:** `POST /api/discovery/queue/process`  
**File:** `src/app/api/discovery/queue/process/route.ts`

**What it does:**
- Finds all leads with `status='new'` and `website != null`
- Queues them for automatic research
- Processes up to 50 leads per hour (rate limit)

**Manager AI Instruction:**
"The platform automatically researches new leads in the background. When a lead is added, we scrape their website looking for buying signals like 'hiring', 'funding', or 'expansion'. If we find high-value signals, we boost their score and notify you. This runs every hour, so hot leads are identified within 60 minutes of being added."

### Feature: Temporary Scrapes (Smart Caching)

**File:** `src/lib/scraper-intelligence/temporary-scrapes-service.ts`

**Purpose:** Scraped data is expensive (time, API costs). Temporary scrapes cache data for 7 days.

**Logic:**
- First time scraping `acmecorp.com` → Scrapes website, saves to `temporary_scrapes/acmecorp_com_123`
- Second request within 7 days → Returns cached data (instant, free)
- After 7 days → Scrape again (data is stale)

**Manager AI Instruction:**
"We cache research data for 7 days to save time and money. If you research the same company twice in a week, we use the cached data. After a week, we re-scrape to get fresh information."

---

## SOCIAL AI & OUTBOUND

### Outbound Email System

**Core Files:**
- `src/lib/outbound/email-writer.ts` - AI email generation
- `src/lib/outbound/sequence-engine.ts` - Multi-step sequences
- `src/lib/outbound/prospect-research.ts` - Personalization data
- `src/lib/outbound/reply-handler.ts` - Auto-reply detection
- `src/lib/outbound/nurture-service.ts` - Long-term nurture

#### Feature: AI Email Generator

**Route:** `/workspace/[orgId]/outbound/email-writer`  
**API:** `POST /api/outbound/email/generate`

**Required Inputs:**
- Prospect name
- Company name
- Email type (cold outreach, follow-up, demo request, etc.)
- Tone (professional, casual, friendly)
- Key points to include (optional)

**Execution Flow:**

1. **User fills form:**
   - Prospect: "John Doe"
   - Company: "Acme Corp"
   - Type: "Cold Outreach"
   - Tone: "Professional"
   - Points: "We can reduce their AWS costs by 40%"

2. **Backend enrichment:**
   - **File:** `src/lib/outbound/prospect-research.ts`
   - Calls LinkedIn API (if integrated)
   - Calls Clearbit API for company data
   - Calls News API for recent news about company

3. **AI Generation:**
   - **File:** `src/lib/outbound/email-writer.ts`
   - Builds prompt with enrichment data
   - Calls Google Gemini to generate email
   - Includes:
     - Personalized greeting
     - Reference to recent news (e.g., "Congrats on the Series A!")
     - Value proposition
     - Soft CTA

4. **Response:**
   ```
   Subject: Quick question about Acme's AWS infrastructure

   Hi John,

   I noticed Acme just raised $10M in Series A funding - congrats! As you scale, infrastructure costs often balloon unexpectedly.

   We help SaaS companies like yours reduce AWS costs by 30-40% without changing code. For example, we saved TechCorp $50K/month.

   Would you be open to a 15-minute call to see if we could help Acme?

   Best,
   [Your Name]
   ```

5. **User can:**
   - Edit the email
   - Send immediately
   - Add to sequence
   - Save as template

#### Feature: Email Sequences

**Route:** `/workspace/[orgId]/outbound/sequences`  
**API:** `POST /api/outbound/sequences`

**What it does:** Multi-step email campaigns with auto-follow-ups

**Sequence Builder:**
1. **Step 1:** Initial outreach (Day 0)
2. **Step 2:** Follow-up if no reply (Day 3)
3. **Step 3:** Value-add content (Day 7)
4. **Step 4:** Breakup email (Day 14)

**Smart Features:**
- **Auto-stop on reply:** If prospect replies, sequence stops
- **Auto-stop on meeting booked:** If calendar link clicked, sequence stops
- **Personalization tokens:** `{{firstName}}`, `{{company}}`, `{{recent_news}}`

**Underlying Logic:**
- **File:** `src/lib/outbound/sequence-engine.ts`
- Cron job runs every 5 minutes: `POST /api/cron/process-sequences`
- Checks `sequenceEnrollments` collection for emails due to send
- Sends via SendGrid API
- Tracks opens/clicks via unique tracking pixels
- Updates `sequenceEnrollments/[id].lastSentAt`

**Manager AI Instruction:**
"Email sequences are automated follow-up campaigns. You create a series of emails (e.g., intro, follow-up, case study, breakup), and we automatically send them based on your schedule. If the prospect replies or books a meeting, we stop the sequence. Each email is personalized with their name, company, and recent news."

#### Feature: Reply Detection & Processing

**File:** `src/lib/outbound/reply-handler.ts`  
**API:** `POST /api/outbound/reply/process`  
**Webhook:** SendGrid sends inbound email to this endpoint

**Logic:**
1. Prospect replies to outbound email
2. SendGrid forwards reply to webhook
3. System detects:
   - Is it an out-of-office? → Ignore
   - Is it "not interested"? → Mark lead as "lost", stop sequence
   - Is it a question? → Create task for human follow-up
   - Is it "yes, let's talk"? → Create meeting booking task

**Manager AI Instruction:**
"When prospects reply to your outbound emails, we automatically detect their intent. If they say 'not interested', we stop emailing them. If they ask a question, we create a task for you to follow up. If they say 'yes', we suggest booking a meeting."

### Social AI (LinkedIn Messaging)

**File:** `src/lib/integrations/linkedin-messaging.ts`

**Status:** Partially implemented (LinkedIn API limited)

**What it does:**
- Send connection requests with personalized notes
- Send InMail messages (requires LinkedIn Premium)
- Track message opens/replies

**Manager AI Instruction:**
"LinkedIn integration allows you to send connection requests and messages directly from the CRM. We can personalize each message based on their profile, company, and mutual connections."

---

## EMAIL AUTOMATION

### Email Campaign Manager

**Core Files:**
- `src/lib/email/campaign-service.ts` - Campaign management
- `src/lib/email/email-service.ts` - Email sending
- `src/lib/email/email-tracking.ts` - Open/click tracking
- `src/lib/email/email-builder.ts` - Visual email builder
- `src/lib/email/sendgrid-service.ts` - SendGrid integration

#### Feature: Email Campaigns

**Route:** `/workspace/[orgId]/email/campaigns`  
**API:** `POST /api/email/campaigns`

**Required Inputs:**
- Campaign name
- Email template (HTML or visual builder)
- Recipient list (segment or CSV upload)
- Send schedule (immediately or scheduled)

**Execution Flow:**

1. **User creates campaign:**
   - Name: "Q1 Product Launch"
   - Template: Visual builder (drag-drop blocks)
   - Recipients: "All active customers" (500 contacts)
   - Schedule: "Send on Jan 15, 2025 at 9:00 AM"

2. **Template Builder:**
   - **File:** `src/lib/email/email-builder.ts`
   - Drag-drop editor with blocks:
     - Header
     - Text
     - Image
     - Button (CTA)
     - Footer
   - Supports personalization tokens
   - Generates responsive HTML

3. **Scheduling:**
   - Saves to `campaigns/[campaignId]` with `status='scheduled'`
   - Cron job checks for scheduled campaigns: `POST /api/cron/scheduled-publisher`

4. **Sending:**
   - **File:** `src/lib/email/sendgrid-service.ts`
   - Batch sends to 500 recipients
   - Injects tracking pixel for opens
   - Wraps links with tracking redirects for clicks

5. **Tracking:**
   - **Open tracking:** `GET /api/email/track/[trackingId]` (1x1 pixel)
   - **Click tracking:** `GET /api/email/track/link` (redirect through tracking URL)
   - Updates `campaigns/[campaignId].analytics`:
     ```json
     {
       "sent": 500,
       "opened": 245,
       "clicked": 87,
       "bounced": 5,
       "unsubscribed": 2,
       "openRate": 49,
       "clickRate": 17.4
     }
     ```

6. **Analytics Dashboard:**
   - **Route:** `/workspace/[orgId]/email/campaigns/[campaignId]`
   - Shows:
     - Open rate over time (chart)
     - Click heatmap (which links clicked most)
     - Geographic breakdown
     - Device breakdown (mobile vs desktop)

**Manager AI Instruction:**
"Email campaigns let you send bulk emails to segments of your audience. We track opens and clicks automatically, so you can see exactly how each campaign performs. The visual email builder makes it easy to create professional emails without coding."

#### Feature: Email Tracking

**Files:**
- `src/lib/email/email-tracking.ts`
- `src/app/api/email/track/[trackingId]/route.ts`
- `src/app/api/email/track/link/route.ts`

**How it works:**

**Open Tracking:**
1. Email sent with embedded 1x1 transparent pixel:
   ```html
   <img src="https://yourapp.com/api/email/track/abc123" width="1" height="1" />
   ```
2. When email is opened, browser loads pixel
3. API endpoint receives request, logs open event
4. Updates `email_tracking/abc123.opened = true`

**Click Tracking:**
1. Links in email are replaced:
   - Original: `https://yourwebsite.com/pricing`
   - Tracked: `https://yourapp.com/api/email/track/link?id=abc123&url=https://yourwebsite.com/pricing`
2. When clicked, API logs event, then redirects to original URL
3. Updates `email_tracking/abc123.clicked = true`

---

## NATIVE TOOL INVENTORY

### Third-Party Integrations

**Purpose:** Avoid AI token markups by using native APIs

| Tool | Purpose | Entry Point | Config Required |
|------|---------|-------------|-----------------|
| **SendGrid** | Email sending | `src/lib/email/sendgrid-service.ts` | API Key |
| **Twilio** | SMS & Voice | `src/lib/integrations/` | Account SID, Auth Token, Phone Number |
| **Stripe** | Payments | `src/lib/integrations/payment/stripe.ts` | Secret Key, Publishable Key |
| **PayPal** | Payments | `src/lib/integrations/payment/paypal.ts` | Client ID, Secret |
| **Square** | Payments | `src/lib/integrations/payment/square.ts` | Access Token |
| **QuickBooks** | Accounting | `src/lib/integrations/accounting/quickbooks.ts` | OAuth |
| **Xero** | Accounting | `src/lib/integrations/accounting/xero.ts` | OAuth |
| **Slack** | Notifications | `src/lib/integrations/messaging/slack.ts` | Webhook URL or OAuth |
| **Microsoft Teams** | Notifications | `src/lib/integrations/messaging/teams.ts` | Webhook URL or OAuth |
| **Gmail** | Email sync | `src/lib/integrations/email/gmail.ts` | OAuth |
| **Outlook** | Email sync | `src/lib/integrations/email/outlook.ts` | OAuth |
| **Google Calendar** | Calendar sync | `src/lib/integrations/google-calendar-service.ts` | OAuth |
| **Zoom** | Video calls | `src/lib/integrations/video/zoom.ts` | API Key |
| **Calendly** | Scheduling | `src/lib/integrations/scheduling/calendly.ts` | API Key |
| **Salesforce** | CRM sync | `src/lib/integrations/crm/salesforce.ts` | OAuth |
| **HubSpot** | CRM sync | `src/lib/integrations/crm/hubspot.ts` | API Key |
| **Shopify** | E-commerce | `src/lib/integrations/ecommerce/shopify.ts` | API Key |
| **LinkedIn** | Outbound | `src/lib/outbound/apis/linkedin-service.ts` | API Key (limited) |
| **Clearbit** | Enrichment | `src/lib/outbound/apis/clearbit-service.ts` | API Key |
| **Crunchbase** | Funding data | `src/lib/outbound/apis/crunchbase-service.ts` | API Key |
| **BuiltWith** | Tech stack | `src/lib/outbound/apis/builtwith-service.ts` | API Key |
| **News API** | News articles | `src/lib/outbound/apis/news-service.ts` | API Key |

### Integration Setup Flow

**Route:** `/workspace/[orgId]/integrations`  
**API:** `POST /api/integrations/[integrationId]`

**Required Inputs (varies by integration):**
- API Key OR OAuth credentials
- Configuration settings (e.g., default calendar for bookings)

**Example: Slack Integration**

1. **User clicks:** "Connect Slack"
2. **OAuth flow:**
   - Redirects to: `GET /api/integrations/slack/auth`
   - User authorizes on Slack
   - Callback: `GET /api/integrations/slack/callback?code=xyz`
3. **Token exchange:**
   - Exchanges code for access token
   - Saves to Firestore: `organizations/[orgId]/integrations/slack`
4. **Test integration:**
   - Sends test notification to Slack channel
   - **API:** `POST /api/integrations/slack/test`
5. **Ready to use:**
   - Workflows can now send Slack messages
   - Notifications auto-post to Slack

**Manager AI Instruction:**
"Integrations connect the platform to your existing tools. For example, connecting Slack lets you receive lead notifications in your Slack channels. Connecting QuickBooks syncs invoices automatically. Most integrations use OAuth (click to authorize), some require API keys (copy-paste from their settings)."

---

## DATABASE SCHEMA

### Firestore Collections

**File:** `src/lib/firebase/collections.ts`

| Collection | Purpose | Key Fields |
|------------|---------|------------|
| `organizations` | Multi-tenant orgs | `name`, `industry`, `website`, `agentPersona`, `subscription` |
| `users` | User accounts | `email`, `role`, `orgId` |
| `leads` | Sales leads | `name`, `company`, `email`, `status`, `score`, `enrichmentData` |
| `contacts` | People | `firstName`, `lastName`, `email`, `phone`, `companyId` |
| `deals` | Sales opportunities | `name`, `amount`, `stage`, `probability`, `closeDate` |
| `products` | Product catalog | `name`, `price`, `description`, `sku`, `inventory` |
| `orders` | E-commerce orders | `customerId`, `items[]`, `total`, `status`, `shippingAddress` |
| `carts` | Shopping carts | `orgId`, `sessionId`, `items[]`, `total` |
| `conversations` | AI chat history | `customerId`, `messages[]`, `sentiment`, `outcome` |
| `training_data` | AI training examples | `input`, `output`, `feedback`, `flaggedForTraining` |
| `sequences` | Email sequences | `name`, `steps[]`, `status` |
| `sequenceEnrollments` | Sequence subscriptions | `sequenceId`, `contactId`, `currentStep`, `lastSentAt` |
| `workflows` | Automation workflows | `name`, `trigger`, `actions[]`, `enabled` |
| `schemas` | Custom objects | `name`, `fields[]`, `orgId` |
| `integrations` | Third-party connections | `provider`, `credentials`, `status` |
| `pages` | Website pages | `title`, `slug`, `content`, `published` |
| `blogPosts` | Blog content | `title`, `content`, `author`, `publishedAt` |
| `domains` | Custom domains | `domain`, `verified`, `sslStatus` |

### Organization Sub-Collections

**Pattern:** `organizations/[orgId]/sub_collection`

| Sub-Collection | Purpose |
|----------------|---------|
| `agentPersona` | Agent configuration (from onboarding) |
| `knowledge_base` | RAG vector database |
| `temporary_scrapes` | Cached scraping data (7-day TTL) |
| `extracted_signals` | High-value signals detected |
| `research_intelligence` | Industry-specific scraping rules |
| `schemas` | Custom CRM objects |
| `records` | Dynamic data for custom schemas |

---

## WORKFLOW AUTOMATION

### Visual Workflow Builder

**Route:** `/workspace/[orgId]/workflows/new`  
**Component:** `src/components/workflows/VisualWorkflowBuilder.tsx`

**Core Files:**
- `src/lib/workflows/workflow-engine.ts` - Execution engine
- `src/lib/workflows/workflow-executor.ts` - Action runner
- `src/lib/workflows/workflow-triggers.ts` - Trigger definitions
- `src/lib/workflows/actions/*.ts` - Action implementations

### Workflow Structure

```typescript
{
  id: "workflow_123",
  name: "Hot Lead Notification",
  trigger: {
    type: "entity_updated",
    entity: "leads",
    condition: "score >= 80"
  },
  actions: [
    {
      type: "slack_notification",
      config: {
        channel: "#sales",
        message: "🔥 Hot lead: {{lead.name}} (Score: {{lead.score}})"
      }
    },
    {
      type: "send_email",
      config: {
        to: "sales@company.com",
        subject: "Hot lead alert",
        template: "hot_lead_template"
      }
    },
    {
      type: "update_entity",
      config: {
        entity: "leads",
        id: "{{trigger.leadId}}",
        updates: {
          assignedTo: "john@company.com",
          followUpDate: "{{now + 1 day}}"
        }
      }
    }
  ]
}
```

### Available Triggers

**File:** `src/lib/workflows/workflow-triggers.ts`

| Trigger | Description | Config |
|---------|-------------|--------|
| `entity_created` | New record created | `entity`, `condition` (optional) |
| `entity_updated` | Record updated | `entity`, `field`, `condition` |
| `entity_deleted` | Record deleted | `entity` |
| `schedule` | Time-based (cron) | `cronExpression` |
| `webhook` | External HTTP call | `webhookUrl` (generated) |
| `email_received` | Email sent to workflow | `emailAddress` (generated) |

### Available Actions

| Action | File | Purpose | Config |
|--------|------|---------|--------|
| **Send Email** | `src/lib/workflows/actions/email-action.ts` | Send email via SendGrid | `to`, `subject`, `body` |
| **Send SMS** | `src/lib/workflows/actions/sms-action.ts` | Send SMS via Twilio | `to`, `message` |
| **Slack Message** | `src/lib/workflows/actions/slack-action.ts` | Post to Slack | `channel`, `message` |
| **HTTP Request** | `src/lib/workflows/actions/http-action.ts` | Call external API | `url`, `method`, `headers`, `body` |
| **Update Entity** | `src/lib/workflows/actions/entity-action.ts` | Update CRM record | `entity`, `id`, `updates` |
| **Delay** | `src/lib/workflows/actions/delay-action.ts` | Wait X seconds/minutes/hours | `duration` |
| **Conditional** | `src/lib/workflows/actions/conditional-action.ts` | If/else logic | `condition`, `thenActions`, `elseActions` |
| **Loop** | `src/lib/workflows/actions/loop-action.ts` | Iterate over array | `array`, `actions` |
| **AI Agent** | `src/lib/workflows/actions/ai-agent-action.ts` | Call AI agent | `prompt`, `context` |

### Workflow Execution

**Trigger:** Event occurs (e.g., lead score updated)  
**File:** `src/lib/workflows/workflow-executor.ts`

**Flow:**
1. Event fires (e.g., lead score changes from 60 to 85)
2. Workflow engine checks for matching triggers
3. Finds "Hot Lead Notification" workflow
4. Executes actions sequentially:
   - Action 1: Post to Slack ✅
   - Action 2: Send email ✅
   - Action 3: Update lead (assign to sales rep) ✅
5. Logs execution to `workflow_runs` collection

**Manager AI Instruction:**
"Workflows are 'if this, then that' automations. For example: 'If a lead's score goes above 80, post to Slack and assign to a sales rep.' You build them visually by dragging blocks (triggers and actions) and connecting them. The system automatically executes them when conditions are met."

---

## MANAGER AI INSTRUCTIONS

### How to Use This Knowledge Base

**For Explaining Features to Clients:**

1. **Route Location:** Use the route mapping table to direct them to the right page
   - Example: "To create an email sequence, go to Outbound > Sequences in the left sidebar, or visit /workspace/[your-org]/outbound/sequences"

2. **Required Inputs:** Tell them exactly what data they need to provide
   - Example: "To generate an AI email, you'll need the prospect's name, company name, and the type of email you want (cold outreach, follow-up, etc.)"

3. **Underlying Logic:** Explain what happens behind the scenes without technical jargon
   - Example: "When you research a lead, we scrape their website looking for buying signals like recent funding, hiring, or product launches. If we find high-value signals, we automatically boost their lead score and notify you."

4. **Physical UI Changes:** Describe what they'll actually see
   - Example: "When you select the Real Estate template, your Products menu changes to Properties, and you get custom fields like Bedrooms, Square Feet, and Listing Status."

### Common Client Questions & Answers

**Q: How do I build an AI agent?**  
A: Go to Settings > AI Agents > Onboarding. You'll answer 24 questions about your business, products, and sales process. This takes about 20-30 minutes. At the end, you can upload documents (PDFs, Excel files) to teach your agent about your business.

**Q: How does the AI learn about my business?**  
A: Three ways:
1. **Onboarding Questions** - You tell us about your products, pricing, policies, etc.
2. **Document Upload** - Upload PDFs, brochures, FAQs, etc. We extract the text and embed it.
3. **Website Scraping** - Provide your website URL and we automatically extract product info, pricing, and FAQs.

**Q: What's an industry template?**  
A: It's a pre-configured CRM setup for your specific industry. For example, if you select "Real Estate", your CRM transforms to show Properties instead of Products, and the AI learns to talk like a real estate assistant. It saves hours of setup time.

**Q: How does lead scoring work?**  
A: When you add a lead, we automatically research their website looking for "high-value signals" like recent funding, hiring, or product launches. Each signal has a point value. For example:
- Actively hiring: +15 points
- Recent funding: +25 points
- Fast-growing company: +20 points

Leads are scored 0-100. Above 80 = hot lead.

**Q: Can I customize the lead scoring rules?**  
A: Yes! Go to Lead Scoring > Rules. You can create custom rules like "If company size > 500 employees, add +10 points" or "If industry = Healthcare, add +5 points."

**Q: How do email sequences work?**  
A: You create a series of emails (e.g., intro, follow-up, case study, breakup). We send them automatically based on your schedule (e.g., Day 0, Day 3, Day 7). If the prospect replies or books a meeting, we stop the sequence.

**Q: What happens when someone replies to my outbound email?**  
A: We detect their intent:
- "Not interested" → Stop sequence, mark lead as lost
- Question → Create task for you to follow up
- "Yes, let's talk" → Suggest booking a meeting

**Q: How do workflows work?**  
A: Workflows are automations. Example: "If lead score > 80, post to Slack and assign to sales rep." You build them visually by dragging blocks (triggers and actions).

**Q: What integrations are available?**  
A: 20+ integrations including Slack, Gmail, Outlook, QuickBooks, Stripe, Twilio, Zoom, Calendly, Salesforce, and HubSpot. Most use OAuth (click to authorize).

**Q: Can I build a website?**  
A: Yes! Go to Website > Pages. You can create pages, blog posts, and even connect a custom domain. Pages are built with a visual editor (drag-drop blocks).

**Q: How does the AI agent handle pricing questions?**  
A: It references the pricing strategy you provided in onboarding. If you uploaded a pricing sheet, it can quote exact prices. If you set pricing rules (e.g., "10% discount for first-time buyers"), it applies them automatically.

**Q: Can the AI agent make appointments?**  
A: Yes! If you connect your calendar (Google Calendar or Outlook), the AI can suggest available times and book meetings directly.

**Q: How do I train the AI agent?**  
A: Go to Settings > AI Agents > Training. You can:
1. Review past conversations and flag them for training
2. Correct the AI's responses
3. Upload example conversations

The AI learns from corrections and improves over time.

---

## END OF AUDIT REPORT

**Total Features Documented:** 50+  
**Total API Routes:** 154  
**Total UI Pages:** 144  
**Database Collections:** 25+  
**Integrations:** 20+  
**Lines of Code Analyzed:** 200,000+

This document serves as the **complete Logic DNA** of the AI Sales Platform. Use it to:
1. Train Manager AIs on platform capabilities
2. Onboard new developers
3. Explain features to clients
4. Create testing scenarios
5. Build documentation
6. Plan new features

**Last Updated:** December 30, 2025

---

## APPENDIX A: DETAILED DATABASE SCHEMAS

### Organizations Collection

**Collection Path:** `organizations/[orgId]`

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `id` | string | Unique org ID | `org_abc123` |
| `name` | string | Organization name | `Acme Corp` |
| `slug` | string | URL-friendly identifier | `acme-corp` |
| `plan` | enum | Subscription plan | `free`, `pro`, `enterprise` |
| `billingEmail` | string | Billing contact | `billing@acme.com` |
| `branding.logo` | string | Logo URL | `gs://bucket/logo.png` |
| `branding.customDomain` | string | Custom domain | `app.acme.com` |
| `settings.defaultTimezone` | string | Timezone | `America/New_York` |
| `settings.defaultCurrency` | string | Currency code | `USD` |
| `status` | enum | Account status | `active`, `suspended`, `trial` |
| `trialEndsAt` | timestamp | Trial expiration | `2025-01-31T00:00:00Z` |
| `createdAt` | timestamp | Creation date | Auto-generated |
| `updatedAt` | timestamp | Last modified | Auto-updated |
| `isTest` | boolean | Test organization flag | `true` for test data |

**Sub-Collections:**
- `agentPersona` - AI agent configuration (from 24-step onboarding)
- `knowledge_base` - RAG vector embeddings
- `temporary_scrapes` - Cached web scraping data (7-day TTL)
- `extracted_signals` - Detected high-value signals
- `research_intelligence` - Industry-specific scraping rules
- `schemas` - Custom CRM objects
- `records` - Dynamic data for custom schemas
- `integrations` - Third-party API connections
- `workflow_executions` - Workflow run history

### Agent Persona Schema

**Collection Path:** `organizations/[orgId]/agentPersona`

This document stores all 24 onboarding steps:

| Field | Type | Maps to Onboarding Step | Example |
|-------|------|-------------------------|---------|
| `businessName` | string | Step 1 | `Acme Outdoor Gear` |
| `industry` | string | Step 1 | `retail` |
| `website` | string | Step 1 | `https://acme.com` |
| `faqPageUrl` | string | Step 1 | `https://acme.com/faq` |
| `socialMediaUrls` | array[string] | Step 1 | `['https://fb.com/acme']` |
| `companySize` | string | Step 1 | `small` (2-10 employees) |
| `problemSolved` | string | Step 2 | `We help hikers find lightweight gear` |
| `uniqueValue` | string | Step 2 | `Only outdoor gear under 2 lbs` |
| `whyBuy` | string | Step 2 | `Lightweight for long trips` |
| `whyNotBuy` | string | Step 2 | `If you car camp (weight doesn't matter)` |
| `primaryOffering` | string | Step 3 | `Ultralight backpacking tents` |
| `priceRange` | string | Step 3 | `$200-$800` |
| `targetCustomer` | string | Step 3 | `Serious backpackers, thru-hikers` |
| `customerDemographics` | string | Step 3 | `Ages 25-50, outdoorsy, budget $500+` |
| `topProducts` | string | Step 4 | `1. UltraLite Tent ($499), 2. Feather Pack ($299)` |
| `productComparison` | string | Step 4 | `Lighter than REI, same quality` |
| `seasonalOfferings` | string | Step 4 | `Winter sleeping bags (Nov-Feb)` |
| `whoShouldNotBuy` | string | Step 4 | `Car campers, casual hikers` |
| `pricingStrategy` | string | Step 5 | `Premium pricing, quality focus` |
| `discountPolicy` | string | Step 5 | `10% off first order, no other discounts` |
| `volumeDiscounts` | string | Step 5 | `5% off orders $1000+` |
| `firstTimeBuyerIncentive` | string | Step 5 | `10% off + free shipping` |
| `financingOptions` | string | Step 5 | `Affirm available for $300+` |
| `geographicCoverage` | string | Step 6 | `USA only` |
| `deliveryTimeframes` | string | Step 6 | `2-5 business days` |
| `inventoryConstraints` | string | Step 6 | `Winter gear sells out by Dec` |
| `capacityLimitations` | string | Step 6 | `Cannot ship to PO boxes` |
| `returnPolicy` | string | Step 7 | `30 days, full refund, unused only` |
| `warrantyTerms` | string | Step 7 | `Lifetime warranty on tents` |
| `cancellationPolicy` | string | Step 7 | `Free cancellation before shipping` |
| `satisfactionGuarantee` | string | Step 7 | `100% satisfaction or money back` |
| `primaryObjective` | enum | Step 8 | `sales`, `support`, `both` |
| `secondaryObjectives` | array[string] | Step 8 | `['upsell', 'educate']` |
| `successMetrics` | string | Step 8 | `Conversion rate, AOV` |
| `escalationRules` | string | Step 8 | `Escalate if order >$1000 or angry` |
| `typicalSalesFlow` | string | Step 9 | `Qualify → Educate → Recommend → Close` |
| `qualificationCriteria` | string | Step 9 | `Backpacking experience, trip planned` |
| `discoveryQuestions` | string | Step 9 | `Where are you hiking? How long?` |
| `closingStrategy` | string | Step 9 | `Assumptive close, offer free shipping` |
| `commonObjections` | string | Step 10 | `Too expensive, not sure it's worth it` |
| `priceObjections` | string | Step 10 | `Explain weight savings = more comfort` |
| `timeObjections` | string | Step 10 | `Stock is limited, winter gear sells out` |
| `competitorObjections` | string | Step 10 | `We're lighter, better warranty` |
| `supportScope` | string | Step 11 | `Product questions, order tracking` |
| `technicalSupport` | string | Step 11 | `How to set up tent (link to video)` |
| `orderTracking` | string | Step 11 | `USPS tracking link in email` |
| `complaintResolution` | string | Step 11 | `Immediate refund, no questions` |
| `tone` | enum | Step 12 | `professional`, `friendly`, `casual` |
| `agentName` | string | Step 12 | `Alex` |
| `greeting` | string | Step 12 | `Hi! I'm Alex, your gear expert` |
| `closingMessage` | string | Step 12 | `Happy trails!` |
| `closingAggressiveness` | number (1-10) | Step 13 | `7` (moderately aggressive) |
| `questionFrequency` | number (1-10) | Step 13 | `6` (ask questions often) |
| `responseLength` | enum | Step 13 | `brief`, `balanced`, `detailed` |
| `proactiveLevel` | number (1-10) | Step 13 | `8` (very proactive) |
| `uploadedDocs` | array[File] | Step 14 | Processed into `knowledge_base` |
| `urls` | array[string] | Step 14 | Scraped and embedded |
| `faqs` | string | Step 14 | Copy-pasted FAQs |
| `competitorUrls` | array[string] | Step 14 | Competitor analysis |
| `requiredDisclosures` | string | Step 15 | `None` |
| `privacyCompliance` | boolean | Step 15 | `true` |
| `industryRegulations` | string | Step 15 | `CPSC safety standards` |
| `prohibitedTopics` | string | Step 15 | `Don't give medical advice` |
| `industryTemplate` | string | Step 16 | `retail` (triggers template injection) |
| `idleTimeoutMinutes` | number | Step 17 | `30` |
| `priceObjectionStrategy` | string | Step 18 | `Emphasize value, not price` |
| `competitorObjectionStrategy` | string | Step 18 | `Focus on weight and warranty` |
| `timingObjectionStrategy` | string | Step 18 | `Mention limited stock` |
| `authorityObjectionStrategy` | string | Step 18 | `Offer to send info to decision maker` |
| `needObjectionStrategy` | string | Step 18 | `Educate on benefits` |
| `angryCustomerApproach` | string | Step 19 | `Apologize, offer refund immediately` |
| `confusedCustomerApproach` | string | Step 19 | `Simplify, use analogies` |
| `readyToBuySignals` | string | Step 19 | `Asks about shipping, payment options` |
| `disengagementSignals` | string | Step 19 | `Short answers, says "just browsing"` |
| `frustratedCustomerApproach` | string | Step 19 | `Empathize, offer human help` |
| `budgetQualificationQuestions` | string | Step 20 | `What's your budget for this trip?` |
| `timelineQuestions` | string | Step 20 | `When is your trip?` |
| `authorityQuestions` | string | Step 20 | `Are you the decision maker?` |
| `needIdentificationQuestions` | string | Step 20 | `What are your must-haves?` |
| `painPointQuestions` | string | Step 20 | `What problems with current gear?` |
| `assumptiveCloseConditions` | string | Step 21 | `After 3+ questions answered` |
| `urgencyCreationTactics` | string | Step 21 | `Mention low stock, seasonal item` |
| `trialCloseTriggers` | string | Step 21 | `After showing pricing` |
| `softCloseApproaches` | string | Step 21 | `Want me to add to cart?` |
| `prohibitedBehaviors` | string | Step 22 | `Never pressure, never lie` |
| `behavioralBoundaries` | string | Step 22 | `Be helpful, not salesy` |
| `mustAlwaysMention` | string | Step 22 | `Lifetime warranty on tents` |
| `neverMention` | string | Step 22 | `Competitor brands by name` |
| `selectedTrainingMetrics` | array[string] | Step 23 | `['conversion_rate', 'csat']` |
| `uploadedSalesMaterials` | array[File] | Step 24 | Processed into `knowledge_base` |

### Leads Collection

**Collection Path:** `organizations/[orgId]/leads`

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `id` | string | Unique lead ID | `lead_abc123` |
| `firstName` | string | First name | `John` |
| `lastName` | string | Last name | `Doe` |
| `email` | string | Email address | `john@acme.com` |
| `phone` | string | Phone number | `+1-555-123-4567` |
| `company` | string | Company name | `Acme Corp` |
| `website` | string | Company website | `https://acme.com` |
| `title` | string | Job title | `VP of Sales` |
| `status` | enum | Lead status | `new`, `contacted`, `qualified`, `won`, `lost` |
| `score` | number | Lead score (0-100) | `85` |
| `source` | string | Lead source | `website`, `referral`, `linkedin` |
| `assignedTo` | string | User ID of owner | `user_xyz789` |
| `notes` | string | Internal notes | `Met at conference` |
| `tags` | array[string] | Tags for filtering | `['enterprise', 'hot']` |
| `enrichmentData` | object | Scraped data | See below |
| `enrichedAt` | timestamp | Last enrichment | Auto-generated |
| `createdAt` | timestamp | Creation date | Auto-generated |
| `updatedAt` | timestamp | Last modified | Auto-updated |

#### Enrichment Data Sub-Schema

```typescript
enrichmentData: {
  companySize: "500-1000 employees",
  industry: "SaaS",
  revenue: "$50M-$100M",
  funding: {
    total: "$25M",
    lastRound: "Series B",
    lastRoundDate: "2024-06-15"
  },
  signals: [
    {
      id: "hiring",
      label: "Actively Hiring",
      description: "20 open engineering roles",
      scoreBoost: 15,
      detectedAt: "2025-01-10T14:30:00Z"
    },
    {
      id: "expansion",
      label: "Geographic Expansion",
      description: "Opening new office in NYC",
      scoreBoost: 10,
      detectedAt: "2025-01-05T09:00:00Z"
    }
  ],
  techStack: ["React", "Node.js", "AWS"],
  linkedInUrl: "https://linkedin.com/company/acme",
  employeeCount: 750,
  lastScraped: "2025-01-10T15:00:00Z"
}
```

### Workflows Collection

**Collection Path:** `organizations/[orgId]/workflows`

See detailed schema in [APPENDIX A: Detailed Database Schemas](#appendix-a-detailed-database-schemas) above.

**Key Fields:**
- `trigger` - What starts the workflow (entity event, schedule, webhook, manual)
- `conditions` - Filter which records trigger the workflow
- `actions` - What the workflow does (send email, update entity, call API, etc.)
- `settings` - Error handling, rate limiting, logging
- `stats` - Execution statistics (totalRuns, successRate, etc.)

### Conversations Collection

**Collection Path:** `organizations/[orgId]/conversations`

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique conversation ID |
| `customerId` | string | Customer ID or email |
| `sessionId` | string | Session ID |
| `messages` | array[Message] | All messages in conversation |
| `sentiment` | enum | Overall sentiment: `positive`, `neutral`, `negative` |
| `sentimentScore` | number | -1.0 to 1.0 |
| `outcome` | enum | `sale`, `qualified_lead`, `support_resolved`, `abandoned` |
| `flaggedForTraining` | boolean | Should this be used for training? |
| `trainingReason` | string | Why flagged (e.g., "great objection handling") |
| `startTime` | timestamp | Conversation start |
| `endTime` | timestamp | Conversation end |
| `duration` | number | Duration in seconds |
| `goldenMasterVersion` | string | Agent version used (e.g., "v3") |

#### Message Sub-Schema

```typescript
messages: [
  {
    messageId: "msg_123",
    timestamp: "2025-01-10T15:30:00Z",
    role: "customer" | "agent" | "human_agent",
    content: "I'm looking for a lightweight tent",
    metadata: {
      intent: "product_inquiry",
      entities: { product_category: "tents" },
      sentiment: 0.5,
      confidence: 0.92
    }
  }
]
```

### Knowledge Base Collection

**Collection Path:** `organizations/[orgId]/knowledge_base`

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Chunk ID |
| `source` | string | Source document name |
| `sourceType` | enum | `document`, `website`, `faq`, `manual` |
| `content` | string | Text content (max 500 tokens) |
| `embedding` | array[number] | Vector embedding (768 dimensions for Gemini) |
| `metadata` | object | Category, tags, etc. |
| `priority` | number | Retrieval priority (1-10) |
| `createdAt` | timestamp | When added |
| `lastUsed` | timestamp | When last retrieved |
| `usageCount` | number | How many times used |

### Temporary Scrapes Collection

**Collection Path:** `organizations/[orgId]/temporary_scrapes`

| Field | Type | Description | TTL |
|-------|------|-------------|-----|
| `id` | string | Scrape ID | - |
| `url` | string | Scraped URL | - |
| `platform` | enum | `website`, `linkedin`, `news`, etc. | - |
| `content` | object | Scraped data | - |
| `confidence` | number | Data quality score (0-1) | - |
| `createdAt` | timestamp | Scrape timestamp | 7 days |
| `expiresAt` | timestamp | Auto-delete after | 7 days |

**Note:** Firestore TTL policy automatically deletes documents when `expiresAt` passes.

---

## APPENDIX B: API REQUEST/RESPONSE EXAMPLES

### POST /api/agent/process-onboarding

**Purpose:** Process 24-step onboarding and create AI agent persona

**Request:**
```json
{
  "organizationId": "org_abc123",
  "onboardingData": {
    "businessName": "Acme Outdoor Gear",
    "industry": "retail",
    "website": "https://acme.com",
    "problemSolved": "We help hikers find lightweight gear",
    "uniqueValue": "Only outdoor gear under 2 lbs",
    // ... all 24 steps ...
    "industryTemplate": "retail"
  }
}
```

**Response:**
```json
{
  "success": true,
  "agentPersonaId": "persona_xyz789",
  "knowledgeBaseChunks": 47,
  "scrapingQueued": true,
  "websiteScraped": {
    "url": "https://acme.com",
    "pagesScraped": 12,
    "productsFound": 34
  },
  "message": "Agent persona created successfully. Scraping website in background."
}
```

### POST /api/leads/research

**Purpose:** AI-powered lead research using scraper intelligence

**Request:**
```json
{
  "leadId": "lead_abc123",
  "websiteUrl": "https://targetcompany.com" // optional if lead has website
}
```

**Response:**
```json
{
  "success": true,
  "leadId": "lead_abc123",
  "leadScore": 85,
  "previousScore": 60,
  "scoreIncrease": 25,
  "signals": [
    {
      "id": "hiring",
      "label": "Actively Hiring",
      "description": "Company has 20 open engineering positions",
      "keywords": ["hiring", "careers", "join our team"],
      "platform": "website",
      "priority": "HIGH",
      "action": "increase-score",
      "scoreBoost": 15,
      "confidence": 0.92,
      "evidence": "Found 20 job postings on /careers page"
    },
    {
      "id": "funding",
      "label": "Recent Funding",
      "description": "Raised $10M Series A in Q4 2024",
      "platform": "news",
      "priority": "CRITICAL",
      "action": "trigger-workflow",
      "scoreBoost": 25,
      "confidence": 0.88,
      "evidence": "News article dated 2024-12-15"
    }
  ],
  "enrichmentData": {
    "companySize": "50-100 employees",
    "industry": "SaaS",
    "techStack": ["React", "Node.js", "PostgreSQL"],
    "linkedInUrl": "https://linkedin.com/company/targetcompany",
    "employeeCount": 75
  },
  "workflowsTriggered": [
    {
      "workflowId": "workflow_hot_lead",
      "name": "Hot Lead Notification",
      "triggeredAt": "2025-01-10T15:30:00Z"
    }
  ],
  "scrapedAt": "2025-01-10T15:30:00Z",
  "cacheTTL": 604800 // 7 days in seconds
}
```

### POST /api/outbound/email/generate

**Purpose:** Generate AI-powered outbound email

**Request:**
```json
{
  "prospectName": "John Doe",
  "prospectTitle": "VP of Sales",
  "companyName": "Acme Corp",
  "companyWebsite": "https://acmecorp.com",
  "emailType": "cold_outreach",
  "tone": "professional",
  "keyPoints": [
    "We can reduce AWS costs by 40%",
    "Similar companies save $50K/month"
  ],
  "enrichmentData": {
    "recentNews": "Raised $10M Series A",
    "companySize": "50-100 employees",
    "industry": "SaaS"
  }
}
```

**Response:**
```json
{
  "success": true,
  "email": {
    "subject": "Quick question about Acme's AWS infrastructure",
    "body": "Hi John,\n\nI noticed Acme just raised $10M in Series A funding - congratulations! As you scale to 50-100 employees, infrastructure costs often balloon unexpectedly.\n\nWe help SaaS companies like yours reduce AWS costs by 30-40% without changing code. For example, we saved TechCorp $50K/month.\n\nWould you be open to a 15-minute call to see if we could help Acme?\n\nBest,\n[Your Name]",
    "personalizationTokens": {
      "{{recent_news}}": "Raised $10M Series A funding",
      "{{company_size}}": "50-100 employees",
      "{{industry}}": "SaaS"
    }
  },
  "aiModel": "gemini-1.5-pro",
  "generatedAt": "2025-01-10T15:30:00Z",
  "costUSD": 0.0012
}
```

### POST /api/workflows/execute

**Purpose:** Manually execute a workflow

**Request:**
```json
{
  "workflowId": "workflow_abc123",
  "triggerData": {
    "leadId": "lead_xyz789",
    "leadScore": 85,
    "signals": ["hiring", "funding"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "executionId": "exec_1641825600_abc123",
  "status": "completed",
  "startedAt": "2025-01-10T15:30:00Z",
  "completedAt": "2025-01-10T15:30:05Z",
  "duration": 5000, // milliseconds
  "actionResults": [
    {
      "actionId": "action_slack",
      "actionType": "send_slack",
      "actionName": "Notify #sales channel",
      "status": "success",
      "duration": 1200,
      "output": {
        "messageId": "slack_msg_123",
        "channel": "#sales"
      }
    },
    {
      "actionId": "action_email",
      "actionType": "send_email",
      "actionName": "Email sales team",
      "status": "success",
      "duration": 2300,
      "output": {
        "messageId": "sendgrid_msg_456",
        "to": "sales@company.com"
      }
    },
    {
      "actionId": "action_update",
      "actionType": "update_entity",
      "actionName": "Assign lead",
      "status": "success",
      "duration": 800,
      "output": {
        "entityId": "lead_xyz789",
        "updated": {
          "assignedTo": "user_john",
          "followUpDate": "2025-01-11T09:00:00Z"
        }
      }
    }
  ]
}
```

### GET /api/email/track/[trackingId]

**Purpose:** Email open tracking pixel

**Request:**
```http
GET /api/email/track/tracking_abc123
```

**Response:**
```
200 OK
Content-Type: image/gif
Content-Length: 43

[1x1 transparent GIF]
```

**Side Effect:** Updates `email_tracking/tracking_abc123.opened = true`

### POST /api/ecommerce/checkout/create-session

**Purpose:** Create Stripe checkout session for e-commerce orders

**Request:**
```json
{
  "cartId": "cart_abc123",
  "items": [
    {
      "productId": "product_tent_123",
      "productName": "UltraLite Tent",
      "quantity": 1,
      "unitPrice": 49900 // $499.00 in cents
    },
    {
      "productId": "product_pack_456",
      "productName": "Feather Pack",
      "quantity": 1,
      "unitPrice": 29900 // $299.00 in cents
    }
  ],
  "discount": {
    "code": "FIRST10",
    "amount": 7980, // 10% off = $79.80 in cents
    "type": "percentage"
  },
  "shippingAddress": {
    "name": "John Doe",
    "street": "123 Main St",
    "city": "Denver",
    "state": "CO",
    "zipCode": "80202",
    "country": "USA"
  },
  "successUrl": "https://app.acme.com/store/org_abc/checkout/success",
  "cancelUrl": "https://app.acme.com/store/org_abc/cart"
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "cs_test_abc123xyz",
  "sessionUrl": "https://checkout.stripe.com/pay/cs_test_abc123xyz",
  "orderId": "order_xyz789",
  "expiresAt": "2025-01-10T16:30:00Z"
}
```

**Next Step:** Frontend redirects to `sessionUrl` for Stripe checkout

---

## APPENDIX C: FEATURE EXECUTION FLOWS (DETAILED)

### Flow 1: Complete Lead Research Execution

**User Action:** Clicks "Research" button on lead detail page

**Step-by-Step Execution:**

1. **Frontend Event** (`src/app/workspace/[orgId]/leads/research/page.tsx`)
   ```typescript
   onClick={() => {
     fetch('/api/leads/research', {
       method: 'POST',
       body: JSON.stringify({ leadId: 'lead_123' })
     })
   }}
   ```

2. **API Route Handler** (`src/app/api/leads/research/route.ts`)
   - Validates auth token
   - Loads lead from Firestore: `organizations/[orgId]/leads/lead_123`
   - Extracts `lead.website` URL
   - Loads org's industry template: `organizations/[orgId]/agentPersona.industryTemplate`

3. **Template Loading** (`src/lib/persona/industry-templates.ts`)
   - Loads template (e.g., `retail`)
   - Extracts `research.scrapingStrategy` and `research.highValueSignals`

4. **Check Cache** (`src/lib/scraper-intelligence/temporary-scrapes-service.ts`)
   - Query: `temporary_scrapes` where `url == lead.website` and `expiresAt > now()`
   - If found → return cached data (skip scraping)
   - If not found → proceed to scraping

5. **Queue Scraping Job** (`src/lib/services/discovery-engine.ts`)
   - Create job: `{ leadId, websiteUrl, signals: [...], timeout: 30000 }`
   - Add to Firestore queue: `discovery_queue/[jobId]`

6. **Scraper Execution** (`src/lib/scraper-intelligence/scraper-runner.ts`)
   - Launch Playwright headless browser
   - Navigate to `lead.website`
   - Wait for page load
   - Extract:
     - Page title
     - Meta description
     - All text content
     - Links (to find /careers, /about, /news)
   - Follow links to secondary pages (max 5 pages)
   - Extract structured data (JSON-LD, Open Graph)

7. **Distillation** (`src/lib/scraper-intelligence/distillation-engine.ts`)
   - Remove fluff patterns (navigation, footer, ads)
   - Detect high-value signals:
     ```typescript
     for (const signal of template.research.highValueSignals) {
       for (const keyword of signal.keywords) {
         if (content.toLowerCase().includes(keyword.toLowerCase())) {
           detectedSignals.push({
             ...signal,
             evidence: extractSurroundingText(content, keyword)
           })
         }
       }
     }
     ```

8. **Scoring** (`src/lib/scraper-intelligence/confidence-scorer.ts`)
   - Calculate total score boost:
     ```typescript
     let totalBoost = 0;
     for (const signal of detectedSignals) {
       totalBoost += signal.scoreBoost;
     }
     newScore = Math.min(100, currentScore + totalBoost);
     ```

9. **Storage**
   - Save scrape: `temporary_scrapes/[scrapeId]` (TTL 7 days)
   - Save signals: `extracted_signals/[signalId]` (permanent)
   - Update lead: `leads/lead_123.score = newScore`

10. **Workflow Triggers**
    - Check for workflows triggered by `entity.updated` on `leads` where `score >= 80`
    - Execute workflow: Send Slack notification, assign to sales rep

11. **API Response**
    - Return enrichment data to frontend
    - Frontend updates UI with new score and badges

**Total Time:** ~5-15 seconds (depending on website size)

### Flow 2: Email Sequence Enrollment & Execution

**User Action:** Enrolls contact in "Cold Outreach Sequence"

**Initial Enrollment:**

1. **Frontend** (`src/app/workspace/[orgId]/outbound/sequences/page.tsx`)
   ```typescript
   POST /api/outbound/sequences/enroll
   {
     sequenceId: "seq_123",
     contactId: "contact_456",
     variables: { firstName: "John", company: "Acme" }
   }
   ```

2. **API Handler** (`src/app/api/outbound/sequences/enroll/route.ts`)
   - Load sequence from Firestore
   - Create enrollment:
     ```json
     {
       "id": "enrollment_789",
       "sequenceId": "seq_123",
       "contactId": "contact_456",
       "currentStep": 0,
       "status": "active",
       "variables": { "firstName": "John", "company": "Acme" },
       "nextSendAt": "2025-01-10T16:00:00Z", // Send Step 1 immediately
       "createdAt": "2025-01-10T15:55:00Z"
     }
     ```
   - Save to `sequenceEnrollments/enrollment_789`

**Cron Job Processing:**

3. **Cron Trigger** (Every 5 minutes: `POST /api/cron/process-sequences`)
   - Query enrollments:
     ```typescript
     sequenceEnrollments
       .where('status', '==', 'active')
       .where('nextSendAt', '<=', now())
       .limit(50)
     ```

4. **For Each Enrollment** (`src/lib/outbound/sequence-engine.ts`)
   - Load sequence steps
   - Get current step (e.g., Step 1: "Initial Outreach")
   - Replace variables in email body:
     ```typescript
     body = body
       .replace('{{firstName}}', enrollment.variables.firstName)
       .replace('{{company}}', enrollment.variables.company)
     ```

5. **Enrichment** (Optional, if enabled)
   - Call News API for recent company news
   - Add `{{recent_news}}` token

6. **Send Email** (`src/lib/email/sendgrid-service.ts`)
   - Create tracking ID: `tracking_abc123`
   - Inject tracking pixel in body:
     ```html
     <img src="https://app.com/api/email/track/tracking_abc123" width="1" height="1" />
     ```
   - Wrap links with tracking:
     ```html
     <a href="https://app.com/api/email/track/link?id=tracking_abc123&url=https://acme.com">Visit</a>
     ```
   - Send via SendGrid API

7. **Update Enrollment**
   ```json
   {
     "currentStep": 1,
     "lastSentAt": "2025-01-10T16:00:00Z",
     "nextSendAt": "2025-01-13T16:00:00Z", // Step 2 in 3 days
     "emails": [
       {
         "step": 0,
         "sentAt": "2025-01-10T16:00:00Z",
         "trackingId": "tracking_abc123",
         "status": "sent"
       }
     ]
   }
   ```

**Reply Detection:**

8. **Webhook Trigger** (`POST /api/outbound/reply/process`)
   - SendGrid forwards inbound email
   - Extract `In-Reply-To` header → find original `trackingId`
   - Detect intent:
     ```typescript
     if (body.includes('not interested')) {
       stopSequence(enrollmentId);
       updateLead(contactId, { status: 'lost' });
     } else if (body.includes('yes') || body.includes('interested')) {
       stopSequence(enrollmentId);
       createTask({ title: 'Follow up with John', assignTo: salesRep });
     }
     ```

9. **Sequence Stops**
   - Update enrollment: `{ status: 'completed', stoppedReason: 'replied' }`
   - No more emails sent

**Total Duration:** Initial email sent within 5 minutes of enrollment, follow-ups on schedule (Day 3, Day 7, etc.)

---

## APPENDIX D: TESTING SCENARIOS

### Test Scenario 1: Complete Onboarding Flow

**Objective:** Verify 24-step onboarding creates agent persona correctly

**Steps:**
1. Navigate to `/workspace/[orgId]/onboarding`
2. Fill all 24 steps with test data
3. Upload test PDF document in Step 14
4. Select "Real Estate" template in Step 16
5. Click "Complete Setup"

**Expected Results:**
- Document `organizations/[orgId]/agentPersona` created
- All 24 fields stored correctly
- PDF parsed and chunked into `knowledge_base` collection (verify 10+ chunks)
- Template loaded: verify `industryTemplate: "real_estate"`
- Website scraping queued: verify entry in `discovery_queue`
- Success message displayed: "Agent persona created"

**Verification Queries:**
```typescript
// Check persona created
const persona = await db
  .doc(`organizations/${orgId}/agentPersona`)
  .get();
assert(persona.exists);
assert(persona.data().businessName === 'Test Business');

// Check knowledge base chunks
const chunks = await db
  .collection(`organizations/${orgId}/knowledge_base`)
  .get();
assert(chunks.size >= 10);
```

### Test Scenario 2: Lead Research with Signal Detection

**Objective:** Verify scraper detects high-value signals and boosts lead score

**Setup:**
- Create lead with `website: "https://example.com"` (use test website)
- Configure industry template with signals:
  ```typescript
  highValueSignals: [
    {
      id: "hiring",
      keywords: ["hiring", "careers", "join our team"],
      scoreBoost: 15
    }
  ]
  ```

**Steps:**
1. Click "Research" on lead detail page
2. Wait for scraping to complete (~10 seconds)

**Expected Results:**
- Lead score increased from 50 to 65 (+15 for hiring signal)
- `extracted_signals` collection has new entry
- `enrichmentData.signals` contains detected signal
- UI shows "Hiring" badge on lead card
- Workflow triggered if configured (check `workflow_executions`)

**Verification:**
```typescript
const lead = await db.doc(`organizations/${orgId}/leads/${leadId}`).get();
assert(lead.data().score === 65);
assert(lead.data().enrichmentData.signals.length > 0);
assert(lead.data().enrichmentData.signals[0].id === 'hiring');
```

### Test Scenario 3: Workflow Execution

**Objective:** Verify workflow triggers and executes actions

**Setup:**
- Create workflow:
  - Trigger: `entity.updated` on `leads` where `score >= 80`
  - Action 1: Send Slack message
  - Action 2: Update lead `assignedTo = "user_test"`

**Steps:**
1. Create lead with `score: 75`
2. Update lead: `score: 85`

**Expected Results:**
- Workflow triggered automatically
- Slack message sent to configured channel
- Lead updated: `assignedTo: "user_test"`
- Execution logged in `workflow_executions` with status `completed`

**Verification:**
```typescript
const executions = await db
  .collection(`organizations/${orgId}/workflow_executions`)
  .where('workflowId', '==', workflowId)
  .orderBy('startedAt', 'desc')
  .limit(1)
  .get();

const execution = executions.docs[0].data();
assert(execution.status === 'completed');
assert(execution.actionResults.length === 2);
assert(execution.actionResults[0].status === 'success');
```

### Test Scenario 4: Email Sequence with Reply Detection

**Objective:** Verify sequence stops when prospect replies

**Setup:**
- Create 3-step email sequence
- Enroll contact

**Steps:**
1. Enroll contact in sequence
2. Wait 5 minutes (cron processes)
3. Verify Step 1 email sent
4. Send inbound email to reply address (simulate prospect reply)

**Expected Results:**
- Step 1 email sent with tracking pixel
- Enrollment updated: `currentStep: 1`, `nextSendAt` calculated for Step 2
- Reply webhook triggered
- Enrollment stopped: `status: "completed"`, `stoppedReason: "replied"`
- Step 2 NOT sent

**Verification:**
```typescript
const enrollment = await db
  .doc(`sequenceEnrollments/${enrollmentId}`)
  .get();

assert(enrollment.data().status === 'completed');
assert(enrollment.data().stoppedReason === 'replied');
assert(enrollment.data().currentStep === 1); // Stopped after Step 1
```

### Test Scenario 5: E-Commerce Checkout Flow

**Objective:** Verify complete checkout process with Stripe

**Steps:**
1. Add products to cart: `POST /api/ecommerce/cart`
2. Apply discount code: `POST /api/ecommerce/cart/discount`
3. Create checkout session: `POST /api/ecommerce/checkout/create-session`
4. Simulate Stripe webhook: `POST /api/webhooks/stripe` (payment succeeded)

**Expected Results:**
- Cart created with 2 items
- Discount applied (10% off)
- Stripe session created with correct amount
- Order created in `orders` collection after webhook
- Order status: `completed`
- Cart deleted after successful payment

**Verification:**
```typescript
const order = await db.doc(`organizations/${orgId}/orders/${orderId}`).get();
assert(order.exists);
assert(order.data().status === 'completed');
assert(order.data().total === 71820); // $799 - 10% = $719.20 in cents

const cart = await db.doc(`carts/${cartId}`).get();
assert(!cart.exists); // Cart deleted
```

---

## APPENDIX E: INTEGRATION SETUP GUIDES

### Integration Categories

| Category | Integrations | Purpose |
|----------|-------------|---------|
| **Payment** | Stripe, PayPal, Square | Process payments, subscriptions |
| **Email** | Gmail, Outlook, SendGrid | Email sync, campaigns |
| **Calendar** | Google Calendar, Outlook | Meeting scheduling, sync |
| **Communication** | Slack, Microsoft Teams | Notifications, collaboration |
| **CRM** | Salesforce, HubSpot | CRM data sync |
| **Accounting** | QuickBooks, Xero | Invoice sync, financial data |
| **E-commerce** | Shopify | Product/order sync |
| **Scheduling** | Calendly, Zoom | Meeting booking, video calls |
| **Enrichment** | Clearbit, Crunchbase | Lead data enrichment |

### Slack Integration Setup

**Objective:** Send CRM notifications to Slack channels

**Prerequisites:**
- Slack workspace (admin access required)
- Slack channel created (e.g., `#sales`)

**Step-by-Step:**

1. **Navigate to Integration Page**
   - Route: `/workspace/[orgId]/integrations`
   - Click "Connect Slack"

2. **OAuth Authorization**
   - User redirected to: `GET /api/integrations/slack/auth`
   - Backend generates state token (CSRF protection)
   - Redirects to Slack OAuth:
     ```
     https://slack.com/oauth/v2/authorize
       ?client_id=YOUR_CLIENT_ID
       &scope=chat:write,channels:read
       &state=csrf_token_abc123
       &redirect_uri=https://yourapp.com/api/integrations/slack/callback
     ```

3. **User Authorizes on Slack**
   - Selects workspace
   - Grants permissions: `chat:write`, `channels:read`
   - Clicks "Allow"

4. **OAuth Callback**
   - Slack redirects to: `GET /api/integrations/slack/callback?code=xyz&state=csrf_token_abc123`
   - Backend verifies state token
   - Exchanges code for access token:
     ```typescript
     const response = await fetch('https://slack.com/api/oauth.v2.access', {
       method: 'POST',
       headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
       body: new URLSearchParams({
         client_id: process.env.SLACK_CLIENT_ID,
         client_secret: process.env.SLACK_CLIENT_SECRET,
         code: code
       })
     });
     
     const data = await response.json();
     // data.access_token, data.team.name, data.authed_user.id
     ```

5. **Save Credentials**
   - Store in Firestore: `organizations/[orgId]/integrations/slack`
   ```json
   {
     "integrationId": "slack",
     "accessToken": "xoxb-...",
     "teamName": "Acme Corp",
     "metadata": {
       "teamId": "T12345",
       "scope": "chat:write,channels:read"
     },
     "status": "active",
     "connectedAt": "2025-01-10T15:30:00Z"
   }
   ```

6. **Test Integration**
   - API: `POST /api/integrations/slack/test`
   - Sends test message to `#general`:
     ```typescript
     await fetch('https://slack.com/api/chat.postMessage', {
       method: 'POST',
       headers: {
         'Authorization': `Bearer ${accessToken}`,
         'Content-Type': 'application/json'
       },
       body: JSON.stringify({
         channel: '#general',
         text: '🎉 Slack integration connected successfully!'
       })
     });
     ```

7. **Configure Settings**
   - User selects default channel
   - Enables notifications:
     - ✅ New lead (score > 80)
     - ✅ Deal won
     - ✅ Task assigned
   - Saves settings

**File Locations:**
- OAuth Start: `src/app/api/integrations/slack/auth/route.ts`
- OAuth Callback: `src/app/api/integrations/slack/callback/route.ts`
- Service: `src/lib/integrations/messaging/slack.ts`
- Workflow Action: `src/lib/workflows/actions/slack-action.ts`

**Environment Variables Required:**
```env
SLACK_CLIENT_ID=123456789.123456789
SLACK_CLIENT_SECRET=abc123xyz789
SLACK_SIGNING_SECRET=def456uvw123 # For webhook verification
```

**Common Issues:**

| Issue | Cause | Solution |
|-------|-------|----------|
| "Invalid client_id" | Wrong `SLACK_CLIENT_ID` | Verify in Slack App settings |
| "redirect_uri mismatch" | Callback URL not registered | Add to Slack App > OAuth & Permissions |
| "missing_scope" | App doesn't have permission | Request scope in Slack App settings |
| "token_expired" | Access token expired | Slack tokens don't expire, but check revocation |

### QuickBooks Integration Setup

**Objective:** Sync invoices and financial data

**Prerequisites:**
- QuickBooks Online account
- QuickBooks Developer App created

**OAuth Flow:**

1. **User Clicks "Connect QuickBooks"**
   - Route: `/workspace/[orgId]/integrations`
   - Backend generates OAuth URL:
     ```
     https://appcenter.intuit.com/connect/oauth2
       ?client_id=YOUR_CLIENT_ID
       &response_type=code
       &scope=com.intuit.quickbooks.accounting
       &redirect_uri=https://yourapp.com/api/integrations/quickbooks/callback
       &state=csrf_token_abc123
     ```

2. **User Authorizes**
   - Selects QuickBooks company
   - Clicks "Authorize"

3. **Token Exchange**
   - Callback: `GET /api/integrations/quickbooks/callback?code=xyz&realmId=123456`
   - Exchange code for tokens:
     ```typescript
     const response = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
       method: 'POST',
       headers: {
         'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
         'Content-Type': 'application/x-www-form-urlencoded'
       },
       body: new URLSearchParams({
         grant_type: 'authorization_code',
         code: code,
         redirect_uri: redirectUri
       })
     });
     
     // Returns: access_token, refresh_token, expires_in
     ```

4. **Save Credentials**
   ```json
   {
     "integrationId": "quickbooks",
     "accessToken": "eyJenc...",
     "refreshToken": "L011546037...",
     "expiresAt": "2025-01-10T16:30:00Z",
     "metadata": {
       "realmId": "123456",
       "companyName": "Acme Corp"
     }
   }
   ```

5. **Token Refresh** (Automatic every 55 minutes)
   - QuickBooks tokens expire in 1 hour
   - Cron job refreshes every 55 minutes:
     ```typescript
     const newTokens = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
       method: 'POST',
       body: new URLSearchParams({
         grant_type: 'refresh_token',
         refresh_token: refreshToken
       })
     });
     ```

**Syncing Invoices:**

```typescript
// Create invoice in CRM
const invoice = {
  customerId: "customer_123",
  lineItems: [
    { description: "Consulting", amount: 500 }
  ],
  total: 500,
  dueDate: "2025-02-01"
};

// Sync to QuickBooks
await fetch('https://quickbooks.api.intuit.com/v3/company/123456/invoice', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    Line: [{
      Amount: 500,
      DetailType: "SalesItemLineDetail",
      SalesItemLineDetail: {
        ItemRef: { value: "1" } // Service item
      }
    }],
    CustomerRef: { value: "1" } // Customer ID in QuickBooks
  })
});
```

**File Locations:**
- OAuth: `src/app/api/integrations/quickbooks/auth/route.ts`, `src/app/api/integrations/quickbooks/callback/route.ts`
- Service: `src/lib/integrations/accounting/quickbooks.ts`
- Token Refresh: `src/lib/integrations/integration-manager.ts`

### Stripe Integration (Payment Processing)

**Objective:** Accept payments and manage subscriptions

**Setup:**

1. **Get API Keys**
   - Stripe Dashboard → Developers → API Keys
   - Copy:
     - Publishable Key (starts with `pk_`)
     - Secret Key (starts with `sk_`)

2. **Add to Environment**
   ```env
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
   STRIPE_SECRET_KEY=sk_test_...
   ```

3. **Install SDK**
   ```bash
   npm install stripe @stripe/stripe-js @stripe/react-stripe-js
   ```

4. **Setup Webhook**
   - Stripe Dashboard → Developers → Webhooks
   - Add endpoint: `https://yourapp.com/api/webhooks/stripe`
   - Select events:
     - `payment_intent.succeeded`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
   - Copy webhook secret: `whsec_...`

5. **Add Webhook Secret**
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

**Creating Payment Intent:**

```typescript
// Frontend
const { clientSecret } = await fetch('/api/checkout/create-payment-intent', {
  method: 'POST',
  body: JSON.stringify({ amount: 5000 }) // $50.00
}).then(r => r.json());

// Display Stripe payment form
<Elements stripe={stripePromise}>
  <CheckoutForm clientSecret={clientSecret} />
</Elements>

// Backend (src/app/api/checkout/create-payment-intent/route.ts)
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const paymentIntent = await stripe.paymentIntents.create({
  amount: 5000, // $50.00 in cents
  currency: 'usd',
  metadata: {
    orderId: 'order_123',
    organizationId: 'org_abc'
  }
});

return { clientSecret: paymentIntent.client_secret };
```

**Webhook Handler:**

```typescript
// src/app/api/webhooks/stripe/route.ts
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');
  
  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return new Response('Webhook signature verification failed', { status: 400 });
  }
  
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      const orderId = paymentIntent.metadata.orderId;
      
      // Update order status
      await db.doc(`orders/${orderId}`).update({
        status: 'completed',
        paidAt: new Date()
      });
      break;
      
    case 'customer.subscription.created':
      // Handle new subscription
      break;
  }
  
  return new Response('OK', { status: 200 });
}
```

### Gmail Integration (Email Sync)

**Objective:** Sync emails to CRM, send emails through Gmail

**OAuth Flow:**

1. **Google Cloud Console Setup**
   - Create OAuth 2.0 credentials
   - Add scopes:
     - `https://www.googleapis.com/auth/gmail.readonly` (read emails)
     - `https://www.googleapis.com/auth/gmail.send` (send emails)
   - Add authorized redirect URI: `https://yourapp.com/api/integrations/google/callback`

2. **Environment Variables**
   ```env
   GOOGLE_CLIENT_ID=123456789.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=abc123xyz
   ```

3. **User Connects Gmail**
   - OAuth URL:
     ```
     https://accounts.google.com/o/oauth2/v2/auth
       ?client_id=YOUR_CLIENT_ID
       &redirect_uri=https://yourapp.com/api/integrations/google/callback
       &response_type=code
       &scope=https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send
       &access_type=offline
       &prompt=consent
     ```

4. **Token Exchange**
   ```typescript
   const { tokens } = await oauth2Client.getToken(code);
   // tokens.access_token, tokens.refresh_token
   ```

5. **Sync Emails**
   ```typescript
   // List messages
   const response = await gmail.users.messages.list({
     userId: 'me',
     maxResults: 10,
     q: 'is:unread' // Only unread
   });
   
   // Get message details
   for (const message of response.data.messages) {
     const msg = await gmail.users.messages.get({
       userId: 'me',
       id: message.id,
       format: 'full'
     });
     
     // Extract email data
     const headers = msg.data.payload.headers;
     const from = headers.find(h => h.name === 'From').value;
     const subject = headers.find(h => h.name === 'Subject').value;
     const body = msg.data.snippet;
     
     // Save to CRM
     await db.collection('emails').add({
       from, subject, body,
       receivedAt: new Date(parseInt(msg.data.internalDate))
     });
   }
   ```

**File Locations:**
- OAuth: `src/app/api/integrations/google/auth/route.ts`, `src/app/api/integrations/google/callback/route.ts`
- Service: `src/lib/integrations/email/gmail.ts`

---

## APPENDIX F: MANAGER AI CONVERSATION TEMPLATES

### Template 1: Explaining Onboarding to New Client

**Client Question:** "How do I set up my AI sales agent?"

**Manager AI Response:**

"Great question! Setting up your AI agent is a 20-30 minute process called 'onboarding.' Here's what it looks like:

**Where to start:**
Go to Settings > AI Agents > Onboarding. You'll see a wizard with 24 steps.

**What you'll need:**
- Your website URL (we'll automatically scrape it)
- Product/service details (pricing, descriptions)
- Common customer questions
- Sales policies (returns, warranties, etc.)
- Any documents you want the AI to reference (PDFs, brochures)

**Step-by-step:**
1. **Business Basics** (Step 1): Company name, industry, website
2. **Value Proposition** (Steps 2-4): What you sell, who you sell to, why they buy
3. **Pricing** (Step 5): Price ranges, discounts, financing options
4. **Operations** (Step 6): Delivery times, geographic coverage
5. **Policies** (Step 7): Returns, warranties, cancellations
6. **Agent Behavior** (Steps 8-13): How aggressive should the AI be? Friendly or professional?
7. **Knowledge Upload** (Step 14): Upload PDFs, paste FAQs
8. **Advanced** (Steps 15-24): Objection handling, sentiment detection, closing techniques

**What happens behind the scenes:**
- We parse your documents and split them into chunks
- We scrape your website to learn about your products
- We embed everything using AI so the agent can search it
- We create a 'persona' for your agent based on your answers

**Pro tips:**
- The more detail you provide, the smarter your agent will be
- Upload your FAQ document - it's pure gold for training
- If you have an industry template (like Real Estate or E-commerce), select it in Step 16 - it pre-configures everything

**After onboarding:**
You can go to Settings > AI Agents > Training to review past conversations and correct the AI if it made mistakes. It learns from corrections!

Want me to walk you through it step-by-step?"

---

### Template 2: Explaining Lead Scoring

**Client Question:** "Why did this lead get a score of 85?"

**Manager AI Response:**

"Good question! Lead scoring is automatic based on 'signals' we detect when researching the company. Here's how it works:

**Base Score:**
Every new lead starts at 50 points.

**High-Value Signals:**
When you add a lead (or when we research one automatically), we scrape their website looking for specific keywords. Each signal adds points:

- **Actively Hiring** (+15 points): Found job postings on their careers page
- **Recent Funding** (+25 points): Raised money in the last 6 months (from news)
- **Fast Growth** (+10 points): Mentioned 'expanding', 'scaling', 'growing'
- **Tech Stack Match** (+5 points): Uses technology you integrate with
- **Recent News** (+10 points): Mentioned in press recently
- **Company Size** (+5-15 points): Bigger companies = more points (if you target enterprise)

**Your Lead (85 points):**
```
Base: 50
+ Hiring: 15 (found 'We're hiring 20 engineers' on /careers)
+ Funding: 25 (raised $10M Series A in Dec 2024)
+ Growth: 10 (website mentions 'expanding to NYC')
─────────
Total: 100 (capped at 100)
```

**Actually scored 85?**
Probably means we found 2 out of 3 signals. Check the lead detail page - you'll see badges for each signal detected.

**Customizing Scoring:**
You can customize these rules! Go to:
Settings > Lead Scoring > Rules

You can:
- Change point values (make hiring worth +20 instead of +15)
- Add custom rules ('If industry = Healthcare, add +10')
- Add new signals ('If website has blog, add +5')

**Automation:**
Leads scoring 80+ automatically trigger a workflow (if you set it up). For example:
- Post to #sales Slack channel
- Assign to your best sales rep
- Send email alert

Want me to show you how to customize the scoring rules?"

---

### Template 3: Explaining Email Sequences

**Client Question:** "How do email sequences work?"

**Manager AI Response:**

"Email sequences are automated follow-up campaigns. Let me break it down:

**What is a sequence?**
A series of emails sent over time. For example:
- **Day 0:** Initial outreach ('Hey, noticed you raised $10M...')
- **Day 3:** Follow-up ('Just checking in...')
- **Day 7:** Value-add ('Here's a case study...')
- **Day 14:** Breakup email ('Is this still relevant?')

**Creating a sequence:**
1. Go to Outbound > Sequences
2. Click 'Create Sequence'
3. Add 3-5 emails (subject + body)
4. Use personalization tokens:
   - `{{firstName}}` → 'John'
   - `{{company}}` → 'Acme Corp'
   - `{{recent_news}}` → 'Congrats on your Series A!'

**Enrolling prospects:**
Two ways:
1. **Manually:** Select contacts, click 'Enroll in Sequence'
2. **Automatically:** Workflow triggers when lead score > 80

**Smart features:**
- **Auto-stop on reply:** If they reply, we stop emailing
- **Auto-stop on meeting:** If they book a meeting, we stop
- **Link tracking:** We track which links they click
- **Open tracking:** We know if they opened the email

**Example sequence:**

**Email 1 (Day 0):**
```
Subject: Quick question about {{company}}'s AWS costs

Hi {{firstName}},

I noticed {{company}} just {{recent_news}} - congrats!

As you scale, infrastructure costs often balloon. We help SaaS companies reduce AWS costs by 30-40%.

Would you be open to a 15-minute call?
```

**Email 2 (Day 3):**
```
Subject: Re: Quick question about {{company}}'s AWS costs

Hi {{firstName}},

Just following up on my email from Monday. I know your inbox is busy!

Quick question: Are you happy with your current AWS costs, or is there room for improvement?
```

**Email 3 (Day 7):**
```
Subject: How TechCorp saved $50K/month

Hi {{firstName}},

I put together a quick case study showing how TechCorp (similar to {{company}}) reduced AWS costs by 40%.

[Link to PDF]

Would this be relevant for you?
```

**What happens when they reply?**
We detect their intent:
- **'Not interested'** → Stop sequence, mark lead as 'lost'
- **Question** → Stop sequence, create task for you to follow up
- **'Yes, let's talk'** → Stop sequence, suggest booking a meeting

**Analytics:**
Go to Sequences > Analytics to see:
- Open rate (% who opened)
- Click rate (% who clicked links)
- Reply rate (% who replied)
- Meeting booked rate (% who scheduled a call)

**Pro tip:**
Write emails that provide value, not just 'checking in.' Share case studies, industry reports, or helpful tips. People respond to helpful content, not sales pitches.

Want me to help you write your first sequence?"

---

### Template 4: Troubleshooting Integration Issues

**Client Question:** "My Slack integration isn't working. I'm not getting notifications."

**Manager AI Response:**

"Let's troubleshoot your Slack integration. I'll walk you through the common fixes:

**Step 1: Verify it's connected**
- Go to Settings > Integrations
- Find Slack in the list
- Status should be 'Active' (green)
- If it says 'Error' or 'Disconnected', click 'Reconnect'

**Step 2: Check notification settings**
- Click 'Configure' next to Slack
- Make sure notifications are enabled:
  - ✅ New lead (score > 80)
  - ✅ Deal won
  - ✅ Task assigned
- Verify the channel is correct (e.g., #sales, not #general)

**Step 3: Test the integration**
- Click 'Test Integration' button
- You should see a test message in your Slack channel
- If you DON'T see it:
  - Check if the bot was removed from the channel
  - Go to Slack, type `/invite @YourAppBot` in the channel

**Step 4: Check permissions**
- In Slack, click your workspace name (top left)
- Go to 'Settings & administration' > 'Manage apps'
- Find 'Your App Name'
- Click 'Permissions'
- Verify it has `chat:write` permission

**Step 5: Trigger a real notification**
- Create a test lead with score > 80
- Or update an existing lead's score to 85
- Wait 30 seconds (workflows are queued)
- Check Slack

**Still not working?**
Send me:
1. Screenshot of your Slack integration settings
2. A test lead ID
3. The Slack channel name

I'll debug it on the backend and get back to you within 1 hour.

**Common causes:**
- Bot removed from Slack channel (solution: re-invite)
- Notification threshold too high (e.g., only sends if score > 90, but your leads are scoring 80-85)
- Workflow is paused (check Workflows > Hot Lead Notification > Status = 'Active')
- Slack token expired (rare, but click 'Reconnect' to fix)

Which step are you stuck on?"

---

### Template 5: Explaining Template Injection

**Client Question:** "What does selecting a template do to my CRM?"

**Manager AI Response:**

"Great question! Templates physically transform your CRM to match your industry. Here's what happens:

**Before selecting template:**
You see generic CRM fields:
- Companies
- Contacts
- Deals
- Products
- Tasks

**After selecting 'Real Estate' template:**

**1. Schema Changes:**
- **Products** renamed to **Properties**
- New fields added to Properties:
  - Bedrooms (number)
  - Bathrooms (number)
  - Square Feet (number)
  - Listing Status (Active/Pending/Sold)
  - MLS Number (text)
- **Deals** renamed to **Offers**
- New fields added to Offers:
  - Offer Amount
  - Contingencies
  - Inspection Date

**2. New Custom Objects Created:**
- **Showing** object (for property tours)
  - Date & Time
  - Property (link)
  - Contact (link)
  - Feedback (notes)
  - Status (Scheduled/Completed/No Show)

**3. AI Agent Changes:**
- **Before:** Generic sales assistant
  - Greeting: 'Hi! How can I help you today?'
  - Focus: General product sales
- **After:** Real estate specialist
  - Greeting: 'Hi! I'm your real estate assistant. Looking to buy, sell, or rent?'
  - Focus: Property matching, showings, offers
  - Knows real estate terminology (MLS, escrow, contingencies)

**4. Scraper Intelligence Changes:**
When you research a lead, we look for:
- **Before:** Generic signals (hiring, funding)
- **After:** Real estate-specific signals:
  - Luxury property listings (+20 points)
  - Recent high-value sales (+30 points)
  - Investment properties mentioned (+15 points)

**5. Workflow Templates Added:**
- **Showing Scheduled** → Send reminder SMS 1 hour before
- **Offer Received** → Notify agent immediately
- **Listing Sold** → Send congratulations email, archive listing

**6. Dashboard Widgets:**
- **Before:** Revenue, pipeline
- **After:** Properties listed, showings this week, offers pending

**Physical changes you'll see:**
1. Left sidebar: 'Products' changes to 'Properties'
2. Create button: 'New Product' → 'New Property'
3. Detail pages: Property detail shows bedrooms, sq ft, etc.
4. Reports: Pre-built reports for 'Listings by Status', 'Average Sale Price'

**Can you customize it?**
Yes! Templates are starting points. You can:
- Add more custom fields
- Rename anything you want
- Create new objects
- Modify the AI agent's personality

**Can you change templates later?**
Yes, but be careful! Changing from 'Real Estate' to 'E-commerce' will:
- Rename your objects (Properties → Products)
- Some data might not map perfectly
- We'll ask you to confirm before making changes

**Pro tip:**
If you're in a unique industry not covered by our templates, select 'General Business' and customize from scratch. Or contact us to request a custom template!

Which template are you considering?"

---

## APPENDIX G: TROUBLESHOOTING GUIDE

### Issue: Lead Score Not Updating After Research

**Symptoms:**
- Clicked "Research" button
- Scraping completed successfully
- No change in lead score

**Diagnosis:**

1. **Check scraped data:**
   ```typescript
   // Firestore query
   db.collection('temporary_scrapes')
     .where('url', '==', leadWebsite)
     .orderBy('createdAt', 'desc')
     .limit(1)
   ```
   - Verify scrape document exists
   - Check `content` field - is it empty?

2. **Check signal detection:**
   ```typescript
   db.collection('extracted_signals')
     .where('leadId', '==', leadId)
     .orderBy('detectedAt', 'desc')
   ```
   - If empty → No signals detected
   - Check `template.research.highValueSignals` - are keywords present in scraped content?

3. **Check industry template:**
   - Load template: `organizations/[orgId]/agentPersona.industryTemplate`
   - If `null` or `'general'` → Template has no research intelligence configured
   - Solution: Select a template with research (Real Estate, Healthcare, etc.)

**Fix:**
```typescript
// Add custom signal to template
const template = await getTemplateById(orgId);
template.research.highValueSignals.push({
  id: 'custom_signal',
  keywords: ['your', 'keywords', 'here'],
  scoreBoost: 10
});
await updateTemplate(orgId, template);
```

---

### Issue: Workflow Not Triggering

**Symptoms:**
- Lead score updated to 85
- Workflow configured to trigger on `score >= 80`
- Workflow didn't execute

**Diagnosis:**

1. **Check workflow status:**
   - Route: `/workspace/[orgId]/workflows/[workflowId]`
   - Status should be `Active`, not `Paused` or `Draft`

2. **Check workflow trigger:**
   ```typescript
   workflow.trigger.type === 'entity.updated'
   workflow.trigger.schemaId === 'leads'
   workflow.conditions[0].field === 'score'
   workflow.conditions[0].operator === 'greater_than_or_equal'
   workflow.conditions[0].value === 80
   ```

3. **Check execution logs:**
   ```typescript
   db.collection(`organizations/${orgId}/workflow_executions`)
     .where('workflowId', '==', workflowId)
     .orderBy('startedAt', 'desc')
     .limit(10)
   ```
   - If empty → Trigger never fired
   - If status `failed` → Check `error` field

4. **Check rate limiting:**
   - Workflow settings: `maxRunsPerHour`
   - If exceeded, workflow is queued until next hour

**Fix:**
1. Ensure workflow is `Active`
2. Test manually: `POST /api/workflows/execute` with test data
3. Check Firestore triggers are registered (server restart may be needed)

---

### Issue: Email Sequence Not Sending

**Symptoms:**
- Contact enrolled in sequence
- No emails sent after 5 minutes

**Diagnosis:**

1. **Check enrollment status:**
   ```typescript
   db.doc(`sequenceEnrollments/${enrollmentId}`).get()
   ```
   - `status` should be `'active'`, not `'paused'` or `'completed'`
   - `nextSendAt` should be in the past

2. **Check cron job:**
   - Cron runs every 5 minutes: `/api/cron/process-sequences`
   - Check last run time in logs
   - If not running → Verify cron job configured on Vercel/hosting

3. **Check SendGrid API key:**
   - Environment variable: `SENDGRID_API_KEY`
   - Test by sending test email: `POST /api/email/send`

4. **Check email template:**
   - Load sequence, check step content
   - Verify variables are replaced (e.g., `{{firstName}}` → actual name)

**Fix:**
1. Manually trigger cron: `POST /api/cron/process-sequences` (requires admin auth)
2. Verify SendGrid API key is valid
3. Check email quota (SendGrid free tier = 100 emails/day)

---

### Issue: Integration Token Expired

**Symptoms:**
- Integration shows "Error" status
- API calls fail with 401 Unauthorized

**Diagnosis:**

1. **Check token expiration:**
   ```typescript
   const integration = await db.doc(`organizations/${orgId}/integrations/${integrationId}`).get();
   const expiresAt = integration.data().expiresAt;
   
   if (new Date(expiresAt) < new Date()) {
     // Token expired
   }
   ```

2. **Check refresh token:**
   - If `refreshToken` exists → Auto-refresh should work
   - If `refreshToken` is `null` → User must reconnect

3. **Check refresh logic:**
   - File: `src/lib/integrations/integration-manager.ts`
   - Function: `refreshIntegrationToken()`
   - Logs should show refresh attempts

**Fix:**
1. **QuickBooks/Zoom (OAuth):** Auto-refresh works
   - Wait 5 minutes for next refresh attempt
   - Or manually trigger: `await refreshIntegrationToken(orgId, integrationId, refreshToken)`

2. **Slack (doesn't expire):**
   - Token doesn't expire unless revoked
   - If revoked, user must reconnect

3. **Gmail/Google (OAuth):**
   - Must request `access_type=offline` to get refresh token
   - If missing, user must reconnect

---

## APPENDIX H: COMMON USE CASES & IMPLEMENTATIONS

### Use Case 1: Automated Hot Lead Pipeline

**Business Goal:** Automatically identify and route high-value leads to sales team

**Implementation:**

**Components Used:**
1. Lead Scoring System
2. Scraper Intelligence
3. Workflow Automation
4. Slack Integration

**Setup Steps:**

1. **Configure Industry Template** (if available)
   - Route: `/workspace/[orgId]/onboarding` → Step 16
   - Select appropriate template (e.g., "SaaS" for B2B software)
   - Template provides pre-configured signals:
     - Hiring signals
     - Funding signals
     - Growth signals

2. **Customize Scoring Rules**
   - Route: `/workspace/[orgId]/lead-scoring`
   - Add custom rule:
     ```json
     {
       "name": "Enterprise Size Boost",
       "condition": "companySize >= 500",
       "scoreBoost": 15,
       "enabled": true
     }
     ```

3. **Create "Hot Lead" Workflow**
   - Route: `/workspace/[orgId]/workflows/new`
   - Trigger: `entity.updated` on `leads`
   - Condition: `score >= 80`
   - Actions:
     - **Action 1:** Send Slack message to `#sales`
       ```
       🔥 Hot Lead Alert!
       
       Name: {{lead.name}}
       Company: {{lead.company}}
       Score: {{lead.score}}
       Signals: {{lead.enrichmentData.signals}}
       
       [View Lead](https://app.com/workspace/org/leads/{{lead.id}})
       ```
     - **Action 2:** Update lead
       ```json
       {
         "assignedTo": "top_sales_rep_user_id",
         "followUpDate": "{{now + 1 day}}"
       }
       ```
     - **Action 3:** Create task
       ```json
       {
         "title": "Follow up with {{lead.name}}",
         "assignTo": "top_sales_rep_user_id",
         "dueDate": "{{now + 1 day}}",
         "priority": "high"
       }
       ```

4. **Enable Auto-Research**
   - Cron job automatically researches new leads
   - API: `/api/discovery/queue/process` (runs hourly)
   - New leads get enriched within 60 minutes

**End-to-End Flow:**

```
1. Lead Created (webhook, CSV import, or manual)
   ↓
2. Auto-research queued (within 1 hour)
   ↓
3. Scraper crawls website, detects signals
   - Found: "We're hiring 20 engineers"
   - Signal: "Actively Hiring" (+15 points)
   - Found: "Raised $10M Series A"
   - Signal: "Recent Funding" (+25 points)
   ↓
4. Lead score updated: 50 → 90
   ↓
5. Workflow triggered (score >= 80)
   ↓
6. Actions executed:
   - Slack notification sent ✅
   - Lead assigned to top rep ✅
   - Task created ✅
   ↓
7. Sales rep sees notification, calls lead same day
```

**Expected Results:**
- 80% of hot leads contacted within 24 hours
- 30% increase in conversion rate (hot leads vs cold leads)
- Sales team spends time on quality leads, not cold calling

---

### Use Case 2: E-Commerce Abandoned Cart Recovery

**Business Goal:** Recover abandoned carts with automated email sequence

**Implementation:**

**Components Used:**
1. E-commerce cart tracking
2. Email sequences
3. Workflow automation
4. Stripe integration

**Setup:**

1. **Cart Abandonment Detection**
   - Workflow trigger: `entity.updated` on `carts`
   - Condition: `lastModified > 30 minutes ago AND items.length > 0 AND status == 'active'`

2. **Create Recovery Sequence**
   - Route: `/workspace/[orgId]/outbound/sequences`
   - 3-email sequence:

**Email 1 (1 hour after abandonment):**
```
Subject: You left something behind!

Hi {{firstName}},

Looks like you forgot to complete your order. 

Your cart:
{{#each cartItems}}
- {{name}} - ${{price}}
{{/each}}

Total: ${{total}}

[Complete Your Order →]

Not ready? No worries - we'll hold your cart for 24 hours.
```

**Email 2 (24 hours):**
```
Subject: Last chance: 10% off your order

Hi {{firstName}},

Your cart expires in 24 hours! 

Complete your order now and get 10% off with code: SAVE10

Your cart (${{total}}):
{{cartSummary}}

After discount: ${{totalWithDiscount}}

[Complete Order →]
```

**Email 3 (48 hours):**
```
Subject: Your cart has expired

Hi {{firstName}},

Your cart has been cleared, but we saved your items:

{{cartSummary}}

[Shop Again →]

Need help? Reply to this email - we're here for you!
```

3. **Workflow Setup**
   - Trigger: Cart abandoned (30 min idle)
   - Action 1: Enroll in "Cart Recovery" sequence
   - Action 2: Create discount code (10% off)
   - Action 3: Track abandonment in analytics

**Code Implementation:**

```typescript
// Detect abandoned carts (cron job every 15 minutes)
const abandonedCarts = await db
  .collection('carts')
  .where('status', '==', 'active')
  .where('items.length', '>', 0)
  .where('lastModified', '<', new Date(Date.now() - 30 * 60 * 1000)) // 30 min ago
  .get();

for (const cart of abandonedCarts.docs) {
  const cartData = cart.data();
  
  // Enroll customer in recovery sequence
  await enrollInSequence({
    sequenceId: 'cart_recovery_seq',
    contactId: cartData.customerId,
    variables: {
      firstName: cartData.customerName,
      cartItems: cartData.items,
      total: cartData.total,
      cartUrl: `https://app.com/store/${orgId}/cart/${cart.id}`
    }
  });
  
  // Create discount code
  await stripe.promotionCodes.create({
    coupon: 'cart_recovery_10_off',
    customer: cartData.stripeCustomerId,
    max_redemptions: 1,
    expires_at: Math.floor(Date.now() / 1000) + (48 * 60 * 60) // 48 hours
  });
  
  // Update cart status
  await cart.ref.update({ 
    status: 'abandoned',
    abandonedAt: new Date(),
    recoverySequenceEnrolled: true
  });
}
```

**Expected Results:**
- 15-20% cart recovery rate
- Average recovered order value: $75
- $15K additional monthly revenue (100 recoveries × $150 AOV × 20% margin)

---

### Use Case 3: AI-Powered Customer Support

**Business Goal:** Automate 80% of support inquiries with AI agent

**Implementation:**

**Components Used:**
1. AI Chat Agent
2. Knowledge Base (RAG)
3. Sentiment Analysis
4. Escalation Workflows

**Setup:**

1. **Build Knowledge Base**
   - Upload documents:
     - Product manuals (PDFs)
     - FAQs (Excel)
     - Return policy (Word doc)
     - Troubleshooting guides
   - Add website pages:
     - /support
     - /faq
     - /shipping-policy

2. **Configure Agent Persona**
   - Tone: `Friendly, helpful, patient`
   - Primary Objective: `Support`
   - Escalation Rules:
     ```
     Escalate if:
     - Customer is angry (sentiment < -0.5)
     - Issue is refund/billing
     - Customer asks for human 3+ times
     - Complex technical issue
     ```

3. **Create Support Workflows**

**Workflow 1: Angry Customer Escalation**
- Trigger: `ai_agent` → sentiment < -0.5
- Actions:
  - Create urgent ticket
  - Assign to support manager
  - Send SMS to manager: "Angry customer needs help"

**Workflow 2: Refund Request**
- Trigger: `ai_agent` → keyword detected: "refund"
- Actions:
  - Create refund ticket
  - Auto-approve if < 30 days since purchase
  - Send refund confirmation email

**Workflow 3: Order Status Inquiry**
- Trigger: `ai_agent` → intent: "order_status"
- Actions:
  - Query order database
  - Get tracking number
  - Send tracking link to customer

**Agent Prompt Example:**

```
You are a customer support agent for [Company Name].

Your knowledge:
- Product manuals: [embedded]
- FAQs: [embedded]
- Policies: [embedded]

Your capabilities:
- Look up orders by order number or email
- Check order status and tracking
- Answer product questions
- Process returns (within 30 days)

Your limitations:
- Cannot process refunds > $500 (escalate to human)
- Cannot access customer payment methods
- Cannot change shipping address after order shipped

Tone: Friendly, helpful, empathetic

If customer is frustrated:
1. Apologize sincerely
2. Acknowledge their frustration
3. Offer immediate solution or escalate

If you don't know the answer:
Say: "Great question! Let me check with my team and get back to you in 15 minutes."
Then escalate to human agent.
```

**Conversation Example:**

```
Customer: "Where is my order? It's been 2 weeks!"

AI: "I'm so sorry for the delay! Let me check on that for you right away. Can you please provide your order number or the email you used to place the order?"

Customer: "Order #12345"

AI: [Looks up order in database]
"Thank you! I found your order #12345. It shipped on January 5th via USPS. Tracking shows it's currently in transit and should arrive by January 12th.

Here's your tracking link: [link]

The delay is due to weather in the Midwest. I sincerely apologize for the inconvenience. Would you like me to contact the carrier for an update?"

Customer: "Yes please"

AI: "Absolutely! I've submitted a tracer request with USPS. You should receive an update within 24 hours via email. 

Is there anything else I can help you with today?"

Customer: "No, thanks"

AI: "You're welcome! We appreciate your patience. Feel free to reach out if you have any other questions. Have a great day!"

[Conversation ends]
[Sentiment: Neutral → Positive]
[No escalation needed]
[Saved: 1 support ticket]
```

**Metrics Tracking:**

```typescript
// Analytics dashboard shows:
{
  "totalConversations": 1243,
  "resolvedByAI": 1015, // 81.6%
  "escalatedToHuman": 228, // 18.4%
  "averageResolutionTime": "3.2 minutes",
  "averageSentiment": 0.65, // Positive
  "topIssues": [
    { "issue": "Order Status", "count": 342 },
    { "issue": "Returns", "count": 189 },
    { "issue": "Product Questions", "count": 156 }
  ]
}
```

**Expected Results:**
- 80% of inquiries resolved by AI (no human needed)
- 3-minute average resolution time (vs 24 hours for email support)
- 85% customer satisfaction (CSAT)
- $10K/month savings (2 fewer support agents needed)

---

### Use Case 4: Automated Sales Outreach at Scale

**Business Goal:** Send 1000 personalized cold emails per week

**Implementation:**

**Components Used:**
1. Lead import (CSV)
2. Lead enrichment (Clearbit, Scraper)
3. AI email generation
4. Email sequences
5. Reply detection

**Workflow:**

**Week 1: Import & Enrich**

1. **Import Leads**
   - Upload CSV with 1000 leads:
     ```csv
     email,company,firstName,lastName,website
     john@acme.com,Acme Corp,John,Doe,https://acme.com
     ...
     ```

2. **Auto-Enrich (runs overnight)**
   - Cron job enriches 50 leads/hour
   - For each lead:
     - Scrape website
     - Call Clearbit API for company data
     - Call News API for recent news
     - Calculate lead score
     - Save enrichment data

3. **Segment Leads**
   - Filter by score:
     - Hot leads (80-100): 150 leads
     - Warm leads (60-79): 350 leads
     - Cold leads (0-59): 500 leads

**Week 2: Personalized Outreach**

4. **Generate Personalized Emails (AI)**
   - For each hot lead:
     ```typescript
     const email = await generateEmail({
       prospectName: lead.firstName,
       companyName: lead.company,
       recentNews: lead.enrichmentData.recentNews,
       painPoints: lead.enrichmentData.painPoints,
       emailType: 'cold_outreach',
       tone: 'professional'
     });
     
     // Returns:
     {
       subject: "Quick question about Acme's AWS costs after Series A",
       body: "Hi John,\n\nCongrats on Acme's $10M Series A! I saw the announcement on TechCrunch.\n\nAs you scale from 50 to 100 employees, infrastructure costs often balloon 3-5x...\n\n[Personalized based on their situation]"
     }
     ```

5. **Enroll in Sequence**
   - Hot leads → 4-touch sequence (aggressive)
   - Warm leads → 3-touch sequence (moderate)
   - Cold leads → 2-touch sequence (soft)

6. **Send Emails**
   - Batch send via SendGrid
   - Stagger sends (100 emails/hour to avoid spam filters)
   - Track opens/clicks

**Week 3: Follow-Up & Reply Handling**

7. **Auto-Reply Detection**
   - Positive reply ("Yes, let's talk") → Create task, suggest meeting time
   - Question → Create task for human follow-up
   - Out of office → Pause sequence, retry in 1 week
   - Not interested → Unsubscribe, mark lead as lost

8. **Human Follow-Up**
   - Sales rep sees tasks in CRM
   - All context available:
     - Lead score
     - Enrichment data (company size, recent news)
     - Email thread history
     - Signals detected

**Automation Code:**

```typescript
// Auto-enrich imported leads (cron job)
const newLeads = await db.collection('leads')
  .where('status', '==', 'new')
  .where('enrichedAt', '==', null)
  .limit(50)
  .get();

for (const lead of newLeads.docs) {
  const leadData = lead.data();
  
  // Enrich
  const [websiteData, clearbitData, newsData] = await Promise.all([
    scrapeWebsite(leadData.website),
    enrichWithClearbit(leadData.email),
    getRecentNews(leadData.company)
  ]);
  
  // Calculate score
  const score = calculateLeadScore({
    ...leadData,
    enrichmentData: { websiteData, clearbitData, newsData }
  });
  
  // Update lead
  await lead.ref.update({
    score,
    enrichmentData: { websiteData, clearbitData, newsData },
    enrichedAt: new Date()
  });
}

// Auto-enroll high-scoring leads (cron job)
const hotLeads = await db.collection('leads')
  .where('score', '>=', 80)
  .where('sequenceEnrolled', '!=', true)
  .limit(100)
  .get();

for (const lead of hotLeads.docs) {
  const leadData = lead.data();
  
  // Generate personalized email
  const email = await generateEmail({
    prospectName: leadData.firstName,
    companyName: leadData.company,
    recentNews: leadData.enrichmentData.newsData?.headline,
    emailType: 'cold_outreach'
  });
  
  // Create sequence with personalized content
  await enrollInSequence({
    sequenceId: 'hot_lead_sequence',
    contactId: lead.id,
    customEmails: {
      step1: email // Overrides template with personalized email
    }
  });
  
  await lead.ref.update({ sequenceEnrolled: true });
}
```

**Expected Results:**
- 1000 leads imported & enriched per week
- 150 hot leads identified (15%)
- 600 emails sent per week (4-touch × 150 leads)
- 20% open rate (120 opens)
- 5% reply rate (30 replies)
- 2% meeting booked rate (20 meetings)
- $100K pipeline generated per month (20 meetings × $5K avg deal size)

**Cost:**
- Clearbit: $0.50/lead × 1000 = $500/month
- SendGrid: $15/month (40K emails)
- Scraping: Free (in-house)
- **Total:** $515/month
- **ROI:** $100K pipeline ÷ $515 = 194x ROI

---

## APPENDIX I: QUICK REFERENCE GUIDE

### Essential API Endpoints

| Function | Endpoint | Method | Auth Required |
|----------|----------|--------|---------------|
| Create lead | `/api/workspace/[orgId]/leads` | POST | Yes |
| Research lead | `/api/leads/research` | POST | Yes |
| Generate AI email | `/api/outbound/email/generate` | POST | Yes |
| Send email | `/api/email/send` | POST | Yes |
| Create workflow | `/api/workflows` | POST | Yes |
| Execute workflow | `/api/workflows/execute` | POST | Yes |
| Process onboarding | `/api/agent/process-onboarding` | POST | Yes |
| Chat with AI | `/api/agent/chat` | POST | Yes |
| Create checkout session | `/api/ecommerce/checkout/create-session` | POST | Yes |
| Track email open | `/api/email/track/[trackingId]` | GET | No |

### Essential Collections

| Collection | Purpose | Key Fields |
|------------|---------|------------|
| `organizations` | Tenant data | `name`, `plan`, `settings` |
| `organizations/[id]/agentPersona` | AI config | All 24 onboarding fields |
| `organizations/[id]/knowledge_base` | RAG vectors | `content`, `embedding` |
| `leads` | Sales leads | `name`, `email`, `score`, `enrichmentData` |
| `workflows` | Automations | `trigger`, `actions`, `status` |
| `sequenceEnrollments` | Email sequences | `currentStep`, `nextSendAt` |
| `conversations` | AI chat history | `messages`, `sentiment`, `outcome` |
| `temporary_scrapes` | Cached web data | `url`, `content`, `expiresAt` (7 days) |

### Essential Environment Variables

```env
# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project
FIREBASE_ADMIN_SERVICE_ACCOUNT={"type":"service_account",...}

# AI
GOOGLE_GEMINI_API_KEY=AIza...

# Email
SENDGRID_API_KEY=SG.abc...
SENDGRID_FROM_EMAIL=noreply@yourapp.com

# SMS
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=abc...
TWILIO_PHONE_NUMBER=+15555551234

# Payment
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Integrations
SLACK_CLIENT_ID=123...
SLACK_CLIENT_SECRET=abc...
QUICKBOOKS_CLIENT_ID=AB...
QUICKBOOKS_CLIENT_SECRET=xyz...
ZOOM_CLIENT_ID=abc...
ZOOM_CLIENT_SECRET=xyz...

# Enrichment (optional)
CLEARBIT_API_KEY=sk_...
CRUNCHBASE_API_KEY=abc...
NEWS_API_KEY=xyz...
```

### Key File Locations

| Component | File Path |
|-----------|-----------|
| Onboarding UI | `src/app/workspace/[orgId]/onboarding/page.tsx` |
| Onboarding API | `src/app/api/agent/process-onboarding/route.ts` |
| Lead Scoring | `src/lib/services/lead-scoring-engine.ts` |
| Scraper Runner | `src/lib/scraper-intelligence/scraper-runner.ts` |
| Workflow Engine | `src/lib/workflows/workflow-engine.ts` |
| Email Sequences | `src/lib/outbound/sequence-engine.ts` |
| AI Chat | `src/app/api/agent/chat/route.ts` |
| Integration Manager | `src/lib/integrations/integration-manager.ts` |

### Testing Commands

```bash
# Unit tests
npm test

# E2E tests
npm run test:e2e

# Playwright tests
npm run test:playwright

# Type check
npm run type-check

# Linting
npm run lint

# Seed test data
npm run seed:test-orgs

# Cleanup test data
npm run cleanup:test-orgs
```

### Common Tasks

**Add new integration:**
1. Create service file: `src/lib/integrations/[provider]/[name].ts`
2. Add OAuth routes: `src/app/api/integrations/[provider]/auth/route.ts` and `callback/route.ts`
3. Add to integration list: Update `src/types/integrations.ts`
4. Test: `POST /api/integrations/[provider]/test`

**Add new workflow action:**
1. Create action file: `src/lib/workflows/actions/[name]-action.ts`
2. Implement `execute[Name]Action()` function
3. Add to workflow engine: Update `src/lib/workflows/workflow-engine.ts` switch statement
4. Add type: Update `src/types/workflow.ts`

**Add new high-value signal:**
1. Edit template: `src/lib/persona/templates/[industry].ts`
2. Add to `research.highValueSignals` array
3. Test: Research a lead with signal present

**Add new onboarding step:**
1. Edit form: `src/app/workspace/[orgId]/onboarding/page.tsx`
2. Add state field
3. Add UI step
4. Update backend: `src/app/api/agent/process-onboarding/route.ts`
5. Update types: `src/types/agent-memory.ts`

---

## CONCLUSION

This audit document provides a complete map of the AI Sales Platform's Logic DNA. It covers:

- ✅ **144 UI Routes** mapped to exact file paths
- ✅ **154 API Endpoints** with request/response schemas
- ✅ **24-Step Onboarding** with field-by-field mapping
- ✅ **Industry Template System** with mutation rules
- ✅ **Scraper Intelligence** execution flow
- ✅ **Email & Outbound** automation systems
- ✅ **20+ Integrations** with setup guides
- ✅ **Workflow Automation** engine details
- ✅ **Database Schemas** with field types
- ✅ **Manager AI** conversation templates
- ✅ **Troubleshooting** scenarios
- ✅ **Common Use Cases** with full implementations

**Use this document to:**
1. Train Manager AIs on platform capabilities
2. Onboard new developers
3. Create comprehensive test suites
4. Explain features to clients
5. Debug production issues
6. Plan new features
7. Document integrations
8. Build customer success playbooks

**Document Statistics:**
- Total Features Documented: 50+
- Total API Routes: 154
- Total UI Pages: 144
- Database Collections: 25+
- Integrations: 20+
- Lines of Audit Documentation: 3,500+
- Lines of Code Analyzed: 200,000+

---

**Last Updated:** December 30, 2025  
**Audit Type:** Static Analysis (READ-ONLY)  
**No Files Modified:** ✅ Zero code changes made  
**Purpose:** Testing & Training Knowledge Base
