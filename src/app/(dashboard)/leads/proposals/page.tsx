'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import SubpageNav from '@/components/ui/SubpageNav';
import { LEADS_TABS } from '@/lib/constants/subpage-nav';
import { useAuth } from '@/hooks/useAuth';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageTitle, SectionDescription } from '@/components/ui/typography';
import {
  FileText,
  Plus,
  Eye,
  Loader2,
  AlertCircle,
  DollarSign,
  X,
} from 'lucide-react';
import type { Quote } from '@/types/quote';

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-gray-500/10 text-gray-400 border-gray-500/20' },
  sent: { label: 'Sent', className: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  viewed: { label: 'Viewed', className: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  accepted: { label: 'Accepted', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  rejected: { label: 'Rejected', className: 'bg-red-500/10 text-red-400 border-red-500/20' },
  expired: { label: 'Expired', className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  converted: { label: 'Converted', className: 'bg-primary/10 text-primary border-primary/20' },
};

export default function ProposalsQuotesPage() {
  const router = useRouter();
  const { loading: authLoading } = useAuth();
  const authFetch = useAuthFetch();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);

  // Create form
  const [formTitle, setFormTitle] = useState('');
  const [formCompanyName, setFormCompanyName] = useState('');
  const [formContactName, setFormContactName] = useState('');
  const [formContactEmail, setFormContactEmail] = useState('');
  const [formItemName, setFormItemName] = useState('');
  const [formItemPrice, setFormItemPrice] = useState('');
  const [formItemQty, setFormItemQty] = useState('1');

  const fetchQuotes = useCallback(async () => {
    try {
      setLoading(true);
      const response = await authFetch('/api/crm/quotes?pageSize=100');
      if (!response.ok) { throw new Error('Failed to fetch quotes'); }
      const result = await response.json() as { data: Quote[] };
      setQuotes(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load quotes');
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (authLoading) { return; }
    void fetchQuotes();
  }, [fetchQuotes, authLoading]);

  const handleCreate = async () => {
    if (!formTitle.trim() || !formItemName.trim()) { return; }
    setCreating(true);
    try {
      const response = await authFetch('/api/crm/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formTitle,
          companyName: formCompanyName || undefined,
          contactName: formContactName || undefined,
          contactEmail: formContactEmail || undefined,
          lineItems: [{
            productName: formItemName,
            unitPrice: parseFloat(formItemPrice) || 0,
            quantity: parseInt(formItemQty) || 1,
          }],
        }),
      });
      if (!response.ok) { throw new Error('Failed to create quote'); }
      setShowCreateModal(false);
      setFormTitle('');
      setFormCompanyName('');
      setFormContactName('');
      setFormContactEmail('');
      setFormItemName('');
      setFormItemPrice('');
      setFormItemQty('1');
      void fetchQuotes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create quote');
    } finally {
      setCreating(false);
    }
  };

  const columns: ColumnDef<Quote>[] = useMemo(() => [
    {
      key: 'quoteNumber',
      header: 'Quote #',
      accessor: (q) => q.quoteNumber,
      render: (q) => <span className="font-mono text-sm text-foreground">{q.quoteNumber}</span>,
    },
    {
      key: 'title',
      header: 'Title',
      accessor: (q) => q.title,
      render: (q) => (
        <div>
          <span className="font-medium text-foreground">{q.title}</span>
          {q.companyName && <span className="block text-xs text-muted-foreground">{q.companyName}</span>}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (q) => q.status,
      render: (q) => {
        const badge = STATUS_BADGES[q.status] ?? STATUS_BADGES.draft;
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
      accessor: (q) => q.total,
      render: (q) => (
        <span className="inline-flex items-center gap-1 text-primary font-semibold">
          <DollarSign className="w-4 h-4" />
          {q.total.toLocaleString()}
        </span>
      ),
    },
    {
      key: 'items',
      header: 'Items',
      accessor: (q) => q.lineItems.length,
      render: (q) => <span className="text-muted-foreground">{q.lineItems.length} items</span>,
    },
    {
      key: 'contact',
      header: 'Contact',
      accessor: (q) => q.contactName ?? '',
      render: (q) => <span className="text-muted-foreground text-sm">{q.contactName ?? '-'}</span>,
    },
    {
      key: 'actions',
      header: '',
      sortable: false,
      exportable: false,
      render: (q) => (
        <button
          onClick={() => router.push(`/leads/proposals/${q.id}`)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-elevated border border-border-light hover:border-primary text-muted-foreground hover:text-foreground rounded-lg transition-all text-sm"
        >
          <Eye className="w-4 h-4" />
          View
        </button>
      ),
    },
  ], [router]);

  if (loading && quotes.length === 0) {
    return (
      <div className="p-8 space-y-6">
        <SubpageNav items={LEADS_TABS} />
        <div className="flex items-center justify-center py-24">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>Loading proposals & quotes...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <SubpageNav items={LEADS_TABS} />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/25">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <div>
            <PageTitle>Proposals & Quotes</PageTitle>
            <SectionDescription>
              {quotes.length} quotes &bull; ${quotes.reduce((s, q) => s + q.total, 0).toLocaleString()} total value
            </SectionDescription>
          </div>
        </div>

        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-5 h-5 mr-2" />
          New Quote
        </Button>
      </motion.div>

      {error && (
        <div className="p-4 rounded-xl border border-error/20 flex items-center gap-3" style={{ backgroundColor: 'rgba(var(--color-error-rgb), 0.1)' }}>
          <AlertCircle className="w-5 h-5 text-error flex-shrink-0" />
          <span className="text-error-light">{error}</span>
        </div>
      )}

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <DataTable
          columns={columns}
          data={quotes}
          loading={loading}
          searchPlaceholder="Search quotes..."
          searchFilter={(q, query) =>
            q.title.toLowerCase().includes(query) ||
            q.quoteNumber.toLowerCase().includes(query) ||
            (q.companyName?.toLowerCase().includes(query) ?? false)
          }
          enableCsvExport
          csvFilename="quotes"
          emptyMessage="No quotes yet. Create your first proposal."
          emptyIcon={<FileText className="w-8 h-8 text-muted-foreground" />}
          accentColor="blue"
        />
      </motion.div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border-strong rounded-2xl p-6 w-full max-w-lg mx-4 shadow-xl"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-foreground">New Quote</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Quote Title *</label>
                <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="Q4 Software License" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Company</label>
                  <Input value={formCompanyName} onChange={(e) => setFormCompanyName(e.target.value)} placeholder="Acme Corp" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Contact</label>
                  <Input value={formContactName} onChange={(e) => setFormContactName(e.target.value)} placeholder="John Doe" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Contact Email</label>
                <Input value={formContactEmail} onChange={(e) => setFormContactEmail(e.target.value)} placeholder="john@acme.com" />
              </div>
              <div className="border-t border-border-light pt-4">
                <label className="block text-sm font-medium text-foreground mb-2">Line Item *</label>
                <div className="grid grid-cols-3 gap-3">
                  <Input value={formItemName} onChange={(e) => setFormItemName(e.target.value)} placeholder="Item name" />
                  <Input type="number" value={formItemPrice} onChange={(e) => setFormItemPrice(e.target.value)} placeholder="Price" />
                  <Input type="number" value={formItemQty} onChange={(e) => setFormItemQty(e.target.value)} placeholder="Qty" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
              <Button onClick={() => void handleCreate()} disabled={creating || !formTitle.trim() || !formItemName.trim()}>
                {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                Create Quote
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
