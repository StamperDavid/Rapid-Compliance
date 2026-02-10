/**
 * Website Settings API
 * Single-tenant: Uses PLATFORM_ID
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminDal } from '@/lib/firebase/admin-dal';
import { getSubCollection } from '@/lib/firebase/collections';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

const postBodySchema = z.object({
  settings: z.record(z.unknown()).refine((val) => Object.keys(val).length > 0, {
    message: 'settings object is required',
  }),
});

const putBodySchema = z.object({
  settings: z.record(z.unknown()).refine((val) => Object.keys(val).length > 0, {
    message: 'settings object is required',
  }),
});

/**
 * GET /api/website/settings
 * Get website configuration for an organization
 */
export async function GET(_request: NextRequest) {
  try {
    if (!adminDal) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const settingsRef = adminDal.getNestedDocRef(
      `${getSubCollection('website')}/settings`
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
  } catch (error: unknown) {
    logger.error('Failed to fetch website settings', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/website/settings',
      method: 'GET'
    });
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to fetch settings', details: message },
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

    const body: unknown = await request.json();
    const bodyResult = postBodySchema.safeParse(body);

    if (!bodyResult.success) {
      return NextResponse.json(
        { error: bodyResult.error.errors[0]?.message ?? 'Invalid request body' },
        { status: 400 }
      );
    }

    const { settings } = bodyResult.data;

    const settingsRef = adminDal.getNestedDocRef(
      `${getSubCollection('website')}/settings`
    );

    const settingsData: Record<string, unknown> = {
      ...settings,
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
  } catch (error: unknown) {
    logger.error('Failed to update website settings', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/website/settings',
      method: 'POST'
    });
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to update settings', details: message },
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

    const body: unknown = await request.json();
    const bodyResult = putBodySchema.safeParse(body);

    if (!bodyResult.success) {
      return NextResponse.json(
        { error: bodyResult.error.errors[0]?.message ?? 'Invalid request body' },
        { status: 400 }
      );
    }

    const { settings } = bodyResult.data;

    const settingsRef = adminDal.getNestedDocRef(
      `${getSubCollection('website')}/settings`
    );

    const settingsData: Record<string, unknown> = {
      ...settings,
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
  } catch (error: unknown) {
    logger.error('Failed to update website settings', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/website/settings',
      method: 'PUT'
    });
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to update settings', details: message },
      { status: 500 }
    );
  }
}

