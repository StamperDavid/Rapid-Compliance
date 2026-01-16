/**
 * Navigation API
 * Manage site navigation (header menu, footer)
 * CRITICAL: Multi-tenant - scoped to organizationId
 */

import { type NextRequest, NextResponse } from 'next/server';
import { adminDal } from '@/lib/firebase/admin-dal';
import type { Navigation } from '@/types/website';
import { logger } from '@/lib/logger/logger';

interface RequestBody {
  organizationId?: string;
  navigation?: Partial<Navigation>;
}

/**
 * GET /api/website/navigation
 * Get navigation for an organization
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

    // Get navigation document
    const navRef = adminDal.getNestedDocRef(
      'organizations/{orgId}/website/navigation',
      { orgId: organizationId }
    );

    const navDoc = await navRef.get();

    if (!navDoc.exists) {
      return NextResponse.json(
        { error: 'Navigation not found' },
        { status: 404 }
      );
    }

    const navigationData = navDoc.data() as Navigation;

    // CRITICAL: Double-check organizationId matches
    if (navigationData.organizationId !== organizationId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    return NextResponse.json({ navigation: navigationData });
  } catch (error) {
    logger.error('Failed to fetch navigation', error, {
      route: '/api/website/navigation',
      method: 'GET'
    });
    return NextResponse.json(
      { error: 'Failed to fetch navigation' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/website/navigation
 * Create or update navigation
 */
export async function POST(request: NextRequest) {
  try {
    if (!adminDal) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const body = await request.json() as RequestBody;
    const { organizationId, navigation } = body;

    // CRITICAL: Validate organizationId
    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId required' },
        { status: 400 }
      );
    }

    // Validate navigation data
    if (!navigation) {
      return NextResponse.json(
        { error: 'Invalid navigation data' },
        { status: 400 }
      );
    }

    // Ensure organizationId is set
    const navigationData: Navigation = {
      ...navigation,
      id: 'navigation',
      organizationId, // CRITICAL: Set org ownership
      updatedAt: new Date().toISOString(),
    } as Navigation;

    // Save to Firestore
    const navRef = adminDal.getNestedDocRef(
      'organizations/{orgId}/website/navigation',
      { orgId: organizationId }
    );

    await navRef.set(navigationData);

    return NextResponse.json({ navigation: navigationData });
  } catch (error) {
    logger.error('Failed to save navigation', error, {
      route: '/api/website/navigation',
      method: 'POST'
    });
    return NextResponse.json(
      { error: 'Failed to save navigation' },
      { status: 500 }
    );
  }
}
