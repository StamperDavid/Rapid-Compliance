/**
 * E-Commerce Analytics Service
 * Analyzes e-commerce sales data
 */

import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { where, orderBy, Timestamp } from 'firebase/firestore';
import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

export interface EcommerceAnalytics {
  workspaceId: string;
  period: string;
  
  // Sales metrics
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  conversionRate: number;
  
  // Product metrics
  topProducts: Array<{
    productId: string;
    productName: string;
    revenue: number;
    units: number;
    orders: number;
  }>;
  
  // Customer metrics
  totalCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  averageOrdersPerCustomer: number;
  
  // Cart metrics
  cartAbandonmentRate: number;
  averageCartValue: number;
  
  // Trends
  revenueByDay: Array<{
    date: Date;
    revenue: number;
    orders: number;
  }>;
}

/**
 * Get e-commerce analytics
 */
export async function getEcommerceAnalytics(
  workspaceId: string,
  startDate: Date,
  endDate: Date
): Promise<EcommerceAnalytics> {
  // Get orders in period
  const orders = await FirestoreService.getAll(
    `${COLLECTIONS.ORGANIZATIONS}/${DEFAULT_ORG_ID}/workspaces/${workspaceId}/orders`,
    [
      where('createdAt', '>=', Timestamp.fromDate(startDate)),
      where('createdAt', '<=', Timestamp.fromDate(endDate)),
      where('status', '==', 'completed'),
      orderBy('createdAt', 'desc'),
    ]
  );
  
  // Get carts (for abandonment rate)
  const carts = await FirestoreService.getAll(
    `${COLLECTIONS.ORGANIZATIONS}/${DEFAULT_ORG_ID}/workspaces/${workspaceId}/carts`,
    [
      where('createdAt', '>=', Timestamp.fromDate(startDate)),
      where('createdAt', '<=', Timestamp.fromDate(endDate)),
    ]
  );
  
  // Calculate sales metrics
  const totalRevenue = orders.reduce((sum, o: OrderRecord) => sum + (parseFloat(String(o.total ?? '0')) || 0), 0);
  const totalOrders = orders.length;
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  
  // Calculate conversion rate (orders / carts)
  const totalCarts = carts.length;
  const conversionRate = totalCarts > 0 ? (totalOrders / totalCarts) * 100 : 0;
  
  // Calculate product metrics
  const topProducts = calculateTopProducts(orders);
  
  // Calculate customer metrics
  const customerMetrics = calculateCustomerMetrics(orders, startDate);
  
  // Calculate cart metrics
  const cartMetrics = calculateCartMetrics(carts, orders);
  
  // Calculate trends
  const revenueByDay = calculateRevenueByDay(orders, startDate, endDate);
  
  return {
    workspaceId,
    period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
    totalRevenue,
    totalOrders,
    averageOrderValue,
    conversionRate,
    topProducts,
    ...customerMetrics,
    ...cartMetrics,
    revenueByDay,
  };
}

/** Order item structure */
interface OrderItem {
  productId: string;
  productName?: string;
  quantity?: number;
  price?: string | number;
}

/** Order structure */
interface OrderRecord {
  items?: OrderItem[];
  total?: string | number;
  customerEmail?: string;
  createdAt?: { toDate?: () => Date } | Date | string;
}

/** Cart structure */
interface CartRecord {
  status?: string;
  total?: string | number;
  createdAt?: { toDate?: () => Date } | Date | string;
}

/** Top product result */
interface TopProductResult {
  productId: string;
  productName: string;
  revenue: number;
  units: number;
  orders: number;
}

/**
 * Calculate top products
 */
