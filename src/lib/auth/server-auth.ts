/**
 * Server-side Authentication Utilities
 * Helper functions for authenticating requests in API routes and server components
 */

import { NextRequest } from 'next/server';
import { requireAuth, requireRole, requireOrganization, AuthenticatedUser } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';

/**
 * Get authenticated user token from request
 * This is a convenience wrapper around requireAuth
 */
export async function getAuthToken(request: NextRequest): Promise<AuthenticatedUser | null> {
  try {
    const result = await requireAuth(request);
    
    // If result is a NextResponse, authentication failed
    if ('status' in result) {
      return null;
    }
    
    return result.user;
  } catch (error) {
    logger.error('Error getting auth token', error);
    return null;
  }
}

/**
 * Require authentication for an API route
 * Returns user or throws an error
 */
export async function requireAuthToken(request: NextRequest): Promise<AuthenticatedUser> {
  const user = await getAuthToken(request);
  
  if (!user) {
    throw new Error('Authentication required');
  }
  
  return user;
}

/**
 * Require specific role for an API route
 */
export async function requireUserRole(
  request: NextRequest,
  allowedRoles: string[]
): Promise<AuthenticatedUser> {
  const result = await requireRole(request, allowedRoles);
  
  if ('status' in result) {
    throw new Error('Insufficient permissions');
  }
  
  return result.user;
}

/**
 * Require organization membership for an API route
 */
export async function requireUserOrganization(
  request: NextRequest,
  organizationId?: string
): Promise<AuthenticatedUser> {
  const result = await requireOrganization(request, organizationId);
  
  if ('status' in result) {
    throw new Error('Organization access denied');
  }
  
  return result.user;
}

/**
 * Extract user ID from request (convenience method)
 */
export async function getUserId(request: NextRequest): Promise<string | null> {
  const user = await getAuthToken(request);
  return user?.uid || null;
}

/**
 * Extract organization ID from request (convenience method)
 */
export async function getOrganizationId(request: NextRequest): Promise<string | null> {
  const user = await getAuthToken(request);
  return user?.organizationId || null;
}

/**
 * Check if user has specific role
 */
export async function hasRole(request: NextRequest, role: string): Promise<boolean> {
  const user = await getAuthToken(request);
  return user?.role === role;
}

/**
 * Check if user is admin
 */
export async function isAdmin(request: NextRequest): Promise<boolean> {
  const user = await getAuthToken(request);
  return user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'owner';
}




