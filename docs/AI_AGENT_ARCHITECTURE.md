# AI Agent Architecture

## Overview

This document describes the complete architecture for our **AI-Agent-as-a-Service Platform** - a system where clients can hire, train, and deploy a powerful AI sales agent that acts as their entire sales department.

## Core Concept: Golden Master + Customer Memory

### The Problem We Solve
- Traditional chatbots forget everything between sessions
- Maintaining large context windows for every customer is expensive and causes hallucinations
- Need continuity without agent bloat

### Our Solution

```
┌─────────────────────────────────────────────────────────────┐
│                      GOLDEN MASTER (v3)                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  • Business knowledge & persona (static)                │ │
│  │  • Sales process & objection handling                   │ │
│  │  • Product catalog & policies                           │ │
│  │  • Trained behaviors from scenarios                     │ │
│  │  • NEVER modified during customer sessions              │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                             │
                             │ For each customer visit...
                             ▼
        ┌────────────────────────────────────────────┐
        │     EPHEMERAL AGENT INSTANCE               │
        │                                            │
        │  Spawned from Golden Master v3             │
        │  + Loaded with Customer Memory             │
        │                                            │
        │  Lives only during this session            │
        │  Deleted when customer leaves              │
        └────────────────────────────────────────────┘
                             │
                             │ Reads & Writes
                             ▼
        ┌────────────────────────────────────────────┐
        │      CUSTOMER MEMORY (Persistent)          │
        │                                            │
        │  • All past conversations                  │
        │  • Learned preferences                     │
        │  • Purchase history                        │
        │  • Agent notes & insights                  │
        │  • Sentiment & behavior patterns           │
        │                                            │
        │  Survives across all sessions              │
        └────────────────────────────────────────────┘
```

## Complete Customer Journey

### 1. **Client Onboarding** (First Time Setup)

When a new client signs up:

```
1. Guided Onboarding Wizard (15 comprehensive steps)
   ├─ Business basics & industry
   ├─ Value proposition & differentiators  
   ├─ Products/services details
   ├─ Pricing & sales strategy
   ├─ Operations & fulfillment
   ├─ Policies & guarantees
   ├─ Agent goals & objectives
   ├─ Sales process & flow
   ├─ Objection handling scripts
   ├─ Customer service scope
   ├─ Agent personality
   ├─ Behavioral controls
   ├─ Knowledge base upload (docs, URLs)
   ├─ Compliance & legal
   └─ Advanced configuration (optional)
       ├─ Custom function definitions
       ├─ Advanced behavioral controls
       ├─ Industry templates
       ├─ Compliance settings
       └─ Custom knowledge organization

2. System Processes Knowledge
   ├─ Parse uploaded documents (PDFs, Excel, images)
   ├─ Scrape and analyze provided URLs
   ├─ Extract product catalogs with pricing
   ├─ Build searchable knowledge base
   └─ Generate initial agent persona

3. Training Center Opens
   └─ Client ready to train their agent
```

### 2. **Agent Training** (Before Going Live)

Training happens in a sandbox environment:

```
Training Scenarios Tab:
├─ Pre-built scenarios based on industry
├─ Custom scenarios created by client
├─ Flagged real conversations (after going live)
└─ Training flow:
    1. Client selects scenario
    2. Scenario loads (customer persona + situation)
    3. Client role-plays as customer
    4. Agent responds in real-time
    5. Client provides feedback directly to agent
       "You were too pushy there"
       "Great! But mention our warranty earlier"
    6. Agent self-analyzes:
       - What went well?
       - What could improve?
       - Key learnings to apply next time
    7. Agent stores improvements
    8. Repeat with variations until proficient
    9. Score scenario: 1-10

Golden Master Tab:
├─ When agent performs consistently well (8+)
├─ Client deploys "Golden Master v1"
├─ Shortcode generated for embedding
└─ Agent ready for live testing
```

### 3. **Going Live** (First Golden Master Deployed)

Once Golden Master v1 is created:

```
1. Shortcode Generated
   <script src="https://platform.com/embed.js" 
           data-org="abc123" 
           data-agent="golden-v1">
   </script>

2. Client Embeds on Website
   └─ Widget appears on their site

3. First Customer Arrives
   └─ Instance spawning begins...
```

### 4. **Customer Session Flow** (Runtime)

