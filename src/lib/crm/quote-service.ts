/**
 * Quote Service
 * Business logic layer for quote/proposal management
 * Revenue flow: Deal -> Quote -> Invoice -> Payment
 */

import { FirestoreService } from '@/lib/db/firestore-service';
import { where, orderBy, type QueryConstraint, type QueryDocumentSnapshot } from 'firebase/firestore';
import { logger } from '@/lib/logger/logger';
import { getSubCollection } from '@/lib/firebase/collections';
import type { Quote, QuoteFilters, QuoteLineItem, CreateQuoteInput, UpdateQuoteInput, QuoteLineItemInput } from '@/types/quote';

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
 * Generate a sequential quote number
 */
async function generateQuoteNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const existing = await FirestoreService.getAll<Quote>(
    getSubCollection('quotes'),
    [orderBy('createdAt', 'desc')]
  );
  const seq = existing.length + 1;
  return `Q-${year}-${String(seq).padStart(4, '0')}`;
}

/**
 * Convert line item inputs to full line items with IDs and subtotals
 */
function processLineItems(items: QuoteLineItemInput[]): QuoteLineItem[] {
  return items.map((item, idx) => ({
    ...item,
    id: item.id ?? `li-${idx + 1}-${Math.random().toString(36).substr(2, 6)}`,
    subtotal: calculateLineItemSubtotal(item),
  }));
}

/**
 * Calculate line item subtotal
 */
function calculateLineItemSubtotal(item: Omit<QuoteLineItemInput, 'id' | 'subtotal'>): number {
  const discountMultiplier = 1 - (item.discount ?? 0) / 100;
  return item.quantity * item.unitPrice * discountMultiplier;
}

/**
 * Calculate quote totals from line items
 */
