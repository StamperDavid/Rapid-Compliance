/**
 * Analytics Service
 * Aggregates and calculates analytics from all platform data
 */

import { FirestoreService } from '@/lib/db/firestore-service';
import { where, Timestamp } from 'firebase/firestore';
import type {
  RevenueReport,
  PipelineReport,
  SalesForecast,
  WinLossAnalysis,
  RevenueTrend,
  RevenueBySourceItem,
  RevenueByProductItem,
  RevenueBySalesRepItem,
  PipelineStage,
  PipelineTrend,
  ForecastScenario,
  WinLossReason,
} from '@/types/analytics';

/**
 * Helper function to safely parse float values with fallback
 */
function safeParseFloat(value: unknown, fallback: number): number {
  if (value === undefined || value === null) {return fallback;}
  const parsed = typeof value === 'number' ? value : parseFloat(String(value));
  return isNaN(parsed) ? fallback : parsed;
}

/**
 * Get revenue report
 */
export async function getRevenueReport(
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly',
  startDate: Date,
  endDate: Date
): Promise<RevenueReport> {
  // Get all deals/orders in period
  const deals = await getDealsInPeriod(startDate, endDate);
  const orders = await getOrdersInPeriod(startDate, endDate);
  
  // Calculate totals
  const totalRevenue = calculateTotalRevenue(deals, orders);
  const totalDeals = deals.length + orders.length;
  const averageDealSize = totalDeals > 0 ? totalRevenue / totalDeals : 0;
  
  // Calculate breakdowns
  const revenueBySource = calculateRevenueBySource(deals, orders);
  const revenueByProduct = calculateRevenueByProduct(deals, orders);
  const revenueBySalesRep = calculateRevenueBySalesRep(deals);
  const trends = calculateRevenueTrends(deals, orders, period, startDate, endDate);
  
  return {
    period,
    startDate,
    endDate,
    totalRevenue,
    totalDeals,
    averageDealSize,
    revenueBySource,
    revenueByProduct,
    revenueBySalesRep,
    trends,
  };
}

/**
 * Get pipeline report
 */
export async function getPipelineReport(
  period: string
): Promise<PipelineReport> {
  // Get all open deals
  const openDeals = await getOpenDeals();

  // Calculate pipeline metrics
  const totalValue = openDeals.reduce((sum, deal) => sum + (typeof deal.value === 'number' ? deal.value : parseFloat(String(deal.value)) || 0), 0);
  const totalDeals = openDeals.length;
  const averageDealSize = totalDeals > 0 ? totalValue / totalDeals : 0;

  // Group by stage
  const byStage = calculatePipelineByStage(openDeals);

  // Calculate velocity
  const velocityResult = await calculatePipelineVelocity();

  // Calculate conversion rates
  const conversionRatesArray = await calculateConversionRates();
  const conversionRates: Record<string, number> = {};
  conversionRatesArray.forEach(rate => {
    conversionRates[`${rate.fromStage}->${rate.toStage}`] = rate.rate;
  });

  // Calculate trends
  const trends = await calculatePipelineTrends(period);

  return {
    period,
    totalValue,
    totalDeals,
    averageDealSize,
    byStage,
    velocity: velocityResult.averageSalesCycle,
    conversionRates,
    trends,
  };
}

/**
 * Get sales forecast
 */
export async function getSalesForecast(
  period: 'month' | 'quarter' | 'year'
): Promise<SalesForecast> {
  // Get open deals
  const openDeals = await getOpenDeals();
  
  // Calculate weighted forecast
  const forecastedRevenue = calculateWeightedForecast(openDeals);
  const confidence = calculateForecastConfidence(openDeals);
  
  // Generate scenarios
  const scenarios = generateForecastScenarios(openDeals, forecastedRevenue);

  // Breakdown by rep and product
  const byRepArray = calculateForecastByRep(openDeals);
  const byRep: Record<string, number> = {};
  byRepArray.forEach(item => {
    byRep[item.repId] = item.forecastedRevenue;
  });

  const byProductArray = calculateForecastByProduct(openDeals);
  const byProduct: Record<string, number> = {};
  byProductArray.forEach(item => {
    byProduct[item.productId] = item.forecastedRevenue;
  });

  // Identify factors
  const factorsArray = identifyForecastFactors(openDeals);
  const factors = factorsArray.map(f => f.factor);

  return {
    period,
    forecastDate: new Date(),
    forecastedRevenue,
    confidence,
    scenarios,
    byRep,
    byProduct,
    factors,
  };
}

/**
 * Get win/loss analysis
 */
