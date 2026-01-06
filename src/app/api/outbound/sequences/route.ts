/**
 * Sequences API Routes
 * GET: List sequences
 * POST: Create new sequence
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { requireFeature } from '@/lib/subscription/middleware';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import type { OutboundSequence } from '@/types/outbound-sequence';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

/**
 * GET /api/outbound/sequences?orgId=xxx&page=1&limit=50
 * List sequences for an organization with pagination
 */
export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/outbound/sequences');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');
    const pageSize = parseInt(searchParams.get('limit') || '50');
    const cursor = searchParams.get('cursor'); // For pagination

    if (!orgId) {
      return NextResponse.json(
        { success: false, error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    // NEW PRICING MODEL: All features available to all active subscriptions
    // Feature check no longer needed - everyone gets email sequences!
    // const featureCheck = await requireFeature(request, orgId, 'emailSequences');
    // if (featureCheck) return featureCheck;

    // Get sequences with pagination
    const { orderBy } = await import('firebase/firestore');
    const result = await FirestoreService.getAllPaginated(
      `${COLLECTIONS.ORGANIZATIONS}/${orgId}/sequences`,
      [orderBy('createdAt', 'desc')],
      Math.min(pageSize, 100) // Max 100 per page
    );

    return NextResponse.json({
      success: true,
      sequences: result.data,
      pagination: {
        hasMore: result.hasMore,
        pageSize: result.data.length,
      },
    });
  } catch (error: any) {
    logger.error('Error listing sequences', error, { route: '/api/outbound/sequences' });
    return errors.database('Failed to list sequences', error);
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
      return errors.badRequest('Organization ID is required');
    }

    if (!name) {
      return errors.badRequest('Sequence name is required');
    }

    if (!steps || !Array.isArray(steps) || steps.length === 0) {
      return errors.badRequest('At least one step is required');
    }

    // NEW PRICING MODEL: All features available to all active subscriptions
    // Feature check no longer needed - everyone gets email sequences!
    // const featureCheck = await requireFeature(request, orgId, 'emailSequences');
    // if (featureCheck) return featureCheck;

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
    logger.error('Error creating sequence', error, { route: '/api/outbound/sequences' });
    return errors.database('Failed to create sequence', error);
  }
}

