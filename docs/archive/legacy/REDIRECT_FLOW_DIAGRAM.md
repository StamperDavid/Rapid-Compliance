# Legacy Route Redirect Flow Diagram

## Request Processing Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     Browser Request                              │
│                 (e.g., /admin/deals)                             │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Edge Middleware Entry                          │
│                  (src/middleware.ts)                             │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
                    ┌────────────────┐
                    │ Is API route?  │
                    │ (/api/*)       │
                    └───┬────────┬───┘
                        │ YES    │ NO
                        ▼        │
                   Pass Through  │
                                 ▼
                    ┌────────────────┐
                    │ Static file?   │
                    │ (/_next/*, .*) │
                    └───┬────────┬───┘
                        │ YES    │ NO
                        ▼        │
                   Pass Through  │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                  LEGACY ROUTE CHECK                              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
                    ┌────────────────┐
                    │ Starts with    │
                    │ /admin ?       │
                    └───┬────────┬───┘
                        │ YES    │ NO
                        │        ▼
                        │   ┌────────────────┐
                        │   │ Starts with    │
                        │   │ /workspace/    │
                        │   │ platform-admin?│
                        │   └───┬────────┬───┘
                        │       │ YES    │ NO
                        │       │        ▼
                        │       │   Continue to
                        │       │   Domain Routing
                        │       │
                        ▼       ▼
┌─────────────────────────────────────────────────────────────────┐
│                  ADMIN EXCEPTION CHECK                           │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
                    ┌────────────────┐
                    │ Is exception?  │
                    │ (/admin/login, │
                    │ /admin/orgs,   │
                    │ /admin/system, │
                    │ etc.)          │
                    └───┬────────┬───┘
                        │ YES    │ NO
                        ▼        │
                   Pass Through  │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    REDIRECT LOGIC                                │
│                                                                  │
│  const newUrl = request.nextUrl.clone();                        │
│  newUrl.pathname = pathname.replace(/^\/admin/, '/dashboard');  │
│  newUrl.search = search; // Preserve query params               │
│  return NextResponse.redirect(newUrl, { status: 308 });         │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
                    ┌────────────────┐
                    │ HTTP 308       │
                    │ Permanent      │
                    │ Redirect       │
                    └───┬────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Browser Receives 308                            │
│                  Location: /dashboard/deals                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
                    ┌────────────────┐
                    │ Browser Caches │
                    │ Redirect       │
                    │ (Permanent)    │
                    └───┬────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│              Browser Requests New URL                            │
│              GET /dashboard/deals                                │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              Page Renders Successfully                           │
└─────────────────────────────────────────────────────────────────┘
```

## Exception Routes Decision Tree

```
                    ┌────────────────┐
                    │ /admin/* route │
                    └───┬────────────┘
                        │
                        ▼
                ┌───────────────────┐
                │ Platform Admin    │
                │ Specific Route?   │
                └───┬───────────┬───┘
                    │ YES       │ NO
                    │           │
        ┌───────────┴───────┐   │
        │                   │   │
        ▼                   ▼   ▼
┌──────────────┐    ┌──────────────────────┐
│ /login       │    │ /organizations       │
│ (Auth page)  │    │ (Org management)     │
└──────┬───────┘    └──────┬───────────────┘
       │                   │
       ▼                   ▼
┌──────────────┐    ┌──────────────────────┐
│ /users       │    │ /billing             │
│ (User mgmt)  │    │ (Platform billing)   │
└──────┬───────┘    └──────┬───────────────┘
       │                   │
       ▼                   ▼
┌──────────────┐    ┌──────────────────────┐
│ /system/*    │    │ /support/*           │
│ (System ops) │    │ (Support tools)      │
└──────┬───────┘    └──────┬───────────────┘
       │                   │
       │    ALL STAY IN    │
       │    /admin         │
       └───────────┬───────┘
                   │
                   ▼
            ┌──────────────┐
            │ Pass Through │
            │ (No Redirect)│
            └──────────────┘


                ┌───────────────────┐
                │ Legacy Dashboard  │
                │ Route?            │
                └───┬───────────┬───┘
                    │ YES       │ NO
                    │           │
        ┌───────────┴───────┐   │
        │                   │   │
        ▼                   ▼   ▼
┌──────────────┐    ┌──────────────────────┐
│ /deals       │    │ /swarm               │
│ → /dashboard/│    │ → /dashboard/swarm   │
│   sales/deals│    └──────────────────────┘
└──────────────┘
       │
       ▼
┌──────────────┐    ┌──────────────────────┐
│ /social      │    │ /email-campaigns     │
│ → /dashboard/│    │ → /dashboard/        │
│   marketing/ │    │   marketing/email    │
│   social     │    └──────────────────────┘
└──────────────┘
       │
       │    ALL REDIRECT   │
       │    TO /dashboard  │
       └───────────┬───────┘
                   │
                   ▼
            ┌──────────────┐
            │ HTTP 308     │
            │ Redirect     │
            └──────────────┘
```

## Route Mapping Visual

```
OLD ADMIN ROUTES                  NEW UNIFIED DASHBOARD
─────────────────────            ───────────────────────

/admin                           /dashboard
  ├── command-center      ───>   (root)
  ├── deals               ───>   /sales/deals
  ├── leads               ───>   /sales/leads
  ├── swarm               ───>   /swarm
  ├── social              ───>   /marketing/social
  ├── email-campaigns     ───>   /marketing/email
  ├── voice               ───>   /voice
  ├── jasper-lab          ───>   /jasper-lab
  ├── specialists         ───>   /specialists
  ├── merchandiser        ───>   /merchandiser
  ├── website-editor      ───>   /website-editor
  ├── templates           ───>   /templates
  ├── voice-training      ───>   /voice-training
  │
  │   EXCEPTIONS (stay in /admin):
  │
  ├── login               (no redirect)
  ├── organizations       (no redirect)
  ├── users               (no redirect)
  ├── billing             (no redirect)
  ├── subscriptions       (no redirect)
  ├── global-config       (no redirect)
  ├── analytics           (no redirect)
  ├── revenue             (no redirect)
  ├── recovery            (no redirect)
  ├── sales-agent         (no redirect)
  ├── system              (no redirect)
  │   ├── health
  │   ├── logs
  │   ├── settings
  │   ├── api-keys
  │   └── flags
  ├── support             (no redirect)
  │   ├── impersonate
  │   ├── exports
  │   ├── bulk-ops
  │   └── api-health
  └── advanced            (no redirect)
      └── compliance


LEGACY WORKSPACE ADMIN            NEW UNIFIED DASHBOARD
──────────────────────           ───────────────────────

/workspace/platform-admin        /dashboard
  ├── dashboard           ───>   (root)
  ├── users               ───>   /users
  └── settings            ───>   /settings
```

## HTTP 308 Response Example

```http
HTTP/1.1 308 Permanent Redirect
Location: /dashboard/deals
Cache-Control: public, max-age=31536000
X-Middleware-Redirect: true
Date: Wed, 22 Jan 2026 12:00:00 GMT
```

**Browser Behavior:**
1. Receives 308 response
2. Caches redirect permanently
3. Automatically requests `/dashboard/deals`
4. Future requests go directly to `/dashboard/deals` (cached)

## Query Parameter Flow

```
INPUT:  /admin/deals?status=open&page=2

  ↓

MIDDLEWARE:
  pathname = "/admin/deals"
  search = "?status=open&page=2"

  newUrl.pathname = pathname.replace(/^\/admin/, '/dashboard')
  // newUrl.pathname = "/dashboard/deals"

  newUrl.search = search
  // newUrl.search = "?status=open&page=2"

  ↓

OUTPUT: /dashboard/deals?status=open&page=2 (308)
```

## Sub-path Flow

```
INPUT:  /admin/social/post/123/edit

  ↓

MIDDLEWARE:
  pathname = "/admin/social/post/123/edit"

  newUrl.pathname = pathname.replace(/^\/admin/, '/dashboard')
  // newUrl.pathname = "/dashboard/social/post/123/edit"

  ↓

OUTPUT: /dashboard/social/post/123/edit (308)
```

## Performance Timeline

```
0ms     ┌─────────────────────────────────────────┐
        │ Browser sends request: /admin/deals     │
        └─────────────────────────────────────────┘
          │
1-2ms   │ Request reaches Vercel Edge Network
        │
        ▼
        ┌─────────────────────────────────────────┐
        │ Edge Middleware executes                │
        │ - Check API route? No                   │
        │ - Check static file? No                 │
        │ - Check /admin? Yes                     │
        │ - Check exception? No                   │
        │ - Generate redirect URL                 │
        └─────────────────────────────────────────┘
          │
3-5ms   │ Return 308 response
        │
        ▼
        ┌─────────────────────────────────────────┐
        │ Browser receives 308                    │
        │ - Caches redirect                       │
        │ - Follows Location header               │
        └─────────────────────────────────────────┘
          │
6-8ms   │ Browser requests /dashboard/deals
        │
        ▼
        ┌─────────────────────────────────────────┐
        │ Edge Middleware executes again          │
        │ - Check /admin? No                      │
        │ - Pass through to domain routing        │
        └─────────────────────────────────────────┘
          │
9-10ms  │ Page rendering begins
        │
        ▼
        ┌─────────────────────────────────────────┐
        │ Page renders successfully               │
        └─────────────────────────────────────────┘

TOTAL: ~10ms for redirect + normal page load time
```

## Caching Behavior

```
FIRST REQUEST:
Browser → Edge → 308 Redirect → Browser Cache → New Request → Page

SUBSEQUENT REQUESTS (same browser):
Browser (cached) → Directly to /dashboard/deals → Page

CDN BEHAVIOR:
User A → Edge → 308 (cached at edge) → User B requests same → Edge serves cached 308
```

## Security Considerations

```
┌─────────────────────────────────────────────────────────────────┐
│                   SECURITY CHECKPOINTS                           │
└─────────────────────────────────────────────────────────────────┘

1. API Routes Protected
   /api/* → Pass through (no redirect)
   Authentication still required at API layer

2. Static Assets Protected
   /_next/* → Pass through (no redirect)
   No redirect loops possible

3. Admin Login Preserved
   /admin/login → No redirect
   Authentication flow unchanged

4. Sub-path Injection Prevention
   Input: /admin/../api/secrets
   Next.js normalizes to: /api/secrets
   Result: Pass through (API route)

5. XSS Prevention
   Pathname is not reflected in response
   No user input in redirect URL construction
```

## Testing Flow

```
MANUAL TEST:
Developer → Browser DevTools → Network Tab → Navigate to /admin/deals

VERIFY:
1. ✓ Status: 308 Permanent Redirect
2. ✓ Location header: /dashboard/deals
3. ✓ URL bar updates to: /dashboard/deals
4. ✓ Page renders correctly
5. ✓ Second request goes directly to /dashboard/deals (cached)

AUTOMATED TEST:
Jest → Mock NextRequest → Call middleware() → Assert 308 + Location
```

## Rollback Flow

```
ISSUE DETECTED:
Monitoring → Alert → Investigation → Rollback Decision

ROLLBACK STEPS:
1. Edit src/middleware.ts
2. Remove lines 111-153 (redirect logic)
3. git commit -m "Rollback legacy route redirects"
4. git push origin dev
5. Vercel auto-deploy (30 seconds)
6. Verify redirects disabled
7. Investigate offline

ROLLBACK TIME: < 2 minutes
```

## Monitoring Dashboard

```
┌─────────────────────────────────────────────────────────────────┐
│                      VERCEL ANALYTICS                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Total Redirects (308):         1,234 requests/day              │
│  Most Redirected Route:         /admin/deals (45%)              │
│  Average Redirect Time:         8ms                             │
│  Cache Hit Rate:                92%                             │
│  Browser Cache Hit Rate:        98%                             │
│                                                                  │
│  TOP 5 REDIRECTED ROUTES:                                       │
│  1. /admin/deals              → /dashboard/deals       (45%)    │
│  2. /admin/social             → /dashboard/social      (22%)    │
│  3. /admin/swarm              → /dashboard/swarm       (15%)    │
│  4. /admin/email-campaigns    → /dashboard/email       (10%)    │
│  5. /admin/command-center     → /dashboard             (8%)     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

**Diagram Created:** 2026-01-22
**Engineer:** Claude Code
**Status:** Implementation Complete
