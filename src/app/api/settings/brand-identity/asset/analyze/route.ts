/**
 * Brand Identity — Asset Analyze API Route
 * POST /api/settings/brand-identity/asset/analyze
 *
 * Given an uploaded brand reference asset (image / video / document), produces a
 * short AI summary of what it actually contains — a vision read of an image, the
 * spoken transcript of a video, or the text inside a PDF — so that summary can be
 * stored on the asset and baked into every agent's Brand DNA. Best-effort: the
 * extraction never throws and an empty `aiSummary` is a valid result.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth/api-auth';
import { extractAssetSummary } from '@/lib/brand/brand-reference-extraction';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

const FILE = 'api/settings/brand-identity/asset/analyze/route.ts';

const AnalyzeBodySchema = z.object({
  url: z.string().min(1),
  contentType: z.string(),
  kind: z.enum(['image', 'video', 'document', 'other']),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const permResult = await requirePermission(request, 'canManageTheme');
    if (permResult instanceof NextResponse) {
      return permResult;
    }

    const body: unknown = await request.json();
    const parsed = AnalyzeBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid analyze request', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    // extractAssetSummary is best-effort and never throws — '' is a valid result.
    const aiSummary = await extractAssetSummary(parsed.data);

    return NextResponse.json({ success: true, aiSummary });
  } catch (error) {
    logger.error(
      'Failed to analyze brand reference asset',
      error instanceof Error ? error : new Error(String(error)),
      { file: FILE },
    );
    return NextResponse.json(
      { error: 'Failed to analyze brand reference asset' },
      { status: 500 },
    );
  }
}
