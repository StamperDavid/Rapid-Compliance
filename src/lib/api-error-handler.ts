/**
 * API Error Handling Utilities
 * Consistent error handling across all API routes
 */

import { NextResponse } from 'next/server';
import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

export class APIError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'APIError';
  }
}

/**
 * Handle API errors and return appropriate NextResponse
 */
export function handleAPIError(error: unknown, context?: string): NextResponse {
  console.error(`[API Error${context ? ` - ${context}` : ''}]:`, error);

  // Handle known API errors
  if (error instanceof APIError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        details: error.details,
      },
      { status: error.statusCode }
    );
  }

  // Handle Firebase errors
  if (isFirebaseError(error)) {
    const firebaseError = handleFirebaseError(error);
    return NextResponse.json(
      {
        error: firebaseError.message,
        code: firebaseError.code,
      },
      { status: firebaseError.statusCode }
    );
  }

  // Handle unknown errors
  return NextResponse.json(
    {
      error: 'An unexpected error occurred',
      details: process.env.NODE_ENV === 'development' && error instanceof Error ? error.message : undefined,
    },
    { status: 500 }
  );
}

interface FirebaseError {
  code: string;
  message?: string;
}

/**
 * Type guard to check if error is a Firebase error
 */
function isFirebaseError(error: unknown): error is FirebaseError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as FirebaseError).code === 'string'
  );
}

/**
 * Handle Firebase-specific errors
 */
function handleFirebaseError(error: FirebaseError): {
  message: string;
  code: string;
  statusCode: number;
} {
  const code = error.code !== '' && error.code != null ? error.code : 'unknown';

  // Map Firebase error codes to HTTP status codes and messages
  const errorMap: Record<string, { message: string; statusCode: number }> = {
    'permission-denied': {
      message: 'You do not have permission to perform this action',
      statusCode: 403,
    },
    'not-found': {
      message: 'The requested resource was not found',
      statusCode: 404,
    },
    'already-exists': {
      message: 'The resource already exists',
      statusCode: 409,
    },
    'failed-precondition': {
      message: 'The operation was rejected because of a precondition failure',
      statusCode: 412,
    },
    'unauthenticated': {
      message: 'Authentication required',
      statusCode: 401,
    },
    'resource-exhausted': {
      message: 'Resource quota exceeded',
      statusCode: 429,
    },
    'invalid-argument': {
      message: 'Invalid request parameters',
      statusCode: 400,
    },
    'deadline-exceeded': {
      message: 'Request timeout',
      statusCode: 408,
    },
    'unavailable': {
      message: 'Service temporarily unavailable',
      statusCode: 503,
    },
  };

  const mappedError = errorMap[code] || {
    message: error.message !== '' && error.message != null ? error.message : 'An error occurred',
    statusCode: 500,
  };

  return {
    ...mappedError,
    code,
  };
}

/**
 * Validate required parameters
 */
export function validateParams(
  params: Record<string, unknown>,
  required: string[]
): void {
  const missing = required.filter(key => !params[key]);
  
  if (missing.length > 0) {
    throw new APIError(
      `Missing required parameters: ${missing.join(', ')}`,
      400,
      'MISSING_PARAMETERS',
      { missing }
    );
  }
}

/**
 * In single-tenant mode, always returns DEFAULT_ORG_ID
 */
export function validateOrgId(_organizationId?: unknown): string {
  return DEFAULT_ORG_ID;
}

/**
 * Verify organization ownership of a resource
 */
export function verifyOrgOwnership(
  resourceOrgId: string,
  requestedOrgId: string,
  resourceType: string = 'resource'
): void {
  if (resourceOrgId !== requestedOrgId) {
    console.error('[SECURITY] Cross-org access attempt:', {
      resourceOrgId,
      requestedOrgId,
      resourceType,
    });
    
    throw new APIError(
      `Access denied: ${resourceType} belongs to a different organization`,
      403,
      'CROSS_ORG_ACCESS_DENIED',
      { resourceType }
    );
  }
}

/**
 * Success response helper
 */
export function successResponse(
  data: Record<string, unknown>,
  message?: string,
  statusCode: number = 200
): NextResponse {
  return NextResponse.json(
    {
      success: true as const,
      ...data,
      ...(message ? { message } : {}),
    },
    { status: statusCode }
  );
}

/**
 * Error response helper
 */
export function errorResponse(
  message: string,
  statusCode: number = 400,
  code?: string,
  details?: unknown
): NextResponse {
  return NextResponse.json(
    {
      success: false as const,
      error: message,
      ...(code ? { code } : {}),
      ...(details ? { details } : {}),
    },
    { status: statusCode }
  );
}

/**
 * Wrap async route handlers with error handling
 */
export function withErrorHandler(
  handler: (request: Request, context?: Record<string, unknown>) => Promise<NextResponse>,
  context?: string
) {
  return async (request: Request, contextParam?: Record<string, unknown>): Promise<NextResponse> => {
    try {
      return await handler(request, contextParam);
    } catch (error) {
      return handleAPIError(error, context);
    }
  };
}


