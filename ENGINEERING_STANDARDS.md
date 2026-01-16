# Engineering Standards

> **Status:** ENFORCED | **Last Updated:** 2025-01-15
> **Scope:** All code in `src/app/api/` and all new development

This document codifies the engineering standards established during Operation Absolute Zero. These are non-negotiable requirements for all API development.

---

## 1. Zero `any` Policy

**Rule:** The `any` type is forbidden in all API code.

### Required Pattern: Unknown-to-Interface Casting

```typescript
// CORRECT: Cast unknown through validated interface
const body = (await request.json()) as unknown;
const data = body as CreateLeadRequest;

// WRONG: Using any
const body: any = await request.json(); // FORBIDDEN
```

### Enforcement
- TypeScript strict mode enabled
- ESLint rule `@typescript-eslint/no-explicit-any` set to error
- Pre-commit hooks block commits containing `any` in API routes

---

## 2. Mandatory Zod Validation

**Rule:** All API inputs must be validated with Zod schemas before processing.

### Required Pattern

```typescript
import { z } from 'zod';

// Define schema at module level
const CreateLeadSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  source: z.string().optional(),
});

export async function POST(request: Request) {
  const body = (await request.json()) as unknown;

  // Validate with Zod
  const parseResult = CreateLeadSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parseResult.error.flatten() },
      { status: 400 }
    );
  }

  // Use validated data
  const validatedData = parseResult.data;
  // ... proceed with type-safe data
}
```

### Enforcement
- All POST/PUT/PATCH endpoints require Zod validation
- Schema definitions co-located with route handlers or in `/types/`
- Validation errors return 400 with structured error details

---

## 3. Next.js 15 Async Params

**Rule:** All route parameters and search params must be awaited.

### Required Pattern

```typescript
// CORRECT: Await params in Next.js 15
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // ... use id
}

// WRONG: Synchronous access (Next.js 14 pattern)
export async function GET(
  request: Request,
  { params }: { params: { id: string } }  // FORBIDDEN
) {
  const { id } = params;  // Will cause runtime errors
}
```

### SearchParams Pattern

```typescript
export async function GET(request: Request) {
  const searchParams = await request.nextUrl.searchParams;
  const page = searchParams.get('page') ?? '1';
}
```

### Enforcement
- Build will fail on synchronous param access
- Pre-commit hooks check for non-awaited params patterns

---

## 4. Service Layer Architecture

**Rule:** API routes must delegate business logic to the service layer.

### Architecture

```
API Route (src/app/api/*)
    ↓ Validates input (Zod)
    ↓ Authenticates request
    ↓ Calls service layer
Service Layer (src/lib/db/*)
    ↓ Implements business logic
    ↓ Handles database operations
    ↓ Returns typed responses
```

### Required Pattern

```typescript
// API Route - Thin controller
export async function POST(request: Request) {
  // 1. Validate
  const body = (await request.json()) as unknown;
  const parseResult = Schema.safeParse(body);
  if (!parseResult.success) return validationError(parseResult.error);

  // 2. Authenticate
  const authResult = await authenticateRequest(request);
  if (!authResult.success) return unauthorizedError();

  // 3. Delegate to service
  const result = await LeadService.create(
    authResult.organizationId,
    parseResult.data
  );

  return NextResponse.json(result);
}

// Service Layer - Business logic
export class LeadService {
  static async create(orgId: string, data: CreateLeadInput): Promise<Lead> {
    // All business logic here
    // Database operations here
    // Returns typed data
  }
}
```

### Enforcement
- API routes should not contain direct Firestore calls
- Business logic belongs in service classes
- Services return typed interfaces, not raw Firestore documents

---

## 5. Error Handling Standards

**Rule:** All errors must be caught and returned with appropriate status codes.

### Required Pattern

```typescript
export async function POST(request: Request) {
  try {
    // ... route logic
  } catch (error) {
    logger.error('Operation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### Status Code Guide
- `400` - Validation errors, malformed requests
- `401` - Authentication required
- `403` - Authorization denied
- `404` - Resource not found
- `500` - Internal server errors (log details, return generic message)

---

## 6. Authentication Pattern

**Rule:** All non-public endpoints must verify authentication.

### Required Pattern

```typescript
import { authenticateRequest } from '@/lib/auth/api-auth';

export async function GET(request: Request) {
  const authResult = await authenticateRequest(request);

  if (!authResult.success) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const { userId, organizationId } = authResult;
  // ... proceed with authenticated request
}
```

---

## 7. Pre-Commit Guardrails

**Enforcement Layer:** Husky + lint-staged

### Hooks Active
- `pre-commit`: Runs ESLint and TypeScript checks on staged files
- Blocks commits with:
  - `any` type usage in API routes
  - TypeScript errors
  - ESLint errors (configurable warnings)

### GitHub Actions
- CI pipeline runs full type check on all PRs
- API integrity checks validate zero `any` types
- Build must pass before merge

---

## 8. File Organization

### API Routes
```
src/app/api/
├── [domain]/
│   ├── route.ts          # Collection endpoints (GET list, POST create)
│   └── [id]/
│       └── route.ts      # Resource endpoints (GET one, PUT, DELETE)
```

### Service Layer
```
src/lib/db/
├── [domain]-service.ts   # Service class with static methods
└── index.ts              # Re-exports all services
```

### Types
```
src/types/
├── [domain].ts           # Domain-specific types and Zod schemas
└── index.ts              # Re-exports
```

---

## Compliance Checklist

When creating or modifying API routes, verify:

- [ ] No `any` types used
- [ ] Request body cast as `unknown` then validated with Zod
- [ ] Route params are awaited (`await params`)
- [ ] Business logic delegated to service layer
- [ ] Errors caught and logged appropriately
- [ ] Authentication verified for protected routes
- [ ] TypeScript compiles without errors
- [ ] Pre-commit hooks pass

---

## Verification Commands

```bash
# Check for any types in API directory
grep -r "any" src/app/api/ --include="*.ts" | grep -v node_modules

# Run TypeScript check
npx tsc --noEmit

# Run ESLint on API routes
npx eslint src/app/api/ --ext .ts,.tsx

# Full pre-commit simulation
npm run lint && npm run type-check
```

---

*Established: 2025-01-15 | Operation Absolute Zero*
*Maintained by: Engineering Team*
