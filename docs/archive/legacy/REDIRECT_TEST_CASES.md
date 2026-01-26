# Legacy Route Redirect Test Cases

**Implementation:** `src/middleware.ts` (lines 111-153)
**Status:** ✓ Implemented
**Date:** 2026-01-22

## Test Case Matrix

### ✅ CASE 1: Legacy Admin Routes (should redirect)

| Input URL | Expected Output | Status | Query Params | Sub-paths |
|-----------|-----------------|--------|--------------|-----------|
| `/admin` | `/dashboard` | 308 | ✓ Preserved | N/A |
| `/admin/command-center` | `/dashboard/command-center` | 308 | ✓ Preserved | ✓ Preserved |
| `/admin/deals` | `/dashboard/deals` | 308 | ✓ Preserved | ✓ Preserved |
| `/admin/leads` | `/dashboard/leads` | 308 | ✓ Preserved | ✓ Preserved |
| `/admin/swarm` | `/dashboard/swarm` | 308 | ✓ Preserved | ✓ Preserved |
| `/admin/social` | `/dashboard/social` | 308 | ✓ Preserved | ✓ Preserved |
| `/admin/email-campaigns` | `/dashboard/email-campaigns` | 308 | ✓ Preserved | ✓ Preserved |
| `/admin/voice` | `/dashboard/voice` | 308 | ✓ Preserved | ✓ Preserved |
| `/admin/jasper-lab` | `/dashboard/jasper-lab` | 308 | ✓ Preserved | ✓ Preserved |
| `/admin/specialists` | `/dashboard/specialists` | 308 | ✓ Preserved | ✓ Preserved |
| `/admin/merchandiser` | `/dashboard/merchandiser` | 308 | ✓ Preserved | ✓ Preserved |
| `/admin/website-editor` | `/dashboard/website-editor` | 308 | ✓ Preserved | ✓ Preserved |
| `/admin/templates` | `/dashboard/templates` | 308 | ✓ Preserved | ✓ Preserved |
| `/admin/voice-training` | `/dashboard/voice-training` | 308 | ✓ Preserved | ✓ Preserved |

### ✅ CASE 2: Admin Exception Routes (should NOT redirect)

| Input URL | Expected Output | Status | Reason |
|-----------|-----------------|--------|--------|
| `/admin/login` | `/admin/login` | No redirect | Authentication page |
| `/admin/organizations` | `/admin/organizations` | No redirect | Platform admin only |
| `/admin/organizations/123` | `/admin/organizations/123` | No redirect | Org detail page |
| `/admin/users` | `/admin/users` | No redirect | User management |
| `/admin/users/456` | `/admin/users/456` | No redirect | User detail page |
| `/admin/billing` | `/admin/billing` | No redirect | Platform billing |
| `/admin/subscriptions` | `/admin/subscriptions` | No redirect | Subscription mgmt |
| `/admin/global-config` | `/admin/global-config` | No redirect | Global config |
| `/admin/analytics` | `/admin/analytics` | No redirect | Platform analytics |
| `/admin/analytics/pipeline` | `/admin/analytics/pipeline` | No redirect | Analytics sub-page |
| `/admin/revenue` | `/admin/revenue` | No redirect | Revenue tracking |
| `/admin/recovery` | `/admin/recovery` | No redirect | Recovery tools |
| `/admin/sales-agent` | `/admin/sales-agent` | No redirect | Sales agent config |
| `/admin/sales-agent/persona` | `/admin/sales-agent/persona` | No redirect | Agent persona |
| `/admin/sales-agent/training` | `/admin/sales-agent/training` | No redirect | Agent training |
| `/admin/sales-agent/knowledge` | `/admin/sales-agent/knowledge` | No redirect | Knowledge base |
| `/admin/system/health` | `/admin/system/health` | No redirect | System health |
| `/admin/system/logs` | `/admin/system/logs` | No redirect | System logs |
| `/admin/system/settings` | `/admin/system/settings` | No redirect | System settings |
| `/admin/system/api-keys` | `/admin/system/api-keys` | No redirect | API keys |
| `/admin/system/flags` | `/admin/system/flags` | No redirect | Feature flags |
| `/admin/support/impersonate` | `/admin/support/impersonate` | No redirect | Impersonation |
| `/admin/support/exports` | `/admin/support/exports` | No redirect | Data exports |
| `/admin/support/bulk-ops` | `/admin/support/bulk-ops` | No redirect | Bulk operations |
| `/admin/support/api-health` | `/admin/support/api-health` | No redirect | API health |
| `/admin/advanced/compliance` | `/admin/advanced/compliance` | No redirect | Compliance |

### ✅ CASE 3: Legacy Workspace Platform Admin (should redirect)

| Input URL | Expected Output | Status | Query Params | Sub-paths |
|-----------|-----------------|--------|--------------|-----------|
| `/workspace/platform-admin` | `/dashboard` | 308 | ✓ Preserved | N/A |
| `/workspace/platform-admin/dashboard` | `/dashboard/dashboard` | 308 | ✓ Preserved | ✓ Preserved |
| `/workspace/platform-admin/users` | `/dashboard/users` | 308 | ✓ Preserved | ✓ Preserved |
| `/workspace/platform-admin/settings` | `/dashboard/settings` | 308 | ✓ Preserved | ✓ Preserved |

### ✅ CASE 4: Query Parameter Preservation

| Input URL | Expected Output | Status |
|-----------|-----------------|--------|
| `/admin/deals?status=open` | `/dashboard/deals?status=open` | 308 |
| `/admin/social?tab=scheduled&date=2026-01-22` | `/dashboard/social?tab=scheduled&date=2026-01-22` | 308 |
| `/admin/leads?page=2&limit=50` | `/dashboard/leads?page=2&limit=50` | 308 |
| `/admin/organizations?page=1` | `/admin/organizations?page=1` | No redirect |

