/**
 * Subscription and Billing Types
 * For managing customer subscriptions, plans, and billing
 */

import { Timestamp } from 'firebase/firestore';

/**
 * Subscription Plan
 * The pricing tiers we offer
 */
export interface SubscriptionPlan {
  id: string;
  
  // Plan details
  name: string;
  description: string;
  
  // Pricing
  monthlyPrice: number | null; // null for custom/enterprise
  yearlyPrice: number | null;
  currency: string; // 'usd', 'eur', etc.
  
  // Limits
  limits: {
    agents: number | null; // null = unlimited
    conversationsPerMonth: number | null;
    crmRecords: number | null;
    users: number | null;
    workspaces: number | null;
    apiCallsPerMonth: number | null;
    storageGB: number | null;
  };
  
  // Features
  features: string[]; // List of included features
  
  // Metadata
  displayOrder: number;
  isPopular: boolean;
  isActive: boolean; // Can new customers sign up for this?
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
}

/**
 * Customer Subscription
 * A customer's active subscription
 */
export interface CustomerSubscription {
  id: string;
  organizationId: string;
  
  // Plan
  planId: string;
  planName: string;
  
  // Billing
  billingCycle: 'monthly' | 'yearly';
  amount: number;
  currency: string;
  
  // Payment
  paymentMethod: 'card' | 'invoice' | 'other';
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  
  // Status
  status: 'trial' | 'active' | 'past_due' | 'cancelled' | 'expired';
  
  // Trial
  trialEndsAt?: Timestamp | string;
  
  // Billing dates
  currentPeriodStart: Timestamp | string;
  currentPeriodEnd: Timestamp | string;
  nextBillingDate?: Timestamp | string;
  
  // Cancellation
  cancelledAt?: Timestamp | string;
  cancelReason?: string;
  cancelAtPeriodEnd?: boolean;
  
  // Usage
  currentUsage: {
    conversations: number;
    agents: number;
    crmRecords: number;
    users: number;
    apiCalls: number;
    storageGB: number;
  };
  
  // Metadata
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
}

/**
 * Invoice
 * Billing invoice for a customer
 */
export interface Invoice {
  id: string;
  organizationId: string;
  subscriptionId: string;
  
  // Amount
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  
  // Line items
  items: InvoiceItem[];
  
  // Status
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  
  // Payment
  paidAt?: Timestamp | string;
  paymentMethod?: string;
  
  // Dates
  invoiceDate: Timestamp | string;
  dueDate: Timestamp | string;
  
  // Metadata
  stripeInvoiceId?: string;
  invoiceNumber: string;
  createdAt: Timestamp | string;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

/**
 * Payment Method
 * Customer's payment method
 */
export interface PaymentMethod {
  id: string;
  organizationId: string;
  
  // Type
  type: 'card' | 'bank_account' | 'paypal';
  
  // Card details (if type = card)
  cardBrand?: string;
  cardLast4?: string;
  cardExpMonth?: number;
  cardExpYear?: number;
  
  // Status
  isDefault: boolean;
  
  // Metadata
  stripePaymentMethodId?: string;
  createdAt: Timestamp | string;
}

/**
 * Revenue Metrics
 * For admin dashboard
 */
export interface RevenueMetrics {
  // Time range
  startDate: string;
  endDate: string;
  
  // Revenue
  mrr: number; // Monthly Recurring Revenue
  arr: number; // Annual Recurring Revenue
  totalRevenue: number;
  
  // Customers
  totalCustomers: number;
  newCustomers: number;
  churnedCustomers: number;
  
  // Churn
  churnRate: number; // percentage
  revenueChurnRate: number;
  
  // Growth
  mrrGrowth: number; // percentage
  arrGrowth: number;
  
  // Average metrics
  averageRevenuePerCustomer: number;
  customerLifetimeValue: number;
  
  // By plan
  revenueByPlan: Array<{
    planId: string;
    planName: string;
    customers: number;
    mrr: number;
    percentage: number;
  }>;
  
  // Generated at
  generatedAt: string;
}

/**
 * Customer for Admin
 * Customer record in admin dashboard
 */
export interface AdminCustomer {
  id: string;
  organizationId: string;
  
  // Company info
  companyName: string;
  industry?: string;
  website?: string;
  
  // Contact
  primaryContact: {
    name: string;
    email: string;
    phone?: string;
  };
  
  // Subscription
  subscription: CustomerSubscription;
  
  // Usage
  usage: {
    agents: number;
    conversations: number;
    crmRecords: number;
    users: number;
  };
  
  // Health
  healthScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high';
  
  // Activity
  lastActive: Timestamp | string;
  
  // Support
  openTickets: number;
  totalTickets: number;
  
  // Metadata
  createdAt: Timestamp | string;
  trialStartedAt?: Timestamp | string;
  convertedAt?: Timestamp | string;
}

