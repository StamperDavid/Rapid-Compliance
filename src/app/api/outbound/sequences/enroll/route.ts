/**
 * Sequence Enrollment API
 * POST /api/outbound/sequences/enroll
 * Enroll prospects in sequences
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { requireFeature } from '@/lib/subscription/middleware';
import { SequenceEngine } from '@/lib/outbound/sequence-engine';

export async function POST(request: NextRequest) {
  try {
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

    // Check feature access
    const featureCheck = await requireFeature(request, orgId, 'emailSequences');
    if (featureCheck) return featureCheck;

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
    console.error('[Sequences API] Error enrolling prospects:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to enroll prospects' },
      { status: 500 }
    );
  }
}





