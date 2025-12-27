/**
 * API Error Handling Utilities
 * Consistent error handling across all API routes
 */

import { NextResponse } from 'next/server';

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

/**
 * Handle API errors and return appropriate NextResponse
 */
export function handleAPIError(error: any, context?: string): NextResponse {
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
  if (error.code) {
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
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    },
    { status: 500 }
  );
}

/**
 * Handle Firebase-specific errors
 */
function handleFirebaseError(error: any): {
  message: string;
  code: string;
  statusCode: number;
} {
  const code = error.code || 'unknown';

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
    message: error.message || 'An error occurred',
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
  params: Record<string, any>,
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
 * Validate organizationId is present
 */
export function validateOrgId(organizationId: any): string {
  if (!organizationId || typeof organizationId !== 'string') {
    throw new APIError(
      'organizationId is required and must be a string',
      400,
      'INVALID_ORGANIZATION_ID'
    );
  }
  return organizationId;
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
  data: any,
  message?: string,
  statusCode: number = 200
): NextResponse {
  return NextResponse.json(
    {
      success: true,
      ...data,
      ...(message && { message }),
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
  details?: any
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: message,
      ...(code && { code }),
      ...(details && { details }),
    },
    { status: statusCode }
  );
}

/**
 * Wrap async route handlers with error handling
 */
export function withErrorHandler(
  handler: (request: any, context?: any) => Promise<NextResponse>,
  context?: string
) {
  return async (request: any, contextParam?: any): Promise<NextResponse> => {
    try {
      return await handler(request, contextParam);
    } catch (error) {
      return handleAPIError(error, context);
    }
  };
}

