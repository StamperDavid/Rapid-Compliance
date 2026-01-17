/**
 * Single Domain API
 * Manage individual custom domain
 * CRITICAL: Multi-tenant isolation - validates organizationId
 */

import { type NextRequest, NextResponse } from 'next/server';
import { adminDal } from '@/lib/firebase/admin-dal';
import { getUserIdentifier } from '@/lib/server-auth';
import { logger } from '@/lib/logger/logger';

interface DomainData {
  organizationId: string;
}

/**
 * DELETE /api/website/domains/[domainId]
 * Remove a custom domain
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ domainId: string }> }
) {
  try {
    if (!adminDal) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

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

    const domainRef = adminDal.getNestedDocRef(
      'organizations/{orgId}/website/config/custom-domains/{domainId}',
      { orgId: organizationId, domainId }
    );

    const doc = await domainRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: 'Domain not found' },
        { status: 404 }
      );
    }

    const domainData = doc.data() as DomainData | undefined;

    // CRITICAL: Verify organizationId matches
    if (domainData?.organizationId !== organizationId) {
      logger.error('[SECURITY] Attempted cross-org domain deletion', new Error('Cross-org domain delete attempt'), {
        route: '/api/website/domains/[domainId]',
        method: 'DELETE',
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
      logger.error('Vercel integration error during domain deletion', vercelError instanceof Error ? vercelError : new Error(String(vercelError)), {
        route: '/api/website/domains/[domainId]',
        domainId,
        organizationId
      });
      // Continue even if Vercel API fails
    }

    // Delete from organization's collection
    await domainRef.delete();

    // Delete from global domains collection
    const globalDomainRef = adminDal.getNestedDocRef('custom-domains/{domainId}', { domainId });
    await globalDomainRef.delete();

    // Create audit log
    const performedBy = await getUserIdentifier();

    const auditRef = adminDal.getNestedCollection(
      'organizations/{orgId}/website/audit-log/entries',
      { orgId: organizationId }
    );

    await auditRef.add({
      type: 'domain_removed',
      domainId,
      performedBy,
      performedAt: new Date().toISOString(),
      organizationId,
    });

    return NextResponse.json({
      success: true,
      message: 'Domain removed successfully',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to remove domain', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/website/domains/[domainId]',
      method: 'DELETE'
    });
    return NextResponse.json(
      { error: 'Failed to remove domain', details: message },
      { status: 500 }
    );
  }
}
