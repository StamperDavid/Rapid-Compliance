import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { handleEntityChange } from '@/lib/workflows/triggers/firestore-trigger';
import { requireOrganization } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

const entityChangeSchema = z.object({
  organizationId: z.string(),
  workspaceId: z.string(),
  schemaId: z.string(),
  changeType: z.enum(['created', 'updated', 'deleted']),
  recordId: z.string(),
  recordData: z.record(z.unknown()),
});

/**
 * Handle entity change trigger
 * This endpoint is called when an entity is created/updated/deleted
 * In production, this would be a Cloud Function trigger
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/workflows/triggers/entity');
    if (rateLimitResponse) {return rateLimitResponse;}

    // Authentication
    const authResult = await requireOrganization(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    // Parse and validate input
    const body: unknown = await request.json();
    const validation = entityChangeSchema.safeParse(body);

    if (!validation.success) {
      const errorMessages = validation.error.errors.map(e => e.message).join(', ');
      return errors.validation('Validation failed', { errors: errorMessages });
    }

    const { organizationId, workspaceId, schemaId, changeType, recordId, recordData } = validation.data;

    // Verify user has access
    if (user.organizationId !== organizationId) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    // Handle entity change (triggers workflows)
    await handleEntityChange(
      organizationId,
      workspaceId,
      schemaId,
      changeType,
      recordId,
      recordData
    );

    return NextResponse.json({
      success: true,
      message: 'Entity change processed, workflows triggered',
    });
  } catch (error: unknown) {
    logger.error('Error processing entity change', error instanceof Error ? error : undefined, { route: '/api/workflows/triggers/entity' });
    return errors.internal('Failed to process entity change', error instanceof Error ? error : undefined);
  }
}
