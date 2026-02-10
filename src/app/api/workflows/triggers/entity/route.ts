import { NextResponse, type NextRequest } from 'next/server';
import { handleEntityChange } from '@/lib/workflows/triggers/firestore-trigger';
import { requireAuth } from '@/lib/auth/api-auth';
import { z } from 'zod';
import { validateInput } from '@/lib/validation/schemas';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

export const dynamic = 'force-dynamic';

const entityChangeSchema = z.object({
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
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user: _user } = authResult;

    // Parse and validate input
    const body: unknown = await request.json();
    const validation = validateInput(entityChangeSchema, body);

    if (!validation.success) {
      const validationError = validation as { success: false; errors: unknown };
      const errorDetails = (validationError.errors as { errors?: Array<{ path?: string[]; message?: string }> })?.errors?.map((e) => ({
        path: e.path?.join('.') ?? 'unknown',
        message: e.message ?? 'Validation error',
      })) ?? [];
      
      return errors.validation('Validation failed', { errors: errorDetails });
    }

    const { workspaceId, schemaId, changeType, recordId, recordData } = validation.data;

    // Handle entity change (triggers workflows)
    await handleEntityChange(
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
    const errorInstance = error instanceof Error ? error : new Error(String(error));
    logger.error('Error processing entity change', errorInstance, { route: '/api/workflows/triggers/entity' });
    return errors.internal('Failed to process entity change', errorInstance);
  }
}

