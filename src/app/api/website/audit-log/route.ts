/**
 * Audit Log API
 * View change history and publishing activity
 * CRITICAL: Multi-tenant isolation - validates organizationId
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/website/audit-log
 * Get audit log entries for an organization
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const organizationId = searchParams.get('organizationId');
    const type = searchParams.get('type'); // Filter by event type
    const pageId = searchParams.get('pageId'); // Filter by page
    const postId = searchParams.get('postId'); // Filter by blog post
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // CRITICAL: Validate organizationId
    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      );
    }

    let query = db
      .collection('organizations')
      .doc(organizationId)
      .collection('website')
      .doc('audit-log')
      .collection('entries')
      .orderBy('performedAt', 'desc');

    // Apply filters if specified
    if (type) {
      query = query.where('type', '==', type) as any;
    }
    if (pageId) {
      query = query.where('pageId', '==', pageId) as any;
    }
    if (postId) {
      query = query.where('postId', '==', postId) as any;
    }

    // Limit results
    query = query.limit(limit) as any;

    const snapshot = await query.get();

    const entries = snapshot.docs.map(doc => {
      const data = doc.data();
      
      // CRITICAL: Double-check organizationId matches
      if (data.organizationId !== organizationId) {
        console.error('[SECURITY] Audit log organizationId mismatch!', {
          requested: organizationId,
          actual: data.organizationId,
          entryId: doc.id,
        });
        return null;
      }

      return {
        id: doc.id,
        ...data,
        // Convert Firestore Timestamp to ISO string if needed
        performedAt: data.performedAt?.toDate
          ? data.performedAt.toDate().toISOString()
          : data.performedAt,
      };
    }).filter(entry => entry !== null);

    return NextResponse.json({
      success: true,
      entries,
      count: entries.length,
    });
  } catch (error: any) {
    console.error('[Audit Log API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch audit log', details: error.message },
      { status: 500 }
    );
  }
}

