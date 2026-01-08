import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { requireOrganization } from '@/lib/auth/api-auth';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { where, orderBy } from 'firebase/firestore';
import type { Order } from '@/types/ecommerce';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

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

    const authResult = await requireOrganization(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const customerEmail = searchParams.get('customerEmail');
    const status = searchParams.get('status');
    const pageSize = parseInt((searchParams.get('limit') !== '' && searchParams.get('limit') != null) ? searchParams.get('limit') : '50');

    if (!workspaceId) {
      return errors.badRequest('workspaceId required');
    }

    const constraints: any[] = [orderBy('createdAt', 'desc')];

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
      workspaceId,
      pageSize,
      filters: { customerEmail, status },
    });

    // Use paginated query
    const result = await FirestoreService.getAllPaginated<Order>(
      `${COLLECTIONS.ORGANIZATIONS}/*/workspaces/${workspaceId}/orders`,
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
  } catch (error: any) {
    logger.error('Error listing orders', error, {
      route: '/api/ecommerce/orders',
    });
    return errors.database('Failed to list orders', error);
  }
}



















