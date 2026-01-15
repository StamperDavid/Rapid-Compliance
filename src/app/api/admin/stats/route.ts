/**
 * Admin Platform Statistics API
 *
 * GET /api/admin/stats
 * Returns verified platform statistics for Jasper (Admin AI Assistant).
 *
 * Uses Firestore .count() aggregation for accurate counts.
 * Filters by user's authenticated orgId unless they are a Super Admin.
 *
 * @module admin-stats-route
 */

import type { NextRequest } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import {
  verifyAdminRequest,
  createErrorResponse,
  createSuccessResponse,
  isAuthError,
} from '@/lib/api/admin-auth';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { COLLECTIONS } from '@/lib/firebase/collections';
import {
  extractTenantClaims,
  isSuperAdmin,
  getEffectiveOrgId,
} from '@/lib/auth/claims-validator';

// ============================================================================
// TYPES
// ============================================================================

interface PlatformStats {
  /** Total number of organizations */
  totalOrgs: number;
  /** Number of active AI agents deployed */
  activeAgents: number;
  /** Number of pending support tickets */
  pendingTickets: number;
  /** Number of organizations on trial plans */
  trialOrgs: number;
  /** Monthly recurring revenue (if super admin) */
  monthlyRevenue?: number;
  /** Total users across all organizations */
  totalUsers: number;
  /** Timestamp when stats were fetched */
  fetchedAt: string;
  /** Whether these are global or org-scoped stats */
  scope: 'global' | 'organization';
}

// ============================================================================
// HELPER: Firestore Count Query
// ============================================================================

/**
 * Get document count from a Firestore collection using aggregation.
 * This is much more efficient than fetching all documents.
 *
 * FALLBACK LOGIC: If prefixed collection (test_) returns 0 in non-production,
 * also check the unprefixed collection. This handles cases where data
 * exists in production-style collections during development.
 *
 * @param collectionPath - Path to the collection
 * @returns Document count
 */
async function getCollectionCount(collectionPath: string): Promise<number> {
  if (!adminDb) {
    logger.warn('Admin DB not initialized for count query', { file: 'admin-stats-route.ts' });
    return 0;
  }

  try {
    const collectionRef = adminDb.collection(collectionPath);
    const countSnapshot = await collectionRef.count().get();
    const count = countSnapshot.data().count;

    // FALLBACK: If count is 0 and we're using a prefixed collection, try unprefixed
    if (count === 0 && collectionPath.startsWith('test_')) {
      const unprefixedPath = collectionPath.replace(/^test_/, '');
      try {
        const unprefixedRef = adminDb.collection(unprefixedPath);
        const unprefixedSnapshot = await unprefixedRef.count().get();
        const unprefixedCount = unprefixedSnapshot.data().count;

        if (unprefixedCount > 0) {
          logger.info('Fallback to unprefixed collection succeeded', {
            prefixedPath: collectionPath,
            unprefixedPath,
            count: unprefixedCount,
            file: 'admin-stats-route.ts',
          });
          return unprefixedCount;
        }
      } catch {
        // Unprefixed collection doesn't exist or error, return original count
      }
    }

    return count;
  } catch (error: unknown) {
    logger.error('Failed to get collection count', error, {
      collection: collectionPath,
      file: 'admin-stats-route.ts',
    });
    return 0;
  }
}

/**
 * Get document count with a where clause.
 *
 * FALLBACK LOGIC: Same as getCollectionCount - tries unprefixed if prefixed returns 0.
 *
 * @param collectionPath - Path to the collection
 * @param field - Field to filter on
 * @param operator - Comparison operator
 * @param value - Value to compare
 * @returns Document count
 */
async function getCollectionCountWhere(
  collectionPath: string,
  field: string,
  operator: FirebaseFirestore.WhereFilterOp,
  value: string
): Promise<number> {
  if (!adminDb) {
    return 0;
  }

  try {
    const collectionRef = adminDb.collection(collectionPath);
    const query = collectionRef.where(field, operator, value);
    const countSnapshot = await query.count().get();
    const count = countSnapshot.data().count;

    // FALLBACK: If count is 0 and we're using a prefixed collection, try unprefixed
    if (count === 0 && collectionPath.startsWith('test_')) {
      const unprefixedPath = collectionPath.replace(/^test_/, '');
      try {
        const unprefixedRef = adminDb.collection(unprefixedPath);
        const unprefixedQuery = unprefixedRef.where(field, operator, value);
        const unprefixedSnapshot = await unprefixedQuery.count().get();
        const unprefixedCount = unprefixedSnapshot.data().count;

        if (unprefixedCount > 0) {
          return unprefixedCount;
        }
      } catch {
        // Unprefixed collection doesn't exist or error
      }
    }

    return count;
  } catch (error: unknown) {
    logger.error('Failed to get filtered collection count', error, {
      collection: collectionPath,
      field,
      file: 'admin-stats-route.ts',
    });
    return 0;
  }
}

// ============================================================================
// ROUTE HANDLER
// ============================================================================

/**
 * GET /api/admin/stats
 * Fetches platform statistics for the admin dashboard.
 *
 * Super Admins get global statistics.
 * Regular admins get statistics scoped to their organization.
 */