Every time a customer visits the client's website:

```
┌─────────────────────────────────────────────────────────────┐
│ CUSTOMER LANDS ON WEBSITE                                    │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. IDENTIFY CUSTOMER                                         │
│    • Cookie ID / Device fingerprint                          │
│    • Email if known                                          │
│    • Creates customerID if new                               │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. SPAWN AGENT INSTANCE                                      │
│    a. Load Golden Master v3                                  │
│    b. Check if customer exists in memory                     │
│       ├─ NEW: Create empty memory record                     │
│       └─ RETURNING: Load full customer history               │
│    c. Compile system prompt:                                 │
│       • Golden Master config (business knowledge)            │
│       • Customer context (if returning)                      │
│       • Past conversations summary                           │
│       • Purchase history                                     │
│       • Agent notes from previous interactions               │
│    d. Create ephemeral instance                              │
│    e. Store in active instances (Redis)                      │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. CONVERSATION BEGINS                                       │
│                                                              │
│    NEW CUSTOMER:                                             │
│    Agent: "Hi! How can I help you today?"                    │
│                                                              │
│    RETURNING CUSTOMER:                                       │
│    Agent: "Welcome back, Sarah! Still interested in          │
│            those hiking boots we discussed last week?"       │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. DURING CONVERSATION                                       │
│    • Each message saved to Customer Memory                   │
│    • Agent takes notes:                                      │
│      "Prefers technical details"                             │
│      "Budget-conscious"                                      │
│      "Buying for family trip in June"                        │
│    • Updates lead status (cold → warm → hot)                 │
│    • Tracks sentiment in real-time                           │
│    • Monitors for escalation triggers                        │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. SESSION ENDS                                              │
│    Possible outcomes:                                        │
│    ├─ SALE: Customer purchased                               │
│    ├─ QUALIFIED_LEAD: High intent, follow up later           │
│    ├─ SUPPORT_RESOLVED: Question answered                    │
│    ├─ ESCALATED: Human took over                             │
│    └─ ABANDONED: Customer left                               │
│                                                              │
│    Final actions:                                            │
│    a. Calculate final sentiment                              │
│    b. Save session summary to Customer Memory                │
│    c. Update customer profile                                │
│    d. Terminate instance → DELETE FROM MEMORY                │
│    e. Archive session for analytics                          │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. CUSTOMER MEMORY PERSISTS                                  │
│    All data saved for next visit:                            │
│    • Full conversation transcript                            │
│    • Learned preferences                                     │
│    • Agent insights                                          │
│    • Next session will load this context                     │
└─────────────────────────────────────────────────────────────┘
```

**Next Visit**: Customer returns → New instance spawned from Golden Master v3 → Loads same Customer Memory → Seamless continuity!

### 5. **Live Conversation Monitoring** (For Client's Team)

Available on main toolbar for all employees:

```
Active Conversations Tab:
├─ Real-time list of ongoing chats
├─ Live message stream
├─ Sentiment indicator (😊 😐 😟)
├─ "Takeover" button → Human can jump in
└─ Auto-flag if sentiment drops or customer requests human

Conversation History Tab:
├─ All completed conversations
├─ Filter by outcome, sentiment, date
├─ Full transcript with agent notes
├─ "Send to Training" button
│   └─ Converts real conversation to training scenario
└─ Analytics: conversion rates, avg handling time, etc.
```

### 6. **Continuous Improvement Loop**

```
Real Conversations → Flag for Training → Training Center
                                              ↓
                    Client trains agent on real scenario
                                              ↓
                    Agent learns & improves
                                              ↓
                    Deploy Golden Master v4
                                              ↓
                    All new sessions use improved version
```

## Advanced Configuration Options

Clients can optionally configure:

### 1. **Custom Function Definitions**
```javascript
// Example: Check real-time inventory
{
  name: "checkInventory",
  description: "Check current stock levels",
  endpoint: "https://client.com/api/inventory",
  params: { productId: "string" }
}
```

### 2. **Advanced Behavioral Controls**
- Conversation flow logic (decision trees)
- Response length limits
- Question patterns
- Proactive vs reactive balance

### 3. **Industry-Specific Templates**
- Pre-built configurations for:
  - High-ticket B2B sales
  - E-commerce with complex shipping
  - Appointment-based services
  - Retail with inventory management

