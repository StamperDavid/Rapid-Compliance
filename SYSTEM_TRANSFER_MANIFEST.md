# Full System Transfer Manifest
> **Generated:** January 13, 2026
> **Platform:** AI Sales Platform (ai-crm-platform)
> **Purpose:** Complete context handoff for AI session continuity

---

## 1. CORE TECH STACK

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| **Framework** | Next.js (App Router) | 14.2.33 | Full-stack React framework |
| **Language** | TypeScript | 5.9.3 | Type safety |
| **Styling** | Tailwind CSS | 3.4.0 | Utility-first CSS |
| **State** | Zustand | 4.4.7 | Lightweight client state |
| **Server State** | TanStack Query | 5.14.2 | Async state management |
| **Database** | Firebase/Firestore | 10.7.1 | NoSQL document database |
| **Forms** | React Hook Form + Zod | 7.49.2 / 3.25.76 | Form handling + validation |
| **AI Primary** | Google Generative AI (Gemini) | 0.21.0 | Main AI provider |
| **AI Secondary** | OpenRouter | - | 100+ model fallback |
| **Payments** | Stripe | 14.25.0 | Billing & subscriptions |
| **Voice** | Twilio | 5.10.6 | Voice calls, SMS |
| **Email** | SendGrid | 8.1.6 | Transactional email |
| **Monitoring** | Sentry | 10.27.0 | Error tracking |
| **Testing** | Jest + Playwright | 30.2.0 / 1.57.0 | Unit + E2E |
| **Caching** | Redis (ioredis) | 5.8.2 | Session/response cache |

---

## 2. MASTER ARCHITECTURE

### Multi-Tenant Structure

```
ADMIN (Platform Owner)                    MERCHANT (Customer)
─────────────────────                    ────────────────────
/admin/*                                 /workspace/[orgId]/*
  └─ Global config                         └─ Organization-scoped
  └─ All orgs management                   └─ Their own data only
  └─ System health                         └─ Feature access by plan
  └─ Pricing tiers                         └─ White-label theming
```

### Route Group Architecture

```
src/app/
├── (auth)/              # Authentication routes
│   └── admin-login/     # Platform admin login
│
├── (public)/            # Public-facing routes (no auth required)
│   ├── login, signup, forgot-password
│   ├── about, features, pricing, contact
│   ├── blog, docs, faq, security, privacy, terms
│   ├── demo
│   └── f/[formId]/      # PUBLIC FORM VIEW (NEW!)
│
├── admin/               # Platform admin dashboard
│   ├── organizations/   # Manage all tenants
│   ├── users/           # Global user management
│   ├── billing/         # Platform-wide billing
│   ├── analytics/       # Cross-tenant analytics
│   ├── system/          # Health, logs, API keys, flags
│   ├── voice/           # Voice marketplace admin
│   ├── templates/       # Global template management
│   └── growth/          # SEO, content generation
│
├── workspace/[orgId]/   # MERCHANT DASHBOARD (main app)
│   ├── dashboard/       # KPIs, overview
│   ├── workforce/       # AI Workforce HQ (11 agents)
│   ├── conversations/   # Chat/call history
│   │
│   │─── CRM ───────────────────
│   ├── leads/           # Lead management + research
│   ├── deals/           # Pipeline management
│   ├── contacts/        # Contact database
│   ├── living-ledger/   # Activity ledger
│   │
│   │─── Lead Gen ──────────────
│   ├── forms/           # FORM BUILDER (NEW!)
│   ├── lead-scoring/    # ML-based scoring
│   │
│   │─── Outbound ──────────────
│   ├── outbound/        # Sequences
│   ├── email/           # Campaigns
│   ├── email-writer/    # AI email composer
│   ├── nurture/         # Drip campaigns
│   ├── calls/           # Voice calling
│   │
│   │─── Content Factory ───────
│   ├── content/video/   # VIDEO STUDIO (Director/Stitcher)
│   ├── social/          # Social media
│   ├── proposals/       # Proposal builder
│   ├── battlecards/     # Competitive intel
│   │
│   │─── AI Workforce ──────────
│   ├── settings/ai-agents/    # Agent config/training
│   ├── voice/training/        # Voice AI Lab
│   ├── social/training/       # Social AI Lab
│   ├── seo/training/          # SEO AI Lab
│   ├── ai/datasets/           # Training data
│   ├── ai/fine-tuning/        # Model fine-tuning
│   │
│   │─── Website ───────────────
│   ├── website/pages/         # Page editor
│   ├── website/blog/          # Blog system
│   ├── website/seo/           # SEO MANAGER
│   ├── website/domains/       # Domain management
│   │
│   │─── Analytics ─────────────
│   ├── analytics/             # Overview
│   ├── analytics/revenue/     # Revenue metrics
│   ├── analytics/pipeline/    # Pipeline health
│   │
│   └── settings/              # Org settings
│
├── store/[orgId]/       # E-commerce storefront
│   ├── products/
│   └── checkout/
│
├── sites/[orgId]/       # Published websites
│   └── [[...slug]]/
│
└── api/                 # API routes
    ├── admin/           # Admin-only APIs
    ├── public/          # Public APIs (forms, chat)
    ├── workspace/       # Org-scoped APIs
    └── webhooks/        # External webhooks
```

