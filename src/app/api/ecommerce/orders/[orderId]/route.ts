import { type NextRequest, NextResponse } from 'next/server';
import { requireOrganization } from '@/lib/auth/api-auth';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import type { Order } from '@/types/ecommerce';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

/**
 * GET /api/ecommerce/orders/[orderId] - Get order
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
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

    if (!workspaceId) {
      return errors.badRequest('workspaceId required');
    }

    const order = await FirestoreService.get<Order>(
      `${COLLECTIONS.ORGANIZATIONS}/*/workspaces/${workspaceId}/orders`,
      params.orderId
    );

    if (!order) {
      return errors.notFound('Order not found');
    }

    // Verify user has access (customer email or organization member)
    const user = authResult.user;
    if (order.customerEmail !== user?.email && user?.organizationId !== workspaceId.split('/')[0]) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      order,
    });
  } catch (error: unknown) {
    logger.error('Error fetching order', error, { route: '/api/ecommerce/orders' });
    return errors.database('Failed to fetch order', error instanceof Error ? error : undefined);
  }
}
