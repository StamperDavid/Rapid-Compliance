/**
 * Centralized API Error Handling
 * Provides consistent error responses across all API routes
 */

import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger/logger';;

export class APIError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code?: string;
    statusCode: number;
    details?: any;
  };
  timestamp: string;
}

/**
 * Handle API errors and return consistent response
 */
export function handleAPIError(error: unknown): NextResponse<ErrorResponse> {
  logger.error('[API Error]', error, { file: 'error-handler.ts' });

  // Handle known API errors
  if (error instanceof APIError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error.message,
          code: error.code,
          statusCode: error.statusCode,
          details: error.details,
        },
        timestamp: new Date().toISOString(),
      },
      { status: error.statusCode }
    );
  }

  // Handle Firebase errors
  if (error && typeof error === 'object' && 'code' in error) {
    const firebaseError = error as any;
    const statusCode = getFirebaseErrorStatus(firebaseError.code);
    return NextResponse.json(
      {
        success: false,
        error: {
          message: firebaseError.message || 'Database operation failed',
          code: firebaseError.code,
          statusCode,
        },
        timestamp: new Date().toISOString(),
      },
      { status: statusCode }
    );
  }

  // Handle standard errors
  if (error instanceof Error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error.message,
          statusCode: 500,
        },
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }

  // Handle unknown errors
  return NextResponse.json(
    {
      success: false,
      error: {
        message: 'An unexpected error occurred',
        statusCode: 500,
      },
      timestamp: new Date().toISOString(),
    },
    { status: 500 }
  );
}

/**
 * Map Firebase error codes to HTTP status codes
 */
function getFirebaseErrorStatus(code: string): number {
  const errorMap: Record<string, number> = {
    'permission-denied': 403,
    'unauthenticated': 401,
    'not-found': 404,
    'already-exists': 409,
    'resource-exhausted': 429,
    'failed-precondition': 400,
    'aborted': 409,
    'out-of-range': 400,
    'unimplemented': 501,
    'unavailable': 503,
    'deadline-exceeded': 504,
  };

  return errorMap[code] || 500;
}

/**
 * Validate required fields in request body
 */
export function validateRequired(
  data: any,
  fields: string[]
): { valid: boolean; missing?: string[] } {
  const missing = fields.filter((field) => {
    const value = data[field];
    return value === undefined || value === null || value === '';
  });

  if (missing.length > 0) {
    return { valid: false, missing };
  }

  return { valid: true };
}

/**
 * Wrap an API handler with error handling
 */
export function withErrorHandling<T>(
  handler: (...args: any[]) => Promise<NextResponse<T>>
) {
  return async (...args: any[]): Promise<NextResponse<T | ErrorResponse>> => {
    try {
      return await handler(...args);
    } catch (error) {
      return handleAPIError(error);
    }
  };
}

/**
 * Common error constructors
 */
export const errors = {
  notFound: (resource: string) =>
    new APIError(`${resource} not found`, 404, 'NOT_FOUND'),

  unauthorized: (message = 'Unauthorized') =>
    new APIError(message, 401, 'UNAUTHORIZED'),

  forbidden: (message = 'Access denied') =>
    new APIError(message, 403, 'FORBIDDEN'),

  badRequest: (message: string, details?: any) =>
    new APIError(message, 400, 'BAD_REQUEST', details),

  conflict: (message: string) =>
    new APIError(message, 409, 'CONFLICT'),

  tooManyRequests: (message = 'Rate limit exceeded') =>
    new APIError(message, 429, 'TOO_MANY_REQUESTS'),

  serviceUnavailable: (service: string) =>
    new APIError(`${service} is currently unavailable`, 503, 'SERVICE_UNAVAILABLE'),

  missingAPIKey: (service: string) =>
    new APIError(
      `${service} API key not configured. Please add it in Settings → API Keys.`,
      424,
      'MISSING_API_KEY',
      { service }
    ),

  externalServiceError: (service: string, originalError?: any) =>
    new APIError(
      `Failed to communicate with ${service}`,
      502,
      'EXTERNAL_SERVICE_ERROR',
      { service, originalError: originalError?.message }
    ),
};

/**
 * Validate authentication from request
 */
export async function validateAuth(request: Request): Promise<string> {
  // For now, get orgId from query params or headers
  // In production, this would validate JWT token
  const url = new URL(request.url);
  const orgId = url.searchParams.get('orgId') || request.headers.get('x-organization-id');

  if (!orgId) {
    throw errors.unauthorized('Organization ID required');
  }

  return orgId;
}

/**
 * Success response helper
 */
export function successResponse<T>(data: T, status: number = 200): NextResponse<{ success: true } & T> {
  return NextResponse.json(
    {
      success: true as const,
      ...data,
    },
    { status }
  );
}















