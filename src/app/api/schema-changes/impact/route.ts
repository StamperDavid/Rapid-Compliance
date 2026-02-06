/**
 * Schema Change Impact API
 * Get impact analysis for schema changes
 */

import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger/logger';
import { getSchemaChangeImpactSummary } from '@/lib/schema/schema-change-handler';
import { getWorkflowValidationSummary } from '@/lib/schema/workflow-validator';

/**
 * GET /api/schema-changes/impact
 * Get schema change impact summary
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const schemaId = searchParams.get('schemaId');
    const workspaceId = 'default';

    if (!schemaId) {
      return NextResponse.json(
        { error: 'schemaId is required' },
        { status: 400 }
      );
    }

    // Get impact summary
    const impactSummary = await getSchemaChangeImpactSummary(
      workspaceId,
      schemaId
    );

    // Get workflow validation summary
    const workflowSummary = await getWorkflowValidationSummary(
      workspaceId
    );
    
    return NextResponse.json({
      success: true,
      impact: impactSummary,
      workflows: workflowSummary,
    });
    
  } catch (error: unknown) {
    logger.error('[Schema Change Impact API] GET failed', error instanceof Error ? error : new Error(String(error)), {
      file: 'route.ts',
    });

    return NextResponse.json(
      { error: 'Failed to get impact analysis' },
      { status: 500 }
    );
  }
}



