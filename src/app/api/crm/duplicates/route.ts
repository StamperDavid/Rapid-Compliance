/**
 * Duplicate Detection API
 * POST /api/crm/duplicates - Detect duplicates for a record
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  detectLeadDuplicates,
  detectContactDuplicates,
  detectCompanyDuplicates,
} from '@/lib/crm/duplicate-detection';
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

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

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
        result = await detectLeadDuplicates(organizationId, workspaceId, record);
        break;
      case 'contact':
        result = await detectContactDuplicates(organizationId, workspaceId, record);
        break;
      case 'company':
        result = await detectCompanyDuplicates(organizationId, workspaceId, record);
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

  } catch (error: any) {
    logger.error('Duplicate detection API failed', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

