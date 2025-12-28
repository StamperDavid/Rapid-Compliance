# 🎭 Comprehensive AI Agent Persona System

## Overview

The AI Agent Persona System creates **highly specialized, domain-expert AI agents** automatically from your onboarding process. Unlike generic chatbots, these agents have deep expertise, sophisticated reasoning, and tactical capabilities tailored to your specific business.

## The Vision

**Problem**: Most AI agents are generic and superficial. They don't truly understand your business, industry, or customers.

**Solution**: A comprehensive persona framework that creates expert-level agents by combining:
1. **Onboarding Data** (company, industry, products, brand voice)
2. **Product Information** (features, pricing, use cases)
3. **Training Sessions** (objection handling, successful strategies)
4. **Knowledge Base** (documents, case studies, competitive intel)

**Result**: An AI agent that thinks, reasons, and acts like a seasoned expert in your domain.

---

## Persona Architecture

### I. Core Identity & Expert Role

Defines **who the agent is** and **who it serves**.

#### Fields:
- **Agent Name & Professional Title**
  - Built from: Company name + Industry
  - Example: `"Aegis-7 | Nuclear Compliance Lead"`

- **Core Mission & Moral Imperative**
  - The "North Star" that guides every decision
  - Built from: Company mission + Value proposition
  - Example: *"To act as a Trusted Advisor first and a Seller second. Ensure no client is left vulnerable to preventable threats."*

- **Target Knowledge Domain**
  - The specific field the agent must master
  - Built from: Industry + Product categories
  - Example: `"Cybersecurity, Zero Trust, SASE, Cloud Security, HIPAA/GDPR Compliance"`

- **Assumed User Expertise Level**
  - Determines if agent explains basics or uses jargon
  - Built from: Target customer profile
  - Example: `"C-Suite (CISO/CIO) or Senior IT Directors. Use high-level business impact language with technical validation when requested."`

---

### II. Cognitive & Reasoning Logic

Defines **how the agent thinks** and **makes decisions**.

#### Fields:
- **Domain-Specific Reasoning Framework**
  - The mental model the agent uses
  - Examples:
    - Sales: "The Challenger Sale + MEDDPICC"
    - Engineering: "First Principles + Root Cause Analysis"
    - Creative: "Divergent Thinking + Iterative Refinement"
  - Built from: Sales methodology selection in onboarding

- **Response Complexity Index (RCI)**
  - Scale of 1-10 for technical depth
  - 1 = ELI5, 10 = PhD-level
  - Built from: Target audience sophistication

- **Uncertainty Handling Protocol**
  - Exactly how the agent admits it doesn't know something
  - Example: *"I want to ensure 100% accuracy on our encryption standards; let me pull the latest whitepaper from our engineering vault."*
  - Prevents hallucinations and builds trust

- **Internal Thought Verification Loop**
  - Instructions for the agent to "think" before it speaks
  - Example: *"Before every response: (1) Does this address a business pain point? (2) Am I creating urgency? (3) Is my tone appropriate?"*
  - Ensures quality and strategic alignment

---

### III. Knowledge & RAG Integration

Defines **what the agent knows** and **how it retrieves information**.

#### Fields:
- **Federated RAG Routing Tags**
  - Which specific databases the agent can query
  - Built from: Product categories + Document uploads
  - Example:
    ```
    DOMAIN: CYBER_SECURITY_PRODUCT_SPECS
    SUB_DOMAIN: COMPETITOR_BATTLECARDS
    SUB_DOMAIN: CASE_STUDIES_FINANCE_SECTOR
    ```

- **Knowledge Source Hierarchy**
  - Prioritization of information sources
  - Example:
    1. Internal Product Documentation (Real-time)
    2. Customer Success Stories & Case Studies
    3. Industry Reports (Gartner/Forrester)
    4. Competitor Intelligence
    5. General Web Search (last resort)

- **Source Authority Weighting**
  - Which sources to trust more than others
  - Example: *"Prioritize peer-reviewed research over blog posts. Trust verified customer ROI data over marketing claims."*

- **Context Retrieval Depth**
  - How many "layers" of related info to pull
  - Example: `3` = Pull last 3 interactions with this customer + 3 related product docs

---

### IV. Learning & Adaptation Loops

Defines **how the agent improves** from feedback and adapts to users.

#### Fields:
- **User Feedback Integration Strategy**
  - How the agent updates its memory based on thumbs up/down or corrections
  - Example: *"If user says 'That's too expensive,' tag as 'Price Objection' and shift to Value-Based Justification in next turn."*

- **Dynamic Tone Register**
  - Ability to shift tone based on user sentiment
  - Example: *"Start Professional/Consultative. If user uses casual language, mirror their style. If frustrated, shift to empathetic problem-solving."*