export async function getWinLossAnalysis(
  period: string,
  startDate: Date,
  endDate: Date
): Promise<WinLossAnalysis> {
  // Get won and lost deals
  const deals = await getDealsInPeriod(startDate, endDate);
  const won = deals.filter(d => d.status === 'won' || d.stage === 'closed_won');
  const lost = deals.filter(d => d.status === 'lost' || d.stage === 'closed_lost');
  
  const totalDeals = deals.length;
  const winRate = totalDeals > 0 ? (won.length / totalDeals) * 100 : 0;
  
  // Calculate averages
  const averageDealSize = {
    won: won.length > 0 ? won.reduce((sum, d) => sum + (typeof d.value === 'number' ? d.value : parseFloat(String(d.value)) || 0), 0) / won.length : 0,
    lost: lost.length > 0 ? lost.reduce((sum, d) => sum + (typeof d.value === 'number' ? d.value : parseFloat(String(d.value)) || 0), 0) / lost.length : 0,
    total: totalDeals > 0 ? deals.reduce((sum, d) => sum + (typeof d.value === 'number' ? d.value : parseFloat(String(d.value)) || 0), 0) / totalDeals : 0,
  };
  
  // Analyze loss reasons
  const lossReasonsArray = analyzeLossReasons(lost);
  const lossReasons: WinLossReason[] = lossReasonsArray.map(item => ({
    reason: item.reason,
    count: item.count,
    percentage: item.percentage,
  }));

  // Analyze win factors
  const winFactorsArray = analyzeWinFactors(won);
  const winFactors: WinLossReason[] = winFactorsArray.map(item => ({
    reason: item.factor,
    count: item.frequency,
    percentage: item.percentage,
  }));

  // Competitor analysis
  const byCompetitorArray = analyzeCompetitors(won, lost);
  const byCompetitor: Record<string, { won: number; lost: number }> = {};
  byCompetitorArray.forEach(item => {
    byCompetitor[item.competitor] = { won: item.wins, lost: item.losses };
  });

  // By sales rep
  const bySalesRepArray = analyzeWinLossByRep(won, lost);
  const bySalesRep: Record<string, { won: number; lost: number; winRate: number }> = {};
  bySalesRepArray.forEach(item => {
    bySalesRep[item.repId] = { won: item.won, lost: item.lost, winRate: item.winRate };
  });

  // Trends
  const trendsArray = await calculateWinLossTrends(startDate, endDate);
  const trends = trendsArray.map(item => ({
    date: item.date.toISOString().split('T')[0],
    winRate: item.winRate,
  }));

  return {
    period,
    totalDeals,
    won: won.length,
    lost: lost.length,
    winRate,
    averageDealSize,
    lossReasons,
    winFactors,
    byCompetitor,
    bySalesRep,
    trends,
  };
}

// Type definitions for analytics data

/** Deal record from CRM */
interface DealRecord {
  id?: string;
  value?: string | number;
  stage?: string;
  stageName?: string;
  status?: string;
  source?: string;
  probability?: string | number;
  closedDate?: { toDate?: () => Date } | Date | string;
  createdAt?: { toDate?: () => Date } | Date | string;
  updatedAt?: { toDate?: () => Date } | Date | string;
  qualifiedDate?: { toDate?: () => Date } | Date | string;
  assignedTo?: string;
  assignedToName?: string;
  ownerId?: string;
  ownerName?: string;
  lostReason?: string;
  reason?: string;
  lostToCompetitor?: string;
  competitor?: string;
  tags?: string[];
  products?: DealProduct[];
  stageHistory?: StageHistoryEntry[];
}

/** Product within a deal */
interface DealProduct {
  productId?: string;
  id?: string;
  name?: string;
  quantity?: number;
  price?: string | number;
}

/** Stage history entry */
interface StageHistoryEntry {
  stage: string;
  enteredAt?: { toDate?: () => Date } | Date | string;
  exitedAt?: { toDate?: () => Date } | Date | string;
}

/** Order record */
interface OrderRecord {
  id?: string;
  total?: string | number;
  status?: string;
  source?: string;
  createdAt?: { toDate?: () => Date } | Date | string;
  items?: OrderItem[];
}

/** Order item */
interface OrderItem {
  productId: string;
  productName?: string;
  quantity?: number;
  price?: string | number;
}

// Helper functions

async function getDealsInPeriod(startDate: Date, endDate: Date): Promise<DealRecord[]> {
  // Get deals from CRM
  const { getSubCollection } = await import('@/lib/firebase/collections');
  const dealsPath = getSubCollection('deals');
  const deals = await FirestoreService.getAll<DealRecord>(
    dealsPath,
    [
      where('closedDate', '>=', Timestamp.fromDate(startDate)),
      where('closedDate', '<=', Timestamp.fromDate(endDate)),
    ]
  );

  return deals;
}

async function getOrdersInPeriod(startDate: Date, endDate: Date): Promise<OrderRecord[]> {
  const { getSubCollection } = await import('@/lib/firebase/collections');
  const ordersPath = getSubCollection('orders');
  const orders = await FirestoreService.getAll<OrderRecord>(
    ordersPath,
    [
      where('createdAt', '>=', Timestamp.fromDate(startDate)),
      where('createdAt', '<=', Timestamp.fromDate(endDate)),
      where('status', '==', 'completed'),
    ]
  );

  return orders;
}

