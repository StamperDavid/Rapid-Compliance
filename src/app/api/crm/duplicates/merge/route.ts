/**
 * Merge Duplicates API
 * POST /api/crm/duplicates/merge - Merge two duplicate records
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { mergeRecords } from '@/lib/crm/duplicate-detection';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { getAuthToken } from '@/lib/auth/server-auth';
import type { RelatedEntityType } from '@/types/activity';

export const dynamic = 'force-dynamic';

// Zod schema for request validation
const MergeRequestSchema = z.object({
  entityType: z.enum(['lead', 'contact', 'company', 'deal', 'opportunity']),
  keepId: z.string().min(1, 'keepId is required'),
  mergeId: z.string().min(1, 'mergeId is required'),
  workspaceId: z.string().optional().default('default'),
});

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const token = await getAuthToken(request);
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body: unknown = await request.json();
    const validation = MergeRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request body',
          details: validation.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        },
        { status: 400 }
      );
    }

    const { entityType, keepId, mergeId, workspaceId } = validation.data;

    const merged: unknown = await mergeRecords(
      workspaceId,
      entityType as RelatedEntityType,
      keepId,
      mergeId
    );

    return NextResponse.json({
      success: true,
      data: merged,
      message: 'Records merged successfully',
    });

  } catch (error) {
    logger.error('Merge API failed', error instanceof Error ? error : new Error(String(error)));
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
