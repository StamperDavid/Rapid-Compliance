import { type NextRequest, NextResponse } from 'next/server';
import { publishForm, getForm } from '@/lib/forms/form-service';
import { z } from 'zod';
import { logger } from '@/lib/logger/logger';

interface RouteContext {
  params: Promise<{ formId: string }>;
}

const PublishBodySchema = z.object({
  workspaceId: z.string().optional(),
});

/**
 * POST /api/forms/[formId]/publish
 * Publish a form (change status from draft to published)
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { formId } = await context.params;
    const rawBody: unknown = await request.json();
    const parseResult = PublishBodySchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const workspaceId = parseResult.data.workspaceId ?? 'default';

    // Check if form exists
    const form = await getForm(workspaceId, formId);

    if (!form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    // Publish the form
    await publishForm(workspaceId, formId);

    // Get updated form
    const updatedForm = await getForm(workspaceId, formId);

    return NextResponse.json({
      success: true,
      form: updatedForm,
      message: 'Form published successfully',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to publish form';
    logger.error('Failed to publish form:', error instanceof Error ? error : undefined);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
