import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { listForms, createForm } from '@/lib/forms/form-service';
import type { FormDefinition } from '@/lib/forms/types';

/**
 * GET /api/workspace/[orgId]/forms
 * List all forms for an organization
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { orgId: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceIdParam = searchParams.get('workspaceId');
    const workspaceId = workspaceIdParam || 'default';
    const status = searchParams.get('status') as FormDefinition['status'] | null;
    const category = searchParams.get('category');
    const pageSizeParam = searchParams.get('pageSize');
    const pageSize = parseInt(pageSizeParam || '50');

    const result = await listForms(params.orgId, workspaceId, {
      status: status || undefined,
      category: category || undefined,
      pageSize,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('Failed to fetch forms:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch forms';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/workspace/[orgId]/forms
 * Create a new form
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { orgId: string } }
) {
  try {
    const body = await request.json();
    const workspaceId = body.workspaceId || 'default';
    const { name, templateId, description } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Form name is required' },
        { status: 400 }
      );
    }

    // Create form with default settings
    const formData = {
      name,
      description: description || '',
      status: 'draft' as const,
      version: 1,
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
        confirmationType: 'message' as const,
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
        entityType: 'lead' as const,
        fieldMappings: [],
        createNew: true,
        updateExisting: false,
      },
      trackingEnabled: true,
      publicAccess: true,
      createdBy: 'system', // TODO: Get from auth context
      lastModifiedBy: 'system',
      organizationId: params.orgId,
      workspaceId,
    };

    const form = await createForm(params.orgId, workspaceId, formData as any);

    return NextResponse.json(form, { status: 201 });
  } catch (error: unknown) {
    console.error('Failed to create form:', error);
    const message = error instanceof Error ? error.message : 'Failed to create form';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