function calculateQuoteTotals(lineItems: QuoteLineItem[]): {
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
 * Get quotes with pagination and filtering
 */
export async function getQuotes(
  filters?: QuoteFilters,
  options?: PaginationOptions
): Promise<PaginatedResult<Quote>> {
  try {
    const constraints: QueryConstraint[] = [];

    if (filters?.status && filters.status !== 'all') {
      constraints.push(where('status', '==', filters.status));
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

    if (filters?.ownerId) {
      constraints.push(where('ownerId', '==', filters.ownerId));
    }

    constraints.push(orderBy('createdAt', 'desc'));

    const result = await FirestoreService.getAllPaginated<Quote>(
      getSubCollection('quotes'),
      constraints,
      options?.pageSize ?? 50,
      options?.lastDoc
    );

    logger.info('Quotes retrieved', { count: result.data.length });
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('Failed to get quotes', error instanceof Error ? error : undefined);
    throw new Error(`Failed to retrieve quotes: ${errorMessage}`);
  }
}

/**
 * Get a single quote
 */
export async function getQuote(quoteId: string): Promise<Quote | null> {
  try {
    const quote = await FirestoreService.get<Quote>(
      getSubCollection('quotes'),
      quoteId
    );

    if (!quote) {
      logger.warn('Quote not found', { quoteId });
      return null;
    }

    return quote;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('Failed to get quote', error instanceof Error ? error : undefined, { quoteId });
    throw new Error(`Failed to retrieve quote: ${errorMessage}`);
  }
}

/**
 * Create a new quote
 */
export async function createQuote(data: CreateQuoteInput): Promise<Quote> {
  try {
    const quoteId = `quote-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const quoteNumber = await generateQuoteNumber();
    const now = new Date();

    const lineItems = processLineItems(data.lineItems);
    const totals = calculateQuoteTotals(lineItems);

    const quote: Quote = {
      ...data,
      id: quoteId,
      quoteNumber,
      status: data.status ?? 'draft',
      lineItems,
      ...totals,
      currency: data.currency ?? 'USD',
      createdAt: now,
      updatedAt: now,
    };

    await FirestoreService.set(
      getSubCollection('quotes'),
      quoteId,
      quote,
      false
    );

    logger.info('Quote created', { quoteId, quoteNumber, total: quote.total });
    return quote;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('Failed to create quote', error instanceof Error ? error : undefined);
    throw new Error(`Failed to create quote: ${errorMessage}`);
  }
}

/**
 * Update a quote
 */
export async function updateQuote(
  quoteId: string,
  updates: UpdateQuoteInput
): Promise<Quote> {
  try {
    // If line items changed, recalculate totals
    let processedUpdates: Record<string, unknown> = { ...updates };
    if (updates.lineItems) {
      const lineItems = processLineItems(updates.lineItems);
      const totals = calculateQuoteTotals(lineItems);
      processedUpdates = { ...processedUpdates, lineItems, ...totals };
    }

    await FirestoreService.update(
      getSubCollection('quotes'),
      quoteId,
      { ...processedUpdates, updatedAt: new Date() }
    );

    logger.info('Quote updated', { quoteId, updatedFields: Object.keys(updates) });

    const quote = await getQuote(quoteId);
    if (!quote) {
      throw new Error('Quote not found after update');
    }
    return quote;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('Failed to update quote', error instanceof Error ? error : undefined, { quoteId });
    throw new Error(`Failed to update quote: ${errorMessage}`);
  }
}

/**
 * Delete a quote
 */
export async function deleteQuote(quoteId: string): Promise<void> {
  try {
    // Check if converted to invoice
    const quote = await getQuote(quoteId);
    if (quote?.convertedToInvoiceId) {
      throw new Error('Cannot delete a quote that has been converted to an invoice.');
    }

    await FirestoreService.delete(getSubCollection('quotes'), quoteId);
    logger.info('Quote deleted', { quoteId });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('Failed to delete quote', error instanceof Error ? error : undefined, { quoteId });
    throw new Error(`Failed to delete quote: ${errorMessage}`);
  }
}

/**
 * Convert a quote to an invoice
 * Creates an invoice from the quote's line items and marks the quote as converted
 */
export async function convertQuoteToInvoice(quoteId: string): Promise<string> {
  try {
    const quote = await getQuote(quoteId);
    if (!quote) {
      throw new Error('Quote not found');
    }

    if (quote.status === 'converted') {
      throw new Error('Quote has already been converted to an invoice');
    }

    if (quote.status !== 'accepted') {
      throw new Error('Only accepted quotes can be converted to invoices');
    }

    // Create invoice from quote data
    const invoiceId = `invoice-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const year = new Date().getFullYear();
    const existingInvoices = await FirestoreService.getAll(
      getSubCollection('invoices'),
      [orderBy('createdAt', 'desc')]
    );
    const invoiceNumber = `INV-${year}-${String(existingInvoices.length + 1).padStart(4, '0')}`;
    const now = new Date();

    const invoice = {
      id: invoiceId,
      invoiceNumber,
      title: `Invoice for ${quote.title}`,
      status: 'draft',
      dealId: quote.dealId,
      quoteId: quote.id,
      contactId: quote.contactId,
      companyId: quote.companyId,
      companyName: quote.companyName,
      contactName: quote.contactName,
      contactEmail: quote.contactEmail,
      lineItems: quote.lineItems,
      subtotal: quote.subtotal,
      taxAmount: quote.taxAmount,
      discountAmount: quote.discountAmount,
      total: quote.total,
      amountPaid: 0,
      amountDue: quote.total,
      currency: quote.currency,
      issueDate: now,
      ownerId: quote.ownerId,
      ownerName: quote.ownerName,
      createdAt: now,
      updatedAt: now,
    };

    await FirestoreService.set(getSubCollection('invoices'), invoiceId, invoice, false);

    // Update quote status
    await updateQuote(quoteId, {
      status: 'converted',
      convertedToInvoiceId: invoiceId,
    });

    logger.info('Quote converted to invoice', { quoteId, invoiceId, invoiceNumber });
    return invoiceId;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logger.error('Failed to convert quote to invoice', error instanceof Error ? error : undefined, { quoteId });
    throw new Error(`Failed to convert quote: ${errorMessage}`);
  }
}
