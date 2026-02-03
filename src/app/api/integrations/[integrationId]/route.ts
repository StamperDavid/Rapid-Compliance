import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import {
  getIntegration,
  updateIntegration,
  deleteIntegration,
} from '@/lib/integrations/integration-manager';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

/**
 * GET /api/integrations/[integrationId] - Get integration
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { integrationId: string } }
) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/integrations');
    if (rateLimitResponse) {return rateLimitResponse;}

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;

    const integration = await getIntegration(user.organizationId, params.integrationId);

    if (!integration) {
      return errors.notFound('Integration not found');
    }

    return NextResponse.json({
      success: true,
      integration,
    });
  } catch (error: unknown) {
    logger.error('Error fetching integration', error instanceof Error ? error : new Error(String(error)), { route: '/api/integrations' });
    return errors.database('Failed to fetch integration', error instanceof Error ? error : undefined);
  }
}

const patchBodySchema = z.object({
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * PATCH /api/integrations/[integrationId] - Update integration
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { integrationId: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const rawBody: unknown = await request.json();
    const bodyResult = patchBodySchema.safeParse(rawBody);
    if (!bodyResult.success) {
      return errors.badRequest('Invalid request body');
    }

    const { user } = authResult;

    const updateData = {
      ...(bodyResult.data.accessToken && { accessToken: bodyResult.data.accessToken }),
      ...(bodyResult.data.refreshToken && { refreshToken: bodyResult.data.refreshToken }),
      ...(bodyResult.data.expiresAt && { expiresAt: new Date(bodyResult.data.expiresAt) }),
      ...(bodyResult.data.metadata && { metadata: bodyResult.data.metadata }),
    };
    await updateIntegration(user.organizationId, params.integrationId, updateData);

    return NextResponse.json({
      success: true,
      message: 'Integration updated',
    });
  } catch (error: unknown) {
    logger.error('Error updating integration', error instanceof Error ? error : new Error(String(error)), { route: '/api/integrations' });
    return errors.database('Failed to update integration', error instanceof Error ? error : undefined);
  }
}

/**
 * DELETE /api/integrations/[integrationId] - Delete integration
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { integrationId: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;

    await deleteIntegration(user.organizationId, params.integrationId);

    return NextResponse.json({
      success: true,
      message: 'Integration deleted',
    });
  } catch (error: unknown) {
    logger.error('Error deleting integration', error instanceof Error ? error : new Error(String(error)), { route: '/api/integrations' });
    return errors.database('Failed to delete integration', error instanceof Error ? error : undefined);
  }
}



















