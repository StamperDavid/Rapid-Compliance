'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { auth } from '@/lib/firebase/config';
import { usePagination } from '@/hooks/usePagination';
import { useOptimisticDelete } from '@/hooks/useOptimisticDelete';
import { DataTable, type ColumnDef, type BulkAction } from '@/components/ui/data-table';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Users,
  Plus,
  Eye,
  Flame,
  Sun,
  Snowflake,
  Loader2,
  AlertCircle,
  UserPlus,
  Trash2,
  Upload,
  X,
  CheckCircle,
} from 'lucide-react';

interface Lead {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  score?: number;
  status?: string;
  source?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

const STATUS_FILTERS = [
  { key: 'all', label: 'All Leads' },
  { key: 'new', label: 'New' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'qualified', label: 'Qualified' },
  { key: 'converted', label: 'Converted' },
];

const getLeadName = (lead: Lead) => {
  if (lead.name) { return lead.name; }
  if (lead.firstName ?? lead.lastName) {
    return `${lead.firstName ?? ''} ${lead.lastName ?? ''}`.trim();
  }
  return 'Unknown';
};

const getLeadCompany = (lead: Lead) => {
  return lead.company ?? lead.companyName ?? '-';
};

interface ImportResult {
  total: number;
  imported: number;
  skipped: number;
  errors: Array<{ row: number; email: string | undefined; reason: string }>;
}

export default function LeadsPage() {
  const router = useRouter();
  const { loading: authLoading } = useAuth();
  const [filter, setFilter] = useState('all');

  // CSV Import state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState('');

  const fetchLeads = useCallback(async (lastDoc?: unknown) => {
    const searchParams = new URLSearchParams({
      pageSize: '50',
    });

    if (filter !== 'all') {
      searchParams.set('status', filter);
    }

    if (lastDoc) {
      searchParams.set('lastDoc', String(lastDoc));
    }

    const token = await auth?.currentUser?.getIdToken();
    const response = await fetch(`/api/leads?${searchParams}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch leads');
    }

    return response.json() as Promise<{ data: Lead[]; lastDoc: unknown; hasMore: boolean }>;
  }, [filter]);

  const {
    data: leads,
    loading,
    error,
    hasMore,
    loadMore,
    refresh,
    setData: setLeads,
  } = usePagination<Lead>({ fetchFn: fetchLeads });

  const {
    deleteIds,
    deleteDialogOpen,
    deleting,
    requestDelete: handleBulkDelete,
    cancelDelete,
    confirmDelete,
  } = useOptimisticDelete({
    data: leads,
    setData: setLeads,
    endpoint: '/api/leads',
    entityName: 'leads',
  });

  useEffect(() => {
    // Wait for Firebase auth to restore session before making API calls
    if (authLoading) { return; }
    void refresh();
  }, [filter, refresh, authLoading]);

  const getTierBadge = (score: number) => {
    if (score >= 75) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/30 text-red-300">
          <Flame className="w-3 h-3" />
          HOT
        </span>
      );
    }
    if (score >= 50) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-gradient-to-r from-orange-500/20 to-yellow-500/20 border border-orange-500/30 text-orange-300">
          <Sun className="w-3 h-3" />
          WARM
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-gradient-to-r from-primary/20 to-secondary/20 border border-primary/30 text-primary">
        <Snowflake className="w-3 h-3" />
        COLD
      </span>
    );
  };

  const getScoreBadge = (score: number) => {
    const colorClass = score >= 80
      ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
      : score >= 60
      ? 'bg-yellow-500/20 border-yellow-500/30 text-yellow-300'
      : 'bg-surface-elevated border-border-light text-[var(--color-text-secondary)]';

    return (
      <span className={`px-2 py-1 rounded-lg text-xs font-mono border ${colorClass}`}>
        {score}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      new: 'bg-primary/20 border-primary/30 text-primary',
      contacted: 'bg-purple-500/20 border-purple-500/30 text-purple-300',
      qualified: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300',
      converted: 'bg-green-500/20 border-green-500/30 text-green-300',
    };

    return (
      <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border capitalize ${statusColors[status] || statusColors.new}`}>
        {status || 'new'}
      </span>
    );
  };

  const columns: ColumnDef<Lead>[] = useMemo(() => [
    {
      key: 'name',
      header: 'Name',
      accessor: (lead) => getLeadName(lead),
      render: (lead) => <span className="font-medium text-[var(--color-text-primary)]">{getLeadName(lead)}</span>,
    },
    {
      key: 'company',
      header: 'Company',
      accessor: (lead) => getLeadCompany(lead),
      render: (lead) => <span className="text-[var(--color-text-secondary)]">{getLeadCompany(lead)}</span>,
    },
    {
      key: 'email',
      header: 'Email',
      accessor: (lead) => lead.email ?? '',
      render: (lead) => <span className="text-[var(--color-text-secondary)]">{lead.email ?? '-'}</span>,
    },
    {
      key: 'phone',
      header: 'Phone',
      accessor: (lead) => lead.phone ?? '',
      render: (lead) => <span className="text-[var(--color-text-secondary)]">{lead.phone ?? '-'}</span>,
    },
    {
      key: 'tier',
      header: 'Tier',
      sortable: false,
      exportable: false,
      render: (lead) => getTierBadge(lead.score ?? 50),
    },
    {
      key: 'score',
      header: 'Score',
      accessor: (lead) => lead.score ?? 0,
      render: (lead) => getScoreBadge(lead.score ?? 50),
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (lead) => lead.status ?? 'new',
      render: (lead) => getStatusBadge(lead.status ?? 'new'),
    },
    {
      key: 'source',
      header: 'Source',
      accessor: (lead) => lead.utmSource ?? lead.source ?? '',
      render: (lead) => {
        const src = lead.utmSource ?? lead.source ?? '';
        return src ? (
          <span className="px-2 py-0.5 rounded-lg text-xs font-medium bg-primary/10 border border-primary/20 text-primary capitalize">
            {src}
          </span>
        ) : <span className="text-[var(--color-text-disabled)] text-xs">-</span>;
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      sortable: false,
      exportable: false,
      render: (lead) => (
        <button
          onClick={() => router.push(`/leads/${lead.id}`)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-elevated hover:bg-surface-elevated border border-border-light hover:border-primary text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] rounded-lg transition-all text-sm"
        >
          <Eye className="w-4 h-4" />
          View
        </button>
      ),
    },
  ], [router]);

  const bulkActions: BulkAction<Lead>[] = useMemo(() => [
    {
      key: 'delete',
      label: 'Delete',
      icon: <Trash2 className="w-4 h-4" />,
      variant: 'destructive',
      onAction: handleBulkDelete,
    },
  ], [handleBulkDelete]);

  if (loading && leads.length === 0) {
    return (
      <div className="min-h-screen bg-surface-main flex items-center justify-center">
        <div className="flex items-center gap-3 text-[var(--color-text-secondary)]">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading leads...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-main p-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/25">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">Leads</h1>
            <p className="text-[var(--color-text-secondary)] text-sm">{leads.length} total leads</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowImportModal(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-surface-elevated hover:bg-surface-elevated border border-border-light hover:border-primary text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] font-semibold rounded-xl transition-all"
          >
            <Upload className="w-5 h-5" />
            Import CSV
          </button>
          <button
            onClick={() => router.push(`/leads/new`)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary to-secondary hover:from-primary-light hover:to-secondary-light text-white font-semibold rounded-xl transition-all shadow-lg shadow-primary/25"
          >
            <Plus className="w-5 h-5" />
            Add Lead
          </button>
        </div>
      </motion.div>

      {/* Status Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-wrap gap-2 mb-6"
      >
        {STATUS_FILTERS.map((status) => (
          <button
            key={status.key}
            onClick={() => setFilter(status.key)}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              filter === status.key
                ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-lg shadow-primary/25'
                : 'bg-surface-elevated border border-border-light text-[var(--color-text-secondary)] hover:bg-surface-elevated hover:text-[var(--color-text-primary)]'
            }`}
          >
            {status.label}
          </button>
        ))}
      </motion.div>

      {/* Error State */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 rounded-xl border border-error/20 flex items-center gap-3"
          style={{ backgroundColor: 'rgba(var(--color-error-rgb), 0.1)' }}
        >
          <AlertCircle className="w-5 h-5 text-error flex-shrink-0" />
          <span className="text-error-light">{error}</span>
        </motion.div>
      )}

      {/* DataTable */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <DataTable
          columns={columns}
          data={leads}
          loading={loading}
          searchPlaceholder="Search leads..."
          searchFilter={(lead, query) => {
            const name = getLeadName(lead).toLowerCase();
            const company = getLeadCompany(lead).toLowerCase();
            const email = (lead.email ?? '').toLowerCase();
            return name.includes(query) || company.includes(query) || email.includes(query);
          }}
          bulkActions={bulkActions}
          enableCsvExport
          csvFilename="leads"
          hasMore={hasMore}
          onLoadMore={() => void loadMore()}
          itemCountLabel={`${leads.length} shown`}
          emptyMessage="No leads found"
          emptyIcon={<UserPlus className="w-8 h-8 text-[var(--color-text-disabled)]" />}
          accentColor="indigo"
        />
      </motion.div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onClose={cancelDelete}
        onConfirm={confirmDelete}
        title="Delete Leads"
        description={`Are you sure you want to delete ${deleteIds.length} lead${deleteIds.length === 1 ? '' : 's'}? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        loading={deleting}
      />

      {/* CSV Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => !importing && setShowImportModal(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-surface-elevated border border-border-light rounded-2xl shadow-2xl p-6 w-full max-w-lg mx-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Import Leads from CSV</h2>
              <button onClick={() => { setShowImportModal(false); setImportFile(null); setImportResult(null); setImportError(''); }} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
                <X className="w-5 h-5" />
              </button>
            </div>

            {importResult ? (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                  <span className="font-semibold text-emerald-300">Import Complete</span>
                </div>
                <div className="space-y-2 text-sm text-[var(--color-text-secondary)] mb-4">
                  <p>Total rows: {importResult.total}</p>
                  <p className="text-emerald-300">Imported: {importResult.imported}</p>
                  {importResult.skipped > 0 && <p className="text-yellow-300">Skipped: {importResult.skipped}</p>}
                </div>
                {importResult.errors.length > 0 && (
                  <div className="max-h-40 overflow-y-auto bg-surface-main rounded-lg p-3 mb-4 text-xs space-y-1">
                    {importResult.errors.slice(0, 20).map((err, i) => (
                      <p key={i} className="text-yellow-300">Row {err.row}{err.email ? ` (${err.email})` : ''}: {err.reason}</p>
                    ))}
                    {importResult.errors.length > 20 && (
                      <p className="text-[var(--color-text-disabled)]">...and {importResult.errors.length - 20} more</p>
                    )}
                  </div>
                )}
                <button
                  onClick={() => { setShowImportModal(false); setImportFile(null); setImportResult(null); setImportError(''); void refresh(); }}
                  className="w-full py-2.5 bg-gradient-to-r from-primary to-secondary text-white font-semibold rounded-xl"
                >
                  Done
                </button>
              </div>
            ) : (
              <div>
                <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                  Upload a CSV file with columns: First Name, Last Name, Email, Phone, Company, Title, Source, Status, Tags, Notes
                </p>
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border-light rounded-xl cursor-pointer hover:border-primary transition-colors mb-4">
                  <Upload className="w-8 h-8 text-[var(--color-text-disabled)] mb-2" />
                  <span className="text-sm text-[var(--color-text-secondary)]">
                    {importFile ? importFile.name : 'Click to select CSV file'}
                  </span>
                  <input
                    type="file" accept=".csv,text/csv" className="hidden"
                    onChange={e => { setImportFile(e.target.files?.[0] ?? null); setImportError(''); }}
                  />
                </label>
                {importError && (
                  <p className="text-sm text-error mb-4">{importError}</p>
                )}
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => { setShowImportModal(false); setImportFile(null); setImportError(''); }}
                    className="px-4 py-2.5 text-sm text-[var(--color-text-secondary)] border border-border-light rounded-xl hover:text-[var(--color-text-primary)]"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={!importFile || importing}
                    onClick={() => {
                      if (!importFile) { return; }
                      void (async () => {
                        setImporting(true);
                        setImportError('');
                        try {
                          const token = await auth?.currentUser?.getIdToken();
                          const fd = new FormData();
                          fd.append('file', importFile);
                          const res = await fetch('/api/leads/import', {
                            method: 'POST',
                            headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                            body: fd,
                          });
                          const data = await res.json() as ImportResult & { error?: string };
                          if (!res.ok) {
                            throw new Error(data.error ?? 'Import failed');
                          }
                          setImportResult(data);
                        } catch (err: unknown) {
                          setImportError(err instanceof Error ? err.message : 'Import failed');
                        } finally {
                          setImporting(false);
                        }
                      })();
                    }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary to-secondary text-white font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {importing ? 'Importing...' : 'Import'}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}
