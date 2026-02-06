/**
 * Audit Log API
 * View change history and publishing activity
 * Single-tenant: Uses DEFAULT_ORG_ID
 */

import { type NextRequest, NextResponse } from 'next/server';
import { adminDal } from '@/lib/firebase/admin-dal';
import { logger } from '@/lib/logger/logger';
import { DEFAULT_ORG_ID } from '@/lib/constants/platform';
import type { Query, DocumentData } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

// Audit entry type
interface AuditEntry {
  id: string;
  organizationId?: string;
  type?: string;
  pageId?: string;
  postId?: string;
  performedAt?: { toDate?: () => Date } | string;
  [key: string]: unknown;
}

/**
 * GET /api/website/audit-log
 * Get audit log entries for an organization
 */
export async function GET(request: NextRequest) {
  try {
    if (!adminDal) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const { searchParams } = request.nextUrl;
    const organizationId = DEFAULT_ORG_ID;
    const type = searchParams.get('type'); // Filter by event type
    const pageId = searchParams.get('pageId'); // Filter by page
    const postId = searchParams.get('postId'); // Filter by blog post
    const limitParam = searchParams.get('limit');
    const limit = parseInt(limitParam ?? '50', 10);

    const auditRef = adminDal.getNestedCollection(
      'organizations/{orgId}/website/audit-log/entries',
      { orgId: organizationId }
    );
    let query: Query<DocumentData> = auditRef.orderBy('performedAt', 'desc');

    // Apply filters if specified
    if (type) {
      query = query.where('type', '==', type);
    }
    if (pageId) {
      query = query.where('pageId', '==', pageId);
    }
    if (postId) {
      query = query.where('postId', '==', postId);
    }

    // Limit results
    query = query.limit(limit);

    const snapshot = await query.get();

    const entries: AuditEntry[] = [];
    for (const doc of snapshot.docs) {
      const data = doc.data() as AuditEntry;

      // CRITICAL: Double-check organizationId matches
      if (data.organizationId && data.organizationId !== organizationId) {
        logger.error('[SECURITY] Audit log organizationId mismatch', new Error('Audit log cross-org access'), {
          route: '/api/website/audit-log',
          method: 'GET',
          requested: organizationId,
          actual: data.organizationId,
          entryId: doc.id,
        });
        continue;
      }

      // Convert Firestore Timestamp to ISO string if needed
      let performedAt: string | undefined;
      const performedAtValue = data.performedAt;
      if (performedAtValue && typeof performedAtValue === 'object' && 'toDate' in performedAtValue && typeof performedAtValue.toDate === 'function') {
        performedAt = performedAtValue.toDate().toISOString();
      } else if (typeof performedAtValue === 'string') {
        performedAt = performedAtValue;
      }

      entries.push({
        ...data,
        id: doc.id, // Override data.id with doc.id
        performedAt,
      });
    }

    return NextResponse.json({
      success: true,
      entries,
      count: entries.length,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to fetch audit log', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/website/audit-log',
      method: 'GET'
    });
    return NextResponse.json(
      { error: 'Failed to fetch audit log', details: errorMessage },
      { status: 500 }
    );
  }
}
