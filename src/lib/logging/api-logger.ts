/**
 * API Request/Response Logger Middleware
 * Logs all API requests and responses with structured data
 */

import type { NextRequest, NextResponse } from 'next/server';
import { logger, type LogContext } from '../logger/logger';

/**
 * Log API request and response
 */
export function logApiRequest(
  request: NextRequest,
  response: NextResponse,
  startTime: number,
  context: LogContext = {}
): void {
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
    userAgent: request.headers.get('user-agent') ?? undefined,
    ip: (() => {
      const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0];
      const realIp = request.headers.get('x-real-ip');
      return (forwarded !== '' && forwarded != null) ? forwarded 
        : (realIp !== '' && realIp != null) ? realIp 
        : 'unknown';
    })(),
  };

  if (statusCode >= 500) {
    // Server errors
    logger.error(
      `${method} ${path} returned ${statusCode}`,
      new Error(`API Error ${statusCode}`),
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
    logger.info(
      `${method} ${path} returned ${statusCode} (${duration}ms)`,
      logContext
    );
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

  logger.error(
    `${method} ${path} error: ${error.message}`,
    error,
    {
      ...context,
      method,
      path,
      statusCode,
    }
  );
}




















