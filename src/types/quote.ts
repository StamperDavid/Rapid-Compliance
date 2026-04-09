/**
 * Quote Entity - Canonical TypeScript Interface
 *
 * Revenue flow: Deal -> Quote -> Invoice -> Payment
 * Quotes contain line items referencing Products & Services.
 *
 * @module types/quote
 */

import type { FirestoreDate, CustomFields } from './crm-entities';

// ============================================================================
// QUOTE TYPES
// ============================================================================

/**
 * Quote status lifecycle
 */
export type QuoteStatus =
  | 'draft'
  | 'sent'
  | 'viewed'
  | 'accepted'
  | 'rejected'
  | 'expired'
  | 'converted';

export const QUOTE_STATUSES: readonly QuoteStatus[] = [
  'draft',
  'sent',
  'viewed',
  'accepted',
  'rejected',
  'expired',
  'converted',
] as const;

/**
 * A single line item on a quote
 */
export interface QuoteLineItem {
  id: string;
  productId?: string;
  productName: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  discount?: number; // percentage 0-100
  tax?: number; // percentage 0-100
  subtotal: number; // quantity * unitPrice * (1 - discount/100)
}

/**
 * Line item input before ID/subtotal are computed
 */
export interface QuoteLineItemInput {
  id?: string;
  productId?: string;
  productName: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  tax?: number;
  subtotal?: number;
}

/**
 * Quote entity
 * A formal price proposal sent to a prospect/contact
 */
export interface Quote {
  // Core identifiers
  id: string;
  quoteNumber: string; // e.g. "Q-2026-0001"

  // Relationships
  dealId?: string;
  contactId?: string;
  companyId?: string;
  companyName?: string;
  contactName?: string;
  contactEmail?: string;

  // Quote details
  title: string;
  status: QuoteStatus;
  lineItems: QuoteLineItem[];

  // Financials
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  currency: string;

  // Terms
  validUntil?: FirestoreDate;
  terms?: string;
  notes?: string;

  // Tracking
  sentAt?: FirestoreDate;
  viewedAt?: FirestoreDate;
  acceptedAt?: FirestoreDate;
  rejectedAt?: FirestoreDate;
  convertedToInvoiceId?: string;

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
 * Quote filters for queries
 */
export interface QuoteFilters {
  status?: QuoteStatus | 'all';
  dealId?: string;
  contactId?: string;
  companyId?: string;
  ownerId?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export type CreateQuoteInput = Omit<Quote, 'id' | 'createdAt' | 'quoteNumber'>;
export type UpdateQuoteInput = Partial<Omit<Quote, 'id' | 'createdAt' | 'quoteNumber' | 'lineItems'>> & {
  lineItems?: QuoteLineItemInput[];
};
