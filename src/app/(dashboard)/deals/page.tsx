'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { usePagination } from '@/hooks/usePagination';
import { useOptimisticDelete } from '@/hooks/useOptimisticDelete';
import { DataTable, type ColumnDef, type BulkAction } from '@/components/ui/data-table';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Briefcase,
  Plus,
  LayoutGrid,
  List,
  Eye,
  ChevronDown,
  Loader2,
  AlertCircle,
  DollarSign,
  Target,
  Trash2,
} from 'lucide-react';

const DEAL_STAGES = ['prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];

const STAGE_COLORS: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  prospecting: { bg: 'from-blue-500/20 to-cyan-500/20', border: 'border-blue-500/30', text: 'text-blue-300', icon: '🎯' },
  qualification: { bg: 'from-purple-500/20 to-pink-500/20', border: 'border-purple-500/30', text: 'text-purple-300', icon: '📋' },
  proposal: { bg: 'from-orange-500/20 to-amber-500/20', border: 'border-orange-500/30', text: 'text-orange-300', icon: '📝' },
  negotiation: { bg: 'from-yellow-500/20 to-lime-500/20', border: 'border-yellow-500/30', text: 'text-yellow-300', icon: '🤝' },
  closed_won: { bg: 'from-emerald-500/20 to-green-500/20', border: 'border-emerald-500/30', text: 'text-emerald-300', icon: '🎉' },
  closed_lost: { bg: 'from-red-500/20 to-rose-500/20', border: 'border-red-500/30', text: 'text-red-300', icon: '❌' },
};

interface Deal {
  id: string;
  name: string;
  company?: string;
  companyName?: string;
  value?: number;
  stage?: string;
  probability?: number;
}

const getCompanyName = (deal: Deal) => {
  return deal.company ?? deal.companyName ?? '-';
};

