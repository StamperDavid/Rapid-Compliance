import 'server-only';
import { type NextRequest, NextResponse } from 'next/server';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

interface ComplianceReportRecord {
  id: string;
  [key: string]: unknown;
}

/**
 * GET /api/compliance-reports - List all compliance reports.
 * NOTE: nothing currently writes the `complianceReports` collection, so this
 * returns `[]` today. That empty-shell state is a separate known issue.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const reports = await AdminFirestoreService.getAll<ComplianceReportRecord>(
      getSubCollection('complianceReports'),
      []
    );

    return NextResponse.json({ success: true, reports });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch compliance reports';
    logger.error('Failed to fetch compliance reports', error instanceof Error ? error : new Error(String(error)), { file: 'api/compliance-reports/route.ts' });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
