# AI Sales Platform

AI-powered sales platform with intelligent agent system, customer memory persistence, and real-time conversation management.

## Core Innovation: Golden Master + Customer Memory

Unlike traditional chatbots that forget between sessions, this platform uses a sophisticated architecture:

- **Golden Master**: Versioned AI agent configuration trained for your business
- **Customer Memory**: Persistent conversation history and learned preferences across all sessions
- **Instance Spawning**: Ephemeral agent instances that load customer context on-demand
- **Omnichannel Continuity**: Customers recognized across web chat, email, and future platforms

## Key Features

### ✅ AI Agent System
- **Training Center** - Interactive agent training with scenario-based learning
- **Golden Master Versioning** - Save and deploy trained agent configurations
- **Real-Time Chat** - Live customer conversations with sentiment analysis
- **Customer Memory** - Persistent relationship tracking across sessions
- **RAG (Retrieval Augmented Generation)** - Context-aware responses from knowledge base

### ✅ Conversation Management
- **Live Monitoring** - Real-time view of active customer conversations
- **Human Takeover** - Seamless agent-to-human handoff
- **Session Analytics** - Conversation metrics and performance tracking
- **Training Feedback** - Flag conversations for agent improvement

### ✅ Business Operations
- **CRM Dashboard** - Leads, deals, pipeline tracking
- **Meeting Scheduler** - Automated calendar booking
- **Email Integration** - SendGrid for transactional emails
- **Payment Processing** - Stripe integration
- **Multi-tenant** - Organization and workspace isolation

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

- **[HOW_TO_RUN.md](./HOW_TO_RUN.md)** - Quick start guide
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture and design
- **[API_KEY_ARCHITECTURE.md](./API_KEY_ARCHITECTURE.md)** - API key management
- **[INSTALL_FIRST.md](./INSTALL_FIRST.md)** - First-time installation
- **[docs/](./docs/)** - Additional technical documentation

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
