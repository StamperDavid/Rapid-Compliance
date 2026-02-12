import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { FirestoreService } from '@/lib/db/firestore-service';
import { where, orderBy } from 'firebase/firestore';
import type { Order } from '@/types/ecommerce';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

export const dynamic = 'force-dynamic';

type QueryConstraint = ReturnType<typeof where> | ReturnType<typeof orderBy>;

/**
 * GET /api/ecommerce/orders - List orders with pagination
 * Query params:
 * - workspaceId: required
 * - customerEmail: optional filter
 * - status: optional filter
 * - limit: page size (default 50, max 100)
 * - cursor: pagination cursor (optional)
 */
export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/ecommerce/orders');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const customerEmail = searchParams.get('customerEmail');
    const status = searchParams.get('status');
    const pageSize = parseInt(searchParams.get('limit') ?? '50');

    const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];

    // Filter by authenticated user's orders only (non-admin users)
    const isAdmin = authResult.user.role === 'owner' || authResult.user.role === 'admin';
    if (!isAdmin) {
      constraints.push(where('userId', '==', authResult.user.uid));
    }

    // Filter by customer email if provided
    if (customerEmail) {
      constraints.push(where('customerEmail', '==', customerEmail));
    }

    // Filter by status if provided
    if (status) {
      constraints.push(where('status', '==', status));
    }

    logger.info('Fetching orders', {
      route: '/api/ecommerce/orders',
      pageSize,
      filters: JSON.stringify({ customerEmail, status }),
    });

    // Use paginated query - path matches seed data structure
    const { getSubCollection } = await import('@/lib/firebase/collections');
    const result = await FirestoreService.getAllPaginated<Order>(
      `${getSubCollection('workspaces')}/default/entities/orders/records`,
      constraints,
      Math.min(pageSize, 100) // Max 100 per page
    );

    logger.info('Orders fetched successfully', {
      route: '/api/ecommerce/orders',
      count: result.data.length,
      hasMore: result.hasMore,
    });

    return NextResponse.json({
      success: true,
      orders: result.data,
      pagination: {
        hasMore: result.hasMore,
        pageSize: result.data.length,
      },
    });
  } catch (error: unknown) {
    logger.error('Error listing orders', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/ecommerce/orders',
    });
    return errors.database('Failed to list orders', error instanceof Error ? error : new Error(String(error)));
  }
}
