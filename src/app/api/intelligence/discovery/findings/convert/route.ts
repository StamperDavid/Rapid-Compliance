/**
 * Convert Findings to Leads — POST /api/intelligence/discovery/findings/convert
 *
 * Bulk-converts approved discovery findings into CRM Lead entities.
 * Supports converting specific finding IDs or all approved findings in an operation.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { bulkConvertFindings } from '@/lib/intelligence/lead-converter';
import { getApprovedFindings } from '@/lib/intelligence/approval-service';

export const dynamic = 'force-dynamic';

const ConvertRequestSchema = z.object({
  findingIds: z.array(z.string().min(1)).min(1).max(500).optional(),
  operationId: z.string().min(1).optional(),
}).refine(
  (data) => data.findingIds ?? data.operationId,
  { message: 'Either findingIds or operationId must be provided' }
);

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const body: unknown = await request.json();
    const parsed = ConvertRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.errors },
        { status: 400 }
      );
    }

    let targetIds: string[];

    if (parsed.data.findingIds) {
      targetIds = parsed.data.findingIds;
    } else {
      // Get all approved findings for the operation
      const approved = await getApprovedFindings(parsed.data.operationId as string);
      targetIds = approved.map((f) => f.id);

      if (targetIds.length === 0) {
        return NextResponse.json(
          { error: 'No approved findings to convert in this operation' },
          { status: 400 }
        );
      }
    }

    const result = await bulkConvertFindings(targetIds, authResult.user.uid);

    logger.info('[Discovery Convert] Bulk conversion complete', {
      userId: authResult.user.uid,
      total: targetIds.length,
      converted: result.converted,
      failed: result.failed,
    });

    return NextResponse.json({
      converted: result.converted,
      failed: result.failed,
      results: result.results,
    });
  } catch (error: unknown) {
    logger.error(
      '[Discovery Convert] POST failed',
      error instanceof Error ? error : new Error(String(error))
    );
    return NextResponse.json({ error: 'Failed to convert findings' }, { status: 500 });
  }
}
