/**
 * Duplicate Detection API
 * POST /api/crm/duplicates - Detect duplicates for a record
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  detectLeadDuplicates,
  detectContactDuplicates,
  detectCompanyDuplicates,
} from '@/lib/crm/duplicate-detection';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { getAuthToken } from '@/lib/auth/server-auth';

export const dynamic = 'force-dynamic';

const duplicateRequestSchema = z.object({
  entityType: z.enum(['lead', 'contact', 'company']),
  record: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).refine(
    (r) => Object.keys(r).length > 0,
    { message: 'record must contain at least one field' },
  ),
});

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const token = await getAuthToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rawBody: unknown = await request.json();
    const parsed = duplicateRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { entityType, record } = parsed.data;

    let result;

    switch (entityType) {
      case 'lead':
        result = await detectLeadDuplicates(record);
        break;
      case 'contact':
        result = await detectContactDuplicates(record);
        break;
      case 'company':
        result = await detectCompanyDuplicates(record);
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
