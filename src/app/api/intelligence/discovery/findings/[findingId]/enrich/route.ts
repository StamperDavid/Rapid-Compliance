/**
 * Trigger Enrichment — POST /api/intelligence/discovery/findings/[findingId]/enrich
 *
 * Triggers the multi-hop enrichment pipeline for a single finding.
 * The enrichment runs asynchronously — the response returns immediately
 * with status "started", and the client polls for updates.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import {
  getFinding,
  updateFindingEnrichment,
  logAction,
} from '@/lib/intelligence/discovery-service';
import { enrichFinding } from '@/lib/intelligence/multi-hop-enricher';
import { createEmptyContactInfo, ENRICHMENT_DEPTH_LEVELS } from '@/types/intelligence-discovery';

export const dynamic = 'force-dynamic';

const enrichRequestSchema = z.object({
  depth: z.enum(ENRICHMENT_DEPTH_LEVELS).optional(),
}).optional();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ findingId: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const { findingId } = await params;
    const finding = await getFinding(findingId);

    if (!finding) {
      return NextResponse.json({ error: 'Finding not found' }, { status: 404 });
    }

    if (finding.enrichmentStatus === 'in_progress') {
      return NextResponse.json(
        { error: 'Enrichment already in progress for this finding' },
        { status: 409 }
      );
    }

    // Parse optional depth parameter
    let depth: 'basic' | 'standard' | 'deep' = 'standard';
    try {
      const body: unknown = await request.json();
      const parsed = enrichRequestSchema.safeParse(body);
      if (parsed.success && parsed.data?.depth) {
        depth = parsed.data.depth;
      }
    } catch {
      // No body or invalid JSON — use default depth
    }

    // Mark as in_progress
    await updateFindingEnrichment(
      findingId,
      finding.enrichedData ?? createEmptyContactInfo(),
      finding.enrichmentSources ?? [],
      finding.confidenceScores ?? {},
      finding.overallConfidence ?? 0,
      'in_progress'
    );

    // Log the enrichment start action
    await logAction({
      operationId: finding.operationId,
      findingId,
      actionType: 'enrich',
      sourceUrl: 'multi-hop-enricher',
      status: 'running',
      data: {
        summary: `Starting ${depth} enrichment for ${finding.seedData.company_name ?? finding.seedData.business_name ?? findingId}`,
      },
    });

    // Fire-and-forget: run enrichment asynchronously so we can return immediately
    void enrichFinding(finding, depth).catch((err: unknown) => {
      logger.error('[Discovery Enrich] Enrichment pipeline failed', err instanceof Error ? err : new Error(String(err)));
      // Mark as failed if the pipeline crashes
      void updateFindingEnrichment(
        findingId,
        finding.enrichedData ?? createEmptyContactInfo(),
        finding.enrichmentSources ?? [],
        finding.confidenceScores ?? {},
        finding.overallConfidence ?? 0,
        'failed'
      );
    });

    return NextResponse.json({
      message: 'Enrichment started',
      findingId,
      depth,
    });
  } catch (error: unknown) {
    logger.error('[Discovery Enrich] POST failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: 'Failed to start enrichment' }, { status: 500 });
  }
}
