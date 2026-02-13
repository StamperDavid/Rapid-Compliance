/**
 * API Route: Social Listening Configuration
 *
 * GET /api/social/listening/config → Get listening config
 * PUT /api/social/listening/config → Update listening config
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { ListeningService } from '@/lib/social/listening-service';

export const dynamic = 'force-dynamic';

const updateConfigSchema = z.object({
  trackedKeywords: z.array(z.string()).optional(),
  trackedHashtags: z.array(z.string()).optional(),
  trackedCompetitors: z.array(z.string()).optional(),
  sentimentAlertThreshold: z.number().min(0).max(100).optional(),
  pollingIntervalMinutes: z.number().min(5).max(1440).optional(),
  enabledPlatforms: z.array(z.enum(['twitter', 'linkedin'])).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/social/listening/config');
    if (rateLimitResponse) {return rateLimitResponse;}

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {return authResult;}

    const config = await ListeningService.getConfig();
    return NextResponse.json({ success: true, config });
  } catch (error: unknown) {
    logger.error('Listening Config API: GET failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: 'Failed to get config' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/social/listening/config');
    if (rateLimitResponse) {return rateLimitResponse;}

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {return authResult;}

    const body: unknown = await request.json();
    const validation = updateConfigSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      );
    }

    const updated = await ListeningService.saveConfig(validation.data);

    return NextResponse.json({ success: true, config: updated });
  } catch (error: unknown) {
    logger.error('Listening Config API: PUT failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: 'Failed to update config' },
      { status: 500 }
    );
  }
}
