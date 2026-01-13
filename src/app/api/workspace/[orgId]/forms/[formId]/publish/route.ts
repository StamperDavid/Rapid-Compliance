import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { publishForm, getForm } from '@/lib/forms/form-service';

/**
 * POST /api/workspace/[orgId]/forms/[formId]/publish
 * Publish a form (change status from draft to published)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { orgId: string; formId: string } }
) {
  try {
    const body = await request.json();
    const workspaceId = body.workspaceId || 'default';

    // Check if form exists
    const form = await getForm(params.orgId, workspaceId, params.formId);

    if (!form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    // Publish the form
    await publishForm(params.orgId, workspaceId, params.formId);

    // Get updated form
    const updatedForm = await getForm(params.orgId, workspaceId, params.formId);

    return NextResponse.json({
      success: true,
      form: updatedForm,
      message: 'Form published successfully',
    });
  } catch (error: unknown) {
    console.error('Failed to publish form:', error);
    const message = error instanceof Error ? error.message : 'Failed to publish form';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
