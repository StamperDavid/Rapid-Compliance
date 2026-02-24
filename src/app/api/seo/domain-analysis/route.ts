/**
 * POST /api/seo/domain-analysis
 *
 * Runs a domain analysis via the SEO Expert agent.
 * Auth-gated. Returns DomainAnalysisResult JSON.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { errors } from '@/lib/middleware/error-handler';
import { getSEOExpert } from '@/lib/agents/marketing/seo/specialist';
import { logger } from '@/lib/logger/logger';

const DomainAnalysisSchema = z.object({
  domain: z.string().min(1, 'Domain is required'),
  keywordLimit: z.number().int().min(1).max(100).optional(),
  noCache: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const body: unknown = await request.json();
    const parsed = DomainAnalysisSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid input' },
        { status: 400 }
      );
    }

    const { domain, keywordLimit, noCache } = parsed.data;

    // Clean domain: strip protocol and trailing slash
    const cleanDomain = domain
      .replace(/^https?:\/\//, '')
      .replace(/\/+$/, '')
      .toLowerCase();

    const seoExpert = getSEOExpert();
    await seoExpert.initialize();

    const taskId = `domain-analysis-${Date.now()}`;
    const report = await seoExpert.execute({
      id: taskId,
      timestamp: new Date(),
      from: 'api',
      to: 'SEO_EXPERT',
      type: 'COMMAND',
      priority: 'NORMAL',
      payload: {
        action: 'domain_analysis',
        domain: cleanDomain,
        keywordLimit: keywordLimit ?? 20,
        ...(noCache ? { noCache: true } : {}),
      },
      requiresResponse: true,
      traceId: taskId,
    });

    if (report.status !== 'COMPLETED' || !report.data) {
      const errorMsg = report.errors?.[0] ?? 'Domain analysis failed';
      logger.warn('Domain analysis returned non-success', { domain: cleanDomain, status: report.status });
      return NextResponse.json(
        { success: false, error: errorMsg },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      data: report.data,
    });
  } catch (err) {
    logger.error('Domain analysis endpoint error', err instanceof Error ? err : new Error(String(err)));
    return errors.internal(
      'Failed to run domain analysis',
      err instanceof Error ? err : undefined
    );
  }
}
