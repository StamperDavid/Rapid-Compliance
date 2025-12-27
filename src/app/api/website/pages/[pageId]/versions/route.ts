/**
 * Page Version History API
 * Retrieve and restore previous versions of pages
 * CRITICAL: Multi-tenant isolation - validates organizationId
 */

import { NextRequest, NextResponse} from 'next/server';
import { db, admin } from '@/lib/firebase-admin';
import { getUserIdentifier } from '@/lib/server-auth';

/**
 * GET /api/website/pages/[pageId]/versions
 * Get version history for a page
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ pageId: string }> }
) {
  try {
    const params = await context.params;
    const { searchParams } = request.nextUrl;
    const organizationId = searchParams.get('organizationId');

    // CRITICAL: Validate organizationId
    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      );
    }

    // Verify the page belongs to this org
    const pageRef = db
      .collection('organizations')
      .doc(organizationId)
      .collection('website')
      .doc('pages')
      .collection('items')
      .doc(params.pageId);

    const pageDoc = await pageRef.get();

    if (!pageDoc.exists) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      );
    }

    const pageData = pageDoc.data();

    // CRITICAL: Verify organizationId matches
    if (pageData?.organizationId !== organizationId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Get all versions
    const versionsRef = pageRef.collection('versions');
    const snapshot = await versionsRef.orderBy('version', 'desc').get();

    const versions = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({
      success: true,
      versions,
      currentVersion: pageData.version,
      lastPublishedVersion: pageData.lastPublishedVersion,
    });
  } catch (error: any) {
    console.error('[Page Versions API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch versions', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/website/pages/[pageId]/versions/restore
 * Restore a specific version
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ pageId: string }> }
) {
  try {
    const params = await context.params;
    const body = await request.json();
    const { organizationId, versionId } = body;

    // CRITICAL: Validate organizationId
    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      );
    }

    if (!versionId) {
      return NextResponse.json(
        { error: 'versionId is required' },
        { status: 400 }
      );
    }

    const pageRef = db
      .collection('organizations')
      .doc(organizationId)
      .collection('website')
      .doc('pages')
      .collection('items')
      .doc(params.pageId);

    const pageDoc = await pageRef.get();

    if (!pageDoc.exists) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      );
    }

    const pageData = pageDoc.data();

    // CRITICAL: Verify organizationId matches
    if (pageData?.organizationId !== organizationId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Get the version to restore
    const versionDoc = await pageRef.collection('versions').doc(versionId).get();

    if (!versionDoc.exists) {
      return NextResponse.json(
        { error: 'Version not found' },
        { status: 404 }
      );
    }

    const versionData = versionDoc.data();
    const now = admin.firestore.Timestamp.now();

    // Restore the version content
    await pageRef.update({
      content: versionData?.content || [],
      seo: versionData?.seo || {},
      title: versionData?.title || '',
      slug: versionData?.slug || '',
      status: 'draft', // Restored versions become drafts
      updatedAt: now,
      lastEditedBy: 'system', // TODO: Use actual user
      version: (pageData.version || 1) + 1,
    });

    // Create audit log entry
    const auditRef = db
      .collection('organizations')
      .doc(organizationId)
      .collection('website')
      .doc('audit-log')
      .collection('entries');

    await auditRef.add({
      type: 'page_version_restored',
      pageId: params.pageId,
      pageTitle: pageData.title,
      restoredVersion: versionData?.version,
      performedBy,
      performedAt: now,
      organizationId,
    });

    return NextResponse.json({
      success: true,
      message: `Version ${versionData?.version} restored successfully`,
    });
  } catch (error: any) {
    console.error('[Page Versions API] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to restore version', details: error.message },
      { status: 500 }
    );
  }
}

