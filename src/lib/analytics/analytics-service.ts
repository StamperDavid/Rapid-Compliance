/**
 * Analytics Service
 * Aggregates and calculates analytics from all platform data
 */

import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { where, orderBy, limit, Timestamp } from 'firebase/firestore';
import type {
  RevenueReport,
  PipelineReport,
  SalesForecast,
  WinLossAnalysis,
} from '@/types/analytics';

/**
 * Get revenue report
 */
export async function getRevenueReport(
  organizationId: string,
  workspaceId: string,
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly',
  startDate: Date,
  endDate: Date
): Promise<RevenueReport> {
  // Get all deals/orders in period
  const deals = await getDealsInPeriod(workspaceId, organizationId, startDate, endDate);
  const orders = await getOrdersInPeriod(workspaceId, organizationId, startDate, endDate);
  
  // Calculate totals
  const totalRevenue = calculateTotalRevenue(deals, orders);
  const totalDeals = deals.length + orders.length;
  const averageDealSize = totalDeals > 0 ? totalRevenue / totalDeals : 0;
  
  // Calculate breakdowns
  const revenueBySource = calculateRevenueBySource(deals, orders);
  const revenueByProduct = await calculateRevenueByProduct(workspaceId, deals, orders);
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
  organizationId: string,
  workspaceId: string,
  period: string
): Promise<PipelineReport> {
  // Get all open deals
  const openDeals = await getOpenDeals(workspaceId, organizationId);
  
  // Calculate pipeline metrics
  const totalValue = openDeals.reduce((sum, deal) => sum + (deal.value ?? 0), 0);
  const totalDeals = openDeals.length;
  const averageDealSize = totalDeals > 0 ? totalValue / totalDeals : 0;
  
  // Group by stage
  const byStage = calculatePipelineByStage(openDeals);
  
  // Calculate velocity
  const velocity = await calculatePipelineVelocity(workspaceId, organizationId);
  
  // Calculate conversion rates
  const conversionRates = await calculateConversionRates(workspaceId, organizationId);
  
  // Calculate trends
  const trends = await calculatePipelineTrends(workspaceId, organizationId, period);
  
  return {
    period,
    totalValue,
    totalDeals,
    averageDealSize,
    byStage,
    velocity,
    conversionRates,
    trends,
  };
}

/**
 * Get sales forecast
 */
