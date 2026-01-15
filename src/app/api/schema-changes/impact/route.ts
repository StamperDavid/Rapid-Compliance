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
    const organizationId = searchParams.get('organizationId');
    const workspaceId = searchParams.get('workspaceId');
    const schemaId = searchParams.get('schemaId');
    
    if (!organizationId || !workspaceId || !schemaId) {
      return NextResponse.json(
        { error: 'organizationId, workspaceId, and schemaId are required' },
        { status: 400 }
      );
    }
    
    // Get impact summary
    const impactSummary = await getSchemaChangeImpactSummary(
      organizationId,
      workspaceId,
      schemaId
    );
    
    // Get workflow validation summary
    const workflowSummary = await getWorkflowValidationSummary(
      organizationId,
      workspaceId
    );
    
    return NextResponse.json({
      success: true,
      impact: impactSummary,
      workflows: workflowSummary,
    });
    
  } catch (error) {
    logger.error('[Schema Change Impact API] GET failed', error, {
      file: 'route.ts',
    });
    
    return NextResponse.json(
      { error: 'Failed to get impact analysis' },
      { status: 500 }
    );
  }
}



