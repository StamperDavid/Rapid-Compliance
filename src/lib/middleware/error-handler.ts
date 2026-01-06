/**
 * Centralized Error Handling Middleware
 * Provides consistent error responses across all API routes
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger/logger';
import * as Sentry from '@sentry/nextjs';

export interface APIError {
  message: string;
  code?: string;
  statusCode: number;
  details?: any;
}

/**
 * Standard error codes
 */
export enum ErrorCode {
  // Client errors (4xx)
  BAD_REQUEST = 'BAD_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  // Server errors (5xx)
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  error: string | APIError | Error,
  statusCode: number = 500,
  code?: ErrorCode,
  details?: any
): NextResponse {
  let errorMessage: string;
  let errorCode: string | undefined;
  let errorDetails: any;

  if (typeof error === 'string') {
    errorMessage = error;
    errorCode = code;
    errorDetails = details;
  } else if (error instanceof Error) {
    errorMessage = error.message;
    errorCode = code || ErrorCode.INTERNAL_SERVER_ERROR;
    errorDetails = process.env.NODE_ENV === 'development' ? {
      stack: error.stack,
      ...details,
    } : details;
  } else {
    errorMessage = error.message;
    errorCode = error.code || code;
    errorDetails = error.details || details;
    statusCode = error.statusCode || statusCode;
  }

  // Log the error
  if (statusCode >= 500) {
    logger.error(errorMessage, error instanceof Error ? error : undefined, {
      statusCode,
      code: errorCode,
      details: errorDetails,
    });
  } else {
    logger.warn(errorMessage, {
      statusCode,
      code: errorCode,
      details: errorDetails,
    });
  }

  return NextResponse.json(
    {
      success: false,
      error: errorMessage,
      code: errorCode,
      details: errorDetails,
    },
    { status: statusCode }
  );
}

/**
 * Wrapper for API route handlers with automatic error handling
 */
export function withErrorHandler(
  handler: (request: NextRequest, context?: any) => Promise<NextResponse>
) {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    try {
      return await handler(request, context);
    } catch (error) {
      // Log unexpected errors
      logger.error(
        'Unhandled error in API route',
        error as Error,
        {
          route: request.url,
          method: request.method,
        }
      );

      // Send to Sentry
      Sentry.captureException(error, {
        tags: {
          route: request.url,
          method: request.method,
        },
      });

      // Return generic error response
      return createErrorResponse(
        process.env.NODE_ENV === 'development'
          ? (error as Error).message
          : 'An unexpected error occurred',
        500,
        ErrorCode.INTERNAL_SERVER_ERROR
      );
    }
  };
}

/**
 * Common error helpers
 */
export const errors = {
  badRequest: (message: string, details?: any) =>
    createErrorResponse(message, 400, ErrorCode.BAD_REQUEST, details),

  unauthorized: (message: string = 'Unauthorized') =>
    createErrorResponse(message, 401, ErrorCode.UNAUTHORIZED),

  forbidden: (message: string = 'Forbidden') =>
    createErrorResponse(message, 403, ErrorCode.FORBIDDEN),

  notFound: (message: string = 'Resource not found') =>
    createErrorResponse(message, 404, ErrorCode.NOT_FOUND),

  validation: (message: string, details?: any) =>
    createErrorResponse(message, 400, ErrorCode.VALIDATION_ERROR, details),

  rateLimit: (message: string = 'Rate limit exceeded') =>
    createErrorResponse(message, 429, ErrorCode.RATE_LIMIT_EXCEEDED),

  internal: (message: string = 'Internal server error', error?: Error) =>
    createErrorResponse(error || message, 500, ErrorCode.INTERNAL_SERVER_ERROR),

  database: (message: string, error?: Error) =>
    createErrorResponse(error || message, 500, ErrorCode.DATABASE_ERROR),

  externalService: (service: string, error?: Error) =>
    createErrorResponse(
      error || `External service error: ${service}`,
      502,
      ErrorCode.EXTERNAL_SERVICE_ERROR
    ),
};

