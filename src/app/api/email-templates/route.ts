/**
 * Email Templates API Routes
 * GET /api/email-templates - List user email templates
 * POST /api/email-templates - Create template
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getEmailTemplates, createEmailTemplate } from '@/lib/email/email-template-service';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { getAuthToken } from '@/lib/auth/server-auth';
import type { EmailTemplateCategory } from '@/types/email-template';

export const dynamic = 'force-dynamic';

const variableSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  defaultValue: z.string().optional(),
  description: z.string().optional(),
});

const createTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required'),
  subject: z.string().min(1, 'Subject line is required'),
  body: z.string().min(1, 'Email body is required'),
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
});

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);

    const categoryParam = searchParams.get('category');
    const validCategories = [
      'sales', 'marketing', 'transactional', 'nurture',
      'onboarding', 'follow_up', 'announcement', 'newsletter', 'custom', 'all',
    ];
    const category = categoryParam && validCategories.includes(categoryParam)
      ? categoryParam as EmailTemplateCategory | 'all'
      : undefined;

    const isActiveParam = searchParams.get('isActive');
    const isActive = isActiveParam === 'true' ? true : isActiveParam === 'false' ? false : undefined;

    const filters = { category, isActive };

    const pageSizeParam = searchParams.get('pageSize');
    const pageSize = parseInt(pageSizeParam ?? '50');

    const result = await getEmailTemplates(filters, { pageSize });

    return NextResponse.json({
      success: true,
      data: result.data,
      hasMore: result.hasMore,
      count: result.data.length,
    });
  } catch (error) {
    logger.error('Email templates GET failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const token = await getAuthToken(request);

    const rawBody: unknown = await request.json();
    const parsed = createTemplateSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const template = await createEmailTemplate({
      ...parsed.data,
      category: parsed.data.category ?? 'custom',
      variables: parsed.data.variables ?? [],
      isActive: parsed.data.isActive ?? true,
      createdBy: token?.uid,
      createdByName: token?.email ?? undefined,
    });

    return NextResponse.json({
      success: true,
      data: template,
    });
  } catch (error) {
    logger.error('Email template POST failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
