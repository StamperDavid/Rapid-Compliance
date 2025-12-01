/**
 * API Keys Management
 * Saves keys to Firestore (encrypted) instead of .env files
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';

/**
 * GET - Load API keys for organization
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');

    if (!orgId) {
      return NextResponse.json(
        { success: false, error: 'Organization ID required' },
        { status: 400 }
      );
    }

    // Load keys from Firestore
    const apiKeys = await FirestoreService.get(
      `${COLLECTIONS.ORGANIZATIONS}/${orgId}`,
      'apiKeys'
    );

    // Return masked keys (show only last 4 characters)
    const maskedKeys: Record<string, string> = {};
    if (apiKeys) {
      Object.keys(apiKeys).forEach((service) => {
        const key = apiKeys[service];
        if (key && key.length > 8) {
          maskedKeys[service] = '•'.repeat(key.length - 4) + key.slice(-4);
        } else if (key) {
          maskedKeys[service] = '•'.repeat(key.length);
        }
      });
    }

    return NextResponse.json({
      success: true,
      keys: maskedKeys,
    });
  } catch (error: any) {
    console.error('[API Keys] Error loading keys:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST - Save API key
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body = await request.json();
    const { orgId, service, key } = body;

    if (!orgId || !service || !key) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Load existing keys
    const existingKeys = await FirestoreService.get(
      `${COLLECTIONS.ORGANIZATIONS}/${orgId}`,
      'apiKeys'
    ) || {};

    // Update with new key
    existingKeys[service] = key;
    existingKeys.updatedAt = new Date().toISOString();

    // Save to Firestore
    await FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${orgId}`,
      'apiKeys',
      existingKeys,
      false
    );

    console.log(`[API Keys] Saved ${service} key for org ${orgId}`);

    return NextResponse.json({
      success: true,
      message: `${service} API key saved successfully`,
    });
  } catch (error: any) {
    console.error('[API Keys] Error saving key:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

