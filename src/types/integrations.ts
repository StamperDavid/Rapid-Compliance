/**
 * Type definitions for External Service Integrations
 * Purpose: Replace 'any' type usage in integration adapters
 */

// Google Calendar Types
export interface GoogleCalendarTimeSlot {
  start: string;
  end: string;
  available?: boolean;
}

export interface GoogleCalendarBusySlot {
  start: string;
  end: string;
}

// Microsoft Outlook Types
export interface OutlookEmailMessage {
  id: string;
  subject: string;
  from: string;
  to: string[];
  cc: string[];
  body: string;
  receivedDateTime: string;
  isRead: boolean;
  hasAttachments: boolean;
}

export interface OutlookRecipient {
  emailAddress: {
    address: string;
    name?: string;
  };
}

// Shopify Types
export interface ShopifyOrder {
  id: string;
  orderNumber: string;
  totalPrice: number;
  currency: string;
  customer: ShopifyCustomer;
  lineItems: ShopifyLineItem[];
  createdAt: string;
  status: string;
}

export interface ShopifyLineItem {
  id: string;
  productId: string;
  variantId: string;
  title: string;
  quantity: number;
  price: number;
  sku?: string;
}

export interface ShopifyCustomer {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export interface ShopifyProduct {
  id: string;
  title: string;
  description: string;
  vendor: string;
  productType: string;
  tags: string[];
  variants: ShopifyVariant[];
  images: ShopifyImage[];
}

export interface ShopifyVariant {
  id: string;
  title: string;
  price: number;
  sku?: string;
  inventoryQuantity: number;
}

export interface ShopifyImage {
  src: string;
  alt?: string;
}

// Calendly Types
export interface CalendlyTimeSlot {
  start: string;
  end: string;
  available: boolean;
  status?: string;
}

// LinkedIn Types
export interface LinkedInJobPosting {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  postedDate: string;
  url: string;
  salary?: {
    min?: number;
    max?: number;
    currency?: string;
  };
}

// News API Types
export interface NewsArticle {
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  author?: string;
  content?: string;
  imageUrl?: string;
}

// Generic Search Result Types
export interface SearchResult {
  id: string;
  title: string;
  description: string;
  url: string;
  relevanceScore?: number;
  metadata?: Record<string, unknown>;
}

// Campaign Manager Types
export interface CampaignData {
  id: string;
  name: string;
  status: string;
  startDate: string;
  endDate?: string;
  sent: number;
  opens: number;
  clicks: number;
  conversions: number;
  [key: string]: unknown;
}

// Workflow Execution Types
export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: string;
  startedAt: number;
  completedAt?: number;
  error?: string;
  results?: Record<string, unknown>;
  [key: string]: unknown;
}

// Scraper Intelligence Types
export interface ScraperSignal {
  type: string;
  content: string;
  confidence: number;
  timestamp: number;
  source?: string;
  metadata?: Record<string, unknown>;
}

// Golden Master Product Type
export interface GoldenMasterProduct {
  id?: string;
  name: string;
  description: string;
  price: number | string;
  category?: string;
  features?: string[];
  [key: string]: unknown;
}

// User Profile Type
export interface UserProfile {
  id: string;
  name?: string;
  email: string;
  phone?: string;
  title?: string;
  department?: string;
  role?: string;
  organizationId?: string;
  [key: string]: unknown;
}

// Organization Type
export interface OrganizationData {
  id: string;
  name: string;
  plan?: string;
  status?: string;
  createdAt?: number;
  industry?: string;
  size?: string;
  [key: string]: unknown;
}
