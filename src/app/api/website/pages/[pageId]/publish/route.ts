/**
 * Page Publishing API
 * Handle publish/unpublish actions with version tracking
 * CRITICAL: Multi-tenant isolation - validates organizationId
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { adminDal } from '@/lib/firebase/admin-dal';
import { FieldValue } from 'firebase-admin/firestore';
import {
  handleAPIError,
  validateOrgId,
  verifyOrgOwnership,
  successResponse,
  errorResponse,
} from '@/lib/api-error-handler';
import { getUserIdentifier } from '@/lib/server-auth';

/**
 * POST /api/website/pages/[pageId]/publish
 * Publish a page (make it live)
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ pageId: string }> }
) {
  try {
    if (!adminDal) {
      return errorResponse('Server configuration error', 500, 'SERVER_ERROR');
    }
    
    const params = await context.params;
    const body = await request.json();
    const { organizationId, scheduledFor } = body;

    // CRITICAL: Validate organizationId
    const validOrgId = validateOrgId(organizationId);

    const pageRef = adminDal.getNestedDocRef(
      'organizations/{orgId}/website/pages/items/{pageId}',
      { orgId: validOrgId, pageId: params.pageId }
    );

    const doc = await pageRef.get();

    if (!doc.exists) {
      return errorResponse('Page not found', 404, 'PAGE_NOT_FOUND');
    }

    const pageData = doc.data();

    if (!pageData) {
      return errorResponse('Page data not found', 404, 'PAGE_DATA_NOT_FOUND');
    }

    // CRITICAL: Verify organizationId matches
    if (pageData.organizationId) {
      verifyOrgOwnership(pageData.organizationId, validOrgId, 'page');
    }

    const now = FieldValue.serverTimestamp();
    const currentVersion = pageData.version || 1;
    const performedBy = await getUserIdentifier();

    // Create version snapshot before publishing
    const versionRef = adminDal.getNestedDocRef(
      'organizations/{orgId}/website/pages/items/{pageId}/versions/{version}',
      { orgId: organizationId, pageId: params.pageId, version: `v${currentVersion}` }
    );

    await versionRef.set({
      version: currentVersion,
      content: pageData.content,
      seo: pageData.seo,
      title: pageData.title,
      slug: pageData.slug,
      status: pageData.status,
      createdAt: now,
      createdBy: performedBy,
    });

    // Update page status
    const updateData: any = {
      updatedAt: now,
      lastEditedBy: performedBy,
      lastPublishedVersion: currentVersion,
    };

    if (scheduledFor) {
      // Schedule for future publishing
      const scheduledDate = new Date(scheduledFor);
      if (scheduledDate <= new Date()) {
        return errorResponse(
          'Scheduled date must be in the future',
          400,
          'INVALID_SCHEDULE_DATE'
        );
      }
      updateData.status = 'scheduled';
      updateData.scheduledFor = scheduledFor;
    } else {
      // Publish immediately
      updateData.status = 'published';
      updateData.publishedAt = new Date().toISOString();
      updateData.scheduledFor = FieldValue.delete();
    }

    await pageRef.update(updateData);

    // Create audit log entry
    const auditRef = adminDal.getNestedCollection(
      'organizations/{orgId}/website/audit-log/entries',
      { orgId: validOrgId }
    );

    await auditRef.add({
      type: scheduledFor ? 'page_scheduled' : 'page_published',
      pageId: params.pageId,
      pageTitle: pageData.title,
      version: currentVersion,
      scheduledFor: scheduledFor || null,
      performedBy,
      performedAt: now,
      organizationId: validOrgId,
    });

    return successResponse(
      {
        status: updateData.status,
        publishedAt: updateData.publishedAt,
        scheduledFor: updateData.scheduledFor,
        version: currentVersion,
      },
      scheduledFor
        ? `Page scheduled for ${scheduledFor}`
        : 'Page published successfully',
      200
    );
  } catch (error: any) {
    return handleAPIError(error, 'Page Publish API');
  }
}

/**
 * DELETE /api/website/pages/[pageId]/publish
 * Unpublish a page (revert to draft)
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ pageId: string }> }
) {
  try {
    if (!adminDal) {
      return errorResponse('Server configuration error', 500, 'SERVER_ERROR');
    }
    
    const params = await context.params;
    const { searchParams } = request.nextUrl;
    const organizationId = searchParams.get('organizationId');

    // CRITICAL: Validate organizationId
    const validOrgId = validateOrgId(organizationId);

    const pageRef = adminDal.getNestedDocRef(
      'organizations/{orgId}/website/pages/items/{pageId}',
      { orgId: validOrgId, pageId: params.pageId }
    );

    const doc = await pageRef.get();

    if (!doc.exists) {
      return errorResponse('Page not found', 404, 'PAGE_NOT_FOUND');
    }

    const pageData = doc.data();

    if (!pageData) {
      return errorResponse('Page data not found', 404, 'PAGE_DATA_NOT_FOUND');
    }

    // CRITICAL: Verify organizationId matches
    if (pageData.organizationId) {
      verifyOrgOwnership(pageData.organizationId, validOrgId, 'page');
    }

    const now = FieldValue.serverTimestamp();
    const performedBy = await getUserIdentifier();

    // Unpublish - revert to draft
    await pageRef.update({
      status: 'draft',
      scheduledFor: FieldValue.delete(),
      updatedAt: now,
      lastEditedBy: performedBy,
    });

    // Create audit log entry
    const auditRef = adminDal.getNestedCollection(
      'organizations/{orgId}/website/audit-log/entries',
      { orgId: validOrgId }
    );

    await auditRef.add({
      type: 'page_unpublished',
      pageId: params.pageId,
      pageTitle: pageData.title,
      performedBy,
      performedAt: now,
      organizationId: validOrgId,
    });

    return successResponse({}, 'Page unpublished successfully', 200);
  } catch (error: any) {
    return handleAPIError(error, 'Page Unpublish API');
  }
}

