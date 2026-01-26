/**
 * Next.js Edge Middleware
 * Handles subdomain and custom domain routing for multi-tenant website builder
 * CRITICAL: Isolates organizations - ensures Org A cannot access Org B's site
 */

import { NextResponse, type NextRequest } from 'next/server';

// Cache for subdomain → organizationId mapping (in production, use Redis/Vercel KV)
const subdomainCache = new Map<string, string>();
const customDomainCache = new Map<string, string>();

/**
 * API Response Types
 */
interface SubdomainApiResponse {
  success: boolean;
  organizationId: string;
  subdomain: string;
}

interface DomainApiResponse {
  success: boolean;
  organizationId: string;
  domain: string;
  verified: boolean;
  sslEnabled: boolean;
}

/**
 * Get organization ID from subdomain
 * Format: {subdomain}.yourplatform.com → organizationId
 */
async function getOrgBySubdomain(subdomain: string): Promise<string | null> {
  // Check cache first
  if (subdomainCache.has(subdomain)) {
    return subdomainCache.get(subdomain) ?? null;
  }

  try {
    // Query Firestore for subdomain mapping
    // In production, this should be cached in Redis/Vercel KV for performance
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/website/subdomain/${subdomain}`,
      {
        method: 'GET',
        headers: {
          'x-middleware-request': 'true',
        },
      }
    );

    if (response.ok) {
      const data = await response.json() as SubdomainApiResponse;
      const orgId: string = data.organizationId;

      // Cache for 5 minutes
      subdomainCache.set(subdomain, orgId);
      setTimeout(() => subdomainCache.delete(subdomain), 5 * 60 * 1000);

      return orgId;
    }

    return null;
  } catch (error) {
    console.error('[Middleware] Failed to fetch org by subdomain:', error);
    return null;
  }
}

/**
 * Get organization ID from custom domain
 * Format: www.acme.com → organizationId
 */
async function getOrgByCustomDomain(domain: string): Promise<string | null> {
  // Check cache first
  if (customDomainCache.has(domain)) {
    return customDomainCache.get(domain) ?? null;
  }

  try {
    // Query Firestore for custom domain mapping
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/website/domain/${encodeURIComponent(domain)}`,
      {
        method: 'GET',
        headers: {
          'x-middleware-request': 'true',
        },
      }
    );

    if (response.ok) {
      const data = await response.json() as DomainApiResponse;
      const orgId: string = data.organizationId;

      // Cache for 5 minutes
      customDomainCache.set(domain, orgId);
      setTimeout(() => customDomainCache.delete(domain), 5 * 60 * 1000);

      return orgId;
    }

    return null;
  } catch (error) {
    console.error('[Middleware] Failed to fetch org by domain:', error);
    return null;
  }
}

/**
 * Main middleware function
 */
