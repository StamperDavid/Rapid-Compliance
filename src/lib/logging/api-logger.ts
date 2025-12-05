/**
 * API Request/Response Logger Middleware
 * Logs all API requests and responses with structured data
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger, LogContext } from './logger';

/**
 * Log API request and response
 */
export async function logApiRequest(
  request: NextRequest,
  response: NextResponse,
  startTime: number,
  context: LogContext = {}
) {
  const method = request.method;
  const path = new URL(request.url).pathname;
  const statusCode = response.status;
  const duration = Date.now() - startTime;

  const logContext: LogContext = {
    ...context,
    method,
    path,
    statusCode,
    duration,
    userAgent: request.headers.get('user-agent') || undefined,
    ip: request.headers.get('x-forwarded-for')?.split(',')[0] || 
        request.headers.get('x-real-ip') || 
        'unknown',
  };

  if (statusCode >= 500) {
    // Server errors
    logger.error(
      `${method} ${path} returned ${statusCode}`,
      logContext
    );
  } else if (statusCode >= 400) {
    // Client errors
    logger.warn(
      `${method} ${path} returned ${statusCode}`,
      logContext
    );
  } else {
    // Success
    logger.logRequest(method, path, statusCode, duration, logContext);
  }
}

/**
 * Log API error
 */
export function logApiError(
  request: NextRequest,
  error: Error,
  statusCode: number = 500,
  context: LogContext = {}
) {
  const method = request.method;
  const path = new URL(request.url).pathname;

  logger.logApiError(method, path, statusCode, error, {
    ...context,
    method,
    path,
    statusCode,
  });
}






