'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import SubpageNav from '@/components/ui/SubpageNav';
import { DEALS_TABS } from '@/lib/constants/subpage-nav';
import { useAuth } from '@/hooks/useAuth';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import { PageTitle, SectionDescription } from '@/components/ui/typography';
import {
  ShoppingCart,
  Eye,
  AlertCircle,
  DollarSign,
} from 'lucide-react';

interface Order {
  id: string;
  orderNumber?: string;
  customerEmail?: string;
  total?: number;
  status?: string;
  createdAt?: string;
  items?: { name?: string }[];
}

const STATUS_BADGES: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  confirmed: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  processing: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  shipped: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  delivered: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  cancelled: 'bg-red-500/10 text-red-400 border-red-500/20',
  refunded: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
};

export default function DealsOrdersPage() {
  const router = useRouter();
  const { loading: authLoading } = useAuth();
  const authFetch = useAuthFetch();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const response = await authFetch('/api/ecommerce/orders?limit=100');
      if (!response.ok) { throw new Error('Failed to fetch orders'); }
      const result = await response.json() as { orders?: Order[]; data?: Order[] };
      setOrders(result.orders ?? result.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (authLoading) { return; }
    void fetchOrders();
  }, [fetchOrders, authLoading]);

  const columns: ColumnDef<Order>[] = useMemo(() => [
    {
      key: 'orderNumber',
      header: 'Order #',
      accessor: (o) => o.orderNumber ?? o.id,
      render: (o) => <span className="font-mono text-sm text-foreground">{o.orderNumber ?? o.id.slice(0, 12)}</span>,
    },
    {
      key: 'customer',
      header: 'Customer',
      accessor: (o) => o.customerEmail ?? '',
      render: (o) => <span className="text-muted-foreground text-sm">{o.customerEmail ?? '-'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (o) => o.status ?? 'pending',
      render: (o) => {
        const status = o.status ?? 'pending';
        const cls = STATUS_BADGES[status] ?? STATUS_BADGES.pending;
        return (
          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border capitalize ${cls}`}>
            {status}
          </span>
        );
      },
    },
    {
      key: 'total',
      header: 'Total',
      accessor: (o) => o.total ?? 0,
      render: (o) => (
        <span className="inline-flex items-center gap-1 text-primary font-semibold">
          <DollarSign className="w-4 h-4" />
          {(o.total ?? 0).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'items',
      header: 'Items',
      accessor: (o) => o.items?.length ?? 0,
      render: (o) => <span className="text-muted-foreground">{o.items?.length ?? 0} items</span>,
    },
    {
      key: 'actions',
      header: '',
      sortable: false,
      exportable: false,
      render: (o) => (
        <button
          onClick={() => router.push(`/orders/${o.id}`)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-elevated border border-border-light hover:border-primary text-muted-foreground hover:text-foreground rounded-lg transition-all text-sm"
        >
          <Eye className="w-4 h-4" />
          View
        </button>
      ),
    },
  ], [router]);

  return (
    <div className="p-8 space-y-6">
      <SubpageNav items={DEALS_TABS} />

      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/25">
          <ShoppingCart className="w-6 h-6 text-white" />
        </div>
        <div>
          <PageTitle>Orders</PageTitle>
          <SectionDescription>{orders.length} orders linked to deals</SectionDescription>
        </div>
      </motion.div>

      {error && (
        <div className="p-4 rounded-xl border border-error/20 flex items-center gap-3" style={{ backgroundColor: 'rgba(var(--color-error-rgb), 0.1)' }}>
          <AlertCircle className="w-5 h-5 text-error" />
          <span className="text-error-light">{error}</span>
        </div>
      )}

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <DataTable
          columns={columns}
          data={orders}
          loading={loading}
          searchPlaceholder="Search orders..."
          searchFilter={(o, q) =>
            (o.orderNumber?.toLowerCase().includes(q) ?? false) ||
            (o.customerEmail?.toLowerCase().includes(q) ?? false)
          }
          enableCsvExport
          csvFilename="orders"
          emptyMessage="No orders yet"
          emptyIcon={<ShoppingCart className="w-8 h-8 text-muted-foreground" />}
          accentColor="cyan"
        />
      </motion.div>
    </div>
  );
}