export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hostname = request.headers.get('host') ?? '';

  // Skip middleware for API routes, static files, and internal routes
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/static/') ||
    pathname.includes('.') // Static files
  ) {
    return NextResponse.next();
  }

  // LEGACY ROUTE REDIRECTS (308 Permanent Redirect)
  // Redirect old admin routes to new unified dashboard
  if (pathname.startsWith('/admin')) {
    const newUrl = request.nextUrl.clone();

    // All admin routes that should stay in /admin namespace (not redirect to /dashboard)
    // This includes ALL actual admin routes to prevent 404 redirects
    const adminExceptions = [
      '/admin', // Root admin page
      '/admin/login',
      '/admin/organizations',
      '/admin/users',
      '/admin/billing',
      '/admin/subscriptions',
      '/admin/global-config',
      '/admin/analytics',
      '/admin/revenue',
      '/admin/recovery',
      '/admin/sales-agent',
      '/admin/system',
      '/admin/support',
      '/admin/advanced',
      // Additional admin routes discovered in codebase
      '/admin/customers',
      '/admin/growth',
      '/admin/pricing-tiers',
      '/admin/settings',
      '/admin/website-editor',
      '/admin/social',
      '/admin/command-center',
      '/admin/deals',
      '/admin/email-campaigns',
      '/admin/jasper-lab',
      '/admin/leads',
      '/admin/specialists',
      '/admin/voice-training',
      '/admin/swarm',
      '/admin/merchandiser',
      '/admin/templates',
      '/admin/voice',
    ];

    // Check if the path should stay in /admin
    const shouldStayInAdmin = adminExceptions.some((exception) =>
      pathname === exception || pathname.startsWith(`${exception}/`)
    );

    if (!shouldStayInAdmin) {
      // Redirect /admin/* to /dashboard/* (preserving sub-paths and query params)
      newUrl.pathname = pathname.replace(/^\/admin/, '/dashboard');
      newUrl.search = search;
      return NextResponse.redirect(newUrl, { status: 308 });
    }
  }

  // Redirect legacy workspace platform-admin routes to new dashboard
  if (pathname.startsWith('/workspace/platform-admin')) {
    const newUrl = request.nextUrl.clone();
    // /workspace/platform-admin/* → /dashboard/*
    newUrl.pathname = pathname.replace(/^\/workspace\/platform-admin/, '/dashboard');
    newUrl.search = search;
    return NextResponse.redirect(newUrl, { status: 308 });
  }

  // Get the base domain from environment
  const baseDomain =(process.env.NEXT_PUBLIC_BASE_DOMAIN !== '' && process.env.NEXT_PUBLIC_BASE_DOMAIN != null) ? process.env.NEXT_PUBLIC_BASE_DOMAIN : 'localhost:3000';
  const isLocalhost = hostname.includes('localhost');
  const isVercelDeployment = hostname.includes('.vercel.app');
  const isPlatformDomain = hostname.includes('salesvelocity.ai');

  // CASE 1: Custom Domain (e.g., www.acme.com)
  // Skip middleware for Vercel preview/production deployments and main platform domain
  if (!hostname.includes(baseDomain) && !isLocalhost && !isVercelDeployment && !isPlatformDomain) {
    // Force HTTPS for custom domains in production
    const protocol = request.headers.get('x-forwarded-proto');
    if (protocol === 'http' && process.env.NODE_ENV === 'production') {
      const httpsUrl = request.nextUrl.clone();
      httpsUrl.protocol = 'https:';
      return NextResponse.redirect(httpsUrl, { status: 301 });
    }

    const orgId = await getOrgByCustomDomain(hostname);

    if (!orgId) {
      // Custom domain not found or not verified
      return new NextResponse(
        `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Site Not Found</title>
            <style>
              body { 
                font-family: system-ui; 
                display: flex; 
                align-items: center; 
                justify-content: center; 
                min-height: 100vh; 
                margin: 0;
                background: #f5f5f5;
              }
              .error { 
                text-align: center; 
                padding: 2rem;
                background: white;
                border-radius: 8px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
              }
              h1 { color: #333; margin: 0 0 1rem; }
              p { color: #666; margin: 0; }
            </style>
          </head>
          <body>
            <div class="error">
              <h1>Site Not Found</h1>
              <p>This domain is not configured or verified.</p>
            </div>
          </body>
        </html>
        `,
        {
          status: 404,
          headers: { 'content-type': 'text/html' },
        }
      );
    }

    // CRITICAL: Rewrite to org-scoped public site route
    // Custom domain traffic sees the public site for this org
    const url = request.nextUrl.clone();
    url.pathname = `/sites/${orgId}${pathname}`;
    url.search = search;

    return NextResponse.rewrite(url);
  }

  // CASE 2: Subdomain (e.g., acme.yourplatform.com)
  const subdomain = hostname.split('.')[0];

  // Skip if on main domain (no subdomain) or Vercel deployment
  if (
    !subdomain ||
    subdomain === 'www' ||
    subdomain === baseDomain.split('.')[0] ||
    isLocalhost ||
    isVercelDeployment
  ) {
    return NextResponse.next();
  }

  // Reserved subdomains (admin, api, app, etc.)
  const reservedSubdomains = [
    'admin',
    'api',
    'app',
    'www',
    'mail',
    'ftp',
    'smtp',
    'preview',
    'cdn',
    'assets',
  ];

  if (reservedSubdomains.includes(subdomain)) {
    return NextResponse.next();
  }

  // Get organization by subdomain
  const orgId = await getOrgBySubdomain(subdomain);

  if (!orgId) {
    // Subdomain not found
    return new NextResponse(
      `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Site Not Found</title>
          <style>
            body { 
              font-family: system-ui; 
              display: flex; 
              align-items: center; 
              justify-content: center; 
              min-height: 100vh; 
              margin: 0;
              background: #f5f5f5;
            }
            .error { 
              text-align: center; 
              padding: 2rem;
              background: white;
              border-radius: 8px;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            h1 { color: #333; margin: 0 0 1rem; }
            p { color: #666; margin: 0; }
          </style>
        </head>
        <body>
          <div class="error">
            <h1>Site Not Found</h1>
            <p>The subdomain "${subdomain}" does not exist.</p>
          </div>
        </body>
      </html>
      `,
      {
        status: 404,
        headers: { 'content-type': 'text/html' },
      }
    );
  }

  // CRITICAL: Rewrite to org-scoped public site route
  const url = request.nextUrl.clone();
  url.pathname = `/sites/${orgId}${pathname}`;
  url.search = search;

  return NextResponse.rewrite(url);
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

