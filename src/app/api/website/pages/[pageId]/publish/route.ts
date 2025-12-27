/**
 * Page Publishing API
 * Handle publish/unpublish actions with version tracking
 * CRITICAL: Multi-tenant isolation - validates organizationId
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, admin } from '@/lib/firebase-admin';
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
    const params = await context.params;
    const body = await request.json();
    const { organizationId, scheduledFor } = body;

    // CRITICAL: Validate organizationId
    const validOrgId = validateOrgId(organizationId);

    const pageRef = db
      .collection('organizations')
      .doc(validOrgId)
      .collection('website')
      .doc('pages')
      .collection('items')
      .doc(params.pageId);

    const doc = await pageRef.get();

    if (!doc.exists) {
      return errorResponse('Page not found', 404, 'PAGE_NOT_FOUND');
    }

    const pageData = doc.data();

    // CRITICAL: Verify organizationId matches
    if (pageData?.organizationId) {
      verifyOrgOwnership(pageData.organizationId, validOrgId, 'page');
    }

    const now = admin.firestore.Timestamp.now();
    const currentVersion = pageData.version || 1;
    const performedBy = await getUserIdentifier();

    // Create version snapshot before publishing
    const versionRef = db
      .collection('organizations')
      .doc(organizationId)
      .collection('website')
      .doc('pages')
      .collection('items')
      .doc(params.pageId)
      .collection('versions')
      .doc(`v${currentVersion}`);

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
      updateData.publishedAt = now.toDate().toISOString();
      updateData.scheduledFor = admin.firestore.FieldValue.delete();
    }

    await pageRef.update(updateData);

    // Create audit log entry
    const auditRef = db
      .collection('organizations')
      .doc(validOrgId)
      .collection('website')
      .doc('audit-log')
      .collection('entries');

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
    const params = await context.params;
    const { searchParams } = request.nextUrl;
    const organizationId = searchParams.get('organizationId');

    // CRITICAL: Validate organizationId
    const validOrgId = validateOrgId(organizationId);

    const pageRef = db
      .collection('organizations')
      .doc(validOrgId)
      .collection('website')
      .doc('pages')
      .collection('items')
      .doc(params.pageId);

    const doc = await pageRef.get();

    if (!doc.exists) {
      return errorResponse('Page not found', 404, 'PAGE_NOT_FOUND');
    }

    const pageData = doc.data();

    // CRITICAL: Verify organizationId matches
    if (pageData?.organizationId) {
      verifyOrgOwnership(pageData.organizationId, validOrgId, 'page');
    }

    const now = admin.firestore.Timestamp.now();
    const performedBy = await getUserIdentifier();

    // Unpublish - revert to draft
    await pageRef.update({
      status: 'draft',
      scheduledFor: admin.firestore.FieldValue.delete(),
      updatedAt: now,
      lastEditedBy: performedBy,
    });

    // Create audit log entry
    const auditRef = db
      .collection('organizations')
      .doc(validOrgId)
      .collection('website')
      .doc('audit-log')
      .collection('entries');

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

