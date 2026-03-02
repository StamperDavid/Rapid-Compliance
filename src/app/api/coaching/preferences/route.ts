/**
 * Coaching Preferences API
 *
 * GET  /api/coaching/preferences — returns current model preference
 * PUT  /api/coaching/preferences — saves new model preference
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import {
  getCoachingPreferences,
  saveCoachingPreferences,
} from '@/lib/coaching/coaching-preferences-service';
import {
  DEFAULT_COACHING_MODEL,
  VALID_COACHING_MODEL_IDS,
} from '@/lib/coaching/coaching-models';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const UpdatePreferencesSchema = z.object({
  selectedModel: z.string().refine(
    (val) => VALID_COACHING_MODEL_IDS.includes(val),
    { message: 'Invalid coaching model. Must be one of the supported models.' }
  ),
});

/**
 * GET /api/coaching/preferences
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const prefs = await getCoachingPreferences();

    return NextResponse.json({
      success: true,
      selectedModel: prefs?.selectedModel ?? DEFAULT_COACHING_MODEL,
      updatedBy: prefs?.updatedBy ?? null,
      updatedAt: prefs?.updatedAt?.toISOString() ?? null,
    });
  } catch (error) {
    logger.error(
      'Failed to get coaching preferences',
      error instanceof Error ? error : new Error(String(error))
    );
    return errors.internal('Failed to load coaching preferences');
  }
}

/**
 * PUT /api/coaching/preferences
 */
export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    const body: unknown = await request.json();
    const parsed = UpdatePreferencesSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid model selection',
          details: parsed.error.errors.map((e) => ({
            field: e.path.map(String).join('.'),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    await saveCoachingPreferences(parsed.data.selectedModel, user.uid);

    logger.info('Coaching model preference updated', {
      selectedModel: parsed.data.selectedModel,
      updatedBy: user.uid,
    });

    return NextResponse.json({
      success: true,
      selectedModel: parsed.data.selectedModel,
    });
  } catch (error) {
    logger.error(
      'Failed to save coaching preferences',
      error instanceof Error ? error : new Error(String(error))
    );
    return errors.internal('Failed to save coaching preferences');
  }
}
