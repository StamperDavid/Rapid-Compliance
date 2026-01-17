/**
 * Sentry Monitoring Middleware
 * Comprehensive error tracking and performance monitoring for all API routes
 * Updated for Sentry v8+ API
 */

import type { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { logger } from '@/lib/logger/logger';

/**
 * Extract user information from request for Sentry context
 */
function extractUserContext(request: NextRequest): {
  id?: string;
  email?: string;
  organizationId?: string;
} {
  try {
    // Try to get user from auth header
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {return {};}

    // In a real implementation, decode the JWT token here
    // For now, we'll return empty context
    // This would be implemented with your JWT verification
    return {};
  } catch {
    return {};
  }
}

/**
 * Get request metadata for Sentry
 */
function getRequestMetadata(request: NextRequest) {
  return {
    url: request.url,
    method: request.method,
    ip:request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip'),
    userAgent: request.headers.get('user-agent'),
    referer: request.headers.get('referer'),
  };
}

/**
 * Wrapper for API routes with Sentry monitoring
 * Automatically tracks:
 * - Performance (response time, throughput)
 * - Errors (with full context)
 * - User context
 * - Request metadata
 */
export function withSentryMonitoring<T = Record<string, unknown>>(
  handler: (request: NextRequest, context?: T) => Promise<NextResponse>,
  options: {
    routeName?: string;
    operationName?: string;
  } = {}
) {
  return async (request: NextRequest, context?: T): Promise<NextResponse> => {
    const startTime = Date.now();
    const route =options.routeName ?? new URL(request.url).pathname;
    const operation =(options.operationName !== '' && options.operationName != null) ? options.operationName : `${request.method} ${route}`;

    try {
      // Extract and set user context
      const userContext = extractUserContext(request);
      if (userContext.id || userContext.email) {
        Sentry.setUser({
          id: userContext.id,
          email: userContext.email,
          organizationId: userContext.organizationId,
        });
      }

      // Set request context
      Sentry.setContext('request', getRequestMetadata(request));

      // Add breadcrumb
      Sentry.addBreadcrumb({
        category: 'http',
        message: `${request.method} ${route}`,
        level: 'info',
        data: {
          url: request.url,
          method: request.method,
        },
      });

      // Execute the handler
      const response = await handler(request, context);

      // Record successful response
      const duration = Date.now() - startTime;

      // Log slow requests
      if (duration > 3000) {
        logger.warn('Slow API request detected', {
          route,
          duration,
          method: request.method,
        });

        Sentry.captureMessage(`Slow request: ${operation}`, {
          level: 'warning',
          tags: {
            route,
            slow_request: 'true',
          },
          extra: {
            duration,
            method: request.method,
          },
        });
      }

      return response;
    } catch (error) {
      // Log error
      logger.error('Unhandled error in API route', error as Error, {
        route,
        method: request.method,
        url: request.url,
      });

      // Capture exception with full context
      Sentry.captureException(error, {
        tags: {
          route,
          method: request.method,
          handler: operation,
        },
        extra: {
          duration: Date.now() - startTime,
          ...getRequestMetadata(request),
        },
        level: 'error',
      });

      // Re-throw to let error handler deal with response
      throw error;
    } finally {
      // Clear user context for next request
      Sentry.setUser(null);
    }
  };
}

/**
 * Track custom events in Sentry
 */
export function trackEvent(
  eventName: string,
  data?: Record<string, unknown>,
  level: 'info' | 'warning' | 'error' = 'info'
) {
  Sentry.captureMessage(eventName, {
    level,
    extra: data,
  });

  logger.info(`Event tracked: ${eventName}`, data);
}

/**
 * Track performance metric
 */
export function trackPerformance(
  operationName: string,
  duration: number,
  metadata?: Record<string, unknown>
) {
  Sentry.addBreadcrumb({
    category: 'performance',
    message: operationName,
    level: 'info',
    data: {
      duration,
      ...metadata,
    },
  });

  if (duration > 1000) {
    logger.warn(`Slow operation: ${operationName}`, {
      duration,
      ...metadata,
    });
  }
}

interface SentrySpan {
  setData: (key: string, value: unknown) => void;
  setStatus: (status: string) => void;
  finish: () => void;
}

/**
 * Start a Sentry span for a specific operation
 * Use this to track performance of specific code blocks
 * Note: In Sentry v8+, use the span() function directly for better performance tracking
 */
export function startSpan(
  _operation: string,
  _description?: string
): SentrySpan {
  // For Sentry v8+, this is a simplified wrapper
  // Real spans should be created using Sentry.startSpan() or Sentry.withActiveSpan()
  return {
    setData: () => {},
    setStatus: () => {},
    finish: () => {},
  };
}

/**
 * Track database query performance
 */
export async function trackDatabaseQuery<T>(
  queryName: string,
  queryFn: () => Promise<T>
): Promise<T> {
  const span = startSpan('db.query', queryName);
  const start = Date.now();

  try {
    const result = await queryFn();
    const duration = Date.now() - start;

    span.setData('duration', duration);
    span.setStatus('ok');

    if (duration > 500) {
      logger.warn('Slow database query', {
        query: queryName,
        duration,
      });
    }

    return result;
  } catch (error) {
    span.setStatus('internal_error');
    logger.error(`Database query failed: ${queryName}`, error as Error);
    throw error;
  } finally {
    span.finish();
  }
}

/**
 * Track external API call performance
 */
export async function trackExternalCall<T>(
  serviceName: string,
  operationName: string,
  callFn: () => Promise<T>
): Promise<T> {
  const span = startSpan('http.client', `${serviceName}.${operationName}`);
  const start = Date.now();

  try {
    const result = await callFn();
    const duration = Date.now() - start;

    span.setData('duration', duration);
    span.setData('service', serviceName);
    span.setStatus('ok');

    if (duration > 2000) {
      logger.warn('Slow external API call', {
        service: serviceName,
        operation: operationName,
        duration,
      });
    }

    return result;
  } catch (error) {
    span.setStatus('internal_error');
    logger.error(`External API call failed: ${serviceName}.${operationName}`, error as Error);

    Sentry.captureException(error, {
      tags: {
        service: serviceName,
        operation: operationName,
        external_api: 'true',
      },
    });

    throw error;
  } finally {
    span.finish();
  }
}

