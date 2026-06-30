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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PipelineBoard, { type Deal } from './PipelineBoard';
import ImportCsvModal from '@/components/crm/ImportCsvModal';
import SavedViewsBar from '@/components/crm/SavedViewsBar';
import type { FilterFieldDef } from '@/types/saved-view';
import {
  type Pipeline,
  type PipelineStage,
  DEFAULT_PIPELINE_ID,
  DEFAULT_PIPELINE_STAGES,
} from '@/lib/crm/pipeline-types';

const DEAL_FILTER_FIELDS: FilterFieldDef[] = [
  { value: 'name', label: 'Deal name' },
  { value: 'value', label: 'Value', type: 'number' },
  { value: 'stage', label: 'Stage' },
  { value: 'probability', label: 'Probability', type: 'number' },
  { value: 'company', label: 'Company' },
  { value: 'source', label: 'Source' },
];

type StageColor = { bgStyle: React.CSSProperties; borderStyle: React.CSSProperties; textStyle: React.CSSProperties; icon: string };

const STAGE_COLORS: Record<string, StageColor> = {
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

/** Default look for any stage we don't have a bespoke color for. */
const DEFAULT_STAGE_COLOR: StageColor = STAGE_COLORS.prospecting;

/** Palette cycled through for custom "open" stages that aren't one of the six defaults. */
const OPEN_STAGE_PALETTE: StageColor[] = [
  STAGE_COLORS.prospecting,
  STAGE_COLORS.qualification,
  STAGE_COLORS.proposal,
  STAGE_COLORS.negotiation,
];

/**
 * Build a color map keyed by stage key for the given pipeline stages. The six
 * default stages keep their original colors; custom stages get a color by
 * type (won/lost) or a cycled palette entry so every column renders.
 */
function buildStageColors(stages: PipelineStage[]): Record<string, StageColor> {
  const map: Record<string, StageColor> = {};
  let openIdx = 0;
  for (const stage of stages) {
    if (STAGE_COLORS[stage.key]) {
      map[stage.key] = STAGE_COLORS[stage.key];
    } else if (stage.type === 'won') {
      map[stage.key] = STAGE_COLORS.closed_won;
    } else if (stage.type === 'lost') {
      map[stage.key] = STAGE_COLORS.closed_lost;
    } else {
      map[stage.key] = OPEN_STAGE_PALETTE[openIdx % OPEN_STAGE_PALETTE.length];
      openIdx += 1;
    }
  }
  return map;
}

const getCompanyName = (deal: Deal) => {
  return deal.company ?? deal.companyName ?? '-';
};

const getStageBadge = (label: string, colors: StageColor) => {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border" style={{ ...colors.bgStyle, ...colors.borderStyle, ...colors.textStyle }}>
      {label}
    </span>
  );
};

export default function DealsPage() {
  const router = useRouter();
  const { loading: authLoading } = useAuth();
  const authFetch = useAuthFetch();
  const [view, setView] = useState<'pipeline' | 'list'>('pipeline');
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>(DEFAULT_PIPELINE_ID);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);

  const fetchPipelines = useCallback(async () => {
    try {
      const response = await authFetch('/api/crm/pipelines');
      if (!response.ok) { return; }
      const json = (await response.json()) as { success?: boolean; pipelines?: Pipeline[] };
      if (json.success && json.pipelines && json.pipelines.length > 0) {
        const loaded = json.pipelines;
        setPipelines(loaded);
        // Keep the current selection if it still exists, else pick the default.
        setSelectedPipelineId((prev) =>
          loaded.some((p) => p.id === prev)
            ? prev
            : (loaded.find((p) => p.isDefault)?.id ?? loaded[0].id)
        );
      }
    } catch {
      // Leave the default-pipeline fallback in place so the board still renders.
    }
  }, [authFetch]);

  const fetchDeals = useCallback(async (lastDoc?: unknown) => {
    const searchParams = new URLSearchParams({
      pageSize: '100'
    });

    if (lastDoc) {
      searchParams.set('lastDoc', String(lastDoc));
    }

    if (activeViewId) {
      searchParams.set('viewId', activeViewId);
    }

    const response = await authFetch(`/api/deals?${searchParams}`);

    if (!response.ok) {
      throw new Error('Failed to fetch deals');
    }

    return response.json() as Promise<{ data: Deal[]; lastDoc: unknown; hasMore: boolean }>;
  }, [authFetch, activeViewId]);

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
    void fetchPipelines();
  }, [refresh, fetchPipelines, authLoading]);

  const selectedPipeline = useMemo(
    () => pipelines.find((p) => p.id === selectedPipelineId) ?? null,
    [pipelines, selectedPipelineId]
  );

  // Stages for the selected pipeline, sorted left-to-right. Falls back to the
  // six default stages before the pipelines list has loaded.
  const boardStages: PipelineStage[] = useMemo(() => {
    const stages = selectedPipeline?.stages ?? DEFAULT_PIPELINE_STAGES;
    return [...stages].sort((a, b) => a.order - b.order);
  }, [selectedPipeline]);

  const stageColorMap = useMemo(() => buildStageColors(boardStages), [boardStages]);
  const stageLabelMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const stage of boardStages) { map[stage.key] = stage.label; }
    return map;
  }, [boardStages]);

  // Deals belonging to the selected pipeline. Deals with no pipelineId belong
  // to the default pipeline, so they show up when the default is selected.
  const visibleDeals = useMemo(
    () => deals.filter((d) => (d.pipelineId ?? DEFAULT_PIPELINE_ID) === selectedPipelineId),
    [deals, selectedPipelineId]
  );

  const boardStagesForBoard = useMemo(
    () => boardStages.map((s) => ({ key: s.key, label: s.label })),
    [boardStages]
  );

  const totalPipelineValue = visibleDeals.reduce((sum, d) => sum + (d.value ?? 0), 0);

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
      accessor: (deal) => stageLabelMap[deal.stage ?? ''] ?? deal.stage ?? 'prospecting',
      render: (deal) => {
        const key = deal.stage ?? 'prospecting';
        const label = stageLabelMap[key] ?? key.replace('_', ' ');
        return getStageBadge(label, stageColorMap[key] ?? DEFAULT_STAGE_COLOR);
      },
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
  ], [router, stageLabelMap, stageColorMap]);

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
            <SectionDescription>{visibleDeals.length} deals &bull; ${totalPipelineValue.toLocaleString()} total value</SectionDescription>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Pipeline Selector — switch which pipeline's stages the board shows */}
          {pipelines.length > 0 && (
            <Select value={selectedPipelineId} onValueChange={setSelectedPipelineId}>
              <SelectTrigger className="w-56" aria-label="Choose a pipeline">
                <SelectValue placeholder="Select a pipeline">
                  {selectedPipeline?.name ?? 'Select a pipeline'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {pipelines.map((pipeline) => (
                  <SelectItem key={pipeline.id} value={pipeline.id}>
                    {pipeline.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

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

          <ImportCsvModal object="deal" onImported={() => void refresh()} />

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

      <SavedViewsBar
        object="deal"
        fields={DEAL_FILTER_FIELDS}
        activeViewId={activeViewId}
        onSelect={setActiveViewId}
      />

      {view === 'pipeline' ? (
        <>
          {/* Pipeline View — drag a deal card between stage columns to change its stage */}
          <PipelineBoard
            stages={boardStagesForBoard}
            stageColors={stageColorMap}
            deals={visibleDeals}
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
            data={visibleDeals}
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
