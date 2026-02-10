/**
 * Duplicate Detection API
 * POST /api/crm/duplicates - Detect duplicates for a record
 */

import { type NextRequest, NextResponse } from 'next/server';
import {
  detectLeadDuplicates,
  detectContactDuplicates,
  detectCompanyDuplicates,
} from '@/lib/crm/duplicate-detection';
import { logger } from '@/lib/logger/logger';
import { getAuthToken } from '@/lib/auth/server-auth';

export const dynamic = 'force-dynamic';

interface RequestPayload {
  entityType: 'lead' | 'contact' | 'company';
  record: Record<string, unknown>;
  workspaceId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const token = await getAuthToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as RequestPayload;

    const { entityType, record, workspaceId = 'default' } = body;

    if (!entityType || !record) {
      return NextResponse.json(
        { error: 'entityType and record are required' },
        { status: 400 }
      );
    }

    let result;

    switch (entityType) {
      case 'lead':
        result = await detectLeadDuplicates(workspaceId, record);
        break;
      case 'contact':
        result = await detectContactDuplicates(workspaceId, record);
        break;
      case 'company':
        result = await detectCompanyDuplicates(workspaceId, record);
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid entity type' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      data: result,
    });

  } catch (error) {
    logger.error('Duplicate detection API failed', error instanceof Error ? error : new Error(String(error)));
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
