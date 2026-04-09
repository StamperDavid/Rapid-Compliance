/**
 * CRM Invoice Entity - Canonical TypeScript Interface
 *
 * Revenue flow: Deal -> Quote -> Invoice -> Payment
 * Separate from ecommerce invoices (which are for online store orders).
 *
 * @module types/invoice
 */

import type { FirestoreDate, CustomFields } from './crm-entities';
import type { QuoteLineItem, QuoteLineItemInput } from './quote';

// ============================================================================
// INVOICE TYPES
// ============================================================================

/**
 * Invoice status lifecycle
 */
export type InvoiceStatus =
  | 'draft'
  | 'sent'
  | 'viewed'
  | 'partially_paid'
  | 'paid'
  | 'overdue'
  | 'cancelled'
  | 'refunded';

export const INVOICE_STATUSES: readonly InvoiceStatus[] = [
  'draft',
  'sent',
  'viewed',
  'partially_paid',
  'paid',
  'overdue',
  'cancelled',
  'refunded',
] as const;

/**
 * CRM Invoice entity
 * A formal payment request linked to deals and quotes
 */
export interface Invoice {
  // Core identifiers
  id: string;
  invoiceNumber: string; // e.g. "INV-2026-0001"

  // Relationships
  dealId?: string;
  quoteId?: string;
  contactId?: string;
  companyId?: string;
  companyName?: string;
  contactName?: string;
  contactEmail?: string;

  // Invoice details
  title: string;
  status: InvoiceStatus;
  lineItems: QuoteLineItem[]; // Reuses same line item structure

  // Financials
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  amountPaid: number;
  amountDue: number;
  currency: string;

  // Dates
  issueDate: FirestoreDate;
  dueDate?: FirestoreDate;
  paidAt?: FirestoreDate;

  // Terms
  paymentTerms?: string; // e.g. "Net 30"
  notes?: string;

  // Tracking
  sentAt?: FirestoreDate;
  viewedAt?: FirestoreDate;
  lastReminderAt?: FirestoreDate;
  reminderCount?: number;

  // Ownership
  ownerId?: string;
  ownerName?: string;

  // Additional data
  customFields?: CustomFields;

  // Timestamps
  createdAt: FirestoreDate;
  updatedAt?: FirestoreDate;
}

/**
 * Invoice filters for queries
 */
export interface InvoiceFilters {
  status?: InvoiceStatus | 'all';
  dealId?: string;
  quoteId?: string;
  contactId?: string;
  companyId?: string;
  ownerId?: string;
  overdue?: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export type CreateInvoiceInput = Omit<Invoice, 'id' | 'createdAt' | 'invoiceNumber'>;
export type UpdateInvoiceInput = Partial<Omit<Invoice, 'id' | 'createdAt' | 'invoiceNumber' | 'lineItems'>> & {
  lineItems?: QuoteLineItemInput[];
};