---

## 3. THE SPECIALIZED INDUSTRY WORKFORCE

### Location
```
src/lib/templates/workforce-templates.ts (~6,000 lines)
```

### The 11 Specialists

| # | Agent Role | Platform | Codename | Purpose |
|---|------------|----------|----------|---------|
| 1 | `broadcaster` | YouTube | The Broadcaster | Long-form video content |
| 2 | `short_form_lead` | TikTok/Reels | The Short-Form Lead | Viral lead generation |
| 3 | `visual_storyteller` | Instagram | The Visual Storyteller | Visual narrative |
| 4 | `realtime_voice_global` | X/Twitter | The Real-Time Voice (Global) | Real-time commentary |
| 5 | `realtime_voice_community` | Truth Social | The Real-Time Voice (Community) | Community engagement |
| 6 | `professional_networker` | LinkedIn | The Professional Networker | B2B outreach |
| 7 | `visual_discovery` | Pinterest | The Visual Discovery Engine | Discovery traffic |
| 8 | `community_builder` | Meta/Facebook | The Community Builder | Group engagement |
| 9 | `direct_line` | Newsletter | The Direct Line | Subscriber engagement |
| 10 | `digital_architect` | Web Migrator | The Digital Architect | Website automation |
| 11 | `intelligence_gatherer` | Lead Hunter | The Intelligence Gatherer | Web intelligence |

### Agent Manual Structure (per specialist)
```typescript
interface AgentManual {
  id: string;
  name: string;
  role: AgentRole;
  platform: WorkforcePlatform;
  systemPrompt: string;           // Core programming (~500-1000 lines each)
  platformPhysics: PlatformPhysics;  // Algorithm rules, posting windows
  toolConfig: AgentToolConfig;    // Permissions, limits, auto-actions
  outputFormats: OutputFormat[];  // Content templates
  kpis: AgentKPI[];              // Success metrics
  escalationTriggers: string[];  // Human handoff conditions
}
```

### Supporting Files
- `workforce-orchestrator.ts` - Deploys/manages agent fleet
- `template-engine.ts` - Resolves templates to agents
- `industry-templates.ts` - Industry vertical mappings

---

## 4. KEY FEATURES BUILT

### A. Form Builder System
**Location:** `src/components/forms/` + `src/lib/forms/`

**Components:**
- `FormBuilder.tsx` (34KB) - Drag-and-drop orchestrator
- `FormCanvas.tsx` - Renders form layout
- `FieldEditor.tsx` (23KB) - Field property panel
- `FieldPalette.tsx` - Draggable field library

**Firestore Structure:**
```
organizations/{orgId}/workspaces/{workspaceId}/forms/{formId}
├── /fields/{fieldId}              # Field configs (SUBCOLLECTION)
├── /submissions/{submissionId}    # Form responses (SUBCOLLECTION)
├── /analytics/{date}              # Daily stats
├── /fieldAnalytics/{fieldId_date} # Per-field metrics
└── /views/{viewId}                # Embed views
```

