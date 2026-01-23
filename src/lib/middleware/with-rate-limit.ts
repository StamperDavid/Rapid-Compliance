/**
 * Higher-order function to wrap API routes with rate limiting
 * Applies rate limiting automatically to all wrapped routes
 */

import type { NextRequest, NextResponse } from 'next/server';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { logger } from '@/lib/logger/logger';

/**
 * Wrap an API route handler with rate limiting
 */
export function withRateLimit(
  handler: (request: NextRequest, context?: Record<string, unknown>) => Promise<NextResponse>,
  endpoint?: string
) {
  return async (request: NextRequest, context?: Record<string, unknown>): Promise<NextResponse> => {
    // Apply rate limiting
    const rateLimitResponse = await rateLimitMiddleware(request, endpoint);
    
    if (rateLimitResponse) {
      // Rate limit exceeded
      logger.warn('Rate limit exceeded', {
        route:endpoint ?? request.url,
        ip: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? undefined,
      });
      
      return rateLimitResponse;
    }
    
    // Continue to handler
    return handler(request, context);
  };
}

/**
 * Combine rate limiting and error handling
 */
export function withMiddleware(
  handler: (request: NextRequest, context?: Record<string, unknown>) => Promise<NextResponse>,
  options?: {
    rateLimit?: boolean;
    endpoint?: string;
  }
) {
  let wrappedHandler = handler;
  
  // Apply rate limiting if enabled (default: true)
  if (options?.rateLimit !== false) {
    wrappedHandler = withRateLimit(wrappedHandler, options?.endpoint);
  }
  
  return wrappedHandler;
}




