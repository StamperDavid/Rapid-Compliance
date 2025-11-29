/**
 * API endpoint to deploy a Golden Master version to production
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { deployGoldenMaster } from '@/lib/training/golden-master-updater';

export async function POST(request: NextRequest) {
  try {
    // Authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    // Parse request
    const body = await request.json();
    const { organizationId, goldenMasterId } = body;

    if (!organizationId || !goldenMasterId) {
      return NextResponse.json(
        { success: false, error: 'Organization ID and Golden Master ID required' },
        { status: 400 }
      );
    }

    // Verify access
    if (user.organizationId !== organizationId) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    // Deploy the Golden Master
    await deployGoldenMaster(organizationId, goldenMasterId);

    return NextResponse.json({
      success: true,
      message: 'Golden Master deployed to production',
    });
  } catch (error: any) {
    console.error('Error deploying Golden Master:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to deploy Golden Master' },
      { status: 500 }
    );
  }
}

