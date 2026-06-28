'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import SubpageNav from '@/components/ui/SubpageNav';
import { DEALS_TABS } from '@/lib/constants/subpage-nav';
import { useAuth } from '@/hooks/useAuth';
import { useAuthFetch } from '@/hooks/useAuthFetch';
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
import { PageTitle, SectionDescription } from '@/components/ui/typography';
import PipelineBoard, { type Deal } from './PipelineBoard';

const DEAL_STAGES = ['prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];

const STAGE_COLORS: Record<string, { bgStyle: React.CSSProperties; borderStyle: React.CSSProperties; textStyle: React.CSSProperties; icon: string }> = {
  prospecting: {
    bgStyle: { background: 'linear-gradient(to right, rgba(var(--color-info-rgb), 0.2), rgba(var(--color-info-rgb), 0.15))' },
    borderStyle: { borderColor: 'rgba(var(--color-info-rgb), 0.3)' },
    textStyle: { color: 'var(--color-info)' },
    icon: '🎯'
  },
  qualification: {
    bgStyle: { background: 'linear-gradient(to right, rgba(var(--color-secondary-rgb), 0.2), rgba(var(--color-secondary-rgb), 0.15))' },
    borderStyle: { borderColor: 'rgba(var(--color-secondary-rgb), 0.3)' },
    textStyle: { color: 'var(--color-secondary)' },
    icon: '📋'
  },
  proposal: {
    bgStyle: { background: 'linear-gradient(to right, rgba(var(--color-warning-rgb), 0.2), rgba(var(--color-warning-rgb), 0.15))' },
    borderStyle: { borderColor: 'rgba(var(--color-warning-rgb), 0.3)' },
    textStyle: { color: 'var(--color-warning)' },
    icon: '📝'
  },
  negotiation: {
    bgStyle: { background: 'linear-gradient(to right, rgba(var(--color-warning-rgb), 0.2), rgba(var(--color-warning-rgb), 0.15))' },
    borderStyle: { borderColor: 'rgba(var(--color-warning-rgb), 0.3)' },
    textStyle: { color: 'var(--color-warning)' },
    icon: '🤝'
  },
  closed_won: {
    bgStyle: { background: 'linear-gradient(to right, rgba(var(--color-success-rgb), 0.2), rgba(var(--color-success-rgb), 0.15))' },
    borderStyle: { borderColor: 'rgba(var(--color-success-rgb), 0.3)' },
    textStyle: { color: 'var(--color-success)' },
    icon: '🎉'
  },
  closed_lost: {
    bgStyle: { background: 'linear-gradient(to right, rgba(var(--color-error-rgb), 0.2), rgba(var(--color-error-rgb), 0.15))' },
    borderStyle: { borderColor: 'rgba(var(--color-error-rgb), 0.3)' },
    textStyle: { color: 'var(--color-error)' },
    icon: '❌'
  },
};

const getCompanyName = (deal: Deal) => {
  return deal.company ?? deal.companyName ?? '-';
};

const getStageBadge = (stage: string) => {
  const colors = STAGE_COLORS[stage] || STAGE_COLORS.prospecting;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border capitalize" style={{ ...colors.bgStyle, ...colors.borderStyle, ...colors.textStyle }}>
      {stage.replace('_', ' ')}
    </span>
  );
};

