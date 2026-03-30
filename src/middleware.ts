/**
 * Next.js Edge Middleware
 * Penthouse model routing - all public site traffic goes to PLATFORM_ID
 * SIMPLIFIED: Removed subdomain and custom domain routing for penthouse deployment
 *
 * Security: Generates a per-request CSP nonce to replace 'unsafe-inline' on script-src.
 */

import { NextResponse, type NextRequest } from 'next/server';

/**
 * Build the Content-Security-Policy header value with a per-request nonce.
 * 'strict-dynamic' allows scripts loaded by nonce-bearing scripts (needed for
 * Next.js chunk loading). style-src keeps 'unsafe-inline' (required by Tailwind
 * and inline style attributes — no practical nonce path for CSS-in-JS).
 */
function buildCspHeader(nonce: string): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.stripe.com https://api.openai.com https://openrouter.ai https://*.firebaseio.com https://*.googleapis.com wss://*.firebaseio.com",
    "frame-ancestors 'none'",
  ];
  return directives.join('; ');
}

/**
 * Apply CSP + nonce headers to a NextResponse.next() response.
 * The x-nonce header lets layout.tsx read the nonce via headers().
 */
function withCspHeaders(nonce: string): NextResponse {
  const csp = buildCspHeader(nonce);

  const requestHeaders = new Headers();
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('x-nonce', nonce);

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

  // Generate a per-request nonce for CSP (base64-encoded random UUID)
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

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
    return withCspHeaders(nonce);
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
  return withCspHeaders(nonce);
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
