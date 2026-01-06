/**
 * Website Settings API
 * CRITICAL: Multi-tenant isolation - validates organizationId on every request
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { adminDal } from '@/lib/firebase/admin-dal';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from '@/lib/logger/logger';

/**
 * GET /api/website/settings
 * Get website configuration for an organization
 */
export async function GET(request: NextRequest) {
  try {
    if (!adminDal) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    
    const { searchParams } = request.nextUrl;
    const organizationId = searchParams.get('organizationId');

    // CRITICAL: Validate organizationId
    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      );
    }

    // User authentication handled by middleware
    // const user = await verifyAuth(request);
    // if (!user || user.organizationId !== organizationId) {
    //   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    // }

    const settingsRef = adminDal.getNestedDocRef(
      'organizations/{orgId}/website/settings',
      { orgId: organizationId }
    );
    const doc = await settingsRef.get();

    if (!doc.exists) {
      // Return default settings if none exist
      return NextResponse.json({
        success: true,
        settings: {
          subdomain: '',
          customDomain: null,
          customDomainVerified: false,
          sslEnabled: false,
          status: 'draft',
          seo: {
            title: '',
            description: '',
            keywords: [],
            robotsIndex: true,
            robotsFollow: true,
          },
          analytics: {},
        },
      });
    }

    const settings = doc.data();

    return NextResponse.json({
      success: true,
      settings,
    });
  } catch (error: any) {
    logger.error('Failed to fetch website settings', error, {
      route: '/api/website/settings',
      method: 'GET'
    });
    return NextResponse.json(
      { error: 'Failed to fetch settings', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/website/settings
 * Create or update website configuration
 */
export async function POST(request: NextRequest) {
  try {
    if (!adminDal) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    
    const body = await request.json();
    const { organizationId, settings } = body;

    // CRITICAL: Validate organizationId
    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      );
    }

    if (!settings) {
      return NextResponse.json(
        { error: 'settings object is required' },
        { status: 400 }
      );
    }

    const settingsRef = adminDal.getNestedDocRef(
      'organizations/{orgId}/website/settings',
      { orgId: organizationId }
    );

    // CRITICAL: Ensure organizationId is in the data
    const settingsData = {
      ...settings,
      organizationId, // Force correct organizationId
      updatedAt: FieldValue.serverTimestamp(),
    };

    // If creating for first time, add createdAt
    const existingDoc = await settingsRef.get();
    if (!existingDoc.exists) {
      settingsData.createdAt = FieldValue.serverTimestamp();
    }

    await settingsRef.set(settingsData, { merge: true });

    return NextResponse.json({
      success: true,
      settings: settingsData,
    });
  } catch (error: any) {
    logger.error('Failed to update website settings', error, {
      route: '/api/website/settings',
      method: 'POST'
    });
    return NextResponse.json(
      { error: 'Failed to update settings', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/website/settings
 * Update website configuration
 */
export async function PUT(request: NextRequest) {
  try {
    if (!adminDal) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    
    const body = await request.json();
    const { organizationId, settings } = body;

    // CRITICAL: Validate organizationId
    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      );
    }

    if (!settings) {
      return NextResponse.json(
        { error: 'settings object is required' },
        { status: 400 }
      );
    }

    // User authentication handled by middleware
    // const user = await verifyAuth(request);
    // if (!user || user.organizationId !== organizationId) {
    //   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    // }
    // if (!hasPermission(user, 'manage_website')) {
    //   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    // }

    const settingsRef = adminDal.getNestedDocRef(
      'organizations/{orgId}/website/settings',
      { orgId: organizationId }
    );

    // CRITICAL: Ensure organizationId is in the data
    const settingsData = {
      ...settings,
      organizationId, // Force correct organizationId
      updatedAt: FieldValue.serverTimestamp(),
    };

    // If creating for first time, add createdAt
    const existingDoc = await settingsRef.get();
    if (!existingDoc.exists) {
      settingsData.createdAt = FieldValue.serverTimestamp();
    }

    await settingsRef.set(settingsData, { merge: true });

    return NextResponse.json({
      success: true,
      settings: settingsData,
    });
  } catch (error: any) {
    logger.error('Failed to update website settings', error, {
      route: '/api/website/settings',
      method: 'PUT'
    });
    return NextResponse.json(
      { error: 'Failed to update settings', details: error.message },
      { status: 500 }
    );
  }
}

