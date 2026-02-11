/**
 * Single Template API
 * 
 * Get a specific template by ID
 * Requires admin role
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireUserRole } from '@/lib/auth/server-auth';
import { getTemplateWithSource } from '@/lib/templates/template-resolver';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/templates/[id]
 * Get a specific template with source information
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Require admin role
    await requireUserRole(request, ['admin']);

    const templateId = id;

    if (!templateId) {
      return NextResponse.json(
        { success: false, error: 'Template ID is required' },
        { status: 400 }
      );
    }

    const result = await getTemplateWithSource(templateId);

    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      template: result.template,
      source: result.source,
      hasOverride: result.hasOverride,
    });
  } catch (error) {
    const { id: errorTemplateId } = await params;
    logger.error('Error getting template', error instanceof Error ? error : new Error(String(error)), { templateId: errorTemplateId });

    if (error instanceof Error && error.message === 'Insufficient permissions') {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to get template' },
      { status: 500 }
    );
  }
}
