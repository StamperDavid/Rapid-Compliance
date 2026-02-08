/**
 * Navigation API
 * Manage site navigation (header menu, footer)
 * Single-tenant: Uses PLATFORM_ID
 */

import { type NextRequest, NextResponse } from 'next/server';
import { adminDal } from '@/lib/firebase/admin-dal';
import type { Navigation } from '@/types/website';
import { logger } from '@/lib/logger/logger';

interface RequestBody {
  navigation?: Partial<Navigation>;
}

/**
 * GET /api/website/navigation
 * Get navigation for an organization
 */
export async function GET(_request: NextRequest) {
  try {
    if (!adminDal) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Get navigation document
    const navRef = adminDal.getNestedDocRef(
      'organizations/rapid-compliance-root/website/navigation'
    );

    const navDoc = await navRef.get();

    if (!navDoc.exists) {
      return NextResponse.json(
        { error: 'Navigation not found' },
        { status: 404 }
      );
    }

    const navigationData = navDoc.data() as Navigation;

    return NextResponse.json({ navigation: navigationData });
  } catch (error) {
    logger.error('Failed to fetch navigation', error instanceof Error ? error : new Error(String(error)), {
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
    const { navigation } = body;

    // Validate navigation data
    if (!navigation) {
      return NextResponse.json(
        { error: 'Invalid navigation data' },
        { status: 400 }
      );
    }

    const navigationData: Navigation = {
      ...navigation,
      id: 'navigation',
      updatedAt: new Date().toISOString(),
    } as Navigation;

    // Save to Firestore
    const navRef = adminDal.getNestedDocRef(
      'organizations/rapid-compliance-root/website/navigation'
    );

    await navRef.set(navigationData);

    return NextResponse.json({ navigation: navigationData });
  } catch (error) {
    logger.error('Failed to save navigation', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/website/navigation',
      method: 'POST'
    });
    return NextResponse.json(
      { error: 'Failed to save navigation' },
      { status: 500 }
    );
  }
}
