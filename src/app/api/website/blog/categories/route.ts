/**
 * Blog Categories API
 * Manage blog categories
 * CRITICAL: Multi-tenant - scoped to organizationId
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { adminDal } from '@/lib/firebase/admin-dal';
import { logger } from '@/lib/logger/logger';

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
    const organizationId = searchParams.get('organizationId');

    // CRITICAL: Validate organizationId
    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId required' },
        { status: 400 }
      );
    }

    // Get categories document
    const categoriesRef = adminDal.getNestedDocRef(
      'organizations/{orgId}/website/blog-categories',
      { orgId: organizationId }
    );

    const categoriesDoc = await categoriesRef.get();

    if (!categoriesDoc.exists) {
      return NextResponse.json({ categories: [] });
    }

    const data = categoriesDoc.data();

    // CRITICAL: Double-check organizationId matches
    if (data?.organizationId !== organizationId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    return NextResponse.json({ categories: data.categories || [] });
  } catch (error) {
    logger.error('Failed to fetch blog categories', error, {
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
    
    const body = await request.json();
    const { organizationId, categories } = body;

    // CRITICAL: Validate organizationId
    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId required' },
        { status: 400 }
      );
    }

    if (!Array.isArray(categories)) {
      return NextResponse.json(
        { error: 'categories must be an array' },
        { status: 400 }
      );
    }

    // Save categories
    const categoriesRef = adminDal.getNestedDocRef(
      'organizations/{orgId}/website/blog-categories',
      { orgId: organizationId }
    );

    const categoriesData = {
      organizationId, // CRITICAL: Set org ownership
      categories,
      updatedAt: new Date().toISOString(),
    };

    await categoriesRef.set(categoriesData);

    return NextResponse.json({ categories });
  } catch (error) {
    logger.error('Failed to save blog categories', error, {
      route: '/api/website/blog/categories',
      method: 'POST'
    });
    return NextResponse.json(
      { error: 'Failed to save categories' },
      { status: 500 }
    );
  }
}


