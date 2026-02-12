import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { FirestoreService } from '@/lib/db/firestore-service';
import type { Order, OrderStatus, FulfillmentStatus } from '@/types/ecommerce';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

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

    const { getSubCollection } = await import('@/lib/firebase/collections');
    const order = await FirestoreService.get<Order>(
      `${getSubCollection('workspaces')}/default/entities/orders/records`,
      orderId
    );

    if (!order) {
      return errors.notFound('Order not found');
    }

    // Verify user has access (admin or order owner)
    const user = authResult.user;
    const isAdmin = user.role === 'owner' || user.role === 'admin';
    if (!isAdmin && order.customerEmail !== user?.email) {
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

const updateOrderSchema = z.object({
  status: z.enum(['pending', 'processing', 'on_hold', 'completed', 'cancelled', 'refunded'] as const).optional(),
  fulfillmentStatus: z.enum(['unfulfilled', 'partially_fulfilled', 'fulfilled', 'on_hold', 'cancelled'] as const).optional(),
  internalNotes: z.string().optional(),
});

/**
 * PUT /api/ecommerce/orders/[orderId] - Update order status
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Only admins can update orders
    const isAdmin = authResult.user.role === 'owner' || authResult.user.role === 'admin';
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    const body: unknown = await request.json();
    const validation = updateOrderSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.errors[0]?.message ?? 'Invalid input' },
        { status: 400 }
      );
    }

    const { getSubCollection } = await import('@/lib/firebase/collections');
    const ordersPath = `${getSubCollection('workspaces')}/default/entities/orders/records`;

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (validation.data.status) {
      updates.status = validation.data.status as OrderStatus;
      if (validation.data.status === 'completed') {
        updates.completedAt = new Date();
      }
      if (validation.data.status === 'cancelled') {
        updates.cancelledAt = new Date();
      }
    }
    if (validation.data.fulfillmentStatus) {
      updates.fulfillmentStatus = validation.data.fulfillmentStatus as FulfillmentStatus;
    }
    if (validation.data.internalNotes !== undefined) {
      updates.internalNotes = validation.data.internalNotes;
    }

    await FirestoreService.update(ordersPath, orderId, updates);

    logger.info('Order updated', { orderId, fields: Object.keys(validation.data) });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error('Error updating order', error instanceof Error ? error : new Error(String(error)));
    return errors.database('Failed to update order', error instanceof Error ? error : new Error(String(error)));
  }
}
