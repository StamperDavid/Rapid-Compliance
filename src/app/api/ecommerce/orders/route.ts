import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrganization } from '@/lib/auth/api-auth';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { where, orderBy, limit } from 'firebase/firestore';
import type { Order } from '@/types/ecommerce';

/**
 * GET /api/ecommerce/orders - List orders
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireOrganization(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');
    const customerEmail = searchParams.get('customerEmail');
    const status = searchParams.get('status');
    const limitParam = parseInt(searchParams.get('limit') || '50');

    if (!workspaceId) {
      return NextResponse.json(
        { success: false, error: 'workspaceId required' },
        { status: 400 }
      );
    }

    const constraints: any[] = [orderBy('createdAt', 'desc'), limit(limitParam)];

    // Filter by customer email if provided
    if (customerEmail) {
      constraints.push(where('customerEmail', '==', customerEmail));
    }

    // Filter by status if provided
    if (status) {
      constraints.push(where('status', '==', status));
    }

    const orders = await FirestoreService.getAll<Order>(
      `${COLLECTIONS.ORGANIZATIONS}/*/workspaces/${workspaceId}/orders`,
      constraints
    );

    return NextResponse.json({
      success: true,
      orders,
      count: orders.length,
    });
  } catch (error: any) {
    console.error('Error listing orders:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to list orders' },
      { status: 500 }
    );
  }
}














