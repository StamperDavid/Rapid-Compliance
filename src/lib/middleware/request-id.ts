/**
 * Request ID Middleware
 * Adds unique request ID for distributed tracing
 * Industry Best Practice: Every request should be traceable
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

/**
 * Generate or extract request ID
 * Supports existing X-Request-ID headers (from load balancers)
 */
export function getRequestId(request: NextRequest): string {
  // Check if request already has an ID (from upstream proxy/load balancer)
  const existingId = request.headers.get('x-request-id') || 
                     request.headers.get('x-correlation-id');
  
  if (existingId) {
    return existingId;
  }
  
  // Generate new UUID v4 (Node.js built-in, no external dependency)
  return randomUUID();
}

/**
 * Add request ID to response headers
 * Makes debugging easier by correlating requests/responses
 */
export function addRequestIdToResponse(
  response: NextResponse,
  requestId: string
): NextResponse {
  response.headers.set('X-Request-ID', requestId);
  return response;
}

/**
 * Wrapper to add request ID tracking to API routes
 */
export function withRequestId(
  handler: (request: NextRequest, requestId: string) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const requestId = getRequestId(request);
    
    try {
      const response = await handler(request, requestId);
      return addRequestIdToResponse(response, requestId);
    } catch (error) {
      // Even on error, return request ID
      const errorResponse = NextResponse.json(
        { error: 'Internal server error', requestId },
        { status: 500 }
      );
      return addRequestIdToResponse(errorResponse, requestId);
    }
  };
}

