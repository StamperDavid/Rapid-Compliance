# Single-Tenant Conversion - Continuation Prompt

## Context
Repository: https://github.com/StamperDavid/Rapid-Compliance
Branch: dev
Last Commit: `62642bd3 feat: implement single-tenant conversion (Phases 1, 2, 5)`

## What Was Completed

### Phase 1: Constants & Types ✅
- Added `DEFAULT_ORG_ID = 'default-org'` to `src/lib/constants/platform.ts`
- Converted RBAC from 5-level to 4-level: `superadmin | admin | manager | employee`
- Updated `src/types/unified-rbac.ts` with new hierarchy
- Simplified `src/types/organization.ts` (removed workspace interfaces)

### Phase 2: Auth Simplification ✅
- `src/lib/auth/claims-validator.ts` - uses DEFAULT_ORG_ID
- `src/lib/auth/api-auth.ts` - simplified for single-tenant
- `src/hooks/useUnifiedAuth.ts` - role migration added

### Phase 5: AI Agents ✅
- `src/lib/ai/tenant-context-wrapper.ts` - updated
- `src/lib/agents/shared/tenant-memory-vault.ts` - updated

### Also Fixed
- 32 files updated with RBAC role changes (platform_admin → superadmin, owner → superadmin)
- All type-check and lint passing

## What Remains

### Phase 3: Route Restructuring (MAJOR)
- Rename `src/app/workspace/[orgId]/` → `src/app/workspace/`
- Update all 95 page files to remove `params.orgId` extraction
- Update `src/lib/routes/workspace-routes.ts` to remove orgId parameter

### Phase 4: Database Layer
- Update `src/lib/firebase/admin-dal.ts` - remove workspace methods
- Update `src/lib/firebase/collections.ts` - remove getWorkspaceSubCollection()
- Update `firestore.rules` - simplify org checks

### Phase 6: UI Cleanup
- Delete admin organization browser routes (see SSOT for full list)
- Keep only `settings/page.tsx` and `integrations/page.tsx`
- Update `/sites/[orgId]/*` and `/store/[orgId]/*` routes

### Phase 7: Middleware
- Update `src/middleware.ts` - remove subdomain-based org lookup

### Phase 8: Verification
- Run full test suite (lint, type-check, build)
- Update SSOT with completion status
- Commit and push

## Conversion Parameters (Already Decided)
- Workspaces: Flatten entirely
- Data: Fresh start (no migration)
- Admin Panel: Simplify heavily
- Public Features: Keep both /sites/ and /store/
- RBAC: 4-level hierarchy (superadmin → admin → manager → employee)

## Instructions for Next Session

```
Continue the Single-Tenant Conversion project.

Read CLAUDE.md first, then docs/single_source_of_truth.md (specifically the "Single-Tenant Conversion Plan" section).

Previous session completed Phases 1, 2, and 5. Continue with Phase 3 (Route Restructuring) or Phase 4 (Database Layer).

Phase 3 is the largest task - renaming 95 workspace pages from /workspace/[orgId]/* to /workspace/*.
```
