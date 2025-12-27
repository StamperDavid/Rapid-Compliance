/**
 * Website Settings API
 * CRITICAL: Multi-tenant isolation - validates organizationId on every request
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import admin from 'firebase-admin';

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    const serviceAccount = require('@/../serviceAccountKey.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (error) {
    console.error('[Website Settings API] Firebase Admin already initialized');
  }
}

const db = getFirestore();

/**
 * GET /api/website/settings
 * Get website configuration for an organization
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const organizationId = searchParams.get('organizationId');

    // CRITICAL: Validate organizationId
    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      );
    }

    // TODO: Add user authentication and org membership validation
    // const user = await verifyAuth(request);
    // if (!user || user.organizationId !== organizationId) {
    //   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    // }

    const settingsRef = db
      .collection('organizations')
      .doc(organizationId)
      .collection('website')
      .doc('settings');

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
    console.error('[Website Settings API] GET error:', error);
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

    const settingsRef = db
      .collection('organizations')
      .doc(organizationId)
      .collection('website')
      .doc('settings');

    const now = admin.firestore.Timestamp.now();

    // CRITICAL: Ensure organizationId is in the data
    const settingsData = {
      ...settings,
      organizationId, // Force correct organizationId
      updatedAt: now,
    };

    // If creating for first time, add createdAt
    const existingDoc = await settingsRef.get();
    if (!existingDoc.exists) {
      settingsData.createdAt = now;
    }

    await settingsRef.set(settingsData, { merge: true });

    return NextResponse.json({
      success: true,
      settings: settingsData,
    });
  } catch (error: any) {
    console.error('[Website Settings API] POST error:', error);
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

    // TODO: Add user authentication and org membership validation
    // const user = await verifyAuth(request);
    // if (!user || user.organizationId !== organizationId) {
    //   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    // }
    // if (!hasPermission(user, 'manage_website')) {
    //   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    // }

    const settingsRef = db
      .collection('organizations')
      .doc(organizationId)
      .collection('website')
      .doc('settings');

    const now = admin.firestore.Timestamp.now();

    // CRITICAL: Ensure organizationId is in the data
    const settingsData = {
      ...settings,
      organizationId, // Force correct organizationId
      updatedAt: now,
    };

    // If creating for first time, add createdAt
    const existingDoc = await settingsRef.get();
    if (!existingDoc.exists) {
      settingsData.createdAt = now;
    }

    await settingsRef.set(settingsData, { merge: true });

    return NextResponse.json({
      success: true,
      settings: settingsData,
    });
  } catch (error: any) {
    console.error('[Website Settings API] PUT error:', error);
    return NextResponse.json(
      { error: 'Failed to update settings', details: error.message },
      { status: 500 }
    );
  }
}

