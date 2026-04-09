/**
 * CRM Invoice Service
 * Business logic layer for invoice management
 * Revenue flow: Deal -> Quote -> Invoice -> Payment
 */

import { FirestoreService } from '@/lib/db/firestore-service';
import { where, orderBy, type QueryConstraint, type QueryDocumentSnapshot } from 'firebase/firestore';
import { logger } from '@/lib/logger/logger';
import { getSubCollection } from '@/lib/firebase/collections';
import type { Invoice, InvoiceFilters, CreateInvoiceInput, UpdateInvoiceInput } from '@/types/invoice';
import type { QuoteLineItem, QuoteLineItemInput } from '@/types/quote';

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
 * Convert line item inputs to full line items with IDs and subtotals
 */
function processLineItemInputs(items: QuoteLineItemInput[]): QuoteLineItem[] {
  return items.map((item, idx) => {
    const discountMultiplier = 1 - (item.discount ?? 0) / 100;
    return {
      ...item,
      id: item.id ?? `li-${idx + 1}-${Math.random().toString(36).substr(2, 6)}`,
      subtotal: item.quantity * item.unitPrice * discountMultiplier,
    };
  });
}

/**
 * Generate a sequential invoice number
 */
async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const existing = await FirestoreService.getAll(
    getSubCollection('invoices'),
    [orderBy('createdAt', 'desc')]
  );
  const seq = existing.length + 1;
  return `INV-${year}-${String(seq).padStart(4, '0')}`;
}

/**
 * Calculate invoice totals from line items
 */
function calculateInvoiceTotals(lineItems: QuoteLineItem[]): {
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
} {
  let subtotal = 0;
  let taxAmount = 0;
  let discountAmount = 0;

  for (const item of lineItems) {
    const grossAmount = item.quantity * item.unitPrice;
    const itemDiscount = grossAmount * ((item.discount ?? 0) / 100);
    const itemSubtotal = grossAmount - itemDiscount;
    const itemTax = itemSubtotal * ((item.tax ?? 0) / 100);

    subtotal += itemSubtotal;
    taxAmount += itemTax;
    discountAmount += itemDiscount;
  }

  return {
    subtotal,
    taxAmount,
    discountAmount,
    total: subtotal + taxAmount,
  };
}

/**
 * Get invoices with pagination and filtering
 */
export async function getInvoices(
  filters?: InvoiceFilters,
  options?: PaginationOptions
): Promise<PaginatedResult<Invoice>> {
  try {
    const constraints: QueryConstraint[] = [];

    if (filters?.status && filters.status !== 'all') {
      constraints.push(where('status', '==', filters.status));
    }

    if (filters?.dealId) {
      constraints.push(where('dealId', '==', filters.dealId));
    }

    if (filters?.quoteId) {
      constraints.push(where('quoteId', '==', filters.quoteId));
    }

    if (filters?.contactId) {
      constraints.push(where('contactId', '==', filters.contactId));
    }

    if (filters?.companyId) {
      constraints.push(where('companyId', '==', filters.companyId));
    }

    if (filters?.ownerId) {
      constraints.push(where('ownerId', '==', filters.ownerId));
    }

    constraints.push(orderBy('createdAt', 'desc'));

    const result = await FirestoreService.getAllPaginated<Invoice>(
      getSubCollection('invoices'),
      constraints,
      options?.pageSize ?? 50,
      options?.lastDoc
    );

    logger.info('Invoices retrieved', { count: result.data.length });
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('Failed to get invoices', error instanceof Error ? error : undefined);
    throw new Error(`Failed to retrieve invoices: ${errorMessage}`);
  }
}

/**
 * Get a single invoice
 */
export async function getInvoice(invoiceId: string): Promise<Invoice | null> {
  try {
    const invoice = await FirestoreService.get<Invoice>(
      getSubCollection('invoices'),
      invoiceId
    );

    if (!invoice) {
      logger.warn('Invoice not found', { invoiceId });
      return null;
    }

    return invoice;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('Failed to get invoice', error instanceof Error ? error : undefined, { invoiceId });
    throw new Error(`Failed to retrieve invoice: ${errorMessage}`);
  }
}

