/**
 * Count Contacts API
 * Returns count of contacts matching filter criteria
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { getContactsCollection } from '@/lib/firebase/collections';
import type { ViewFilter } from '@/types/filters';

export const dynamic = 'force-dynamic';

const CountContactsSchema = z.object({
  filters: z.array(z.unknown()).optional(),
});

/**
 * Apply ViewFilter conditions to an admin Firestore query.
 * Returns the augmented query with all where-clauses chained.
 */
function applyFiltersToQuery(
  query: FirebaseFirestore.Query,
  filters: ViewFilter[]
): FirebaseFirestore.Query {
  let q = query;

  for (const filter of filters) {
    for (const group of filter.groups) {
      for (const condition of group.conditions) {
        const { field, operator, value } = condition;

        if (!value && value !== 0 && value !== false) {continue;}

        switch (operator) {
          case 'equals':
          case 'is': {
            q = q.where(field, '==', value);
            break;
          }
          case 'not_equals':
          case 'is_not': {
            q = q.where(field, '!=', value);
            break;
          }
          case 'contains':
          case 'starts_with': {
            // Firestore doesn't support contains, but we can use >= and <= for prefix match
            if (typeof value === 'string') {
              q = q.where(field, '>=', value);
              q = q.where(field, '<=', `${value}\uf8ff`);
            }
            break;
          }
          case 'greater_than':
          case 'is_after': {
            q = q.where(field, '>', value);
            break;
          }
          case 'less_than':
          case 'is_before': {
            q = q.where(field, '<', value);
            break;
          }
          case 'greater_than_or_equal':
          case 'is_on_or_after': {
            q = q.where(field, '>=', value);
            break;
          }
          case 'less_than_or_equal':
          case 'is_on_or_before': {
            q = q.where(field, '<=', value);
            break;
          }
          case 'is_on': {
            // For date "is on" queries, we need to match the full day
            q = q.where(field, '==', value);
            break;
          }
          case 'has_any_of': {
            if (Array.isArray(value)) {
              q = q.where(field, 'in', value);
            }
            break;
          }
          case 'has_none_of': {
            if (Array.isArray(value)) {
              q = q.where(field, 'not-in', value);
            }
            break;
          }
          case 'is_exactly': {
            q = q.where(field, 'array-contains', value);
            break;
          }
          case 'is_checked': {
            q = q.where(field, '==', true);
            break;
          }
          case 'is_not_checked': {
            q = q.where(field, '==', false);
            break;
          }
          case 'is_empty': {
            q = q.where(field, '==', null);
            break;
          }
          case 'is_not_empty': {
            q = q.where(field, '!=', null);
            break;
          }
        }
      }
    }
  }

  return q;
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
    const parsed = CountContactsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const filters = (parsed.data.filters ?? []) as ViewFilter[];

    // Query contacts collection using native admin SDK
    const collectionPath = getContactsCollection();
    const QUERY_LIMIT = 10000;

    // Build and execute the native admin query
    const baseQuery = AdminFirestoreService.collection(collectionPath);
    const filteredQuery = filters.length > 0
      ? applyFiltersToQuery(baseQuery, filters)
      : baseQuery;
    const snapshot = await filteredQuery.limit(QUERY_LIMIT).get();
    const count = snapshot.size;

    if (count === QUERY_LIMIT) {
      logger.warn('Contact count hit query limit', {
        limit: QUERY_LIMIT,
        filterCount: filters.length,
      });
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
