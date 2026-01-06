/**
 * Global Templates API
 * 
 * CRUD operations for global industry templates
 * Requires admin role
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { requireUserRole } from '@/lib/auth/server-auth';
import {
  listGlobalTemplates,
  saveGlobalTemplate,
  deleteGlobalTemplate,
} from '@/lib/templates/template-service';
import {
  getIndustryOptionsWithOverrides,
  getAllIndustryTemplates,
} from '@/lib/templates/template-resolver';
import { validateTemplate, getValidationErrors } from '@/lib/templates/template-validation';
import { logger } from '@/lib/logger/logger';

/**
 * GET /api/admin/templates
 * List all templates with override status
 */
export async function GET(request: NextRequest) {
  try {
    // Require admin role
    const user = await requireUserRole(request, ['admin', 'super_admin', 'owner']);

    const options = await getIndustryOptionsWithOverrides();

    return NextResponse.json({
      success: true,
      templates: options,
      count: options.length,
    });
  } catch (error) {
    logger.error('Error listing templates', { error });
    
    if (error instanceof Error && error.message === 'Insufficient permissions') {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to list templates' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/templates
 * Save or update a template
 */
export async function POST(request: NextRequest) {
  try {
    // Require admin role
    const user = await requireUserRole(request, ['admin', 'super_admin', 'owner']);

    const body = await request.json();

    // Validate template structure
    const validation = validateTemplate(body);
    
    if (!validation.success) {
      const errors = validation.errors ? getValidationErrors(validation.errors) : [];
      return NextResponse.json(
        {
          success: false,
          error: 'Template validation failed',
          validationErrors: errors,
        },
        { status: 400 }
      );
    }

    // TypeScript guard: validation.success === true means validation.data exists
    if (!validation.data) {
      return NextResponse.json(
        { success: false, error: 'Validation data missing' },
        { status: 500 }
      );
    }

    // Save template to Firestore
    await saveGlobalTemplate(validation.data as any, user.uid);

    logger.info('Template saved', {
      templateId: validation.data.id,
      userId: user.uid,
    });

    return NextResponse.json({
      success: true,
      message: 'Template saved successfully',
      templateId: validation.data.id,
    });
  } catch (error) {
    logger.error('Error saving template', { error });
    
    if (error instanceof Error && error.message === 'Insufficient permissions') {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to save template' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/templates?id={templateId}
 * Delete a template (revert to default)
 */
export async function DELETE(request: NextRequest) {
  try {
    // Require admin role
    const user = await requireUserRole(request, ['admin', 'super_admin', 'owner']);

    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('id');

    if (!templateId) {
      return NextResponse.json(
        { success: false, error: 'Template ID is required' },
        { status: 400 }
      );
    }

    // Delete template from Firestore
    await deleteGlobalTemplate(templateId);

    logger.info('Template deleted (reverted to default)', {
      templateId,
      userId: user.uid,
    });

    return NextResponse.json({
      success: true,
      message: 'Template reverted to default successfully',
      templateId,
    });
  } catch (error) {
    logger.error('Error deleting template', { error });
    
    if (error instanceof Error && error.message === 'Insufficient permissions') {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to delete template' },
      { status: 500 }
    );
  }
}