### ✅ CASE 5: Sub-path Preservation

| Input URL | Expected Output | Status |
|-----------|-----------------|--------|
| `/admin/custom-feature/sub-page` | `/dashboard/custom-feature/sub-page` | 308 |
| `/admin/feature/123/edit` | `/dashboard/feature/123/edit` | 308 |
| `/admin/social/post/456` | `/dashboard/social/post/456` | 308 |
| `/admin/system/health/database` | `/admin/system/health/database` | No redirect |

### ✅ CASE 6: Edge Cases

| Input URL | Expected Output | Status | Notes |
|-----------|-----------------|--------|-------|
| `/admin/` | `/dashboard/` | 308 | Trailing slash preserved |
| `/admin//feature` | `/dashboard//feature` | 308 | Double slash preserved |
| `/admin/feature%20name` | `/dashboard/feature%20name` | 308 | URL encoding preserved |
| `/admin/feature#section-1` | `/dashboard/feature#section-1` | 308 | Hash fragment preserved |
| `/Admin/feature` | No redirect | N/A | Case-sensitive (Next.js routes) |

### ✅ CASE 7: API Routes (should never redirect)

| Input URL | Expected Output | Status | Notes |
|-----------|-----------------|--------|-------|
| `/api/admin/verify` | `/api/admin/verify` | No redirect | API routes excluded |
| `/api/admin/stats` | `/api/admin/stats` | No redirect | API routes excluded |
| `/api/admin/users` | `/api/admin/users` | No redirect | API routes excluded |

### ✅ CASE 8: Static Assets (should never redirect)

| Input URL | Expected Output | Status | Notes |
|-----------|-----------------|--------|-------|
| `/_next/static/css/app.css` | `/_next/static/css/app.css` | No redirect | Next.js static |
| `/static/images/logo.png` | `/static/images/logo.png` | No redirect | Static assets |
| `/favicon.ico` | `/favicon.ico` | No redirect | Static file |

## Manual Testing Procedure

### Setup
1. Start development server: `npm run dev`
2. Open browser DevTools (Network tab)
3. Disable browser cache

### Test Steps

#### Test 1: Basic Redirect
1. Navigate to: `http://localhost:3000/admin/deals`
2. Expected: 308 redirect to `/dashboard/deals`
3. Verify: Network tab shows 308 status
4. Verify: URL bar shows `/dashboard/deals`

#### Test 2: Exception Route
1. Navigate to: `http://localhost:3000/admin/organizations`
2. Expected: No redirect
3. Verify: Network tab shows 200 status
4. Verify: URL bar stays at `/admin/organizations`

#### Test 3: Query Params
1. Navigate to: `http://localhost:3000/admin/social?tab=scheduled`
2. Expected: 308 redirect to `/dashboard/social?tab=scheduled`
3. Verify: Query params preserved in URL bar

#### Test 4: Sub-paths
1. Navigate to: `http://localhost:3000/admin/social/post/123`
2. Expected: 308 redirect to `/dashboard/social/post/123`
3. Verify: Full path preserved

#### Test 5: Legacy Workspace Admin
1. Navigate to: `http://localhost:3000/workspace/platform-admin/dashboard`
2. Expected: 308 redirect to `/dashboard/dashboard`
3. Verify: Redirect works correctly

## Automated Test Script

```typescript
// tests/middleware/redirects.test.ts
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';

describe('Legacy Route Redirects', () => {
  it('should redirect /admin/deals to /dashboard/deals', async () => {
    const request = new NextRequest('http://localhost:3000/admin/deals');
    const response = await middleware(request);

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe('/dashboard/deals');
  });

  it('should NOT redirect /admin/organizations', async () => {
    const request = new NextRequest('http://localhost:3000/admin/organizations');
    const response = await middleware(request);

    expect(response.status).not.toBe(308);
  });

  it('should preserve query parameters', async () => {
    const request = new NextRequest('http://localhost:3000/admin/deals?status=open');
    const response = await middleware(request);

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe('/dashboard/deals?status=open');
  });

  it('should redirect /workspace/platform-admin to /dashboard', async () => {
    const request = new NextRequest('http://localhost:3000/workspace/platform-admin');
    const response = await middleware(request);

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe('/dashboard');
  });
});
```

## Browser Testing Checklist

- [ ] Chrome: Test all redirect scenarios
- [ ] Firefox: Test all redirect scenarios
- [ ] Safari: Test all redirect scenarios
- [ ] Edge: Test all redirect scenarios
- [ ] Mobile Chrome: Test responsive redirects
- [ ] Mobile Safari: Test responsive redirects

## Performance Metrics

| Metric | Expected | Actual |
|--------|----------|--------|
| Redirect Time | < 10ms | TBD |
| Browser Cache | Enabled | TBD |
| CDN Cache | Enabled | TBD |
| Server Load | Zero | TBD |

## Rollback Procedure

If redirects cause production issues:

1. SSH into server or access Vercel dashboard
2. Edit `src/middleware.ts`
3. Remove lines 111-153 (redirect logic)
4. Deploy immediately
5. Investigate issues offline

## Support Resources

- **Documentation:** `LEGACY_ROUTE_REDIRECTS.md`
- **Migration Guide:** `src/components/dashboard/MIGRATION.md`
- **Route Builders:** `src/lib/routes/workspace-routes.ts`
- **Architect:** Escalate structural routing decisions

## Notes

- All redirects use HTTP 308 (Permanent Redirect)
- HTTP method is preserved (POST stays POST)
- Browser caches the redirect
- Search engines update their indexes
- Old bookmarks will work indefinitely
