/**
 * API Route: Start Competitive Monitoring
 * 
 * POST /api/battlecard/monitor/start
 * 
 * Start monitoring competitors for changes
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCompetitiveMonitor } from '@/lib/battlecard';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

const CompetitorMonitorConfigSchema = z.object({
  competitorId: z.string(),
  domain: z.string(),
  priority: z.enum(['high', 'medium', 'low']),
  checkFrequency: z.enum(['daily', 'weekly', 'monthly']),
  alertOn: z.object({
    pricingChanges: z.boolean(),
    featureChanges: z.boolean(),
    positioningChanges: z.boolean(),
    growthSignals: z.boolean(),
    weaknessesDetected: z.boolean(),
  }),
  lastChecked: z.string().transform((s) => new Date(s)).optional(),
  nextCheck: z.string().transform((s) => new Date(s)).optional(),
});

const StartMonitorSchema = z.object({
  competitors: z.array(CompetitorMonitorConfigSchema),
});

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    const parsed = StartMonitorSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { competitors } = parsed.data;

    logger.info('API: Start competitive monitoring', {
      competitorCount: competitors.length,
    });

    const monitor = getCompetitiveMonitor();

    // Add competitors to monitoring
    for (const config of competitors) {
      monitor.addCompetitor(config);
    }

    // Start monitoring
    await monitor.start();

    const stats = monitor.getStats();

    return NextResponse.json({
      success: true,
      message: 'Competitive monitoring started',
      stats,
    });
  } catch (error) {
    logger.error('API: Failed to start competitive monitoring', error instanceof Error ? error : new Error(String(error)));

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
