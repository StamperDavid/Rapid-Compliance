/**
 * API Route: Social Agent Settings
 *
 * GET  /api/social/settings → Get current agent configuration
 * PUT  /api/social/settings → Update agent configuration
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { AgentConfigService } from '@/lib/social/agent-config-service';

export const dynamic = 'force-dynamic';

const updateSettingsSchema = z.object({
  velocityLimits: z.record(z.string(), z.number().min(0).max(100)).optional(),
  sentimentBlockKeywords: z.array(z.string()).optional(),
  escalationTriggerKeywords: z.array(z.string()).optional(),
  recycleCooldownDays: z.number().min(1).max(365).optional(),
  maxDailyPosts: z.number().min(1).max(50).optional(),
  preferredPostingTimes: z.array(z.object({
    dayOfWeek: z.number().min(0).max(6),
    hour: z.number().min(0).max(23),
    minute: z.number().min(0).max(59),
    platforms: z.array(z.enum(['twitter', 'linkedin'])),
  })).optional(),
  pauseOnWeekends: z.boolean().optional(),
  autoApprovalEnabled: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/social/settings');
    if (rateLimitResponse) {return rateLimitResponse;}

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {return authResult;}

    const config = await AgentConfigService.getConfig();

    return NextResponse.json({ success: true, config });
  } catch (error: unknown) {
    logger.error('Settings API: GET failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: 'Failed to load settings' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/social/settings');
    if (rateLimitResponse) {return rateLimitResponse;}

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {return authResult;}

    const body: unknown = await request.json();
    const validation = updateSettingsSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      );
    }

    const updated = await AgentConfigService.saveConfig(
      validation.data,
      authResult.user.uid
    );

    logger.info('Settings API: Config updated', { userId: authResult.user.uid });

    return NextResponse.json({ success: true, config: updated });
  } catch (error: unknown) {
    logger.error('Settings API: PUT failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
