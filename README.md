# SalesVelocity.ai

> **Platform:** Single-Tenant AI Sales Platform (Penthouse Model)
> **Build Status:** Passing - TypeScript: 0 errors, ESLint: 0 warnings, Build: Clean
> **API Directory:** HARDENED ZONE - Zero `any` types, 100% Zod validation, strict type safety
> **Branch:** `dev` (production-bound)

AI-powered sales platform with a 52-agent autonomous swarm, customer memory persistence, real-time conversation management, and full e-commerce capabilities.

---

## Architecture

**Single-Tenant Penthouse Model** — This is NOT a multi-tenant SaaS platform. SalesVelocity.ai operates as a single-company deployment. Clients purchase services and products; they do not receive tenants.

- **Organization ID:** `rapid-compliance-root`
- **Firebase Project:** `rapid-compliance-65f87`
- **Domain:** SalesVelocity.ai

### Technology Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 15 (App Router), React 18.2.0 |
| **Language** | TypeScript (Strict Mode, Zero `any` Policy) |
| **Database** | Firebase Firestore (real-time) |
| **Authentication** | Firebase Auth + Custom Claims (4-role RBAC) |
| **AI Gateway** | OpenRouter (100+ models), Google Gemini, OpenAI, Anthropic |
| **Payments** | Stripe, Square |
| **Voice/SMS** | Twilio |
| **Email** | SendGrid |
| **Deployment** | Vercel |
| **Validation** | Zod schema validation on all API inputs |
| **Guardrails** | Husky pre-commit hooks, ESLint zero-warning enforcement |

### Codebase Scale

| Metric | Count |
|--------|-------|
| Physical Routes (page.tsx) | 159 |
| API Endpoints (route.ts) | 226 |
| AI Agents | 52 (48 swarm + 4 standalone) |
| RBAC Roles | 4 (owner, admin, manager, member) |
| Firestore Collections | 60+ |

---

## Engineering Standards

The `src/app/api/` directory is a **Hardened Zone** with enforced type safety:

- **Zero `any` Policy** — All 226 API routes use strict TypeScript
- **Zod Validation** — All inputs validated with schemas
- **Async Params** — Next.js 15 compliant `await params` pattern
- **Service Layer** — Business logic delegated to typed services

See [ENGINEERING_STANDARDS.md](./ENGINEERING_STANDARDS.md) for complete coding standards.

**Pre-Commit Guardrails:**
- Husky pre-commit hooks block unsafe patterns
- `npm run lint` must pass with zero warnings
- `npx tsc --noEmit` must pass with zero errors
- `npm run build` must succeed
- No new `any` types, `eslint-disable`, or `@ts-ignore` comments allowed

---

## Core Innovation: AI Agent Swarm + Customer Memory

### 52-Agent Autonomous Swarm

A hierarchical agent system with 1 Master Orchestrator, 9 Domain Managers, 38 Specialists, and 4 Standalone Agents:

- **Master Orchestrator** — Command/Saga pattern task dispatch, intent-based routing
- **9 Domain Managers** — Intelligence, Marketing, Builder, Architect, Commerce, Outreach, Content, Revenue, Reputation
- **38 Specialists** — Deep expertise in specific tasks (SEO, TikTok, email, pricing, etc.)
- **4 Standalone** — Jasper (AI assistant), Voice Agent, Social Posting Agent, Chat Service

**Cross-Agent Communication:** TenantMemoryVault signal bus (BROADCAST, DIRECT, BUBBLE_UP, BUBBLE_DOWN)

### Golden Master + Customer Memory

- **Golden Master** — Versioned AI agent configuration trained for your business
- **Customer Memory** — Persistent conversation history and learned preferences across all sessions
- **Instance Spawning** — Ephemeral agent instances load customer context on-demand
- **ConversationMemory** — Unified retrieval across voice, chat, SMS, email with Lead Briefing generator
- **Omnichannel Continuity** — Customers recognized across web chat, email, voice, SMS

---

## Key Features

