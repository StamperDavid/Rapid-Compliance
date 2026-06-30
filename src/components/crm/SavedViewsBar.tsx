'use client';

/**
 * SavedViewsBar — a row of saved-view "tabs" above a CRM list.
 *
 * Shows an "All" tab plus one tab per saved view for the current object, a
 * "＋ New view" button, and edit/delete affordances on the active view. Loads
 * views from /api/crm/views?object=… and reports the selected view id (or null
 * for "All") to the parent via onSelect — the parent then passes that id to its
 * list fetch as `?viewId=…`, which makes the server return filtered rows.
 *
 * Self-contained: it owns its own data loading and the FilterBuilderDialog.
 */

import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, ListFilter, Loader2 } from 'lucide-react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import FilterBuilderDialog from '@/components/crm/FilterBuilderDialog';
import type { SavedView, SavedViewObject, FilterFieldDef } from '@/types/saved-view';

interface SavedViewsBarProps {
  object: SavedViewObject;
  /** Filterable fields for this object, passed to the builder dialog. */
  fields: FilterFieldDef[];
  /** The currently-active view id (null = "All"). Controlled by the parent. */
  activeViewId: string | null;
  /** Called with the selected view id (or null for "All"). */
  onSelect: (viewId: string | null) => void;
}

export default function SavedViewsBar({ object, fields, activeViewId, onSelect }: SavedViewsBarProps) {
  const authFetch = useAuthFetch();
  const [views, setViews] = useState<SavedView[]>([]);
  const [loading, setLoading] = useState(true);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingView, setEditingView] = useState<SavedView | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SavedView | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadViews = useCallback(async () => {
    try {
      setLoading(true);
      const response = await authFetch(`/api/crm/views?object=${object}`);
      if (!response.ok) { throw new Error('Failed to load views'); }
      const result = (await response.json()) as { data?: SavedView[] };
      setViews(Array.isArray(result.data) ? result.data : []);
    } catch {
      setViews([]);
    } finally {
      setLoading(false);
    }
  }, [authFetch, object]);

  useEffect(() => {
    void loadViews();
  }, [loadViews]);

  const activeView = views.find((v) => v.id === activeViewId) ?? null;

  const handleNew = () => {
    setEditingView(null);
    setBuilderOpen(true);
  };

  const handleEdit = () => {
    if (activeView) {
      setEditingView(activeView);
      setBuilderOpen(true);
    }
  };

  const handleSaved = (view: SavedView) => {
    void loadViews();
    onSelect(view.id);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) { return; }
    setDeleting(true);
    try {
      await authFetch(`/api/crm/views/${deleteTarget.id}`, { method: 'DELETE' });
      if (activeViewId === deleteTarget.id) { onSelect(null); }
      setDeleteTarget(null);
      await loadViews();
    } finally {
      setDeleting(false);
    }
  };

  const tabBase =
    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border';
  const tabActive = 'bg-primary text-primary-foreground border-primary';
  const tabIdle = 'bg-surface-elevated text-muted-foreground border-border-light hover:text-foreground hover:border-primary';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ListFilter className="w-4 h-4 text-muted-foreground" />

      <button
        type="button"
        onClick={() => onSelect(null)}
        className={`${tabBase} ${activeViewId === null ? tabActive : tabIdle}`}
      >
        All
      </button>

      {views.map((view) => (
        <button
          key={view.id}
          type="button"
          onClick={() => onSelect(view.id)}
          className={`${tabBase} ${activeViewId === view.id ? tabActive : tabIdle}`}
        >
          {view.name}
          {view.shared && <span className="text-[10px] opacity-70">(shared)</span>}
        </button>
      ))}

      {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}

      {activeView && (
        <>
          <button
            type="button"
            onClick={handleEdit}
            aria-label="Edit view"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setDeleteTarget(activeView)}
            aria-label="Delete view"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-error hover:bg-error/10 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </>
      )}

      <button
        type="button"
        onClick={handleNew}
        className={`${tabBase} ${tabIdle} border-dashed`}
      >
        <Plus className="w-4 h-4" />
        New view
      </button>

      <FilterBuilderDialog
        open={builderOpen}
        onClose={() => setBuilderOpen(false)}
        object={object}
        fields={fields}
        existingView={editingView}
        onSaved={handleSaved}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
        title="Delete view"
        description={`Delete the "${deleteTarget?.name ?? ''}" view? This only removes the saved filter — none of your records are affected.`}
        confirmLabel="Delete view"
        variant="destructive"
        loading={deleting}
      />
    </div>
  );
}
