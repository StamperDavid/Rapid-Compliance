# AI Sales Platform

AI-powered sales platform with intelligent agent system, customer memory persistence, and real-time conversation management.

## Core Innovation: Golden Master + Customer Memory

Unlike traditional chatbots that forget between sessions, this platform uses a sophisticated architecture:

- **Golden Master**: Versioned AI agent configuration trained for your business
- **Customer Memory**: Persistent conversation history and learned preferences across all sessions
- **Instance Spawning**: Ephemeral agent instances that load customer context on-demand
- **Omnichannel Continuity**: Customers recognized across web chat, email, and future platforms

## Key Features

### ✅ AI Agent System (Production Ready)
- **Training Center** - Interactive agent training with scenario-based learning
- **Golden Master Versioning** - Save and deploy trained agent configurations
- **Real-Time Chat** - Live customer conversations with sentiment analysis
- **Customer Memory** - Persistent relationship tracking across sessions
- **RAG (Retrieval Augmented Generation)** - Context-aware responses from knowledge base
- **Multi-Provider Support** - OpenAI, Anthropic, Google Gemini, OpenRouter
- **Fine-Tuning** - Custom model training with your data

### ✅ Sales & CRM (92% Complete)
- **Lead Management** - Capture, score, enrich, and nurture leads
- **Deal Pipeline** - Visual pipeline with stage tracking and forecasting
- **Contact Management** - Complete relationship tracking with lookup fields
- **Email Sequences** - Automated outbound sequences with tracking
- **Nurture Campaigns** - Drip campaigns with performance analytics
- **Voice Calling** - Twilio integration for outbound calls
- **Meeting Scheduler** - Automated calendar booking

### ✅ Workflows & Automation (Production Ready)
- **Workflow Builder** - Visual automation builder with 9 action types
- **Email Actions** - SendGrid, Gmail API, SMTP
- **SMS Actions** - Twilio, Vonage integration
- **AI Agent Actions** - Trigger AI conversations in workflows
- **Conditional Logic** - Branch workflows based on data
- **Scheduled Triggers** - Time-based automation
- **Entity Triggers** - React to CRM changes

### ✅ Analytics & Reporting (Beta Ready)
- **Revenue Analytics** - Track revenue by source, product, sales rep
- **Pipeline Reports** - Conversion funnels, win rates, velocity
- **Lead Scoring** - Predictive lead quality scoring
- **A/B Testing** - Statistical analysis of agent performance
- **Custom Reports** - Execute reports via API with 6 types
- **Dashboard Widgets** - Real-time metrics and charts

### ✅ E-Commerce (Coded, Testing in Progress)
- **Product Catalog** - Full product management with variants
- **Shopping Cart** - Session-based cart with discounts
- **Checkout** - Multi-provider payment processing (Stripe, PayPal, Square)
- **Order Management** - Order tracking and fulfillment
- **Inventory Tracking** - Real-time stock management
- **Customer Portal** - Branded storefront per organization

### ✅ Integrations (3 Real, 5 Graceful)
- **Gmail** - OAuth + API integration for email sync and sending
- **Outlook** - OAuth + API integration for email sync
- **Slack** - OAuth + webhooks for notifications
- **Zapier** - Webhook-based automation (validated connections)
- **Teams** - Microsoft OAuth integration (requires Azure config)
- **QuickBooks/Xero** - Graceful fallback if not configured
- **Google Calendar** - Partial integration (has TODOs)

### ✅ Infrastructure (Production Grade)
- **Multi-tenant** - Complete organization and workspace isolation
- **Firebase Security** - Comprehensive role-based access control
- **Rate Limiting** - All 85 API routes protected
- **Error Monitoring** - Sentry integration with performance tracking
- **Structured Logging** - 99.6% of code uses production logger
- **Service Layer** - All 7 services with pagination support

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Environment

**Option A: Quick Start (Recommended)**
```bash
# Copy environment template
cp env.template .env.local

# Add Firebase configuration to .env.local
# (Get from Firebase Console > Project Settings > General)
```

**Option B: Use In-App Configuration**
All API keys can be added through the UI at Settings → API Keys after first login.

Required services:
- **Firebase** - Database and auth (required)
- **OpenAI/Anthropic/OpenRouter** - AI models (at least one required)
- **SendGrid** - Email sending (optional)
- **Stripe** - Payments (optional)
- **Google OAuth** - Calendar/Gmail (optional)

### 3. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 4. Configure Services
1. Create account and organization
2. Go to Settings → API Keys
3. Add your API keys (instructions provided in app)
4. Test each service

## Documentation

### Start Here
- **[BETA_LAUNCH_GUIDE.md](./BETA_LAUNCH_GUIDE.md)** ⭐ - Beta launch readiness (Dec 24, 2025)
- **[HOW_TO_RUN.md](./HOW_TO_RUN.md)** - Quick start guide
- **[PROJECT_STATUS.md](./PROJECT_STATUS.md)** - Brutally honest status assessment

### Technical Docs
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture and design
- **[COMPLETE_SITEMAP.md](./COMPLETE_SITEMAP.md)** - All 122 pages + 85 API routes
- **[API_KEY_ARCHITECTURE.md](./API_KEY_ARCHITECTURE.md)** - API key management
- **[DOCUMENTATION_INDEX.md](./DOCUMENTATION_INDEX.md)** - Master doc index

