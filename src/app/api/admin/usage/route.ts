/**
 * Usage Metrics API
 * GET - Returns current period usage metrics for the billing page
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { FirestoreService } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { getSubCollection } from '@/lib/firebase/collections';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/admin/usage');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Count contacts
    let contacts = 0;
    try {
      const contactDocs = await FirestoreService.getAll(getSubCollection('contacts'));
      contacts = contactDocs.length;
    } catch {
      // Collection may not exist yet
    }

    // Count emails sent this month
    let emailsSent = 0;
    try {
      const { where } = await import('firebase/firestore');
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const emailCampaigns = await FirestoreService.getAll(
        getSubCollection('emailCampaigns'),
        [where('sentAt', '>=', startOfMonth.toISOString())]
      );
      // Each campaign may have a sentCount field
      emailsSent = emailCampaigns.reduce((sum, campaign) => {
        const c = campaign as Record<string, unknown>;
        const count = typeof c.sentCount === 'number' ? c.sentCount : 0;
        return sum + count;
      }, 0);
    } catch {
      // Collection may not exist yet
    }

    // Count AI credits used this month
    let aiCredits = 0;
    try {
      const { where } = await import('firebase/firestore');
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const aiUsageDocs = await FirestoreService.getAll(
        getSubCollection('ai_usage'),
        [where('createdAt', '>=', startOfMonth.toISOString())]
      );
      aiCredits = aiUsageDocs.reduce((sum, doc) => {
        const d = doc as Record<string, unknown>;
        const credits = typeof d.credits === 'number' ? d.credits : 1;
        return sum + credits;
      }, 0);
    } catch {
      // Collection may not exist yet
    }

    return NextResponse.json({
      success: true,
      contacts,
      emailsSent,
      aiCredits,
    });
  } catch (error: unknown) {
    logger.error('Usage metrics error', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/admin/usage',
    });
    return errors.internal('Failed to fetch usage metrics');
  }
}
