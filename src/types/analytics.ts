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

/**
 * Report Builder Types
 */

export interface ReportFilter {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'between';
  value: string | number | boolean | [number, number];
}

export interface ReportMetric {
  field: string;
  aggregation: 'count' | 'sum' | 'avg' | 'min' | 'max';
  label: string;
}

export interface ReportVisualization {
  type: 'table' | 'bar' | 'line' | 'pie' | 'area';
  options?: Record<string, unknown>;
}

export interface CustomReport {
  id: string;
  name: string;
  description?: string;
  organizationId: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  dataSource: string;
  filters: ReportFilter[];
  grouping: string[];
  metrics: ReportMetric[];
  visualization: ReportVisualization;
  sharedWith: string[];
  isPublic: boolean;
}

/**
 * Analytics Service Report Types
 */

export interface RevenueTrend {
  date: string;
  revenue: number;
  count: number;
}

export interface RevenueBySourceItem {
  source: string;
  revenue: number;
  deals: number;
  percentage: number;
}

export interface RevenueByProductItem {
  productId: string;
  productName: string;
  revenue: number;
  units: number;
  averagePrice: number;
}

export interface RevenueBySalesRepItem {
  repId: string;
  repName: string;
  revenue: number;
  deals: number;
  averageDealSize: number;
}

export interface RevenueReport {
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  startDate: Date;
  endDate: Date;
  totalRevenue: number;
  totalDeals: number;
  averageDealSize: number;
  revenueBySource: RevenueBySourceItem[];
  revenueByProduct: RevenueByProductItem[];
  revenueBySalesRep: RevenueBySalesRepItem[];
  trends: RevenueTrend[];
}

export interface PipelineStage {
  stage: string;
  count: number;
  value: number;
}

export interface PipelineTrend {
  date: string;
  value: number;
  count: number;
}

export interface PipelineReport {
  period: string;
  totalValue: number;
  totalDeals: number;
  averageDealSize: number;
  byStage: PipelineStage[];
  velocity: number;
  conversionRates: Record<string, number>;
  trends: PipelineTrend[];
}

export interface ForecastScenario {
  name: string;
  value: number;
  probability: number;
}

export interface SalesForecast {
  period: 'month' | 'quarter' | 'year';
  forecastDate: Date;
  forecastedRevenue: number;
  confidence: number;
  scenarios: ForecastScenario[];
  byRep: Record<string, number>;
  byProduct: Record<string, number>;
  factors: string[];
}

export interface WinLossReason {
  reason: string;
  count: number;
  percentage: number;
}

export interface WinLossAnalysis {
  period: string;
  totalDeals: number;
  won: number;
  lost: number;
  winRate: number;
  averageDealSize: {
    won: number;
    lost: number;
    total: number;
  };
  lossReasons: WinLossReason[];
  winFactors: WinLossReason[];
  byCompetitor: Record<string, { won: number; lost: number }>;
  bySalesRep: Record<string, { won: number; lost: number; winRate: number }>;
  trends: { date: string; winRate: number }[];
}
