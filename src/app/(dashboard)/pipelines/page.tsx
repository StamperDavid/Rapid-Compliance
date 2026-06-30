'use client';

/**
 * Pipelines — the management screen for multiple deal pipelines.
 *
 * Lets an operator create a pipeline, rename it, edit its stages (add / remove /
 * reorder / set probability + outcome type), and delete non-default pipelines.
 * Talks only to the real /api/crm/pipelines CRUD routes (Admin SDK), so what the
 * board reads is exactly what this screen writes.
 *
 * Two safety rules enforced in the UI (and again on the server):
 *  - The default pipeline can never be deleted.
 *  - Existing stage KEYS are never renamed — editing a stage's label keeps its
 *    key, so every deal already sitting on that stage keeps rendering.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import SubpageNav from '@/components/ui/SubpageNav';
import { DEALS_TABS } from '@/lib/constants/subpage-nav';
import { useAuth } from '@/hooks/useAuth';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageTitle, SectionDescription, CardTitle, Caption } from '@/components/ui/typography';
import { GitBranch, Plus, Pencil, Trash2, Loader2, AlertCircle, X } from 'lucide-react';
import { type Pipeline, type PipelineStage, DEFAULT_PIPELINE_ID } from '@/lib/crm/pipeline-types';

type StageType = 'open' | 'won' | 'lost';

/** One editable row in the stage editor. `key` is '' for not-yet-saved stages. */
interface StageDraft {
  rowId: number;
  key: string;
  label: string;
  probability: string;
  type: StageType;
}

const STAGE_TYPE_LABELS: Record<StageType, string> = {
  open: 'In progress',
  won: 'Won',
  lost: 'Lost',
};

const stageChipClass = (type: StageType | undefined): string => {
  if (type === 'won') { return 'bg-success/10 text-success border-success/20'; }
  if (type === 'lost') { return 'bg-error/10 text-error border-error/20'; }
  return 'bg-primary/10 text-primary border-primary/20';
};

/** Slugify a stage label into a stable key. Keys never change once saved. */
function slugify(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'stage';
}

