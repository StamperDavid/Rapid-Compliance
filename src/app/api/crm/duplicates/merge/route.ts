/**
 * Merge Duplicates API
 * POST /api/crm/duplicates/merge - Merge two duplicate records
 */

import { NextRequest, NextResponse } from 'next/server';
import { mergeRecords } from '@/lib/crm/duplicate-detection';
import { logger } from '@/lib/logger/logger';
import { getAuthToken } from '@/lib/auth/server-auth';

export async function POST(request: NextRequest) {
  try {
    const token = await getAuthToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const organizationId = token.organizationId;
    const { entityType, keepId, mergeId, workspaceId = 'default' } = body;

    if (!entityType || !keepId || !mergeId) {
      return NextResponse.json(
        { error: 'entityType, keepId, and mergeId are required' },
        { status: 400 }
      );
    }

    const merged = await mergeRecords(
      organizationId,
      workspaceId,
      entityType,
      keepId,
      mergeId
    );

    return NextResponse.json({
      success: true,
      data: merged,
      message: 'Records merged successfully',
    });

  } catch (error: any) {
    logger.error('Merge API failed', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

