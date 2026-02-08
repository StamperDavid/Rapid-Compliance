/**
 * List Notifications API
 *
 * GET /api/notifications/list
 *
 * Retrieve user notifications with filtering and pagination.
 *
 * Query Parameters:
 * - categories: Comma-separated list of categories
 * - statuses: Comma-separated list of statuses
 * - channels: Comma-separated list of channels
 * - unreadOnly: Boolean (true/false)
 * - limit: Number (1-100, default 50)
 * - startAfter: Cursor for pagination
 *
 * Rate Limit: 60 requests per minute
 */

export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getNotificationsRequestSchema } from '@/lib/notifications/validation';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { PLATFORM_ID } from '@/lib/constants/platform';
import type { Notification } from '@/lib/notifications/types';

/**
 * Rate limiting map
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, limit: number, windowMs: number): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  const now = Date.now();
  const rateLimitData = rateLimitMap.get(key);

  if (!rateLimitData || now > rateLimitData.resetAt) {
    const resetAt = now + windowMs;
    rateLimitMap.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  if (rateLimitData.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: rateLimitData.resetAt };
  }

  rateLimitData.count++;
  rateLimitMap.set(key, rateLimitData);
  
  return { allowed: true, remaining: limit - rateLimitData.count, resetAt: rateLimitData.resetAt };
}

/**
 * GET /api/notifications/list
 * List notifications for current user
 */
export async function GET(request: NextRequest) {
  try {
    // Get user ID (from session/auth)
    const userIdHeader = request.headers.get('x-user-id');
    const userId = (userIdHeader !== '' && userIdHeader != null) ? userIdHeader : 'default_user';

    // Check rate limit
    const rateLimit = checkRateLimit(`list:${userId}`, 60, 60000);
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded' },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': '60',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimit.resetAt.toString(),
          },
        }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    
    const filters = {
      userId,
      categories: searchParams.get('categories')?.split(','),
      statuses: searchParams.get('statuses')?.split(','),
      channels: searchParams.get('channels')?.split(','),
      unreadOnly: searchParams.get('unreadOnly') === 'true',
      limit: (() => {
        const limitParam = searchParams.get('limit');
        return parseInt((limitParam !== '' && limitParam != null) ? limitParam : '50');
      })(),
      startAfter: searchParams.get('startAfter'),
    };

    // Validate filters
    const validatedFilters = getNotificationsRequestSchema.parse(filters);

    // Query Firestore using getAll with proper constraints
    const { where, orderBy: orderByFn, limit: limitFn } = await import('firebase/firestore');
    
    const constraints = [
      where('userId', '==', userId),
      orderByFn('metadata.createdAt', 'desc'),
      limitFn(validatedFilters.limit || 50),
    ];

    let notifications = await FirestoreService.getAll<Notification>(
      `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/notifications`,
      constraints
    );

    // Apply filters
    const filterCategories = validatedFilters.categories;
    if (filterCategories && filterCategories.length > 0) {
      notifications = notifications.filter((n) =>
        filterCategories.includes(n.category)
      );
    }

    const filterStatuses = validatedFilters.statuses;
    if (filterStatuses && filterStatuses.length > 0) {
      notifications = notifications.filter((n) =>
        filterStatuses.includes(n.status)
      );
    }

    const filterChannels = validatedFilters.channels;
    if (filterChannels && filterChannels.length > 0) {
      notifications = notifications.filter((n) =>
        n.channels.some((c) => filterChannels.includes(c))
      );
    }

    if (validatedFilters.unreadOnly) {
      notifications = notifications.filter((n) => !n.metadata.read);
    }

    // Calculate counts
    const unreadCount = notifications.filter((n) => !n.metadata.read).length;
    const totalCount = notifications.length;

    // Prepare response
    const response = {
      success: true,
      notifications: notifications.map((n) => ({
        id: n.id,
        category: n.category,
        priority: n.priority,
        status: n.status,
        channels: n.channels,
        content: {
          inApp: n.content.inApp,
        },
        metadata: {
          createdAt: n.metadata.createdAt,
          read: n.metadata.read ?? false,
          readAt: n.metadata.readAt ?? null,
        },
      })),
      pagination: {
        count: notifications.length,
        hasMore: notifications.length === validatedFilters.limit,
        cursor: notifications.length > 0 
          ? notifications[notifications.length - 1].id 
          : null,
      },
      counts: {
        total: totalCount,
        unread: unreadCount,
      },
    };

    return NextResponse.json(
      response,
      {
        headers: {
          'X-RateLimit-Limit': '60',
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
    
    console.error('List notifications error:', error);

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

interface MarkReadRequestBody {
  notificationIds?: unknown[];
}

function isMarkReadRequestBody(value: unknown): value is MarkReadRequestBody {
  return typeof value === 'object' && value !== null;
}

/**
 * POST /api/notifications/list
 * Mark notifications as read
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body: unknown = await request.json();
    if (!isMarkReadRequestBody(body)) {
      return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
    }

    // Get user ID
    const userIdHeader = request.headers.get('x-user-id');
    const userId = (userIdHeader !== '' && userIdHeader != null) ? userIdHeader : 'default_user';

    // Validate notification IDs
    const notificationIds = body.notificationIds;

    if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid notification IDs' },
        { status: 400 }
      );
    }

    // Ensure all IDs are strings
    const validIds = notificationIds.filter((id): id is string => typeof id === 'string');
    if (validIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid notification IDs provided' },
        { status: 400 }
      );
    }

    // Check rate limit
    const rateLimit = checkRateLimit(`mark_read:${userId}`, 60, 60000);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Mark as read
    const updatePromises = validIds.map((id) =>
      FirestoreService.update(
        `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/notifications`,
        id,
        {
          'metadata.read': true,
          'metadata.readAt': new Date(),
        }
      )
    );

    await Promise.all(updatePromises);

    return NextResponse.json(
      {
        success: true,
        updated: validIds.length,
      },
      {
        headers: {
          'X-RateLimit-Limit': '60',
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
        },
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error('Mark as read error:', error);

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
