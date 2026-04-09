'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
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
  Banknote,
  Plus,
  Loader2,
  AlertCircle,
  DollarSign,
  X,
} from 'lucide-react';
import type { CrmPayment } from '@/types/payment';

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  processing: { label: 'Processing', className: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  completed: { label: 'Completed', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  failed: { label: 'Failed', className: 'bg-red-500/10 text-red-400 border-red-500/20' },
  refunded: { label: 'Refunded', className: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
  partially_refunded: { label: 'Partial Refund', className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  cancelled: { label: 'Cancelled', className: 'bg-gray-500/10 text-gray-400 border-gray-500/20' },
};

const METHOD_LABELS: Record<string, string> = {
  credit_card: 'Credit Card',
  bank_transfer: 'Bank Transfer',
  wire: 'Wire Transfer',
  check: 'Check',
  cash: 'Cash',
  paypal: 'PayPal',
  stripe: 'Stripe',
  other: 'Other',
};

export default function DealsPaymentsPage() {
  const { loading: authLoading } = useAuth();
  const authFetch = useAuthFetch();
  const [payments, setPayments] = useState<CrmPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formAmount, setFormAmount] = useState('');
  const [formMethod, setFormMethod] = useState('bank_transfer');
  const [formReference, setFormReference] = useState('');
  const [formCompanyName, setFormCompanyName] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchPayments = useCallback(async () => {
    try {
      setLoading(true);
      const response = await authFetch('/api/crm/payments?pageSize=100');
      if (!response.ok) { throw new Error('Failed to fetch payments'); }
      const result = await response.json() as { data: CrmPayment[] };
      setPayments(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payments');
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (authLoading) { return; }
    void fetchPayments();
  }, [fetchPayments, authLoading]);

  const handleCreate = async () => {
    if (!formAmount) { return; }
    setCreating(true);
    try {
      const response = await authFetch('/api/crm/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(formAmount),
          method: formMethod,
          reference: formReference || undefined,
          companyName: formCompanyName || undefined,
          paymentDate: formDate,
        }),
      });
      if (!response.ok) { throw new Error('Failed to create payment'); }
      setShowCreateModal(false);
      setFormAmount('');
      setFormMethod('bank_transfer');
      setFormReference('');
      setFormCompanyName('');
      void fetchPayments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record payment');
    } finally {
      setCreating(false);
    }
  };

  const totalReceived = payments
    .filter(p => p.status === 'completed')
    .reduce((s, p) => s + p.amount, 0);

  const columns: ColumnDef<CrmPayment>[] = useMemo(() => [
    {
      key: 'paymentNumber',
      header: 'Payment #',
      accessor: (p) => p.paymentNumber,
      render: (p) => <span className="font-mono text-sm text-foreground">{p.paymentNumber}</span>,
    },
    {
      key: 'company',
      header: 'Company',
      accessor: (p) => p.companyName ?? '',
      render: (p) => <span className="text-muted-foreground text-sm">{p.companyName ?? '-'}</span>,
    },
    {
      key: 'amount',
      header: 'Amount',
      accessor: (p) => p.amount,
      render: (p) => (
        <span className="inline-flex items-center gap-1 text-primary font-semibold">
          <DollarSign className="w-4 h-4" />
          {p.amount.toLocaleString()}
        </span>
      ),
    },
    {
      key: 'method',
      header: 'Method',
      accessor: (p) => p.method,
      render: (p) => <span className="text-muted-foreground text-sm">{METHOD_LABELS[p.method] ?? p.method}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (p) => p.status,
      render: (p) => {
        const badge = STATUS_BADGES[p.status] ?? STATUS_BADGES.pending;
        return (
          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border ${badge.className}`}>
            {badge.label}
          </span>
        );
      },
    },
    {
      key: 'reference',
      header: 'Reference',
      accessor: (p) => p.reference ?? '',
      render: (p) => <span className="text-muted-foreground text-xs">{p.reference ?? '-'}</span>,
    },
  ], []);

  return (
    <div className="p-8 space-y-6">
      <SubpageNav items={DEALS_TABS} />

      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center shadow-lg shadow-emerald-500/25">
            <Banknote className="w-6 h-6 text-white" />
          </div>
          <div>
            <PageTitle>Payments</PageTitle>
            <SectionDescription>
              {payments.length} payments &bull; ${totalReceived.toLocaleString()} received
            </SectionDescription>
          </div>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-5 h-5 mr-2" />
          Record Payment
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
          data={payments}
          loading={loading}
          searchPlaceholder="Search payments..."
          searchFilter={(p, q) =>
            p.paymentNumber.toLowerCase().includes(q) ||
            (p.companyName?.toLowerCase().includes(q) ?? false) ||
            (p.reference?.toLowerCase().includes(q) ?? false)
          }
          enableCsvExport
          csvFilename="payments"
          emptyMessage="No payments recorded"
          emptyIcon={<Banknote className="w-8 h-8 text-muted-foreground" />}
          accentColor="emerald"
        />
      </motion.div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-card border border-border-strong rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-foreground">Record Payment</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Amount *</label>
                <Input type="number" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} placeholder="1000.00" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Company</label>
                <Input value={formCompanyName} onChange={(e) => setFormCompanyName(e.target.value)} placeholder="Acme Corp" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Method</label>
                <select value={formMethod} onChange={(e) => setFormMethod(e.target.value)} className="w-full px-3 py-2 bg-surface-elevated border border-border-light rounded-lg text-foreground focus:border-primary focus:ring-1 focus:ring-primary">
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="credit_card">Credit Card</option>
                  <option value="wire">Wire Transfer</option>
                  <option value="check">Check</option>
                  <option value="cash">Cash</option>
                  <option value="paypal">PayPal</option>
                  <option value="stripe">Stripe</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Reference</label>
                <Input value={formReference} onChange={(e) => setFormReference(e.target.value)} placeholder="Check #1234 or wire ref" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Payment Date</label>
                <Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
              <Button onClick={() => void handleCreate()} disabled={creating || !formAmount}>
                {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                Record
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