export async function getSalesForecast(
  organizationId: string,
  workspaceId: string,
  period: 'month' | 'quarter' | 'year'
): Promise<SalesForecast> {
  // Get open deals
  const openDeals = await getOpenDeals(workspaceId, organizationId);
  
  // Calculate weighted forecast
  const forecastedRevenue = calculateWeightedForecast(openDeals);
  const confidence = calculateForecastConfidence(openDeals);
  
  // Generate scenarios
  const scenarios = generateForecastScenarios(openDeals, forecastedRevenue);
  
  // Breakdown by rep and product
  const byRep = calculateForecastByRep(openDeals);
  const byProduct = await calculateForecastByProduct(workspaceId, openDeals);
  
  // Identify factors
  const factors = identifyForecastFactors(openDeals);
  
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
  organizationId: string,
  workspaceId: string,
  period: string,
  startDate: Date,
  endDate: Date
): Promise<WinLossAnalysis> {
  // Get won and lost deals
  const deals = await getDealsInPeriod(workspaceId, organizationId, startDate, endDate);
  const won = deals.filter(d => d.status === 'won' || d.stage === 'closed_won');
  const lost = deals.filter(d => d.status === 'lost' || d.stage === 'closed_lost');
  
  const totalDeals = deals.length;
  const winRate = totalDeals > 0 ? (won.length / totalDeals) * 100 : 0;
  
  // Calculate averages
  const averageDealSize = {
    won: won.length > 0 ? won.reduce((sum, d) => sum + (d.value ?? 0), 0) / won.length : 0,
    lost: lost.length > 0 ? lost.reduce((sum, d) => sum + (d.value ?? 0), 0) / lost.length : 0,
    total: totalDeals > 0 ? deals.reduce((sum, d) => sum + (d.value ?? 0), 0) / totalDeals : 0,
  };
  
  // Analyze loss reasons
  const lossReasons = analyzeLossReasons(lost);
  
  // Analyze win factors
  const winFactors = analyzeWinFactors(won);
  
  // Competitor analysis
  const byCompetitor = analyzeCompetitors(won, lost);
  
  // By sales rep
  const bySalesRep = analyzeWinLossByRep(won, lost);
  
  // Trends
  const trends = await calculateWinLossTrends(workspaceId, organizationId, startDate, endDate);
  
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

// Helper functions

async function getDealsInPeriod(workspaceId: string, organizationId: string, startDate: Date, endDate: Date): Promise<any[]> {
  // Get deals from CRM
  const deals = await FirestoreService.getAll(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/workspaces/${workspaceId}/entities/deals/records`,
    [
      where('closedDate', '>=', Timestamp.fromDate(startDate)),
      where('closedDate', '<=', Timestamp.fromDate(endDate)),
    ]
  );
  
  return deals;
}

async function getOrdersInPeriod(workspaceId: string, organizationId: string, startDate: Date, endDate: Date): Promise<any[]> {
  const orders = await FirestoreService.getAll(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/workspaces/${workspaceId}/orders`,
    [
      where('createdAt', '>=', Timestamp.fromDate(startDate)),
      where('createdAt', '<=', Timestamp.fromDate(endDate)),
      where('status', '==', 'completed'),
    ]
  );
  
  return orders;
}

function calculateTotalRevenue(deals: any[], orders: any[]): number {
  const dealRevenue = deals
    .filter(d => d.status === 'won' || d.stage === 'closed_won')
    .reduce((sum, d) => sum + (parseFloat(d.value) ?? 0), 0);
  
  const orderRevenue = orders.reduce((sum, o) => sum + (parseFloat(o.total) ?? 0), 0);
  
  return dealRevenue + orderRevenue;
}

function calculateRevenueBySource(deals: any[], orders: any[]): any[] {
  const sourceMap = new Map<string, { revenue: number; deals: number }>();
  
  // From deals
  deals.forEach(deal => {
    const source = deal.source ?? 'unknown';
    const value = parseFloat(deal.value) ?? 0;
    const existing = sourceMap.get(source) ?? { revenue: 0, deals: 0 };
    sourceMap.set(source, {
      revenue: existing.revenue + value,
      deals: existing.deals + 1,
    });
  });
  
  // From orders
  orders.forEach(order => {
    const source = order.source ?? 'ecommerce';
    const total = parseFloat(order.total) ?? 0;
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

async function calculateRevenueByProduct(workspaceId: string, deals: any[], orders: any[]): Promise<any[]> {
  const productMap = new Map<string, { revenue: number; units: number; name: string }>();
  
  // From deals (line items)
  deals.forEach(deal => {
    if (deal.products && Array.isArray(deal.products)) {
      deal.products.forEach((product: any) => {
        const productId = product.productId ?? product.id;
        const productName = product.name ?? 'Unknown';
        const quantity = product.quantity ?? 1;
        const price = parseFloat(product.price) ?? 0;
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
      order.items.forEach((item: any) => {
        const productId = item.productId;
        const productName = item.productName ?? 'Unknown';
        const quantity = item.quantity ?? 1;
        const price = parseFloat(item.price) ?? 0;
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

function calculateRevenueBySalesRep(deals: any[]): any[] {
  const repMap = new Map<string, { revenue: number; deals: number; name: string }>();
  
  deals.forEach(deal => {
    const repId = deal.assignedTo ?? deal.ownerId ?? 'unassigned';
    const repName = deal.assignedToName ?? deal.ownerName ?? 'Unassigned';
    const value = parseFloat(deal.value) ?? 0;
    
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
  deals: any[],
  orders: any[],
  period: string,
  startDate: Date,
  endDate: Date
): any[] {
  const trends: any[] = [];
  const interval = getIntervalForPeriod(period);
  
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    const periodStart = new Date(currentDate);
    const periodEnd = new Date(currentDate);
    periodEnd.setDate(periodEnd.getDate() + interval - 1);
    
    const periodDeals = deals.filter(d => {
      const closedDate = d.closedDate?.toDate?.() ?? new Date(d.closedDate);
      return closedDate >= periodStart && closedDate <= periodEnd;
    });
    
    const periodOrders = orders.filter(o => {
      const createdAt = o.createdAt?.toDate?.() ?? new Date(o.createdAt);
      return createdAt >= periodStart && createdAt <= periodEnd;
    });
    
    const revenue = calculateTotalRevenue(periodDeals, periodOrders);
    const totalDeals = periodDeals.length + periodOrders.length;
    const averageDealSize = totalDeals > 0 ? revenue / totalDeals : 0;
    
    trends.push({
      date: new Date(periodStart),
      revenue,
      deals: totalDeals,
      averageDealSize,
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

async function getOpenDeals(workspaceId: string, organizationId: string): Promise<any[]> {
  const deals = await FirestoreService.getAll(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/workspaces/${workspaceId}/entities/deals/records`,
    [
      where('status', 'in', ['open', 'qualified', 'proposal', 'negotiation']),
    ]
  );
  
  return deals;
}

function calculatePipelineByStage(deals: any[]): any[] {
  const stageMap = new Map<string, { value: number; deals: number; name: string; days: number[] }>();
  
  deals.forEach(deal => {
    const stage = deal.stage ?? 'unknown';
    const stageName = deal.stageName ?? stage;
    const value = parseFloat(deal.value) ?? 0;
    const daysInStage = calculateDaysInStage(deal, stage);
    
    const existing = stageMap.get(stage) ?? { value: 0, deals: 0, name: stageName, days: [] };
    stageMap.set(stage, {
      value: existing.value + value,
      deals: existing.deals + 1,
      name: stageName,
      days: [...existing.days, daysInStage],
    });
  });
  
  return Array.from(stageMap.entries()).map(([stageId, data]) => ({
    stageId,
    stageName: data.name,
    value: data.value,
    deals: data.deals,
    averageDealSize: data.deals > 0 ? data.value / data.deals : 0,
    averageDaysInStage: data.days.length > 0
      ? data.days.reduce((sum, d) => sum + d, 0) / data.days.length
      : 0,
  }));
}

function calculateDaysInStage(deal: any, stage: string): number {
  const stageHistory = deal.stageHistory ?? [];
  const stageEntry = stageHistory.find((h: any) => h.stage === stage);
  
  if (stageEntry?.enteredAt) {
    const entered = stageEntry.enteredAt.toDate?.() ?? new Date(stageEntry.enteredAt);
    const now = new Date();
    return Math.floor((now.getTime() - entered.getTime()) / (1000 * 60 * 60 * 24));
  }
  
  return 0;
}

async function calculatePipelineVelocity(workspaceId: string, organizationId: string): Promise<any> {
  // Get closed deals from last 90 days
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  
  const closedDeals = await FirestoreService.getAll(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/workspaces/${workspaceId}/entities/deals/records`,
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
    const created = deal.createdAt?.toDate?.() ?? new Date(deal.createdAt);
    const closed = deal.closedDate?.toDate?.() ?? new Date(deal.closedDate);
    return Math.floor((closed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
  });
  
  const averageSalesCycle = salesCycles.reduce((sum, d) => sum + d, 0) / salesCycles.length;
  
  // Calculate average time to close (from qualified to closed)
  const timeToClose = closedDeals
    .filter(deal => deal.qualifiedDate)
    .map(deal => {
      const qualified = deal.qualifiedDate.toDate?.() ?? new Date(deal.qualifiedDate);
      const closed = deal.closedDate?.toDate?.() ?? new Date(deal.closedDate);
      return Math.floor((closed.getTime() - qualified.getTime()) / (1000 * 60 * 60 * 24));
    });
  
  const averageTimeToClose = timeToClose.length > 0
    ? timeToClose.reduce((sum, d) => sum + d, 0) / timeToClose.length
    : averageSalesCycle;
  
  // Calculate average time per stage
  const stageTimes: Record<string, number[]> = {};
  closedDeals.forEach(deal => {
    const history = deal.stageHistory ?? [];
    history.forEach((entry: any) => {
      if (entry.exitedAt && entry.enteredAt) {
        const entered = entry.enteredAt.toDate?.() ?? new Date(entry.enteredAt);
        const exited = entry.exitedAt.toDate?.() ?? new Date(entry.exitedAt);
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

async function calculateConversionRates(workspaceId: string, organizationId: string): Promise<any[]> {
  // Get all deals with stage history
  const deals = await FirestoreService.getAll(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/workspaces/${workspaceId}/entities/deals/records`,
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
  const rates: any[] = [];
  transitions.forEach((transition, key) => {
    // Count deals in "from" stage
    const fromStageCount = deals.filter(d => d.stage === transition.from).length;
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

async function calculatePipelineTrends(workspaceId: string, organizationId: string, period: string): Promise<any[]> {
  // Get deals over time
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const deals = await FirestoreService.getAll(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/workspaces/${workspaceId}/entities/deals/records`,
    [
      where('createdAt', '>=', Timestamp.fromDate(thirtyDaysAgo)),
    ]
  );
  
  // Group by date and stage
  const trends: any[] = [];
  const dateMap = new Map<string, { value: number; deals: number; byStage: Map<string, { value: number; count: number }> }>();
  
  deals.forEach(deal => {
    const date = new Date(deal.createdAt?.toDate?.() ?? deal.createdAt);
    const dateKey = date.toISOString().split('T')[0];
    const value = parseFloat(deal.value) ?? 0;
    const stage = deal.stage ?? 'unknown';
    
    const existing = dateMap.get(dateKey) ?? { value: 0, deals: 0, byStage: new Map() };
    const stageData = existing.byStage.get(stage) ?? { value: 0, count: 0 };
    
    existing.byStage.set(stage, {
      value: stageData.value + value,
      count: stageData.count + 1,
    });
    
    dateMap.set(dateKey, {
      value: existing.value + value,
      deals: existing.deals + 1,
      byStage: existing.byStage,
    });
  });
  
  dateMap.forEach((data, dateKey) => {
    // Convert byStage Map to object
    const byStage: Record<string, { value: number; count: number }> = {};
    data.byStage.forEach((stageData, stage) => {
      byStage[stage] = stageData;
    });
    
    trends.push({
      date: new Date(dateKey),
      totalValue: data.value,
      totalDeals: data.deals,
      byStage,
    });
  });
  
  return trends.sort((a, b) => a.date.getTime() - b.date.getTime());
}

function calculateWeightedForecast(deals: any[]): number {
  return deals.reduce((sum, deal) => {
    const value = parseFloat(deal.value) ?? 0;
    const probability = parseFloat(deal.probability) ?? 50; // Default 50%
    return sum + (value * probability / 100);
}, 0);
}

function calculateForecastConfidence(deals: any[]): number {
  if (deals.length === 0) {return 0;}
  
  // Confidence based on:
  // - Number of deals
  // - Average probability
  // - Recency of updates
  
  const avgProbability = deals.reduce((sum, d) => sum + (parseFloat(d.probability) ?? 50), 0) / deals.length;
  const dealCountFactor = Math.min(deals.length / 20, 1); // Max confidence at 20+ deals
  const recencyFactor = 1; // TODO: Factor in how recently deals were updated
  
  return Math.round((avgProbability * 0.6 + dealCountFactor * 100 * 0.4) * recencyFactor);
}

function generateForecastScenarios(deals: any[], baseForecast: number): any[] {
  return [
    {
      name: 'best_case',
      revenue: baseForecast * 1.2,
      probability: 20,
      description: 'All deals close at high probability',
    },
    {
      name: 'likely',
      revenue: baseForecast,
      probability: 60,
      description: 'Deals close at current probability',
    },
    {
      name: 'worst_case',
      revenue: baseForecast * 0.7,
      probability: 20,
      description: 'Some deals slip or reduce probability',
    },
  ];
}

function calculateForecastByRep(deals: any[]): any[] {
  const repMap = new Map<string, { forecast: number; deals: number; name: string; weighted: number }>();
  
  deals.forEach(deal => {
    const repId = deal.assignedTo ?? deal.ownerId ?? 'unassigned';
    const repName = deal.assignedToName ?? deal.ownerName ?? 'Unassigned';
    const value = parseFloat(deal.value) ?? 0;
    const probability = parseFloat(deal.probability) ?? 50;
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

async function calculateForecastByProduct(workspaceId: string, deals: any[]): Promise<any[]> {
  const productMap = new Map<string, { forecast: number; units: number; name: string }>();
  
  deals.forEach(deal => {
    if (deal.products && Array.isArray(deal.products)) {
      deal.products.forEach((product: any) => {
        const productId = product.productId ?? product.id;
        const productName = product.name ?? 'Unknown';
        const quantity = product.quantity ?? 1;
        const price = parseFloat(product.price) ?? 0;
        const probability = parseFloat(deal.probability) ?? 50;
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

function identifyForecastFactors(deals: any[]): any[] {
  const factors: any[] = [];
  
  // Check for large deals
  const largeDeals = deals.filter(d => parseFloat(d.value) > 10000);
  if (largeDeals.length > 0) {
    factors.push({
      factor: 'Large deals in pipeline',
      impact: 'positive',
      description: `${largeDeals.length} deals over $10k`,
      weight: 0.3,
    });
  }
  
  // Check for high probability deals
  const highProbDeals = deals.filter(d => parseFloat(d.probability) >= 75);
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
    const lastUpdate = d.updatedAt?.toDate?.() ?? new Date(d.updatedAt);
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

function analyzeLossReasons(lostDeals: any[]): any[] {
  const reasonMap = new Map<string, { count: number; totalValue: number }>();
  
  lostDeals.forEach(deal => {
    const reason = deal.lostReason ?? deal.reason ?? 'No reason provided';
    const value = parseFloat(deal.value) ?? 0;
    
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

function analyzeWinFactors(wonDeals: any[]): any[] {
  const factorMap = new Map<string, { count: number; totalValue: number }>();
  
  wonDeals.forEach(deal => {
    const value = parseFloat(deal.value) ?? 0;
    
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

function analyzeCompetitors(wonDeals: any[], lostDeals: any[]): any[] {
  const competitorMap = new Map<string, { wins: number; losses: number; totalValue: number; reasons: Map<string, number> }>();
  
  // From lost deals
  lostDeals.forEach(deal => {
    const competitor = deal.lostToCompetitor ?? deal.competitor;
    if (competitor) {
      const existing = competitorMap.get(competitor) ?? { wins: 0, losses: 0, totalValue: 0, reasons: new Map() };
      
      // Extract loss reason
      const reason = deal.lostReason ?? deal.lossReason ?? 'Unknown';
      existing.reasons.set(reason, (existing.reasons.get(reason) ?? 0) + 1);
      
      competitorMap.set(competitor, {
        ...existing,
        losses: existing.losses + 1,
        totalValue: existing.totalValue + (parseFloat(deal.value) ?? 0),
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

function analyzeWinLossByRep(wonDeals: any[], lostDeals: any[]): any[] {
  const repMap = new Map<string, { won: number; lost: number; totalValue: number; name: string }>();
  
  [...wonDeals, ...lostDeals].forEach(deal => {
    const repId = deal.assignedTo ?? deal.ownerId ?? 'unassigned';
    const repName = deal.assignedToName ?? deal.ownerName ?? 'Unassigned';
    const isWon = deal.status === 'won' || deal.stage === 'closed_won';
    const value = parseFloat(deal.value) ?? 0;
    
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

async function calculateWinLossTrends(workspaceId: string, organizationId: string, startDate: Date, endDate: Date): Promise<any[]> {
  const deals = await getDealsInPeriod(workspaceId, organizationId, startDate, endDate);
  
  // Group by week
  const trends: any[] = [];
  const weekMap = new Map<string, { won: number; lost: number }>();
  
  deals.forEach(deal => {
    const closedDate = deal.closedDate?.toDate?.() ?? new Date(deal.closedDate);
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

