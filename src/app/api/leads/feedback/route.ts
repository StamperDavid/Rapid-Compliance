/**
 * Lead Feedback API
 * Stores user feedback to improve lead quality over time
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { getSubCollection } from '@/lib/firebase/collections';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

// Zod schema for lead feedback request
const leadFeedbackSchema = z.object({
  leadDomain: z.string().min(1),
  isGoodLead: z.boolean(),
  timestamp: z.string().optional(),
  icpProfileId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const rateLimitResponse = await rateLimitMiddleware(request, '/api/leads/feedback');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body: unknown = await request.json();
    const validation = leadFeedbackSchema.safeParse(body);

    if (!validation.success) {
      return errors.badRequest('Missing required fields');
    }

    const { leadDomain, isGoodLead, timestamp, icpProfileId } = validation.data;

    // Store feedback in Firestore
    const feedbackId = `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await AdminFirestoreService.set(
      getSubCollection('lead-feedback'),
      feedbackId,
      {
        leadDomain,
        isGoodLead,
        timestamp: timestamp ? new Date(timestamp).toISOString() : new Date().toISOString(),
        createdAt: new Date().toISOString(),
        ...(icpProfileId && { icpProfileId }),
      },
      false
    );

    // Update ICP profile feedback stats + example companies if linked
    if (icpProfileId) {
      try {
        const { getIcpProfile, updateIcpProfile } = await import('@/lib/services/icp-profile-service');
        const profile = await getIcpProfile(icpProfileId);
        if (profile) {
          const stats = profile.feedbackStats ?? { positiveCount: 0, negativeCount: 0 };
          const examples = profile.exampleCompanies ?? [];
          const alreadyExists = examples.some(ex => ex.domain === leadDomain);

          await updateIcpProfile(icpProfileId, {
            feedbackStats: {
              positiveCount: stats.positiveCount + (isGoodLead ? 1 : 0),
              negativeCount: stats.negativeCount + (isGoodLead ? 0 : 1),
            },
            ...(!alreadyExists && {
              exampleCompanies: [...examples, { domain: leadDomain, isPositive: isGoodLead }],
            }),
          });
        }
      } catch (icpError) {
        logger.warn('Failed to update ICP profile feedback', { icpProfileId, error: icpError instanceof Error ? icpError.message : String(icpError) });
      }
    }

    logger.info('Lead feedback saved', { route: '/api/leads/feedback', leadDomain, isGoodLead, icpProfileId });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error('Lead feedback error', error instanceof Error ? error : new Error(String(error)), { route: '/api/leads/feedback' });
    return errors.database('Failed to save feedback', error instanceof Error ? error : new Error(String(error)));
  }
}


