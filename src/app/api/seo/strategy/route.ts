/**
 * POST /api/seo/strategy
 *
 * Generates a 30-day SEO strategy via the SEO Expert agent.
 * Auth-gated. Returns ThirtyDayStrategy JSON.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { errors } from '@/lib/middleware/error-handler';
import { getSEOExpert } from '@/lib/agents/marketing/seo/specialist';
import { logger } from '@/lib/logger/logger';
import { adminDb } from '@/lib/firebase/admin';
import { getSeoResearchCollection } from '@/lib/firebase/collections';
import { FieldValue } from 'firebase-admin/firestore';

const StrategySchema = z.object({
  industry: z.string().min(1, 'Industry is required'),
  currentRankings: z.array(z.object({
    keyword: z.string(),
    position: z.number(),
  })).optional(),
  businessGoals: z.array(z.string()).min(1, 'At least one business goal is required'),
});

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const body: unknown = await request.json();
    const parsed = StrategySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid input' },
        { status: 400 }
      );
    }

    const seoExpert = getSEOExpert();
    await seoExpert.initialize();

    const taskId = `strategy-${Date.now()}`;
    const report = await seoExpert.execute({
      id: taskId,
      timestamp: new Date(),
      from: 'api',
      to: 'SEO_EXPERT',
      type: 'COMMAND',
      priority: 'NORMAL',
      payload: {
        action: '30_day_strategy',
        ...parsed.data,
      },
      requiresResponse: true,
      traceId: taskId,
    });

    if (report.status !== 'COMPLETED' || !report.data) {
      const errorMsg = report.errors?.[0] ?? 'Strategy generation failed';
      logger.warn('Strategy generation returned non-success', { status: report.status });
      return NextResponse.json(
        { success: false, error: errorMsg },
        { status: 502 }
      );
    }

    // Fire-and-forget: persist strategy to Firestore
    if (adminDb && report.data) {
      adminDb.collection(getSeoResearchCollection()).add({
        type: 'strategy',
        domain: parsed.data.industry,
        data: report.data as Record<string, unknown>,
        tags: parsed.data.businessGoals,
        createdAt: FieldValue.serverTimestamp(),
        createdBy: authResult.user.uid,
      }).catch((persistErr: unknown) => {
        logger.warn('Failed to persist SEO strategy', {
          error: persistErr instanceof Error ? persistErr.message : String(persistErr),
        });
      });
    }

    return NextResponse.json({
      success: true,
      data: report.data,
    });
  } catch (err) {
    logger.error('Strategy endpoint error', err instanceof Error ? err : new Error(String(err)));
    return errors.internal(
      'Failed to generate strategy',
      err instanceof Error ? err : undefined
    );
  }
}
