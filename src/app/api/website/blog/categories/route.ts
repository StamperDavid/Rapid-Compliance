/**
 * Blog Categories API
 * Manage blog categories
 * CRITICAL: Multi-tenant - scoped to organizationId
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminDal } from '@/lib/firebase/admin-dal';
import { logger } from '@/lib/logger/logger';

const getQuerySchema = z.object({
  organizationId: z.string().min(1, 'organizationId is required'),
});

const postBodySchema = z.object({
  organizationId: z.string().min(1, 'organizationId is required'),
  categories: z.array(z.string()),
});

interface CategoriesDocData {
  organizationId?: string;
  categories?: string[];
}

/**
 * GET /api/website/blog/categories
 * Get categories for an organization
 */
export async function GET(request: NextRequest) {
  try {
    if (!adminDal) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const queryResult = getQuerySchema.safeParse({
      organizationId: searchParams.get('organizationId'),
    });

    if (!queryResult.success) {
      return NextResponse.json(
        { error: 'organizationId required' },
        { status: 400 }
      );
    }

    const { organizationId } = queryResult.data;

    // Get categories document
    const categoriesRef = adminDal.getNestedDocRef(
      'organizations/{orgId}/website/blog-categories',
      { orgId: organizationId }
    );

    const categoriesDoc = await categoriesRef.get();

    if (!categoriesDoc.exists) {
      return NextResponse.json({ categories: [] });
    }

    const data = categoriesDoc.data() as CategoriesDocData | undefined;

    // CRITICAL: Double-check organizationId matches
    if (data?.organizationId !== organizationId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    return NextResponse.json({ categories: data.categories ?? [] });
  } catch (error: unknown) {
    logger.error('Failed to fetch blog categories', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/website/blog/categories',
      method: 'GET'
    });
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/website/blog/categories
 * Save categories for an organization
 */
export async function POST(request: NextRequest) {
  try {
    if (!adminDal) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const body: unknown = await request.json();
    const bodyResult = postBodySchema.safeParse(body);

    if (!bodyResult.success) {
      const firstError = bodyResult.error.errors[0];
      return NextResponse.json(
        { error: firstError?.message ?? 'Invalid request body' },
        { status: 400 }
      );
    }

    const { organizationId, categories } = bodyResult.data;

    // Save categories
    const categoriesRef = adminDal.getNestedDocRef(
      'organizations/{orgId}/website/blog-categories',
      { orgId: organizationId }
    );

    const categoriesData = {
      organizationId,
      categories,
      updatedAt: new Date().toISOString(),
    };

    await categoriesRef.set(categoriesData);

    return NextResponse.json({ categories });
  } catch (error: unknown) {
    logger.error('Failed to save blog categories', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/website/blog/categories',
      method: 'POST'
    });
    return NextResponse.json(
      { error: 'Failed to save categories' },
      { status: 500 }
    );
  }
}
