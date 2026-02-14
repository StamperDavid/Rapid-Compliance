/**
 * Sequences API Routes
 * GET: List sequences
 * POST: Create new sequence
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import type { OutboundSequence, SequenceStep, SequenceStepVariant } from '@/types/outbound-sequence';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { PLATFORM_ID } from '@/lib/constants/platform';

export const dynamic = 'force-dynamic';

type StepType = 'email' | 'linkedin_message' | 'sms' | 'call_task' | 'manual_task';

const sendTimeSchema = z.object({
  hour: z.number().int().min(0).max(23),
  minute: z.number().int().min(0).max(59),
  timezone: z.string(),
}).optional();

const stepConditionSchema = z.object({
  type: z.enum(['opened_previous', 'clicked_previous', 'not_opened_previous', 'replied', 'not_replied', 'custom_field']),
  value: z.unknown().optional(),
});

const sequenceStepVariantSchema = z.object({
  id: z.string(),
  subject: z.string().optional(),
  body: z.string(),
  weight: z.number().min(0).max(100).optional(),
});

const sequenceStepInputSchema = z.object({
  delayDays: z.number().int().min(0).optional(),
  delayHours: z.number().int().min(0).optional(),
  sendTime: sendTimeSchema,
  type: z.enum(['email', 'linkedin_message', 'sms', 'call_task', 'manual_task']).optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
  conditions: z.array(stepConditionSchema).optional(),
  variants: z.array(sequenceStepVariantSchema).optional(),
});

const sequenceCreateRequestSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  steps: z.array(sequenceStepInputSchema).min(1).max(50),
  autoEnroll: z.boolean().optional().default(false),
});

function isValidStepType(value: string): value is StepType {
  return ['email', 'linkedin_message', 'sms', 'call_task', 'manual_task'].includes(value);
}

/**
 * GET /api/outbound/sequences?PLATFORM_ID=xxx&page=1&limit=50
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
    const limitParam = searchParams.get('limit');
    const pageSize = parseInt((limitParam !== '' && limitParam != null) ? limitParam : '50');

    // NEW PRICING MODEL: All features available to all active subscriptions
    // Feature check no longer needed - everyone gets email sequences!
    // const featureCheck = await requireFeature(request, PLATFORM_ID, 'emailSequences');
    // if (featureCheck) return featureCheck;

    // Get sequences with pagination
    const { orderBy } = await import('firebase/firestore');
    const result = await FirestoreService.getAllPaginated(
      `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/sequences`,
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
  } catch (error) {
    logger.error('Error listing sequences', error instanceof Error ? error : new Error(String(error)), { route: '/api/outbound/sequences' });
    return errors.database('Failed to list sequences', error instanceof Error ? error : undefined);
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

    const body: unknown = await request.json();
    const parseResult = sequenceCreateRequestSchema.safeParse(body);

    if (!parseResult.success) {
      const errorMessage = parseResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return errors.badRequest(`Invalid request body: ${errorMessage}`);
    }

    const { name, description, steps, autoEnroll } = parseResult.data;

    // NEW PRICING MODEL: All features available to all active subscriptions
    // Feature check no longer needed - everyone gets email sequences!
    // const featureCheck = await requireFeature(request, PLATFORM_ID, 'emailSequences');
    // if (featureCheck) return featureCheck;

    // Create sequence
    const sequenceId = `seq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const mappedSteps: SequenceStep[] = steps.map((step, index: number) => {
      const stepType: StepType = step.type && isValidStepType(step.type) ? step.type : 'email';

      // Map variants to include analytics fields
      const mappedVariants: SequenceStepVariant[] = (step.variants ?? []).map(variant => ({
        id: variant.id,
        subject: variant.subject,
        body: variant.body,
        weight: variant.weight ?? 0,
        sent: 0,
        opened: 0,
        clicked: 0,
        replied: 0,
      }));

      return {
        id: `step_${sequenceId}_${index}`,
        sequenceId,
        order: index + 1,
        delayDays: step.delayDays ?? 0,
        delayHours: step.delayHours,
        sendTime: step.sendTime,
        type: stepType,
        subject: step.subject,
        body: step.body ?? '',
        conditions: step.conditions ?? [],
        variants: mappedVariants,
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        replied: 0,
        createdAt: now,
        updatedAt: now,
      };
    });

    const sequence: OutboundSequence = {
      id: sequenceId,
      name,
      description,
      status: 'draft',
      steps: mappedSteps,
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
      `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/sequences`,
      sequenceId,
      sequence,
      false
    );

    return NextResponse.json({
      success: true,
      message: 'Sequence created successfully',
      sequence,
    });
  } catch (error) {
    logger.error('Error creating sequence', error instanceof Error ? error : new Error(String(error)), { route: '/api/outbound/sequences' });
    return errors.database('Failed to create sequence', error instanceof Error ? error : undefined);
  }
}

