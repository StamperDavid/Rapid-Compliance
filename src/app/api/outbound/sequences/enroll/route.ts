/**
 * Sequence Enrollment API
 * POST /api/outbound/sequences/enroll
 * Enroll prospects in sequences
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { SequenceEngine } from '@/lib/outbound/sequence-engine';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

export const dynamic = 'force-dynamic';

interface SequenceEnrollRequestBody {
  sequenceId?: string;
  prospectIds?: string[];
}

function isSequenceEnrollRequestBody(value: unknown): value is SequenceEnrollRequestBody {
  return typeof value === 'object' && value !== null;
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/outbound/sequences/enroll');
    if (rateLimitResponse) { return rateLimitResponse; }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    if (!isSequenceEnrollRequestBody(body)) {
      return errors.badRequest('Invalid request body');
    }

    const { sequenceId, prospectIds } = body;

    if (!sequenceId) {
      return NextResponse.json(
        { success: false, error: 'Sequence ID is required' },
        { status: 400 }
      );
    }

    if (!prospectIds || !Array.isArray(prospectIds) || prospectIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one prospect ID is required' },
        { status: 400 }
      );
    }

    // Penthouse model: All features available

    // Enroll each prospect
    const results = await Promise.allSettled(
      prospectIds.map(prospectId =>
        SequenceEngine.enrollProspect(prospectId, sequenceId)
      )
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return NextResponse.json({
      success: true,
      message: `Enrolled ${successful} prospects (${failed} failed)`,
      results: {
        successful,
        failed,
        total: prospectIds.length,
      },
    });
  } catch (error) {
    logger.error('Error enrolling prospects in sequence', error instanceof Error ? error : new Error(String(error)), { route: '/api/outbound/sequences/enroll' });
    return errors.database('Failed to enroll prospects', error instanceof Error ? error : undefined);
  }
}



















