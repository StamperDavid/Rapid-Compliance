/**
 * Merge Duplicates API
 * POST /api/crm/duplicates/merge - Merge two duplicate records
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';
import { getAuthToken } from '@/lib/auth/server-auth';

export const dynamic = 'force-dynamic';

// Zod schema for request validation
const MergeRequestSchema = z.object({
  entityType: z.enum(['lead', 'contact', 'company', 'deal', 'opportunity']),
  keepId: z.string().min(1, 'keepId is required'),
  mergeId: z.string().min(1, 'mergeId is required'),
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

    const { entityType, keepId, mergeId } = validation.data;

    // Use batch write for transaction safety
    const collectionPath = `${await import('@/lib/firebase/collections').then(m => m.getSubCollection('workspaces'))}/default/entities/${entityType}s/records`;
    const { FirestoreService } = await import('@/lib/db/firestore-service');

    // Get both records
    const keepRecord = await FirestoreService.get<Record<string, unknown>>(collectionPath, keepId);
    const mergeRecord = await FirestoreService.get<Record<string, unknown>>(collectionPath, mergeId);

    if (!keepRecord || !mergeRecord) {
      return NextResponse.json(
        { success: false, error: 'One or both records not found' },
        { status: 404 }
      );
    }

    // Merge data (keep newer/non-empty values)
    const merged: Record<string, unknown> = { ...keepRecord };
    for (const key in mergeRecord) {
      if (['id', 'createdAt', 'updatedAt'].includes(key)) {
        continue;
      }
      const mergedValue = merged[key];
      const mergeValue = mergeRecord[key];
      if (!mergedValue && mergeValue) {
        merged[key] = mergeValue;
      }
      if (Array.isArray(mergedValue) && Array.isArray(mergeValue)) {
        merged[key] = Array.from(new Set([...(mergedValue as unknown[]), ...(mergeValue as unknown[])]));
      }
    }
    merged.updatedAt = new Date().toISOString();

    // Batch write for atomicity
    await FirestoreService.batchWrite([
      {
        type: 'update',
        collectionPath,
        docId: keepId,
        data: merged,
      },
      {
        type: 'delete',
        collectionPath,
        docId: mergeId,
      },
    ]);

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
