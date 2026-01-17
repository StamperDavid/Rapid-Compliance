/**
 * Lead Feedback API
 * Stores user feedback to improve lead quality over time
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

// Zod schema for lead feedback request
const leadFeedbackSchema = z.object({
  organizationId: z.string().min(1),
  leadDomain: z.string().min(1),
  isGoodLead: z.boolean(),
  timestamp: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/leads/feedback');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body: unknown = await request.json();
    const validation = leadFeedbackSchema.safeParse(body);

    if (!validation.success) {
      return errors.badRequest('Missing required fields');
    }

    const { organizationId, leadDomain, isGoodLead, timestamp } = validation.data;

    // Store feedback in Firestore
    const feedbackId = `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/lead-feedback`,
      feedbackId,
      {
        leadDomain,
        isGoodLead,
        timestamp: timestamp ? new Date(timestamp).toISOString() : new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
      false
    );

    logger.info('Lead feedback saved', { route: '/api/leads/feedback', leadDomain, isGoodLead });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Lead feedback error', error instanceof Error ? error : undefined, { route: '/api/leads/feedback' });
    return errors.database('Failed to save feedback', error instanceof Error ? error : undefined);
  }
}


