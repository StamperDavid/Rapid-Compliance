'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
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

export default function LeadsPage() {
  const router = useRouter();
  const [filter, setFilter] = useState('all');

  const fetchLeads = useCallback(async (lastDoc?: unknown) => {
    const searchParams = new URLSearchParams({
      workspaceId: 'default',
      pageSize: '50',
    });

    if (filter !== 'all') {
      searchParams.set('status', filter);
    }

    if (lastDoc) {
      searchParams.set('lastDoc', String(lastDoc));
    }

    const response = await fetch(`/api/leads?${searchParams}`);

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
    void refresh();
  }, [filter, refresh]);

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

        <button
          onClick={() => router.push(`/leads/new`)}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary to-secondary hover:from-primary-light hover:to-secondary-light text-white font-semibold rounded-xl transition-all shadow-lg shadow-primary/25"
        >
          <Plus className="w-5 h-5" />
          Add Lead
        </button>
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
    </div>
  );
}
