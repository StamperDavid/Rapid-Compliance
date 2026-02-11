import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import type { Order } from '@/types/ecommerce';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { PLATFORM_ID } from '@/lib/constants/platform';

export const dynamic = 'force-dynamic';

/**
 * GET /api/ecommerce/orders/[orderId] - Get order
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;

    const rateLimitResponse = await rateLimitMiddleware(request, '/api/ecommerce/orders');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const order = await FirestoreService.get<Order>(
      `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/workspaces/default/orders`,
      orderId
    );

    if (!order) {
      return errors.notFound('Order not found');
    }

    // Verify user has access (customer email or organization member)
    const user = authResult.user;
    // In penthouse model, authenticated users belong to PLATFORM_ID
    if (order.customerEmail !== user?.email) {
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
    logger.error('Error fetching order', error instanceof Error ? error : new Error(String(error)), { route: '/api/ecommerce/orders' });
    return errors.database('Failed to fetch order', error instanceof Error ? error : new Error(String(error)));
  }
}
