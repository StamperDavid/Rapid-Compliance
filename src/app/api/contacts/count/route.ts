/**
 * Count Contacts API
 * Returns count of contacts matching filter criteria
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { where, limit, type QueryConstraint } from 'firebase/firestore';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { getContactsCollection } from '@/lib/firebase/collections';
import type { ViewFilter } from '@/types/filters';

export const dynamic = 'force-dynamic';

/** Request body interface for counting contacts */
interface CountContactsRequestBody {
  filters?: ViewFilter[];
}

/** Type guard for validating request body */
function isValidRequestBody(body: unknown): body is CountContactsRequestBody {
  if (typeof body !== 'object' || body === null) {
    return false;
  }
  return true;
}

/**
 * Convert ViewFilter to Firestore query constraints
 */
function buildQueryConstraints(filters: ViewFilter[]): QueryConstraint[] {
  const constraints: QueryConstraint[] = [];

  for (const filter of filters) {
    for (const group of filter.groups) {
      for (const condition of group.conditions) {
        const { field, operator, value } = condition;

        if (!value && value !== 0 && value !== false) {continue;}

        switch (operator) {
          case 'equals':
          case 'is': {
            constraints.push(where(field, '==', value));
            break;
          }
          case 'not_equals':
          case 'is_not': {
            constraints.push(where(field, '!=', value));
            break;
          }
          case 'contains':
          case 'starts_with': {
            // Firestore doesn't support contains, but we can use >= and <= for prefix match
            if (typeof value === 'string') {
              constraints.push(where(field, '>=', value));
              constraints.push(where(field, '<=', `${value  }\uf8ff`));
            }
            break;
          }
          case 'greater_than':
          case 'is_after': {
            constraints.push(where(field, '>', value));
            break;
          }
          case 'less_than':
          case 'is_before': {
            constraints.push(where(field, '<', value));
            break;
          }
          case 'greater_than_or_equal':
          case 'is_on_or_after': {
            constraints.push(where(field, '>=', value));
            break;
          }
          case 'less_than_or_equal':
          case 'is_on_or_before': {
            constraints.push(where(field, '<=', value));
            break;
          }
          case 'is_on': {
            // For date "is on" queries, we need to match the full day
            constraints.push(where(field, '==', value));
            break;
          }
          case 'has_any_of': {
            if (Array.isArray(value)) {
              constraints.push(where(field, 'in', value));
            }
            break;
          }
          case 'has_none_of': {
            if (Array.isArray(value)) {
              constraints.push(where(field, 'not-in', value));
            }
            break;
          }
          case 'is_exactly': {
            constraints.push(where(field, 'array-contains', value));
            break;
          }
          case 'is_checked': {
            constraints.push(where(field, '==', true));
            break;
          }
          case 'is_not_checked': {
            constraints.push(where(field, '==', false));
            break;
          }
          case 'is_empty': {
            constraints.push(where(field, '==', null));
            break;
          }
          case 'is_not_empty': {
            constraints.push(where(field, '!=', null));
            break;
          }
        }
      }
    }
  }

  return constraints;
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/contacts/count');
    if (rateLimitResponse) {return rateLimitResponse;}

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();

    if (!isValidRequestBody(body)) {
      return errors.badRequest('Invalid request body');
    }

    const { filters = [] } = body;

    // Build Firestore query constraints from filters
    const constraints = buildQueryConstraints(filters);

    // Query contacts collection
    const collectionPath = getContactsCollection();

    let count = 0;
    const QUERY_LIMIT = 10000;

    if (constraints.length === 0) {
      // No filters - count all contacts (with safety limit)
      const allContacts = await AdminFirestoreService.getAll(collectionPath, [limit(QUERY_LIMIT)]);
      count = allContacts.length;
      if (count === QUERY_LIMIT) {
        logger.warn('Contact count hit query limit', { limit: QUERY_LIMIT });
      }
    } else {
      // With filters - query and count (with safety limit)
      const filteredContacts = await AdminFirestoreService.getAll(collectionPath, [...constraints, limit(QUERY_LIMIT)]);
      count = filteredContacts.length;
      if (count === QUERY_LIMIT) {
        logger.warn('Contact count hit query limit with filters', { limit: QUERY_LIMIT, filterCount: filters.length });
      }
    }

    logger.info('Counted contacts with filters', {
      route: '/api/contacts/count',
      filterCount: filters.length,
      count,
    });

    return NextResponse.json({
      success: true,
      count,
    });

  } catch (error) {
    logger.error('Error counting contacts', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/contacts/count',
    });

    return errors.internal('Failed to count contacts', error instanceof Error ? error : undefined);
  }
}
