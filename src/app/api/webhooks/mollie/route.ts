/**
 * Mollie Webhook Handler
 * Processes payment status updates from Mollie
 *
 * Mollie sends a POST with { id: "tr_xxx" } when payment status changes.
 * We fetch the payment details from Mollie API and update the order.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getOrdersCollection } from '@/lib/firebase/collections';
import { where } from 'firebase/firestore';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const ORDERS_PATH = getOrdersCollection();

const mollieWebhookSchema = z.object({
  id: z.string().min(1, 'Payment ID is required'),
});

interface MolliePayment {
  id: string;
  status: string;
  amount?: { value: string; currency: string };
  metadata?: { order_id?: string; customer_email?: string };
}

export async function POST(request: NextRequest) {
  try {
    // Mollie sends form-encoded data
    const formData = await request.formData();
    const paymentId = formData.get('id');

    const parseResult = mollieWebhookSchema.safeParse({ id: paymentId });
    if (!parseResult.success) {
      return errors.badRequest('Invalid Mollie webhook payload');
    }

    const { id } = parseResult.data;

    // Fetch payment details from Mollie API
    const mollieKeys = await apiKeyService.getServiceKey(PLATFORM_ID, 'mollie') as { apiKey?: string } | null;
    if (!mollieKeys?.apiKey) {
      logger.error('Mollie webhook received but API key not configured', undefined, {
        route: '/api/webhooks/mollie',
        paymentId: id,
      });
      // Return 200 so Mollie doesn't retry — config issue, not transient
      return NextResponse.json({ received: true });
    }

    const paymentResponse = await fetch(`https://api.mollie.com/v2/payments/${id}`, {
      headers: {
        'Authorization': `Bearer ${mollieKeys.apiKey}`,
      },
    });

    if (!paymentResponse.ok) {
      logger.error('Failed to fetch Mollie payment details', undefined, {
        route: '/api/webhooks/mollie',
        paymentId: id,
        status: paymentResponse.status,
      });
      // Return 500 so Mollie retries
      return NextResponse.json({ error: 'Failed to fetch payment' }, { status: 500 });
    }

    const payment = (await paymentResponse.json()) as MolliePayment;

    // Find the order by transaction ID
    const orders = await AdminFirestoreService.getAll(
      ORDERS_PATH,
      [where('payment.transactionId', '==', id)]
    );

    if (orders.length === 0) {
      logger.warn('Mollie webhook: no matching order found', {
        route: '/api/webhooks/mollie',
        paymentId: id,
      });
      return NextResponse.json({ received: true });
    }

    const order = orders[0] as Record<string, unknown>;
    const orderId = order.id as string;

    // Map Mollie status to order status
    let orderStatus: string;
    let paymentStatus: string;
    switch (payment.status) {
      case 'paid':
        orderStatus = 'processing';
        paymentStatus = 'captured';
        break;
      case 'failed':
      case 'expired':
      case 'canceled':
        orderStatus = 'cancelled';
        paymentStatus = payment.status;
        break;
      case 'pending':
      case 'open':
        orderStatus = 'pending';
        paymentStatus = 'pending';
        break;
      default:
        orderStatus = 'pending';
        paymentStatus = payment.status;
    }

    await AdminFirestoreService.update(ORDERS_PATH, orderId, {
      status: orderStatus,
      paymentStatus,
      'payment.mollieStatus': payment.status,
      updatedAt: new Date().toISOString(),
    });

    logger.info('Mollie webhook processed', {
      route: '/api/webhooks/mollie',
      paymentId: id,
      mollieStatus: payment.status,
      orderStatus,
      orderId,
    });

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    logger.error('Mollie webhook error', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/webhooks/mollie',
    });
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
