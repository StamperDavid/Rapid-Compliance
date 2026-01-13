# AI Sales Platform - Exhaustive Technical Briefing

> **Document Type:** Complete Technical Source of Truth
> **Generated:** January 2026
> **Scope:** 100% System Architecture, Data Models, Business Logic, Infrastructure
> **Target Audience:** AI Collaborators, Principal Engineers, System Architects

---

## Table of Contents

1. [Executive System Overview](#1-executive-system-overview)
2. [Core Infrastructure](#2-core-infrastructure)
3. [Database Architecture (Firestore)](#3-database-architecture-firestore)
4. [Voice & Media Stack](#4-voice--media-stack)
5. [Business Logic & Workflows](#5-business-logic--workflows)
6. [SaaS Layer & Multi-Tenancy](#6-saas-layer--multi-tenancy)
7. [Identity & Brand DNA System](#7-identity--brand-dna-system)
8. [AI Agent Architecture](#8-ai-agent-architecture)
9. [Test Data & Personas](#9-test-data--personas)
10. [Environment & Deployment](#10-environment--deployment)
11. [Technical Debt & Known Issues](#11-technical-debt--known-issues)

---

## 1. Executive System Overview

### 1.1 Platform Identity

**What It Is:** A B2B SaaS platform that enables businesses to deploy AI-powered "Sales Workforce" agents capable of making outbound calls, qualifying leads, and closing deals autonomously.

**Core Value Proposition:**
- Replace human SDRs/BDRs with AI voice agents
- 24/7 autonomous prospecting and deal closing
- Brand-consistent AI personas that inherit company identity
- Visual workflow builder for sales automation

### 1.2 Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND LAYER                           │
│  Next.js 14 App Router │ React 18 │ TailwindCSS │ Zinc UI      │
├─────────────────────────────────────────────────────────────────┤
│                        API LAYER                                │
│  200+ Route Handlers │ Edge Functions │ Server Actions          │
├─────────────────────────────────────────────────────────────────┤
│                        BUSINESS LOGIC                           │
│  Workflow Engine │ Brand DNA │ Agent Orchestration │ Prompts   │
├─────────────────────────────────────────────────────────────────┤
│                        VOICE/MEDIA                              │
│  TTS Factory │ VoIP (Twilio/Telnyx) │ WebSocket │ Streaming    │
├─────────────────────────────────────────────────────────────────┤
│                        DATA LAYER                               │
│  Firebase Firestore │ 60+ Collections │ RBAC Security Rules    │
├─────────────────────────────────────────────────────────────────┤
│                        EXTERNAL INTEGRATIONS                    │
│  OpenAI │ ElevenLabs │ Twilio │ Telnyx │ HubSpot │ Stripe      │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 Key Metrics

| Metric | Value |
|--------|-------|
| Total Files | 380+ |
| Total Pages | 171 |
| API Routes | 200+ |
| Firestore Collections | 60+ |
| Lines of Code | ~300,000 |
| Voice Providers | 3 (Native, Unreal, ElevenLabs) |
| VoIP Providers | 2 (Twilio, Telnyx) |

---

## 2. Core Infrastructure

### 2.1 Framework Stack

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| Framework | Next.js | 14.x | App Router, SSR, API Routes |
| Runtime | React | 18.x | UI Components |
| Language | TypeScript | 5.x | Type Safety |
| Styling | TailwindCSS | 3.x | Utility-First CSS |
| Components | Zinc UI | Custom | Design System |
| State | React Context + Hooks | - | Client State |
| Forms | React Hook Form | - | Form Management |
| Validation | Zod | - | Schema Validation |

### 2.2 Directory Structure

```
src/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Authentication routes (grouped)
│   │   ├── login/
│   │   ├── register/
│   │   └── forgot-password/
│   ├── (dashboard)/              # Main dashboard (grouped)
│   │   ├── workspace/[orgId]/    # Org-scoped workspace
│   │   │   ├── agents/           # Agent management
│   │   │   ├── campaigns/        # Campaign management
│   │   │   ├── contacts/         # Contact/Lead management
│   │   │   ├── identity/         # Brand DNA configuration
│   │   │   ├── settings/         # Org settings
│   │   │   ├── voice/            # Voice configuration
│   │   │   └── workflows/        # Visual workflow builder
│   │   └── admin/                # Platform admin
│   ├── api/                      # API Route Handlers
│   │   ├── v1/                   # Versioned public API
│   │   ├── agents/               # Agent operations
│   │   ├── campaigns/            # Campaign operations
│   │   ├── voice/                # Voice/TTS operations
│   │   ├── webhooks/             # External webhooks
│   │   └── workflows/            # Workflow operations
│   └── onboarding/               # Onboarding wizard
│       └── [orgId]/
│           ├── setup/            # Step 1: Basic setup
│           ├── identity/         # Step 2: Brand identity
│           ├── workforce/        # Step 3: Agent config
│           └── activate/         # Step 4: Go live
├── components/                   # React Components
│   ├── ui/                       # Base UI primitives
│   ├── forms/                    # Form components
│   ├── agents/                   # Agent-specific components
│   ├── voice/                    # Voice UI components
│   └── workflows/                # Workflow builder components
├── lib/                          # Core Business Logic
│   ├── ai/                       # AI/LLM integrations
│   ├── auth/                     # Authentication logic
│   ├── db/                       # Firestore operations
│   ├── voice/                    # Voice engine factory
│   │   └── tts/                  # TTS providers
│   ├── voip/                     # VoIP provider abstraction
│   ├── workflows/                # Workflow engine
│   └── utils/                    # Shared utilities
├── hooks/                        # React Custom Hooks
├── contexts/                     # React Contexts
├── types/                        # TypeScript Types
└── config/                       # Configuration
```

### 2.3 Routing Architecture

**Route Groups (Parentheses Syntax):**
- `(auth)` - Unauthenticated routes with minimal layout
- `(dashboard)` - Authenticated routes with full navigation
- `(marketing)` - Public marketing pages

**Dynamic Segments:**
- `[orgId]` - Organization identifier (UUID)
- `[agentId]` - Agent identifier
- `[campaignId]` - Campaign identifier
- `[workflowId]` - Workflow identifier

**Parallel Routes:**
- `@modal` - Modal overlays
- `@sidebar` - Contextual sidebars

### 2.4 Middleware Chain

```typescript
// middleware.ts
export async function middleware(request: NextRequest) {
  // 1. Rate Limiting (Edge)
  // 2. Authentication Check
  // 3. Organization Context Injection
  // 4. Feature Flag Evaluation
  // 5. Route Protection
}

export const config = {
  matcher: [
    '/workspace/:path*',
    '/api/:path*',
    '/admin/:path*',
  ],
};
```

### 2.5 API Route Patterns

**Standard CRUD Pattern:**
```
/api/[resource]/route.ts          → GET (list), POST (create)
/api/[resource]/[id]/route.ts     → GET (single), PUT/PATCH, DELETE
```

**Nested Resources:**
```
/api/organizations/[orgId]/agents/[agentId]/route.ts
/api/organizations/[orgId]/campaigns/[campaignId]/contacts/route.ts
```

**Action Endpoints:**
```
/api/agents/[agentId]/deploy/route.ts
/api/agents/[agentId]/pause/route.ts
/api/campaigns/[campaignId]/launch/route.ts
```

---

## 3. Database Architecture (Firestore)

### 3.1 Collection Hierarchy

```
firestore/
├── organizations/                    # Root tenant collection
│   └── {orgId}/
│       ├── [document fields]
│       ├── workspaces/              # Sub-collection
│       │   └── {workspaceId}/
│       ├── users/                   # Org members
│       │   └── {userId}/
│       ├── agents/                  # AI Agents
│       │   └── {agentId}/
│       │       ├── versions/        # Version history
│       │       ├── calls/           # Call logs
│       │       └── metrics/         # Performance metrics
│       ├── campaigns/               # Outreach campaigns
│       │   └── {campaignId}/
│       │       ├── contacts/        # Campaign contacts
│       │       └── tasks/           # Scheduled tasks
│       ├── contacts/                # Master contact list
│       │   └── {contactId}/
│       │       └── interactions/    # Interaction history
│       ├── workflows/               # Workflow definitions
│       │   └── {workflowId}/
│       │       └── executions/      # Execution logs
│       ├── identity/                # Brand DNA
│       │   └── {identityDoc}/
│       ├── voiceConfig/             # Voice settings
│       │   └── {configId}/
│       ├── billing/                 # Billing data
│       │   └── {billingDoc}/
│       └── settings/                # Org settings
│           └── {settingsDoc}/
├── users/                           # Global user profiles
│   └── {userId}/
│       ├── organizations/           # Org memberships
│       └── preferences/             # User preferences
├── subscriptions/                   # Stripe subscriptions
│   └── {subscriptionId}/
├── invitations/                     # Pending invites
│   └── {inviteId}/
├── auditLogs/                       # System audit trail
│   └── {logId}/
└── systemConfig/                    # Platform config
    └── {configDoc}/
```

### 3.2 Core Document Schemas

#### Organization Document
```typescript
interface Organization {
  id: string;                        // UUID
  name: string;                      // Display name
  slug: string;                      // URL-safe identifier
  ownerId: string;                   // Creator user ID

  // Subscription & Billing
  subscriptionTier: 'tier1' | 'tier2' | 'tier3' | 'tier4';
  subscriptionStatus: 'active' | 'past_due' | 'canceled';
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;

  // Limits (volume-based, not feature-gated)
  limits: {
    maxRecords: number;              // Contact limit by tier
    maxAgents: number;               // Agent limit
    maxCampaigns: number;            // Campaign limit
    monthlyMinutes: number;          // Voice minutes
  };

  // Usage Tracking
  usage: {
    currentRecords: number;
    currentAgents: number;
    currentCampaigns: number;
    monthlyMinutesUsed: number;
    lastResetDate: Timestamp;
  };

  // Onboarding State
  onboardingStatus: 'pending' | 'setup' | 'identity' | 'workforce' | 'complete';
  onboardingCompletedAt?: Timestamp;

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt?: Timestamp;
}
```

#### Agent Document
```typescript
interface Agent {
  id: string;
  organizationId: string;
  workspaceId?: string;

  // Identity
  name: string;
  description?: string;
  avatar?: string;

  // Type & Mode
  type: 'prospector' | 'closer';
  mode: 'inbound' | 'outbound' | 'hybrid';

  // Voice Configuration
  voiceConfig: {
    provider: 'native' | 'unreal' | 'elevenlabs';
    voiceId: string;
    settings: TTSVoiceSettings;
  };

  // Persona & Behavior
  persona: {
    personalityTraits: string[];
    communicationStyle: string;
    expertise: string[];
    restrictions: string[];
  };

  // Prompt Configuration
  systemPrompt: string;
  greetingScript?: string;
  objectionHandlers?: Record<string, string>;
  closingTechniques?: string[];

  // Integration
  calendarIntegration?: {
    provider: 'google' | 'outlook' | 'calendly';
    calendarId: string;
  };
  crmIntegration?: {
    provider: 'hubspot' | 'salesforce';
    syncEnabled: boolean;
  };

  // Deployment Status
  status: 'draft' | 'testing' | 'deployed' | 'paused' | 'archived';
  goldenMasterVersion?: string;       // Immutable production snapshot
  deployedAt?: Timestamp;

  // Performance Metrics (denormalized)
  metrics: {
    totalCalls: number;
    successfulCalls: number;
    averageDuration: number;
    conversionRate: number;
  };

  // Metadata
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### Contact Document
```typescript
interface Contact {
  id: string;
  organizationId: string;

  // Core Info
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;

  // Segmentation
  tags: string[];
  lists: string[];                   // List memberships
  source: string;                    // Lead source

  // Status & Qualification
  status: 'new' | 'contacted' | 'qualified' | 'nurturing' | 'converted' | 'lost';
  leadScore?: number;
  qualificationNotes?: string;

  // Communication Preferences
  preferences: {
    timezone?: string;
    bestTimeToCall?: string;
    doNotCall: boolean;
    doNotEmail: boolean;
  };

  // CRM Sync
  externalIds?: {
    hubspotId?: string;
    salesforceId?: string;
  };

  // AI Memory (persisted across sessions)
  aiMemory?: {
    keyInsights: string[];
    painPoints: string[];
    objections: string[];
    interests: string[];
    lastConversationSummary?: string;
  };

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastContactedAt?: Timestamp;
}
```

#### Workflow Document
```typescript
interface Workflow {
  id: string;
  organizationId: string;

  // Definition
  name: string;
  description?: string;

  // Trigger Configuration
  trigger: {
    type: 'entity' | 'schedule' | 'webhook' | 'manual';
    config: EntityTrigger | ScheduleTrigger | WebhookTrigger;
  };

  // Node Graph
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];

  // Status
  status: 'draft' | 'active' | 'paused' | 'archived';
  version: number;

  // Execution Stats (denormalized)
  stats: {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    lastExecutedAt?: Timestamp;
  };

  // Metadata
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface WorkflowNode {
  id: string;
  type: 'action' | 'condition' | 'delay' | 'split' | 'merge';
  position: { x: number; y: number };
  data: ActionNodeData | ConditionNodeData | DelayNodeData;
}
```

### 3.3 Security Rules Pattern

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper Functions
    function isAuthenticated() {
      return request.auth != null;
    }

    function isOrgMember(orgId) {
      return isAuthenticated() &&
        exists(/databases/$(database)/documents/organizations/$(orgId)/users/$(request.auth.uid));
    }

    function hasOrgRole(orgId, role) {
      let userDoc = get(/databases/$(database)/documents/organizations/$(orgId)/users/$(request.auth.uid));
      return userDoc.data.role == role;
    }

    function isOrgAdmin(orgId) {
      return hasOrgRole(orgId, 'admin') || hasOrgRole(orgId, 'owner');
    }

    // Organization Rules
    match /organizations/{orgId} {
      allow read: if isOrgMember(orgId);
      allow write: if isOrgAdmin(orgId);

      // Nested collections inherit org context
      match /agents/{agentId} {
        allow read: if isOrgMember(orgId);
        allow write: if isOrgAdmin(orgId);
      }

      match /contacts/{contactId} {
        allow read: if isOrgMember(orgId);
        allow write: if isOrgMember(orgId);
      }

      match /workflows/{workflowId} {
        allow read: if isOrgMember(orgId);
        allow write: if isOrgAdmin(orgId);
      }
    }

    // Global user profiles
    match /users/{userId} {
      allow read: if request.auth.uid == userId;
      allow write: if request.auth.uid == userId;
    }
  }
}
```

### 3.4 Index Strategy

**Composite Indexes Required:**
```
organizations/{orgId}/contacts:
  - status ASC, createdAt DESC
  - tags ARRAY_CONTAINS, lastContactedAt DESC
  - leadScore DESC, status ASC

organizations/{orgId}/agents:
  - status ASC, type ASC
  - deployedAt DESC

organizations/{orgId}/workflows:
  - status ASC, trigger.type ASC
  - lastExecutedAt DESC
```

---

## 4. Voice & Media Stack

### 4.1 TTS Engine Factory

**Location:** `src/lib/voice/tts/`

**Architecture Pattern:** Factory + Strategy

```typescript
// voice-engine-factory.ts
class VoiceEngineFactory {
  private providers: Map<TTSEngineType, TTSProvider>;

  constructor() {
    this.providers = new Map([
      ['native', new NativeProvider()],
      ['unreal', new UnrealSpeechProvider()],
      ['elevenlabs', new ElevenLabsProvider()],
    ]);
  }

  getProvider(type: TTSEngineType): TTSProvider {
    const provider = this.providers.get(type);
    if (!provider) throw new Error(`Unknown TTS provider: ${type}`);
    return provider;
  }

  async synthesize(request: TTSSynthesizeRequest): Promise<TTSSynthesizeResponse> {
    const config = await this.getOrgConfig(request.organizationId);
    const provider = this.getProvider(request.engine || config.engine);
    return provider.synthesize(request.text, request.voiceId || config.voiceId, request.settings);
  }
}
```

### 4.2 TTS Provider Comparison

| Provider | Quality | Latency | Cost/1k chars | Free Tier | User Keys |
|----------|---------|---------|---------------|-----------|-----------|
| Native | Premium | Low | $0.005 | 50k/mo | No |
| Unreal Speech | Standard | Low | $0.001 | 250k/mo | Yes |
| ElevenLabs | Ultra | Medium | $0.03 | 10k/mo | Yes |

### 4.3 Provider Interface

```typescript
// types.ts
interface TTSProvider {
  readonly type: TTSEngineType;

  synthesize(
    text: string,
    voiceId: string,
    settings?: TTSVoiceSettings
  ): Promise<TTSSynthesizeResponse>;

  listVoices(): Promise<TTSVoice[]>;
  getProviderInfo(): TTSProviderInfo;
  validateApiKey(apiKey: string): Promise<boolean>;
  getVoice(voiceId: string): Promise<TTSVoice | null>;
}

interface TTSVoiceSettings {
  speed?: number;           // 0.5 - 2.0
  pitch?: number;           // -12 to 12 semitones
  volume?: number;          // 0.0 - 1.0
  format?: AudioFormat;     // mp3, wav, pcm, ogg
  sampleRate?: number;      // 8000 - 48000
  stability?: number;       // ElevenLabs: 0-1
  similarityBoost?: number; // ElevenLabs: 0-1
  styleExaggeration?: number; // ElevenLabs: 0-1
}
```

### 4.4 Native Provider Implementation

**Location:** `src/lib/voice/tts/providers/native-provider.ts`

**Status:** Stub implementation (placeholder for proprietary service)

**Available Voices:**
| Voice ID | Name | Gender | Description |
|----------|------|--------|-------------|
| native-aria | Aria | Female | Warm, professional, customer service |
| native-marcus | Marcus | Male | Confident, natural intonation, sales |
| native-sophia | Sophia | Female | Friendly, energetic, marketing |
| native-james | James | Male | Authoritative, gravitas, executive |
| native-luna | Luna | Female | Soft, calming, support/onboarding |

### 4.5 VoIP Provider Abstraction

**Location:** `src/lib/voip/`

**Supported Providers:**
- **Twilio** - Primary, full-featured
- **Telnyx** - Secondary, 66% cost savings

```typescript
// voip-factory.ts
interface VoIPProvider {
  makeCall(params: CallParams): Promise<CallResult>;
  endCall(callId: string): Promise<void>;
  sendDTMF(callId: string, digits: string): Promise<void>;
  getCallStatus(callId: string): Promise<CallStatus>;
  streamAudio(callId: string, audio: Buffer): Promise<void>;
}

class VoIPFactory {
  getProvider(type: 'twilio' | 'telnyx'): VoIPProvider;
  getPreferredProvider(orgId: string): Promise<VoIPProvider>;
}
```

### 4.6 Real-Time Communication

**WebSocket Architecture:**
```
Client ←→ Edge Function ←→ VoIP Provider
              ↓
         AI Processing
              ↓
         TTS Provider
              ↓
         Audio Stream
```

**Event Types:**
- `call:started` - Call initiated
- `call:connected` - Call answered
- `speech:started` - User speaking
- `speech:ended` - User stopped speaking
- `transcript:partial` - Real-time transcription
- `transcript:final` - Final transcription
- `agent:thinking` - AI processing
- `agent:speaking` - AI audio playing
- `call:ended` - Call terminated

### 4.7 AI Conversation Engine

**Location:** `src/lib/ai/conversation/`

**Flow:**
1. Receive user speech (WebSocket)
2. Transcribe (Whisper/Deepgram)
3. Process with LLM (OpenAI GPT-4)
4. Generate response text
5. Synthesize speech (TTS Factory)
6. Stream audio back (WebSocket)

**Latency Target:** < 500ms end-to-end

---

## 5. Business Logic & Workflows

### 5.1 Workflow Engine

**Location:** `src/lib/workflows/`

**Trigger Types:**

| Type | Description | Example |
|------|-------------|---------|
| Entity | Fires on data changes | Contact status → "qualified" |
| Schedule | Cron-based timing | Every weekday at 9 AM |
| Webhook | External HTTP trigger | HubSpot deal created |
| Manual | User-initiated | Click "Run Now" |

### 5.2 Node Types

**Action Nodes:**
- `send-email` - Send templated email
- `make-call` - Initiate AI call
- `send-sms` - Send text message
- `update-record` - Modify database
- `create-task` - Create follow-up task
- `assign-agent` - Route to specific agent
- `sync-crm` - Push to external CRM
- `ai-analyze` - Run AI analysis

**Control Nodes:**
- `condition` - If/else branching
- `delay` - Wait for duration
- `split` - Parallel execution
- `merge` - Synchronization point
- `loop` - Iterate over collection

### 5.3 Visual Workflow Builder

**Technology:** React Flow + Custom Nodes

**Features:**
- Drag-and-drop node placement
- Connection validation
- Real-time preview
- Execution history viewer
- Error highlighting
- Version comparison

### 5.4 Brand DNA System

**Concept:** Hierarchical identity inheritance

```
Organization Brand DNA (Root)
    ├── Default Tone & Voice
    ├── Core Values
    ├── Industry Context
    └── Communication Guidelines
           │
           ▼
Tool Training Layer
    ├── Product Knowledge
    ├── Feature Documentation
    ├── Objection Handling
    └── Competitive Positioning
           │
           ▼
Agent Persona Layer
    ├── Individual Personality
    ├── Expertise Areas
    ├── Communication Style
    └── Behavioral Constraints
```

**Inheritance Rules:**
1. Child layers inherit all parent properties
2. Child can override specific properties
3. Deletions don't cascade (soft override with null)
4. Changes propagate on next agent deployment

### 5.5 Prompt Compilation

**Location:** `src/lib/ai/prompts/`

**Process:**
```typescript
function compileAgentPrompt(agent: Agent, org: Organization): string {
  // 1. Load org brand DNA
  const brandDna = await getBrandDna(org.id);

  // 2. Load tool training
  const toolTraining = await getToolTraining(org.id, agent.type);

  // 3. Load agent persona
  const persona = agent.persona;

  // 4. Compile final prompt
  return `
    ${brandDna.systemContext}

    ${toolTraining.productKnowledge}

    ${persona.personalityPrompt}

    ${agent.systemPrompt}
  `;
}
```

---

## 6. SaaS Layer & Multi-Tenancy

### 6.1 Tenant Hierarchy

```
Platform (SaaS Root)
    └── Organization (Billing Entity)
            ├── Workspace (Logical Grouping)
            │       └── Resources (Agents, Campaigns, etc.)
            └── Users (Members with Roles)
```

### 6.2 Role-Based Access Control

| Role | Scope | Permissions |
|------|-------|-------------|
| Platform Admin | Global | Full platform access |
| Org Owner | Organization | Full org access, billing, delete |
| Org Admin | Organization | Full org access, no billing |
| Manager | Workspace | Full workspace access |
| Agent | Workspace | Limited, assigned resources only |
| Viewer | Workspace | Read-only access |

### 6.3 Pricing Model

**Volume-Based (No Feature Gating):**

| Tier | Monthly Price | Max Records | Voice Minutes |
|------|--------------|-------------|---------------|
| Tier 1 | $400 | 1,000 | 500 |
| Tier 2 | $600 | 5,000 | 2,000 |
| Tier 3 | $900 | 25,000 | 10,000 |
| Tier 4 | $1,250 | 100,000 | 50,000 |

**Key Philosophy:** All features available at all tiers. Scaling is purely by volume.

### 6.4 Onboarding State Machine

```
                    ┌─────────────────────────────────────────┐
                    │                                         │
  ┌──────────┐   ┌──────────┐   ┌───────────┐   ┌──────────┐   ┌──────────┐
  │  Signup  │──▶│  Setup   │──▶│  Identity │──▶│ Workforce │──▶│ Complete │
  └──────────┘   └──────────┘   └───────────┘   └──────────┘   └──────────┘
       │              │               │               │               │
       │              ▼               ▼               ▼               ▼
       │         Org Created    Brand DNA Set   Agent Created    Dashboard
       │         Admin Assigned  Voice Config   First Campaign   All Features
       │
       └──────────────────────────────────────────────────────────────────▶
                              (Direct to Dashboard if skipped)
```

**State Persistence:**
```typescript
interface OnboardingState {
  currentStep: 'setup' | 'identity' | 'workforce' | 'activate';
  completedSteps: string[];
  stepData: {
    setup?: { orgName, industry, size };
    identity?: { brandVoice, values, tone };
    workforce?: { agentType, voiceConfig };
    activate?: { firstCampaign };
  };
  skippedAt?: Timestamp;
  completedAt?: Timestamp;
}
```

### 6.5 Authentication Flow

**Provider:** Firebase Authentication

**Methods:**
- Email/Password
- Google OAuth
- Microsoft OAuth (Enterprise)
- SSO/SAML (Enterprise tier)

**Session Management:**
- JWT tokens (Firebase ID tokens)
- Refresh token rotation
- Session revocation on logout
- Cross-device session sync

---

## 7. Identity & Brand DNA System

### 7.1 Brand DNA Schema

```typescript
interface BrandDNA {
  id: string;
  organizationId: string;

  // Core Identity
  companyName: string;
  industry: string;
  tagline?: string;

  // Voice & Tone
  voiceAttributes: {
    primary: string[];      // e.g., ["professional", "warm"]
    avoid: string[];        // e.g., ["casual", "slang"]
  };

  // Communication Style
  communicationStyle: {
    formality: 'formal' | 'semi-formal' | 'casual';
    pace: 'slow' | 'moderate' | 'fast';
    verbosity: 'concise' | 'balanced' | 'detailed';
  };

  // Values & Positioning
  coreValues: string[];
  differentiators: string[];
  targetAudience: string;

  // Knowledge Base
  productInfo?: string;
  faq?: Array<{ question: string; answer: string }>;
  objectionHandlers?: Array<{ objection: string; response: string }>;

  // Restrictions
  prohibitedTopics?: string[];
  complianceNotes?: string;

  // Metadata
  version: number;
  updatedAt: Timestamp;
  updatedBy: string;
}
```

### 7.2 Identity API Routes

**Location:** `src/app/api/organizations/[orgId]/identity/`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/identity` | GET | Retrieve current brand DNA |
| `/identity` | PUT | Update brand DNA |
| `/identity/preview` | POST | Preview changes in agent |
| `/identity/history` | GET | Version history |
| `/identity/revert/[version]` | POST | Revert to version |

### 7.3 DNA Propagation

**Trigger:** Brand DNA update saved

**Process:**
1. Mark all deployed agents as "pending refresh"
2. Queue background job for each agent
3. Recompile agent prompts with new DNA
4. Update agent's effective prompt
5. Mark agent as "refreshed"

**Real-Time Option:**
- Hot-reload for testing agents
- Requires explicit "Refresh Live Agents" action for production

---

## 8. AI Agent Architecture

### 8.1 Agent Types

**Prospector:**
- Focus: Lead qualification
- Goal: Identify fit, gather intel, schedule meetings
- Tone: Exploratory, consultative
- Success Metric: Meeting booked rate

**Closer:**
- Focus: Deal closing
- Goal: Handle objections, negotiate, close
- Tone: Persuasive, confident
- Success Metric: Conversion rate

### 8.2 Agent Lifecycle

```
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│  Draft   │──▶│ Testing  │──▶│ Deployed │──▶│  Paused  │──▶│ Archived │
└──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘
     │              │               │               │
     │              ▼               ▼               ▼
     │         Test Calls      Live Calls     No Activity
     │         Dev Voice       Prod Voice     Preserved
     │
     └─────────────────────────────────────────────────────▶ (Delete)
```

### 8.3 Golden Master Versioning

**Purpose:** Immutable production snapshots

**On Deploy:**
1. Capture full agent configuration
2. Compile and freeze prompt
3. Store as version with timestamp
4. Mark as "golden master"

**Rollback:**
1. Select previous golden master
2. Apply configuration
3. Create new golden master from rollback

### 8.4 Customer Memory

**Location:** `contact.aiMemory`

**Persisted Data:**
- Key insights from conversations
- Identified pain points
- Recorded objections
- Expressed interests
- Last conversation summary

**Usage:**
- Loaded before each call
- Appended after each call
- Used in prompt context
- Enables continuity across sessions

---

## 9. Test Data & Personas

### 9.1 Mock Organizations

**Location:** `src/lib/test-data/mock-organizations.ts`

| Persona | Industry | Tier | Voice Provider | Voice ID |
|---------|----------|------|----------------|----------|
| AuraFlow Wellness | Health & Wellness | Tier 2 | ElevenLabs | 21m00Tcm4TlvDq8ikWAM |
| GreenThumb Landscaping | Home Services | Tier 1 | Native | native-sophia |
| Adventure Gear Co. | E-commerce/Retail | Tier 3 | Native | native-marcus |
| Summit Wealth Advisors | Financial Services | Tier 4 | ElevenLabs | TX3LPaxmHKxFdv7VOQHJ |
| PixelPerfect Studios | Creative/Agency | Tier 2 | Native | native-aria |

### 9.2 Persona Details

**AuraFlow Wellness:**
- Type: Wellness studio, meditation app, self-care products
- Tone: Calm, nurturing, supportive
- Agent: "Serenity" - Prospector focused on wellness journey

**GreenThumb Landscaping:**
- Type: Residential landscaping, lawn care
- Tone: Friendly, reliable, local
- Agent: "Jake" - Closer for service estimates

**Adventure Gear Co.:**
- Type: Outdoor equipment e-commerce
- Tone: Adventurous, knowledgeable, enthusiastic
- Agent: "Ranger" - Prospector for outdoor enthusiasts

**Summit Wealth Advisors:**
- Type: Financial planning, wealth management
- Tone: Professional, trustworthy, educational
- Agent: "Maxwell" - Closer for high-net-worth clients

**PixelPerfect Studios:**
- Type: Creative agency, design services
- Tone: Creative, modern, collaborative
- Agent: "Casey" - Prospector for creative projects

---

## 10. Environment & Deployment

### 10.1 Environment Variables

```env
# Core
NEXT_PUBLIC_APP_URL=
NODE_ENV=development|staging|production

# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
FIREBASE_ADMIN_PRIVATE_KEY=
FIREBASE_ADMIN_CLIENT_EMAIL=

# AI/LLM
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# Voice - TTS
NATIVE_VOICE_URL=
NATIVE_VOICE_API_KEY=
UNREAL_SPEECH_API_KEY=
ELEVENLABS_API_KEY=

# VoIP
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
TELNYX_API_KEY=
TELNYX_PHONE_NUMBER=

# Integrations
HUBSPOT_API_KEY=
SALESFORCE_CLIENT_ID=
SALESFORCE_CLIENT_SECRET=

# Payments
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
```

### 10.2 Deployment Architecture

```
                    ┌─────────────────────────────────────┐
                    │           Vercel Edge              │
                    │   (Next.js SSR + API Routes)       │
                    └─────────────────────────────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    ▼                ▼                ▼
           ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
           │   Firebase   │  │   OpenAI    │  │   Twilio    │
           │  Firestore   │  │   GPT-4     │  │    VoIP     │
           └─────────────┘  └─────────────┘  └─────────────┘
                    ▲                ▲                ▲
                    │                │                │
           ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
           │   Firebase   │  │  ElevenLabs │  │   Telnyx    │
           │    Auth      │  │    TTS      │  │   (Backup)  │
           └─────────────┘  └─────────────┘  └─────────────┘
```

### 10.3 Build & CI/CD

**Build Command:** `npm run build`
**Start Command:** `npm start`
**Test Command:** `npm test`

**CI Pipeline:**
1. Lint (ESLint)
2. Type Check (tsc --noEmit)
3. Unit Tests (Jest)
4. Build (next build)
5. Deploy Preview (Vercel)
6. E2E Tests (Playwright) - on main only

---

## 11. Technical Debt & Known Issues

### 11.1 Critical Items

| Issue | Location | Impact | Priority |
|-------|----------|--------|----------|
| Native TTS is stub | `native-provider.ts` | No actual TTS | High |
| 55 `any` types in voice lib | `src/lib/voice/` | Type safety gaps | Medium |
| Missing voice ID validation | Seed scripts | Silent failures | Medium |

### 11.2 Architecture Improvements

1. **Add Redis caching layer** - Reduce Firestore reads
2. **Implement proper job queue** - For async tasks (Bull/BullMQ)
3. **Add observability** - Structured logging, APM
4. **Implement rate limiting** - Per-org API limits
5. **Add webhook retry logic** - For failed external calls

### 11.3 Security Considerations

1. **Encrypt user API keys at rest** - Currently stored plaintext
2. **Implement audit logging** - For compliance (SOC2)
3. **Add RBAC caching** - Reduce permission check latency
4. **Implement CSP headers** - XSS protection
5. **Add API key rotation** - Scheduled rotation for platform keys

---

## Appendix A: File Reference Quick Links

| Category | Key Files |
|----------|-----------|
| Entry Point | `src/app/layout.tsx` |
| Middleware | `src/middleware.ts` |
| Auth | `src/lib/auth/` |
| Database | `src/lib/db/` |
| Voice Factory | `src/lib/voice/tts/voice-engine-factory.ts` |
| TTS Types | `src/lib/voice/tts/types.ts` |
| Native Provider | `src/lib/voice/tts/providers/native-provider.ts` |
| Workflows | `src/lib/workflows/` |
| Brand DNA API | `src/app/api/organizations/[orgId]/identity/` |
| Agent API | `src/app/api/organizations/[orgId]/agents/` |
| Test Data | `src/lib/test-data/mock-organizations.ts` |

---

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| Brand DNA | Hierarchical identity system that propagates to agents |
| Golden Master | Immutable production snapshot of agent configuration |
| Prospector | AI agent type focused on lead qualification |
| Closer | AI agent type focused on deal closing |
| Native TTS | Proprietary hosted voice synthesis service |
| Workflow | Automated sequence triggered by events or schedules |
| Workspace | Logical grouping within an organization |

---

*Document generated as exhaustive technical source of truth. Zero ambiguity. 100% system coverage.*