function calculateTopProducts(orders: OrderRecord[]): TopProductResult[] {
  const productMap = new Map<string, { revenue: number; units: number; orders: number; name: string }>();
  
  orders.forEach((order: OrderRecord) => {
    const items = order.items ?? [];
    items.forEach((item: OrderItem) => {
      const productId = item.productId;
      const productName =(item.productName !== '' && item.productName != null) ? item.productName : 'Unknown';
      const quantity = item.quantity ?? 1;
      const price = parseFloat(String(item.price ?? '0')) || 0;
      const revenue = quantity * price;
      
      const existing = productMap.get(productId) ?? { revenue: 0, units: 0, orders: 0, name: productName };
      productMap.set(productId, {
        revenue: existing.revenue + revenue,
        units: existing.units + quantity,
        orders: existing.orders + 1,
        name: productName,
      });
    });
  });
  
  return Array.from(productMap.entries())
    .map(([productId, data]) => ({
      productId,
      productName: data.name,
      revenue: data.revenue,
      units: data.units,
      orders: data.orders,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10); // Top 10
}

/** Customer metrics result */
interface CustomerMetricsResult {
  totalCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  averageOrdersPerCustomer: number;
}

/**
 * Calculate customer metrics
 */
function calculateCustomerMetrics(orders: OrderRecord[], startDate: Date): CustomerMetricsResult {
  const customerSet = new Set<string>();
  const newCustomerSet = new Set<string>();
  
  orders.forEach((order: OrderRecord) => {
    const email = order.customerEmail;
    if (email) {
      customerSet.add(email);

      // Check if this is their first order
      const createdAtValue = order.createdAt;
      const orderDate = createdAtValue && typeof createdAtValue === 'object' && 'toDate' in createdAtValue && typeof createdAtValue.toDate === 'function'
        ? createdAtValue.toDate()
        : new Date(createdAtValue as string | Date);
      if (orderDate >= startDate) {
        // Check if they had orders before this period
        // For simplicity, assume all orders in period are from new customers
        // In production, check historical orders
        newCustomerSet.add(email);
      }
    }
  });
  
  const totalCustomers = customerSet.size;
  const newCustomers = newCustomerSet.size;
  const returningCustomers = totalCustomers - newCustomers;
  const averageOrdersPerCustomer = totalCustomers > 0 ? orders.length / totalCustomers : 0;
  
  return {
    totalCustomers,
    newCustomers,
    returningCustomers,
    averageOrdersPerCustomer,
  };
}

/** Cart metrics result */
interface CartMetricsResult {
  cartAbandonmentRate: number;
  averageCartValue: number;
}

/**
 * Calculate cart metrics
 */
function calculateCartMetrics(carts: CartRecord[], _orders: OrderRecord[]): CartMetricsResult {
  const abandonedCarts = carts.filter((c: CartRecord) => c.status === 'abandoned' || c.status === 'active');

  const totalCarts = carts.length;
  const cartAbandonmentRate = totalCarts > 0 ? (abandonedCarts.length / totalCarts) * 100 : 0;

  const totalCartValue = carts.reduce((sum, c: CartRecord) => sum + (parseFloat(String(c.total ?? '0')) || 0), 0);
  const averageCartValue = totalCarts > 0 ? totalCartValue / totalCarts : 0;
  
  return {
    cartAbandonmentRate,
    averageCartValue,
  };
}

/** Revenue by day result */
interface RevenueByDayResult {
  date: Date;
  revenue: number;
  orders: number;
}

/**
 * Calculate revenue by day
 */
function calculateRevenueByDay(orders: OrderRecord[], _startDate: Date, _endDate: Date): RevenueByDayResult[] {
  const dayMap = new Map<string, { revenue: number; orders: number }>();

  orders.forEach((order: OrderRecord) => {
    const createdAtValue = order.createdAt;
    const createdAt = createdAtValue && typeof createdAtValue === 'object' && 'toDate' in createdAtValue && typeof createdAtValue.toDate === 'function'
      ? createdAtValue.toDate()
      : new Date(createdAtValue as string | Date);
    const dayKey = createdAt.toISOString().split('T')[0];
    const revenue = parseFloat(String(order.total ?? '0')) || 0;
    
    const existing = dayMap.get(dayKey) ?? { revenue: 0, orders: 0 };
    dayMap.set(dayKey, {
      revenue: existing.revenue + revenue,
      orders: existing.orders + 1,
    });
  });
  
  return Array.from(dayMap.entries())
    .map(([dateKey, data]) => ({
      date: new Date(dateKey),
      revenue: data.revenue,
      orders: data.orders,
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}






















