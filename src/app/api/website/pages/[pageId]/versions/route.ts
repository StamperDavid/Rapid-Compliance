/**
 * Page Version History API
 * Retrieve and restore previous versions of pages
 * Single-tenant: Uses DEFAULT_ORG_ID
 */

import { type NextRequest, NextResponse } from 'next/server';
import { adminDal } from '@/lib/firebase/admin-dal';
import { FieldValue } from 'firebase-admin/firestore';
import { getUserIdentifier } from '@/lib/server-auth';
import { logger } from '@/lib/logger/logger';
import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

interface PageData {
  organizationId: string;
  version?: number;
  lastPublishedVersion?: number;
  title?: string;
}

interface VersionData {
  version?: number;
  content?: unknown[];
  seo?: Record<string, unknown>;
  title?: string;
  slug?: string;
}

interface RequestBody {
  versionId?: string;
}

/**
 * GET /api/website/pages/[pageId]/versions
 * Get version history for a page
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ pageId: string }> }
) {
  try {
    if (!adminDal) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const params = await context.params;

    // Verify the page belongs to this org
    const pageRef = adminDal.getNestedDocRef(
      'organizations/{orgId}/website/pages/items/{pageId}',
      { orgId: DEFAULT_ORG_ID, pageId: params.pageId }
    );

    const pageDoc = await pageRef.get();

    if (!pageDoc.exists) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      );
    }

    const pageData = pageDoc.data() as PageData | undefined;

    // Get all versions (using environment-aware subcollection path)
    const { adminDb } = await import('@/lib/firebase/admin');
    if (!adminDb) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    const versionsPath = adminDal.getSubColPath('versions');
    const versionsRef = adminDb.collection(pageRef.path).doc(params.pageId).collection(versionsPath);
    const snapshot = await versionsRef.orderBy('version', 'desc').get();

    const versions = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({
      success: true,
      versions,
      currentVersion: pageData?.version,
      lastPublishedVersion: pageData?.lastPublishedVersion,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to fetch page versions', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/website/pages/[pageId]/versions',
      method: 'GET'
    });
    return NextResponse.json(
      { error: 'Failed to fetch versions', details: message },
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
    if (!adminDal) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const params = await context.params;
    const body = await request.json() as RequestBody;
    const { versionId } = body;

    if (!versionId) {
      return NextResponse.json(
        { error: 'versionId is required' },
        { status: 400 }
      );
    }

    const pageRef = adminDal.getNestedDocRef(
      'organizations/{orgId}/website/pages/items/{pageId}',
      { orgId: DEFAULT_ORG_ID, pageId: params.pageId }
    );

    const pageDoc = await pageRef.get();

    if (!pageDoc.exists) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      );
    }

    const pageData = pageDoc.data() as PageData | undefined;

    if (!pageData) {
      return NextResponse.json(
        { error: 'Page data not found' },
        { status: 404 }
      );
    }

    // Get the version to restore (using environment-aware subcollection path)
    const { adminDb: db } = await import('@/lib/firebase/admin');
    if (!db) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    const versionsPath = adminDal.getSubColPath('versions');
    const versionDoc = await db.collection(pageRef.path).doc(params.pageId).collection(versionsPath).doc(versionId).get();

    if (!versionDoc.exists) {
      return NextResponse.json(
        { error: 'Version not found' },
        { status: 404 }
      );
    }

    const versionData = versionDoc.data() as VersionData | undefined;
    const now = FieldValue.serverTimestamp();
    const performedBy = await getUserIdentifier();

    // Restore the version content
    await pageRef.update({
      content: versionData?.content ?? [],
      seo: versionData?.seo ?? {},
      title: versionData?.title ?? '',
      slug: versionData?.slug ?? '',
      status: 'draft', // Restored versions become drafts
      updatedAt: now,
      lastEditedBy: performedBy,
      version: (pageData.version ?? 1) + 1,
    });

    // Create audit log entry
    const auditRef = adminDal.getNestedCollection(
      'organizations/{orgId}/website/audit-log/entries',
      { orgId: DEFAULT_ORG_ID }
    );

    await auditRef.add({
      type: 'page_version_restored',
      pageId: params.pageId,
      pageTitle: pageData.title,
      restoredVersion: versionData?.version,
      performedBy,
      performedAt: now,
      organizationId: DEFAULT_ORG_ID,
    });

    return NextResponse.json({
      success: true,
      message: `Version ${versionData?.version} restored successfully`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to restore page version', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/website/pages/[pageId]/versions',
      method: 'POST'
    });
    return NextResponse.json(
      { error: 'Failed to restore version', details: message },
      { status: 500 }
    );
  }
}
