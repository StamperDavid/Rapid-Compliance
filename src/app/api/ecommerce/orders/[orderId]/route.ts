import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrganization } from '@/lib/auth/api-auth';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import type { Order } from '@/types/ecommerce';

/**
 * GET /api/ecommerce/orders/[orderId] - Get order
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const authResult = await requireOrganization(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');

    if (!workspaceId) {
      return NextResponse.json(
        { success: false, error: 'workspaceId required' },
        { status: 400 }
      );
    }

    const order = await FirestoreService.get<Order>(
      `${COLLECTIONS.ORGANIZATIONS}/*/workspaces/${workspaceId}/orders`,
      params.orderId
    );

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
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
  } catch (error: any) {
    console.error('Error getting order:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get order' },
      { status: 500 }
    );
  }
}