export default function PipelinesPage() {
  const { loading: authLoading } = useAuth();
  const authFetch = useAuthFetch();

  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editor state (create when editingId is null, otherwise edit that pipeline).
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftStages, setDraftStages] = useState<StageDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);

  // Delete state.
  const [deleteTarget, setDeleteTarget] = useState<Pipeline | null>(null);
  const [deleting, setDeleting] = useState(false);

  const rowCounter = useRef(0);
  const nextRowId = useCallback(() => {
    rowCounter.current += 1;
    return rowCounter.current;
  }, []);

  const fetchPipelines = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await authFetch('/api/crm/pipelines');
      const json = (await response.json()) as { success?: boolean; pipelines?: Pipeline[]; error?: string };
      if (!response.ok || !json.success) {
        throw new Error(json.error ?? 'Failed to load pipelines');
      }
      setPipelines(json.pipelines ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pipelines');
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (authLoading) { return; }
    void fetchPipelines();
  }, [fetchPipelines, authLoading]);

  const toDraft = useCallback((stage: PipelineStage): StageDraft => ({
    rowId: nextRowId(),
    key: stage.key,
    label: stage.label,
    probability: stage.probability !== undefined ? String(stage.probability) : '',
    type: stage.type ?? 'open',
  }), [nextRowId]);

  const openCreate = useCallback(() => {
    setEditingId(null);
    setDraftName('');
    setDraftStages([
      { rowId: nextRowId(), key: '', label: 'New Stage', probability: '10', type: 'open' },
      { rowId: nextRowId(), key: '', label: 'Won', probability: '100', type: 'won' },
      { rowId: nextRowId(), key: '', label: 'Lost', probability: '0', type: 'lost' },
    ]);
    setEditorError(null);
    setEditorOpen(true);
  }, [nextRowId]);

  const openEdit = useCallback((pipeline: Pipeline) => {
    setEditingId(pipeline.id);
    setDraftName(pipeline.name);
    setDraftStages([...pipeline.stages].sort((a, b) => a.order - b.order).map(toDraft));
    setEditorError(null);
    setEditorOpen(true);
  }, [toDraft]);

  const updateStage = useCallback((rowId: number, patch: Partial<StageDraft>) => {
    setDraftStages((prev) => prev.map((s) => (s.rowId === rowId ? { ...s, ...patch } : s)));
  }, []);

  const addStage = useCallback(() => {
    setDraftStages((prev) => [
      ...prev,
      { rowId: nextRowId(), key: '', label: '', probability: '', type: 'open' },
    ]);
  }, [nextRowId]);

  const removeStage = useCallback((rowId: number) => {
    setDraftStages((prev) => (prev.length <= 1 ? prev : prev.filter((s) => s.rowId !== rowId)));
  }, []);

  const moveStage = useCallback((rowId: number, dir: -1 | 1) => {
    setDraftStages((prev) => {
      const idx = prev.findIndex((s) => s.rowId === rowId);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= prev.length) { return prev; }
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }, []);

  const handleSave = useCallback(async () => {
    setEditorError(null);
    const name = draftName.trim();
    if (!name) { setEditorError('Give the pipeline a name.'); return; }
    if (draftStages.some((s) => !s.label.trim())) {
      setEditorError('Every stage needs a name.');
      return;
    }

    // Build the stages payload. Existing keys are preserved; new stages get a
    // unique slug key so a deal can never collide onto another stage's key.
    const usedKeys = new Set<string>();
    const stages = draftStages.map((s, index) => {
      let key = s.key;
      if (!key) {
        const base = slugify(s.label);
        key = base;
        let n = 2;
        while (usedKeys.has(key)) { key = `${base}_${n}`; n += 1; }
      }
      usedKeys.add(key);
      const probabilityNum = s.probability.trim() === '' ? undefined : Number(s.probability);
      return {
        key,
        label: s.label.trim(),
        order: index,
        ...(probabilityNum !== undefined && Number.isFinite(probabilityNum)
          ? { probability: Math.min(100, Math.max(0, probabilityNum)) }
          : {}),
        type: s.type,
      };
    });

    try {
      setSaving(true);
      const url = editingId ? `/api/crm/pipelines/${editingId}` : '/api/crm/pipelines';
      const method = editingId ? 'PATCH' : 'POST';
      const response = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, stages }),
      });
      const json = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !json.success) {
        throw new Error(json.error ?? 'Could not save the pipeline.');
      }
      setEditorOpen(false);
      await fetchPipelines();
    } catch (err) {
      setEditorError(err instanceof Error ? err.message : 'Could not save the pipeline.');
    } finally {
      setSaving(false);
    }
  }, [authFetch, draftName, draftStages, editingId, fetchPipelines]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) { return; }
    try {
      setDeleting(true);
      setError(null);
      const response = await authFetch(`/api/crm/pipelines/${deleteTarget.id}`, { method: 'DELETE' });
      const json = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !json.success) {
        throw new Error(json.error ?? 'Could not delete the pipeline.');
      }
      setDeleteTarget(null);
      await fetchPipelines();
    } catch (err) {
      // Surface the server's plain-English reason (default pipeline / still has deals).
      setError(err instanceof Error ? err.message : 'Could not delete the pipeline.');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }, [authFetch, deleteTarget, fetchPipelines]);

  return (
    <div className="p-8 space-y-6">
      <SubpageNav items={DEALS_TABS} />

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/25">
            <GitBranch className="w-6 h-6 text-white" />
          </div>
          <div>
            <PageTitle>Pipelines</PageTitle>
            <SectionDescription>
              Build a sales process for each kind of deal. Each pipeline has its own stages.
            </SectionDescription>
          </div>
        </div>

        <Button onClick={openCreate}>
          <Plus className="w-5 h-5 mr-2" />
          New Pipeline
        </Button>
      </motion.div>

      {error && (
        <div className="p-4 rounded-xl border border-error/20 flex items-center gap-3 bg-error/5">
          <AlertCircle className="w-5 h-5 text-error flex-shrink-0" />
          <span className="text-error-light">{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mr-3" />
          Loading pipelines...
        </div>
      ) : pipelines.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          No pipelines yet. Create your first one to organize deals.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {pipelines.map((pipeline) => {
            const isDefault = pipeline.id === DEFAULT_PIPELINE_ID || pipeline.isDefault;
            const orderedStages = [...pipeline.stages].sort((a, b) => a.order - b.order);
            return (
              <div key={pipeline.id} className="bg-card border border-border-strong rounded-2xl p-6 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <CardTitle>{pipeline.name}</CardTitle>
                    {isDefault && (
                      <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-surface-elevated border border-border-light text-muted-foreground">
                        Default
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(pipeline)}>
                      <Pencil className="w-4 h-4 mr-1.5" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isDefault}
                      title={isDefault ? 'The default pipeline cannot be deleted' : 'Delete this pipeline'}
                      onClick={() => setDeleteTarget(pipeline)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {orderedStages.map((stage) => (
                    <span
                      key={stage.key}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${stageChipClass(stage.type)}`}
                    >
                      {stage.label}
                      {stage.probability !== undefined && (
                        <span className="opacity-70">{stage.probability}%</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create / Edit editor ─────────────────────────────────────────────── */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit pipeline' : 'New pipeline'}</DialogTitle>
            <DialogDescription>
              Name the pipeline and set its stages. Drag order with the arrows. Renaming a stage keeps
              any deals already on it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
            <div>
              <Caption className="mb-1.5 block">Pipeline name</Caption>
              <Input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="e.g. New Business, Renewals"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Caption>Stages</Caption>
                <Button variant="outline" size="sm" onClick={addStage}>
                  <Plus className="w-4 h-4 mr-1.5" />
                  Add stage
                </Button>
              </div>

              {draftStages.map((stage, index) => (
                <div
                  key={stage.rowId}
                  className="flex flex-col md:flex-row md:items-center gap-2 p-3 rounded-xl border border-border-light bg-surface-elevated"
                >
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => moveStage(stage.rowId, -1)}
                      disabled={index === 0}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30 leading-none"
                      aria-label="Move stage up"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => moveStage(stage.rowId, 1)}
                      disabled={index === draftStages.length - 1}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30 leading-none"
                      aria-label="Move stage down"
                    >
                      ▼
                    </button>
                  </div>

                  <Input
                    value={stage.label}
                    onChange={(e) => updateStage(stage.rowId, { label: e.target.value })}
                    placeholder="Stage name"
                    className="flex-1"
                  />

                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={stage.probability}
                      onChange={(e) => updateStage(stage.rowId, { probability: e.target.value })}
                      placeholder="%"
                      className="w-20"
                      aria-label="Win probability"
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>

                  <Select
                    value={stage.type}
                    onValueChange={(v) => updateStage(stage.rowId, { type: v as StageType })}
                  >
                    <SelectTrigger className="w-36" aria-label="Stage outcome">
                      <SelectValue>{STAGE_TYPE_LABELS[stage.type]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">In progress</SelectItem>
                      <SelectItem value="won">Won</SelectItem>
                      <SelectItem value="lost">Lost</SelectItem>
                    </SelectContent>
                  </Select>

                  <button
                    type="button"
                    onClick={() => removeStage(stage.rowId)}
                    disabled={draftStages.length <= 1}
                    className="text-muted-foreground hover:text-error disabled:opacity-30 p-1"
                    aria-label="Remove stage"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {editorError && (
              <div className="p-3 rounded-lg border border-error/20 flex items-center gap-2 bg-error/5">
                <AlertCircle className="w-4 h-4 text-error flex-shrink-0" />
                <span className="text-sm text-error-light">{editorError}</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                editingId ? 'Save changes' : 'Create pipeline'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
        title="Delete pipeline"
        description={`Delete "${deleteTarget?.name ?? ''}"? Deals must be moved off it first. This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        loading={deleting}
      />
    </div>
  );
}