export async function GET(request: NextRequest) {
  // Rate limiting (stricter for stats endpoint)
  const rateLimitResponse = await rateLimitMiddleware(request, '/api/admin/stats');
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  // Verify admin authentication
  const authResult = await verifyAdminRequest(request);

  if (isAuthError(authResult)) {
    return createErrorResponse(authResult.error, authResult.status);
  }

  try {
    if (!adminDb || !adminAuth) {
      return createErrorResponse('Server configuration error', 500);
    }

    // Get the auth token to extract claims
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.split('Bearer ')[1];

    if (!token) {
      return createErrorResponse('Missing authentication token', 401);
    }

    // Verify token and extract claims
    const decodedToken = await adminAuth.verifyIdToken(token);
    const claimsResult = extractTenantClaims(decodedToken);
    const claims = claimsResult.claims;

    // Determine if user has global access
    const isGlobalAdmin = isSuperAdmin(claims);
    const effectiveOrgId = getEffectiveOrgId(claims);

    let stats: PlatformStats;

    if (isGlobalAdmin) {
      // Super Admin: Get global platform statistics
      logger.info('Fetching global platform stats for super admin', {
        email: claims.email,
        file: 'admin-stats-route.ts',
      });

      // DEBUG: Log the collection path being queried
      logger.debug('[STATS DEBUG] Querying collection:', { collection: COLLECTIONS.ORGANIZATIONS });

      // Parallel count queries for efficiency
      const [totalOrgs, totalUsers, trialOrgs] = await Promise.all([
        getCollectionCount(COLLECTIONS.ORGANIZATIONS),
        getCollectionCount(COLLECTIONS.USERS),
        getCollectionCountWhere(COLLECTIONS.ORGANIZATIONS, 'plan', '==', 'trial'),
      ]);

      // DEBUG: Log the raw counts
      logger.debug('[STATS DEBUG] Raw counts:', { totalOrgs, totalUsers, trialOrgs });

      // Estimate active agents (one per org on average)
      const activeAgents = totalOrgs; // Could query actual agent configs

      // Pending tickets would come from a support collection
      const pendingTickets = 0; // Placeholder

      stats = {
        totalOrgs,
        activeAgents,
        pendingTickets,
        trialOrgs,
        totalUsers,
        monthlyRevenue: 0, // Would come from billing system
        fetchedAt: new Date().toISOString(),
        scope: 'global',
      };

      // DEBUG: Log the final stats object
      logger.debug('[STATS DEBUG] Final stats:', stats);

      logger.info('Global platform stats fetched', {
        totalOrgs,
        totalUsers,
        trialOrgs,
        file: 'admin-stats-route.ts',
      });
    } else {
      // Regular Admin: Get org-scoped statistics
      if (!effectiveOrgId) {
        return createErrorResponse('No organization context available', 403);
      }

      logger.info('Fetching org-scoped stats', {
        orgId: effectiveOrgId,
        email: claims.email,
        file: 'admin-stats-route.ts',
      });

      // Count users in this organization
      const orgUsersPath = `${COLLECTIONS.ORGANIZATIONS}/${effectiveOrgId}/members`;
      const orgUsers = await getCollectionCount(orgUsersPath);

      // Count workspaces in this organization
      const workspacesPath = `${COLLECTIONS.ORGANIZATIONS}/${effectiveOrgId}/workspaces`;
      const workspaces = await getCollectionCount(workspacesPath);

      stats = {
        totalOrgs: 1, // This org only
        activeAgents: 1, // This org's agent
        pendingTickets: 0,
        trialOrgs: 0,
        totalUsers: orgUsers,
        fetchedAt: new Date().toISOString(),
        scope: 'organization',
      };

      logger.info('Org-scoped stats fetched', {
        orgId: effectiveOrgId,
        users: orgUsers,
        workspaces,
        file: 'admin-stats-route.ts',
      });
    }

    return createSuccessResponse({
      stats,
      user: {
        email: claims.email,
        isGlobalAdmin,
        orgId: effectiveOrgId,
      },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Admin stats fetch error', error, { route: '/api/admin/stats' });
    return createErrorResponse(
      process.env.NODE_ENV === 'development'
        ? `Failed to fetch stats: ${errorMessage}`
        : 'Failed to fetch platform statistics',
      500
    );
  }
}

/**
 * POST /api/admin/stats/refresh
 * Force refresh of cached statistics.
 * Only available to super admins.
 */
export async function POST(request: NextRequest) {
  // Verify admin authentication
  const authResult = await verifyAdminRequest(request);

  if (isAuthError(authResult)) {
    return createErrorResponse(authResult.error, authResult.status);
  }

  try {
    // Get the auth token to extract claims
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.split('Bearer ')[1];

    if (!token || !adminAuth) {
      return createErrorResponse('Missing authentication token', 401);
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const claimsResult = extractTenantClaims(decodedToken);

    if (!isSuperAdmin(claimsResult.claims)) {
      return createErrorResponse('Super admin access required for stats refresh', 403);
    }

    // In production, this would invalidate a cache
    logger.info('Stats cache refresh requested', {
      email: claimsResult.claims.email,
      file: 'admin-stats-route.ts',
    });

    return createSuccessResponse({
      refreshed: true,
      timestamp: new Date().toISOString(),
    });

  } catch (error: unknown) {
    logger.error('Stats refresh error', error, { route: '/api/admin/stats' });
    return createErrorResponse('Failed to refresh statistics', 500);
  }
}
