# AI CRM Platform - Architecture Overview

## Vision
A multi-tenant, industry-agnostic CRM platform that can be configured for any business vertical (transportation compliance, service businesses, e-commerce, etc.) with complete customization of schema, theming, and AI agent behavior.

## Core Principles
1. **Multi-tenancy**: Complete data isolation per workspace/organization
2. **Configurability**: No hardcoded business logic or UI elements
3. **Scalability**: Designed for GCP's serverless/managed services
4. **Extensibility**: Plugin architecture for custom integrations

---

## Technology Stack (GCP-Optimized)

### Frontend Layer
- **Framework**: Next.js 14+ (App Router)
  - Server-side rendering for performance
  - Built-in API routes
  - Edge runtime support
- **UI Library**: React 18+ with TypeScript
- **Styling**: Tailwind CSS + CSS-in-JS for dynamic theming
- **State Management**: Zustand + React Query (for server state)
- **Form Management**: React Hook Form + Zod validation

### Backend Layer
- **Hosting**: Cloud Run (containerized Next.js + API services)
- **Functions**: Cloud Functions Gen 2 (event-driven workflows)
- **Database**: Firestore (primary) + Cloud SQL (PostgreSQL for analytics)
- **Storage**: Cloud Storage (documents, images, backups)
- **Cache**: Memorystore (Redis) for session/query caching
- **Search**: Algolia or Typesense (full-text search)

### AI/ML Layer
- **Primary AI**: Vertex AI + Gemini API
- **Vector Search**: Vertex AI Vector Search (for RAG/knowledge base)
- **Training**: Custom model training via Vertex AI (future)
- **Embeddings**: Vertex AI text embeddings

### Infrastructure
- **CDN**: Cloud CDN + Cloud Armor (DDoS protection)
- **Auth**: Firebase Auth + Identity Platform
- **Secrets**: Secret Manager
- **Monitoring**: Cloud Logging, Cloud Monitoring, Error Reporting
- **CI/CD**: Cloud Build + Artifact Registry
- **IaC**: Terraform

---

## Data Architecture

### Multi-Tenant Model

```
Firestore Structure:
/organizations/{orgId}
  - name, plan, settings, theme, createdAt, etc.
  
  /workspaces/{workspaceId}
    - name, industry, config
    
    /schemas/{schemaId}
      - entityName, fields[], relations[], views[]
    
    /entities/{entityName}  // Dynamic collections
      /{recordId}
        - [dynamic fields based on schema]
    
    /ai_agents/{agentId}
      - name, systemPrompt, knowledgeBase, model, version
      - goldenMasterLog[], trainingData[]
    
    /workflows/{workflowId}
      - trigger, actions[], conditions[]
    
    /integrations/{integrationId}
      - type, credentials, mappings
    
  /members/{userId}
    - email, role, permissions[]
    
  /audit_logs/{logId}
    - action, userId, timestamp, changes
```

### Schema System (Airtable-like)

**Field Types**:
- **Basic**: Text, Long Text, Number, Currency, Percent
- **Selection**: Single Select, Multiple Select, Checkbox
- **Date/Time**: Date, DateTime, Time, Duration
- **Relationships**: Link to Record, Lookup, Rollup
- **Media**: Attachment, URL, Email, Phone
- **Advanced**: Formula, Auto Number, Barcode, Rating
- **AI**: AI Generated Text, AI Classification

**Field Properties**:
- Required, Unique, Default Value
- Validation rules (regex, min/max, etc.)
- Visibility rules (conditional display)
- Computed formulas

**Relations**:
- One-to-Many
- Many-to-Many
- Self-referencing
- Cascade delete options

---

## Theme System

### Theme Configuration Object
```typescript
interface ThemeConfig {
  id: string;
  name: string;
  
  // Colors
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    error: string;
    warning: string;
    success: string;
    text: {
      primary: string;
      secondary: string;
      disabled: string;
    };
  };
  
  // Typography
  typography: {
    fontFamily: {
      heading: string;
      body: string;
      mono: string;
    };
    fontSize: {
      xs: string;
      sm: string;
      base: string;
      lg: string;
      xl: string;
      // ...
    };
  };
  
  // Spacing
  spacing: {
    unit: number; // base unit (e.g., 4px)
    scale: number[]; // [0, 1, 2, 3, 4, 6, 8, 12, 16, ...]
  };
  
  // Layout
  layout: {
    borderRadius: string;
    maxWidth: string;
    sidebarWidth: string;
  };
  
  // Components
  components: {
    button: ComponentTheme;
    input: ComponentTheme;
    card: ComponentTheme;
    // ...
  };
  
  // Branding
  branding: {
    logo: string; // URL
    favicon: string;
    loginBackground: string;
  };
}
```