### 4. **Compliance & Legal**
- Required disclaimers
- GDPR/CCPA compliance
- Industry regulations (HIPAA, financial, etc.)
- Prohibited topics

### 5. **Custom Knowledge Organization**
- Tag and categorize documents
- Priority levels for info sources
- Structured product database

## Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                         FIRESTORE DATABASE                        │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  organizations/{orgId}/                                           │
│  ├─ goldenMasters/                                                │
│  │  ├─ {masterId}                                                 │
│  │  │  ├─ version: "v3"                                           │
│  │  │  ├─ isActive: true                                          │
│  │  │  ├─ businessContext: { ... }                                │
│  │  │  ├─ agentPersona: { ... }                                   │
│  │  │  ├─ knowledgeBase: { ... }                                  │
│  │  │  └─ systemPrompt: "..."                                     │
│  │                                                                 │
│  ├─ customerMemories/                                             │
│  │  ├─ {customerId}                                               │
│  │  │  ├─ sessions: [...]                                         │
│  │  │  ├─ conversationHistory: [...]                              │
│  │  │  ├─ preferences: { ... }                                    │
│  │  │  ├─ purchaseHistory: [...]                                  │
│  │  │  ├─ agentNotes: [...]                                       │
│  │  │  └─ contextFlags: { ... }                                   │
│  │                                                                 │
│  ├─ trainingScenarios/                                            │
│  │  └─ {scenarioId}                                               │
│  │                                                                 │
│  └─ archivedSessions/                                             │
│     └─ {sessionId}                                                │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                      REDIS (Active Instances)                     │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  activeInstances:{instanceId}                                     │
│  ├─ sessionId                                                     │
│  ├─ customerId                                                    │
│  ├─ goldenMasterVersion                                           │
│  ├─ currentContext: [messages]                                    │
│  └─ TTL: 30 minutes (auto-cleanup idle sessions)                  │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

## Key Technical Benefits

### ✅ **Scalability**
- Only active sessions consume memory
- No limit to customer memory records
- Each customer isolated

### ✅ **Continuity**
- Customers get personalized experience
- Agent "remembers" everything
- Seamless across devices/sessions

### ✅ **Clean Versioning**
- Golden Master versions (v1, v2, v3...)
- Easy rollback if v4 has issues
- A/B test different versions

### ✅ **No Hallucinations**
- Golden Master never polluted with customer data
- Customer Memory is structured data only
- Clear separation of concerns

### ✅ **Cost Effective**
- Don't maintain 10,000 agent instances
- Spawn on-demand, terminate immediately
- Pay only for active conversations

### ✅ **Privacy Compliant**
- Customer data isolated per org
- Easy to delete customer records (GDPR right to erasure)
- Audit trail of all interactions

## Implementation Checklist

### Phase 1: Core Infrastructure
- [ ] Onboarding wizard (15 steps)
- [ ] Knowledge base processor (PDF, Excel, URLs)
- [ ] Golden Master creator
- [ ] Agent persona compiler

### Phase 2: Training System
- [ ] Training scenario builder
- [ ] Live training sandbox
- [ ] Agent self-improvement loop
- [ ] Golden Master versioning

### Phase 3: Runtime System
- [ ] Instance spawning service
- [ ] Customer memory CRUD operations
- [ ] Session management
- [ ] Auto-termination (idle timeout)

### Phase 4: Monitoring & Ops
- [ ] Live conversation monitoring
- [ ] Real-time sentiment analysis
- [ ] Human takeover system
- [ ] Escalation notifications

### Phase 5: Advanced Features
- [ ] Custom function definitions
- [ ] Advanced behavioral controls
- [ ] Industry templates
- [ ] Compliance modules

## Next Steps

1. **Finish Onboarding Wizard** - Make it truly comprehensive
2. **Build Training Center** - Interactive agent training
3. **Implement Instance Manager** - Core runtime system
4. **Create Embedding Widget** - Client integration
5. **Build Monitoring Dashboard** - Live conversation tools

This architecture makes us **industry-leading** because:
- ✨ One powerful agent, infinitely scalable
- ✨ Learns continuously from real conversations
- ✨ Never forgets a customer
- ✨ Human-in-the-loop when needed
- ✨ Works for ANY industry