### AI Agent System
- Training center with scenario-based learning
- Golden Master versioning and deployment
- Real-time chat with sentiment analysis
- RAG (Retrieval Augmented Generation) from knowledge base
- Multi-provider AI support (OpenAI, Anthropic, Gemini, OpenRouter)

### Sales & CRM
- Lead management (capture, score, enrich, nurture)
- Deal pipeline with stage tracking and forecasting
- Contact management with lookup fields
- Email sequences with automated tracking
- Voice calling via Twilio
- Meeting scheduler

### Autonomous Operations
- Event-driven OODA loop (Observe-Orient-Decide-Act)
- 25+ event rules mapping business events to manager actions
- 3-tier cron: 4h operational, 24h strategic, weekly executive
- Revenue pipeline automation, outreach autonomy, content production
- Executive briefing dashboard with approval gateway

### E-Commerce
- Product catalog with variants
- Shopping cart with discounts
- Stripe/Square checkout
- Order management and fulfillment
- Inventory tracking

### Website Builder
- Page editor with drag-and-drop widgets
- SEO management
- Blog editor
- Custom domain support
- Form builder

### Integrations
- **Email:** Gmail (OAuth), Outlook (OAuth), SendGrid
- **Chat:** Slack (OAuth + webhooks)
- **Voice/SMS:** Twilio
- **Payments:** Stripe, Square
- **Automation:** Zapier (webhook-based)
- **Accounting:** QuickBooks, Xero (graceful fallback)

---

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Environment
```bash
# Copy environment template
cp env.template .env.local

# Add Firebase configuration to .env.local
# (Get from Firebase Console > Project Settings > General)
```

Required services:
- **Firebase** — Database and auth (required)
- **OpenAI/Anthropic/OpenRouter** — AI models (at least one required)
- **SendGrid** — Email sending (optional)
- **Stripe** — Payments (optional)

### 3. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Documentation

### Authoritative References
| Document | Purpose |
|----------|---------|
| [CLAUDE.md](./CLAUDE.md) | Binding AI development governance |
| [ENGINEERING_STANDARDS.md](./ENGINEERING_STANDARDS.md) | Code quality requirements |
| [docs/single_source_of_truth.md](./docs/single_source_of_truth.md) | Authoritative architecture reference |
| [AGENT_REGISTRY.json](./AGENT_REGISTRY.json) | 52-agent system inventory |
| [CONTINUATION_PROMPT.md](./CONTINUATION_PROMPT.md) | Current sprint context |

### Feature Documentation
| Document | Purpose |
|----------|---------|
| [docs/master_library/](./docs/master_library/) | Per-feature audit summaries (15 features) |
| [docs/master_library/00_AUDIT_SUMMARY.md](./docs/master_library/00_AUDIT_SUMMARY.md) | Latest feature audit (Feb 5, 2026) |

### Archives
| Document | Purpose |
|----------|---------|
| [docs/archive/](./docs/archive/) | Historical records and session changelogs |

---

## Project Structure

```
src/
├── app/                       # Next.js App Router
│   ├── api/                   # 226 API endpoints (Hardened Zone)
│   ├── (dashboard)/           # 114 dashboard pages
│   ├── (auth)/                # Authentication flows
│   ├── (public)/              # Public-facing pages
│   └── onboarding/            # Onboarding experience
├── components/                # 185 React components (26 categories)
├── lib/                       # Core business logic
│   ├── agents/                # 52-agent swarm system
│   ├── ai/                    # AI provider abstraction
│   ├── db/                    # Firestore service layer
│   ├── conversation/          # ConversationMemory + analysis
│   ├── orchestration/         # Event router + signal bus
│   ├── orchestrator/          # Jasper + command authority
│   ├── voice/                 # Voice AI + TTS
│   ├── ecommerce/             # E-commerce services
│   ├── integrations/          # Third-party integrations
│   └── ...                    # 45+ subsystems total
├── types/                     # 39 TypeScript definition files
├── hooks/                     # 14 custom React hooks
└── contexts/                  # React context providers
```

---

## Development

```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
npm run lint         # ESLint validation (zero-warning mode)
npm run type-check   # TypeScript strict check
npm test             # Unit tests
```

---

## License

Proprietary - All rights reserved
