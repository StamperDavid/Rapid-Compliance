/**
 * Security Headers Middleware
 * Industry Best Practice: OWASP recommended security headers
 */

import type { NextResponse } from 'next/server';

/**
 * Add security headers to response.
 * Based on OWASP best practices.
 *
 * CSP is now applied by Edge Middleware (src/middleware.ts) with a per-request
 * nonce. This function adds the remaining non-CSP security headers and can be
 * called from API routes or other server contexts that need them.
 *
 * @param nonce — Optional CSP nonce. When provided, script-src uses the nonce
 *   instead of 'unsafe-inline'. Omit for contexts where the middleware already
 *   sets CSP (i.e. page responses).
 */
export function addSecurityHeaders(response: NextResponse, nonce?: string): NextResponse {
  // Prevent clickjacking
  response.headers.set('X-Frame-Options', 'DENY');

  // Prevent MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // XSS Protection (legacy but still useful)
  response.headers.set('X-XSS-Protection', '1; mode=block');

  // Referrer Policy (privacy)
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions Policy (formerly Feature Policy)
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(self), geolocation=()'
  );

  // Content Security Policy (CSP)
  // Nonce-based: 'strict-dynamic' allows scripts loaded by trusted (nonce-bearing) scripts.
  // style-src keeps 'unsafe-inline' (required by Tailwind and inline style attributes).
  const scriptSrc = nonce
    ? `'self' 'nonce-${nonce}' 'strict-dynamic'`
    : "'self' 'strict-dynamic'";

  const csp = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.stripe.com https://api.openai.com https://openrouter.ai https://*.firebaseio.com https://*.googleapis.com wss://*.firebaseio.com",
    "frame-ancestors 'none'",
  ].join('; ');

  response.headers.set('Content-Security-Policy', csp);

  // Strict Transport Security (HTTPS only)
  // Only enable in production with HTTPS
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }

  return response;
}

/**
 * CORS configuration
 * Industry Best Practice: Explicit origin whitelisting
 */
export function addCORSHeaders(
  response: NextResponse,
  origin?: string
): NextResponse {
  // Whitelist of allowed origins
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') ?? [
    'http://localhost:3000',
    'https://salesvelocity.ai',
  ];
  
  // Check if origin is allowed
  if (origin && allowedOrigins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  }
  
  response.headers.set(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, PATCH, DELETE, OPTIONS'
  );
  
  response.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Request-ID'
  );
  
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('Access-Control-Max-Age', '86400'); // 24 hours
  
  return response;
}




