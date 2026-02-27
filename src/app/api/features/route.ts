/**
 * Feature Configuration API
 *
 * GET  — Returns current feature config (or null for unconfigured users)
 * PUT  — Updates feature config (admin auth required, Zod validated)
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { handleAPIError, errors } from '@/lib/api/error-handler';
import { logger } from '@/lib/logger/logger';
import { getFeatureConfig, saveFeatureConfig } from '@/lib/services/feature-service';
import { updateFeatureConfigSchema } from '@/lib/validation/feature-schemas';
import type { FeatureConfig } from '@/types/feature-modules';

export const dynamic = 'force-dynamic';

/**
 * GET — Load feature config
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const config = await getFeatureConfig();

    return NextResponse.json({
      success: true,
      config,
    });
  } catch (error: unknown) {
    logger.error(
      'Feature config load error',
      error instanceof Error ? error : new Error(String(error)),
      { route: '/api/features' },
    );
    return handleAPIError(error instanceof Error ? error : new Error('Unknown error'));
  }
}

/**
 * PUT — Update feature config
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();

    const parsed = updateFeatureConfigSchema.safeParse(body);
    if (!parsed.success) {
      return handleAPIError(
        errors.badRequest('Invalid feature config', { errors: parsed.error.issues }),
      );
    }

    const userId =
      (authResult as { uid?: string }).uid ?? 'unknown';

    const config: FeatureConfig = {
      modules: parsed.data.modules,
      updatedAt: new Date().toISOString(),
      updatedBy: userId,
    };

    await saveFeatureConfig(config);

    logger.info('Feature config updated', { route: '/api/features', userId });

    return NextResponse.json({
      success: true,
      config,
    });
  } catch (error: unknown) {
    logger.error(
      'Feature config update error',
      error instanceof Error ? error : new Error(String(error)),
      { route: '/api/features' },
    );
    return handleAPIError(error instanceof Error ? error : new Error('Unknown error'));
  }
}
