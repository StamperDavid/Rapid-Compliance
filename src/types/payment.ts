/**
 * CRM Payment Entity - Canonical TypeScript Interface
 *
 * Revenue flow: Deal -> Quote -> Invoice -> Payment
 * Separate from ecommerce payment processing (Stripe/Square/etc).
 * This tracks payment records linked to CRM invoices and deals.
 *
 * @module types/payment
 */

import type { FirestoreDate, CustomFields } from './crm-entities';

// ============================================================================
// PAYMENT TYPES
// ============================================================================

/**
 * Payment status
 */
export type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'refunded'
  | 'partially_refunded'
  | 'cancelled';

export const PAYMENT_STATUSES: readonly PaymentStatus[] = [
  'pending',
  'processing',
  'completed',
  'failed',
  'refunded',
  'partially_refunded',
  'cancelled',
] as const;

/**
 * Payment method type
 */
export type CrmPaymentMethod =
  | 'credit_card'
  | 'bank_transfer'
  | 'wire'
  | 'check'
  | 'cash'
  | 'paypal'
  | 'stripe'
  | 'other';

/**
 * CRM Payment entity
 * Records a payment received against an invoice
 */
export interface CrmPayment {
  // Core identifiers
  id: string;
  paymentNumber: string; // e.g. "PAY-2026-0001"

  // Relationships
  invoiceId?: string;
  dealId?: string;
  contactId?: string;
  companyId?: string;
  companyName?: string;
  contactName?: string;

  // Payment details
  amount: number;
  currency: string;
  method: CrmPaymentMethod;
  status: PaymentStatus;
  reference?: string; // External reference (check number, wire reference, etc.)
  transactionId?: string; // Payment processor transaction ID

  // Dates
  paymentDate: FirestoreDate;
  processedAt?: FirestoreDate;

  // Notes
  notes?: string;

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
 * Payment filters for queries
 */
export interface CrmPaymentFilters {
  status?: PaymentStatus | 'all';
  invoiceId?: string;
  dealId?: string;
  contactId?: string;
  companyId?: string;
  method?: CrmPaymentMethod;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export type CreatePaymentInput = Omit<CrmPayment, 'id' | 'createdAt' | 'paymentNumber'>;
export type UpdatePaymentInput = Partial<Omit<CrmPayment, 'id' | 'createdAt' | 'paymentNumber'>>;
