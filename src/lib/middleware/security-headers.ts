/**
 * Security Headers Middleware
 * Industry Best Practice: OWASP recommended security headers
 */

import type { NextResponse } from 'next/server';

/**
 * Add security headers to response
 * Based on OWASP best practices
 */
export function addSecurityHeaders(response: NextResponse): NextResponse {
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
    'camera=(), microphone=(), geolocation=()'
  );
  
  // Content Security Policy (CSP)
  // unsafe-eval removed — Next.js 15 production builds do not require it.
  // unsafe-inline kept for style-src (required by inline style attributes and Tailwind).
  // unsafe-inline kept for script-src until nonce-based CSP is implemented (Phase 5).
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.stripe.com https://api.openai.com https://openrouter.ai https://*.firebaseio.com https://*.googleapis.com",
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
    'https://yourdomain.com',
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




