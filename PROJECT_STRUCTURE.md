# Project Structure

## Recommended File Structure for Next.js App

```
ai-crm-platform/
├── .github/
│   └── workflows/
│       ├── deploy-production.yml
│       └── deploy-staging.yml
│
├── infrastructure/        # Terraform/IaC
│   ├── modules/
│   │   ├── cloud-run/
│   │   ├── firestore/
│   │   ├── cloud-functions/
│   │   └── vertex-ai/
│   ├── environments/
│   │   ├── dev/
│   │   ├── staging/
│   │   └── production/
│   └── main.tf
│
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   ├── register/
│   │   │   └── layout.tsx
│   │   ├── (platform)/   # Main app (requires auth)
│   │   │   ├── [orgId]/
│   │   │   │   ├── [workspaceId]/
│   │   │   │   │   ├── schemas/
│   │   │   │   │   ├── entities/
│   │   │   │   │   │   └── [entityName]/
│   │   │   │   │   ├── ai-agents/
│   │   │   │   │   ├── workflows/
│   │   │   │   │   ├── settings/
│   │   │   │   │   └── layout.tsx
│   │   │   │   └── layout.tsx
│   │   │   └── layout.tsx
│   │   ├── api/          # API Routes
│   │   │   ├── entities/
│   │   │   ├── schemas/
│   │   │   ├── ai/
│   │   │   ├── workflows/
│   │   │   └── webhooks/
│   │   ├── layout.tsx
│   │   └── page.tsx
│   │
│   ├── components/
│   │   ├── ui/          # Base UI components
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   └── ...
│   │   ├── schema/      # Schema builder components
│   │   │   ├── SchemaBuilder.tsx
│   │   │   ├── FieldEditor.tsx
│   │   │   ├── RelationshipEditor.tsx
│   │   │   └── ...
│   │   ├── views/       # View components
│   │   │   ├── TableView/
│   │   │   ├── KanbanView/
│   │   │   ├── FormView/
│   │   │   ├── CalendarView/
│   │   │   └── ...
│   │   ├── theme/       # Theme editor
│   │   │   ├── ThemeEditor.tsx
│   │   │   ├── ColorPicker.tsx
│   │   │   └── ...
│   │   ├── ai/          # AI components
│   │   │   ├── AgentChat.tsx
│   │   │   ├── AgentTraining.tsx
│   │   │   ├── KnowledgeBase.tsx
│   │   │   └── ...
│   │   └── layout/
│   │       ├── Header.tsx
│   │       ├── Sidebar.tsx
│   │       ├── Navigation.tsx
│   │       └── ...
│   │
│   ├── lib/
│   │   ├── firebase/
│   │   │   ├── client.ts
│   │   │   ├── admin.ts
│   │   │   └── security-rules.ts
│   │   ├── ai/
│   │   │   ├── gemini.ts
│   │   │   ├── vertex-ai.ts
│   │   │   └── embeddings.ts
│   │   ├── schema/
│   │   │   ├── schema-manager.ts
│   │   │   ├── field-types.ts
│   │   │   ├── validators.ts
│   │   │   └── formula-engine.ts
│   │   ├── theme/
│   │   │   ├── theme-manager.ts
│   │   │   ├── theme-provider.tsx
│   │   │   └── css-generator.ts
│   │   ├── workflow/
│   │   │   ├── workflow-engine.ts
│   │   │   ├── triggers.ts
│   │   │   └── actions.ts
│   │   ├── auth/
│   │   │   ├── permissions.ts
│   │   │   └── rbac.ts
│   │   └── utils/
│   │       ├── api.ts
│   │       ├── validation.ts
│   │       └── helpers.ts
│   │
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useWorkspace.ts
│   │   ├── useSchema.ts
│   │   ├── useEntities.ts
│   │   ├── useTheme.ts
│   │   ├── useAIAgent.ts
│   │   └── ...
│   │
│   ├── types/
│   │   ├── schema.ts
│   │   ├── entity.ts
│   │   ├── theme.ts
│   │   ├── workflow.ts
│   │   ├── ai-agent.ts
│   │   └── index.ts
│   │
│   ├── stores/          # Zustand stores
│   │   ├── workspace-store.ts
│   │   ├── schema-store.ts
│   │   ├── theme-store.ts
│   │   └── ui-store.ts
│   │
│   └── styles/
│       ├── globals.css
│       └── theme-variables.css
│
├── functions/           # Cloud Functions
│   ├── src/
│   │   ├── workflows/
│   │   ├── ai-training/
│   │   ├── exports/
│   │   └── webhooks/
│   ├── package.json
│   └── tsconfig.json
│
├── docs/
│   ├── API.md
│   ├── DEPLOYMENT.md
│   ├── SECURITY.md
│   └── USER_GUIDE.md
│
├── scripts/
│   ├── setup-gcp.sh
│   ├── deploy.sh
│   └── seed-data.ts
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── .env.example
├── .eslintrc.json
├── .prettierrc
├── docker-compose.yml   # Local development
├── Dockerfile
├── next.config.js
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── README.md
```

## Key Design Decisions

### 1. Next.js App Router
- File-based routing with dynamic segments
- Server components by default (better performance)
- API routes co-located with application code

### 2. Multi-tenancy URL Structure
```
/[orgId]/[workspaceId]/entities/[entityName]
/acme-corp/sales-west/entities/leads
```

### 3. Dynamic Entity Routes
All entity views use the same components but render based on schema:
```
/[orgId]/[workspaceId]/entities/[entityName]
  - Loads schema for [entityName]
  - Renders appropriate view (table/kanban/form)
  - Enforces permissions
```

### 4. API Route Organization
```
/api/entities/[entityName]     # CRUD operations
/api/schemas/[schemaId]        # Schema management
/api/ai/chat                   # AI interactions
/api/workflows/execute         # Workflow execution
```

### 5. Component Architecture
- **Atomic Design**: atoms → molecules → organisms → templates
- **Headless UI**: Logic separated from presentation
- **Theme-aware**: All components consume theme context

### 6. State Management Strategy
- **Server State**: React Query (API data, caching)
- **Client State**: Zustand (UI state, ephemeral data)
- **Form State**: React Hook Form (form handling)
- **Theme State**: Context API (theme configuration)

## Development Workflow

1. **Local Development**
   ```bash
   npm run dev              # Start Next.js dev server
   npm run functions:dev    # Start Cloud Functions emulator
   npm run firestore:emul   # Start Firestore emulator
   ```

2. **Building**
   ```bash
   npm run build            # Production build
   npm run type-check       # TypeScript validation
   npm run lint             # ESLint
   ```

3. **Testing**
   ```bash
   npm run test             # Unit tests
   npm run test:e2e         # End-to-end tests
   npm run test:coverage    # Coverage report
   ```

4. **Deployment**
   ```bash
   npm run deploy:staging   # Deploy to staging
   npm run deploy:prod      # Deploy to production
   ```

## Environment Configuration

### Development (.env.local)
```env
NEXT_PUBLIC_FIREBASE_CONFIG={}
FIREBASE_ADMIN_KEY={}
NEXT_PUBLIC_GCP_PROJECT_ID=
GEMINI_API_KEY=
REDIS_URL=
```

### Production (Secret Manager)
All secrets stored in GCP Secret Manager and injected at runtime.



