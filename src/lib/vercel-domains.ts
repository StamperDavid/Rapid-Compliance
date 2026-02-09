/**
 * Vercel Domains API Integration
 * Manage domains and SSL certificates via Vercel API
 */

import { logger } from '@/lib/logger/logger';

const VERCEL_API_URL = 'https://api.vercel.com';
const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID;
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;

interface VercelDomainResponse {
  name: string;
  verified: boolean;
  verification?: Array<{
    type: string;
    domain: string;
    value: string;
    reason: string;
  }>;
}

interface VercelSSLResponse {
  created: number;
  expiration: number;
}

interface VercelErrorResponse {
  error?: {
    message?: string;
  };
}

interface VercelDomainData {
  name: string;
  verified: boolean;
  ssl?: VercelSSLResponse;
  verification?: Array<{
    type: string;
    domain: string;
    value: string;
    reason: string;
  }>;
}

/**
 * Add domain to Vercel project
 */
export async function addVercelDomain(domain: string): Promise<{
  success: boolean;
  domain?: VercelDomainResponse;
  error?: string;
}> {
  if (!VERCEL_TOKEN || !VERCEL_PROJECT_ID) {
    console.warn('[Vercel Domains] Missing API credentials');
    return {
      success: false,
      error: 'Vercel API not configured. Please set VERCEL_TOKEN and VERCEL_PROJECT_ID environment variables.',
    };
  }

  try {
    const url = VERCEL_TEAM_ID
      ? `${VERCEL_API_URL}/v10/projects/${VERCEL_PROJECT_ID}/domains?teamId=${VERCEL_TEAM_ID}`
      : `${VERCEL_API_URL}/v10/projects/${VERCEL_PROJECT_ID}/domains`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${VERCEL_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: domain,
      }),
    });

    if (!response.ok) {
      const errorData = (await response.json()) as VercelErrorResponse;
       
      console.error('[Vercel Domains] Add domain error:', errorData);
      const errorMessage = errorData.error?.message ?? '';
      return {
        success: false,
        error: errorMessage !== '' ? errorMessage : 'Failed to add domain to Vercel',
      };
    }

    const data = (await response.json()) as VercelDomainResponse;
    logger.info('[Vercel Domains] Domain added', { domain });

    return {
      success: true,
      domain: data,
    };
  } catch (error) {
     
    console.error('[Vercel Domains] Add domain exception:', error);
    const errorMessage = error instanceof Error ? error.message : '';
    return {
      success: false,
      error: errorMessage !== '' ? errorMessage : 'Failed to add domain to Vercel',
    };
  }
}

/**
 * Verify domain in Vercel
 */
export async function verifyVercelDomain(domain: string): Promise<{
  success: boolean;
  verified?: boolean;
  error?: string;
}> {
  if (!VERCEL_TOKEN || !VERCEL_PROJECT_ID) {
    return {
      success: false,
      error: 'Vercel API not configured',
    };
  }

  try {
    const url = VERCEL_TEAM_ID
      ? `${VERCEL_API_URL}/v9/projects/${VERCEL_PROJECT_ID}/domains/${domain}/verify?teamId=${VERCEL_TEAM_ID}`
      : `${VERCEL_API_URL}/v9/projects/${VERCEL_PROJECT_ID}/domains/${domain}/verify`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${VERCEL_TOKEN}`,
      },
    });

    if (!response.ok) {
      const errorData = (await response.json()) as VercelErrorResponse;
       
      console.error('[Vercel Domains] Verify domain error:', errorData);
      const errorMessage = errorData.error?.message ?? '';
      return {
        success: false,
        error: errorMessage !== '' ? errorMessage : 'Failed to verify domain',
      };
    }

    const data = (await response.json()) as VercelDomainResponse;
    logger.info('[Vercel Domains] Domain verified', { domain });

    return {
      success: true,
      verified: data.verified ?? false,
    };
  } catch (error) {
     
    console.error('[Vercel Domains] Verify domain exception:', error);
    const errorMessage = error instanceof Error ? error.message : '';
    return {
      success: false,
      error: errorMessage !== '' ? errorMessage : 'Failed to verify domain',
    };
  }
}

/**
 * Get domain configuration from Vercel
 */
export async function getVercelDomain(domain: string): Promise<{
  success: boolean;
  domain?: VercelDomainData;
  error?: string;
}> {
  if (!VERCEL_TOKEN || !VERCEL_PROJECT_ID) {
    return {
      success: false,
      error: 'Vercel API not configured',
    };
  }

  try {
    const url = VERCEL_TEAM_ID
      ? `${VERCEL_API_URL}/v9/projects/${VERCEL_PROJECT_ID}/domains/${domain}?teamId=${VERCEL_TEAM_ID}`
      : `${VERCEL_API_URL}/v9/projects/${VERCEL_PROJECT_ID}/domains/${domain}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${VERCEL_TOKEN}`,
      },
    });

    if (!response.ok) {
      const errorData = (await response.json()) as VercelErrorResponse;
      const errorMessage = errorData.error?.message ?? '';
      return {
        success: false,
        error: errorMessage !== '' ? errorMessage : 'Failed to get domain',
      };
    }

    const data = (await response.json()) as VercelDomainData;

    return {
      success: true,
      domain: data,
    };
  } catch (error) {
     
    console.error('[Vercel Domains] Get domain exception:', error);
    const errorMessage = error instanceof Error ? error.message : '';
    return {
      success: false,
      error: errorMessage !== '' ? errorMessage : 'Failed to get domain',
    };
  }
}

/**
 * Remove domain from Vercel project
 */
export async function removeVercelDomain(domain: string): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!VERCEL_TOKEN || !VERCEL_PROJECT_ID) {
    return {
      success: false,
      error: 'Vercel API not configured',
    };
  }

  try {
    const url = VERCEL_TEAM_ID
      ? `${VERCEL_API_URL}/v9/projects/${VERCEL_PROJECT_ID}/domains/${domain}?teamId=${VERCEL_TEAM_ID}`
      : `${VERCEL_API_URL}/v9/projects/${VERCEL_PROJECT_ID}/domains/${domain}`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${VERCEL_TOKEN}`,
      },
    });

    if (!response.ok) {
      const errorData = (await response.json()) as VercelErrorResponse;
       
      console.error('[Vercel Domains] Remove domain error:', errorData);
      const errorMessage = errorData.error?.message ?? '';
      return {
        success: false,
        error: errorMessage !== '' ? errorMessage : 'Failed to remove domain',
      };
    }

    logger.info('[Vercel Domains] Domain removed', { domain });

    return {
      success: true,
    };
  } catch (error) {
     
    console.error('[Vercel Domains] Remove domain exception:', error);
    const errorMessage = error instanceof Error ? error.message : '';
    return {
      success: false,
      error: errorMessage !== '' ? errorMessage : 'Failed to remove domain',
    };
  }
}