/**
 * Create a new invoice
 */
export async function createInvoice(data: CreateInvoiceInput): Promise<Invoice> {
  try {
    const invoiceId = `invoice-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const invoiceNumber = await generateInvoiceNumber();
    const now = new Date();

    const lineItems: QuoteLineItem[] = processLineItemInputs(data.lineItems);

    const totals = calculateInvoiceTotals(lineItems);

    const invoice: Invoice = {
      ...data,
      id: invoiceId,
      invoiceNumber,
      status: data.status ?? 'draft',
      lineItems,
      ...totals,
      amountPaid: data.amountPaid ?? 0,
      amountDue: totals.total - (data.amountPaid ?? 0),
      currency: data.currency ?? 'USD',
      issueDate: data.issueDate ?? now,
      createdAt: now,
      updatedAt: now,
    };

    await FirestoreService.set(
      getSubCollection('invoices'),
      invoiceId,
      invoice,
      false
    );

    logger.info('Invoice created', { invoiceId, invoiceNumber, total: invoice.total });
    return invoice;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('Failed to create invoice', error instanceof Error ? error : undefined);
    throw new Error(`Failed to create invoice: ${errorMessage}`);
  }
}

/**
 * Update an invoice
 */
export async function updateInvoice(
  invoiceId: string,
  updates: UpdateInvoiceInput
): Promise<Invoice> {
  try {
    let processedUpdates = { ...updates };

    // Recalculate totals if line items changed
    if (updates.lineItems) {
      const lineItems = processLineItemInputs(updates.lineItems);
      const totals = calculateInvoiceTotals(lineItems);
      const amountPaid = updates.amountPaid ?? 0;
      processedUpdates = {
        ...processedUpdates,
        lineItems,
        ...totals,
        amountDue: totals.total - amountPaid,
      };
    }

    await FirestoreService.update(
      getSubCollection('invoices'),
      invoiceId,
      { ...processedUpdates, updatedAt: new Date() }
    );

    logger.info('Invoice updated', { invoiceId, updatedFields: Object.keys(updates) });

    const invoice = await getInvoice(invoiceId);
    if (!invoice) {
      throw new Error('Invoice not found after update');
    }
    return invoice;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('Failed to update invoice', error instanceof Error ? error : undefined, { invoiceId });
    throw new Error(`Failed to update invoice: ${errorMessage}`);
  }
}

/**
 * Delete an invoice
 */
export async function deleteInvoice(invoiceId: string): Promise<void> {
  try {
    // Check for linked payments
    const linkedPayments = await FirestoreService.getAll(
      getSubCollection('payments'),
      [where('invoiceId', '==', invoiceId)]
    );
    if (linkedPayments.length > 0) {
      throw new Error(
        `Cannot delete invoice: ${linkedPayments.length} payment(s) are linked. Remove them first.`
      );
    }

    await FirestoreService.delete(getSubCollection('invoices'), invoiceId);
    logger.info('Invoice deleted', { invoiceId });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('Failed to delete invoice', error instanceof Error ? error : undefined, { invoiceId });
    throw new Error(`Failed to delete invoice: ${errorMessage}`);
  }
}

/**
 * Record a payment against an invoice and update its status
 */
export async function recordInvoicePayment(
  invoiceId: string,
  paymentAmount: number
): Promise<Invoice> {
  try {
    const invoice = await getInvoice(invoiceId);
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const newAmountPaid = (invoice.amountPaid ?? 0) + paymentAmount;
    const newAmountDue = invoice.total - newAmountPaid;

    let newStatus: string = invoice.status;
    if (newAmountDue <= 0) {
      newStatus = 'paid';
    } else if (newAmountPaid > 0) {
      newStatus = 'partially_paid';
    }

    return await updateInvoice(invoiceId, {
      amountPaid: newAmountPaid,
      amountDue: Math.max(0, newAmountDue),
      status: newStatus as Invoice['status'],
      paidAt: newStatus === 'paid' ? new Date() : undefined,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('Failed to record invoice payment', error instanceof Error ? error : undefined, { invoiceId });
    throw new Error(`Failed to record payment: ${errorMessage}`);
  }
}