function calculateTotalRevenue(deals: DealRecord[], orders: OrderRecord[]): number {
  const dealRevenue = deals
    .filter(d => d.status === 'won' || d.stage === 'closed_won')
    .reduce((sum, d) => sum + (parseFloat(String(d.value)) || 0), 0);
  
  const orderRevenue = orders.reduce((sum, o) => sum + (parseFloat(String(o.total)) || 0), 0);
  
  return dealRevenue + orderRevenue;
}

function calculateRevenueBySource(deals: DealRecord[], orders: OrderRecord[]): RevenueBySourceItem[] {
  const sourceMap = new Map<string, { revenue: number; deals: number }>();
  
  // From deals
  deals.forEach(deal => {
    const source = deal.source ?? 'unknown';
    const value = parseFloat(String(deal.value)) || 0;
    const existing = sourceMap.get(source) ?? { revenue: 0, deals: 0 };
    sourceMap.set(source, {
      revenue: existing.revenue + value,
      deals: existing.deals + 1,
    });
  });
  
  // From orders
  orders.forEach(order => {
    const source = order.source ?? 'ecommerce';
    const total = parseFloat(String(order.total)) || 0;
    const existing = sourceMap.get(source) ?? { revenue: 0, deals: 0 };
    sourceMap.set(source, {
      revenue: existing.revenue + total,
      deals: existing.deals + 1,
    });
  });
  
  const totalRevenue = Array.from(sourceMap.values()).reduce((sum, s) => sum + s.revenue, 0);
  
  return Array.from(sourceMap.entries()).map(([source, data]) => ({
    source,
    revenue: data.revenue,
    deals: data.deals,
    percentage: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
  }));
}

function calculateRevenueByProduct(deals: DealRecord[], orders: OrderRecord[]): RevenueByProductItem[] {
  const productMap = new Map<string, { revenue: number; units: number; name: string }>();
  
  // From deals (line items)
  deals.forEach(deal => {
    if (deal.products && Array.isArray(deal.products)) {
      deal.products.forEach((product) => {
        const productId = product.productId ?? product.id ?? 'unknown';
        const productName = product.name ?? 'Unknown';
        const quantity = product.quantity ?? 1;
        const price = parseFloat(String(product.price)) || 0;
        const revenue = quantity * price;
        
        const existing = productMap.get(productId) ?? { revenue: 0, units: 0, name: productName };
        productMap.set(productId, {
          revenue: existing.revenue + revenue,
          units: existing.units + quantity,
          name: productName,
        });
      });
    }
  });
  
  // From orders
  orders.forEach(order => {
    if (order.items && Array.isArray(order.items)) {
      order.items.forEach((item) => {
        const productId = item.productId;
        const productName = item.productName ?? 'Unknown';
        const quantity = item.quantity ?? 1;
        const price = parseFloat(String(item.price)) || 0;
        const revenue = quantity * price;
        
        const existing = productMap.get(productId) ?? { revenue: 0, units: 0, name: productName };
        productMap.set(productId, {
          revenue: existing.revenue + revenue,
          units: existing.units + quantity,
          name: productName,
        });
      });
    }
  });
  
  return Array.from(productMap.entries()).map(([productId, data]) => ({
    productId,
    productName: data.name,
    revenue: data.revenue,
    units: data.units,
    averagePrice: data.units > 0 ? data.revenue / data.units : 0,
  }));
}

function calculateRevenueBySalesRep(deals: DealRecord[]): RevenueBySalesRepItem[] {
  const repMap = new Map<string, { revenue: number; deals: number; name: string }>();
  
  deals.forEach(deal => {
    const repId = deal.assignedTo ?? deal.ownerId ?? 'unassigned';
    const repName = deal.assignedToName ?? deal.ownerName ?? 'Unassigned';
    const value = parseFloat(String(deal.value)) || 0;
    
    const existing = repMap.get(repId) ?? { revenue: 0, deals: 0, name: repName };
    repMap.set(repId, {
      revenue: existing.revenue + value,
      deals: existing.deals + 1,
      name: repName,
    });
  });
  
  return Array.from(repMap.entries()).map(([repId, data]) => ({
    repId,
    repName: data.name,
    revenue: data.revenue,
    deals: data.deals,
    averageDealSize: data.deals > 0 ? data.revenue / data.deals : 0,
  }));
}


