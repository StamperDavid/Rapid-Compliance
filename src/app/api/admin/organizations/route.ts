import type { NextRequest } from 'next/server';
import { adminDal } from '@/lib/firebase/admin-dal';
import { FieldValue } from 'firebase-admin/firestore';
import { 
  verifyAdminRequest, 
  createErrorResponse, 
  createSuccessResponse,
  isAuthError
} from '@/lib/api/admin-auth';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

interface OrganizationData {
  id: string;
  name: string;
  slug?: string;
  plan: string;
  status: string;
  industry?: string;
  billingEmail?: string;
  createdAt: string | null;
  updatedAt: string | null;
  createdBy?: string;
  settings?: Record<string, unknown>;
  isTest?: boolean;
}

/**
 * GET /api/admin/organizations
 * Fetches organizations for super_admin users with pagination
 * Uses Admin SDK to bypass client-side Firestore rules
 * 
 * Query params:
 * - limit: page size (default 50, max 100)
 * - startAfter: cursor for pagination (timestamp)
 */
export async function GET(request: NextRequest) {
  // Rate limiting
  const rateLimitResponse = await rateLimitMiddleware(request, '/api/admin/organizations');
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  // Verify admin authentication
  const authResult = await verifyAdminRequest(request);
  
  if (isAuthError(authResult)) {
    return createErrorResponse(authResult.error, authResult.status);
  }
  
  try {
    if (!adminDal) {
      return createErrorResponse('Server configuration error', 500);
    }
    
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const pageSize = Math.min(parseInt((limitParam !== '' && limitParam != null) ? limitParam : '50'), 100);
    const startAfter = searchParams.get('startAfter'); // ISO timestamp
    
    // Build query with pagination using Admin DAL
    const orgsSnapshot = await adminDal.safeQuery('ORGANIZATIONS', (ref) => {
      let query = ref.orderBy('createdAt', 'desc');
      
      // Add cursor if provided
      if (startAfter) {
        const cursorDate = new Date(startAfter);
        query = query.startAfter(cursorDate);
      }
      
      // Fetch one extra to check if there are more results
      return query.limit(pageSize + 1);
    });
    
    const hasMore = orgsSnapshot.docs.length > pageSize;
    const docs = hasMore ? orgsSnapshot.docs.slice(0, pageSize) : orgsSnapshot.docs;
    
    const organizations: OrganizationData[] = docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: (data.name !== '' && data.name != null) ? data.name : 'Unnamed Organization',
        slug: data.slug,
        plan: (data.plan !== '' && data.plan != null) ? data.plan : 'starter',
        status: (data.status !== '' && data.status != null) ? data.status : 'active',
        industry: data.industry,
        billingEmail: data.billingEmail,
        createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? null,
        createdBy: data.createdBy,
        settings: data.settings,
        isTest: data.isTest ?? false,
      };
    });
    
    // Get cursor for next page (last org's createdAt)
    const nextCursor = hasMore && organizations.length > 0 
      ? organizations[organizations.length - 1].createdAt 
      : null;
    
    logger.info('Admin fetched organizations', {
      route: '/api/admin/organizations',
      admin: authResult.user.email,
      count: organizations.length,
      hasMore
    });
    
    return createSuccessResponse({ 
      organizations,
      pagination: {
        count: organizations.length,
        hasMore,
        nextCursor,
      },
      fetchedAt: new Date().toISOString()
    });
    
  } catch (error: any) {
    logger.error('Admin organizations fetch error', error, { route: '/api/admin/organizations' });
    return createErrorResponse(
      process.env.NODE_ENV === 'development' 
        ? `Failed to fetch organizations: ${error.message}`
        : 'Failed to fetch organizations',
      500
    );
  }
}

/**
 * POST /api/admin/organizations
 * Creates a new organization (super_admin only)
 */
export async function POST(request: NextRequest) {
  // Verify admin authentication
  const authResult = await verifyAdminRequest(request);
  
  if (isAuthError(authResult)) {
    return createErrorResponse(authResult.error, authResult.status);
  }
  
  try {
    if (!adminDal) {
      return createErrorResponse('Server configuration error', 500);
    }
    
    const body = await request.json();
    
    // Validate required fields
    if (!body.name || typeof body.name !== 'string') {
      return createErrorResponse('Organization name is required', 400);
    }
    
    // Generate org ID
    const orgId = `org_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    
    // Create organization document
    const orgData = {
      name: body.name.trim(),
      slug: (body.slug !== '' && body.slug != null) ? body.slug : body.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      plan: (body.plan !== '' && body.plan != null) ? body.plan : 'starter',
      status: (body.status !== '' && body.status != null) ? body.status : 'active',
      industry: (body.industry !== '' && body.industry != null) ? body.industry : null,
      billingEmail: (body.billingEmail !== '' && body.billingEmail != null) ? body.billingEmail : null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdBy: authResult.user.uid,
      settings: body.settings ?? {},
    };
    
    await adminDal.safeSetDoc('ORGANIZATIONS', orgId, orgData, {
      audit: true,
      userId: authResult.user.uid,
    });
    
    logger.info('Admin created organization', {
      route: '/api/admin/organizations',
      admin: authResult.user.email,
      orgId,
      name: body.name
    });
    
    return createSuccessResponse({
      id: orgId,
      name: body.name.trim(),
      slug: (body.slug !== '' && body.slug != null) ? body.slug : body.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      plan: (body.plan !== '' && body.plan != null) ? body.plan : 'starter',
      status: (body.status !== '' && body.status != null) ? body.status : 'active',
      industry: (body.industry !== '' && body.industry != null) ? body.industry : null,
      billingEmail: (body.billingEmail !== '' && body.billingEmail != null) ? body.billingEmail : null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: authResult.user.uid,
      settings: body.settings ?? {},
    });
    
  } catch (error: any) {
    logger.error('Admin organization create error', error, { route: '/api/admin/organizations' });
    return createErrorResponse(
      process.env.NODE_ENV === 'development'
        ? `Failed to create organization: ${error.message}`
        : 'Failed to create organization',
      500
    );
  }
}
