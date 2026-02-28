/**
 * Entity Configuration API
 *
 * GET  — Returns current entity config (or null for unconfigured users)
 * PUT  — Updates entity config (admin auth required, Zod validated)
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { handleAPIError, errors } from '@/lib/api/error-handler';
import { logger } from '@/lib/logger/logger';
import { getEntityConfig, saveEntityConfig } from '@/lib/services/entity-config-service';
import { updateEntityConfigSchema } from '@/lib/validation/entity-config-schemas';
import type { EntityConfig } from '@/types/entity-config';

export const dynamic = 'force-dynamic';

/**
 * GET — Load entity config
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const config = await getEntityConfig();

    return NextResponse.json({
      success: true,
      config,
    });
  } catch (error: unknown) {
    logger.error(
      'Entity config load error',
      error instanceof Error ? error : new Error(String(error)),
      { route: '/api/entity-config' },
    );
    return handleAPIError(error instanceof Error ? error : new Error('Unknown error'));
  }
}

/**
 * PUT — Update entity config
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();

    const parsed = updateEntityConfigSchema.safeParse(body);
    if (!parsed.success) {
      return handleAPIError(
        errors.badRequest('Invalid entity config', { errors: parsed.error.issues }),
      );
    }

    const user = authResult as { user: { uid: string } };
    const userId = user.user?.uid ?? 'unknown';

    const config: EntityConfig = {
      entities: parsed.data.entities,
      updatedAt: new Date().toISOString(),
      updatedBy: userId,
    };

    await saveEntityConfig(config);

    logger.info('Entity config updated', { route: '/api/entity-config', userId });

    return NextResponse.json({
      success: true,
      config,
    });
  } catch (error: unknown) {
    logger.error(
      'Entity config update error',
      error instanceof Error ? error : new Error(String(error)),
      { route: '/api/entity-config' },
    );
    return handleAPIError(error instanceof Error ? error : new Error('Unknown error'));
  }
}
