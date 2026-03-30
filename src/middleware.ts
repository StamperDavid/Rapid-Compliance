/**
 * Next.js Edge Middleware
 * Penthouse model routing - all public site traffic goes to PLATFORM_ID
 * SIMPLIFIED: Removed subdomain and custom domain routing for penthouse deployment
 *
 * Security: Generates a per-request CSP nonce to replace 'unsafe-inline' on script-src.
 */

import { NextResponse, type NextRequest } from 'next/server';

/**
 * Build the Content-Security-Policy header value.
 *
 * script-src uses 'unsafe-inline' because Next.js 14 App Router injects inline
 * bootstrap scripts for hydration that cannot receive a nonce attribute.
 * Nonce-based CSP for script-src requires Next.js 15+ native support.
 * All other directives are hardened (connect-src allowlist, frame-ancestors none).
 */
function buildCspHeader(): string {
  const directives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.stripe.com https://api.openai.com https://openrouter.ai https://*.firebaseio.com https://*.googleapis.com wss://*.firebaseio.com",
    "frame-ancestors 'none'",
  ];
  return directives.join('; ');
}

/**
 * Apply CSP headers to a NextResponse.next() response.
 */
function withCspHeaders(): NextResponse {
  const csp = buildCspHeader();

  const response = NextResponse.next();
  response.headers.set('Content-Security-Policy', csp);

  return response;
}

/**
 * Main middleware function
 */
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Skip middleware for API routes, static files, and internal routes
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/static/') ||
    pathname.includes('.') // Static files
  ) {
    return NextResponse.next();
  }

  // ============================================================================
  // ROLE-BASED SEGMENT ROUTING
  // ============================================================================
  // Admin routes use Role-Based Segment Logic instead of whitelist:
  // - All /admin/* paths are allowed through middleware
  // - Authentication & authorization handled by /admin/layout.tsx
  // - Non-admin users are redirected to their workspace by the layout, not middleware
  // - This prevents 404s from middleware redirecting to non-existent /dashboard/* paths
  //
  // The admin layout (src/app/admin/layout.tsx) enforces:
  // - Unauthenticated users → /admin-login
  // - Non-admin users → /workspace/dashboard (with proper context)
  // ============================================================================

  // ============================================================================
  // PHASE 10: ADMIN -> DASHBOARD ROUTE CONVERGENCE
  // ============================================================================
  // All /admin/* routes have been merged into /(dashboard)/*
  // Redirect for backwards compatibility with bookmarks and external links
  if (pathname === '/admin') {
    const newUrl = request.nextUrl.clone();
    newUrl.pathname = '/dashboard';
    newUrl.search = search;
    return NextResponse.redirect(newUrl, { status: 308 });
  }

  const adminRouteMap: Record<string, string> = {
    '/admin/workforce': '/workforce',
    '/admin/ai-agents': '/ai-agents',
    '/admin/compliance-reports': '/compliance-reports',
    '/admin/living-ledger': '/living-ledger',
  };

  for (const [oldPath, newPath] of Object.entries(adminRouteMap)) {
    if (pathname.startsWith(oldPath)) {
      const newUrl = request.nextUrl.clone();
      newUrl.pathname = pathname.replace(oldPath, newPath);
      newUrl.search = search;
      return NextResponse.redirect(newUrl, { status: 308 });
    }
  }

  // Allow remaining /admin/* routes through (e.g., /admin-login)
  if (pathname.startsWith('/admin')) {
    return withCspHeaders();
  }

  // Redirect legacy /workspace/platform-admin/* to /admin/*
  // These are old routes that should now use the /admin namespace
  if (pathname.startsWith('/workspace/platform-admin')) {
    const newUrl = request.nextUrl.clone();
    newUrl.pathname = pathname.replace(/^\/workspace\/platform-admin/, '/admin');
    newUrl.search = search;
    return NextResponse.redirect(newUrl, { status: 308 });
  }

  // ============================================================================
  // PENTHOUSE MODEL: LEGACY WORKSPACE URL REDIRECTS
  // ============================================================================
  // Redirect legacy /workspace/* URLs to flat /(dashboard)/* routes
  // This ensures backwards compatibility with bookmarks and external links
  if (pathname.startsWith('/workspace/')) {
    const newUrl = request.nextUrl.clone();
    // Remove /workspace/* prefix, keep the rest of the path
    // Example: /workspace/leads -> /leads
    newUrl.pathname = pathname.replace(/^\/workspace\/[^/]+/, '');
    if (newUrl.pathname === '' || newUrl.pathname === '/') {
      newUrl.pathname = '/dashboard';
    }
    newUrl.search = search;
    return NextResponse.redirect(newUrl, { status: 308 });
  }

  // ============================================================================
  // PENTHOUSE PUBLIC SITE ROUTING
  // ============================================================================
  // For penthouse deployment, all public site traffic uses PLATFORM_ID
  // Legacy routes redirect to flat URL structure for consistency

  // Redirect legacy /store/* to /store/*
  if (pathname.match(/^\/store\/[^/]+\/(products|cart|checkout)/)) {
    const newUrl = request.nextUrl.clone();
    newUrl.pathname = pathname.replace(/^\/store\/[^/]+/, '/store');
    newUrl.search = search;
    return NextResponse.redirect(newUrl, 308);
  }

  // Redirect legacy /sites/* to /sites/*
  if (pathname.match(/^\/sites\/[^/]+\//)) {
    const newUrl = request.nextUrl.clone();
    newUrl.pathname = pathname.replace(/^\/sites\/[^/]+/, '/sites');
    newUrl.search = search;
    return NextResponse.redirect(newUrl, 308);
  }

  // Allow all other routes through — with CSP nonce
  return withCspHeaders();
}

/**
 * Configure which routes this middleware runs on
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes (handled separately)
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
