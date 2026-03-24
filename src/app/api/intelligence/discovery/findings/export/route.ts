/**
 * Export Findings — GET /api/intelligence/discovery/findings/export
 *
 * Exports findings for an operation as CSV.
 * Query params: operationId (required), approvalStatus (optional filter)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { listFindings } from '@/lib/intelligence/discovery-service';
import { findingsToCSV } from '@/lib/intelligence/lead-converter';
import type { DiscoveryFinding } from '@/types/intelligence-discovery';

export const dynamic = 'force-dynamic';

const ExportQuerySchema = z.object({
  operationId: z.string().min(1),
  approvalStatus: z.enum(['pending', 'approved', 'rejected', 'converted']).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const { searchParams } = new URL(request.url);
    const parsed = ExportQuerySchema.safeParse({
      operationId: searchParams.get('operationId'),
      approvalStatus: searchParams.get('approvalStatus') ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query params', details: parsed.error.errors },
        { status: 400 }
      );
    }

    // Fetch all findings (paginate through them)
    const allFindings: DiscoveryFinding[] = [];
    let startAfter: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const page = await listFindings({
        operationId: parsed.data.operationId,
        approvalStatus: parsed.data.approvalStatus,
        limit: 100,
        startAfter,
      });

      allFindings.push(...page.findings);
      hasMore = page.hasMore;

      if (page.findings.length > 0) {
        startAfter = page.findings[page.findings.length - 1].id;
      }
    }

    if (allFindings.length === 0) {
      return NextResponse.json(
        { error: 'No findings to export' },
        { status: 404 }
      );
    }

    const csv = findingsToCSV(allFindings);
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `discovery-findings-${parsed.data.operationId.slice(0, 8)}-${timestamp}.csv`;

    logger.info('[Discovery Export] CSV generated', {
      userId: authResult.user.uid,
      operationId: parsed.data.operationId,
      rows: allFindings.length,
    });

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: unknown) {
    logger.error(
      '[Discovery Export] GET failed',
      error instanceof Error ? error : new Error(String(error))
    );
    return NextResponse.json({ error: 'Failed to export findings' }, { status: 500 });
  }
}
