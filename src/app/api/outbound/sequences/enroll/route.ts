/**
 * Sequence Enrollment API
 * POST /api/outbound/sequences/enroll
 * Enroll prospects in sequences
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { SequenceEngine } from '@/lib/outbound/sequence-engine';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

export const dynamic = 'force-dynamic';

const SequenceEnrollSchema = z.object({
  sequenceId: z.string().min(1),
  prospectIds: z.array(z.string().min(1)).min(1),
});

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/outbound/sequences/enroll');
    if (rateLimitResponse) { return rateLimitResponse; }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    const parsed = SequenceEnrollSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { sequenceId, prospectIds } = parsed.data;

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



















