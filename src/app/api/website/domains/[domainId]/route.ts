/**
 * Single Domain API
 * Manage individual custom domain
 * CRITICAL: Multi-tenant isolation - validates organizationId
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, admin } from '@/lib/firebase-admin';

/**
 * DELETE /api/website/domains/[domainId]
 * Remove a custom domain
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ domainId: string }> }
) {
  try {
    const params = await context.params;
    const { searchParams } = request.nextUrl;
    const organizationId = searchParams.get('organizationId');
    const domainId = decodeURIComponent(params.domainId);

    // CRITICAL: Validate organizationId
    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      );
    }

    const domainRef = db
      .collection('organizations')
      .doc(organizationId)
      .collection('website')
      .doc('config')
      .collection('custom-domains')
      .doc(domainId);

    const doc = await domainRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: 'Domain not found' },
        { status: 404 }
      );
    }

    const domainData = doc.data();

    // CRITICAL: Verify organizationId matches
    if (domainData?.organizationId !== organizationId) {
      console.error('[SECURITY] Attempted cross-org domain deletion!', {
        requested: organizationId,
        actual: domainData?.organizationId,
        domainId,
      });
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Remove domain from Vercel
    try {
      const { removeVercelDomain } = await import('@/lib/vercel-domains');
      await removeVercelDomain(domainId);
    } catch (vercelError) {
      console.error('[Domain Delete] Vercel integration error:', vercelError);
      // Continue even if Vercel API fails
    }

    // Delete from organization's collection
    await domainRef.delete();

    // Delete from global domains collection
    await db.collection('custom-domains').doc(domainId).delete();

    // Create audit log
    const auditRef = db
      .collection('organizations')
      .doc(organizationId)
      .collection('website')
      .doc('audit-log')
      .collection('entries');

    await auditRef.add({
      type: 'domain_removed',
      domainId,
      performedBy: 'system', // TODO: Use actual user
      performedAt: new Date().toISOString(),
      organizationId,
    });

    return NextResponse.json({
      success: true,
      message: 'Domain removed successfully',
    });
  } catch (error: any) {
    console.error('[Domain API] DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to remove domain', details: error.message },
      { status: 500 }
    );
  }
}