- **Successful Strategy Memory (Few-Shot Learning)**
  - Log of past successful interactions to use as templates
  - Example: *"Log the specific 'Close' that results in a demo booking. Use that closing style for similar leads."*

- **Knowledge Obsolescence Timer**
  - Rules for when data is "too old" to be trusted
  - Example: *"Competitor pricing: 2 months. Industry stats: 6 months. Technical specs: Real-time."*

---

### V. Functional & Tactical Execution

Defines **what actions the agent can take** and **how it formats outputs**.

#### Fields:
- **Tool/API Authorization Level**
  - What external actions the agent can take autonomously vs. asking permission
  - Built from: Integrations configured during onboarding
  - Example:
    ```
    Salesforce_CRM: Read/Write (Autonomous)
    Calendly_API: Execute (Autonomous - can book meetings)
    Stripe_Checkout: Read Only (Manual approval required)
    Email_Sender: Execute with Review (Manual approval)
    ```

- **Mandatory Output Formatting**
  - Ensures consistent, professional outputs
  - Example: *"Use **bolded key metrics**. End interactions with 'Recommended Next Step'. Use tables for pricing comparisons."*

- **Security & Data Classification Filter**
  - Strict rules on what the agent is forbidden to leak or discuss
  - Example: *"NEVER reveal: (1) Specific discounts given to other clients, (2) Proprietary technical architecture, (3) Other customers' data."*

---

## How It's Built from Onboarding

### Onboarding Flow → Persona Generation

```
┌─────────────────────────────────────────────────────────────────┐
│                     ONBOARDING FORM                             │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 1: Company Information                                    │
│  ─────────────────────────────────────────────────────────────  │
│  • Company Name          → agentName                            │
│  • Industry              → targetKnowledgeDomain                │
│  • Company Description   → coreMission                          │
│  • Target Customer       → userExpertiseLevel                   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 2: Products & Services                                    │
│  ─────────────────────────────────────────────────────────────  │
│  • Product List          → federatedRAGTags                     │
│  • Product Categories    → targetKnowledgeDomain                │
│  • Use Cases            → knowledgeSourceHierarchy              │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 3: Brand Voice & Communication                            │
│  ─────────────────────────────────────────────────────────────  │
│  • Tone (Professional/Friendly/Technical)  → dynamicToneRegister│
│  • Formality Level       → responseComplexityIndex              │
│  • Technical Depth       → responseComplexityIndex              │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 4: Sales Methodology                                      │
│  ─────────────────────────────────────────────────────────────  │
│  • Challenger / SPIN / Sandler / Value-Based                    │
│    → reasoningFramework                                         │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 5: Knowledge Sources                                      │
│  ─────────────────────────────────────────────────────────────  │
│  • Upload Documents      → knowledgeSourceHierarchy             │
│  • Add URLs             → knowledgeSourceHierarchy              │
│  • Connect Databases    → federatedRAGTags                      │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 6: Integrations & Permissions                             │
│  ─────────────────────────────────────────────────────────────  │
│  • CRM Integration       → toolAuthorization                    │
│  • Calendar Integration  → toolAuthorization                    │
│  • Payment Processing    → toolAuthorization                    │
│  • Email/SMS Services    → toolAuthorization                    │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 7: Security & Compliance                                  │
│  ─────────────────────────────────────────────────────────────  │
│  • Compliance Requirements (HIPAA/GDPR/SOC2)                    │
│    → securityDataFilter                                         │
│  • Data Retention Policy → securityDataFilter                   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              COMPREHENSIVE PERSONA GENERATED                    │
│                   (Ready to Deploy)                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Example: Basic vs. Comprehensive Persona

### ❌ Basic Persona (Generic Chatbot)
```
Name: "Sales Bot"
Instructions: "Be helpful and friendly. Answer customer questions about our products."
```

### ✅ Comprehensive Persona (Expert Agent)
```
Name: "Aegis-Consult | Senior Strategic Account Executive"

Core Mission:
"Act as a Trusted Advisor first and Seller second. Solve client business risk 
through the Aegis Security Suite, ensuring no client is left vulnerable to 
preventable threats."

Reasoning Framework: The Challenger Sale + MEDDPICC
- Don't just answer questions
- Identify Pain Points, Implication of Inaction, Economic Buyer triggers
- If user asks about feature → pivot to business value

Uncertainty Handling:
"I want to ensure 100% accuracy on our encryption standards; let me pull 
the latest whitepaper from our engineering vault." [TRIGGER: RAG Search]

Internal Verification Loop:
Before every response, ask:
1. Does this address a business pain point or just a feature?
2. Am I creating urgency?
3. Have I qualified the economic buyer?

Tool Authorization:
✓ Salesforce_CRM: Read/Write (Autonomous)
✓ Calendly_API: Execute (Can book meetings automatically)
✗ Pricing_Discounts: Manual Approval Required

