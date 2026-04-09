/**
 * CRM Payment Service
 * Business logic layer for payment record management
 * Revenue flow: Deal -> Quote -> Invoice -> Payment
 */

import { FirestoreService } from '@/lib/db/firestore-service';
import { where, orderBy, type QueryConstraint, type QueryDocumentSnapshot } from 'firebase/firestore';
import { logger } from '@/lib/logger/logger';
import { getSubCollection } from '@/lib/firebase/collections';
import type { CrmPayment, CrmPaymentFilters, CreatePaymentInput, UpdatePaymentInput } from '@/types/payment';
import { recordInvoicePayment } from './invoice-service';

interface PaginationOptions {
  pageSize?: number;
  lastDoc?: QueryDocumentSnapshot;
}

interface PaginatedResult<T> {
  data: T[];
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
}

/**
 * Generate a sequential payment number
 */
async function generatePaymentNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const existing = await FirestoreService.getAll(
    getSubCollection('payments'),
    [orderBy('createdAt', 'desc')]
  );
  const seq = existing.length + 1;
  return `PAY-${year}-${String(seq).padStart(4, '0')}`;
}

/**
 * Get payments with pagination and filtering
 */
export async function getPayments(
  filters?: CrmPaymentFilters,
  options?: PaginationOptions
): Promise<PaginatedResult<CrmPayment>> {
  try {
    const constraints: QueryConstraint[] = [];

    if (filters?.status && filters.status !== 'all') {
      constraints.push(where('status', '==', filters.status));
    }

    if (filters?.invoiceId) {
      constraints.push(where('invoiceId', '==', filters.invoiceId));
    }

    if (filters?.dealId) {
      constraints.push(where('dealId', '==', filters.dealId));
    }

    if (filters?.contactId) {
      constraints.push(where('contactId', '==', filters.contactId));
    }

    if (filters?.companyId) {
      constraints.push(where('companyId', '==', filters.companyId));
    }

    if (filters?.method) {
      constraints.push(where('method', '==', filters.method));
    }

    constraints.push(orderBy('createdAt', 'desc'));

    const result = await FirestoreService.getAllPaginated<CrmPayment>(
      getSubCollection('payments'),
      constraints,
      options?.pageSize ?? 50,
      options?.lastDoc
    );

    logger.info('Payments retrieved', { count: result.data.length });
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('Failed to get payments', error instanceof Error ? error : undefined);
    throw new Error(`Failed to retrieve payments: ${errorMessage}`);
  }
}

/**
 * Get a single payment
 */
export async function getPayment(paymentId: string): Promise<CrmPayment | null> {
  try {
    const payment = await FirestoreService.get<CrmPayment>(
      getSubCollection('payments'),
      paymentId
    );

    if (!payment) {
      logger.warn('Payment not found', { paymentId });
      return null;
    }

    return payment;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('Failed to get payment', error instanceof Error ? error : undefined, { paymentId });
    throw new Error(`Failed to retrieve payment: ${errorMessage}`);
  }
}

/**
 * Create a new payment
 * If linked to an invoice, also updates the invoice's amountPaid/status
 */
export async function createPayment(data: CreatePaymentInput): Promise<CrmPayment> {
  try {
    const paymentId = `payment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const paymentNumber = await generatePaymentNumber();
    const now = new Date();

    const payment: CrmPayment = {
      ...data,
      id: paymentId,
      paymentNumber,
      status: data.status ?? 'completed',
      currency: data.currency ?? 'USD',
      paymentDate: data.paymentDate ?? now,
      createdAt: now,
      updatedAt: now,
    };

    await FirestoreService.set(
      getSubCollection('payments'),
      paymentId,
      payment,
      false
    );

    // If linked to an invoice, update invoice payment totals
    if (data.invoiceId && payment.status === 'completed') {
      await recordInvoicePayment(data.invoiceId, payment.amount);
    }

    logger.info('Payment created', { paymentId, paymentNumber, amount: payment.amount });
    return payment;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('Failed to create payment', error instanceof Error ? error : undefined);
    throw new Error(`Failed to create payment: ${errorMessage}`);
  }
}

/**
 * Update a payment
 */
export async function updatePayment(
  paymentId: string,
  updates: UpdatePaymentInput
): Promise<CrmPayment> {
  try {
    await FirestoreService.update(
      getSubCollection('payments'),
      paymentId,
      { ...updates, updatedAt: new Date() }
    );

    logger.info('Payment updated', { paymentId, updatedFields: Object.keys(updates) });

    const payment = await getPayment(paymentId);
    if (!payment) {
      throw new Error('Payment not found after update');
    }
    return payment;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('Failed to update payment', error instanceof Error ? error : undefined, { paymentId });
    throw new Error(`Failed to update payment: ${errorMessage}`);
  }
}

/**
 * Delete a payment
 */
export async function deletePayment(paymentId: string): Promise<void> {
  try {
    await FirestoreService.delete(getSubCollection('payments'), paymentId);
    logger.info('Payment deleted', { paymentId });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('Failed to delete payment', error instanceof Error ? error : undefined, { paymentId });
    throw new Error(`Failed to delete payment: ${errorMessage}`);
  }
}
