import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { publishForm, getForm } from '@/lib/forms/form-service';
import { z } from 'zod';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ formId: string }>;
}

const PublishBodySchema = z.object({});

/**
 * POST /api/forms/[formId]/publish
 * Publish a form (change status from draft to published)
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { formId } = await context.params;
    const rawBody: unknown = await request.json();
    const parseResult = PublishBodySchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    // Check if form exists
    const form = await getForm(formId);

    if (!form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    // Publish the form
    await publishForm(formId);

    // Get updated form
    const updatedForm = await getForm(formId);

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
