import { NextRequest } from 'next/server';
import { adminDal } from '@/lib/firebase/admin-dal';
import { 
  verifyAdminRequest, 
  createErrorResponse, 
  createSuccessResponse,
  isAuthError
} from '@/lib/api/admin-auth';
import { logger } from '@/lib/logger/logger';

/**
 * POST /api/admin/cleanup-test-orgs
 * Deletes all test organizations from Firestore
 * Requires super_admin authentication
 */
export async function POST(request: NextRequest) {
  // Verify admin authentication
  const authResult = await verifyAdminRequest(request);
  
  if (isAuthError(authResult)) {
    return createErrorResponse(authResult.error, authResult.status);
  }
  
  // Only super_admins can delete organizations
  if (authResult.user.role !== 'super_admin') {
    return createErrorResponse('Only super_admins can delete organizations', 403);
  }
  
  try {
    if (!adminDal) {
      return createErrorResponse('Server configuration error', 500);
    }
    
    const { dryRun = true } = await request.json().catch(() => ({ dryRun: true }));
    
    // Test organization patterns to identify
    const TEST_PATTERNS = [
      'Test Payment Org',
      'Pagination Test Org',
    ];
    
    // Fetch all organizations using Admin DAL
    const orgsSnapshot = await adminDal.safeGetDocs('ORGANIZATIONS');
    
    const testOrgs: any[] = [];
    const realOrgs: any[] = [];
    
    // Identify test vs real organizations
    orgsSnapshot.forEach(doc => {
      const data = doc.data();
      const name = data.name || '';
      
      // Check if it's a test org
      let isTestOrg = false;
      
      // Check isTest flag
      if (data.isTest === true) {
        isTestOrg = true;
      }
      
      // Check name patterns
      for (const pattern of TEST_PATTERNS) {
        if (name === pattern) {
          isTestOrg = true;
          break;
        }
      }
      
      // Check for test prefixes
      if (name.startsWith('[TEST]') || name.startsWith('test-org-') || name.startsWith('TEMP_TEST')) {
        isTestOrg = true;
      }
      
      // Check for suspicious dates (before 2020)
      if (data.createdAt) {
        try {
          const timestamp = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
          const year = timestamp.getFullYear();
          if (year < 2020) {
            isTestOrg = true;
          }
        } catch (e) {
          // Invalid date, might be test data
        }
      }
      
      if (isTestOrg) {
        testOrgs.push({ id: doc.id, ...data });
      } else {
        realOrgs.push({ id: doc.id, name: data.name });
      }
    });
    
    logger.info('Test org analysis', {
      route: '/api/admin/cleanup-test-orgs',
      total: orgsSnapshot.size,
      testOrgs: testOrgs.length,
      realOrgs: realOrgs.length,
      dryRun
    });
    
    // If dry run, just return what would be deleted
    if (dryRun) {
      return createSuccessResponse({
        dryRun: true,
        analysis: {
          totalOrganizations: orgsSnapshot.size,
          testOrganizations: testOrgs.length,
          realOrganizations: realOrgs.length,
        },
        testOrgsToDelete: testOrgs.map(org => ({
          id: org.id,
          name: org.name,
          createdAt: org.createdAt?.toDate?.()?.toISOString() || null,
          reason: org.isTest ? 'isTest flag' : 'Pattern match'
        })),
        realOrgsToKeep: realOrgs.map(org => ({
          id: org.id,
          name: org.name
        })),
        message: 'This is a dry run. Set dryRun=false to actually delete.'
      });
    }
    
    // Actually delete test organizations using batch
    let deletedCount = 0;
    const batch = adminDal.batch();
    
    for (const org of testOrgs) {
      const orgRef = adminDal.getCollection('ORGANIZATIONS').doc(org.id);
      batch.delete(orgRef);
      deletedCount++;
      
      // Firestore batch limit is 500
      if (deletedCount % 500 === 0) {
        await batch.commit();
      }
    }
    
    // Commit remaining deletes
    if (deletedCount % 500 !== 0) {
      await batch.commit();
    }
    
    logger.info('Test orgs deleted', {
      route: '/api/admin/cleanup-test-orgs',
      admin: authResult.user.email,
      deletedCount,
      remainingOrgs: realOrgs.length
    });
    
    return createSuccessResponse({
      dryRun: false,
      deleted: deletedCount,
      remaining: realOrgs.length,
      deletedOrgs: testOrgs.map(org => ({
        id: org.id,
        name: org.name
      })),
      message: `Successfully deleted ${deletedCount} test organization(s)`
    });
    
  } catch (error: any) {
    logger.error('Cleanup test orgs error', error, { route: '/api/admin/cleanup-test-orgs' });
    return createErrorResponse(
      process.env.NODE_ENV === 'development'
        ? `Failed to cleanup: ${error.message}`
        : 'Failed to cleanup test organizations',
      500
    );
  }
}
