/**
 * Templates API
 * Manage custom page templates
 * Single-tenant: Uses PLATFORM_ID
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminDal } from '@/lib/firebase/admin-dal';
import { getSubCollection } from '@/lib/firebase/collections';
import { getUserIdentifier } from '@/lib/server-auth';
import type { PageTemplate } from '@/types/website';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

const templateCategoryValues = ['business', 'saas', 'ecommerce', 'portfolio', 'agency', 'blog', 'other'] as const;

const postBodySchema = z.object({
  template: z.object({
    name: z.string().min(1, 'Template name is required'),
    description: z.string().optional(),
    category: z.enum(templateCategoryValues).optional(),
    thumbnail: z.string().optional(),
    content: z.array(z.record(z.unknown())),
    isPublic: z.boolean().optional(),
  }),
});

const deleteQuerySchema = z.object({
  templateId: z.string().min(1, 'templateId required'),
});

/**
 * GET /api/website/templates
 * List custom templates for an organization
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    if (!adminDal) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Get custom templates for this org
    const templatesRef = adminDal.getNestedCollection(
      `${getSubCollection('website')}/config/templates`
    );

    const snapshot = await templatesRef.get();
    const templates: PageTemplate[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      templates.push({
        id: doc.id,
        ...data,
      } as PageTemplate);
    });

    return NextResponse.json({ templates });
  } catch (error: unknown) {
    logger.error('Failed to fetch templates', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/website/templates',
      method: 'GET'
    });
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/website/templates
 * Create a custom template from a page
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    if (!adminDal) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const body: unknown = await request.json();
    const bodyResult = postBodySchema.safeParse(body);

    if (!bodyResult.success) {
      return NextResponse.json(
        { error: bodyResult.error.errors[0]?.message ?? 'Invalid request body' },
        { status: 400 }
      );
    }

    const { template } = bodyResult.data;

    // Create template document
    const templateData: PageTemplate = {
      id: `template_${Date.now()}`,
      name: template.name,
      description: template.description ?? '',
      category: template.category ?? 'other',
      thumbnail: template.thumbnail,
      content: template.content as unknown as PageTemplate['content'],
      isPublic: template.isPublic ?? false,
      isPremium: false,
      createdAt: new Date().toISOString(),
      createdBy: await getUserIdentifier(),
      usageCount: 0,
    };

    // Save to Firestore
    const templateRef = adminDal.getNestedDocRef(
      `${getSubCollection('website')}/config/templates/{templateId}`,
      { templateId: templateData.id }
    );

    await templateRef.set(templateData);

    return NextResponse.json({ template: templateData }, { status: 201 });
  } catch (error: unknown) {
    logger.error('Failed to create template', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/website/templates',
      method: 'POST'
    });
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/website/templates/:id
 * Delete a custom template
 */
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    if (!adminDal) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const queryResult = deleteQuerySchema.safeParse({
      templateId: searchParams.get('templateId'),
    });

    if (!queryResult.success) {
      return NextResponse.json(
        { error: queryResult.error.errors[0]?.message ?? 'Invalid query parameters' },
        { status: 400 }
      );
    }

    const { templateId } = queryResult.data;

    // Delete template
    const templateRef = adminDal.getNestedDocRef(
      `${getSubCollection('website')}/config/templates/{templateId}`,
      { templateId }
    );

    // Verify template belongs to this org
    const templateDoc = await templateRef.get();
    if (!templateDoc.exists) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    await templateRef.delete();

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error('Failed to delete template', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/website/templates',
      method: 'DELETE'
    });
    return NextResponse.json(
      { error: 'Failed to delete template' },
      { status: 500 }
    );
  }
}

