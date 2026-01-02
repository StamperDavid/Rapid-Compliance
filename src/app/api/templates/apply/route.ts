/**
 * Apply Template API
 * POST /api/templates/apply - Apply an industry template to an organization
 */

import { NextRequest, NextResponse } from 'next/server';
import { applyTemplate } from '@/lib/templates';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/templates/apply
 * Apply an industry template to an organization
 * 
 * Body:
 * {
 *   organizationId: string;
 *   workspaceId?: string;
 *   templateId: string;
 *   merge?: boolean;
 *   applyWorkflows?: boolean;
 *   applyBestPractices?: boolean;
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      organizationId,
      workspaceId,
      templateId,
      merge = false,
      applyWorkflows = true,
      applyBestPractices = true
    } = body;
    
    if (!organizationId) {
      return NextResponse.json({
        success: false,
        error: 'Missing organizationId'
      }, { status: 400 });
    }
    
    if (!templateId) {
      return NextResponse.json({
        success: false,
        error: 'Missing templateId'
      }, { status: 400 });
    }
    
    logger.info('Applying industry template', {
      orgId: organizationId,
      templateId,
      merge
    });
    
    const result = await applyTemplate({
      organizationId,
      workspaceId,
      templateId,
      merge,
      applyWorkflows,
      applyBestPractices
    });
    
    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: 'Template application failed',
        errors: result.errors
      }, { status: 400 });
    }
    
    return NextResponse.json({
      success: true,
      result
    });
    
  } catch (error) {
    logger.error('Failed to apply template', error as Error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to apply template',
      message: (error as Error).message
    }, { status: 500 });
  }
}
