'use client';

/**
 * MediaFolderNav — folder tree sidebar for the Media Library page.
 *
 * Renders:
 *   - "All media" and "Unfiled" fixed roots
 *   - A nested tree built from the flat `MediaFolder[]` list (parentFolderId)
 *   - New folder button (creates at the current active folder or root)
 *   - Per-folder kebab menu: rename + two-step delete
 *
 * All data fetching / mutation is done here via `useAuthFetch`.
 * The parent page only needs to react to `onSelectFolder` to update its query.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  X,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Caption } from '@/components/ui/typography';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { type MediaFolder } from '@/types/media-library';

// ============================================================================
// Types
// ============================================================================

export type FolderSelection =
  | { kind: 'all' }
  | { kind: 'unfiled' }
  | { kind: 'folder'; id: string };

interface FolderApiListResponse {
  success: boolean;
  folders: MediaFolder[];
}

interface FolderApiSingleResponse {
  success: boolean;
  folder: MediaFolder;
  error?: string;
}

interface FolderApiDeleteResponse {
  success: boolean;
  error?: string;
}

interface TreeNode {
  folder: MediaFolder;
  children: TreeNode[];
}

// ============================================================================
// Helpers
// ============================================================================

const DISARM_MS = 5000;

function buildTree(folders: MediaFolder[]): TreeNode[] {
  const byId = new Map<string, TreeNode>();
  for (const f of folders) {
    byId.set(f.id, { folder: f, children: [] });
  }
  const roots: TreeNode[] = [];
  for (const node of byId.values()) {
    const pid = node.folder.parentFolderId ?? null;
    const parent = pid ? byId.get(pid) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }
  // Sort each level alphabetically for stable display
  const sort = (nodes: TreeNode[]): TreeNode[] =>
    nodes
      .sort((a, b) => a.folder.name.localeCompare(b.folder.name))
      .map((n) => ({ ...n, children: sort(n.children) }));
  return sort(roots);
}

/** Walk the folder list to build the breadcrumb path from root to `id`. */
export function buildBreadcrumb(
  folders: MediaFolder[],
  id: string,
): MediaFolder[] {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const path: MediaFolder[] = [];
  let cur = byId.get(id);
  while (cur) {
    path.unshift(cur);
    cur = cur.parentFolderId ? byId.get(cur.parentFolderId) : undefined;
  }
  return path;
}

// ============================================================================
// FolderRow — one tree node (recursive)
// ============================================================================

interface FolderRowProps {
  node: TreeNode;
  depth: number;
  activeFolderId: string | null;
  onSelect: (id: string) => void;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  renamingId: string | null;
  setRenamingId: (id: string | null) => void;
}

