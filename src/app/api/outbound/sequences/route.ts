/**
 * Sequences API Routes
 * GET: List sequences
 * POST: Create new sequence
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { requireFeature } from '@/lib/subscription/middleware';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { OutboundSequence } from '@/types/outbound-sequence';

/**
 * GET /api/outbound/sequences?orgId=xxx
 * List all sequences for an organization
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');

    if (!orgId) {
      return NextResponse.json(
        { success: false, error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    // Check feature access
    const featureCheck = await requireFeature(request, orgId, 'emailSequences');
    if (featureCheck) return featureCheck;

    // Get all sequences
    const sequences = await FirestoreService.getAll(
      `${COLLECTIONS.ORGANIZATIONS}/${orgId}/sequences`,
      []
    );

    return NextResponse.json({
      success: true,
      sequences,
    });
  } catch (error: any) {
    console.error('[Sequences API] Error listing sequences:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to list sequences' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/outbound/sequences
 * Create a new sequence
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body = await request.json();
    const { orgId, name, description, steps, autoEnroll = false } = body;

    if (!orgId) {
      return NextResponse.json(
        { success: false, error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Sequence name is required' },
        { status: 400 }
      );
    }

    if (!steps || !Array.isArray(steps) || steps.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one step is required' },
        { status: 400 }
      );
    }

    // Check feature access
    const featureCheck = await requireFeature(request, orgId, 'emailSequences');
    if (featureCheck) return featureCheck;

    // Create sequence
    const sequenceId = `seq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const sequence: OutboundSequence = {
      id: sequenceId,
      organizationId: orgId,
      name,
      description,
      status: 'draft',
      steps: steps.map((step: any, index: number) => ({
        id: `step_${sequenceId}_${index}`,
        sequenceId,
        order: index + 1,
        delayDays: step.delayDays || 0,
        delayHours: step.delayHours,
        sendTime: step.sendTime,
        type: step.type || 'email',
        subject: step.subject,
        body: step.body,
        conditions: step.conditions || [],
        variants: step.variants || [],
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        replied: 0,
        createdAt: now,
        updatedAt: now,
      })),
      autoEnroll,
      stopOnResponse: true,
      stopOnConversion: true,
      stopOnUnsubscribe: true,
      stopOnBounce: true,
      analytics: {
        totalEnrolled: 0,
        activeProspects: 0,
        completedProspects: 0,
        totalSent: 0,
        totalDelivered: 0,
        totalOpened: 0,
        totalClicked: 0,
        totalReplied: 0,
        totalBounced: 0,
        totalUnsubscribed: 0,
        meetingsBooked: 0,
        dealsCreated: 0,
        revenue: 0,
        deliveryRate: 0,
        openRate: 0,
        clickRate: 0,
        replyRate: 0,
        conversionRate: 0,
      },
      createdAt: now,
      updatedAt: now,
      createdBy: authResult.user.uid,
    };

    // Save sequence
    await FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${orgId}/sequences`,
      sequenceId,
      sequence,
      false
    );

    return NextResponse.json({
      success: true,
      message: 'Sequence created successfully',
      sequence,
    });
  } catch (error: any) {
    console.error('[Sequences API] Error creating sequence:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create sequence' },
      { status: 500 }
    );
  }
}

