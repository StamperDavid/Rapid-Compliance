'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';

interface OrderCustomer {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
}

interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  sku?: string;
  price: number;
  quantity: number;
  subtotal: number;
  total: number;
  image?: string;
}

interface OrderShipping {
  method: string;
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  cost: number;
}

type OrderStatus = 'pending' | 'processing' | 'on_hold' | 'completed' | 'cancelled' | 'refunded';
type FulfillmentStatus = 'unfulfilled' | 'partially_fulfilled' | 'fulfilled' | 'on_hold' | 'cancelled';

interface Order {
  id: string;
  orderNumber: string;
  customerEmail: string;
  customer: OrderCustomer;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  shipping: number;
  discount: number;
  total: number;
  status: OrderStatus;
  fulfillmentStatus: FulfillmentStatus;
  shippingInfo: OrderShipping;
  customerNotes?: string;
  internalNotes?: string;
  source: string;
  attributionSource?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

interface OrdersResponse {
  success: boolean;
  orders?: Order[];
  error?: string;
}

interface MutationResponse {
  success: boolean;
  error?: string;
}

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: 'bg-warning/20 text-warning border-warning/30',
  processing: 'bg-primary/20 text-primary border-primary/30',
  on_hold: 'bg-surface-elevated text-[var(--color-text-secondary)] border-border-light',
  completed: 'bg-success/20 text-success border-success/30',
  cancelled: 'bg-error/20 text-error border-error/30',
  refunded: 'bg-surface-elevated text-[var(--color-text-disabled)] border-border-light',
};

const FULFILLMENT_COLORS: Record<FulfillmentStatus, string> = {
  unfulfilled: 'bg-warning/10 text-warning',
  partially_fulfilled: 'bg-primary/10 text-primary',
  fulfilled: 'bg-success/10 text-success',
  on_hold: 'bg-surface-elevated text-[var(--color-text-disabled)]',
  cancelled: 'bg-error/10 text-error',
};

const ORDER_STATUSES: OrderStatus[] = ['pending', 'processing', 'on_hold', 'completed', 'cancelled', 'refunded'];
const FULFILLMENT_STATUSES: FulfillmentStatus[] = ['unfulfilled', 'partially_fulfilled', 'fulfilled', 'on_hold', 'cancelled'];

