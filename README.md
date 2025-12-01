# AI Sales Platform

Complete AI-powered sales platform with CRM, outbound automation, e-commerce, and white-label capabilities.

## Features

### ✅ Core Platform
- **AI Chat Agent** - GPT-4 powered conversational AI with RAG
- **CRM** - Leads, contacts, companies, deals, tasks
- **E-Commerce** - Products, cart, checkout, widgets
- **White-Label** - Custom branding, multi-tenant
- **Analytics** - Revenue, pipeline, forecasting

### ✅ Outbound Sales (NEW!)
- **AI Email Writer** - Generate personalized cold emails
- **Sequence Engine** - Multi-step email campaigns
- **Reply Handler** - AI-powered email responses
- **Meeting Scheduler** - Autonomous calendar booking
- **Subscription System** - Tiered plans with feature gating

### ✅ Integrations
- **Email** - SendGrid (real implementation)
- **Calendar** - Google Calendar (real implementation)
- **Gmail** - Email sync and sending (real implementation)
- **Accounting** - QuickBooks, Xero (real implementation)
- **Communication** - Slack, Microsoft Teams (real implementation)
- **Payments** - Stripe, PayPal (real implementation)

### ✅ E-Commerce Widgets
- ProductCard, ProductGrid, BuyButton
- ShoppingCart, FullStorefront, CheckoutFlow
- Embeddable on any website

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Environment
See `SIMPLE_SETUP.md` for detailed setup instructions.

Required API keys (add via Settings → API Keys in the app):
- OpenAI (for AI features)
- SendGrid (for email sending)
- Google OAuth (for calendar/Gmail)
- Stripe (for payments)

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

- `SIMPLE_SETUP.md` - Step-by-step setup guide
- `SETUP_GUIDE.md` - Detailed technical setup
- `WHATS_ACTUALLY_WORKING.md` - Honest status of all features
- `OUTBOUND_FEATURES_COMPLETE.md` - Outbound features documentation

## Tech Stack

- **Framework** - Next.js 14 (App Router)
- **Language** - TypeScript
- **Database** - Firebase Firestore
- **Auth** - Firebase Auth
- **AI** - OpenAI GPT-4, Anthropic Claude, Google Gemini
- **Email** - SendGrid
- **Payments** - Stripe
- **Deployment** - Vercel

## Project Structure

```
src/
├── app/                    # Next.js app router pages
│   ├── api/               # API routes
│   ├── workspace/         # Main application
│   └── auth/              # Authentication pages
├── components/            # React components
├── lib/                   # Core libraries
│   ├── ai/               # AI services
│   ├── email/            # Email services
│   ├── integrations/     # Third-party integrations
│   ├── outbound/         # Outbound sales features
│   ├── subscription/     # Subscription management
│   └── widgets/          # E-commerce widgets
└── types/                # TypeScript types
```

## API Routes

### Outbound
- `POST /api/outbound/email/generate` - Generate AI email
- `POST /api/outbound/sequences` - Create email sequence
- `POST /api/outbound/sequences/enroll` - Enroll prospects
- `POST /api/outbound/reply/process` - Process email reply
- `POST /api/outbound/meetings/schedule` - Schedule meeting

### Subscription
- `GET /api/subscription` - Get subscription
- `POST /api/subscription` - Update subscription
- `POST /api/subscription/toggle` - Toggle feature
- `GET /api/subscription/usage` - Get usage stats

### E-Commerce
- `GET /api/ecommerce/products` - List products
- `POST /api/ecommerce/cart/add` - Add to cart
- `POST /api/ecommerce/checkout/create-session` - Create Stripe session

### Integrations
- `GET /api/integrations/google/auth` - Start Google OAuth
- `GET /api/integrations/google/callback` - Google OAuth callback
- `GET /api/integrations/microsoft/auth` - Start Microsoft OAuth
- `GET /api/integrations/slack/auth` - Start Slack OAuth

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

## Support

For issues or questions:
1. Check `WHATS_ACTUALLY_WORKING.md` for feature status
2. Review `SIMPLE_SETUP.md` for setup help
3. Check browser console for frontend errors
4. Check server logs for backend errors

## License

Proprietary - All rights reserved

## Status

**Current Completion**: ~90%
- Core platform: 100%
- Outbound features: 100%
- E-commerce: 95%
- Integrations: 60% (core ones working)
- Analytics: 80%

**What's Real**:
- All core features work
- Email/Calendar/Gmail integrations are real (need API keys)
- Stripe payments work
- AI features work
- Widgets work

**What Needs Setup**:
- API keys for external services (via Settings page)
- OAuth credentials for integrations
- Legal documents (Privacy Policy, ToS)

See `WHATS_ACTUALLY_WORKING.md` for detailed status.