function FolderRow({
  node,
  depth,
  activeFolderId,
  onSelect,
  onRename,
  onDelete,
  renamingId,
  setRenamingId,
}: FolderRowProps) {
  const { folder, children } = node;
  const isActive = activeFolderId === folder.id;
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Two-step delete
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const disarmRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Rename inline
  const [draftName, setDraftName] = useState(folder.name);
  const isRenaming = renamingId === folder.id;

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  // Auto-expand when a child is active
  useEffect(() => {
    if (isActive) {
      setExpanded(true);
    }
  }, [isActive]);

  const armDelete = () => {
    setDeleteArmed(true);
    if (disarmRef.current) {
      clearTimeout(disarmRef.current);
    }
    disarmRef.current = setTimeout(() => {
      setDeleteArmed(false);
      disarmRef.current = null;
    }, DISARM_MS);
  };

  const cancelArm = () => {
    setDeleteArmed(false);
    if (disarmRef.current) {
      clearTimeout(disarmRef.current);
      disarmRef.current = null;
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(folder.id);
    } finally {
      setDeleting(false);
      setDeleteArmed(false);
      if (disarmRef.current) {
        clearTimeout(disarmRef.current);
        disarmRef.current = null;
      }
    }
  };

  const commitRename = async () => {
    const next = draftName.trim();
    if (next && next !== folder.name) {
      await onRename(folder.id, next);
    }
    setRenamingId(null);
  };

  const indent = depth * 12;

  return (
    <div>
      <div
        className={`group relative flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm transition-colors ${
          isActive
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-surface-elevated hover:text-foreground'
        }`}
        style={{ paddingLeft: `${8 + indent}px` }}
      >
        {/* Expand / collapse toggle */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0 p-0.5 text-muted-foreground hover:text-foreground"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {children.length > 0 ? (
            expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )
          ) : (
            <span className="inline-block h-3.5 w-3.5" />
          )}
        </button>

        {/* Folder icon + name / rename input */}
        {isRenaming ? (
          <div className="flex flex-1 items-center gap-1 min-w-0">
            <Input
              autoFocus
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void commitRename();
                }
                if (e.key === 'Escape') {
                  setRenamingId(null);
                }
              }}
              className="h-6 flex-1 px-1.5 py-0 text-xs"
            />
            <button
              type="button"
              onClick={() => { void commitRename(); }}
              aria-label="Save rename"
              className="shrink-0 rounded p-0.5 text-primary hover:bg-primary/10"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setRenamingId(null)}
              aria-label="Cancel rename"
              className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-surface-elevated"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onSelect(folder.id)}
            className="flex flex-1 items-center gap-1.5 min-w-0 text-left"
          >
            {isActive ? (
              <FolderOpen className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <Folder className="h-3.5 w-3.5 shrink-0" />
            )}
            <span className="truncate text-xs font-medium">{folder.name}</span>
          </button>
        )}

        {/* Delete armed inline confirmation */}
        {deleteArmed && !isRenaming && (
          <div className="flex items-center gap-1 ml-1 shrink-0">
            <button
              type="button"
              disabled={deleting}
              onClick={() => { void confirmDelete(); }}
              className="rounded bg-destructive px-1.5 py-0.5 text-[10px] font-medium text-white hover:bg-destructive/80 disabled:opacity-50"
            >
              {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Delete'}
            </button>
            <button
              type="button"
              onClick={cancelArm}
              className="rounded bg-surface-elevated px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Kebab menu — shown on hover unless armed or renaming */}
        {!deleteArmed && !isRenaming && (
          <div className="relative shrink-0" ref={menuRef}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((v) => !v);
              }}
              aria-label="Folder options"
              className="rounded p-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-surface-elevated hover:text-foreground transition-opacity"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full z-50 mt-1 w-36 rounded-lg border border-border-strong bg-card shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setDraftName(folder.name);
                    setRenamingId(folder.id);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-surface-elevated"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Rename
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    armDelete();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete folder
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Children */}
      {expanded && children.length > 0 && (
        <div>
          {children.map((child) => (
            <FolderRow
              key={child.folder.id}
              node={child}
              depth={depth + 1}
              activeFolderId={activeFolderId}
              onSelect={onSelect}
              onRename={onRename}
              onDelete={onDelete}
              renamingId={renamingId}
              setRenamingId={setRenamingId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MediaFolderNav — the main export
// ============================================================================

interface MediaFolderNavProps {
  selection: FolderSelection;
  onSelect: (sel: FolderSelection) => void;
  /** Called with the full updated folder list after every create/rename/delete. */
  onFoldersChange?: (folders: MediaFolder[]) => void;
}

export function MediaFolderNav({ selection, onSelect, onFoldersChange }: MediaFolderNavProps) {
  const authFetch = useAuthFetch();

  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New folder inline creation
  const [creating, setCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [saving, setSaving] = useState(false);

  // Rename state — tracked here so only one rename is active at a time
  const [renamingId, setRenamingId] = useState<string | null>(null);

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchFolders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch('/api/media-folders');
      if (!res.ok) {
        setError(`Could not load folders (${res.status})`);
        return;
      }
      const data = (await res.json()) as FolderApiListResponse;
      const list = data.folders ?? [];
      setFolders(list);
      onFoldersChange?.(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load folders');
    } finally {
      setLoading(false);
    }
  }, [authFetch, onFoldersChange]);

  useEffect(() => {
    void fetchFolders();
  }, [fetchFolders]);

  // ── Create folder ────────────────────────────────────────────────────────

  const handleCreate = useCallback(async () => {
    const name = newFolderName.trim();
    if (!name) {
      return;
    }
    const parentFolderId =
      selection.kind === 'folder' ? selection.id : null;
    setSaving(true);
    try {
      const res = await authFetch('/api/media-folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, parentFolderId }),
      });
      const data = (await res.json()) as FolderApiSingleResponse;
      if (!res.ok || !data.success) {
        setError(data.error ?? 'Could not create folder');
        return;
      }
      setNewFolderName('');
      setCreating(false);
      await fetchFolders();
      onSelect({ kind: 'folder', id: data.folder.id });
    } finally {
      setSaving(false);
    }
  }, [authFetch, fetchFolders, newFolderName, onSelect, selection]);

  // ── Rename folder ────────────────────────────────────────────────────────

  const handleRename = useCallback(
    async (id: string, name: string) => {
      const res = await authFetch(`/api/media-folders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = (await res.json()) as FolderApiSingleResponse;
      if (!res.ok || !data.success) {
        setError(data.error ?? 'Could not rename folder');
        return;
      }
      setFolders((prev) => {
        const next = prev.map((f) => (f.id === id ? data.folder : f));
        onFoldersChange?.(next);
        return next;
      });
    },
    [authFetch, onFoldersChange],
  );

  // ── Delete folder ────────────────────────────────────────────────────────

  const handleDelete = useCallback(
    async (id: string) => {
      const res = await authFetch(`/api/media-folders/${id}`, {
        method: 'DELETE',
      });
      const data = (await res.json()) as FolderApiDeleteResponse;
      if (!res.ok || !data.success) {
        setError(data.error ?? 'Could not delete folder');
        return;
      }
      setFolders((prev) => {
        const next = prev.filter((f) => f.id !== id);
        onFoldersChange?.(next);
        return next;
      });
      // If the deleted folder was active, fall back to All media
      if (selection.kind === 'folder' && selection.id === id) {
        onSelect({ kind: 'all' });
      }
    },
    [authFetch, onFoldersChange, onSelect, selection],
  );

  // ── Tree ─────────────────────────────────────────────────────────────────

  const tree = buildTree(folders);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <nav className="bg-card border border-border-strong rounded-2xl p-3 space-y-1">
      {/* Fixed roots */}
      <button
        type="button"
        onClick={() => onSelect({ kind: 'all' })}
        className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
          selection.kind === 'all'
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-surface-elevated hover:text-foreground'
        }`}
      >
        <FolderOpen className="h-3.5 w-3.5 shrink-0" />
        All media
      </button>

      {/* Divider */}
      {folders.length > 0 && (
        <div className="border-t border-border-light pt-1 mt-1" />
      )}

      {/* Folder tree */}
      {loading ? (
        <div className="flex items-center gap-2 px-2 py-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading folders…
        </div>
      ) : error ? (
        <Caption className="block px-2 py-1 text-destructive">{error}</Caption>
      ) : (
        tree.map((node) => (
          <FolderRow
            key={node.folder.id}
            node={node}
            depth={0}
            activeFolderId={
              selection.kind === 'folder' ? selection.id : null
            }
            onSelect={(id) => onSelect({ kind: 'folder', id })}
            onRename={handleRename}
            onDelete={handleDelete}
            renamingId={renamingId}
            setRenamingId={setRenamingId}
          />
        ))
      )}

      {/* New folder inline form */}
      {creating ? (
        <div className="flex items-center gap-1 px-2 pt-1">
          <Input
            autoFocus
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleCreate();
              }
              if (e.key === 'Escape') {
                setCreating(false);
                setNewFolderName('');
              }
            }}
            placeholder="Folder name"
            className="h-7 flex-1 text-xs px-2"
          />
          <Button
            size="sm"
            disabled={saving || !newFolderName.trim()}
            onClick={() => { void handleCreate(); }}
            className="h-7 px-2 text-xs"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={saving}
            onClick={() => {
              setCreating(false);
              setNewFolderName('');
            }}
            className="h-7 px-1"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-surface-elevated hover:text-foreground transition-colors"
        >
          <FolderPlus className="h-3.5 w-3.5 shrink-0" />
          New folder
        </button>
      )}

      {/* Expose the folder list so the page can do breadcrumbs + move menus */}
    </nav>
  );
}

// Re-export MediaFolder so page.tsx doesn't need a second import path
export type { MediaFolder };

// Export buildBreadcrumb — used by the page to render the breadcrumb bar
// (already exported above as a named export)
