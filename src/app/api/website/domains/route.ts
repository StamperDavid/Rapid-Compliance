/**
 * Custom Domains API
 * Manage custom domains for websites
 * CRITICAL: Multi-tenant isolation - validates organizationId
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger/logger';

/**
 * GET /api/website/domains
 * List custom domains for an organization
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const organizationId = searchParams.get('organizationId');

    // CRITICAL: Validate organizationId
    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      );
    }

    const snapshot = await db
      .collection('organizations')
      .doc(organizationId)
      .collection('website')
      .doc('config')
      .collection('custom-domains')
      .get();

    const domains = snapshot.docs.map(doc => {
      const data = doc.data();
      
      // CRITICAL: Verify organizationId matches
      if (data.organizationId !== organizationId) {
        logger.error('[SECURITY] Domain organizationId mismatch!', new Error('Organization mismatch'), {
          route: '/api/website/domains',
          requested: organizationId,
          actual: data.organizationId,
          domainId: doc.id,
        });
        return null;
      }

      return {
        id: doc.id,
        ...data,
      };
    }).filter(domain => domain !== null);

    return NextResponse.json({
      success: true,
      domains,
    });
  } catch (error: any) {
    logger.error('[Domains API] GET error', error, { route: '/api/website/domains' });
    return NextResponse.json(
      { error: 'Failed to fetch domains', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/website/domains
 * Add a new custom domain
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { organizationId, domain } = body;

    // CRITICAL: Validate organizationId
    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      );
    }

    if (!domain) {
      return NextResponse.json(
        { error: 'domain is required' },
        { status: 400 }
      );
    }

    // Validate domain format
    const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;
    if (!domainRegex.test(domain)) {
      return NextResponse.json(
        { error: 'Invalid domain format' },
        { status: 400 }
      );
    }

    // Check if domain already exists (across all organizations)
    const allOrgsSnapshot = await db.collectionGroup('custom-domains')
      .where('__name__', '==', domain)
      .limit(1)
      .get();

    if (!allOrgsSnapshot.empty) {
      return NextResponse.json(
        { error: 'This domain is already in use' },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();

    // Determine verification method based on domain
    const isApex = !domain.includes('www.');
    const verificationMethod = isApex ? 'a-record' : 'cname';

    // Generate DNS records
    const dnsRecords = generateDNSRecords(domain, verificationMethod);

    const domainData = {
      organizationId, // CRITICAL: Set ownership
      verified: false,
      verificationMethod,
      verificationValue: generateVerificationToken(),
      dnsRecords,
      sslEnabled: false,
      sslStatus: 'pending' as const,
      status: 'pending' as const,
      createdAt: now,
      lastCheckedAt: now,
    };

    // Save domain using domain name as document ID
    const domainRef = db
      .collection('organizations')
      .doc(organizationId)
      .collection('website')
      .doc('config')
      .collection('custom-domains')
      .doc(domain);

    await domainRef.set(domainData);

    // Also save to global domains collection for quick lookup
    await db.collection('custom-domains').doc(domain).set({
      organizationId,
      createdAt: now,
    });

    return NextResponse.json({
      success: true,
      domain: {
        id: domain,
        ...domainData,
      },
    }, { status: 201 });
  } catch (error: any) {
    logger.error('[Domains API] POST error', error, { route: '/api/website/domains' });
    return NextResponse.json(
      { error: 'Failed to add domain', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Generate DNS records for domain verification
 */
function generateDNSRecords(domain: string, method: 'cname' | 'a-record'): Array<{
  type: string;
  name: string;
  value: string;
  status: string;
}> {
  const vercelDomain = process.env.VERCEL_URL || 'cname.vercel-dns.com';
  const vercelIP = '76.76.21.21'; // Vercel's IP address

  if (method === 'cname') {
    return [
      {
        type: 'CNAME',
        name: domain,
        value: vercelDomain,
        status: 'pending',
      },
    ];
  } else {
    // A record for apex domain
    return [
      {
        type: 'A',
        name: '@',
        value: vercelIP,
        status: 'pending',
      },
      {
        type: 'CNAME',
        name: 'www',
        value: vercelDomain,
        status: 'pending',
      },
    ];
  }
}

/**
 * Generate verification token
 */
function generateVerificationToken(): string {
  return `verify-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

