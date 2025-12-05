/**
 * Analytics & Reporting Types
 * Types for revenue reports, pipeline analysis, forecasting, and win/loss analysis
 */

export interface RevenueReport {
  period: string; // 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
  startDate: Date;
  endDate: Date;
  totalRevenue: number;
  totalDeals: number;
  averageDealSize: number;
  revenueBySource: RevenueBySource[];
  revenueByProduct: RevenueByProduct[];
  revenueBySalesRep: RevenueBySalesRep[];
  trends: RevenueTrend[];
}

export interface RevenueBySource {
  source: string;
  revenue: number;
  deals: number;
  percentage: number;
}

export interface RevenueByProduct {
  productId: string;
  productName: string;
  revenue: number;
  units: number;
  averagePrice: number;
}

export interface RevenueBySalesRep {
  repId: string;
  repName: string;
  revenue: number;
  deals: number;
  averageDealSize: number;
}

export interface RevenueTrend {
  date: Date;
  revenue: number;
  deals: number;
  averageDealSize: number;
}

export interface PipelineReport {
  period: string;
  totalValue: number;
  totalDeals: number;
  averageDealSize: number;
  byStage: PipelineStage[];
  velocity: PipelineVelocity;
  conversionRates: ConversionRate[];
  trends: PipelineTrend[];
}

export interface PipelineStage {
  stageId: string;
  stageName: string;
  value: number;
  deals: number;
  averageDealSize: number;
  averageDaysInStage: number;
}

export interface PipelineVelocity {
  averageSalesCycle: number; // days
  averageTimeToClose: number; // days
  averageTimePerStage: Record<string, number>; // stageId -> days
}

export interface ConversionRate {
  fromStage: string;
  toStage: string;
  rate: number; // percentage
  deals: number;
}

export interface PipelineTrend {
  date: Date;
  totalValue: number;
  totalDeals: number;
  byStage: Record<string, number>; // stageId -> value
}

export interface SalesForecast {
  period: string; // 'month' | 'quarter' | 'year'
  forecastDate: Date;
  forecastedRevenue: number;
  confidence: number; // 0-100
  scenarios: ForecastScenario[];
  byRep: ForecastByRep[];
  byProduct: ForecastByProduct[];
  factors: ForecastFactor[];
}

export interface ForecastScenario {
  name: string; // 'best_case' | 'likely' | 'worst_case'
  revenue: number;
  probability: number; // 0-100
  description: string;
}

export interface ForecastByRep {
  repId: string;
  repName: string;
  forecastedRevenue: number;
  openDeals: number;
  weightedValue: number;
}

export interface ForecastByProduct {
  productId: string;
  productName: string;
  forecastedRevenue: number;
  forecastedUnits: number;
}

export interface ForecastFactor {
  factor: string;
  impact: 'positive' | 'negative' | 'neutral';
  description: string;
  weight: number; // 0-1
}

export interface WinLossAnalysis {
  period: string;
  totalDeals: number;
  won: number;
  lost: number;
  winRate: number; // percentage
  averageDealSize: {
    won: number;
    lost: number;
    total: number;
  };
  lossReasons: LossReason[];
  winFactors: WinFactor[];
  byCompetitor: CompetitorAnalysis[];
  bySalesRep: WinLossByRep[];
  trends: WinLossTrend[];
}

export interface LossReason {
  reason: string;
  count: number;
  percentage: number;
  averageDealSize: number;
  totalValue: number;
}

export interface WinFactor {
  factor: string;
  frequency: number;
  percentage: number;
  averageDealSize: number;
}

export interface CompetitorAnalysis {
  competitor: string;
  wins: number;
  losses: number;
  winRate: number;
  averageDealSize: number;
  commonReasons: string[];
}

export interface WinLossByRep {
  repId: string;
  repName: string;
  won: number;
  lost: number;
  winRate: number;
  averageDealSize: number;
}

export interface WinLossTrend {
  date: Date;
  won: number;
  lost: number;
  winRate: number;
}

export interface CustomReport {
  id: string;
  name: string;
  description?: string;
  organizationId: string;
  workspaceId?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Report configuration
  dataSource: string; // Entity name
  filters: ReportFilter[];
  grouping: ReportGrouping[];
  metrics: ReportMetric[];
  visualization: ReportVisualization;
  
  // Schedule
  schedule?: ReportSchedule;
  
  // Sharing
  sharedWith: string[]; // User IDs
  isPublic: boolean;
}

export interface ReportFilter {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'between' | 'in' | 'not_in';
  value: any;
}

export interface ReportGrouping {
  field: string;
  order: 'asc' | 'desc';
}

export interface ReportMetric {
  field: string;
  aggregation: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'distinct';
  label: string;
  format?: string; // 'currency' | 'percentage' | 'number' | 'date'
}

export interface ReportVisualization {
  type: 'table' | 'bar' | 'line' | 'pie' | 'donut' | 'area' | 'scatter' | 'funnel';
  xAxis?: string;
  yAxis?: string;
  groupBy?: string;
  colors?: string[]; // Theme colors will be used
}

export interface ReportSchedule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
  time: string; // HH:mm format
  recipients: string[]; // Email addresses
  format: 'pdf' | 'excel' | 'csv' | 'email';
}

export interface AnalyticsDashboard {
  organizationId: string;
  workspaceId?: string;
  widgets: DashboardWidget[];
  layout: DashboardLayout;
  lastUpdated: Date;
}

export interface DashboardWidget {
  id: string;
  type: 'metric' | 'chart' | 'table' | 'list';
  title: string;
  position: { x: number; y: number; w: number; h: number };
  config: WidgetConfig;
}

export interface WidgetConfig {
  dataSource?: string;
  filters?: ReportFilter[];
  metric?: ReportMetric;
  chart?: ReportVisualization;
  table?: {
    columns: string[];
    limit?: number;
  };
  list?: {
    entity: string;
    fields: string[];
    limit: number;
    sortBy?: string;
  };
}

export interface DashboardLayout {
  columns: number;
  rowHeight: number;
  gap: number;
}








