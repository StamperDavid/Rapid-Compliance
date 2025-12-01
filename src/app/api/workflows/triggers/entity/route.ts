import { NextRequest, NextResponse } from 'next/server';
import { handleEntityChange } from '@/lib/workflows/triggers/firestore-trigger';
import { requireAuth, requireOrganization } from '@/lib/auth/api-auth';
import { z } from 'zod';
import { validateInput } from '@/lib/validation/schemas';

const entityChangeSchema = z.object({
  organizationId: z.string(),
  workspaceId: z.string(),
  schemaId: z.string(),
  changeType: z.enum(['created', 'updated', 'deleted']),
  recordId: z.string(),
  recordData: z.record(z.any()),
});

/**
 * Handle entity change trigger
 * This endpoint is called when an entity is created/updated/deleted
 * In production, this would be a Cloud Function trigger
 */
export async function POST(request: NextRequest) {
  try {
    // Authentication
    const authResult = await requireOrganization(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    // Parse and validate input
    const body = await request.json();
    const validation = validateInput(entityChangeSchema, body);

    if (!validation.success) {
      const validationError = validation as { success: false; errors: any };
      const errorDetails = validationError.errors?.errors?.map((e: any) => ({
        path: e.path?.join('.') || 'unknown',
        message: e.message || 'Validation error',
      })) || [];
      
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: errorDetails,
        },
        { status: 400 }
      );
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
  } catch (error: any) {
    console.error('Error handling entity change:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to process entity change' },
      { status: 500 }
    );
  }
}

