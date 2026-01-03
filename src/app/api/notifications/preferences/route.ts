/**
 * Notification Preferences API
 * 
 * GET /api/notifications/preferences - Get user preferences
 * PUT /api/notifications/preferences - Update user preferences
 * 
 * Rate Limit: 30 requests per minute
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { updatePreferencesRequestSchema } from '@/lib/notifications/validation';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { Timestamp } from 'firebase/firestore';
import type { NotificationPreferences, NotificationCategory } from '@/lib/notifications/types';

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
 * GET /api/notifications/preferences
 * Get notification preferences for current user
 */
export async function GET(request: NextRequest) {
  try {
    // Get user ID and org ID (from session/auth)
    // TODO: Implement proper authentication
    const userId = request.headers.get('x-user-id') || 'default_user';
    const orgId = request.headers.get('x-org-id') || 'default_org';

    // Check rate limit
    const rateLimit = checkRateLimit(`prefs:${userId}`, 30, 60000);
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Get preferences from Firestore
    const preferences = await FirestoreService.get(
      `${COLLECTIONS.ORGANIZATIONS}/${orgId}/notification_preferences`,
      userId
    );

    if (!preferences) {
      // Return default preferences
      const defaultPrefs = getDefaultPreferences(userId, orgId);
      
      return NextResponse.json(
        {
          success: true,
          preferences: defaultPrefs,
          isDefault: true,
        },
        {
          headers: {
            'X-RateLimit-Limit': '30',
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          },
        }
      );
    }

    return NextResponse.json(
      {
        success: true,
        preferences,
        isDefault: false,
      },
      {
        headers: {
          'X-RateLimit-Limit': '30',
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
        },
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error('Get preferences error:', error);

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/notifications/preferences
 * Update notification preferences
 */
export async function PUT(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();

    // Get user ID and org ID (from session/auth)
    const userId = request.headers.get('x-user-id') || body.userId || 'default_user';
    const orgId = request.headers.get('x-org-id') || body.orgId || 'default_org';

    // Add userId and orgId to body for validation
    body.userId = userId;
    body.orgId = orgId;

    // Validate request
    const validatedData = updatePreferencesRequestSchema.parse(body);

    // Check rate limit
    const rateLimit = checkRateLimit(`prefs_update:${userId}`, 30, 60000);
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Get existing preferences
    let existingPrefs = await FirestoreService.get(
      `${COLLECTIONS.ORGANIZATIONS}/${orgId}/notification_preferences`,
      userId
    ) as NotificationPreferences | null;

    if (!existingPrefs) {
      // Create default preferences
      existingPrefs = getDefaultPreferences(userId, orgId);
    }

    // Merge with updates
    // Deep merge is necessary because validatedData uses deepPartial()
    const now = Timestamp.now();
    
    // Construct updated preferences by merging with existing
    // Type assertion is safe because existingPrefs has all required fields
    // and validatedData only provides overrides (validated by Zod schema)
    const updatedPrefs: NotificationPreferences = {
      userId,
      orgId,
      enabled: validatedData.enabled ?? existingPrefs.enabled,
      channels: {
        slack: validatedData.channels?.slack 
          ? { ...existingPrefs.channels.slack!, ...validatedData.channels.slack }
          : existingPrefs.channels.slack,
        email: validatedData.channels?.email
          ? { ...existingPrefs.channels.email!, ...validatedData.channels.email }
          : existingPrefs.channels.email,
        webhook: validatedData.channels?.webhook
          ? { ...existingPrefs.channels.webhook!, ...validatedData.channels.webhook }
          : existingPrefs.channels.webhook,
        inApp: validatedData.channels?.inApp
          ? { ...existingPrefs.channels.inApp!, ...validatedData.channels.inApp }
          : existingPrefs.channels.inApp,
      } as NotificationPreferences['channels'],
      categories: {
        ...existingPrefs.categories,
        ...validatedData.categories,
      } as NotificationPreferences['categories'],
      batching: {
        ...existingPrefs.batching,
        ...validatedData.batching,
      } as NotificationPreferences['batching'],
      metadata: {
        createdAt: existingPrefs.metadata.createdAt,
        updatedAt: now,
      },
    };

    // Save to Firestore
    await FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${orgId}/notification_preferences`,
      userId,
      updatedPrefs
    );

    return NextResponse.json(
      {
        success: true,
        preferences: updatedPrefs,
      },
      {
        headers: {
          'X-RateLimit-Limit': '30',
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
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
    
    console.error('Update preferences error:', error);

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * Get default notification preferences
 */
function getDefaultPreferences(userId: string, orgId: string): NotificationPreferences {
  const now = Timestamp.now();
  
  const categories: NotificationPreferences['categories'] = {} as any;
  
  const categoryList: NotificationCategory[] = [
    'deal_risk',
    'conversation',
    'coaching',
    'team_performance',
    'playbook',
    'sequence',
    'lead_routing',
    'email_writer',
    'workflow',
    'analytics',
    'forecasting',
    'deal_scoring',
    'battlecard',
    'discovery',
    'system',
  ];

  categoryList.forEach((category) => {
    categories[category] = {
      enabled: true,
      minPriority: 'low',
    };
  });

  return {
    userId,
    orgId,
    enabled: true,
    channels: {
      slack: {
        enabled: true,
        threadMessages: true,
      },
      email: {
        enabled: false,
        digest: true,
      },
      webhook: {
        enabled: false,
      },
      inApp: {
        enabled: true,
        sound: true,
        desktop: true,
      },
    },
    categories,
    batching: {
      enabled: true,
      windowMinutes: 30,
      maxPerBatch: 10,
      bypassPriorities: ['critical', 'high'],
    },
    metadata: {
      createdAt: now,
      updatedAt: now,
    },
  };
}
