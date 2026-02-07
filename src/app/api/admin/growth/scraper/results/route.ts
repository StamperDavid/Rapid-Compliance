/**
 * Admin Scraper Results API
 * GET to fetch distillation results (extracted signals + archive metadata) for a scrape job.
 */

export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest, isAuthError } from '@/lib/api/admin-auth';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { z } from 'zod';
import { getExtractedSignals } from '@/lib/scraper-intelligence/scraper-intelligence-service';
import { getFromDiscoveryArchive } from '@/lib/scraper-intelligence/discovery-archive-service';

const QuerySchema = z.object({
  scrapeId: z.string().min(1, 'scrapeId is required'),
});

export async function GET(request: NextRequest) {
  const rateLimitResponse = await rateLimitMiddleware(request, '/api/admin/growth/scraper/results');
  if (rateLimitResponse) { return rateLimitResponse; }

  const authResult = await verifyAdminRequest(request);
  if (isAuthError(authResult)) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  try {
    const { user } = authResult;
    const scrapeIdParam = request.nextUrl.searchParams.get('scrapeId');

    const parseResult = QuerySchema.safeParse({ scrapeId: scrapeIdParam });
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0]?.message ?? 'Invalid query parameters' },
        { status: 400 }
      );
    }

    const { scrapeId } = parseResult.data;

    // Fetch signals and archive data in parallel
    const [signals, archive] = await Promise.all([
      getExtractedSignals(scrapeId),
      getFromDiscoveryArchive(scrapeId),
    ]);

    // Compute analytics inline
    const totalSignals = signals.length;
    let totalConfidence = 0;
    const signalsByPlatform: Record<string, number> = {};

    for (const signal of signals) {
      totalConfidence += signal.confidence;
      const platform = signal.platform as string;
      signalsByPlatform[platform] = (signalsByPlatform[platform] ?? 0) + 1;
    }

    const averageConfidence = totalSignals > 0 ? Math.round(totalConfidence / totalSignals) : 0;

    // Serialize signals (convert Date to ISO string)
    const serializedSignals = signals.map((s) => ({
      signalId: s.signalId,
      signalLabel: s.signalLabel,
      sourceText: s.sourceText,
      confidence: s.confidence,
      platform: s.platform,
      extractedAt: s.extractedAt instanceof Date ? s.extractedAt.toISOString() : String(s.extractedAt),
      sourceScrapeId: s.sourceScrapeId,
    }));

    // Serialize archive (exclude rawHtml/cleanedContent to keep payload small)
    const serializedArchive = archive
      ? {
          url: archive.url,
          sizeBytes: archive.sizeBytes,
          createdAt: archive.createdAt instanceof Date ? archive.createdAt.toISOString() : String(archive.createdAt),
          expiresAt: archive.expiresAt instanceof Date ? archive.expiresAt.toISOString() : String(archive.expiresAt),
          scrapeCount: archive.scrapeCount,
          verified: archive.verified,
        }
      : null;

    logger.info('[ScraperResults] Fetched distillation preview', {
      userId: user.uid,
      scrapeId,
      signalCount: totalSignals,
      archiveFound: archive !== null,
      file: 'scraper/results/route.ts',
    });

    return NextResponse.json({
      signals: serializedSignals,
      archive: serializedArchive,
      analytics: {
        totalSignals,
        averageConfidence,
        signalsByPlatform,
      },
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('[ScraperResults] GET failed', err, { file: 'scraper/results/route.ts' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
