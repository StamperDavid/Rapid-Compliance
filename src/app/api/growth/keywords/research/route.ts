/**
 * POST /api/growth/keywords/research
 *
 * Keyword research endpoint — takes a seed keyword and returns
 * related keyword suggestions with volume, CPC, and competition data
 * from DataForSEO.
 *
 * This is distinct from the keyword tracker; research is a discovery
 * tool. Users can then selectively add promising keywords to tracking.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { getDataForSEOService } from '@/lib/integrations/seo/dataforseo-service';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const ResearchSchema = z.object({
  keyword: z.string().min(1, 'Keyword is required').max(200),
  limit: z.number().int().min(1).max(100).optional().default(50),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) { return authResult; }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = ResearchSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid request' },
      { status: 400 },
    );
  }

  const { keyword, limit } = parsed.data;

  try {
    const service = getDataForSEOService();

    // Fetch keyword suggestions and seed keyword data in parallel
    const [suggestionsResult, seedDataResult] = await Promise.all([
      service.getKeywordSuggestions(keyword, 2840, 'en', limit),
      service.getKeywordData([keyword]),
    ]);

    if (!suggestionsResult.success && !seedDataResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: suggestionsResult.error ?? seedDataResult.error ?? 'DataForSEO request failed',
        },
        { status: 502 },
      );
    }

    // Merge: seed keyword data first, then suggestions (deduped)
    const seedKeyword = seedDataResult.data?.[0] ?? null;
    const suggestions = suggestionsResult.data ?? [];

    // Deduplicate — remove the seed keyword from suggestions if present
    const seedLower = keyword.toLowerCase().trim();
    const filteredSuggestions = suggestions.filter(
      (s) => s.keyword.toLowerCase().trim() !== seedLower,
    );

    return NextResponse.json({
      success: true,
      seedKeyword,
      suggestions: filteredSuggestions,
      cached: suggestionsResult.cached,
    });
  } catch (err) {
    logger.error(
      'Keyword research failed',
      err instanceof Error ? err : new Error(String(err)),
      { keyword, route: '/api/growth/keywords/research' },
    );
    return NextResponse.json({ success: false, error: 'Research request failed' }, { status: 500 });
  }
}
