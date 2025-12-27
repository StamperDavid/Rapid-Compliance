/**
 * Lead Feedback API
 * Stores user feedback to improve lead quality over time
 */

import { NextRequest, NextResponse } from 'next/server';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/leads/feedback');
    if (rateLimitResponse) return rateLimitResponse;

    const body = await request.json();
    const { organizationId, leadDomain, isGoodLead, timestamp } = body;
    
    if (!organizationId || !leadDomain || typeof isGoodLead !== 'boolean') {
      return errors.badRequest('Missing required fields');
    }
    
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
  } catch (error: any) {
    logger.error('Lead feedback error', error, { route: '/api/leads/feedback' });
    return errors.database('Failed to save feedback', error);
  }
}


