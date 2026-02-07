'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { usePagination } from '@/hooks/usePagination';
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
  const [deleteIds, setDeleteIds] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
    refresh
  } = usePagination<Lead>({ fetchFn: fetchLeads });

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
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-500/30 text-blue-300">
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
      : 'bg-gray-500/20 border-gray-500/30 text-gray-300';

    return (
      <span className={`px-2 py-1 rounded-lg text-xs font-mono border ${colorClass}`}>
        {score}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      new: 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300',
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
      render: (lead) => <span className="font-medium text-white">{getLeadName(lead)}</span>,
    },
    {
      key: 'company',
      header: 'Company',
      accessor: (lead) => getLeadCompany(lead),
      render: (lead) => <span className="text-gray-400">{getLeadCompany(lead)}</span>,
    },
    {
      key: 'email',
      header: 'Email',
      accessor: (lead) => lead.email ?? '',
      render: (lead) => <span className="text-gray-400">{lead.email ?? '-'}</span>,
    },
    {
      key: 'phone',
      header: 'Phone',
      accessor: (lead) => lead.phone ?? '',
      render: (lead) => <span className="text-gray-400">{lead.phone ?? '-'}</span>,
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
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-indigo-500/50 text-gray-400 hover:text-white rounded-lg transition-all text-sm"
        >
          <Eye className="w-4 h-4" />
          View
        </button>
      ),
    },
  ], [router]);

  const handleBulkDelete = useCallback((selectedIds: string[]) => {
    setDeleteIds(selectedIds);
    setDeleteDialogOpen(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    setDeleting(true);
    try {
      const response = await fetch('/api/leads', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: deleteIds }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete leads');
      }

      setDeleteDialogOpen(false);
      setDeleteIds([]);
      void refresh();
    } catch {
      // Error is shown via the dialog staying open
    } finally {
      setDeleting(false);
    }
  }, [deleteIds, refresh]);

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
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading leads...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black p-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Leads</h1>
            <p className="text-gray-400 text-sm">{leads.length} total leads</p>
          </div>
        </div>

        <button
          onClick={() => router.push(`/leads/new`)}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-500/25"
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
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25'
                : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
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
          className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3"
        >
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <span className="text-red-300">{error}</span>
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
          emptyIcon={<UserPlus className="w-8 h-8 text-gray-500" />}
          accentColor="indigo"
        />
      </motion.div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
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