/**
 * Get SSL certificate status
 */
export async function getSSLStatus(domain: string): Promise<{
  success: boolean;
  ssl?: VercelSSLResponse;
  error?: string;
}> {
  const domainInfo = await getVercelDomain(domain);

  if (!domainInfo.success || !domainInfo.domain) {
    const errorMsg = domainInfo.error ?? 'Failed to get domain info';
    return {
      success: false,
      error: errorMsg !== '' ? errorMsg : 'Failed to get domain info',
    };
  }

  // SSL info is included in domain response
  const sslInfo: VercelSSLResponse | undefined = domainInfo.domain.ssl;

  if (!sslInfo) {
    return {
      success: false,
      error: 'No SSL certificate information available',
    };
  }

  return {
    success: true,
    ssl: sslInfo,
  };
}

/**
 * Check if SSL certificate is active
 */
export async function isSSLActive(domain: string): Promise<boolean> {
  const sslStatus = await getSSLStatus(domain);
  
  if (!sslStatus.success || !sslStatus.ssl) {
    return false;
  }

  const now = Date.now();
  const expiration = sslStatus.ssl.expiration * 1000; // Convert to milliseconds

  // SSL is active if it exists and hasn't expired
  return expiration > now;
}

/**
 * Auto-provision SSL certificate
 * Note: Vercel automatically provisions SSL when domain is verified
 * This function triggers the process and checks status
 */
export async function provisionSSL(domain: string): Promise<{
  success: boolean;
  status?: 'pending' | 'active' | 'failed';
  expiresAt?: string;
  error?: string;
}> {
  try {
    // First, ensure domain is verified
    const verifyResult = await verifyVercelDomain(domain);

    if (!verifyResult.success || !verifyResult.verified) {
      return {
        success: false,
        status: 'failed',
        error: 'Domain must be verified before SSL can be provisioned',
      };
    }

    // Wait a few seconds for SSL to provision
    await new Promise<void>(resolve => {
      setTimeout(() => resolve(), 5000);
    });

    // Check SSL status
    const sslStatus = await getSSLStatus(domain);

    if (sslStatus.success && sslStatus.ssl) {
      return {
        success: true,
        status: 'active',
        expiresAt: new Date(sslStatus.ssl.expiration * 1000).toISOString(),
      };
    }

    // SSL is still pending
    return {
      success: true,
      status: 'pending',
    };
  } catch (error) {
     
    console.error('[Vercel Domains] SSL provisioning error:', error);
    const errorMessage = error instanceof Error ? error.message : '';
    return {
      success: false,
      status: 'failed',
      error: errorMessage !== '' ? errorMessage : 'Failed to provision SSL',
    };
  }
}