**23 Field Types Supported:**
- Input: text, textarea, email, phone, number, currency
- Selection: dropdown, multiselect, radio, checkbox
- Date/Time: date, datetime, time
- Upload: file, image, signature
- Rating: rating, scale (1-10)
- Composite: address, name, hidden
- Display: heading, paragraph, divider, pagebreak

**Public Form Route:** `/f/[formId]` - `src/app/(public)/f/[formId]/page.tsx`

---

### B. Video Engine (Director/Stitcher)
**Location:** `src/lib/video/engine/`

**Architecture:**
```
director-service.ts    → Converts Brand DNA + Trends → Master Storyboard JSON
multi-model-picker.ts  → Selects optimal AI model per shot type
stitcher-service.ts    → Assembles final video from rendered segments
style-guide-integrator.ts → Applies VisualStyleSeed to shots
```

**Shot Types:** extreme-close-up, close-up, medium, wide, aerial, dutch-angle, tracking, etc.

**Camera Motions:** static, dolly-in, dolly-out, pan-left, pan-right, crane-up, orbit, handheld, etc.

**Platform Durations:**
- YouTube: 30-180s (optimal: 60s)
- TikTok: 15-60s (optimal: 30s)
- Instagram: 15-90s (optimal: 30s)
- LinkedIn: 30-120s (optimal: 60s)

---

### C. SEO Manager
**Location:** `src/app/workspace/[orgId]/website/seo/`

**Features:**
- Meta tag management
- Sitemap generation
- Schema.org markup
- Blog SEO optimization
- Keyword tracking

**Related Services:**
- `src/lib/brand/brand-dna-service.ts` - Brand voice for SEO content
- `src/app/api/admin/growth/seo/route.ts` - SEO API

---

### D. Living Manifest Registry (Dynamic Sidebar)
**Location:** `src/app/workspace/[orgId]/layout.tsx`

**Current Navigation Sections:**
1. Command Center (Workforce HQ, Dashboard, Conversations)
2. CRM (Leads, Deals, Contacts, Living Ledger)
3. Lead Gen (Forms, Lead Research, Lead Scoring)
4. Outbound (Sequences, Campaigns, Email Writer, Nurture, Calls)
5. Automation (Workflows, A/B Tests)
6. Content Factory (Video Studio, Social Media, Proposals, Battlecards)
7. AI Workforce (Agent Training, Voice AI Lab, Social AI Lab, SEO AI Lab, Datasets, Fine-Tuning)
8. E-Commerce (Products, Orders, Storefront)
9. Analytics (Overview, Revenue, Pipeline, Sequences)
10. Website (Pages, Blog, Domains, SEO, Site Settings)
11. Settings (Settings, Integrations, API Keys)

---

## 5. ENVIRONMENT FIXES

### A. PowerShell .ps1 Shim Fix
**Problem:** Windows npm creates `.ps1` shims that fail with execution policy errors.

**Solution:** Development scripts are provided in `scripts/` directory:
- `scripts/start-dev.ps1` - Start dev environment
- `scripts/setup-dev.ps1` - Initial setup
- `scripts/quick-start.ps1` - Quick start
- `scripts/verify-setup.ps1` - Verify installation
- `START.ps1` - Root launcher

