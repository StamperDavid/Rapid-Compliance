/**
 * Send Notification API
 *
 * POST /api/notifications/send
 *
 * Sends a notification using a template and variables.
 *
 * Rate Limit: 50 requests per minute
 */

export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sendNotificationRequestSchema } from '@/lib/notifications/validation';
import { NotificationService } from '@/lib/notifications/notification-service';
import { requireAuth } from '@/lib/auth/api-auth';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';

/**
 * Rate limiting map (in-memory for simplicity)
 * In production, use Redis or similar
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

/**
 * Check rate limit
 */
function checkRateLimit(key: string, limit: number, windowMs: number): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  const now = Date.now();
  const rateLimitData = rateLimitMap.get(key);

  if (!rateLimitData || now > rateLimitData.resetAt) {
    // Create new window
    const resetAt = now + windowMs;
    rateLimitMap.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  if (rateLimitData.count >= limit) {
    // Rate limit exceeded
    return { allowed: false, remaining: 0, resetAt: rateLimitData.resetAt };
  }

  // Increment count
  rateLimitData.count++;
  rateLimitMap.set(key, rateLimitData);
  
  return { allowed: true, remaining: limit - rateLimitData.count, resetAt: rateLimitData.resetAt };
}

/**
 * POST /api/notifications/send
 * Send a notification
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {return authResult;}

    // Parse request body
    const body: unknown = await request.json();

    // Validate request
    const validatedData = sendNotificationRequestSchema.parse(body);

    // Check rate limit (50 req/min per org)
    const rateLimit = checkRateLimit(`send:${PLATFORM_ID}`, 50, 60000);
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': '50',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimit.resetAt.toString(),
          },
        }
      );
    }

    // Create notification service
    const service = new NotificationService();

    // Parse scheduled date if provided
    const scheduledFor = validatedData.scheduledFor 
      ? new Date(validatedData.scheduledFor)
      : undefined;

    // Ensure PLATFORM_ID is in variables (required by NotificationVariables interface)
    const variables = {
      ...validatedData.variables,
      PLATFORM_ID,
    };
    
    // Send notification
    const notification = await service.sendNotification(
      validatedData.userId,
      validatedData.templateId,
      variables,
      {
        channels: validatedData.channels,
        priority: validatedData.priority,
        scheduledFor,
      }
    );

    return NextResponse.json(
      {
        success: true,
        notification: {
          id: notification.id,
          status: notification.status,
          channels: notification.channels,
          priority: notification.priority,
          createdAt: notification.metadata.createdAt,
        },
      },
      {
        status: 201,
        headers: {
          'X-RateLimit-Limit': '50',
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': rateLimit.resetAt.toString(),
        },
      }
    );
  } catch (error) {
    // Validation error
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation error',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    // Other errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('Notification send error', error instanceof Error ? error : new Error(String(error)), { file: 'notifications/send/route.ts' });

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
