/**
 * Next.js Edge Middleware
 * Single-tenant routing - all public site traffic goes to DEFAULT_ORG_ID
 * SIMPLIFIED: Removed subdomain and custom domain routing for single-tenant deployment
 */

import { NextResponse, type NextRequest } from 'next/server';

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
  // - Non-superadmin users → /workspace/{orgId}/dashboard (with proper context)
  // ============================================================================

  // Allow all /admin/* routes through - let layout handle auth
  if (pathname.startsWith('/admin')) {
    return NextResponse.next();
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
  // SINGLE-TENANT PUBLIC SITE ROUTING
  // ============================================================================
  // For single-tenant deployment, all public site traffic uses DEFAULT_ORG_ID
  // The /sites/[orgId] routes still exist for URL compatibility but always use
  // the same organization internally

  // Allow all other routes through
  return NextResponse.next();
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
