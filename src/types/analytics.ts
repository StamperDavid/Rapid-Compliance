/**
 * Type definitions for Analytics Engine
 * Purpose: Replace 'any' type usage in analytics transformations
 */

export interface AnalyticsDataPoint {
  timestamp: number;
  value: number;
  label?: string;
  metadata?: Record<string, unknown>;
}

export interface AggregatedMetric {
  generationTime?: number;
  count?: number;
  sum?: number;
  average?: number;
  [key: string]: unknown;
}

export interface StepPerformance {
  stepId: string;
  name: string;
  opened: number;
  clicked: number;
  replied: number;
  bounced: number;
  unsubscribed: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
}

export interface DealMetric {
  id: string;
  stage: string;
  value: number;
  probability?: number;
  expectedCloseDate?: string;
  products?: ProductMetric[];
  [key: string]: unknown;
}

export interface ProductMetric {
  id: string;
  name: string;
  price: number;
  quantity: number;
  category?: string;
}

export interface EmailMetric {
  id: string;
  subject: string;
  sentAt: number;
  opens: number;
  clicks: number;
  replies: number;
  generationTime?: number;
  [key: string]: unknown;
}

export interface ContactMetric {
  id: string;
  name: string;
  email: string;
  company?: string;
  title?: string;
  source?: string;
  createdAt: number;
  [key: string]: unknown;
}

export interface LeadMetric {
  id: string;
  name: string;
  email: string;
  company?: string;
  score?: number;
  status: string;
  source?: string;
  createdAt: number;
  [key: string]: unknown;
}

export interface OrderMetric {
  id: string;
  total: number;
  status: string;
  items: OrderItemMetric[];
  createdAt: number;
  customerId?: string;
  [key: string]: unknown;
}

export interface OrderItemMetric {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  category?: string;
}

export interface RevenueGrouping {
  date: string;
  revenue: number;
  count: number;
  source?: string;
}

export interface PerformanceGrouping {
  label: string;
  value: number;
  count: number;
  percentage?: number;
}
