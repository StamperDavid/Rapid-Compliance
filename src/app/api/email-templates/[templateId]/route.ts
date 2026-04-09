/**
 * Email Template Detail API Routes
 * GET /api/email-templates/[templateId] - Get single template
 * PUT /api/email-templates/[templateId] - Update template
 * DELETE /api/email-templates/[templateId] - Delete template
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getEmailTemplate, updateEmailTemplate, deleteEmailTemplate } from '@/lib/email/email-template-service';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

const variableSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  defaultValue: z.string().optional(),
  description: z.string().optional(),
});

const updateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  subject: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
  preheaderText: z.string().optional(),
  category: z.enum([
    'sales', 'marketing', 'transactional', 'nurture',
    'onboarding', 'follow_up', 'announcement', 'newsletter', 'custom',
  ]).optional(),
  variables: z.array(variableSchema).optional(),
  styling: z.object({
    backgroundColor: z.string().optional(),
    primaryColor: z.string().optional(),
    fontFamily: z.string().optional(),
    headerImageUrl: z.string().optional(),
  }).optional(),
  tags: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
}).strict();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { templateId } = await params;
    const template = await getEmailTemplate(templateId);

    if (!template) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: template });
  } catch (error) {
    logger.error('Email template GET failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { templateId } = await params;
    const rawBody: unknown = await request.json();
    const parsed = updateTemplateSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const template = await updateEmailTemplate(templateId, parsed.data);

    return NextResponse.json({ success: true, data: template });
  } catch (error) {
    logger.error('Email template PUT failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { templateId } = await params;
    await deleteEmailTemplate(templateId);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Email template DELETE failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
