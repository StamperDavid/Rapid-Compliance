/**
 * Single Domain API
 * Manage individual custom domain
 * Single-tenant: Uses PLATFORM_ID
 */

import { type NextRequest, NextResponse } from 'next/server';
import { adminDal } from '@/lib/firebase/admin-dal';
import { getSubCollection } from '@/lib/firebase/collections';
import { getUserIdentifier } from '@/lib/server-auth';
import { logger } from '@/lib/logger/logger';

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
    const domainId = decodeURIComponent(params.domainId);

    const domainRef = adminDal.getNestedDocRef(
      `${getSubCollection('website')}/config/custom-domains/{domainId}`,
      { domainId }
    );

    const doc = await domainRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: 'Domain not found' },
        { status: 404 }
      );
    }

    // Remove domain from Vercel
    try {
      const { removeVercelDomain } = await import('@/lib/vercel-domains');
      await removeVercelDomain(domainId);
    } catch (vercelError) {
      logger.error('Vercel integration error during domain deletion', vercelError instanceof Error ? vercelError : new Error(String(vercelError)), {
        route: '/api/website/domains/[domainId]',
        domainId
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
      `${getSubCollection('website')}/audit-log/entries`
    );

    await auditRef.add({
      type: 'domain_removed',
      domainId,
      performedBy,
      performedAt: new Date().toISOString(),
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
