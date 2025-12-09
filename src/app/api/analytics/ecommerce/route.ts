import { NextRequest, NextResponse } from 'next/server';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';

/**
 * GET /api/analytics/ecommerce - Get e-commerce analytics
 * 
 * Query params:
 * - orgId: organization ID (required)
 * - period: '7d' | '30d' | '90d' | 'all' (optional, default: '30d')
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');
    const period = searchParams.get('period') || '30d';

    if (!orgId) {
      return NextResponse.json(
        { success: false, error: 'orgId is required' },
        { status: 400 }
      );
    }

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

    // Get orders from Firestore
    const ordersPath = `${COLLECTIONS.ORGANIZATIONS}/${orgId}/orders`;
    let allOrders: any[] = [];
    
    try {
      allOrders = await FirestoreService.getAll(ordersPath, []);
    } catch (e) {
      console.log('No orders collection yet');
    }

    // Filter by date
    const ordersInPeriod = allOrders.filter(order => {
      const orderDate = order.createdAt?.toDate?.() || new Date(order.createdAt);
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
    const cartsPath = `${COLLECTIONS.ORGANIZATIONS}/${orgId}/carts`;
    let allCarts: any[] = [];
    
    try {
      allCarts = await FirestoreService.getAll(cartsPath, []);
    } catch (e) {
      console.log('No carts collection yet');
    }

    const abandonedCarts = allCarts.filter(cart => {
      const cartDate = cart.createdAt?.toDate?.() || new Date(cart.createdAt);
      const isRecent = cartDate >= startDate;
      const isAbandoned = cart.status === 'abandoned' || 
        (!cart.convertedToOrder && (now.getTime() - cartDate.getTime()) > 24 * 60 * 60 * 1000);
      return isRecent && isAbandoned;
    });

    // Calculate metrics
    const totalOrders = ordersInPeriod.length;
    const totalRevenue = completedOrders.reduce((sum, order) => 
      sum + (parseFloat(order.total) || parseFloat(order.amount) || 0), 0);
    const avgOrderValue = completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0;

    // Conversion rate
    const totalCarts = allCarts.filter(cart => {
      const cartDate = cart.createdAt?.toDate?.() || new Date(cart.createdAt);
      return cartDate >= startDate;
    }).length;
    const conversionRate = totalCarts > 0 ? (completedOrders.length / totalCarts) * 100 : 0;

    // Cart abandonment rate
    const abandonmentRate = totalCarts > 0 ? (abandonedCarts.length / totalCarts) * 100 : 0;

    // Revenue by product
    const productMap = new Map<string, { revenue: number; quantity: number; orders: number }>();
    completedOrders.forEach(order => {
      const items = order.items || order.products || [];
      items.forEach((item: any) => {
        const name = item.productName || item.name || 'Unknown Product';
        const revenue = (parseFloat(item.price) || 0) * (item.quantity || 1);
        const existing = productMap.get(name) || { revenue: 0, quantity: 0, orders: 0 };
        productMap.set(name, {
          revenue: existing.revenue + revenue,
          quantity: existing.quantity + (item.quantity || 1),
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
      const status = order.status || 'unknown';
      statusMap.set(status, (statusMap.get(status) || 0) + 1);
    });
    const byStatus = Array.from(statusMap.entries())
      .map(([status, count]) => ({ status, count }));

    // Daily trends (last 30 days max)
    const trendStartDate = period === 'all' 
      ? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      : startDate;
    
    const dailyMap = new Map<string, { orders: number; revenue: number }>();
    completedOrders.forEach(order => {
      const orderDate = order.createdAt?.toDate?.() || new Date(order.createdAt);
      if (orderDate >= trendStartDate) {
        const dateKey = orderDate.toISOString().split('T')[0];
        const revenue = parseFloat(order.total) || parseFloat(order.amount) || 0;
        const existing = dailyMap.get(dateKey) || { orders: 0, revenue: 0 };
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
  } catch (error: any) {
    console.error('Error getting ecommerce analytics:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get ecommerce analytics' },
      { status: 500 }
    );
  }
}