### Theme Application
- CSS Variables injected at runtime
- Dynamic Tailwind configuration
- Component-level overrides
- Dark mode support

---

## View Builder System

### View Types
1. **Table View**: Spreadsheet-like grid with filters, sorting, grouping
2. **Kanban View**: Drag-and-drop cards by status/category
3. **Calendar View**: Date-based entity display
4. **Gallery View**: Card-based visual layout
5. **Form View**: Data entry forms
6. **Dashboard View**: Custom widgets, charts, KPIs
7. **List View**: Compact list with quick actions
8. **Map View**: Geolocation-based display (future)

### View Configuration
```typescript
interface ViewConfig {
  id: string;
  name: string;
  type: ViewType;
  entitySchema: string; // references schema
  
  // Display
  visibleFields: string[];
  fieldOrder: string[];
  groupBy?: string;
  sortBy?: { field: string; direction: 'asc' | 'desc' }[];
  
  // Filters
  filters: Filter[];
  
  // Layout
  layout: {
    cardSize?: 'sm' | 'md' | 'lg';
    columnsPerRow?: number;
    // ...view-specific settings
  };
  
  // Permissions
  permissions: {
    view: string[]; // roles
    edit: string[];
    delete: string[];
  };
}
```

---

## AI Agent Configuration

### Agent Types
1. **Sales Agent**: Product recommendations, lead qualification
2. **Support Agent**: Troubleshooting, FAQ, ticket routing
3. **Service Agent**: Appointment scheduling, service recommendations
4. **Data Entry Agent**: Form assistance, validation
5. **Custom Agent**: User-defined behavior

### Agent Configuration
```typescript
interface AIAgentConfig {
  id: string;
  name: string;
  type: AgentType;
  
  // Model
  model: 'gemini-2.5-flash' | 'gemini-pro' | 'custom';
  temperature: number;
  
  // Behavior
  systemPrompt: string;
  personality: {
    tone: 'professional' | 'friendly' | 'technical' | 'custom';
    verbosity: 'concise' | 'balanced' | 'detailed';
  };
  
  // Knowledge
  knowledgeBase: {
    documents: string[]; // Cloud Storage URLs
    urls: string[];
    entityData: string[]; // schema references
    customText: string;
  };
  
  // Capabilities
  tools: {
    googleSearch: boolean;
    entityCRUD: boolean; // can create/read/update/delete records
    workflowTrigger: boolean;
    externalAPI: boolean;
  };
  
  // Guardrails
  guardrails: {
    maxTokens: number;
    prohibitedTopics: string[];
    requiredDisclosures: string[];
  };
  
  // Training
  goldenMaster: {
    version: number;
    trainingScore: number;
    savedConversations: Conversation[];
  };
}
```

---

## Workflow Automation

### Workflow Engine
- **Triggers**: Record created/updated/deleted, scheduled, webhook, manual
- **Conditions**: If/then logic, field comparisons
- **Actions**: 
  - Update records
  - Send emails/SMS
  - Call webhooks
  - Trigger AI agent
  - Run Cloud Function
  - Create tasks

### Example: Auto-assign lead to sales agent
```yaml
trigger: record_created
entity: leads
conditions:
  - field: lead_score
    operator: greater_than
    value: 80
actions:
  - type: ai_agent_interaction
    agent: sales_agent_01
    prompt: "Qualify this lead and send personalized email"
  - type: update_record
    fields:
      status: "contacted"
      assigned_to: "{{ ai_agent.recommended_rep }}"
```

---

## GCP Deployment Architecture

### Production Setup

```
┌─────────────────────────────────────────────┐
│          Cloud Load Balancer                │
│            + Cloud CDN                      │
└─────────────────┬───────────────────────────┘
                  │
    ┌─────────────┴─────────────┐
    │                           │
┌───▼─────────────┐   ┌─────────▼──────────┐
│  Cloud Run      │   │  Cloud Run         │
│  (Next.js App)  │   │  (API Services)    │
│  Auto-scaling   │   │  Auto-scaling      │
└───┬─────────────┘   └─────────┬──────────┘
    │                           │
    └─────────────┬─────────────┘
                  │
    ┌─────────────┴──────────────────┐
    │                                │
┌───▼──────────┐         ┌──────────▼─────────┐
│  Firestore   │         │  Memorystore       │
│  (Primary DB)│         │  (Redis Cache)     │
└──────────────┘         └────────────────────┘
                  
    ┌──────────────────────────────┐
    │  Cloud Functions             │
    │  - Workflow execution        │
    │  - AI training jobs          │
    │  - Data exports              │
    └──────────────────────────────┘
    
    ┌──────────────────────────────┐
    │  Vertex AI                   │
    │  - Gemini API                │
    │  - Vector Search             │
    │  - Model endpoints           │
    └──────────────────────────────┘
```

