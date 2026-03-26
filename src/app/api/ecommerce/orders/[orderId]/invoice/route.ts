/**
 * Invoice API — Generate or retrieve invoice for an order
 *
 * GET /api/ecommerce/orders/[orderId]/invoice
 *   - Returns existing invoice URL if already generated
 *   - Generates a new invoice PDF if none exists
 *   - Stores invoiceUrl back on the order document
 *
 * Authentication: Required
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { getSubCollection } from '@/lib/firebase/collections';
import { generateInvoice } from '@/lib/ecommerce/invoice-generator';
import type { Order } from '@/types/ecommerce';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const { orderId } = await params;

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: 'orderId is required' },
        { status: 400 }
      );
    }

    const { AdminFirestoreService } = await import('@/lib/db/admin-firestore-service');
    const ordersCol = getSubCollection('orders');

    const orderDoc = await AdminFirestoreService.get(ordersCol, orderId);
    if (!orderDoc) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    const order = { ...orderDoc, id: orderId } as Order;

    // Return existing invoice if already generated
    if (order.invoiceUrl) {
      return NextResponse.json({
        success: true,
        invoiceUrl: order.invoiceUrl,
        invoiceNumber: order.invoiceNumber,
        cached: true,
      });
    }

    // Generate new invoice
    const result = await generateInvoice(order);

    if (!result.success || !result.invoiceUrl) {
      return NextResponse.json(
        { success: false, error: result.error ?? 'Invoice generation failed' },
        { status: 500 }
      );
    }

    // Store invoice URL on the order document for future retrieval
    await AdminFirestoreService.update(ordersCol, orderId, {
      invoiceUrl: result.invoiceUrl,
      invoiceNumber: result.invoiceNumber,
      invoiceGeneratedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      invoiceUrl: result.invoiceUrl,
      invoiceNumber: result.invoiceNumber,
      cached: false,
    });
  } catch (error: unknown) {
    logger.error(
      'Invoice generation failed',
      error instanceof Error ? error : undefined,
      { route: '/api/ecommerce/orders/[orderId]/invoice' }
    );
    return NextResponse.json(
      { success: false, error: 'Failed to generate invoice' },
      { status: 500 }
    );
  }
}