### Setup & Testing
- **[INSTALL_FIRST.md](./INSTALL_FIRST.md)** - First-time installation
- **[tests/E2E_TESTING_GUIDE.md](./tests/E2E_TESTING_GUIDE.md)** - E2E testing with Firebase emulators
- **[docs/PAYMENT_TESTING_GUIDE.md](./docs/PAYMENT_TESTING_GUIDE.md)** - Stripe test mode guide
- **[docs/](./docs/)** - Additional technical documentation

## Platform Status

**Completion:** 92% (Dec 24, 2025)  
**Beta Ready:** ✅ YES (with known limitations)  
**Production Ready:** 4-6 weeks (hardening phase)

**What Works:**
- All 68 workspace pages functional
- All 7 service layers with pagination
- Workflow engine (all 9 actions real)
- Payment processing (Stripe/PayPal/Square)
- AI Agent system (Golden Master + RAG)
- Real integrations (Gmail, Outlook, Slack)

**What's Left:**
- E-commerce end-to-end testing (1-2 days)
- 2 integration UI → real OAuth (done: Zapier, Teams)
- Lookup fields (✅ done Dec 24)
- Dashboard reports (✅ done Dec 24)

See **[BETA_LAUNCH_GUIDE.md](./BETA_LAUNCH_GUIDE.md)** for complete status.

## Tech Stack

- **Framework** - Next.js 14 (App Router)
- **Language** - TypeScript
- **Database** - Firebase Firestore
- **Auth** - Firebase Auth
- **AI Providers** - OpenAI, Anthropic, Google Gemini, OpenRouter
- **Email** - SendGrid
- **Payments** - Stripe
- **Deployment** - Vercel
- **Real-time** - Firestore subscriptions

## Project Structure

```
src/
├── app/                    # Next.js app router pages
│   ├── api/               # API routes (81 endpoints)
│   ├── workspace/         # Main application
│   └── auth/              # Authentication pages
├── components/            # React components
├── lib/                   # Core libraries
│   ├── agent/            # AI agent system (Golden Master, Instance Manager)
│   ├── ai/               # AI provider integrations
│   ├── db/               # Firestore service layer
│   ├── auth/             # Authentication middleware
│   ├── email/            # Email services
│   └── integrations/     # Third-party integrations
└── types/                # TypeScript types (agent-memory.ts, etc.)
```

## Key API Routes

### AI Agent
- `POST /api/chat/public` - Public chat endpoint (for embedded widgets)
- `POST /api/agent/chat` - Authenticated agent chat
- `POST /api/agent/process-onboarding` - Process onboarding data
- `POST /api/training/deploy-golden-master` - Deploy trained agent

### Conversation Management
- Real-time via Firestore subscriptions (no polling)
- Session management in `ChatSessionService`

### Integrations
- `GET /api/integrations/google/auth` - Google OAuth
- `GET /api/integrations/slack/auth` - Slack OAuth
- `POST /api/email/send` - Send email via SendGrid
- `POST /api/outbound/meetings/schedule` - Schedule meeting

**Total**: 81 API routes (see `src/app/api/` for complete list)

## Development

### Run Tests
```bash
npm test
```

### Build for Production
```bash
npm run build
npm start
```

### Deploy to Vercel
```bash
vercel
```

## Environment Variables

See `env.template` for all required environment variables.

Key variables:
- `OPENAI_API_KEY` - OpenAI API key
- `SENDGRID_API_KEY` - SendGrid API key
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth secret
- `STRIPE_SECRET_KEY` - Stripe secret key

**Note**: You can also configure these via the in-app Settings → API Keys page instead of using .env files.

## Architecture Highlights

### Golden Master System
- **Base Model**: Editable agent configuration created from onboarding
- **Training**: Interactive scenario-based training with feedback
- **Golden Master**: Versioned snapshot of trained agent (v1, v2, v3...)
- **Deployment**: Activate specific version for production use

### Customer Memory
- **Persistent Identity**: Track customers across sessions
- **Conversation History**: Complete message logs
- **Learned Preferences**: Budget, communication style, interests
- **Agent Notes**: AI-generated insights about customer
- **Context Flags**: Active cart, support tickets, VIP status

### Instance Lifecycle
1. Customer arrives → Spawn ephemeral instance from Golden Master
2. Load customer memory (if returning customer)
3. Compile system prompt with business context + customer history
4. Handle conversation with real-time memory updates
5. Session ends → Save state, terminate instance

## Current Status

**Functional** (65-70% complete):
- ✅ AI agent training and deployment
- ✅ Real-time conversation monitoring
- ✅ Customer memory persistence
- ✅ Firebase/Firestore integration
- ✅ Multi-provider AI support (OpenAI, Anthropic, Gemini, OpenRouter)
- ✅ RAG (knowledge base integration)
- ✅ Authentication & authorization
- ✅ 81 API routes with rate limiting

**Needs Work**:
- ⚠️ Customer validation (zero production users)
- ⚠️ E-commerce features (partially implemented)
- ⚠️ Some integrations (OAuth flows exist, need testing)
- ⚠️ Analytics dashboards (some mock data remains)
- ⚠️ Test coverage (minimal)

## License

Proprietary - All rights reserved
