/**
 * Domain Verification API
 * Verify DNS records and activate domain
 * CRITICAL: Multi-tenant isolation - validates organizationId
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { promises as dns } from 'dns';

/**
 * POST /api/website/domains/[domainId]/verify
 * Verify DNS records for a domain
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ domainId: string }> }
) {
  try {
    const params = await context.params;
    const body = await request.json();
    const { organizationId } = body;
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
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Verify DNS records
    const verification = await verifyDNSRecords(
      domainId,
      domainData?.verificationMethod || 'cname',
      domainData?.dnsRecords || []
    );

    const now = new Date().toISOString();

    if (verification.verified) {
      // Update domain status
      await domainRef.update({
        verified: true,
        verifiedAt: now,
        lastCheckedAt: now,
        status: 'active',
        dnsRecords: verification.records,
      });

      // Create audit log
      const auditRef = db
        .collection('organizations')
        .doc(organizationId)
        .collection('website')
        .doc('audit-log')
        .collection('entries');

      await auditRef.add({
        type: 'domain_verified',
        domainId,
        performedBy: 'system',
        performedAt: now,
        organizationId,
      });

      // Add domain to Vercel and provision SSL
      const { addVercelDomain, provisionSSL } = await import('@/lib/vercel-domains');
      
      try {
        const addResult = await addVercelDomain(domainId);
        if (addResult.success) {
          // Provision SSL certificate
          const sslResult = await provisionSSL(domainId);
          
          if (sslResult.success) {
            await domainRef.update({
              sslStatus: sslResult.status || 'pending',
              sslEnabled: sslResult.status === 'active',
              sslIssuedAt: sslResult.status === 'active' ? now : null,
              sslExpiresAt: sslResult.expiresAt || null,
            });
          }
        }
      } catch (vercelError) {
        console.error('[Domain Verify] Vercel integration error:', vercelError);
        // Continue even if Vercel API fails
      }

      return NextResponse.json({
        success: true,
        verified: true,
        message: 'Domain verified successfully! SSL certificate will be provisioned automatically.',
      });
    } else {
      // Update last checked time
      await domainRef.update({
        lastCheckedAt: now,
        dnsRecords: verification.records,
      });

      return NextResponse.json({
        success: false,
        verified: false,
        message: 'DNS records not found or incorrect. Please check your DNS configuration.',
        details: verification.errors,
      }, { status: 400 });
    }
  } catch (error: any) {
    console.error('[Domain Verify API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to verify domain', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Verify DNS records
 */
async function verifyDNSRecords(
  domain: string,
  method: string,
  dnsRecords: any[]
): Promise<{
  verified: boolean;
  records: any[];
  errors: string[];
}> {
  const errors: string[] = [];
  const updatedRecords = [...dnsRecords];

  try {
    if (method === 'cname') {
      // Verify CNAME record
      try {
        const records = await dns.resolveCname(domain);
        const expectedValue = process.env.VERCEL_URL || 'cname.vercel-dns.com';
        
        if (records.some(r => r.includes('vercel') || r === expectedValue)) {
          updatedRecords[0].status = 'verified';
          return {
            verified: true,
            records: updatedRecords,
            errors: [],
          };
        } else {
          errors.push(`CNAME record found but points to ${records[0]} instead of ${expectedValue}`);
        }
      } catch (err) {
        errors.push('CNAME record not found');
      }
    } else if (method === 'a-record') {
      // Verify A record
      try {
        const records = await dns.resolve4(domain);
        const expectedIP = '76.76.21.21'; // Vercel's IP
        
        if (records.includes(expectedIP)) {
          updatedRecords[0].status = 'verified';
          
          // Also check www CNAME if present
          try {
            const wwwRecords = await dns.resolveCname(`www.${domain}`);
            if (wwwRecords.some(r => r.includes('vercel'))) {
              updatedRecords[1].status = 'verified';
            }
          } catch {
            // www CNAME is optional
          }

          return {
            verified: true,
            records: updatedRecords,
            errors: [],
          };
        } else {
          errors.push(`A record found but points to ${records[0]} instead of ${expectedIP}`);
        }
      } catch (err) {
        errors.push('A record not found');
      }
    }
  } catch (error: any) {
    errors.push(`DNS lookup failed: ${error.message}`);
  }

  return {
    verified: false,
    records: updatedRecords,
    errors,
  };
}

