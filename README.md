# AI CRM Platform - White-Label Multi-Tenant CRM with E-Commerce

A fully customizable, industry-agnostic CRM platform with AI agents, workflow automation, and embeddable e-commerce storefronts.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ ([Download](https://nodejs.org/))
- npm or yarn
- Firebase account ([Sign up](https://firebase.google.com/))
- Google Cloud Platform account ([Sign up](https://cloud.google.com/))

### Installation

#### EASIEST: Double-Click to Start (Windows)
1. Navigate to project folder: `C:\Users\David\PycharmProjects\AI Sales Platform`
2. Double-click `START.bat`
3. Done! Server starts on http://localhost:3000

#### Option 1: Simple PowerShell Command
```powershell
# Navigate to project
cd "C:\Users\David\PycharmProjects\AI Sales Platform"

# Start server
.\START.ps1
```

#### Option 2: Automated Setup (Windows PowerShell)
```powershell
# Run the setup script
.\scripts\setup-dev.ps1

# Start the development server
.\scripts\quick-start.ps1
```

#### Option 3: Manual Setup
```bash
# Clone the repository
git clone <your-repo-url>
cd ai-crm-platform

# Install dependencies
npm install

# Copy environment template
copy .env.example .env.local

# Start development server
npm run dev
```

### Configuration

1. **Update `.env.local`** with your credentials:
   - Firebase API keys
   - Google Cloud project ID
   - Gemini API key
   - Stripe keys (for e-commerce)

2. **Initialize Firebase**:
```bash
npm run firebase:init
```

3. **Start Firebase Emulators** (optional, for local testing):
```bash
npm run firebase:emulators
```

## 🎨 Key Features

### ✅ Multi-Tenant Architecture
- Organizations (top-level tenants)
- Workspaces (sub-tenants)
- Complete data isolation
- RBAC permissions

### ✅ Dynamic Custom Objects
- Create/delete custom objects (like Pipedrive)
- 20+ field types (text, number, date, select, lookups, rollups, formulas, AI-generated)
- Relationships (one-to-many, many-to-many)
- Formula engine for computed fields

### ✅ Advanced Theme System 🎨 **NEW!**
- **Gradient Support**: Linear, radial, and conic gradients
- **Advanced Curves**: Customizable border radius on all components
- **White-Labeling**: 
  - Custom logo (horizontal, vertical, icon variants)
  - Favicon and app icons
  - Login page customization
  - Email branding
  - Custom domain support
  - Remove "Powered by" branding
- **Glass Morphism**: Blur effects and transparency
- **Colored Shadows**: Glow effects with theme colors
- **Animation Control**: Custom durations and easing
- **Component Styling**: Per-component style overrides

### ✅ Multiple View Types
- Table (spreadsheet)
- Kanban (Trello-style)
- Calendar
- Gallery
- List
- Form
- Dashboard (with widgets)
- Timeline

### ✅ AI Agents
- Trainable AI assistants
- Multiple agent types (Sales, Support, Service, Custom)
- Golden Master deployment
- Knowledge base integration
- Google Search grounding

### ✅ Workflow Automation
- 9 trigger types
- 15+ action types
- Conditional logic
- Error handling
- Cloud Functions integration

### ✅ E-Commerce Platform
- One-click e-commerce activation
- Product mapping from CRM
- Payment processing (Stripe, Square, PayPal)
- Shipping & tax calculation
- Order management

### ✅ Embeddable Widgets
- WordPress shortcodes: `[crm-store id="abc123"]`
- JavaScript embed
- React SDK
- iframe support
- 7 widget types

## 📁 Project Structure

```
ai-crm-platform/
├── src/
│   ├── app/              # Next.js App Router
│   ├── components/       # React components
│   ├── lib/             # Core libraries
│   ├── types/           # TypeScript definitions
│   ├── hooks/           # React hooks
│   └── stores/          # Zustand state stores
├── public/
│   └── embed.js         # Embeddable widget SDK
├── scripts/
│   ├── setup-dev.ps1    # Setup script
│   ├── start-dev.ps1    # Start all services
│   └── quick-start.ps1  # Quick start
├── docs/                # Documentation
├── infrastructure/      # Terraform configs
└── functions/           # Cloud Functions
```

## 🎨 Theme Customization Examples

### Gradient Background
```typescript
const theme = {
  colors: {
    background: {
      gradient: {
        type: 'linear',
        angle: 135,
        stops: [
          { color: '#667eea', position: 0 },
          { color: '#764ba2', position: 100 }
        ]
      }
    }
  }
};
```

### Custom Border Curves
```typescript
const theme = {
  layout: {
    borderRadius: {
      card: '24px',      // Rounded cards
      button: '12px',    // Smooth buttons
      input: '8px',      // Subtle inputs
      modal: '32px'      // Very rounded modals
    }
  }
};
```

### Colored Glow Effects
```typescript
const theme = {
  layout: {
    boxShadow: {
      glow: '0 0 20px rgba(102, 126, 234, 0.5)',
      glowHover: '0 0 40px rgba(102, 126, 234, 0.8)'
    }
  }
};
```

### White-Label Branding
```typescript
const branding = {
  logo: {
    url: 'https://yourbrand.com/logo.svg',
    variants: {
      horizontal: 'https://yourbrand.com/logo-h.svg',
      icon: 'https://yourbrand.com/icon.svg'
    }
  },
  customDomain: 'app.yourbrand.com',
  loginPage: {
    backgroundImage: 'https://yourbrand.com/bg.jpg',
    cardStyle: 'blur'
  },
  footer: {
    showPoweredBy: false  // Hide platform branding
  }
};
```

## 🛠 Available Scripts

```bash
# Development
npm run dev              # Start dev server
npm run build            # Production build
npm run start            # Start production server

# Code Quality
npm run lint             # Run ESLint
npm run type-check       # TypeScript check
npm run format           # Format with Prettier

# Testing
npm test                 # Run tests
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report

# Firebase
npm run firebase:init        # Initialize Firebase
npm run firebase:emulators   # Start emulators
npm run firebase:deploy      # Deploy to Firebase
```

## 🚢 PowerShell Scripts (Windows)

### Setup Development Environment
```powershell
.\scripts\setup-dev.ps1
```
Installs all dependencies, creates directory structure, and configures environment.

### Quick Start
```powershell
# EASIEST - Just double-click this file in Windows Explorer:
START.bat

# OR run from PowerShell:
.\START.ps1

# OR use the full script:
.\scripts\quick-start.ps1
```
Fastest way to start the dev server.

### Start All Services
```powershell
# Start Next.js only
.\scripts\start-dev.ps1

# Start with Firebase Emulators
.\scripts\start-dev.ps1 -WithFirebase

# Start with Redis
.\scripts\start-dev.ps1 -WithRedis

# Start everything
.\scripts\start-dev.ps1 -All
```

## 📚 Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Complete system architecture
- [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) - File organization
- [ECOMMERCE_EMBEDDABLE.md](./docs/ECOMMERCE_EMBEDDABLE.md) - E-commerce widget docs
- [SUMMARY.md](./SUMMARY.md) - Implementation overview

## 🌐 Technology Stack

- **Framework**: Next.js 14 (App Router, Server Components)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + CSS-in-JS (dynamic theming)
- **State**: Zustand + React Query
- **Database**: Firestore + Cloud SQL
- **Hosting**: Google Cloud Run
- **AI**: Vertex AI + Gemini
- **Payments**: Stripe, Square, PayPal

## 💰 Monetization

### Pricing Tiers
- **Free**: 1 workspace, 1K records, basic features
- **Pro** ($49/user/mo): Unlimited workspaces, 50K records, AI agents, e-commerce up to $10K GMV
- **Enterprise** (Custom): Unlimited, white-label, custom domain, wholesale e-commerce rates

## 🎯 Use Cases

1. **Transportation Compliance**: Manage clients, drivers, vehicles, documents
2. **Service Business**: Appointments, customers, invoices, bookings
3. **E-Commerce**: Products, orders, inventory, customers
4. **Real Estate**: Properties, leads, showings, contracts
5. **ANY Industry**: Fully customizable for any business model

## 🔐 Security

- Firebase Authentication
- Row-level security (Firestore rules)
- PCI DSS compliant (via Stripe)
- GDPR ready (data export/deletion)
- Audit logging

## 🤝 Contributing

This is a private project. For questions or support, contact the development team.

## 📄 License

Proprietary - All rights reserved

---

## 🚀 Getting Started Checklist

- [ ] Install Node.js 18+
- [ ] Run `.\scripts\setup-dev.ps1`
- [ ] Update `.env.local` with API keys
- [ ] Run `.\scripts\quick-start.ps1`
- [ ] Open http://localhost:3000
- [ ] Create your first workspace
- [ ] Build custom objects
- [ ] Customize theme
- [ ] Enable e-commerce
- [ ] Generate embeddable widget

**Ready to build!** 🎉


