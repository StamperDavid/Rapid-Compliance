import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { PLATFORM_ID } from '@/lib/constants/platform';

export const dynamic = 'force-dynamic';

/**
 * Safely converts polymorphic date values (Firestore Timestamp, Date, string, number) to Date.
 * Falls back to current date if conversion fails.
 */
function toDate(value: unknown): Date {
  if (!value) {
    return new Date();
  }
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return isNaN(date.getTime()) ? new Date() : date;
  }
  return new Date();
}

/**
 * Safe parseFloat that handles NaN correctly.
 * parseFloat(undefined) returns NaN, and NaN ?? fallback returns NaN (not the fallback).
 * This function properly returns the fallback when the input cannot be parsed.
 */
function safeParseFloat(value: unknown, fallback: number): number {
  if (value === undefined || value === null) {
    return fallback;
  }
  const parsed = typeof value === 'number' ? value : parseFloat(String(value));
  return isNaN(parsed) ? fallback : parsed;
}

/**
 * GET /api/analytics/ecommerce - Get e-commerce analytics
 *
 * Query params:
 * - period: '7d' | '30d' | '90d' | 'all' (optional, default: '30d')
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/analytics/ecommerce');
    if (rateLimitResponse) {return rateLimitResponse;}

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const period =(searchParams.get('period') !== '' && searchParams.get('period') != null) ? searchParams.get('period') : '30d';

    // Calculate date range based on period
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
        startDate = new Date('2020-01-01');
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Order record from Firestore
    interface OrderRecord {
      createdAt?: { toDate?: () => Date } | Date | string;
      status?: string;
      total?: string | number;
      amount?: string | number;
      items?: Array<{ productName?: string; name?: string; price?: string | number; quantity?: number }>;
      products?: Array<{ productName?: string; name?: string; price?: string | number; quantity?: number }>;
    }
    
    // Cart record from Firestore
    interface CartRecord {
      createdAt?: { toDate?: () => Date } | Date | string;
      status?: string;
      convertedToOrder?: boolean;
    }
    
    // Get orders from Firestore
    const ordersPath = `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/orders`;
    let allOrders: OrderRecord[] = [];
    
    try {
      allOrders = await FirestoreService.getAll<OrderRecord>(ordersPath, []);
    } catch (_e) {
      logger.debug('No orders collection yet');
    }

    // Filter by date
    const ordersInPeriod = allOrders.filter(order => {
      const orderDate = toDate(order.createdAt);
      return orderDate >= startDate && orderDate <= now;
    });

    // Completed orders
    const completedOrders = ordersInPeriod.filter(order => 
      order.status === 'completed' || order.status === 'paid' || order.status === 'delivered'
    );

    // Cancelled/refunded orders
    const cancelledOrders = ordersInPeriod.filter(order => 
      order.status === 'cancelled' || order.status === 'refunded'
    );

    // Cart data (abandoned carts)
    const cartsPath = `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/carts`;
    let allCarts: CartRecord[] = [];
    
    try {
      allCarts = await FirestoreService.getAll<CartRecord>(cartsPath, []);
    } catch (_e) {
      logger.debug('No carts collection yet');
    }

    const abandonedCarts = allCarts.filter(cart => {
      const cartDate = toDate(cart.createdAt);
      const isRecent = cartDate >= startDate;
      const isAbandoned = cart.status === 'abandoned' ||
        (!cart.convertedToOrder && (now.getTime() - cartDate.getTime()) > 24 * 60 * 60 * 1000);
      return isRecent && isAbandoned;
    });

    // Calculate metrics
    const totalOrders = ordersInPeriod.length;
    const totalRevenue = completedOrders.reduce((sum, order) =>
      sum + (safeParseFloat(order.total, 0) || safeParseFloat(order.amount, 0)), 0);
    const avgOrderValue = completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0;

    // Conversion rate
    const totalCarts = allCarts.filter(cart => {
      const cartDate = toDate(cart.createdAt);
      return cartDate >= startDate;
    }).length;
    const conversionRate = totalCarts > 0 ? (completedOrders.length / totalCarts) * 100 : 0;

    // Cart abandonment rate
    const abandonmentRate = totalCarts > 0 ? (abandonedCarts.length / totalCarts) * 100 : 0;

    // Revenue by product
    interface OrderItem {
      productName?: string;
      name?: string;
      price?: string | number;
      quantity?: number;
    }
    
    const productMap = new Map<string, { revenue: number; quantity: number; orders: number }>();
    completedOrders.forEach(order => {
      const items: OrderItem[] = order.items ?? order.products ?? [];
      items.forEach((item) => {
        const productName = (item.productName !== '' && item.productName != null) ? item.productName : null;
        const itemName = (item.name !== '' && item.name != null) ? item.name : 'Unknown Product';
        const name = productName ?? itemName;
        const revenue = safeParseFloat(item.price, 0) * (item.quantity ?? 1);
        const existing = productMap.get(name) ?? { revenue: 0, quantity: 0, orders: 0 };
        productMap.set(name, {
          revenue: existing.revenue + revenue,
          quantity: existing.quantity + (item.quantity ?? 1),
          orders: existing.orders + 1,
        });
      });
    });

    const topProducts = Array.from(productMap.entries())
      .map(([product, data]) => ({
        product,
        revenue: data.revenue,
        quantity: data.quantity,
        orders: data.orders,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Orders by status
    const statusMap = new Map<string, number>();
    ordersInPeriod.forEach(order => {
      const status =(order.status !== '' && order.status != null) ? order.status : 'unknown';
      statusMap.set(status, (statusMap.get(status) ?? 0) + 1);
    });
    const byStatus = Array.from(statusMap.entries())
      .map(([status, count]) => ({ status, count }));

    // Daily trends (last 30 days max)
    const trendStartDate = period === 'all'
      ? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      : startDate;

    const dailyMap = new Map<string, { orders: number; revenue: number }>();
    completedOrders.forEach(order => {
      const orderDate = toDate(order.createdAt);
      if (orderDate >= trendStartDate) {
        const dateKey = orderDate.toISOString().split('T')[0];
        const revenue = safeParseFloat(order.total, 0) || safeParseFloat(order.amount, 0);
        const existing = dailyMap.get(dateKey) ?? { orders: 0, revenue: 0 };
        dailyMap.set(dateKey, {
          orders: existing.orders + 1,
          revenue: existing.revenue + revenue,
        });
      }
    });

    const dailyTrends = Array.from(dailyMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      success: true,
      analytics: {
        totalOrders,
        totalRevenue,
        avgOrderValue: Math.round(avgOrderValue * 100) / 100,
        conversionRate: Math.round(conversionRate * 10) / 10,
        abandonmentRate: Math.round(abandonmentRate * 10) / 10,
        completedOrders: completedOrders.length,
        cancelledOrders: cancelledOrders.length,
        abandonedCarts: abandonedCarts.length,
        topProducts,
        byStatus,
        dailyTrends,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error getting ecommerce analytics', error instanceof Error ? error : new Error(String(error)), { route: '/api/analytics/ecommerce' });
    return errors.database('Failed to get ecommerce analytics', error instanceof Error ? error : new Error(message));
  }
}