Knowledge Retrieval:
Priority 1: Internal Product Wiki (Real-time)
Priority 2: Verified Customer Success Stories
Priority 3: Gartner/Forrester Industry Reports

Context Depth: Pull last 3 interactions with this company to maintain 
"Relationship Threading"
```

**The Difference**: The comprehensive persona doesn't just talk—it **thinks strategically**, **acts autonomously**, and **adapts intelligently**.

---

## Admin Access

### Viewing & Editing Persona

**Location**: `/admin/sales-agent/persona`

**Access**:
1. Login to admin dashboard: `http://localhost:3000/admin/login`
2. Navigate to "Sales Agent" → "Agent Persona"
3. Or directly: `http://localhost:3000/admin/sales-agent/persona`

### Five Sections:
1. **🎯 Core Identity** - Who the agent is and who it serves
2. **🧠 Cognitive Logic** - How the agent thinks and reasons
3. **📚 Knowledge & RAG** - What the agent knows and how it retrieves info
4. **🔄 Learning Loops** - How the agent improves and adapts
5. **⚡ Tactical Execution** - What actions the agent can take

---

## Why This Makes Your Platform Special

### The Competition:
- **Salesforce Einstein**: Generic AI, no customization
- **HubSpot ChatBot**: Basic scripted responses
- **Drift**: Conversational, but not strategic
- **Intercom**: FAQ answering, not selling

### Your Platform:
✓ **Domain Expert** - Specialized in YOUR business  
✓ **Strategic Thinker** - Uses proven sales methodologies (MEDDPICC, Challenger, etc.)  
✓ **Autonomous Actor** - Can book meetings, update CRM, send emails  
✓ **Continuous Learner** - Improves from every interaction  
✓ **Relationship Builder** - Remembers context and builds continuity  

---

## Next Steps

### For Platform Admin (You):
1. **Complete Onboarding** (if not done)
   - Fills in company info, products, brand voice
   - Automatically generates initial persona

2. **Review & Refine Persona**
   - Go to `/admin/sales-agent/persona`
   - Review auto-generated fields
   - Customize reasoning framework, tone, security filters

3. **Train the Agent**
   - Use Training Center (`/admin/sales-agent/training`)
   - Practice objection handling, pricing discussions
   - Build "Successful Strategy Memory"

4. **Deploy Golden Master**
   - Once training score > 80%, activate
   - Agent goes live on website, chat widget, etc.

### For Your Clients:
- **Same process at workspace level**
- Each client gets their own specialized agent
- Built from their onboarding flow
- Completely isolated and customized

---

## Technical Implementation

### Type Definition
```typescript
// src/types/agent-persona.ts
export interface AgentPersona {
  // Core Identity
  agentName: string;
  professionalTitle: string;
  coreMission: string;
  targetKnowledgeDomain: string;
  userExpertiseLevel: string;
  
  // Cognitive & Reasoning
  reasoningFramework: string;
  responseComplexityIndex: number;
  uncertaintyHandlingProtocol: string;
  internalThoughtVerification: string;
  
  // Knowledge & RAG
  federatedRAGTags: string[];
  knowledgeSourceHierarchy: string[];
  sourceAuthorityWeighting: string;
  contextRetrievalDepth: number;
  
  // Learning & Adaptation
  feedbackIntegrationStrategy: string;
  dynamicToneRegister: string;
  successfulStrategyMemory: string;
  knowledgeObsolescenceTimer: string;
  
  // Tactical Execution
  toolAuthorization: ToolAuthorization[];
  mandatoryOutputFormatting: string;
  securityDataFilter: string;
}
```

### Generator Function
```typescript
// Automatically generates persona from onboarding data
export function generatePersonaFromOnboarding(
  onboarding: OnboardingData
): AgentPersona {
  // Maps onboarding fields to persona structure
  // See src/types/agent-persona.ts for full implementation
}
```

### Storage
```
Firestore Structure:
├── admin/
│   └── platform-sales-agent/
│       └── config/
│           └── persona/
│               ├── agentName
│               ├── coreMission
│               ├── reasoningFramework
│               └── ...
│
├── organizations/{orgId}/
│   └── agents/
│       └── {agentId}/
│           └── persona/
│               └── (same structure for client agents)
```

---

## Conclusion

This **Comprehensive Persona System** transforms your AI agents from generic chatbots into **domain-expert advisors** that:

✅ **Think** using proven methodologies  
✅ **Know** your business deeply  
✅ **Act** autonomously and strategically  
✅ **Learn** from every interaction  
✅ **Adapt** to each user's style  

**Result**: An AI sales team that can truly replace human departments while maintaining perfect customer continuity.

---

**Built with your onboarding data. Powered by Golden Master architecture. Ready to deploy.**

