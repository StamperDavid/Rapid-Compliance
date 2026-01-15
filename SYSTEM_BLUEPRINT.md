# SYSTEM BLUEPRINT
## AI Sales Platform - Definitive Architecture Guide
**Version:** 2.0.0
**Last Updated:** 2026-01-14
**Status:** Source of Truth - SYNCHRONIZED

---

> **IMPORTANT - CROSS-REFERENCE DOCUMENTS:**
>
> This document describes the INTENDED architecture. For the ACTUAL implementation status, always consult:
>
> | Document | Purpose |
> |----------|---------|
> | `SYSTEM_TRUTH_MANIFEST.md` | Forensic audit of what's actually implemented vs stub |
> | `ARCHITECTURE_GRAPH.md` | Visual dependency map: Jasper → Managers → Agents |
> | `src/lib/orchestrator/system-blueprint.md` | Jasper's runtime knowledge base with SOPs |
>
> **Key Reality Check:**
> - API Routes: 224 total (180 functional, 30 partial, 14 stub)
> - Jasper Tools: 23 total (13 functional, 10 incomplete)
> - 11 Specialists: All DEFINED but NONE fully wired to execution
> - Lead Generation Tools: Return mock/random data

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Proprietary Voice Architecture](#2-proprietary-voice-architecture)
3. [Identity & DNA Propagation](#3-identity--dna-propagation)
4. [Workforce Lifecycle](#4-workforce-lifecycle)
5. [Synthetic Data Integrity](#5-synthetic-data-integrity)
6. [Infrastructure & Stack](#6-infrastructure--stack)
7. [Refactoring & Cleanup Status](#7-refactoring--cleanup-status)
8. [Proprietary Advantages](#8-proprietary-advantages)
9. [Roadmap](#9-roadmap)

---

## 1. Executive Summary

The AI Sales Platform is a Next.js 14 application providing AI-powered sales automation with:
- **Proprietary Voice Engine** - Multi-provider TTS marketplace with "Native" branding
- **Brand DNA Inheritance** - 3-tier system transforming generic agents into industry specialists
- **Workforce Lifecycle** - 4-step wizard converting onboarding data to deployed AI agents
- **5 Test Personas** - Demo-ready organizations across diverse industries

### Key Metrics
- **Total Components:** 200+ React components
- **API Routes:** 50+ Next.js API endpoints
- **Industry Templates:** 50+ specialized configurations
- **Voice Providers:** 3 TTS engines + 2 VoIP providers
- **TypeScript Errors:** 0 (clean build)

---

## 2. Proprietary Voice Architecture

### 2.1 System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                     VOICE SYSTEM ARCHITECTURE                        │
└─────────────────────────────────────────────────────────────────────┘

                    ┌─────────────────────────────┐
                    │   VOICE ENGINE MARKETPLACE   │
                    │   (TTS Synthesis Layer)      │
                    └──────────────┬──────────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          │                        │                        │
    ┌─────▼─────┐          ┌──────▼──────┐         ┌───────▼───────┐
    │  NATIVE   │          │   UNREAL    │         │  ELEVENLABS   │
    │  ENGINE   │          │   SPEECH    │         │               │
    ├───────────┤          ├─────────────┤         ├───────────────┤
    │ PROPRIETARY│         │ Third-Party │         │ Third-Party   │
    │ $0.005/1k │          │ $0.001/1k   │         │ $0.030/1k     │
    │ 5 Voices  │          │ 5 Voices    │         │ 8+ Voices     │
    │ LOW LATENCY│         │ ULTRA-FAST  │         │ BEST QUALITY  │
    └───────────┘          └─────────────┘         └───────────────┘
                                   │
                                   ▼
                    ┌─────────────────────────────┐
                    │   VoIP INFRASTRUCTURE       │
                    │   (Call Connectivity)       │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
              ┌─────▼─────┐               ┌───────▼───────┐
              │  TWILIO   │               │    TELNYX     │
              │  $1.30/min│               │   $0.40/min   │
              │  DEFAULT  │               │  COST-SAVING  │
              └───────────┘               └───────────────┘
```

### 2.2 Voice Engine Factory Pattern

**File:** `src/lib/voice/tts/voice-engine-factory.ts`

The factory implements a provider-agnostic interface for TTS synthesis:

```typescript
// Core Factory Interface
class VoiceEngineFactory {
  static getProvider(engine: TTSEngineType): TTSProvider
  static synthesize(text: string, config: TTSConfig): Promise<TTSResult>
  static getVoices(engine: TTSEngineType): TTSVoice[]
  static getCostComparison(textLength: number): CostComparison[]
}

// Usage Pattern
const audio = await VoiceEngineFactory.synthesize(text, {
  engine: 'native',
  voiceId: 'native-aria',
  format: 'mp3',
  speed: 1.0
});
```

### 2.3 Native Engine Architecture

**File:** `src/lib/voice/tts/providers/native-provider.ts`

The Native engine is architected as our **proprietary, vertically-integrated** voice solution:

```
┌──────────────────────────────────────────────────────────────┐
│                    NATIVE ENGINE DESIGN                       │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  Platform API Key (Hidden from Users)                        │
│       │                                                       │
│       ▼                                                       │
│  ┌────────────────────────────────────────┐                  │
│  │  Native Voice API (Proprietary)        │                  │
│  │  - Hosted internally                   │                  │
│  │  - No user-provided keys               │                  │
│  │  - Platform-managed infrastructure     │                  │
│  └────────────────────────────────────────┘                  │
│       │                                                       │
│       ▼                                                       │
│  ┌────────────────────────────────────────┐                  │
│  │  Voice Personas (5 Characters)         │                  │
│  │  - Aria: Warm, professional female     │                  │
│  │  - Marcus: Confident male              │                  │
│  │  - Sophia: Friendly, energetic female  │                  │
│  │  - James: Authoritative male           │                  │
│  │  - Luna: Soft, calming female          │                  │
│  └────────────────────────────────────────┘                  │
│       │                                                       │
│       ▼                                                       │
│  ┌────────────────────────────────────────┐                  │
│  │  Output Formats                         │                  │
│  │  - MP3 (default, web-optimized)        │                  │
│  │  - WAV (lossless)                      │                  │
│  │  - PCM (raw audio)                     │                  │
│  │  - OGG (compressed)                    │                  │
│  └────────────────────────────────────────┘                  │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

**Key Design Decisions:**
1. `supportsUserKeys: false` - Users cannot bring their own keys (platform-managed)
2. Environment variable `NATIVE_VOICE_URL` points to proprietary infrastructure
3. Voice personas are curated, not dynamically fetched from external APIs

### 2.4 Twilio Integration Points

**Hand-off Architecture:**

```
┌─────────────────────────────────────────────────────────────────┐
│                   TWILIO HAND-OFF POINTS                         │
└─────────────────────────────────────────────────────────────────┘

1. CALL INITIATION
   VoiceProviderFactory.getProvider(orgId)
        │
        └──► TwilioProvider.initiateCall()
                  │
                  └──► Twilio REST API: POST /Calls
                            {
                              from: orgPhoneNumber,
                              to: customerPhone,
                              url: "/api/voice/ai-agent/{agentId}",
                              statusCallback: "/api/webhooks/voice"
                            }

2. TWIML GENERATION
   VoiceAgentHandler.generateConversationTwiML()
        │
        ├──► <Say voice="Polly.Joanna">   (Twilio Native TTS)
        │
        └──► <Play>{audioUrl}</Play>      (Custom TTS Engine)
                  │
                  └──► VoiceEngineFactory.synthesize()
                            │
                            └──► Native | Unreal | ElevenLabs

3. SPEECH RECOGNITION
   Twilio <Gather input="speech">
        │
        └──► Webhook: /api/voice/ai-agent/speech
                  │
                  └──► AIConversationService.processInput()
                            │
                            └──► Gemini API → Response Generation

4. CALL TRANSFER
   CallTransferService.aiToHumanHandoff()
        │
        └──► TwiML: <Dial>{humanAgentNumber}</Dial>
```

**Key Files:**
- `src/lib/voice/providers/twilio-provider.ts` - Twilio SDK wrapper
- `src/lib/voice/voice-agent-handler.ts` - Conversation orchestration
- `src/app/api/voice/ai-agent/speech/route.ts` - Speech webhook

### 2.5 Provider Configuration Matrix

| Provider | Type | API Key Model | Cost/1k chars | Latency | Quality |
|----------|------|---------------|---------------|---------|---------|
| **Native** | TTS | Platform-only | $0.005 | Low | Premium |
| **Unreal Speech** | TTS | Platform/User | $0.001 | Ultra-low | Standard |
| **ElevenLabs** | TTS | Platform/User | $0.030 | Medium | Best |
| **Twilio** | VoIP | Platform-only | $1.30/min | - | Industry Standard |
| **Telnyx** | VoIP | Platform-only | $0.40/min | - | Industry Standard |

---

## 3. Identity & DNA Propagation

### 3.1 Three-Tier Inheritance Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 1: WORKFORCE IDENTITY (Global Personality)                │
│ Path: organizations/{orgId}/settings/workforceIdentity          │
│ Scope: Platform-wide AI personality, voice, appearance          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ inherits
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 2: BRAND DNA (Company Voice)                              │
│ Path: organizations/{orgId} → brandDNA field                    │
│ Scope: Tone, key phrases, avoid phrases, communication style    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ inherits with overrides
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 3: TOOL TRAINING (Channel-Specific)                       │
│ Path: organizations/{orgId}/toolTraining/{voice|social|seo}     │
│ Scope: Tool-specific behaviors, scripts, content themes         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ consumed by
┌─────────────────────────────────────────────────────────────────┐
│ RUNTIME: AGENT PERSONA (Active Configuration)                   │
│ Path: organizations/{orgId}/agentPersona/current                │
│ Scope: Live AI agent settings used in conversations             │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Batch Write Process

**File:** `src/app/api/workspace/[orgId]/identity/route.ts`

When a user saves their identity refinement, a **single atomic transaction** updates 4 Firestore documents:

```typescript
// POST /api/workspace/{orgId}/identity
const batch = adminDb.batch();

// Document 1: Workforce Identity
batch.set(doc('organizations/{orgId}/settings/workforceIdentity'), {
  workforceName,
  tagline,
  personalityArchetype,
  voiceEngine,
  voiceId,
  avatarStyle,
  primaryColor,
  responseStyle,
  proactivityLevel,
  empathyLevel,
  brandDNA: { ...brandDNA },
  updatedAt: serverTimestamp(),
  status: 'active'
});

// Document 2: Organization Brand DNA
batch.update(doc('organizations/{orgId}'), {
  brandDNA: { ...brandDNA, updatedAt, updatedBy }
});

// Document 3: Onboarding Progress
batch.set(doc('organizations/{orgId}/settings/onboardingProgress'), {
  identityRefinementCompleted: true,
  identityCompletedAt: serverTimestamp()
});

// Document 4: Agent Persona (Runtime)
batch.set(doc('organizations/{orgId}/agentPersona/current'), {
  name: workforceName,
  tagline,
  personalityArchetype,
  toneOfVoice: brandDNA.toneOfVoice,
  responseStyle,
  proactivityLevel,
  empathyLevel,
  voiceEngine,
  voiceId,
  voiceName,
  avatarStyle,
  primaryColor
});

await batch.commit(); // Atomic - all or nothing
```

### 3.3 Brand DNA Schema

```typescript
interface BrandDNA {
  // Core Identity
  companyDescription: string;      // "AI-powered analytics platform"
  uniqueValue: string;             // "Natural language data queries"
  targetAudience: string;          // "Mid-market tech companies"

  // Voice & Tone
  toneOfVoice: 'warm' | 'professional' | 'direct' | 'friendly' | 'formal' | 'casual';
  communicationStyle: string;      // "Consultative and empathetic"

  // Language Controls
  keyPhrases: string[];            // MUST use: ["transform data", "actionable insights"]
  avoidPhrases: string[];          // NEVER use: ["cheap", "basic", "simple"]

  // Context
  industry: string;                // "B2B SaaS"
  competitors: string[];           // ["Tableau", "PowerBI", "Looker"]
}
```

### 3.4 Inheritance Resolution

**File:** `src/lib/brand/brand-dna-service.ts`

When a tool (Voice, Social, SEO) needs Brand DNA values:

```typescript
async function getEffectiveBrandValues(
  orgId: string,
  toolType: 'voice' | 'social' | 'seo'
): Promise<BrandDNA> {
  const brandDNA = await getBrandDNA(orgId);
  const toolContext = await getToolTrainingContext(orgId, toolType);

  // Default: Full inheritance
  if (toolContext?.inheritFromBrandDNA !== false) {
    return brandDNA;
  }

  // Override: Merge tool-specific values
  return {
    ...brandDNA,           // Base layer
    ...toolContext.overrides  // Override layer (takes precedence)
  };
}
```

**Override Example:**
```
Brand DNA: toneOfVoice = "professional"
   │
   ├── Voice Tool: inheritFromBrandDNA = true
   │      └── Uses: "professional"
   │
   └── Social Tool: inheritFromBrandDNA = false
          overrides: { toneOfVoice: "friendly" }
          └── Uses: "friendly"
```

---

## 4. Workforce Lifecycle

### 4.1 Complete Journey Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                     WORKFORCE LIFECYCLE                              │
└─────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│ PHASE 1: DISCOVERY GATE (Onboarding Setup)                         │
│ Path: /onboarding/setup                                            │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Step 1: Business Basics                                           │
│  ├── Business name, industry                                       │
│  └── Year established, employee count                              │
│                                                                     │
│  Step 2: Value Proposition                                         │
│  ├── Problem solved, unique value                                  │
│  └── Target customer profile                                       │
│                                                                     │
│  Step 3: Product/Service Definition                                │
│  ├── Service catalog, pricing                                      │
│  └── Sales cycle length                                            │
│                                                                     │
│  Step 4: Customer Context                                          │
│  ├── Ideal customer profile                                        │
│  └── Common objections & responses                                 │
│                                                                     │
│  Step 5: Brand Voice (Initial)                                     │
│  ├── Tone preference                                               │
│  └── Communication style                                           │
│                                                                     │
│  Steps 6-16: Additional Context...                                 │
│  └── Knowledge base, competitors, goals                            │
│                                                                     │
└──────────────────────────┬─────────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────────────┐
│ PHASE 2: IDENTITY REFINEMENT (4-Step Wizard)                       │
│ Path: /workspace/{orgId}/identity/refine                           │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────────────────────────────────────────┐     │
│  │ STEP 1: NAME & PERSONALITY                                │     │
│  │ ├── Workforce Name (e.g., "Aurora", "Sage", "Pixel")     │     │
│  │ ├── Tagline (e.g., "Transforming data into decisions")   │     │
│  │ ├── Personality Archetype                                 │     │
│  │ │   ├── Professional (formal, authoritative)             │     │
│  │ │   ├── Friendly (warm, approachable)                    │     │
│  │ │   ├── Consultative (advisory, empathetic)              │     │
│  │ │   ├── Energetic (enthusiastic, dynamic)                │     │
│  │ │   └── Calm (measured, reassuring)                      │     │
│  │ ├── Avatar Style (abstract/human/icon/custom)            │     │
│  │ └── Primary Brand Color                                   │     │
│  └──────────────────────────────────────────────────────────┘     │
│                           │                                        │
│                           ▼                                        │
│  ┌──────────────────────────────────────────────────────────┐     │
│  │ STEP 2: BRAND VOICE                                       │     │
│  │ ├── Company Description (refined)                         │     │
│  │ ├── Unique Value Proposition (refined)                    │     │
│  │ ├── Target Audience (refined)                             │     │
│  │ ├── Communication Style                                   │     │
│  │ ├── Key Phrases (must use)                                │     │
│  │ ├── Avoid Phrases (never use)                             │     │
│  │ └── Competitors                                            │     │
│  └──────────────────────────────────────────────────────────┘     │
│                           │                                        │
│                           ▼                                        │
│  ┌──────────────────────────────────────────────────────────┐     │
│  │ STEP 3: VOICE ENGINE SELECTION                            │     │
│  │ ├── TTS Provider Selection                                │     │
│  │ │   ├── Native (Proprietary - recommended)               │     │
│  │ │   ├── Unreal Speech (cost-effective)                   │     │
│  │ │   └── ElevenLabs (premium quality)                     │     │
│  │ ├── Voice Persona Selection (per provider)               │     │
│  │ ├── Live Voice Testing                                    │     │
│  │ ├── Response Style (concise/balanced/detailed)           │     │
│  │ ├── Proactivity Level (1-10)                             │     │
│  │ └── Empathy Level (1-10)                                  │     │
│  └──────────────────────────────────────────────────────────┘     │
│                           │                                        │
│                           ▼                                        │
│  ┌──────────────────────────────────────────────────────────┐     │
│  │ STEP 4: REVIEW & LAUNCH                                   │     │
│  │ ├── Full Configuration Summary                            │     │
│  │ ├── Preview Agent Persona                                 │     │
│  │ └── Confirm & Deploy                                      │     │
│  └──────────────────────────────────────────────────────────┘     │
│                                                                     │
└──────────────────────────┬─────────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────────────┐
│ PHASE 3: DEPLOYMENT (Atomic Batch Write)                           │
│ Endpoint: POST /api/workspace/{orgId}/identity                     │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Firestore Transaction (All-or-Nothing):                           │
│  ├── Document 1: organizations/{orgId}/settings/workforceIdentity  │
│  ├── Document 2: organizations/{orgId} → brandDNA field            │
│  ├── Document 3: organizations/{orgId}/settings/onboardingProgress │
│  └── Document 4: organizations/{orgId}/agentPersona/current        │
│                                                                     │
└──────────────────────────┬─────────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────────────┐
│ PHASE 4: ACTIVE WORKFORCE                                          │
│ Path: /workspace/{orgId}/dashboard                                 │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Agent Capabilities:                                                │
│  ├── Voice AI Calls (Twilio/Telnyx + Custom TTS)                  │
│  ├── Social Media Management (LinkedIn, Instagram)                │
│  ├── SEO Content Generation                                        │
│  └── Email Campaigns                                               │
│                                                                     │
│  Training Labs:                                                     │
│  ├── Voice Training Lab (/voice/training)                         │
│  ├── Social Training Lab (/social/training)                       │
│  └── SEO Training Lab (/seo/training)                             │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

### 4.2 File Locations

| Phase | Primary File | Purpose |
|-------|--------------|---------|
| Discovery Gate | `src/app/onboarding/setup/page.tsx` | 16-step onboarding wizard |
| Identity Refine | `src/app/workspace/[orgId]/identity/refine/page.tsx` | 4-step identity wizard |
| Batch Write API | `src/app/api/workspace/[orgId]/identity/route.ts` | Atomic persistence |
| Brand DNA Service | `src/lib/brand/brand-dna-service.ts` | Inheritance engine |
| Prompt Compiler | `src/lib/agent/prompt-compiler.ts` | System prompt builder |

---

## 5. Synthetic Data Integrity

### 5.1 The 5 Test Personas

All personas are **VALIDATED** and **DEMO-READY**.

| # | Persona | Industry | Voice Engine | Personality | Color |
|---|---------|----------|--------------|-------------|-------|
| 1 | **Aurora** (AuraFlow Analytics) | B2B SaaS - Analytics | ElevenLabs | Consultative | Purple `#7c3aed` |
| 2 | **Sage** (GreenThumb Landscaping) | Home Services | Native | Friendly | Green `#16a34a` |
| 3 | **Trail Guide** (Adventure Gear Shop) | E-commerce - Outdoor | Native | Energetic | Orange `#ea580c` |
| 4 | **Summit Advisor** (Summit Wealth) | Financial Services | ElevenLabs | Professional | Cyan `#0e7490` |
| 5 | **Pixel** (PixelPerfect Design) | Creative Services | Native | Friendly | Pink `#ec4899` |

### 5.2 Persona Configuration Details

#### Persona 1: Aurora (AuraFlow Analytics)
```yaml
Organization ID: org_demo_auraflow
Industry: B2B SaaS - Business Analytics
Plan: Enterprise

Workforce Identity:
  Name: Aurora
  Tagline: "Transforming data into decisions"
  Archetype: consultative
  Voice Engine: elevenlabs
  Voice ID: 21m00Tcm4TlvDq8ikWAM (Rachel)

Brand DNA:
  Tone: Professional
  Target: Mid-market companies (50-500 employees)
  Key Phrases: ["actionable insights", "data-driven decisions"]

Products: 6 (Growth, Business, Enterprise Plans + Add-ons)
```

#### Persona 2: Sage (GreenThumb Landscaping)
```yaml
Organization ID: org_demo_greenthumb
Industry: Home Services - Landscaping
Plan: Pro

Workforce Identity:
  Name: Sage
  Tagline: "Your outdoor living expert"
  Archetype: friendly
  Voice Engine: native
  Voice ID: native-sophia

Brand DNA:
  Tone: Warm
  Target: Suburban homeowners, $100k+ income
  Key Phrases: ["outdoor living", "curb appeal"]

Products: 8 (Landscape Design, Maintenance, Irrigation, Patio, etc.)
```

#### Persona 3: Trail Guide (Adventure Gear Shop)
```yaml
Organization ID: org_demo_adventuregear
Industry: E-commerce - Outdoor Equipment
Plan: Pro

Workforce Identity:
  Name: Trail Guide
  Tagline: "Gear up for your next adventure"
  Archetype: energetic
  Voice Engine: native
  Voice ID: native-marcus

Brand DNA:
  Tone: Enthusiastic-professional
  Target: Outdoor enthusiasts aged 25-55
  Key Phrases: ["field-tested", "adventure-ready"]

Products: 8 (Backpacks, Tents, Jackets, Boots, Climbing gear)
```

#### Persona 4: Summit Advisor (Summit Wealth Management)
```yaml
Organization ID: org_demo_summitwm
Industry: Financial Services - Wealth Management
Plan: Enterprise

Workforce Identity:
  Name: Summit Advisor
  Tagline: "Building wealth, securing futures"
  Archetype: professional
  Voice Engine: elevenlabs
  Voice ID: TX3LPaxmHKxFdv7VOQHJ (Liam)

Brand DNA:
  Tone: Professional
  Target: High-net-worth individuals ($500k+ assets)
  Key Phrases: ["fiduciary duty", "wealth preservation"]

Products: 7 (Wealth Management, Financial Planning, Retirement, etc.)
```

#### Persona 5: Pixel (PixelPerfect Design Co.)
```yaml
Organization ID: org_demo_pixelperfect
Industry: Creative Services - Design Agency
Plan: Pro

Workforce Identity:
  Name: Pixel
  Tagline: "Where creativity meets strategy"
  Archetype: friendly
  Voice Engine: native
  Voice ID: native-aria

Brand DNA:
  Tone: Friendly
  Target: Growing businesses ($1M-$50M revenue)
  Key Phrases: ["brand transformation", "strategic design"]

Products: 8 (Brand Identity, Website, Logo, Collateral, Retainers)
```

### 5.3 Data Files

| File | Purpose | Status |
|------|---------|--------|
| `src/lib/test-data/mock-organizations.ts` | Full persona definitions | ✅ Validated |
| `scripts/seed-test-organizations.ts` | Database seeding script | ✅ Validated |

### 5.4 Test Credentials

```
Account 1: test1@example.com / TestPass123! → AuraFlow Analytics
Account 2: test2@example.com / TestPass123! → GreenThumb Landscaping
Account 3: test3@example.com / TestPass123! → Adventure Gear Shop
Account 4: test4@example.com / TestPass123! → Summit Wealth Management
Account 5: test5@example.com / TestPass123! → PixelPerfect Design Co.
```

---

## 6. Infrastructure & Stack

### 6.1 Technology Stack

```
┌─────────────────────────────────────────────────────────────────────┐
│                        TECHNOLOGY STACK                              │
└─────────────────────────────────────────────────────────────────────┘

Frontend:
├── Framework: Next.js 14 (App Router)
├── Language: TypeScript 5.x
├── Styling: Tailwind CSS + Zinc Theme
├── Components: Custom UI Library (Zinc-themed)
├── State: React Context + Server Components
└── Forms: React Hook Form + Zod validation

Backend:
├── Runtime: Node.js 20.x (Vercel Edge)
├── API: Next.js API Routes (Route Handlers)
├── Database: Firebase Firestore
├── Auth: Firebase Authentication
├── Storage: Firebase Cloud Storage
└── Functions: Firebase Cloud Functions

AI/ML:
├── LLM: Google Gemini Pro (conversation AI)
├── TTS: Multi-provider (Native, Unreal, ElevenLabs)
├── Vision: Google Gemini Vision (screenshot analysis)
└── Embeddings: OpenAI ada-002 (planned for RAG)

Infrastructure:
├── Hosting: Vercel
├── VoIP: Twilio + Telnyx
├── CDN: Vercel Edge Network
├── Monitoring: Vercel Analytics
└── CI/CD: GitHub Actions
```

### 6.2 Twilio Integration

**Configuration Required:**

```bash
# .env.local
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+1234567890
```

**API Routes:**

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/voice/call` | POST | Initiate outbound call |
| `/api/voice/ai-agent/[agentId]` | GET | TwiML for AI agent |
| `/api/voice/ai-agent/speech` | POST | Process speech input |
| `/api/voice/twiml` | POST | Generate TwiML response |
| `/api/webhooks/voice` | POST | Call status webhooks |

**Call Flow:**
1. Platform initiates call via Twilio API
2. Twilio calls webhook URL with TwiML request
3. AI generates response via Gemini
4. Response rendered as TwiML `<Say>` or `<Play>` (custom TTS)
5. Process repeats until call ends or transfers

### 6.3 Next.js App Router Patterns

**Directory Structure:**
```
src/app/
├── (auth)/                    # Auth-required layout group
│   ├── layout.tsx             # Auth check wrapper
│   └── workspace/[orgId]/     # Workspace routes
│       ├── dashboard/         # Main dashboard
│       ├── identity/          # Identity management
│       │   └── refine/        # 4-step wizard
│       ├── voice/             # Voice features
│       │   └── training/      # Voice training lab
│       ├── social/            # Social features
│       └── seo/               # SEO features
├── admin/                     # Admin routes
├── api/                       # API routes
│   ├── workspace/[orgId]/     # Org-scoped APIs
│   ├── voice/                 # Voice APIs
│   └── webhooks/              # External webhooks
├── onboarding/                # Onboarding flow
└── (marketing)/               # Public pages
```

**Route Groups:**
- `(auth)` - Routes requiring authentication
- `(marketing)` - Public marketing pages
- `admin` - Admin-only routes

### 6.4 Zinc Theme UI Consistency

**Design System:**
```typescript
// Zinc color palette (consistent across all components)
const zincColors = {
  background: '#09090b',      // zinc-950
  surface: '#18181b',         // zinc-900
  surfaceHover: '#27272a',    // zinc-800
  border: '#3f3f46',          // zinc-700
  textPrimary: '#fafafa',     // zinc-50
  textSecondary: '#a1a1aa',   // zinc-400
  textMuted: '#71717a',       // zinc-500
  accent: '#7c3aed',          // violet-600
  success: '#22c55e',         // green-500
  warning: '#f59e0b',         // amber-500
  error: '#ef4444',           // red-500
};
```

**Component Patterns:**
- Cards: `bg-zinc-900 border border-zinc-800 rounded-xl`
- Buttons: Primary uses brand color, secondary uses zinc
- Inputs: `bg-zinc-950 border-zinc-700 focus:border-violet-500`
- Text: Primary (zinc-50), Secondary (zinc-400), Muted (zinc-500)

---

## 7. Refactoring & Cleanup Status

### 7.1 Completed Cleanup

| Task | Status | Notes |
|------|--------|-------|
| TypeScript errors | ✅ Fixed | 0 compilation errors |
| Fish Audio references | ✅ Fixed | Removed from native-provider.ts and types.ts |
| Voice ID format | ✅ Fixed | Updated to provider-specific IDs |
| Missing env vars | ✅ Documented | Added to .env.example |

### 7.2 Files Updated

#### Fish Audio Reference Removal
- `src/lib/voice/tts/providers/native-provider.ts` - Lines 2-3, 68, 84
- `src/lib/voice/tts/types.ts` - Line 254

#### Voice ID Corrections
- `src/lib/test-data/mock-organizations.ts` - All 5 personas

### 7.3 No Files Deleted

After comprehensive audit, **no files require deletion**. All code serves active purposes:
- TTS providers are all used in marketplace
- Voice providers (Twilio/Telnyx) are production infrastructure
- API routes are referenced by frontend
- Test data scripts are essential for development

### 7.4 Remaining Technical Debt

| Issue | Priority | Effort | Files |
|-------|----------|--------|-------|
| `any` types in voice providers | Medium | 2-3 hrs | twilio-provider.ts, telnyx-provider.ts |
| Console.log in production code | Low | 30 min | voice-engine-factory.ts, elevenlabs-provider.ts |
| Deprecated legacy functions | Low | 1 hr | src/lib/voice/index.ts |

---

## 8. Proprietary Advantages

### 8.1 Native Voice Engine Value Proposition

```
┌─────────────────────────────────────────────────────────────────────┐
│                  PROPRIETARY ADVANTAGE: NATIVE ENGINE                │
└─────────────────────────────────────────────────────────────────────┘

CONTROL:
├── Platform-managed API keys (users can't bypass)
├── Curated voice personas (consistent quality)
├── Custom pricing model (margin opportunity)
└── No external API exposure (competitive moat)

POSITIONING:
├── "Native" branding (proprietary perception)
├── Default/recommended option in UI
├── Best balance of cost ($0.005/1k) and quality
└── Future custom voice cloning capability

ARCHITECTURE:
├── Factory pattern enables seamless backend swap
├── API abstraction hides implementation details
├── Environment variable controls infrastructure
└── Ready for self-hosted TTS model
```

### 8.2 Brand DNA Inheritance Advantage

```
COMPETITIVE DIFFERENTIATION:
├── Single source of truth for brand voice
├── Automatic propagation to all channels
├── Override capability for channel optimization
└── Industry templates accelerate onboarding

CUSTOMER VALUE:
├── "Set once, applied everywhere" simplicity
├── Consistent brand experience across channels
├── AI learns company voice, not generic responses
└── Progressive refinement over time
```

### 8.3 Industry Specialization Advantage

```
50+ INDUSTRY TEMPLATES:
├── Pre-configured cognitive frameworks
├── Industry-specific terminology
├── Tailored objection handling
├── Channel-appropriate tactics

INJECTION QUESTIONS:
├── Single highest-leverage data point per industry
├── Transforms generic → specialist in one step
├── Examples:
│   ├── Real Estate: "What neighborhoods?"
│   ├── Dental: "Sedation options?"
│   └── Landscaping: "Service radius?"
```

---

## 9. Roadmap

### 9.1 Native Engine Implementation Path

**Current State:** Stub implementation with placeholder audio

**Phase 1: Third-Party White-Label (2-4 weeks)**
- Complete integration with TTS provider under "Native" brand
- Platform-managed API keys only
- Establish baseline quality and costs

**Phase 2: Self-Hosted Option (3-6 months)**
- Evaluate open-source TTS models (Coqui, VITS, Bark)
- Deploy self-hosted inference server
- Migrate "Native" traffic to self-hosted

**Phase 3: Custom Voice Cloning (6-12 months)**
- Enable customer voice uploads
- Train custom voice models per organization
- Ultimate proprietary differentiation

### 9.2 Brand DNA Evolution

**Upcoming Features:**
- [ ] Version control for Brand DNA (rollback capability)
- [ ] A/B testing for brand voice variants
- [ ] RAG integration for knowledge base queries
- [ ] Multi-language Brand DNA support
- [ ] Brand DNA marketplace (template sharing)

### 9.3 Workforce Capabilities

**In Development:**
- [ ] Video Factory for AI-generated content
- [ ] Workflow Builder for automation
- [ ] Multi-agent orchestration
- [ ] Real-time conversation analytics
- [ ] Sentiment-based call routing

---

## Appendix A: Environment Variables

```bash
# ========================================
# Firebase Configuration
# ========================================
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=

# ========================================
# Voice & TTS Providers
# ========================================
# Native Voice (Proprietary)
NATIVE_VOICE_URL=
NATIVE_VOICE_API_KEY=

# Unreal Speech
UNREAL_SPEECH_API_KEY=

# ElevenLabs
ELEVENLABS_API_KEY=

# ========================================
# VoIP Providers
# ========================================
# Twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# Telnyx
TELNYX_API_KEY=
TELNYX_PHONE_NUMBER=

# ========================================
# AI Services
# ========================================
GOOGLE_GEMINI_API_KEY=
OPENAI_API_KEY=

# ========================================
# Application
# ========================================
NEXTAUTH_SECRET=
NEXTAUTH_URL=
```

---

## Appendix B: API Reference

### Identity API

```typescript
// GET /api/workspace/{orgId}/identity
// Returns current identity configuration
Response: {
  identity: WorkforceIdentity;
  brandDNA: BrandDNA;
  onboardingData: OnboardingData;
}

// POST /api/workspace/{orgId}/identity
// Saves identity configuration (atomic batch write)
Request: {
  identity: WorkforceIdentity;
  brandDNA: BrandDNA;
  userId: string;
}
Response: {
  success: boolean;
  message: string;
}
```

### Voice TTS API

```typescript
// POST /api/voice/tts
// Synthesize speech from text
Request: {
  text: string;
  engine: 'native' | 'unreal' | 'elevenlabs';
  voiceId: string;
  format?: 'mp3' | 'wav' | 'pcm' | 'ogg';
  speed?: number;
  pitch?: number;
}
Response: {
  audio: string; // Base64 encoded
  format: string;
  durationSeconds: number;
  charactersUsed: number;
  estimatedCostCents: number;
}

// GET /api/voice/tts/voices?engine={engine}
// Get available voices for engine
Response: {
  voices: Array<{
    id: string;
    name: string;
    gender: string;
    description: string;
  }>;
}
```

---

## Document Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-01-12 | System Architect | Initial release |

---

**END OF SYSTEM BLUEPRINT**