### Environment Variables / Secrets
- Stored in Secret Manager
- Injected at runtime via Cloud Run
- Rotated automatically

### Monitoring & Observability
- **Cloud Logging**: Centralized logging
- **Cloud Monitoring**: Metrics, dashboards, alerts
- **Cloud Trace**: Request tracing
- **Error Reporting**: Automatic error aggregation

---

## Development Phases

### Phase 1: Foundation (Weeks 1-4)
- Multi-tenant data model
- Advanced schema builder
- Dynamic entity CRUD
- Basic theme system

### Phase 2: UI/UX (Weeks 5-8)
- View builder (Table, Form, Kanban)
- Theme editor interface
- Responsive layouts
- Component library

### Phase 3: AI Integration (Weeks 9-12)
- Agent configuration system
- Training interface improvements
- Knowledge base management
- Golden master deployment

### Phase 4: Automation (Weeks 13-16)
- Workflow builder
- Trigger system
- Integration framework
- API layer

### Phase 5: Enterprise (Weeks 17-20)
- Advanced permissions/RBAC
- Audit logging
- Analytics dashboard
- White-label capabilities

### Phase 6: Scale & Optimize (Weeks 21-24)
- Performance optimization
- GCP production deployment
- Load testing
- Documentation

---

## Security Considerations

### Data Isolation
- Firestore security rules per organization
- Row-level security (RLS) via middleware
- Encrypted at rest and in transit

### Authentication & Authorization
- Firebase Auth with custom claims
- Role-Based Access Control (RBAC)
- API key management for integrations

### Compliance
- GDPR compliance (data export, deletion)
- SOC 2 readiness
- Audit trail for all actions

---

## Cost Optimization

### GCP Cost Management
- **Firestore**: Use automatic scaling, optimize queries
- **Cloud Run**: Set min/max instances, use CPU throttling
- **Cloud Functions**: Right-size memory allocation
- **Vertex AI**: Use batch predictions where possible
- **Cloud CDN**: Cache static assets aggressively
- **Monitoring**: Set budgets and alerts

### Pricing Model for Platform
- **Free Tier**: Limited workspaces, records, AI calls
- **Pro Tier**: Per-seat pricing, higher limits
- **Enterprise**: Custom pricing, dedicated resources

---

## Next Steps

1. **Immediate**: Create project structure and core abstractions
2. **Short-term**: Implement schema builder and multi-tenancy
3. **Medium-term**: Build theme system and view builder
4. **Long-term**: Deploy to GCP with full CI/CD

---

## E-Commerce Integration

### Embeddable Storefront
Turn any workspace into a fully functional e-commerce platform with embeddable widgets (like Dutchy).

**Key Features**:
- **One-Click Activation**: Enable e-commerce for any workspace
- **Shortcode Generation**: Generate embeddable widgets for any website
- **Universal Compatibility**: WordPress, Wix, Squarespace, custom sites
- **Full Payment Processing**: Stripe, Square, PayPal, etc.
- **Inventory Sync**: Real-time sync with CRM entities
- **Order Management**: Auto-create customer and order entities in CRM

**Widget Types**:
1. Full Storefront - Complete online store
2. Product Grid - Grid of products
3. Buy Button - Single product purchase
4. Shopping Cart - Standalone cart
5. Product Card - Single product display
6. Featured Products - Curated showcase
7. Category View - Category-specific products

**Embed Options**:
```html
<!-- WordPress Shortcode -->
[crm-store id="abc123" type="full"]

<!-- JavaScript -->
<script src="https://yourplatform.com/embed.js"></script>
<div data-crm-widget="abc123"></div>

<!-- React -->
<CRMStoreWidget widgetId="abc123" type="full_store" />

<!-- iframe -->
<iframe src="https://store.yourplatform.com/abc123"></iframe>
```

**Business Models Supported**:
- E-commerce (physical products)
- Digital products / downloads
- Services & bookings
- Subscriptions & memberships
- B2B wholesale
- Multi-vendor marketplace

---

## Questions to Consider

1. **Multi-tenancy**: Separate GCP projects per enterprise customer or shared infrastructure?
2. **Pricing**: Usage-based vs. seat-based vs. hybrid?
3. **White-labeling**: Custom domains per customer?
4. **Marketplace**: Allow third-party integrations/plugins?
5. **Mobile**: Native apps or PWA?
6. **E-commerce GMV Limits**: How to tier pricing based on transaction volume?


