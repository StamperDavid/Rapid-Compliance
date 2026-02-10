import { type NextRequest, NextResponse } from 'next/server';
import { listForms, createForm, deleteForm } from '@/lib/forms/form-service';
import type { FormDefinition } from '@/lib/forms/types';
import { z } from 'zod';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

const deleteBodySchema = z.object({
  ids: z.array(z.string().min(1)).min(1, 'At least one ID is required'),
  workspaceId: z.string().optional().default('default'),
});

const CreateFormBodySchema = z.object({
  workspaceId: z.string().optional(),
  name: z.string().min(1, 'Form name is required'),
  description: z.string().optional(),
});

/**
 * GET /api/forms
 * List all forms for SalesVelocity.ai
 */
export async function GET(
  request: NextRequest
) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceIdParam = searchParams.get('workspaceId');
    const workspaceId = workspaceIdParam ?? 'default';
    const status = searchParams.get('status') as FormDefinition['status'] | null;
    const category = searchParams.get('category');
    const pageSizeParam = searchParams.get('pageSize');
    const pageSize = parseInt(pageSizeParam ?? '50');

    const result = await listForms(workspaceId, {
      status: status ?? undefined,
      category: category ?? undefined,
      pageSize,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch forms';
    logger.error('Failed to fetch forms:', error instanceof Error ? error : undefined);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/forms
 * Create a new form
 */
export async function POST(
  request: NextRequest
) {
  try {
    const rawBody: unknown = await request.json();
    const parseResult = CreateFormBodySchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.errors[0]?.message ?? 'Invalid form data' },
        { status: 400 }
      );
    }

    const { workspaceId: workspaceIdInput, name, description } = parseResult.data;
    const workspaceId = workspaceIdInput ?? 'default';

    // Create form with default settings
    const formData: Omit<FormDefinition, 'id' | 'createdAt' | 'updatedAt' | 'submissionCount' | 'viewCount'> = {
      name,
      description: description ?? '',
      status: 'draft',
      version: 1,
      fieldCount: 0,
      pages: [
        {
          id: `page_${Date.now()}`,
          title: 'Page 1',
          order: 0,
        },
      ],
      settings: {
        submitButtonText: 'Submit',
        showProgressBar: true,
        showPageNumbers: true,
        allowSaveDraft: false,
        confirmationType: 'message',
        confirmationMessage: 'Thank you for your submission!',
        sendEmailNotification: false,
        sendAutoReply: false,
        showBranding: true,
        enableCaptcha: false,
        requireLogin: false,
      },
      behavior: {
        maxSubmissions: 0,
        allowMultipleSubmissions: true,
        showThankYouPage: true,
        enableSaveAndContinue: false,
      },
      crmMapping: {
        enabled: false,
        entityType: 'lead',
        fieldMappings: [],
        createNew: true,
        updateExisting: false,
      },
      trackingEnabled: true,
      publicAccess: true,
      createdBy: 'system',
      lastModifiedBy: 'system',
      workspaceId,
    };

    const form = await createForm(workspaceId, formData);

    return NextResponse.json(form, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create form';
    logger.error('Failed to create form:', error instanceof Error ? error : undefined);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/forms
 * Bulk delete forms by IDs
 */
export async function DELETE(
  request: NextRequest
) {
  try {
    const body: unknown = await request.json();
    const bodyResult = deleteBodySchema.safeParse(body);

    if (!bodyResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: bodyResult.error.errors },
        { status: 400 }
      );
    }

    const { ids, workspaceId } = bodyResult.data;
    const results = await Promise.allSettled(
      ids.map(id => deleteForm(workspaceId, id))
    );

    const failed = results.filter(r => r.status === 'rejected');
    if (failed.length > 0) {
      logger.error(`Failed to delete ${failed.length}/${ids.length} forms`);
    }

    return NextResponse.json({
      deleted: ids.length - failed.length,
      failed: failed.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete forms';
    logger.error('Failed to delete forms:', error instanceof Error ? error : undefined);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
