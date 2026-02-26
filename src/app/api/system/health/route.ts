/**
 * System Health API Route
 *
 * Returns the SystemHealthReport and ImplementationContext for the
 * MerchantOrchestrator. Runs server-side so AdminFirestoreService
 * has access to the Firebase Admin SDK.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest, isAuthError } from '@/lib/api/admin-auth';
import { SystemHealthService } from '@/lib/orchestrator/system-health-service';
import { ImplementationGuide } from '@/lib/orchestrator/implementation-guide';
import { ASSISTANT_NAME } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAdminRequest(request);
    if (isAuthError(authResult)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ownerName = request.nextUrl.searchParams.get('ownerName') ?? undefined;
    const industry = request.nextUrl.searchParams.get('industry') ?? undefined;

    // Generate health report (uses AdminFirestoreService server-side)
    const healthReport = await SystemHealthService.generateHealthReport();

    // Build implementation context
    const implContext = await ImplementationGuide.buildContext(
      ASSISTANT_NAME,
      ownerName,
      industry
    );

    // Generate the system prompt server-side so the client doesn't need
    // to import ImplementationGuide (which pulls in admin SDK)
    const implSystemPrompt = ImplementationGuide.generateSystemPrompt(implContext);

    return NextResponse.json({
      healthReport,
      implContext,
      implSystemPrompt,
    });
  } catch (error) {
    logger.error(
      '[System Health API] Error',
      error instanceof Error ? error : new Error(String(error)),
      { file: 'api/system/health/route.ts' }
    );
    return NextResponse.json(
      { error: 'Failed to generate health report' },
      { status: 500 }
    );
  }
}
