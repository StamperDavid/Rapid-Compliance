/**
 * API endpoint to apply an approved Golden Master update
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { applyUpdateRequest } from '@/lib/training/golden-master-updater';
import type { GoldenMasterUpdateRequest } from '@/types/training';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { getSubCollection } from '@/lib/firebase/collections';

export const dynamic = 'force-dynamic';

const ApplyUpdateSchema = z.object({
  updateRequestId: z.string().min(1, 'Update request ID is required'),
  approved: z.boolean(),
  reviewNotes: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/training/apply-update');
    if (rateLimitResponse) {return rateLimitResponse;}

    // Authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    // Parse and validate request
    const body: unknown = await request.json();
    const parseResult = ApplyUpdateSchema.safeParse(body);
    if (!parseResult.success) {
      return errors.badRequest(parseResult.error.errors[0]?.message ?? 'Invalid request body');
    }
    const { updateRequestId, approved, reviewNotes } = parseResult.data;

    // Get the update request
    const updateRequest = await AdminFirestoreService.get(
      getSubCollection('goldenMasterUpdates'),
      updateRequestId
    ) as unknown as GoldenMasterUpdateRequest;

    if (!updateRequest) {
      return NextResponse.json(
        { success: false, error: 'Update request not found' },
        { status: 404 }
      );
    }

    if (updateRequest.status !== 'pending_review') {
      return NextResponse.json(
        { success: false, error: 'Update request has already been reviewed' },
        { status: 400 }
      );
    }

    if (!approved) {
      // Reject the update request
      await AdminFirestoreService.set(
        getSubCollection('goldenMasterUpdates'),
        updateRequestId,
        {
          ...updateRequest,
          status: 'rejected',
          reviewedBy: user.uid,
          reviewedAt: new Date().toISOString(),
          reviewNotes:(reviewNotes !== '' && reviewNotes != null) ? reviewNotes : 'Rejected by user',
        },
        false
      );

      return NextResponse.json({
        success: true,
        message: 'Update request rejected',
      });
    }

    // Approve and apply the update request
    await AdminFirestoreService.set(
      getSubCollection('goldenMasterUpdates'),
      updateRequestId,
      {
        ...updateRequest,
        status: 'approved',
        reviewedBy: user.uid,
        reviewedAt: new Date().toISOString(),
        reviewNotes:(reviewNotes !== '' && reviewNotes != null) ? reviewNotes : 'Approved by user',
      },
      false
    );

    // Apply the updates to create a new Golden Master version
    const newGoldenMaster = await applyUpdateRequest(updateRequest);

    return NextResponse.json({
      success: true,
      message: 'Update applied successfully',
      newGoldenMaster,
    });
  } catch (error: unknown) {
    logger.error('Error applying update', error instanceof Error ? error : new Error(String(error)), { route: '/api/training/apply-update' });
    return errors.database('Failed to apply update', error instanceof Error ? error : undefined);
  }
}



















