import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { 
  verifyAdminRequest, 
  createErrorResponse, 
  createSuccessResponse,
  isAuthError
} from '@/lib/api/admin-auth';

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
}

/**
 * GET /api/admin/organizations
 * Fetches all organizations for super_admin users
 * Uses Admin SDK to bypass client-side Firestore rules
 */
export async function GET(request: NextRequest) {
  // Verify admin authentication
  const authResult = await verifyAdminRequest(request);
  
  if (isAuthError(authResult)) {
    return createErrorResponse(authResult.error, authResult.status);
  }
  
  try {
    // Fetch all organizations using Admin SDK
    const orgsSnapshot = await adminDb
      .collection('organizations')
      .orderBy('createdAt', 'desc')
      .get();
    
    const organizations: OrganizationData[] = orgsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || 'Unnamed Organization',
        slug: data.slug,
        plan: data.plan || 'starter',
        status: data.status || 'active',
        industry: data.industry,
        billingEmail: data.billingEmail,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
        createdBy: data.createdBy,
        settings: data.settings,
      };
    });
    
    console.log(
      `📊 [Admin API] ${authResult.user.email} fetched ${organizations.length} organizations`
    );
    
    return createSuccessResponse({ 
      organizations,
      count: organizations.length,
      fetchedAt: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('❌ [Admin API] Organizations fetch error:', error);
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
      slug: body.slug || body.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      plan: body.plan || 'starter',
      status: body.status || 'active',
      industry: body.industry || null,
      billingEmail: body.billingEmail || null,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: authResult.user.uid,
      settings: body.settings || {},
    };
    
    await adminDb.collection('organizations').doc(orgId).set(orgData);
    
    console.log(
      `📊 [Admin API] ${authResult.user.email} created organization: ${orgId} (${body.name})`
    );
    
    return createSuccessResponse({
      id: orgId,
      ...orgData,
      createdAt: orgData.createdAt.toISOString(),
      updatedAt: orgData.updatedAt.toISOString(),
    });
    
  } catch (error: any) {
    console.error('❌ [Admin API] Organization create error:', error);
    return createErrorResponse(
      process.env.NODE_ENV === 'development'
        ? `Failed to create organization: ${error.message}`
        : 'Failed to create organization',
      500
    );
  }
}
