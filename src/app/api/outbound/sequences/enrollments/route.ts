/**
 * Sequence Enrollments API Route
 * GET: List prospect enrollments across outbound sequences.
 *
 * Reads the `sequenceEnrollments` sub-collection
 * (organizations/{org}/sequenceEnrollments) via the Admin SDK — the same path
 * the sequences page previously read directly with the client SDK.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import type { ProspectEnrollment } from '@/types/outbound-sequence';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/outbound/sequences/enrollments - List all enrollments
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const enrollments = await AdminFirestoreService.getAll<ProspectEnrollment>(
      getSubCollection('sequenceEnrollments')
    );

    return NextResponse.json({ success: true, enrollments });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch enrollments';
    logger.error('Failed to fetch sequence enrollments', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