const getStageBadge = (stage: string) => {
  const colors = STAGE_COLORS[stage] || STAGE_COLORS.prospecting;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-gradient-to-r ${colors.bg} border ${colors.border} ${colors.text} capitalize`}>
      {stage.replace('_', ' ')}
    </span>
  );
};

export default function DealsPage() {
  const router = useRouter();
  const [view, setView] = useState<'pipeline' | 'list'>('pipeline');

  const fetchDeals = useCallback(async (lastDoc?: unknown) => {
    const searchParams = new URLSearchParams({
      workspaceId: 'default',
      pageSize: '100'
    });

    if (lastDoc) {
      searchParams.set('lastDoc', String(lastDoc));
    }

    const response = await fetch(`/api/deals?${searchParams}`);

    if (!response.ok) {
      throw new Error('Failed to fetch deals');
    }

    return response.json() as Promise<{ data: Deal[]; lastDoc: unknown; hasMore: boolean }>;
  }, []);

  const {
    data: deals,
    loading,
    error,
    hasMore,
    loadMore,
    refresh,
    setData: setDeals,
  } = usePagination<Deal>({ fetchFn: fetchDeals });

  const {
    deleteIds,
    deleteDialogOpen,
    deleting,
    requestDelete: handleBulkDelete,
    cancelDelete,
    confirmDelete,
  } = useOptimisticDelete({
    data: deals,
    setData: setDeals,
    endpoint: '/api/deals',
    entityName: 'deals',
  });

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const getDealsByStage = (stage: string) => deals.filter(d => d.stage === stage);
  const totalPipelineValue = deals.reduce((sum, d) => sum + (d.value ?? 0), 0);

  const columns: ColumnDef<Deal>[] = useMemo(() => [
    {
      key: 'name',
      header: 'Deal',
      accessor: (deal) => deal.name,
      render: (deal) => <span className="font-medium text-white">{deal.name}</span>,
    },
    {
      key: 'company',
      header: 'Company',
      accessor: (deal) => getCompanyName(deal),
      render: (deal) => <span className="text-gray-400">{getCompanyName(deal)}</span>,
    },
    {
      key: 'value',
      header: 'Value',
      accessor: (deal) => deal.value ?? 0,
      render: (deal) => (
        <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
          <DollarSign className="w-4 h-4" />
          {(deal.value ?? 0).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'stage',
      header: 'Stage',
      accessor: (deal) => deal.stage ?? 'prospecting',
      render: (deal) => getStageBadge(deal.stage ?? 'prospecting'),
    },
    {
      key: 'probability',
      header: 'Probability',
      accessor: (deal) => deal.probability ?? 0,
      render: (deal) => (
        <div className="flex items-center gap-2">
          <div className="w-16 h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
              style={{ width: `${deal.probability ?? 0}%` }}
            />
          </div>
          <span className="text-gray-400 text-sm">{deal.probability ?? 0}%</span>
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      sortable: false,
      exportable: false,
      render: (deal) => (
        <button
          onClick={() => router.push(`/deals/${deal.id}`)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-emerald-500/50 text-gray-400 hover:text-white rounded-lg transition-all text-sm"
        >
          <Eye className="w-4 h-4" />
          View
        </button>
      ),
    },
  ], [router]);

  const bulkActions: BulkAction<Deal>[] = useMemo(() => [
    {
      key: 'delete',
      label: 'Delete',
      icon: <Trash2 className="w-4 h-4" />,
      variant: 'destructive',
      onAction: handleBulkDelete,
    },
  ], [handleBulkDelete]);

  if (loading && deals.length === 0) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading deals...</span>
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
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/25">
            <Briefcase className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Deals Pipeline</h1>
            <p className="text-gray-400 text-sm">{deals.length} deals &bull; ${totalPipelineValue.toLocaleString()} total value</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex gap-1 p-1 bg-white/5 border border-white/10 rounded-xl">
            <button
              onClick={() => setView('pipeline')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                view === 'pipeline'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/25'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              Pipeline
            </button>
            <button
              onClick={() => setView('list')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                view === 'list'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/25'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <List className="w-4 h-4" />
              List
            </button>
          </div>

          <button
            onClick={() => router.push(`/deals/new`)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-emerald-500/25"
          >
            <Plus className="w-5 h-5" />
            New Deal
          </button>
        </div>
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

      {view === 'pipeline' ? (
        <>
          {/* Pipeline View — unchanged from original */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4"
          >
            {DEAL_STAGES.map((stage, stageIdx) => {
              const stageDeals = getDealsByStage(stage);
              const stageValue = stageDeals.reduce((sum, d) => sum + (d.value ?? 0), 0);
              const colors = STAGE_COLORS[stage];

              return (
                <motion.div
                  key={stage}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: stageIdx * 0.05 }}
                  className="rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 overflow-hidden"
                >
                  {/* Stage Header */}
                  <div className={`p-4 bg-gradient-to-r ${colors.bg} border-b border-white/10`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{colors.icon}</span>
                      <h3 className="font-semibold text-white text-sm capitalize">{stage.replace('_', ' ')}</h3>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <span>{stageDeals.length} deals</span>
                      <span>&bull;</span>
                      <span className="text-emerald-400 font-medium">${stageValue.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Deal Cards */}
                  <div className="p-3 space-y-2 max-h-96 overflow-y-auto">
                    {stageDeals.length === 0 ? (
                      <div className="text-center py-6 text-gray-500 text-sm">
                        No deals
                      </div>
                    ) : (
                      stageDeals.map((deal, idx) => (
                        <motion.div
                          key={deal.id}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: idx * 0.02 }}
                          onClick={() => router.push(`/deals/${deal.id}`)}
                          className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-emerald-500/30 rounded-xl p-3 cursor-pointer transition-all group"
                        >
                          <div className="font-medium text-white text-sm mb-1 group-hover:text-emerald-300 transition-colors">
                            {deal.name}
                          </div>
                          <div className="text-xs text-gray-500 mb-2">{getCompanyName(deal)}</div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-emerald-400">${(deal.value ?? 0).toLocaleString()}</span>
                            <span className="text-xs text-gray-500">{deal.probability ?? 0}%</span>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>

          {/* Load More */}
          {(hasMore || loading) && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={() => void loadMore()}
                disabled={loading || !hasMore}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading...
                  </>
                ) : hasMore ? (
                  <>
                    <ChevronDown className="w-4 h-4" />
                    Load More ({deals.length} shown)
                  </>
                ) : (
                  'All deals loaded'
                )}
              </button>
            </div>
          )}
        </>
      ) : (
        /* List View — DataTable */
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <DataTable
            columns={columns}
            data={deals}
            loading={loading}
            searchPlaceholder="Search deals..."
            searchFilter={(deal, query) => {
              const name = deal.name.toLowerCase();
              const company = getCompanyName(deal).toLowerCase();
              return name.includes(query) || company.includes(query);
            }}
            bulkActions={bulkActions}
            enableCsvExport
            csvFilename="deals"
            hasMore={hasMore}
            onLoadMore={() => void loadMore()}
            itemCountLabel={`${deals.length} shown`}
            emptyMessage="No deals found"
            emptyIcon={<Target className="w-8 h-8 text-gray-500" />}
            accentColor="emerald"
          />
        </motion.div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onClose={cancelDelete}
        onConfirm={confirmDelete}
        title="Delete Deals"
        description={`Are you sure you want to delete ${deleteIds.length} deal${deleteIds.length === 1 ? '' : 's'}? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        loading={deleting}
      />
    </div>
  );
}
