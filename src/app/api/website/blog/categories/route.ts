/**
 * Blog Categories API
 * Manage blog categories
 * Single-tenant: Uses PLATFORM_ID
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminDal } from '@/lib/firebase/admin-dal';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';

const postBodySchema = z.object({
  categories: z.array(z.string()),
});

interface CategoriesDocData {
  categories?: string[];
}

/**
 * GET /api/website/blog/categories
 * Get categories for an organization
 */
export async function GET(_request: NextRequest) {
  try {
    if (!adminDal) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Get categories document
    const categoriesRef = adminDal.getNestedDocRef(
      `${getSubCollection('website')}/blog-categories`
    );

    const categoriesDoc = await categoriesRef.get();

    if (!categoriesDoc.exists) {
      return NextResponse.json({ categories: [] });
    }

    const data = categoriesDoc.data() as CategoriesDocData | undefined;

    return NextResponse.json({ categories: data?.categories ?? [] });
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

    const { categories } = bodyResult.data;

    // Save categories
    const categoriesRef = adminDal.getNestedDocRef(
      `${getSubCollection('website')}/blog-categories`
    );

    const categoriesData = {
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
