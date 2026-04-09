'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import SubpageNav from '@/components/ui/SubpageNav';
import { DEALS_TABS } from '@/lib/constants/subpage-nav';
import { useAuth } from '@/hooks/useAuth';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageTitle, SectionDescription } from '@/components/ui/typography';
import {
  Receipt,
  Plus,
  Eye,
  Loader2,
  AlertCircle,
  DollarSign,
  X,
} from 'lucide-react';
import type { Invoice } from '@/types/invoice';

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-gray-500/10 text-gray-400 border-gray-500/20' },
  sent: { label: 'Sent', className: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  viewed: { label: 'Viewed', className: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  partially_paid: { label: 'Partial', className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  paid: { label: 'Paid', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  overdue: { label: 'Overdue', className: 'bg-red-500/10 text-red-400 border-red-500/20' },
  cancelled: { label: 'Cancelled', className: 'bg-gray-500/10 text-gray-400 border-gray-500/20' },
  refunded: { label: 'Refunded', className: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
};

export default function DealsInvoicesPage() {
  const router = useRouter();
  const { loading: authLoading } = useAuth();
  const authFetch = useAuthFetch();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formCompanyName, setFormCompanyName] = useState('');
  const [formItemName, setFormItemName] = useState('');
  const [formItemPrice, setFormItemPrice] = useState('');

  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const response = await authFetch('/api/crm/invoices?pageSize=100');
      if (!response.ok) { throw new Error('Failed to fetch invoices'); }
      const result = await response.json() as { data: Invoice[] };
      setInvoices(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (authLoading) { return; }
    void fetchInvoices();
  }, [fetchInvoices, authLoading]);

  const handleCreate = async () => {
    if (!formTitle.trim() || !formItemName.trim()) { return; }
    setCreating(true);
    try {
      const response = await authFetch('/api/crm/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formTitle,
          companyName: formCompanyName || undefined,
          lineItems: [{
            productName: formItemName,
            unitPrice: parseFloat(formItemPrice) || 0,
            quantity: 1,
          }],
        }),
      });
      if (!response.ok) { throw new Error('Failed to create invoice'); }
      setShowCreateModal(false);
      setFormTitle('');
      setFormCompanyName('');
      setFormItemName('');
      setFormItemPrice('');
      void fetchInvoices();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invoice');
    } finally {
      setCreating(false);
    }
  };

  const columns: ColumnDef<Invoice>[] = useMemo(() => [
    {
      key: 'invoiceNumber',
      header: 'Invoice #',
      accessor: (i) => i.invoiceNumber,
      render: (i) => <span className="font-mono text-sm text-foreground">{i.invoiceNumber}</span>,
    },
    {
      key: 'title',
      header: 'Title',
      accessor: (i) => i.title,
      render: (i) => (
        <div>
          <span className="font-medium text-foreground">{i.title}</span>
          {i.companyName && <span className="block text-xs text-muted-foreground">{i.companyName}</span>}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (i) => i.status,
      render: (i) => {
        const badge = STATUS_BADGES[i.status] ?? STATUS_BADGES.draft;
        return (
          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border ${badge.className}`}>
            {badge.label}
          </span>
        );
      },
    },
    {
      key: 'total',
      header: 'Total',
      accessor: (i) => i.total,
      render: (i) => (
        <span className="inline-flex items-center gap-1 text-primary font-semibold">
          <DollarSign className="w-4 h-4" />
          {i.total.toLocaleString()}
        </span>
      ),
    },
    {
      key: 'amountDue',
      header: 'Due',
      accessor: (i) => i.amountDue,
      render: (i) => (
        <span className={`font-medium ${i.amountDue > 0 ? 'text-warning' : 'text-success'}`}>
          ${i.amountDue.toLocaleString()}
        </span>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      accessor: (i) => i.contactName ?? '',
      render: (i) => <span className="text-muted-foreground text-sm">{i.contactName ?? '-'}</span>,
    },
    {
      key: 'actions',
      header: '',
      sortable: false,
      exportable: false,
      render: (i) => (
        <button
          onClick={() => router.push(`/deals/invoices/${i.id}`)}
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

      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center shadow-lg shadow-violet-500/25">
            <Receipt className="w-6 h-6 text-white" />
          </div>
          <div>
            <PageTitle>Invoices</PageTitle>
            <SectionDescription>
              {invoices.length} invoices &bull; ${invoices.reduce((s, i) => s + i.amountDue, 0).toLocaleString()} outstanding
            </SectionDescription>
          </div>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-5 h-5 mr-2" />
          New Invoice
        </Button>
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
          data={invoices}
          loading={loading}
          searchPlaceholder="Search invoices..."
          searchFilter={(inv, q) =>
            inv.title.toLowerCase().includes(q) ||
            inv.invoiceNumber.toLowerCase().includes(q) ||
            (inv.companyName?.toLowerCase().includes(q) ?? false)
          }
          enableCsvExport
          csvFilename="invoices"
          emptyMessage="No invoices yet"
          emptyIcon={<Receipt className="w-8 h-8 text-muted-foreground" />}
          accentColor="violet"
        />
      </motion.div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-card border border-border-strong rounded-2xl p-6 w-full max-w-lg mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-foreground">New Invoice</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Invoice Title *</label>
                <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="Monthly Retainer - April" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Company</label>
                <Input value={formCompanyName} onChange={(e) => setFormCompanyName(e.target.value)} placeholder="Acme Corp" />
              </div>
              <div className="border-t border-border-light pt-4">
                <label className="block text-sm font-medium text-foreground mb-2">Line Item *</label>
                <div className="grid grid-cols-2 gap-3">
                  <Input value={formItemName} onChange={(e) => setFormItemName(e.target.value)} placeholder="Item name" />
                  <Input type="number" value={formItemPrice} onChange={(e) => setFormItemPrice(e.target.value)} placeholder="Amount" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
              <Button onClick={() => void handleCreate()} disabled={creating || !formTitle.trim() || !formItemName.trim()}>
                {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                Create Invoice
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