function calculateRevenueTrends(
  deals: DealRecord[],
  orders: OrderRecord[],
  period: string,
  startDate: Date,
  endDate: Date
): RevenueTrend[] {
  const trends: RevenueTrend[] = [];
  const interval = getIntervalForPeriod(period);

  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const periodStart = new Date(currentDate);
    const periodEnd = new Date(currentDate);
    periodEnd.setDate(periodEnd.getDate() + interval - 1);

    const periodDeals = deals.filter(d => {
      const closedDateVal = d.closedDate;
      const closedDate = closedDateVal && typeof closedDateVal === 'object' && 'toDate' in closedDateVal && typeof closedDateVal.toDate === 'function'
        ? closedDateVal.toDate()
        : closedDateVal instanceof Date ? closedDateVal : new Date(String(closedDateVal));
      return closedDate >= periodStart && closedDate <= periodEnd;
    });

    const periodOrders = orders.filter(o => {
      const createdAtVal = o.createdAt;
      const createdAt = createdAtVal && typeof createdAtVal === 'object' && 'toDate' in createdAtVal && typeof createdAtVal.toDate === 'function'
        ? createdAtVal.toDate()
        : createdAtVal instanceof Date ? createdAtVal : new Date(String(createdAtVal));
      return createdAt >= periodStart && createdAt <= periodEnd;
    });

    const revenue = calculateTotalRevenue(periodDeals, periodOrders);
    const totalDeals = periodDeals.length + periodOrders.length;

    trends.push({
      date: periodStart.toISOString().split('T')[0],
      revenue,
      count: totalDeals,
    });

    currentDate.setDate(currentDate.getDate() + interval);
  }

  return trends;
}

function getIntervalForPeriod(period: string): number {
  switch (period) {
    case 'daily': return 1;
    case 'weekly': return 7;
    case 'monthly': return 30;
    case 'quarterly': return 90;
    case 'yearly': return 365;
    default: return 30;
  }
}

async function getOpenDeals(): Promise<DealRecord[]> {
  const { getSubCollection } = await import('@/lib/firebase/collections');
  const dealsPath = getSubCollection('deals');
  const deals = await FirestoreService.getAll<DealRecord>(
    dealsPath,
    [
      where('status', 'in', ['open', 'qualified', 'proposal', 'negotiation']),
    ]
  );

  return deals;
}

function calculatePipelineByStage(deals: DealRecord[]): PipelineStage[] {
  const stageMap = new Map<string, { value: number; deals: number; name: string; days: number[] }>();
  
  deals.forEach(deal => {
    const stage = deal.stage ?? 'unknown';
    const stageName = deal.stageName ?? stage;
    const value = typeof deal.value === 'number' ? deal.value : parseFloat(String(deal.value)) || 0;
    const daysInStage = calculateDaysInStage(deal, stage);

    const existing = stageMap.get(stage) ?? { value: 0, deals: 0, name: stageName, days: [] };
    stageMap.set(stage, {
      value: existing.value + value,
      deals: existing.deals + 1,
      name: stageName,
      days: [...existing.days, daysInStage],
    });
  });

  return Array.from(stageMap.entries()).map(([stage, data]) => ({
    stage,
    value: data.value,
    count: data.deals,
  }));
}

function calculateDaysInStage(deal: DealRecord, stage: string): number {
  const stageHistory = deal.stageHistory ?? [];
  const stageEntry = stageHistory.find((h: StageHistoryEntry) => h.stage === stage);
  
  if (stageEntry?.enteredAt) {
    const enteredAt = stageEntry.enteredAt;
    const entered = (enteredAt && typeof enteredAt === 'object' && 'toDate' in enteredAt && enteredAt.toDate) 
      ? enteredAt.toDate() 
      : new Date(enteredAt as string);
    const now = new Date();
    return Math.floor((now.getTime() - entered.getTime()) / (1000 * 60 * 60 * 24));
  }
  
  return 0;
}

/** Pipeline velocity result */
interface PipelineVelocityResult {
  averageSalesCycle: number;
  averageTimeToClose: number;
  averageTimePerStage: Record<string, number>;
}

