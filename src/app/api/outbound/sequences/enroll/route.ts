/**
 * Sequence Enrollment API
 * POST /api/outbound/sequences/enroll
 * Enroll prospects in sequences
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { requireFeature } from '@/lib/subscription/middleware';
import { SequenceEngine } from '@/lib/outbound/sequence-engine';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/outbound/sequences/enroll');
    if (rateLimitResponse) {return rateLimitResponse;}

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body = await request.json();
    const { orgId, sequenceId, prospectIds } = body;

    if (!orgId) {
      return NextResponse.json(
        { success: false, error: 'Organization ID is required' },
        { status: 400 }
      );
    }

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

    // NEW PRICING MODEL: All features available to all active subscriptions
    // Feature check no longer needed - everyone gets sequence enrollment!
    // const featureCheck = await requireFeature(request, orgId, 'emailSequences');
    // if (featureCheck) return featureCheck;

    // Enroll each prospect
    const results = await Promise.allSettled(
      prospectIds.map(prospectId => 
        SequenceEngine.enrollProspect(prospectId, sequenceId, orgId)
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
  } catch (error: any) {
    logger.error('Error enrolling prospects in sequence', error, { route: '/api/outbound/sequences/enroll' });
    return errors.database('Failed to enroll prospects', error);
  }
}



