**Execution Policy Fix:**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Or run scripts directly:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-dev.ps1
```

---

### B. Sentry/Instrumentation Configuration
**Files:**
- `instrumentation.ts` - Entry point for Next.js instrumentation
- `sentry.server.config.ts` - Server-side Sentry config
- `sentry.edge.config.ts` - Edge runtime config

**Key Configuration:**
```typescript
// instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}
```

**Sentry Settings:**
- Production: 10% trace sampling, 10% profiling
- Development: 100% sampling, debug mode enabled
- Filters: Removes auth headers, cookies, API keys, OAuth codes
- Ignores: Rate limit errors, health check endpoints

---

## 6. CURRENT ACTIVE TASK

### Status: Building Public Form Route + Dynamic Sidebar Integration

**Completed:**
- [x] Form Builder UI (drag-and-drop)
- [x] Field subcollection architecture in Firestore
- [x] 23 field types implemented
- [x] Public Form View (`/f/[formId]/page.tsx`)
- [x] Form submission API (`/api/public/forms/[formId]`)
- [x] Share/Embed functionality
- [x] Multi-page form support with progress bar
- [x] Validation (required, min/max length, email format)
- [x] UTM parameter tracking on submissions
- [x] Confirmation number generation

**In Progress:**
- [ ] Feature manifest registry for dynamic sidebar
- [ ] Form analytics dashboard
- [ ] Conditional field logic (show/hide based on values)
- [ ] CRM field mapping (auto-sync to CRM)

**Public Form Route Details:**
- **Path:** `/f/[formId]`
- **File:** `src/app/(public)/f/[formId]/page.tsx` (~970 lines)
- **Features:**
  - Dark theme UI
  - Multi-page navigation
  - Progress bar
  - Star ratings & 1-10 scale
  - Checkbox groups
  - Success confirmation with optional redirect
  - Branded footer

---

## 7. GITHUB STATUS

### Branch: `dev`

**All changes pushed to remote.** Latest commits:

| Hash | Message |
|------|---------|
| `9480bb3f` | feat: Connect headless backend services to UI |
| `dae0fadb` | fix: Clean up workspace layout and increase lint warning limit |
| `8e960209` | fix: Restore sidebar visibility in Admin and Workspace layouts |
| `fe005e21` | feat: Public Form View + Share/Embed functionality |
| `37215c4f` | fix: Resolve build type errors and Sentry deprecation |
| `d8d82577` | feat: Form Builder System + Multi-Agent Workforce Engine |
| `d25e817f` | feat: Industry-First Onboarding + Centralized Pricing Engine |
| `08413fdb` | feat: AI Video Generation Engine (Director, Multi-Model Picker, Stitcher) |
| `eb025879` | feat: Identity Refinement UI + 5 Test Personas for Workforce Flow |
| `4d3419b6` | feat: Multi-Provider Voice Marketplace (Native, Unreal, ElevenLabs) |

**Modified (uncommitted):**
- `src/app/workspace/[orgId]/settings/page.tsx`
- `src/lib/test-data/mock-organizations.ts`
- `src/lib/voice/tts/providers/native-provider.ts`
- `src/lib/voice/tts/types.ts`

---

## 8. QUICK REFERENCE

### Key File Locations

| Feature | Primary File |
|---------|--------------|
| Workforce Templates | `src/lib/templates/workforce-templates.ts` |
| Form Builder | `src/components/forms/FormBuilder.tsx` |
| Public Form | `src/app/(public)/f/[formId]/page.tsx` |
| Video Director | `src/lib/video/engine/director-service.ts` |
| Video Stitcher | `src/lib/video/engine/stitcher-service.ts` |
| Workspace Layout | `src/app/workspace/[orgId]/layout.tsx` |
| Admin Layout | `src/app/admin/layout.tsx` |
| Sentry Server | `sentry.server.config.ts` |
| Instrumentation | `instrumentation.ts` |
| TTS Providers | `src/lib/voice/tts/providers/` |

### Commands
```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # Lint (18K warning threshold)
npm run test         # Unit tests
npm run test:playwright  # E2E tests
npm run deploy:check     # Pre-deploy validation
```

### Environment Variables Required
- `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`
- `FIREBASE_*` (project config)
- `GOOGLE_GENERATIVE_AI_KEY`
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`
- `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN`
- `SENDGRID_API_KEY`
- `REDIS_URL` (optional)

---

## 9. KNOWN GAPS (From Audit)

| Feature | Status | Notes |
|---------|--------|-------|
| Social Media AI | NOT IMPLEMENTED | Marketing copy only, no posting APIs |
| Custom TTS | PARTIAL | Twilio Polly only, no ElevenLabs/Google TTS |
| Social Posting | NOT IMPLEMENTED | No Instagram/Twitter/Facebook/LinkedIn posting |

---

*Transfer Manifest generated by Claude Code - January 13, 2026*