async function calculatePipelineVelocity(): Promise<PipelineVelocityResult> {
  // Get closed deals from last 90 days
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const { getSubCollection } = await import('@/lib/firebase/collections');
  const dealsPath = getSubCollection('deals');
  const closedDeals = await FirestoreService.getAll<DealRecord>(
    dealsPath,
    [
      where('status', 'in', ['won', 'lost']),
      where('closedDate', '>=', Timestamp.fromDate(ninetyDaysAgo)),
    ]
  );
  
  if (closedDeals.length === 0) {
    return {
      averageSalesCycle: 0,
      averageTimeToClose: 0,
      averageTimePerStage: {},
    };
  }
  
  // Calculate average sales cycle
  const salesCycles = closedDeals.map(deal => {
    const createdAtVal = deal.createdAt;
    const closedDateVal = deal.closedDate;
    const created = (createdAtVal && typeof createdAtVal === 'object' && 'toDate' in createdAtVal && createdAtVal.toDate)
      ? createdAtVal.toDate()
      : new Date(createdAtVal as string);
    const closed = (closedDateVal && typeof closedDateVal === 'object' && 'toDate' in closedDateVal && closedDateVal.toDate)
      ? closedDateVal.toDate()
      : new Date(closedDateVal as string);
    return Math.floor((closed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
  });
  
  const averageSalesCycle = salesCycles.reduce((sum, d) => sum + d, 0) / salesCycles.length;
  
  // Calculate average time to close (from qualified to closed)
  const timeToClose = closedDeals
    .filter(deal => deal.qualifiedDate)
    .map(deal => {
      const qualifiedVal = deal.qualifiedDate;
      const closedVal = deal.closedDate;
      const qualified = (qualifiedVal && typeof qualifiedVal === 'object' && 'toDate' in qualifiedVal && qualifiedVal.toDate)
        ? qualifiedVal.toDate()
        : new Date(qualifiedVal as string);
      const closed = (closedVal && typeof closedVal === 'object' && 'toDate' in closedVal && closedVal.toDate)
        ? closedVal.toDate()
        : new Date(closedVal as string);
      return Math.floor((closed.getTime() - qualified.getTime()) / (1000 * 60 * 60 * 24));
    });
  
  const averageTimeToClose = timeToClose.length > 0
    ? timeToClose.reduce((sum, d) => sum + d, 0) / timeToClose.length
    : averageSalesCycle;
  
  // Calculate average time per stage
  const stageTimes: Record<string, number[]> = {};
  closedDeals.forEach(deal => {
    const history = deal.stageHistory ?? [];
    history.forEach((entry: StageHistoryEntry) => {
      if (entry.exitedAt && entry.enteredAt) {
        const enteredVal = entry.enteredAt;
        const exitedVal = entry.exitedAt;
        const entered = (enteredVal && typeof enteredVal === 'object' && 'toDate' in enteredVal && enteredVal.toDate)
          ? enteredVal.toDate()
          : new Date(enteredVal as string);
        const exited = (exitedVal && typeof exitedVal === 'object' && 'toDate' in exitedVal && exitedVal.toDate)
          ? exitedVal.toDate()
          : new Date(exitedVal as string);
        const days = Math.floor((exited.getTime() - entered.getTime()) / (1000 * 60 * 60 * 24));
        
        if (!stageTimes[entry.stage]) {
          stageTimes[entry.stage] = [];
        }
        stageTimes[entry.stage].push(days);
      }
    });
  });
  
  const averageTimePerStage: Record<string, number> = {};
  Object.entries(stageTimes).forEach(([stage, times]) => {
    averageTimePerStage[stage] = times.reduce((sum, t) => sum + t, 0) / times.length;
  });
  
  return {
    averageSalesCycle,
    averageTimeToClose,
    averageTimePerStage,
  };
}

/** Conversion rate item */
interface ConversionRateItem {
  fromStage: string;
  toStage: string;
  rate: number;
  deals: number;
}

async function calculateConversionRates(): Promise<ConversionRateItem[]> {
  // Get all deals with stage history
  const { getSubCollection } = await import('@/lib/firebase/collections');
  const dealsPath = getSubCollection('deals');
  const deals = await FirestoreService.getAll<DealRecord>(
    dealsPath,
    []
  );
  
  // Count transitions between stages
  const transitions = new Map<string, { from: string; to: string; count: number }>();
  
  deals.forEach(deal => {
    const history = deal.stageHistory ?? [];
    for (let i = 0; i < history.length - 1; i++) {
      const from = history[i].stage;
      const to = history[i + 1].stage;
      const key = `${from}->${to}`;
      
      const existing = transitions.get(key) ?? { from, to, count: 0 };
      transitions.set(key, { from, to, count: existing.count + 1 });
    }
  });
  
  // Calculate rates
  const rates: ConversionRateItem[] = [];
  transitions.forEach((transition) => {
    // Count deals that have ever entered the "from" stage (from history)
    const fromStageCount = deals.filter(d => {
      const history = d.stageHistory ?? [];
      return history.some(h => h.stage === transition.from);
    }).length;
    const rate = fromStageCount > 0 ? (transition.count / fromStageCount) * 100 : 0;

    rates.push({
      fromStage: transition.from,
      toStage: transition.to,
      rate,
      deals: transition.count,
    });
  });

  return rates;
}

async function calculatePipelineTrends(_period: string): Promise<PipelineTrend[]> {
  // Get deals over time
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { getSubCollection } = await import('@/lib/firebase/collections');
  const dealsPath = getSubCollection('deals');
  const deals = await FirestoreService.getAll<DealRecord>(
    dealsPath,
    [
      where('createdAt', '>=', Timestamp.fromDate(thirtyDaysAgo)),
    ]
  );
  
  // Group by date and stage
  const trends: PipelineTrend[] = [];
  const dateMap = new Map<string, { value: number; deals: number }>();

  deals.forEach(deal => {
    const createdAtVal = deal.createdAt;
    const date = createdAtVal && typeof createdAtVal === 'object' && 'toDate' in createdAtVal && typeof createdAtVal.toDate === 'function'
      ? createdAtVal.toDate()
      : createdAtVal instanceof Date ? createdAtVal : new Date(String(createdAtVal));
    const dateKey = date.toISOString().split('T')[0];
    const value = typeof deal.value === 'number' ? deal.value : parseFloat(String(deal.value)) || 0;

    const existing = dateMap.get(dateKey) ?? { value: 0, deals: 0 };

    dateMap.set(dateKey, {
      value: existing.value + value,
      deals: existing.deals + 1,
    });
  });

  dateMap.forEach((data, dateKey) => {
    trends.push({
      date: dateKey,
      value: data.value,
      count: data.deals,
    });
  });

  return trends.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function calculateWeightedForecast(deals: DealRecord[]): number {
  return deals.reduce((sum, deal) => {
    const value = safeParseFloat(deal.value, 0);
    const probability = safeParseFloat(deal.probability, 50); // Default 50%
    return sum + (value * probability / 100);
}, 0);
}

function calculateForecastConfidence(deals: DealRecord[]): number {
  if (deals.length === 0) {return 0;}
  
  // Confidence based on:
  // - Number of deals
  // - Average probability
  // - Recency of updates
  
  const avgProbability = deals.reduce((sum, d) => sum + safeParseFloat(d.probability, 50), 0) / deals.length;
  const dealCountFactor = Math.min(deals.length / 20, 1); // Max confidence at 20+ deals

  // Calculate average recency factor across all deals
  const recencyFactors = deals.map(deal => {
    if (!deal.updatedAt) {return 1;}

    const updatedAtDate = typeof deal.updatedAt === 'string'
      ? new Date(deal.updatedAt)
      : typeof deal.updatedAt === 'object' && 'toDate' in deal.updatedAt && typeof deal.updatedAt.toDate === 'function'
      ? deal.updatedAt.toDate()
      : deal.updatedAt instanceof Date
      ? deal.updatedAt
      : new Date();

    const daysSinceUpdate = Math.floor((Date.now() - updatedAtDate.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0.5, 1 - (daysSinceUpdate * 0.02)); // Decay 2% per day, min 50%
  });
  const recencyFactor = recencyFactors.reduce((sum, f) => sum + f, 0) / recencyFactors.length;

  return Math.round((avgProbability * 0.6 + dealCountFactor * 100 * 0.4) * recencyFactor);
}

function generateForecastScenarios(deals: DealRecord[], baseForecast: number): ForecastScenario[] {
  return [
    {
      name: 'best_case',
      value: baseForecast * 1.2,
      probability: 20,
    },
    {
      name: 'likely',
      value: baseForecast,
      probability: 60,
    },
    {
      name: 'worst_case',
      value: baseForecast * 0.7,
      probability: 20,
    },
  ];
}

/** Forecast by rep item */
interface ForecastByRepItem {
  repId: string;
  repName: string;
  forecastedRevenue: number;
  openDeals: number;
  weightedValue: number;
}

function calculateForecastByRep(deals: DealRecord[]): ForecastByRepItem[] {
  const repMap = new Map<string, { forecast: number; deals: number; name: string; weighted: number }>();
  
  deals.forEach(deal => {
    const repId = deal.assignedTo ?? deal.ownerId ?? 'unassigned';
    const repName = deal.assignedToName ?? deal.ownerName ?? 'Unassigned';
    const value = safeParseFloat(deal.value, 0);
    const probability = safeParseFloat(deal.probability, 50);
    const weighted = value * probability / 100;
    
    const existing = repMap.get(repId) ?? { forecast: 0, deals: 0, name: repName, weighted: 0 };
    repMap.set(repId, {
      forecast: existing.forecast + value,
      deals: existing.deals + 1,
      name: repName,
      weighted: existing.weighted + weighted,
    });
  });
  
  return Array.from(repMap.entries()).map(([repId, data]) => ({
    repId,
    repName: data.name,
    forecastedRevenue: data.weighted,
    openDeals: data.deals,
    weightedValue: data.weighted,
  }));
}

/** Forecast by product item */
interface ForecastByProductItem {
  productId: string;
  productName: string;
  forecastedRevenue: number;
  forecastedUnits: number;
}

function calculateForecastByProduct(deals: DealRecord[]): ForecastByProductItem[] {
  const productMap = new Map<string, { forecast: number; units: number; name: string }>();
  
  deals.forEach(deal => {
    if (deal.products && Array.isArray(deal.products)) {
      deal.products.forEach((product: DealProduct) => {
        const productId = product.productId ?? product.id ?? 'unknown';
        const productName = product.name ?? 'Unknown';
        const quantity = product.quantity ?? 1;
        const price = safeParseFloat(product.price, 0);
        const probability = safeParseFloat(deal.probability, 50);
        const forecast = (quantity * price) * probability / 100;
        
        const existing = productMap.get(productId) ?? { forecast: 0, units: 0, name: productName };
        productMap.set(productId, {
          forecast: existing.forecast + forecast,
          units: existing.units + quantity,
          name: productName,
        });
      });
    }
  });
  
  return Array.from(productMap.entries()).map(([productId, data]) => ({
    productId,
    productName: data.name,
    forecastedRevenue: data.forecast,
    forecastedUnits: data.units,
  }));
}

/** Forecast factor */
interface ForecastFactor {
  factor: string;
  impact: 'positive' | 'negative';
  description: string;
  weight: number;
}

function identifyForecastFactors(deals: DealRecord[]): ForecastFactor[] {
  const factors: ForecastFactor[] = [];
  
  // Check for large deals
  const largeDeals = deals.filter(d => parseFloat(String(d.value)) > 10000);
  if (largeDeals.length > 0) {
    factors.push({
      factor: 'Large deals in pipeline',
      impact: 'positive',
      description: `${largeDeals.length} deals over $10k`,
      weight: 0.3,
    });
  }
  
  // Check for high probability deals
  const highProbDeals = deals.filter(d => parseFloat(String(d.probability)) >= 75);
  if (highProbDeals.length > 0) {
    factors.push({
      factor: 'High probability deals',
      impact: 'positive',
      description: `${highProbDeals.length} deals at 75%+ probability`,
      weight: 0.4,
    });
  }
  
  // Check for stale deals
  const staleDeals = deals.filter(d => {
    const updatedAt = d.updatedAt;
    const lastUpdate = (updatedAt && typeof updatedAt === 'object' && 'toDate' in updatedAt && updatedAt.toDate)
      ? updatedAt.toDate()
      : new Date(updatedAt as string);
    const daysSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceUpdate > 30;
  });
  
  if (staleDeals.length > 0) {
    factors.push({
      factor: 'Stale deals',
      impact: 'negative',
      description: `${staleDeals.length} deals not updated in 30+ days`,
      weight: 0.2,
    });
  }
  
  return factors;
}

/** Loss reason analysis item */
interface LossReasonItem {
  reason: string;
  count: number;
  percentage: number;
  averageDealSize: number;
  totalValue: number;
}

function analyzeLossReasons(lostDeals: DealRecord[]): LossReasonItem[] {
  const reasonMap = new Map<string, { count: number; totalValue: number }>();
  
  lostDeals.forEach(deal => {
    const reason = deal.lostReason ?? deal.reason ?? 'No reason provided';
    const value = safeParseFloat(deal.value, 0);
    
    const existing = reasonMap.get(reason) ?? { count: 0, totalValue: 0 };
    reasonMap.set(reason, {
      count: existing.count + 1,
      totalValue: existing.totalValue + value,
    });
  });
  
  const total = lostDeals.length;
  
  return Array.from(reasonMap.entries())
    .map(([reason, data]) => ({
      reason,
      count: data.count,
      percentage: total > 0 ? (data.count / total) * 100 : 0,
      averageDealSize: data.count > 0 ? data.totalValue / data.count : 0,
      totalValue: data.totalValue,
    }))
    .sort((a, b) => b.count - a.count);
}

/** Win factor analysis item */
interface WinFactorItem {
  factor: string;
  frequency: number;
  percentage: number;
  averageDealSize: number;
}

function analyzeWinFactors(wonDeals: DealRecord[]): WinFactorItem[] {
  const factorMap = new Map<string, { count: number; totalValue: number }>();
  
  wonDeals.forEach(deal => {
    const value = safeParseFloat(deal.value, 0);

    // Extract factors from deal notes, tags, etc.
    const tags = deal.tags ?? [];
    tags.forEach((tag: string) => {
      const existing = factorMap.get(tag) ?? { count: 0, totalValue: 0 };
      factorMap.set(tag, {
        count: existing.count + 1,
        totalValue: existing.totalValue + value,
      });
    });
  });
  
  const total = wonDeals.length;
  
  return Array.from(factorMap.entries())
    .map(([factor, data]) => ({
      factor,
      frequency: data.count,
      percentage: total > 0 ? (data.count / total) * 100 : 0,
      averageDealSize: data.count > 0 ? data.totalValue / data.count : 0,
    }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 10); // Top 10
}

/** Competitor analysis item */
interface CompetitorAnalysisItem {
  competitor: string;
  wins: number;
  losses: number;
  winRate: number;
  averageDealSize: number;
  commonReasons: string[];
}

function analyzeCompetitors(wonDeals: DealRecord[], lostDeals: DealRecord[]): CompetitorAnalysisItem[] {
  const competitorMap = new Map<string, { wins: number; losses: number; totalValue: number; reasons: Map<string, number> }>();
  
  // From lost deals
  lostDeals.forEach(deal => {
    const competitor = deal.lostToCompetitor ?? deal.competitor;
    if (competitor) {
      const existing = competitorMap.get(competitor) ?? { wins: 0, losses: 0, totalValue: 0, reasons: new Map() };
      
      // Extract loss reason
      const reason = deal.lostReason ?? deal.reason ?? 'Unknown';
      existing.reasons.set(reason, (existing.reasons.get(reason) ?? 0) + 1);
      
      competitorMap.set(competitor, {
        ...existing,
        losses: existing.losses + 1,
        totalValue: existing.totalValue + safeParseFloat(deal.value, 0),
      });
    }
  });
  
  // From won deals (we won against competitors)
  wonDeals.forEach(deal => {
    const competitor = deal.competitor;
    if (competitor) {
      const existing = competitorMap.get(competitor) ?? { wins: 0, losses: 0, totalValue: 0, reasons: new Map() };
      competitorMap.set(competitor, {
        ...existing,
        wins: existing.wins + 1,
      });
    }
  });
  
  return Array.from(competitorMap.entries()).map(([competitor, data]) => {
    // Extract top 3 most common reasons
    const commonReasons = Array.from(data.reasons.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(r => r.reason);
    
    return {
    competitor,
    wins: data.wins,
    losses: data.losses,
    winRate: (data.wins + data.losses) > 0 ? (data.wins / (data.wins + data.losses)) * 100 : 0,
    averageDealSize: data.losses > 0 ? data.totalValue / data.losses : 0,
      commonReasons,
    };
  });
}

/** Win/loss by rep analysis item */
interface WinLossByRepItem {
  repId: string;
  repName: string;
  won: number;
  lost: number;
  winRate: number;
  averageDealSize: number;
}

function analyzeWinLossByRep(wonDeals: DealRecord[], lostDeals: DealRecord[]): WinLossByRepItem[] {
  const repMap = new Map<string, { won: number; lost: number; totalValue: number; name: string }>();
  
  [...wonDeals, ...lostDeals].forEach(deal => {
    const repId = deal.assignedTo ?? deal.ownerId ?? 'unassigned';
    const repName = deal.assignedToName ?? deal.ownerName ?? 'Unassigned';
    const isWon = deal.status === 'won' || deal.stage === 'closed_won';
    const value = safeParseFloat(deal.value, 0);
    
    const existing = repMap.get(repId) ?? { won: 0, lost: 0, totalValue: 0, name: repName };
    repMap.set(repId, {
      won: existing.won + (isWon ? 1 : 0),
      lost: existing.lost + (isWon ? 0 : 1),
      totalValue: existing.totalValue + value,
      name: repName,
    });
  });
  
  return Array.from(repMap.entries()).map(([repId, data]) => ({
    repId,
    repName: data.name,
    won: data.won,
    lost: data.lost,
    winRate: (data.won + data.lost) > 0 ? (data.won / (data.won + data.lost)) * 100 : 0,
    averageDealSize: (data.won + data.lost) > 0 ? data.totalValue / (data.won + data.lost) : 0,
  }));
}

/** Win/loss trend item */
interface WinLossTrendItem {
  date: Date;
  won: number;
  lost: number;
  winRate: number;
}

async function calculateWinLossTrends(startDate: Date, endDate: Date): Promise<WinLossTrendItem[]> {
  const deals = await getDealsInPeriod(startDate, endDate);
  
  // Group by week
  const trends: WinLossTrendItem[] = [];
  const weekMap = new Map<string, { won: number; lost: number }>();
  
  deals.forEach(deal => {
    const closedDateVal = deal.closedDate;
    const closedDate = (closedDateVal && typeof closedDateVal === 'object' && 'toDate' in closedDateVal && closedDateVal.toDate)
      ? closedDateVal.toDate()
      : new Date(closedDateVal as string);
    const weekKey = getWeekKey(closedDate);
    const isWon = deal.status === 'won' || deal.stage === 'closed_won';
    
    const existing = weekMap.get(weekKey) ?? { won: 0, lost: 0 };
    weekMap.set(weekKey, {
      won: existing.won + (isWon ? 1 : 0),
      lost: existing.lost + (isWon ? 0 : 1),
    });
  });
  
  weekMap.forEach((data, weekKey) => {
    const total = data.won + data.lost;
    trends.push({
      date: new Date(weekKey),
      won: data.won,
      lost: data.lost,
      winRate: total > 0 ? (data.won / total) * 100 : 0,
    });
  });
  
  return trends.sort((a, b) => a.date.getTime() - b.date.getTime());
}

function getWeekKey(date: Date): string {
  const year = date.getFullYear();
  const week = getWeekNumber(date);
  return `${year}-W${week.toString().padStart(2, '0')}`;
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

