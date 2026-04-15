/**
 * List Specialist Golden Master Versions API
 *
 * GET /api/training/grade-specialist/[specialistId]/versions?industryKey=X
 *
 * Returns all Golden Master versions for a specialist scoped to an industry,
 * sorted newest-first. Includes both active and deactivated versions so the
 * rollback UI can display the full history and let operators pick any past
 * version to redeploy.
 *
 * Response shape:
 * {
 *   success: true,
 *   activeVersion: number,
 *   versions: Array<{
 *     id: string,
 *     version: number,
 *     isActive: boolean,
 *     createdAt: string,
 *     createdBy: string,
 *     notes?: string,
 *     previousVersion?: number,
 *     deployedAt?: string,
 *     systemPromptLength: number,   // char count — full text only served on explicit request
 *   }>,
 * }
 *
 * Gated by requireRole(['owner', 'admin']).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { listIndustryGMVersions } from '@/lib/training/specialist-golden-master-service';

export const dynamic = 'force-dynamic';

const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ specialistId: string }> },
) {
  const authResult = await requireRole(request, ['owner', 'admin']);
  if (authResult instanceof NextResponse) { return authResult; }

  const { specialistId } = await params;
  if (!specialistId) {
    return NextResponse.json(
      { success: false, error: 'specialistId is required' },
      { status: 400 },
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const industryKey = searchParams.get('industryKey') ?? DEFAULT_INDUSTRY_KEY;

    const versions = await listIndustryGMVersions(specialistId, industryKey);

    const slim = versions.map((v) => {
      const rawPrompt = typeof v.config.systemPrompt === 'string'
        ? v.config.systemPrompt
        : v.systemPromptSnapshot ?? '';
      return {
        id: v.id,
        version: v.version,
        isActive: v.isActive,
        createdAt: v.createdAt,
        createdBy: v.createdBy,
        notes: v.notes,
        previousVersion: v.previousVersion,
        deployedAt: v.deployedAt,
        systemPromptLength: rawPrompt.length,
      };
    });

    const activeVersion = versions.find((v) => v.isActive)?.version ?? null;

    return NextResponse.json({
      success: true,
      activeVersion,
      versions: slim,
      count: slim.length,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(
      '[SpecialistGMVersionsAPI] GET failed',
      error instanceof Error ? error : new Error(errorMessage),
    );
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 },
    );
  }
}
