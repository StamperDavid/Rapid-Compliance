'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { DataTable, type ColumnDef, type BulkAction } from '@/components/ui/data-table';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageTitle, SectionDescription } from '@/components/ui/typography';
import {
  Building2,
  Plus,
  Eye,
  Loader2,
  AlertCircle,
  Users,
  DollarSign,
  Trash2,
  X,
} from 'lucide-react';
import type { Company, CompanyStatus } from '@/types/company';

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  prospect: { label: 'Prospect', className: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  active: { label: 'Active', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  inactive: { label: 'Inactive', className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  churned: { label: 'Churned', className: 'bg-red-500/10 text-red-400 border-red-500/20' },
};

interface CompanyWithRollup extends Company {
  contactCount?: number;
  dealCount?: number;
  totalDealValue?: number;
  wonDealValue?: number;
}

export default function CompaniesPage() {
  const router = useRouter();
  const { loading: authLoading } = useAuth();
  const authFetch = useAuthFetch();
  const [companies, setCompanies] = useState<CompanyWithRollup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleteIds, setDeleteIds] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Create form state
  const [formName, setFormName] = useState('');
  const [formWebsite, setFormWebsite] = useState('');
  const [formIndustry, setFormIndustry] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formStatus, setFormStatus] = useState<CompanyStatus>('prospect');

  const fetchCompanies = useCallback(async () => {
    try {
      setLoading(true);
      const response = await authFetch('/api/crm/companies?pageSize=100');
      if (!response.ok) { throw new Error('Failed to fetch companies'); }
      const result = await response.json() as { data: CompanyWithRollup[] };
      setCompanies(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load companies');
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (authLoading) { return; }
    void fetchCompanies();
  }, [fetchCompanies, authLoading]);

  const handleCreate = async () => {
    if (!formName.trim()) { return; }
    setCreating(true);
    try {
      const response = await authFetch('/api/crm/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          website: formWebsite || undefined,
          industry: formIndustry || undefined,
          phone: formPhone || undefined,
          email: formEmail || undefined,
          status: formStatus,
        }),
      });
      if (!response.ok) { throw new Error('Failed to create company'); }
      setShowCreateModal(false);
      setFormName('');
      setFormWebsite('');
      setFormIndustry('');
      setFormPhone('');
      setFormEmail('');
      setFormStatus('prospect');
      void fetchCompanies();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create company');
    } finally {
      setCreating(false);
    }
  };

  const handleBulkDelete = (_selectedIds: string[], selectedRows: CompanyWithRollup[]) => {
    setDeleteIds(selectedRows.map(i => i.id));
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      for (const id of deleteIds) {
        await authFetch(`/api/crm/companies/${id}`, { method: 'DELETE' });
      }
      setCompanies(prev => prev.filter(c => !deleteIds.includes(c.id)));
      setDeleteDialogOpen(false);
      setDeleteIds([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  const columns: ColumnDef<CompanyWithRollup>[] = useMemo(() => [
    {
      key: 'name',
      header: 'Company',
      accessor: (c) => c.name,
      render: (c) => (
        <div>
          <span className="font-medium text-foreground">{c.name}</span>
          {c.industry && <span className="block text-xs text-muted-foreground">{c.industry}</span>}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (c) => c.status,
      render: (c) => {
        const badge = STATUS_BADGES[c.status] ?? STATUS_BADGES.prospect;
        return (
          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border ${badge.className}`}>
            {badge.label}
          </span>
        );
      },
    },
    {
      key: 'contacts',
      header: 'Contacts',
      accessor: (c) => c.contactCount ?? 0,
      render: (c) => (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Users className="w-4 h-4" />
          {c.contactCount ?? 0}
        </span>
      ),
    },
    {
      key: 'deals',
      header: 'Deals',
      accessor: (c) => c.dealCount ?? 0,
      render: (c) => (
        <span className="text-muted-foreground">{c.dealCount ?? 0}</span>
      ),
    },
    {
      key: 'revenue',
      header: 'Lifetime Value',
      accessor: (c) => c.wonDealValue ?? 0,
      render: (c) => (
        <span className="inline-flex items-center gap-1 text-primary font-semibold">
          <DollarSign className="w-4 h-4" />
          {(c.wonDealValue ?? 0).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'website',
      header: 'Website',
      accessor: (c) => c.website ?? '',
      render: (c) => c.website
        ? <span className="text-primary text-sm truncate max-w-[200px] block">{c.website}</span>
        : <span className="text-muted-foreground text-xs">-</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      sortable: false,
      exportable: false,
      render: (c) => (
        <button
          onClick={() => router.push(`/companies/${c.id}`)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-elevated hover:bg-surface-elevated border border-border-light hover:border-primary text-muted-foreground hover:text-foreground rounded-lg transition-all text-sm"
        >
          <Eye className="w-4 h-4" />
          View
        </button>
      ),
    },
  ], [router]);

  const bulkActions: BulkAction<CompanyWithRollup>[] = useMemo(() => [
    {
      key: 'delete',
      label: 'Delete',
      icon: <Trash2 className="w-4 h-4" />,
      variant: 'destructive',
      onAction: handleBulkDelete,
    },
  ], []);

  if (loading && companies.length === 0) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading companies...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-secondary to-primary flex items-center justify-center shadow-lg shadow-secondary/25">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <PageTitle>Companies</PageTitle>
            <SectionDescription>{companies.length} companies in your CRM</SectionDescription>
          </div>
        </div>

        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-5 h-5 mr-2" />
          New Company
        </Button>
      </motion.div>

      {/* Error State */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl border border-error/20 flex items-center gap-3"
          style={{ backgroundColor: 'rgba(var(--color-error-rgb), 0.1)' }}
        >
          <AlertCircle className="w-5 h-5 text-error flex-shrink-0" />
          <span className="text-error-light">{error}</span>
        </motion.div>
      )}

      {/* Data Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <DataTable
          columns={columns}
          data={companies}
          loading={loading}
          searchPlaceholder="Search companies..."
          searchFilter={(company, q) => {
            const name = company.name.toLowerCase();
            const industry = (company.industry ?? '').toLowerCase();
            const website = (company.website ?? '').toLowerCase();
            return name.includes(q) || industry.includes(q) || website.includes(q);
          }}
          bulkActions={bulkActions}
          enableCsvExport
          csvFilename="companies"
          emptyMessage="No companies found"
          emptyIcon={<Building2 className="w-8 h-8 text-muted-foreground" />}
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
              <h3 className="text-lg font-semibold text-foreground">New Company</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Company Name *</label>
                <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Acme Corp" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Website</label>
                  <Input value={formWebsite} onChange={(e) => setFormWebsite(e.target.value)} placeholder="https://example.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Industry</label>
                  <Input value={formIndustry} onChange={(e) => setFormIndustry(e.target.value)} placeholder="Technology" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Phone</label>
                  <Input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="+1 555-0100" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Email</label>
                  <Input value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="info@example.com" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Status</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as CompanyStatus)}
                  className="w-full px-3 py-2 bg-surface-elevated border border-border-light rounded-lg text-foreground focus:border-primary focus:ring-1 focus:ring-primary"
                >
                  <option value="prospect">Prospect</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="churned">Churned</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
              <Button onClick={() => void handleCreate()} disabled={creating || !formName.trim()}>
                {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                Create Company
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onClose={() => { setDeleteDialogOpen(false); setDeleteIds([]); }}
        onConfirm={() => void confirmDelete()}
        title="Delete Companies"
        description={`Are you sure you want to delete ${deleteIds.length} company${deleteIds.length === 1 ? '' : 'ies'}? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        loading={deleting}
      />
    </div>
  );
}