export default function DealsPage() {
  const router = useRouter();
  const { loading: authLoading } = useAuth();
  const authFetch = useAuthFetch();
  const [view, setView] = useState<'pipeline' | 'list'>('pipeline');

  const fetchDeals = useCallback(async (lastDoc?: unknown) => {
    const searchParams = new URLSearchParams({
      pageSize: '100'
    });

    if (lastDoc) {
      searchParams.set('lastDoc', String(lastDoc));
    }

    const response = await authFetch(`/api/deals?${searchParams}`);

    if (!response.ok) {
      throw new Error('Failed to fetch deals');
    }

    return response.json() as Promise<{ data: Deal[]; lastDoc: unknown; hasMore: boolean }>;
  }, [authFetch]);

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
    // Wait for Firebase auth to restore session before making API calls
    if (authLoading) { return; }
    void refresh();
  }, [refresh, authLoading]);

  const totalPipelineValue = deals.reduce((sum, d) => sum + (d.value ?? 0), 0);

  const moveDealToStage = useCallback(async (dealId: string, stage: string): Promise<boolean> => {
    try {
      const response = await authFetch(`/api/deals/${dealId}/stage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage }),
      });
      return response.ok;
    } catch {
      return false;
    }
  }, [authFetch]);

  const columns: ColumnDef<Deal>[] = useMemo(() => [
    {
      key: 'name',
      header: 'Deal',
      accessor: (deal) => deal.name,
      render: (deal) => <span className="font-medium text-foreground">{deal.name}</span>,
    },
    {
      key: 'company',
      header: 'Company',
      accessor: (deal) => getCompanyName(deal),
      render: (deal) => <span className="text-muted-foreground">{getCompanyName(deal)}</span>,
    },
    {
      key: 'value',
      header: 'Value',
      accessor: (deal) => deal.value ?? 0,
      render: (deal) => (
        <span className="inline-flex items-center gap-1 text-primary font-semibold">
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
          <div className="w-16 h-2 bg-surface-elevated rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-secondary rounded-full"
              style={{ width: `${deal.probability ?? 0}%` }}
            />
          </div>
          <span className="text-muted-foreground text-sm">{deal.probability ?? 0}%</span>
        </div>
      ),
    },
    {
      key: 'source',
      header: 'Source',
      accessor: (deal) => deal.source ?? '',
      render: (deal) => {
        const src = deal.source ?? '';
        return src ? (
          <span className="px-2 py-0.5 rounded-lg text-xs font-medium bg-primary/10 border border-primary/20 text-primary capitalize">
            {src}
          </span>
        ) : <span className="text-muted-foreground text-xs">-</span>;
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      sortable: false,
      exportable: false,
      render: (deal) => (
        <button
          onClick={() => router.push(`/deals/${deal.id}`)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-elevated hover:bg-surface-elevated border border-border-light hover:border-primary text-muted-foreground hover:text-foreground rounded-lg transition-all text-sm"
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
      <div className="bg-surface-main flex items-center justify-center py-24">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading deals...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <SubpageNav items={DEALS_TABS} />
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/25">
            <Briefcase className="w-6 h-6 text-white" />
          </div>
          <div>
            <PageTitle>Deals Pipeline</PageTitle>
            <SectionDescription>{deals.length} deals &bull; ${totalPipelineValue.toLocaleString()} total value</SectionDescription>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex gap-1 p-1 bg-surface-elevated border border-border-light rounded-xl">
            <button
              onClick={() => setView('pipeline')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                view === 'pipeline'
                  ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-lg shadow-primary/25'
                  : 'text-muted-foreground hover:text-foreground hover:bg-surface-elevated'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              Pipeline
            </button>
            <button
              onClick={() => setView('list')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                view === 'list'
                  ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-lg shadow-primary/25'
                  : 'text-muted-foreground hover:text-foreground hover:bg-surface-elevated'
              }`}
            >
              <List className="w-4 h-4" />
              List
            </button>
          </div>

          <button
            onClick={() => router.push(`/deals/new`)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary to-secondary hover:from-primary-light hover:to-secondary-light text-white font-semibold rounded-xl transition-all shadow-lg shadow-primary/25"
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
          className="mb-6 p-4 rounded-xl border border-error/20 flex items-center gap-3"
          style={{ backgroundColor: 'rgba(var(--color-error-rgb), 0.1)' }}
        >
          <AlertCircle className="w-5 h-5 text-error flex-shrink-0" />
          <span className="text-error-light">{error}</span>
        </motion.div>
      )}

      {view === 'pipeline' ? (
        <>
          {/* Pipeline View — drag a deal card between stage columns to change its stage */}
          <PipelineBoard
            stages={DEAL_STAGES}
            stageColors={STAGE_COLORS}
            deals={deals}
            getCompanyName={getCompanyName}
            setDeals={setDeals}
            onMoveDeal={moveDealToStage}
            onOpenDeal={(dealId) => router.push(`/deals/${dealId}`)}
          />

          {/* Load More */}
          {(hasMore || loading) && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={() => void loadMore()}
                disabled={loading || !hasMore}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-surface-elevated hover:bg-surface-elevated border border-border-light text-muted-foreground hover:text-foreground rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
            emptyIcon={<Target className="w-8 h-8 text-muted-foreground" />}
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