export default function OrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | OrderStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterStatus !== 'all') {
        params.set('status', filterStatus);
      }
      const url = `/api/ecommerce/orders${params.toString() ? `?${params}` : ''}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = (await res.json()) as OrdersResponse;
        if (data.success && data.orders) {
          setOrders(data.orders);
        }
      }
    } catch {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, toast]);

  useEffect(() => {
    // Wait for Firebase auth to restore session before making API calls
    if (authLoading) { return; }
    if (user) {
      void loadOrders();
    }
  }, [user, authLoading, loadOrders]);

  const handleStatusUpdate = async (orderId: string, newStatus: OrderStatus) => {
    try {
      const res = await fetch(`/api/ecommerce/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = (await res.json()) as MutationResponse;
      if (data.success) {
        toast.success(`Order status updated to ${newStatus}`);
        await loadOrders();
        if (selectedOrder?.id === orderId) {
          setSelectedOrder((prev) => prev ? { ...prev, status: newStatus } : null);
        }
      } else {
        toast.error(data.error ?? 'Failed to update');
      }
    } catch {
      toast.error('Failed to update order status');
    }
  };

  const handleFulfillmentUpdate = async (orderId: string, newStatus: FulfillmentStatus) => {
    try {
      const res = await fetch(`/api/ecommerce/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fulfillmentStatus: newStatus }),
      });
      const data = (await res.json()) as MutationResponse;
      if (data.success) {
        toast.success(`Fulfillment updated to ${newStatus.replace('_', ' ')}`);
        await loadOrders();
        if (selectedOrder?.id === orderId) {
          setSelectedOrder((prev) => prev ? { ...prev, fulfillmentStatus: newStatus } : null);
        }
      } else {
        toast.error(data.error ?? 'Failed to update');
      }
    } catch {
      toast.error('Failed to update fulfillment status');
    }
  };

  const exportToCSV = () => {
    if (filteredOrders.length === 0) {
      toast.error('No orders to export');
      return;
    }

    const headers = ['Order #', 'Customer', 'Email', 'Status', 'Fulfillment', 'Subtotal', 'Tax', 'Shipping', 'Discount', 'Total', 'Source', 'Date'];
    const rows = filteredOrders.map((o) => [
      o.orderNumber,
      `${o.customer.firstName} ${o.customer.lastName}`,
      o.customerEmail,
      o.status,
      o.fulfillmentStatus,
      o.subtotal.toFixed(2),
      o.tax.toFixed(2),
      o.shipping.toFixed(2),
      o.discount.toFixed(2),
      o.total.toFixed(2),
      o.utmSource ?? o.attributionSource ?? '',
      o.createdAt,
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredOrders.length} orders`);
  };

  const filteredOrders = orders.filter((order) => {
    if (!searchQuery) {
      return true;
    }
    const q = searchQuery.toLowerCase();
    return (
      order.orderNumber.toLowerCase().includes(q) ||
      order.customerEmail.toLowerCase().includes(q) ||
      order.customer.firstName.toLowerCase().includes(q) ||
      order.customer.lastName.toLowerCase().includes(q)
    );
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const getStatusLabel = (status: string) => status.replace('_', ' ');

  return (
    <div className="min-h-screen bg-surface-main p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">Orders</h1>
            <p className="text-[var(--color-text-secondary)] text-sm">
              Manage and track customer orders
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-[var(--color-text-secondary)]">
              {orders.length} total order{orders.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={exportToCSV}
              disabled={orders.length === 0}
              className="px-3 py-1.5 text-xs font-medium bg-surface-paper border border-border-light rounded-lg hover:bg-surface-elevated disabled:opacity-50 disabled:cursor-not-allowed text-[var(--color-text-primary)]"
            >
              Export CSV
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-3 mb-6">
          <input
            type="text"
            placeholder="Search by order #, customer name, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-4 py-2.5 bg-surface-paper border border-border-light rounded-xl text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
            className="px-4 py-2.5 bg-surface-paper border border-border-light rounded-xl text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">All Statuses</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s} className="capitalize">{getStatusLabel(s)}</option>
            ))}
          </select>
        </div>

        {/* Orders Table */}
        {loading ? (
          <div className="text-center py-12 text-[var(--color-text-secondary)]">Loading orders...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="rounded-2xl bg-surface-paper border border-border-light p-12 text-center">
            <div className="text-4xl mb-3">📦</div>
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">No Orders Found</h3>
            <p className="text-[var(--color-text-secondary)] text-sm">
              {searchQuery || filterStatus !== 'all'
                ? 'Try adjusting your filters.'
                : 'Orders will appear here when customers make purchases.'}
            </p>
          </div>
        ) : (
          <div className="rounded-2xl bg-surface-paper border border-border-light overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border-light">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Order</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Customer</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Status</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Fulfillment</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Total</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Source</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Date</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  {filteredOrders.map((order) => (
                    <tr
                      key={order.id}
                      className="hover:bg-surface-elevated/50 transition-colors cursor-pointer"
                      onClick={() => setSelectedOrder(order)}
                    >
                      <td className="px-5 py-4">
                        <span className="text-sm font-semibold text-primary">{order.orderNumber}</span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-sm font-medium text-[var(--color-text-primary)]">
                          {order.customer.firstName} {order.customer.lastName}
                        </div>
                        <div className="text-xs text-[var(--color-text-secondary)]">{order.customerEmail}</div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${STATUS_COLORS[order.status]}`}>
                          {getStatusLabel(order.status)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${FULFILLMENT_COLORS[order.fulfillmentStatus]}`}>
                          {getStatusLabel(order.fulfillmentStatus)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className="text-sm font-bold text-[var(--color-text-primary)]">{formatCurrency(order.total)}</span>
                      </td>
                      <td className="px-5 py-4">
                        {(() => {
                          const src = order.utmSource ?? order.attributionSource ?? '';
                          return src ? (
                            <span className="inline-block px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-primary/10 border border-primary/20 text-primary">
                              {src}
                            </span>
                          ) : (
                            <span className="text-xs text-[var(--color-text-disabled)]">-</span>
                          );
                        })()}
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-xs text-[var(--color-text-secondary)]">{formatDate(order.createdAt)}</span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedOrder(order); }}
                          className="text-xs text-primary hover:underline"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Order Detail Drawer */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-end z-50">
          <div
            className="absolute inset-0"
            onClick={() => setSelectedOrder(null)}
          />
          <div className="relative bg-surface-paper w-full max-w-lg h-full overflow-y-auto border-l border-border-light">
            {/* Drawer Header */}
            <div className="sticky top-0 bg-surface-paper z-10 px-6 py-4 border-b border-border-light flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-[var(--color-text-primary)]">{selectedOrder.orderNumber}</h2>
                <p className="text-xs text-[var(--color-text-secondary)]">{formatDate(selectedOrder.createdAt)}</p>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-2 hover:bg-surface-elevated rounded-lg text-[var(--color-text-secondary)]"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Status Management */}
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">Order Status</h3>
                <div className="flex flex-wrap gap-1.5">
                  {ORDER_STATUSES.map((s) => (
                    <button
                      key={s}
                      onClick={() => void handleStatusUpdate(selectedOrder.id, s)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all ${
                        selectedOrder.status === s
                          ? STATUS_COLORS[s]
                          : 'bg-surface-elevated text-[var(--color-text-disabled)] border-border-light hover:bg-surface-main'
                      }`}
                    >
                      {getStatusLabel(s)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Fulfillment Status */}
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">Fulfillment Status</h3>
                <div className="flex flex-wrap gap-1.5">
                  {FULFILLMENT_STATUSES.map((s) => (
                    <button
                      key={s}
                      onClick={() => void handleFulfillmentUpdate(selectedOrder.id, s)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all ${
                        selectedOrder.fulfillmentStatus === s
                          ? `${FULFILLMENT_COLORS[s]} border-current`
                          : 'bg-surface-elevated text-[var(--color-text-disabled)] border-border-light hover:bg-surface-main'
                      }`}
                    >
                      {getStatusLabel(s)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Customer Info */}
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">Customer</h3>
                <div className="bg-surface-elevated rounded-xl p-3 text-sm">
                  <div className="font-medium text-[var(--color-text-primary)]">
                    {selectedOrder.customer.firstName} {selectedOrder.customer.lastName}
                  </div>
                  <div className="text-[var(--color-text-secondary)] text-xs">{selectedOrder.customerEmail}</div>
                  {selectedOrder.customer.phone && (
                    <div className="text-[var(--color-text-secondary)] text-xs">{selectedOrder.customer.phone}</div>
                  )}
                </div>
              </div>

              {/* Order Items */}
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">
                  Items ({selectedOrder.items.length})
                </h3>
                <div className="space-y-2">
                  {selectedOrder.items.map((item) => (
                    <div key={item.id} className="bg-surface-elevated rounded-xl p-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-[var(--color-text-primary)] truncate">{item.productName}</div>
                        <div className="text-xs text-[var(--color-text-secondary)]">
                          {formatCurrency(item.price)} x {item.quantity}
                          {item.sku && <span className="ml-2">SKU: {item.sku}</span>}
                        </div>
                      </div>
                      <div className="text-sm font-bold text-[var(--color-text-primary)]">{formatCurrency(item.total)}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Order Summary */}
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">Summary</h3>
                <div className="bg-surface-elevated rounded-xl p-3 space-y-1.5 text-sm">
                  <div className="flex justify-between text-[var(--color-text-secondary)]">
                    <span>Subtotal</span>
                    <span>{formatCurrency(selectedOrder.subtotal)}</span>
                  </div>
                  {selectedOrder.discount > 0 && (
                    <div className="flex justify-between text-success">
                      <span>Discount</span>
                      <span>-{formatCurrency(selectedOrder.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-[var(--color-text-secondary)]">
                    <span>Shipping</span>
                    <span>{formatCurrency(selectedOrder.shipping)}</span>
                  </div>
                  <div className="flex justify-between text-[var(--color-text-secondary)]">
                    <span>Tax</span>
                    <span>{formatCurrency(selectedOrder.tax)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-[var(--color-text-primary)] pt-2 border-t border-border-light">
                    <span>Total</span>
                    <span>{formatCurrency(selectedOrder.total)}</span>
                  </div>
                </div>
              </div>

              {/* Shipping Info */}
              {selectedOrder.shippingInfo && (
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">Shipping</h3>
                  <div className="bg-surface-elevated rounded-xl p-3 text-sm space-y-1">
                    <div className="text-[var(--color-text-primary)]">{selectedOrder.shippingInfo.method}</div>
                    {selectedOrder.shippingInfo.carrier && (
                      <div className="text-xs text-[var(--color-text-secondary)]">Carrier: {selectedOrder.shippingInfo.carrier}</div>
                    )}
                    {selectedOrder.shippingInfo.trackingNumber && (
                      <div className="text-xs text-primary">Tracking: {selectedOrder.shippingInfo.trackingNumber}</div>
                    )}
                  </div>
                </div>
              )}

              {/* Notes */}
              {(selectedOrder.customerNotes ?? selectedOrder.internalNotes) && (
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">Notes</h3>
                  <div className="space-y-2">
                    {selectedOrder.customerNotes && (
                      <div className="bg-surface-elevated rounded-xl p-3">
                        <div className="text-[10px] font-bold text-[var(--color-text-disabled)] uppercase mb-1">Customer Note</div>
                        <div className="text-sm text-[var(--color-text-secondary)]">{selectedOrder.customerNotes}</div>
                      </div>
                    )}
                    {selectedOrder.internalNotes && (
                      <div className="bg-surface-elevated rounded-xl p-3">
                        <div className="text-[10px] font-bold text-[var(--color-text-disabled)] uppercase mb-1">Internal Note</div>
                        <div className="text-sm text-[var(--color-text-secondary)]">{selectedOrder.internalNotes}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tags */}
              {selectedOrder.tags && selectedOrder.tags.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">Tags</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedOrder.tags.map((tag) => (
                      <span key={tag} className="px-2 py-0.5 bg-surface-elevated border border-border-light rounded text-xs text-[var(--color-text-secondary)]">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Source */}
              <div className="text-[10px] text-[var(--color-text-disabled)] pt-2 border-t border-border-light">
                Source: {selectedOrder.source} &middot; ID: {selectedOrder.id}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
