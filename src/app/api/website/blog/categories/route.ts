/**
 * Blog Categories API
 * Manage blog categories
 * CRITICAL: Multi-tenant - scoped to organizationId
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

/**
 * GET /api/website/blog/categories
 * Get categories for an organization
 */
export async function GET(request: NextRequest) {
  try {
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
    const categoriesRef = db
      .collection('organizations')
      .doc(organizationId)
      .collection('website')
      .doc('blog-categories');

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
    console.error('[Blog Categories API] GET error:', error);
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
    const categoriesRef = db
      .collection('organizations')
      .doc(organizationId) // CRITICAL: Scoped to org
      .collection('website')
      .doc('blog-categories');

    const categoriesData = {
      organizationId, // CRITICAL: Set org ownership
      categories,
      updatedAt: new Date().toISOString(),
    };

    await categoriesRef.set(categoriesData);

    return NextResponse.json({ categories });
  } catch (error) {
    console.error('[Blog Categories API] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to save categories' },
      { status: 500 }
    );
  }
}


