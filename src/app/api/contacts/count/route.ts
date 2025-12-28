/**
 * Count Contacts API
 * Returns count of contacts matching filter criteria
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { FirestoreService } from '@/lib/db/firestore-service';
import { where, QueryConstraint } from 'firebase/firestore';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import type { ViewFilter } from '@/types/filters';

/**
 * Convert ViewFilter to Firestore query constraints
 */
function buildQueryConstraints(filters: ViewFilter[]): QueryConstraint[] {
  const constraints: QueryConstraint[] = [];

  for (const filter of filters) {
    for (const group of filter.groups) {
      for (const condition of group.conditions) {
        const { field, operator, value } = condition;

        if (!value && value !== 0 && value !== false) continue;

        switch (operator) {
          case 'equals':
            constraints.push(where(field, '==', value));
            break;
          case 'notEquals':
            constraints.push(where(field, '!=', value));
            break;
          case 'contains':
            // Firestore doesn't support contains, but we can use >= and <= for prefix match
            if (typeof value === 'string') {
              constraints.push(where(field, '>=', value));
              constraints.push(where(field, '<=', value + '\uf8ff'));
            }
            break;
          case 'greaterThan':
            constraints.push(where(field, '>', value));
            break;
          case 'lessThan':
            constraints.push(where(field, '<', value));
            break;
          case 'greaterThanOrEqual':
            constraints.push(where(field, '>=', value));
            break;
          case 'lessThanOrEqual':
            constraints.push(where(field, '<=', value));
            break;
          case 'in':
            if (Array.isArray(value)) {
              constraints.push(where(field, 'in', value));
            }
            break;
          case 'notIn':
            if (Array.isArray(value)) {
              constraints.push(where(field, 'not-in', value));
            }
            break;
          case 'arrayContains':
            constraints.push(where(field, 'array-contains', value));
            break;
        }
      }
    }
  }

  return constraints;
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/contacts/count');
    if (rateLimitResponse) return rateLimitResponse;

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body = await request.json();
    const { organizationId, workspaceId = 'default', filters = [] } = body;

    if (!organizationId) {
      return errors.badRequest('Missing organizationId');
    }

    // Build Firestore query constraints from filters
    const constraints = buildQueryConstraints(filters);

    // Query contacts collection
    const collectionPath = `organizations/${organizationId}/workspaces/${workspaceId}/entities/contacts/records`;
    
    let count = 0;
    
    if (constraints.length === 0) {
      // No filters - count all contacts
      const allContacts = await FirestoreService.getAll(collectionPath, []);
      count = allContacts.length;
    } else {
      // With filters - query and count
      const filteredContacts = await FirestoreService.getAll(collectionPath, constraints);
      count = filteredContacts.length;
    }

    logger.info('Counted contacts with filters', {
      route: '/api/contacts/count',
      organizationId,
      workspaceId,
      filterCount: filters.length,
      count,
    });

    return NextResponse.json({
      success: true,
      count,
      organizationId,
      workspaceId,
    });

  } catch (error: any) {
    logger.error('Error counting contacts', error, {
      route: '/api/contacts/count',
    });

    return errors.internal('Failed to count contacts', error.message);
  }
}
