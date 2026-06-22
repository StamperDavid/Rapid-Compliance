'use client';

/**
 * Content Generator → Library hub → Media section — unified Media Library browser.
 *
 * Lists every `UnifiedMediaAsset` in the org with:
 *   - Filter sidebar (type chips, category multi-select, tag search,
 *     source filter, date range)
 *   - Search box (name / tags / aiPrompt)
 *   - Asset grid with thumbnails
 *   - Right-side detail panel on click — full metadata, tag editor,
 *     two-step delete (per `feedback_destructive_actions_two_step_confirmation`)
 *
 * All API calls go through the auth-aware `useAuthFetch` hook.
 *
 * Route history: this page used to live at /media as its own top-level
 * sidebar entry, then at /content/video/library as the Content Generator
 * "Library" tab. Media, Characters, and Locations were consolidated into ONE
 * Library tab with internal sections — this page now renders only its own
 * content; the Library layout supplies the two-level nav + page padding.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  PageTitle,
  SectionTitle,
  SectionDescription,
  Caption,
  CardTitle,
} from '@/components/ui/typography';
import {
  FolderOpen,
  Loader2,
  Search,
  Image as ImageIcon,
  Film,
  Music,
  FileText,
  X,
  Trash2,
  Tag as TagIcon,
  Plus,
  Sparkles,
  Upload,
  CheckCircle2,
  Square,
  CheckSquare,
  Play,
  Download,
  FolderPlus,
  Pencil,
  Eraser,
  Wand2,
  ChevronRight,
  Folder,
} from 'lucide-react';
import {
  MEDIA_CATEGORIES,
  type MediaAssetCategory,
  type MediaAssetSource,
  type MediaAssetType,
  type UnifiedMediaAsset,
  type MediaFolder,
} from '@/types/media-library';
import {
  AssetActionsMenu,
  BulkActionsBar,
  makeProjectId,
  type AssetActions,
  type CharacterOption,
  type ProjectOption,
} from '@/app/(dashboard)/content/video/library/AssetActionsMenu';
import {
  MediaFolderNav,
  buildBreadcrumb,
  type FolderSelection,
} from './MediaFolderNav';

// ============================================================================
// Constants
// ============================================================================

const TYPE_FILTERS: Array<{
  value: MediaAssetType | 'all';
  label: string;
  icon: React.ElementType;
}> = [
  { value: 'all', label: 'All', icon: FolderOpen },
  { value: 'image', label: 'Image', icon: ImageIcon },
  { value: 'video', label: 'Video', icon: Film },
  { value: 'audio', label: 'Audio', icon: Music },
  { value: 'document', label: 'Document', icon: FileText },
];

const SOURCE_FILTERS: Array<{ value: MediaAssetSource | 'all'; label: string }> = [
  { value: 'all', label: 'All sources' },
  { value: 'ai-generated', label: 'AI generated' },
  { value: 'user-upload', label: 'User upload' },
  { value: 'imported', label: 'Imported' },
  { value: 'derived', label: 'Derived' },
];

// 5 second auto-disarm window per destructive_actions_two_step_confirmation
const DISARM_TIMEOUT_MS = 5000;

// Short, all-caps TYPE badge label per asset type.
const TYPE_BADGE_LABEL: Record<MediaAssetType, string> = {
  image: 'IMAGE',
  video: 'VIDEO',
  audio: 'AUDIO',
  document: 'DOC',
};

// ============================================================================
// Helpers
// ============================================================================

function formatFileSize(bytes: number): string {
  if (!bytes) {
    return '';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  if (!iso) {
    return '';
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return '';
  }
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function typeIcon(type: MediaAssetType): React.ElementType {
  switch (type) {
    case 'video':
      return Film;
    case 'audio':
      return Music;
    case 'document':
      return FileText;
    default:
      return ImageIcon;
  }
}

/** Common MIME → file-extension map for the asset types this library holds. */
const MIME_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/ogg': 'ogg',
  'application/pdf': 'pdf',
};

/** Best-guess file extension (no dot) for an asset: from its mimeType, then the
 *  extension embedded in its storage URL, then a sane default for its type. */
function extensionFor(
  asset: Pick<UnifiedMediaAsset, 'mimeType' | 'url' | 'type'>,
): string | null {
  const mt = asset.mimeType?.toLowerCase().split(';')[0].trim();
  if (mt && MIME_EXTENSIONS[mt]) {
    return MIME_EXTENSIONS[mt];
  }
  if (mt?.includes('/')) {
    const sub = mt.split('/')[1];
    if (/^[a-z0-9]+$/.test(sub)) {
      return sub;
    }
  }
  // Pull the extension out of the storage path (decode %2F, drop the ?query).
  try {
    const path = decodeURIComponent(asset.url.split('?')[0]);
    const seg = path.split('/').pop() ?? '';
    const dot = seg.lastIndexOf('.');
    if (dot > -1 && dot < seg.length - 1) {
      const ext = seg.slice(dot + 1).toLowerCase();
      if (/^[a-z0-9]{1,5}$/.test(ext)) {
        return ext;
      }
    }
  } catch {
    /* malformed URL — fall through to the type default */
  }
  const byType: Record<string, string> = {
    image: 'png',
    video: 'mp4',
    audio: 'mp3',
    document: 'pdf',
  };
  return byType[asset.type] ?? null;
}

/** A clean download filename for an asset — strips any folder prefix, falls back
 *  to id, and guarantees a file extension so the OS knows the file type. */
function downloadName(
  asset: Pick<UnifiedMediaAsset, 'name' | 'id' | 'mimeType' | 'url' | 'type'>,
): string {
  const raw = asset.name && asset.name.trim().length > 0 ? asset.name : asset.id;
  const base = (raw.split('/').pop() ?? '').trim() || asset.id;
  // Already carries a plausible extension → leave it alone.
  if (/\.[a-z0-9]{1,5}$/i.test(base)) {
    return base;
  }
  const ext = extensionFor(asset);
  return ext ? `${base}.${ext}` : base;
}

// ============================================================================
// Component
// ============================================================================

interface MediaApiListResponse {
  success: boolean;
  assets?: UnifiedMediaAsset[];
  items?: UnifiedMediaAsset[];
  total: number;
}

interface MediaApiSingleResponse {
  success: boolean;
  asset: UnifiedMediaAsset;
}

export default function MediaLibraryUnifiedPage() {
  const authFetch = useAuthFetch();
  const toast = useToast();

  // ── Filters / data ──────────────────────────────────────────────────────
  const [assets, setAssets] = useState<UnifiedMediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [typeFilter, setTypeFilter] = useState<MediaAssetType | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<Set<MediaAssetCategory>>(
    new Set(),
  );
  const [tagFilter, setTagFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState<MediaAssetSource | 'all'>(
    'all',
  );
  const [createdAfter, setCreatedAfter] = useState('');
  const [createdBefore, setCreatedBefore] = useState('');
  const [search, setSearch] = useState('');

  // ── Selection / detail panel ────────────────────────────────────────────
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [removingBgId, setRemovingBgId] = useState<string | null>(null);
  const [editingImgId, setEditingImgId] = useState<string | null>(null);

  // ── Multi-select (bulk) + per-tile delete ────────────────────────────────
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [armedTileDeleteId, setArmedTileDeleteId] = useState<string | null>(null);
  const [tileDeletingId, setTileDeletingId] = useState<string | null>(null);
  const [bulkArmed, setBulkArmed] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  // Bulk action progress (e.g. "Updating 3 of 8…") + busy flag.
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<string | null>(null);

  // ── Character Library profiles (lazy-loaded for the assign menus) ─────────
  const [characters, setCharacters] = useState<CharacterOption[]>([]);
  const [charactersLoading, setCharactersLoading] = useState(false);
  const [charactersLoaded, setCharactersLoaded] = useState(false);

  // ── Tag editor ──────────────────────────────────────────────────────────
  const [newTag, setNewTag] = useState('');
  const [savingTags, setSavingTags] = useState(false);

  // ── Delete arming (two-step) ────────────────────────────────────────────
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const disarmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Folder navigation ───────────────────────────────────────────────────
  const [folderSelection, setFolderSelection] = useState<FolderSelection>({
    kind: 'all',
  });
  // Flat folder list — kept in page state so breadcrumb + move menus can use it
  const [allFolders, setAllFolders] = useState<MediaFolder[]>([]);
  // Bulk move-to-folder UI
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
  const [bulkMoving, setBulkMoving] = useState(false);

  // ── Upload ──────────────────────────────────────────────────────────────
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ========================================================================
  // Fetch
  // ========================================================================

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== 'all') {
        params.set('type', typeFilter);
      }
      if (sourceFilter !== 'all') {
        params.set('source', sourceFilter);
      }
      // Tag filter — comma-separated; ANY-match
      const trimmedTags = tagFilter
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
      if (trimmedTags.length > 0) {
        params.set('tags', trimmedTags.join(','));
      }
      if (search.trim()) {
        params.set('search', search.trim());
      }
      if (createdAfter) {
        params.set('createdAfter', new Date(createdAfter).toISOString());
      }
      if (createdBefore) {
        // Push to end-of-day so user-friendly "Apr 28" inclusive works.
        const eod = new Date(createdBefore);
        eod.setHours(23, 59, 59, 999);
        params.set('createdBefore', eod.toISOString());
      }
      // Note: we send a single category at most (server takes one). For
      // multi-category we filter client-side after fetch.
      if (categoryFilter.size === 1) {
        const only = Array.from(categoryFilter)[0];
        params.set('category', only);
      }
      // Folder scope: specific folder, unfiled only, or all (no param)
      if (folderSelection.kind === 'folder') {
        params.set('folderId', folderSelection.id);
      } else if (folderSelection.kind === 'unfiled') {
        params.set('unfiledOnly', 'true');
      }
      params.set('limit', '500');

      const url = `/api/media${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await authFetch(url);
      if (!res.ok) {
        setErrorMsg(`Failed to load media (${res.status})`);
        setAssets([]);
        return;
      }
      const data = (await res.json()) as MediaApiListResponse;
      const list = data.assets ?? data.items ?? [];

      // Multi-category client-side filter (when 2+ chips selected)
      const filtered =
        categoryFilter.size > 1
          ? list.filter((a) => categoryFilter.has(a.category))
          : list;

      // Dedup by id — the media API can surface the same logical asset from
      // more than one source collection, which produced duplicate React keys
      // and silently duplicated/omitted tiles. Keep first occurrence.
      const deduped = Array.from(
        new Map(filtered.map((a) => [a.id, a])).values(),
      );

      setAssets(deduped);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load media');
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, [
    authFetch,
    typeFilter,
    sourceFilter,
    tagFilter,
    search,
    createdAfter,
    createdBefore,
    categoryFilter,
    folderSelection,
  ]);

  useEffect(() => {
    void fetchAssets();
  }, [fetchAssets]);

  // Fetch the folder list so breadcrumb + move menus have it.
  const fetchFolders = useCallback(async () => {
    try {
      const res = await authFetch('/api/media-folders');
      if (!res.ok) {
        return;
      }
      const data = (await res.json()) as { success: boolean; folders: MediaFolder[] };
      setAllFolders(data.folders ?? []);
    } catch {
      /* non-fatal — folder list is optional for the grid */
    }
  }, [authFetch]);

  useEffect(() => {
    void fetchFolders();
  }, [fetchFolders]);

  // Clear a stale action error when a different asset is opened, so a past failure
  // doesn't linger on a freshly-selected image.
  useEffect(() => {
    setErrorMsg(null);
  }, [selectedId]);

  // Refresh when media is created elsewhere (e.g. the Content Assistant chat
  // generating images) so new items appear live, no manual reload.
  useEffect(() => {
    const handler = (): void => {
      void fetchAssets();
    };
    window.addEventListener('media-library-updated', handler);
    return () => window.removeEventListener('media-library-updated', handler);
  }, [fetchAssets]);

  // ========================================================================
  // Selection
  // ========================================================================

  const selectedAsset = useMemo(
    () => assets.find((a) => a.id === selectedId) ?? null,
    [assets, selectedId],
  );

  // Reset arming + tag editor whenever the selected asset changes.
  useEffect(() => {
    setDeleteArmed(false);
    setNewTag('');
    if (disarmTimerRef.current) {
      clearTimeout(disarmTimerRef.current);
      disarmTimerRef.current = null;
    }
  }, [selectedId]);

  // Cleanup timer on unmount.
  useEffect(() => {
    return () => {
      if (disarmTimerRef.current) {
        clearTimeout(disarmTimerRef.current);
      }
    };
  }, []);

  // ========================================================================
  // Actions
  // ========================================================================

  const toggleCategory = useCallback((cat: MediaAssetCategory) => {
    setCategoryFilter((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setTypeFilter('all');
    setCategoryFilter(new Set());
    setTagFilter('');
    setSourceFilter('all');
    setCreatedAfter('');
    setCreatedBefore('');
    setSearch('');
  }, []);

  const handleAddTag = useCallback(async () => {
    if (!selectedAsset) {
      return;
    }
    const trimmed = newTag.trim();
    if (!trimmed) {
      return;
    }
    if (selectedAsset.tags.includes(trimmed)) {
      setNewTag('');
      return;
    }
    setSavingTags(true);
    try {
      const tags = [...selectedAsset.tags, trimmed];
      const res = await authFetch(`/api/media/${selectedAsset.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags }),
      });
      if (res.ok) {
        const data = (await res.json()) as MediaApiSingleResponse;
        setAssets((prev) =>
          prev.map((a) => (a.id === data.asset.id ? data.asset : a)),
        );
        setNewTag('');
      }
    } finally {
      setSavingTags(false);
    }
  }, [authFetch, newTag, selectedAsset]);

  const handleRemoveTag = useCallback(
    async (tag: string) => {
      if (!selectedAsset) {
        return;
      }
      setSavingTags(true);
      try {
        const tags = selectedAsset.tags.filter((t) => t !== tag);
        const res = await authFetch(`/api/media/${selectedAsset.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tags }),
        });
        if (res.ok) {
          const data = (await res.json()) as MediaApiSingleResponse;
          setAssets((prev) =>
            prev.map((a) => (a.id === data.asset.id ? data.asset : a)),
          );
        }
      } finally {
        setSavingTags(false);
      }
    },
    [authFetch, selectedAsset],
  );

  // Generic single-asset field update → used for rename, category change, and
  // assigning a project (a project is a tag in the library's model).
  const patchAsset = useCallback(
    async (id: string, patch: Record<string, unknown>) => {
      const res = await authFetch(`/api/media/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        const data = (await res.json()) as MediaApiSingleResponse;
        setAssets((prev) => prev.map((a) => (a.id === data.asset.id ? data.asset : a)));
      }
    },
    [authFetch],
  );

  const handleRename = useCallback(
    (id: string, name: string) => patchAsset(id, { name: name.trim() }),
    [patchAsset],
  );

  const handleChangeCategory = useCallback(
    (id: string, category: string) => patchAsset(id, { category }),
    [patchAsset],
  );

  const handleChangeDescription = useCallback(
    (id: string, description: string) => patchAsset(id, { description }),
    [patchAsset],
  );

  const handleChangeIntendedUse = useCallback(
    (id: string, intendedUse: string) => patchAsset(id, { intendedUse }),
    [patchAsset],
  );

  // Assign a project to a single asset from the detail panel. A typed name with
  // no existing match becomes a brand-new project (stable generated id).
  const handleDetailAssignProject = useCallback(
    (asset: UnifiedMediaAsset, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) {
        return Promise.resolve();
      }
      const existing = assets.find(
        (a) => a.projectName?.toLowerCase() === trimmed.toLowerCase() && a.projectId,
      );
      const projectId = existing?.projectId ?? makeProjectId(trimmed);
      return patchAsset(asset.id, { projectId, projectName: trimmed });
    },
    [assets, patchAsset],
  );

  // Patch an asset record WITHOUT updating grid state — used by the bulk runner
  // which batches its single grid refresh once all PATCHes resolve.
  const patchAssetSilent = useCallback(
    async (id: string, patch: Record<string, unknown>) => {
      await authFetch(`/api/media/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      }).catch(() => null);
    },
    [authFetch],
  );

  const armDelete = useCallback(() => {
    setDeleteArmed(true);
    if (disarmTimerRef.current) {
      clearTimeout(disarmTimerRef.current);
    }
    disarmTimerRef.current = setTimeout(() => {
      setDeleteArmed(false);
      disarmTimerRef.current = null;
    }, DISARM_TIMEOUT_MS);
  }, []);

  const cancelDeleteArm = useCallback(() => {
    setDeleteArmed(false);
    if (disarmTimerRef.current) {
      clearTimeout(disarmTimerRef.current);
      disarmTimerRef.current = null;
    }
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!selectedAsset || !deleteArmed) {
      return;
    }
    setDeleting(true);
    try {
      const res = await authFetch(`/api/media/${selectedAsset.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setAssets((prev) => prev.filter((a) => a.id !== selectedAsset.id));
        setSelectedId(null);
      }
    } finally {
      setDeleting(false);
      setDeleteArmed(false);
      if (disarmTimerRef.current) {
        clearTimeout(disarmTimerRef.current);
        disarmTimerRef.current = null;
      }
    }
  }, [authFetch, deleteArmed, selectedAsset]);

  // ── Multi-select + per-tile / bulk delete ────────────────────────────────

  const toggleChecked = useCallback((id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const clearChecked = useCallback(() => {
    setCheckedIds(new Set());
    setBulkArmed(false);
  }, []);

  // ── Character Library: lazy-load the operator's own profiles on first use ──
  const loadCharacters = useCallback(() => {
    if (charactersLoaded || charactersLoading) {
      return;
    }
    setCharactersLoading(true);
    void (async () => {
      try {
        const res = await authFetch('/api/video/avatar-profiles?scope=own');
        if (!res.ok) {
          return;
        }
        const data = (await res.json()) as {
          success: boolean;
          profiles?: Array<{ id: string; name: string }>;
        };
        const list = (data.profiles ?? []).map((p) => ({
          id: p.id,
          name: p.name,
        }));
        setCharacters(list);
        setCharactersLoaded(true);
      } finally {
        setCharactersLoading(false);
      }
    })();
  }, [authFetch, charactersLoaded, charactersLoading]);

  // Distinct projects already present across loaded assets (id → name).
  const projects = useMemo<ProjectOption[]>(() => {
    const byId = new Map<string, string>();
    for (const a of assets) {
      if (a.projectId && a.projectName && !byId.has(a.projectId)) {
        byId.set(a.projectId, a.projectName);
      }
    }
    return Array.from(byId.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [assets]);

  // Delete a set of assets (Firestore records only — Storage is left untouched
  // server-side) and prune them from the grid, selection, and open detail.
  const deleteAssetsByIds = useCallback(
    async (ids: string[]) => {
      await Promise.all(
        ids.map((id) =>
          authFetch(`/api/media/${id}`, { method: 'DELETE' }).catch(() => null),
        ),
      );
      const idSet = new Set(ids);
      setAssets((prev) => prev.filter((a) => !idSet.has(a.id)));
      setCheckedIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      setSelectedId((cur) => (cur && idSet.has(cur) ? null : cur));
    },
    [authFetch],
  );

  const handleTileDelete = useCallback(
    async (id: string) => {
      setTileDeletingId(id);
      try {
        await deleteAssetsByIds([id]);
      } finally {
        setTileDeletingId(null);
        setArmedTileDeleteId(null);
      }
    },
    [deleteAssetsByIds],
  );

  const handleBulkDelete = useCallback(async () => {
    const ids = Array.from(checkedIds);
    if (ids.length === 0) {
      return;
    }
    setBulkDeleting(true);
    try {
      await deleteAssetsByIds(ids);
    } finally {
      setBulkDeleting(false);
      setBulkArmed(false);
    }
  }, [checkedIds, deleteAssetsByIds]);

  // Move every checked asset into a folder (or Unfiled when folderId is null).
  const handleBulkMoveToFolder = useCallback(
    async (folderId: string | null) => {
      const ids = Array.from(checkedIds);
      if (ids.length === 0) {
        return;
      }
      setBulkMoving(true);
      try {
        await Promise.all(
          ids.map((id) =>
            authFetch(`/api/media/${id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ folderId }),
            }).catch(() => null),
          ),
        );
        await fetchAssets();
        setCheckedIds(new Set());
        setBulkMoveOpen(false);
      } finally {
        setBulkMoving(false);
      }
    },
    [authFetch, checkedIds, fetchAssets],
  );

  // Move a single asset into a folder (or Unfiled when folderId is null).
  const handleSingleMoveToFolder = useCallback(
    async (assetId: string, folderId: string | null) => {
      const res = await authFetch(`/api/media/${assetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId }),
      });
      if (res.ok) {
        const data = (await res.json()) as MediaApiSingleResponse;
        setAssets((prev) =>
          prev.map((a) => (a.id === data.asset.id ? data.asset : a)),
        );
      }
    },
    [authFetch],
  );

  // Download one asset through the same-origin proxy (/api/media/[id]/download).
  // Going through the proxy avoids the Storage bucket's missing CORS headers,
  // which silently broke a direct `fetch(asset.url)`.
  const handleDownloadOne = useCallback(async (asset: UnifiedMediaAsset) => {
    try {
      const res = await authFetch(`/api/media/${asset.id}/download`);
      if (!res.ok) {
        setErrorMsg(`Download failed (${res.status}). Try again.`);
        return;
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = downloadName(asset);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Download failed. Try again.');
    }
  }, [authFetch]);

  // Remove the white background from an image asset — a deterministic server-side
  // edit (NOT regeneration). Saves a new transparent copy and jumps to it.
  const handleRemoveBackground = useCallback(async (asset: UnifiedMediaAsset) => {
    setRemovingBgId(asset.id);
    setErrorMsg(null);
    try {
      const res = await authFetch('/api/content/image/remove-background', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId: asset.id }),
      });
      const data = (await res.json()) as { success: boolean; asset?: UnifiedMediaAsset; error?: string };
      if (!res.ok || !data.success || !data.asset) {
        setErrorMsg(data.error ?? 'Background removal failed.');
        return;
      }
      await fetchAssets();
      setSelectedId(data.asset.id);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Background removal failed.');
    } finally {
      setRemovingBgId(null);
    }
  }, [authFetch, fetchAssets]);

  // Edit an image by instruction (Flux Kontext) — changes only what's described,
  // keeps the rest, saves a new copy and jumps to it.
  const handleEditImage = useCallback(async (asset: UnifiedMediaAsset, instruction: string) => {
    setEditingImgId(asset.id);
    setErrorMsg(null);
    try {
      const res = await authFetch('/api/content/image/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId: asset.id, instruction }),
      });
      const data = (await res.json()) as { success: boolean; asset?: UnifiedMediaAsset; error?: string };
      if (!res.ok || !data.success || !data.asset) {
        setErrorMsg(data.error ?? 'Edit failed. Try rewording the change.');
        return;
      }
      await fetchAssets();
      setSelectedId(data.asset.id);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Edit failed. Try rewording the change.');
    } finally {
      setEditingImgId(null);
    }
  }, [authFetch, fetchAssets]);

  // Download all checked assets as a single .zip.
  const handleBulkDownload = useCallback(async () => {
    const items = assets.filter((a) => checkedIds.has(a.id));
    if (items.length === 0) {
      return;
    }
    setDownloading(true);
    try {
      const { zip } = await import('fflate');
      const files: Record<string, Uint8Array> = {};
      const used = new Set<string>();
      await Promise.all(
        items.map(async (a) => {
          try {
            const res = await authFetch(`/api/media/${a.id}/download`);
            if (!res.ok) {
              return;
            }
            const buf = new Uint8Array(await res.arrayBuffer());
            let name = downloadName(a);
            while (used.has(name)) {
              name = `copy-${name}`;
            }
            used.add(name);
            files[name] = buf;
          } catch {
            /* skip this file, keep the rest */
          }
        }),
      );
      if (Object.keys(files).length === 0) {
        setErrorMsg('Download failed — none of the selected files could be retrieved.');
        return;
      }
      const zipped = await new Promise<Uint8Array>((resolve, reject) => {
        zip(files, (err, data) => (err ? reject(err) : resolve(data)));
      });
      const blob = new Blob([zipped as BlobPart], { type: 'application/zip' });
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `media-${items.length}-files.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } finally {
      setDownloading(false);
    }
  }, [assets, checkedIds, authFetch]);

  // MOVE an image onto a character: it becomes a reference image on that
  // character and LEAVES the media library (the record is deleted server-side).
  // On success we drop it from the grid so the move is visible immediately.
  const moveImageToCharacter = useCallback(
    async (asset: UnifiedMediaAsset, character: CharacterOption) => {
      try {
        const res = await authFetch(
          `/api/video/avatar-profiles/${character.id}/add-image`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ assetId: asset.id }),
          },
        );
        const data = (await res.json().catch(() => null)) as
          | { success?: boolean; error?: string }
          | null;
        if (!res.ok || !data?.success) {
          toast.error(
            data?.error ?? `Could not add "${asset.name}" to ${character.name}.`,
          );
          return;
        }
        // It moved — remove it from the library grid + any selection.
        setAssets((prev) => prev.filter((a) => a.id !== asset.id));
        setCheckedIds((prev) => {
          if (!prev.has(asset.id)) {
            return prev;
          }
          const next = new Set(prev);
          next.delete(asset.id);
          return next;
        });
        setSelectedId((prev) => (prev === asset.id ? null : prev));
        toast.success(
          `Added "${asset.name}" to ${character.name}. It now lives on that character.`,
        );
      } catch {
        toast.error('Something went wrong adding that image to the character.');
      }
    },
    [authFetch, toast],
  );

  // Build the full action set for a SINGLE asset. Each action PATCHes that one
  // asset via `patchAsset` (which also updates local grid state).
  const buildAssetActions = useCallback(
    (asset: UnifiedMediaAsset): AssetActions => ({
      onAssignCharacter: async (character) => {
        if (character) {
          // Only flip an uncategorized/`other` asset to 'character' — never
          // clobber a meaningful category the operator already chose.
          const patch: Record<string, unknown> = {
            characterId: character.id,
            characterName: character.name,
          };
          if (asset.category === 'other') {
            patch.category = 'character';
          }
          await patchAsset(asset.id, patch);
        } else {
          await patchAsset(asset.id, { characterId: '', characterName: '' });
        }
      },
      onAssignProject: async (project) => {
        if (project) {
          await patchAsset(asset.id, {
            projectId: project.id,
            projectName: project.name,
          });
        } else {
          await patchAsset(asset.id, { projectId: '', projectName: '' });
        }
      },
      onSetCategory: async (category) => {
        await patchAsset(asset.id, { category });
      },
      onAddTags: async (tags) => {
        const next = Array.from(new Set([...asset.tags, ...tags]));
        await patchAsset(asset.id, { tags: next });
      },
      onRemoveTags: async (tags) => {
        const drop = new Set(tags);
        await patchAsset(asset.id, {
          tags: asset.tags.filter((t) => !drop.has(t)),
        });
      },
      onSetIntendedUse: async (intendedUse) => {
        await patchAsset(asset.id, { intendedUse });
      },
      onDownload: async () => {
        await handleDownloadOne(asset);
      },
      onDelete: async () => {
        await handleTileDelete(asset.id);
      },
      onMoveToCharacter: async (character) => {
        await moveImageToCharacter(asset, character);
      },
    }),
    [patchAsset, handleDownloadOne, handleTileDelete, moveImageToCharacter],
  );

  // Apply a per-asset patch builder across every checked asset, sequentially,
  // surfacing simple progress. Refetches once at the end so the grid + derived
  // project list reflect every change. Used for all bulk field actions.
  const runBulkPatch = useCallback(
    async (
      buildPatch: (asset: UnifiedMediaAsset) => Record<string, unknown> | null,
      verb: string,
    ) => {
      const ids = Array.from(checkedIds);
      if (ids.length === 0) {
        return;
      }
      setBulkBusy(true);
      try {
        let done = 0;
        for (const id of ids) {
          const asset = assets.find((a) => a.id === id);
          done += 1;
          setBulkProgress(`${verb} ${done} of ${ids.length}…`);
          if (!asset) {
            continue;
          }
          const patch = buildPatch(asset);
          if (patch) {
            await patchAssetSilent(id, patch);
          }
        }
        await fetchAssets();
      } finally {
        setBulkBusy(false);
        setBulkProgress(null);
      }
    },
    [assets, checkedIds, fetchAssets, patchAssetSilent],
  );

  // The bulk action set — same shape as a single asset's, applied to ALL
  // checked assets. Download + delete reuse the existing zip/delete handlers.
  const bulkActions = useMemo<AssetActions>(
    () => ({
      onAssignCharacter: (character) =>
        runBulkPatch(
          (asset) =>
            character
              ? {
                  characterId: character.id,
                  characterName: character.name,
                  ...(asset.category === 'other'
                    ? { category: 'character' as MediaAssetCategory }
                    : {}),
                }
              : { characterId: '', characterName: '' },
          'Updating',
        ),
      onAssignProject: (project) =>
        runBulkPatch(
          () =>
            project
              ? { projectId: project.id, projectName: project.name }
              : { projectId: '', projectName: '' },
          'Updating',
        ),
      onSetCategory: (category) =>
        runBulkPatch(() => ({ category }), 'Updating'),
      onAddTags: (tags) =>
        runBulkPatch(
          (asset) => ({ tags: Array.from(new Set([...asset.tags, ...tags])) }),
          'Tagging',
        ),
      onRemoveTags: (tags) => {
        const drop = new Set(tags);
        return runBulkPatch(
          (asset) => ({ tags: asset.tags.filter((t) => !drop.has(t)) }),
          'Updating',
        );
      },
      onSetIntendedUse: (intendedUse) =>
        runBulkPatch(() => ({ intendedUse }), 'Updating'),
      onDownload: () => handleBulkDownload(),
      onDelete: () => handleBulkDelete(),
      onMoveToCharacter: async (character) => {
        // Move every checked IMAGE onto the character (non-image assets can't be
        // character references and are skipped). Each move deletes its library
        // record server-side; we refetch once at the end to reflect the result.
        const ids = Array.from(checkedIds);
        if (ids.length === 0) {
          return;
        }
        setBulkBusy(true);
        try {
          let done = 0;
          for (const id of ids) {
            const asset = assets.find((a) => a.id === id);
            done += 1;
            setBulkProgress(`Adding ${done} of ${ids.length}…`);
            if (asset?.type !== 'image') {
              continue;
            }
            await authFetch(
              `/api/video/avatar-profiles/${character.id}/add-image`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ assetId: asset.id }),
              },
            ).catch(() => null);
          }
          await fetchAssets();
          setCheckedIds(new Set());
          toast.success(`Added the selected images to ${character.name}.`);
        } finally {
          setBulkBusy(false);
          setBulkProgress(null);
        }
      },
    }),
    [
      runBulkPatch,
      handleBulkDownload,
      handleBulkDelete,
      assets,
      checkedIds,
      authFetch,
      fetchAssets,
      toast,
    ],
  );

  // Auto-disarm the per-tile + bulk delete confirmations (same 5s window).
  useEffect(() => {
    if (!armedTileDeleteId) {
      return;
    }
    const t = setTimeout(() => setArmedTileDeleteId(null), DISARM_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [armedTileDeleteId]);

  useEffect(() => {
    if (!bulkArmed) {
      return;
    }
    const t = setTimeout(() => setBulkArmed(false), DISARM_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [bulkArmed]);

  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) {
        return;
      }
      setUploading(true);
      try {
        let type: MediaAssetType = 'image';
        let category: MediaAssetCategory = 'photo';
        if (file.type.startsWith('video/')) {
          type = 'video';
          category = 'video-clip';
        } else if (file.type.startsWith('audio/')) {
          type = 'audio';
          category = 'sound';
        } else if (
          file.type === 'application/pdf' ||
          file.type.includes('document')
        ) {
          type = 'document';
          category = 'other';
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', type);
        formData.append('category', category);
        formData.append('name', file.name);

        const res = await authFetch('/api/media', {
          method: 'POST',
          body: formData,
        });
        if (res.ok) {
          await fetchAssets();
        }
      } finally {
        setUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [authFetch, fetchAssets],
  );

  // ========================================================================
  // Render
  // ========================================================================

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <PageTitle className="flex items-center gap-3">
            <FolderOpen className="h-7 w-7 text-primary" />
            Media Library
          </PageTitle>
          <SectionDescription className="mt-1">
            Every image, video, audio file, and document — searchable across
            agents, tags, and sources.
          </SectionDescription>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              void handleUpload(e);
            }}
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="gap-2"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Upload
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Layout: folder nav | filter sidebar | grid | detail */}
      <div className="grid grid-cols-1 lg:grid-cols-[180px_240px_1fr] gap-6">
        {/* ── Folder navigation ────────────────────────────────────────── */}
        <div className="space-y-3">
          <MediaFolderNav
            selection={folderSelection}
            onSelect={(sel) => {
              setFolderSelection(sel);
              setCheckedIds(new Set());
            }}
            onFoldersChange={setAllFolders}
          />
        </div>

        {/* ── Filter sidebar ──────────────────────────────────────────── */}
        <aside className="space-y-6">
          {/* Type chips */}
          <div className="bg-card border border-border-strong rounded-2xl p-4">
            <CardTitle className="mb-3">Type</CardTitle>
            <div className="flex flex-wrap gap-2">
              {TYPE_FILTERS.map(({ value, label, icon: Icon }) => {
                const active = typeFilter === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTypeFilter(value)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border-strong bg-card hover:bg-surface-elevated text-muted-foreground'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Category multi-select */}
          <div className="bg-card border border-border-strong rounded-2xl p-4">
            <CardTitle className="mb-3">Category</CardTitle>
            <div className="flex flex-wrap gap-1.5 max-h-56 overflow-y-auto">
              {MEDIA_CATEGORIES.map((cat) => {
                const active = categoryFilter.has(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      active
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border-strong bg-card hover:bg-surface-elevated text-muted-foreground'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
            {categoryFilter.size > 0 && (
              <Caption className="mt-2 block">
                {categoryFilter.size} selected
              </Caption>
            )}
          </div>

          {/* Tag filter */}
          <div className="bg-card border border-border-strong rounded-2xl p-4">
            <CardTitle className="mb-3">Tags</CardTitle>
            <Input
              type="text"
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              placeholder="comma, separated"
              className="text-xs"
            />
            <Caption className="mt-2 block">
              Returns assets with ANY matching tag.
            </Caption>
          </div>

          {/* Source filter */}
          <div className="bg-card border border-border-strong rounded-2xl p-4">
            <CardTitle className="mb-3">Source</CardTitle>
            <div className="space-y-1.5">
              {SOURCE_FILTERS.map(({ value, label }) => (
                <label
                  key={value}
                  className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground"
                >
                  <input
                    type="radio"
                    name="source"
                    checked={sourceFilter === value}
                    onChange={() => setSourceFilter(value)}
                    className="h-3 w-3"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* Date range */}
          <div className="bg-card border border-border-strong rounded-2xl p-4">
            <CardTitle className="mb-3">Date range</CardTitle>
            <div className="space-y-2">
              <div>
                <Caption className="block mb-1">From</Caption>
                <Input
                  type="date"
                  value={createdAfter}
                  onChange={(e) => setCreatedAfter(e.target.value)}
                  className="text-xs"
                />
              </div>
              <div>
                <Caption className="block mb-1">To</Caption>
                <Input
                  type="date"
                  value={createdBefore}
                  onChange={(e) => setCreatedBefore(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>
          </div>

          <Button variant="ghost" size="sm" onClick={clearFilters} className="w-full">
            Clear all filters
          </Button>
        </aside>

        {/* ── Main column (search + grid) ─────────────────────────────── */}
        <div className="space-y-4">
          {/* Breadcrumb */}
          <FolderBreadcrumb
            selection={folderSelection}
            folders={allFolders}
            onSelect={setFolderSelection}
          />

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, tag, or AI prompt..."
              className="pl-9"
            />
          </div>

          {/* Result summary */}
          <div className="flex items-center justify-between gap-3">
            <SectionTitle as="h2">
              {loading ? 'Loading...' : `${assets.length} asset${assets.length === 1 ? '' : 's'}`}
            </SectionTitle>
            <div className="flex items-center gap-3">
              {errorMsg && <Caption className="text-destructive">{errorMsg}</Caption>}
              {/* Select all in the CURRENT view → existing bulk bar handles delete etc. */}
              {!loading && assets.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCheckedIds((prev) =>
                      prev.size === assets.length
                        ? new Set<string>()
                        : new Set(assets.map((a) => a.id)),
                    )
                  }
                >
                  {checkedIds.size === assets.length ? 'Clear selection' : `Select all ${assets.length}`}
                </Button>
              )}
            </div>
          </div>

          {/* Bulk action bar — the SAME full action set, applied to every
              checked asset. Appears when ≥1 tile is selected. */}
          {checkedIds.size > 0 && (
            <>
              <BulkActionsBar
                count={checkedIds.size}
                characters={characters}
                charactersLoading={charactersLoading}
                onLoadCharacters={loadCharacters}
                projects={projects}
                actions={bulkActions}
                busy={bulkBusy || bulkDeleting || downloading}
                progress={bulkProgress}
                isArmedDelete={bulkArmed}
                onArmDelete={() => setBulkArmed(true)}
                onCancelDelete={() => setBulkArmed(false)}
                onClear={clearChecked}
              />
              {/* Move to folder — bulk */}
              <BulkMoveToFolderBar
                count={checkedIds.size}
                folders={allFolders}
                open={bulkMoveOpen}
                moving={bulkMoving}
                onToggle={() => setBulkMoveOpen((v) => !v)}
                onMove={(folderId) => { void handleBulkMoveToFolder(folderId); }}
              />
            </>
          )}

          {/* Grid + detail panel */}
          {selectedAsset ? (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
              <AssetGrid
                assets={assets}
                loading={loading}
                onSelect={setSelectedId}
                selectedId={selectedId}
                checkedIds={checkedIds}
                onToggleChecked={toggleChecked}
                armedTileDeleteId={armedTileDeleteId}
                tileDeletingId={tileDeletingId}
                onArmTileDelete={setArmedTileDeleteId}
                onCancelTileDelete={() => setArmedTileDeleteId(null)}
                onConfirmTileDelete={(id) => {
                  void handleTileDelete(id);
                }}
                onDownloadOne={(a) => {
                  void handleDownloadOne(a);
                }}
                characters={characters}
                charactersLoading={charactersLoading}
                onLoadCharacters={loadCharacters}
                projects={projects}
                buildAssetActions={buildAssetActions}
              />
              <AssetDetailPanel
                asset={selectedAsset}
                onClose={() => setSelectedId(null)}
                newTag={newTag}
                setNewTag={setNewTag}
                onAddTag={handleAddTag}
                onRemoveTag={handleRemoveTag}
                savingTags={savingTags}
                deleteArmed={deleteArmed}
                deleting={deleting}
                onArmDelete={armDelete}
                onCancelDeleteArm={cancelDeleteArm}
                onConfirmDelete={handleConfirmDelete}
                onRename={(name) => {
                  void handleRename(selectedAsset.id, name);
                }}
                onChangeCategory={(category) => {
                  void handleChangeCategory(selectedAsset.id, category);
                }}
                onChangeDescription={(description) => {
                  void handleChangeDescription(selectedAsset.id, description);
                }}
                onChangeIntendedUse={(intendedUse) => {
                  void handleChangeIntendedUse(selectedAsset.id, intendedUse);
                }}
                onAssignProject={(project) => {
                  void handleDetailAssignProject(selectedAsset, project);
                }}
                onRemoveBackground={(a) => {
                  void handleRemoveBackground(a);
                }}
                removingBackground={removingBgId === selectedAsset.id}
                onEditImage={(instruction) => {
                  void handleEditImage(selectedAsset, instruction);
                }}
                editingImage={editingImgId === selectedAsset.id}
                actionError={errorMsg}
                folders={allFolders}
                onMoveToFolder={(folderId) => {
                  void handleSingleMoveToFolder(selectedAsset.id, folderId);
                }}
              />
            </div>
          ) : (
            <AssetGrid
              assets={assets}
              loading={loading}
              onSelect={setSelectedId}
              selectedId={selectedId}
              checkedIds={checkedIds}
              onToggleChecked={toggleChecked}
              armedTileDeleteId={armedTileDeleteId}
              tileDeletingId={tileDeletingId}
              onArmTileDelete={setArmedTileDeleteId}
              onCancelTileDelete={() => setArmedTileDeleteId(null)}
              onConfirmTileDelete={(id) => {
                void handleTileDelete(id);
              }}
              onDownloadOne={(a) => {
                void handleDownloadOne(a);
              }}
              characters={characters}
              charactersLoading={charactersLoading}
              onLoadCharacters={loadCharacters}
              projects={projects}
              buildAssetActions={buildAssetActions}
            />
          )}
        </div>
      </div>
    </>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

interface AssetGridProps {
  assets: UnifiedMediaAsset[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  checkedIds: Set<string>;
  onToggleChecked: (id: string) => void;
  armedTileDeleteId: string | null;
  tileDeletingId: string | null;
  onArmTileDelete: (id: string) => void;
  onCancelTileDelete: () => void;
  onConfirmTileDelete: (id: string) => void;
  onDownloadOne: (asset: UnifiedMediaAsset) => void;
  characters: CharacterOption[];
  charactersLoading: boolean;
  onLoadCharacters: () => void;
  projects: ProjectOption[];
  buildAssetActions: (asset: UnifiedMediaAsset) => AssetActions;
}

function AssetGrid({
  assets,
  loading,
  selectedId,
  onSelect,
  checkedIds,
  onToggleChecked,
  armedTileDeleteId,
  tileDeletingId,
  onArmTileDelete,
  onCancelTileDelete,
  onConfirmTileDelete,
  onDownloadOne,
  characters,
  charactersLoading,
  onLoadCharacters,
  projects,
  buildAssetActions,
}: AssetGridProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (assets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center bg-card border border-border-strong rounded-2xl">
        <FolderOpen className="h-12 w-12 text-muted-foreground mb-3" />
        <SectionTitle as="h3">No assets match these filters</SectionTitle>
        <SectionDescription className="mt-1 max-w-md">
          Try clearing one of the filters, or upload a file to get started.
        </SectionDescription>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {assets.map((asset) => (
        <AssetTile
          key={asset.id}
          asset={asset}
          isSelected={selectedId === asset.id}
          isChecked={checkedIds.has(asset.id)}
          isArmedDelete={armedTileDeleteId === asset.id}
          isDeleting={tileDeletingId === asset.id}
          onSelect={onSelect}
          onToggleChecked={onToggleChecked}
          onArmDelete={onArmTileDelete}
          onCancelDelete={onCancelTileDelete}
          onConfirmDelete={onConfirmTileDelete}
          onDownload={onDownloadOne}
          characters={characters}
          charactersLoading={charactersLoading}
          onLoadCharacters={onLoadCharacters}
          projects={projects}
          actions={buildAssetActions(asset)}
        />
      ))}
    </div>
  );
}

interface AssetTileProps {
  asset: UnifiedMediaAsset;
  isSelected: boolean;
  isChecked: boolean;
  isArmedDelete: boolean;
  isDeleting: boolean;
  onSelect: (id: string) => void;
  onToggleChecked: (id: string) => void;
  onArmDelete: (id: string) => void;
  onCancelDelete: () => void;
  onConfirmDelete: (id: string) => void;
  onDownload: (asset: UnifiedMediaAsset) => void;
  characters: CharacterOption[];
  charactersLoading: boolean;
  onLoadCharacters: () => void;
  projects: ProjectOption[];
  actions: AssetActions;
}

function AssetTile({
  asset,
  isSelected,
  isChecked,
  isArmedDelete,
  isDeleting,
  onSelect,
  onToggleChecked,
  onArmDelete,
  onCancelDelete,
  onConfirmDelete,
  onDownload,
  characters,
  charactersLoading,
  onLoadCharacters,
  projects,
  actions,
}: AssetTileProps) {
  const Icon = typeIcon(asset.type);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isVideo = asset.type === 'video';
  const showImage = asset.type === 'image' || Boolean(asset.thumbnailUrl);
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  const handleEnter = () => {
    if (isVideo && videoRef.current) {
      void videoRef.current.play().catch(() => undefined);
    }
  };
  const handleLeave = () => {
    if (isVideo && videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };
  return (
    <div
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      className={`group relative rounded-xl border bg-card transition-all ${
        isSelected ? 'border-primary ring-2 ring-primary/40' : 'border-border-strong hover:border-primary/40'
      }`}
    >
      <button type="button" onClick={() => onSelect(asset.id)} className="block w-full text-left">
        <div className="aspect-square bg-surface-elevated relative overflow-hidden rounded-t-xl">
          {showImage ? (
            <Image
              src={asset.thumbnailUrl ?? asset.url}
              alt={asset.name}
              fill
              unoptimized
              className="object-cover"
            />
          ) : isVideo ? (
            <>
              {/* #t=0.1 seeks to a frame so the tile shows a poster, not black */}
              <video
                ref={videoRef}
                src={`${asset.url}#t=0.1`}
                muted
                loop
                playsInline
                preload="metadata"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/15 transition-opacity group-hover:opacity-0 pointer-events-none">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/55">
                  <Play className="h-5 w-5 text-white fill-white" />
                </span>
              </div>
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Icon className="h-10 w-10 text-muted-foreground" />
            </div>
          )}
          {asset.source === 'ai-generated' && (
            <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-full bg-primary/90 px-2 py-0.5 text-[10px] font-medium text-primary-foreground pointer-events-none">
              <Sparkles className="h-3 w-3" />
              AI
            </div>
          )}
          {/* TYPE badge — quick at-a-glance media type */}
          <div className="absolute bottom-1.5 right-1.5 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white pointer-events-none">
            {TYPE_BADGE_LABEL[asset.type]}
          </div>
        </div>
        <div className="p-2">
          <p className="text-xs font-medium text-foreground truncate">{asset.name}</p>
          {/* Auto-labels: category + first few tags */}
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <span className="inline-flex max-w-full items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary truncate">
              {asset.category}
            </span>
            {asset.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="inline-flex max-w-full items-center rounded-full border border-border-strong bg-surface-elevated px-1.5 py-0.5 text-[10px] text-muted-foreground truncate"
              >
                {tag}
              </span>
            ))}
            {asset.tags.length > 3 && (
              <span className="text-[10px] text-muted-foreground">
                +{asset.tags.length - 3}
              </span>
            )}
          </div>
        </div>
      </button>

      {/* Select checkbox — top-left */}
      <button
        type="button"
        onClick={(e) => {
          stop(e);
          onToggleChecked(asset.id);
        }}
        aria-label={isChecked ? 'Deselect' : 'Select'}
        className={`absolute top-1.5 left-1.5 rounded-md p-1 transition-opacity ${
          isChecked
            ? 'bg-primary text-primary-foreground opacity-100'
            : 'bg-black/50 text-white opacity-0 group-hover:opacity-100'
        }`}
      >
        {isChecked ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
      </button>

      {/* Download + delete — top-right, on hover */}
      {!isArmedDelete && (
        <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={(e) => {
              stop(e);
              void onDownload(asset);
            }}
            aria-label="Download"
            className="rounded-md bg-black/50 p-1 text-white hover:bg-black/70"
          >
            <Download className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              stop(e);
              onArmDelete(asset.id);
            }}
            aria-label="Delete"
            className="rounded-md bg-black/50 p-1 text-white hover:bg-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          {/* Full action set without opening the detail panel */}
          <AssetActionsMenu
            asset={asset}
            characters={characters}
            charactersLoading={charactersLoading}
            onLoadCharacters={onLoadCharacters}
            projects={projects}
            actions={actions}
            onArmDelete={() => onArmDelete(asset.id)}
          />
        </div>
      )}

      {/* Per-tile delete confirm overlay (two-step) */}
      {isArmedDelete && (
        <div
          onClick={stop}
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/75 p-2 text-center"
        >
          <p className="text-xs font-medium text-white">Delete this?</p>
          <div className="flex gap-2">
            <Button
              variant="destructive"
              size="sm"
              disabled={isDeleting}
              onClick={() => onConfirmDelete(asset.id)}
              className="h-7 gap-1 px-2 text-xs"
            >
              {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Delete
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={isDeleting}
              onClick={onCancelDelete}
              className="h-7 px-2 text-xs"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

interface AssetDetailPanelProps {
  asset: UnifiedMediaAsset;
  onClose: () => void;
  newTag: string;
  setNewTag: (v: string) => void;
  onAddTag: () => Promise<void>;
  onRemoveTag: (tag: string) => Promise<void>;
  savingTags: boolean;
  deleteArmed: boolean;
  deleting: boolean;
  onArmDelete: () => void;
  onCancelDeleteArm: () => void;
  onConfirmDelete: () => Promise<void>;
  onRename: (name: string) => void;
  onChangeCategory: (category: string) => void;
  onChangeDescription: (description: string) => void;
  onChangeIntendedUse: (intendedUse: string) => void;
  onAssignProject: (project: string) => void;
  onRemoveBackground: (asset: UnifiedMediaAsset) => void;
  removingBackground: boolean;
  onEditImage: (instruction: string) => void;
  editingImage: boolean;
  actionError: string | null;
  folders: MediaFolder[];
  onMoveToFolder: (folderId: string | null) => void;
}

function AssetDetailPanel({
  asset,
  onClose,
  newTag,
  setNewTag,
  onAddTag,
  onRemoveTag,
  savingTags,
  deleteArmed,
  deleting,
  onArmDelete,
  onCancelDeleteArm,
  onConfirmDelete,
  onRename,
  onChangeCategory,
  onChangeDescription,
  onChangeIntendedUse,
  onAssignProject,
  onRemoveBackground,
  removingBackground,
  onEditImage,
  editingImage,
  actionError,
  folders,
  onMoveToFolder,
}: AssetDetailPanelProps) {
  const Icon = typeIcon(asset.type);
  const showImage = asset.type === 'image' || Boolean(asset.thumbnailUrl);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(asset.name);
  const [projectDraft, setProjectDraft] = useState('');
  const [draftDescription, setDraftDescription] = useState(asset.description ?? '');
  const [draftIntendedUse, setDraftIntendedUse] = useState(asset.intendedUse ?? '');
  const [editInstruction, setEditInstruction] = useState('');

  // Reset inline editors when a different asset is opened.
  useEffect(() => {
    setEditingName(false);
    setProjectDraft('');
    setDraftDescription(asset.description ?? '');
    setDraftIntendedUse(asset.intendedUse ?? '');
    setEditInstruction('');
  }, [asset.id, asset.description, asset.intendedUse]);

  const submitEdit = (): void => {
    const next = editInstruction.trim();
    if (next && !editingImage) {
      onEditImage(next);
    }
  };

  const commitDescription = () => {
    if (draftDescription !== (asset.description ?? '')) {
      onChangeDescription(draftDescription);
    }
  };

  const commitName = () => {
    const next = draftName.trim();
    if (next && next !== asset.name) {
      onRename(next);
    }
    setEditingName(false);
  };
  const commitProject = () => {
    const next = projectDraft.trim();
    if (next) {
      onAssignProject(next);
      setProjectDraft('');
    }
  };
  const commitIntendedUse = () => {
    if (draftIntendedUse !== (asset.intendedUse ?? '')) {
      onChangeIntendedUse(draftIntendedUse);
    }
  };
  return (
    <aside className="bg-card border border-border-strong rounded-2xl overflow-hidden flex flex-col">
      {/* Header — click the name to rename */}
      <div className="flex items-center justify-between gap-2 p-4 border-b border-border-light">
        {editingName ? (
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <Input
              autoFocus
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitName();
                }
                if (e.key === 'Escape') {
                  setEditingName(false);
                }
              }}
              className="h-8 text-sm"
            />
            <Button size="sm" className="h-8 px-2 text-xs" disabled={!draftName.trim()} onClick={commitName}>
              Save
            </Button>
            <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => setEditingName(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraftName(asset.name);
              setEditingName(true);
            }}
            title="Rename"
            className="group/name flex min-w-0 flex-1 items-center gap-1.5 text-left"
          >
            <CardTitle className="truncate">{asset.name}</CardTitle>
            <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 group-hover/name:opacity-100" />
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close detail panel"
          className="shrink-0 p-1 rounded-md text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Preview */}
      <div className="aspect-square bg-surface-elevated relative overflow-hidden border-b border-border-light">
        {showImage ? (
          <Image
            src={asset.thumbnailUrl ?? asset.url}
            alt={asset.name}
            fill
            unoptimized
            className="object-contain"
          />
        ) : asset.type === 'video' ? (
          <video src={asset.url} controls className="absolute inset-0 h-full w-full" />
        ) : asset.type === 'audio' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4">
            <Music className="h-12 w-12 text-muted-foreground" />
            <audio src={asset.url} controls className="w-full" />
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Icon className="h-14 w-14 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Image actions — deterministic edits (no regeneration) */}
      {asset.type === 'image' && (
        <div className="p-3 border-b border-border-light">
          <Button
            size="sm"
            variant="outline"
            disabled={removingBackground}
            onClick={() => onRemoveBackground(asset)}
            className="w-full gap-2 text-xs"
          >
            {removingBackground ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Eraser className="h-3.5 w-3.5" />
            )}
            {removingBackground ? 'Removing background…' : 'Remove background'}
          </Button>
          <Caption className="mt-1.5 block text-muted-foreground">
            Cuts out the subject and saves a transparent copy. Works on any background. Your original is kept.
          </Caption>

          {/* Edit image — change part of it, keep the rest (Flux Kontext) */}
          <div className="mt-3">
            <Input
              value={editInstruction}
              onChange={(e) => setEditInstruction(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submitEdit();
                }
              }}
              placeholder="Describe a change, e.g. “make the logo bigger”"
              disabled={editingImage}
              className="h-8 text-xs"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={editingImage || !editInstruction.trim()}
              onClick={submitEdit}
              className="mt-1.5 w-full gap-2 text-xs"
            >
              {editingImage ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Wand2 className="h-3.5 w-3.5" />
              )}
              {editingImage ? 'Editing…' : 'Edit image'}
            </Button>
            <Caption className="mt-1.5 block text-muted-foreground">
              Changes only what you describe and keeps the rest. Saves a new copy — your original stays.
            </Caption>
          </div>

          {/* Surface the reason an action failed right here, where the operator clicked. */}
          {actionError && (
            <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-2">
              <Caption className="text-destructive">{actionError}</Caption>
            </div>
          )}
        </div>
      )}

      {/* Metadata */}
      <div className="p-4 space-y-3 overflow-y-auto">
        <MetaRow label="Type" value={asset.type} />
        <div className="flex items-baseline gap-2 text-xs">
          <span className="text-muted-foreground w-24 flex-shrink-0">Category</span>
          <select
            value={asset.category}
            onChange={(e) => onChangeCategory(e.target.value)}
            className="flex-1 rounded-md border border-border-strong bg-card px-2 py-1 text-xs text-foreground"
          >
            {MEDIA_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <MetaRow label="Source" value={asset.source} />
        <MetaRow label="MIME" value={asset.mimeType} />
        {asset.fileSize > 0 && (
          <MetaRow label="Size" value={formatFileSize(asset.fileSize)} />
        )}
        {asset.duration && (
          <MetaRow label="Duration" value={`${asset.duration.toFixed(1)}s`} />
        )}
        {asset.dimensions && (
          <MetaRow
            label="Dimensions"
            value={`${asset.dimensions.width} × ${asset.dimensions.height}`}
          />
        )}
        {asset.aiProvider && (
          <MetaRow label="AI provider" value={asset.aiProvider} />
        )}
        {/* Editable description (saves on blur) */}
        <div>
          <Caption className="block mb-1">Description</Caption>
          <textarea
            value={draftDescription}
            onChange={(e) => setDraftDescription(e.target.value)}
            onBlur={commitDescription}
            placeholder="Add a description…"
            rows={3}
            className="w-full resize-y rounded-md border border-border-strong bg-surface-elevated px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground"
          />
        </div>
        {/* Editable intended use (saves on blur) */}
        <div>
          <Caption className="block mb-1">Intended use</Caption>
          <textarea
            value={draftIntendedUse}
            onChange={(e) => setDraftIntendedUse(e.target.value)}
            onBlur={commitIntendedUse}
            placeholder="How is this meant to be used?"
            rows={2}
            className="w-full resize-y rounded-md border border-border-strong bg-surface-elevated px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground"
          />
        </div>
        {asset.characterName && (
          <MetaRow label="Character" value={asset.characterName} />
        )}
        {asset.projectName && (
          <MetaRow label="Project" value={asset.projectName} />
        )}
        <MetaRow label="Created" value={formatDate(asset.createdAt)} />
        {asset.brandDnaApplied && (
          <div className="flex items-center gap-1.5 text-xs text-primary">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Brand DNA applied
          </div>
        )}
        {asset.usedInPosts && asset.usedInPosts.length > 0 && (
          <MetaRow
            label="Used in"
            value={`${asset.usedInPosts.length} post(s)`}
          />
        )}

        {/* Assign to a project (stored as a tag in the library's model) */}
        <div className="pt-3 border-t border-border-light">
          <CardTitle className="mb-2 flex items-center gap-1.5">
            <FolderPlus className="h-3.5 w-3.5" />
            Project
          </CardTitle>
          <div className="flex gap-1.5">
            <Input
              value={projectDraft}
              onChange={(e) => setProjectDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitProject();
                }
              }}
              placeholder="Assign to a project"
              className="text-xs h-8"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={!projectDraft.trim()}
              onClick={commitProject}
              className="h-8 px-2"
              aria-label="Assign to project"
            >
              <FolderPlus className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Caption className="mt-1 block">Groups this item under a project (appears as a tag below).</Caption>
        </div>

        {/* Move to folder */}
        {folders.length > 0 && (
          <div className="pt-3 border-t border-border-light">
            <CardTitle className="mb-2 flex items-center gap-1.5">
              <Folder className="h-3.5 w-3.5" />
              Folder
            </CardTitle>
            <select
              value={asset.folderId ?? ''}
              onChange={(e) => {
                const v = e.target.value;
                onMoveToFolder(v === '' ? null : v);
              }}
              className="w-full rounded-md border border-border-strong bg-card px-2 py-1.5 text-xs text-foreground"
            >
              <option value="">Unfiled</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            <Caption className="mt-1 block">
              Move this asset into a folder for easier organisation.
            </Caption>
          </div>
        )}

        {/* Tag editor */}
        <div className="pt-3 border-t border-border-light">
          <div className="flex items-center justify-between mb-2">
            <CardTitle className="flex items-center gap-1.5">
              <TagIcon className="h-3.5 w-3.5" />
              Tags
            </CardTitle>
            {savingTags && (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            )}
          </div>
          {asset.tags.length === 0 ? (
            <Caption className="block mb-2">No tags yet</Caption>
          ) : (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {asset.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full bg-surface-elevated border border-border-strong px-2 py-0.5 text-[11px] text-foreground"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => {
                      void onRemoveTag(tag);
                    }}
                    disabled={savingTags}
                    aria-label={`Remove tag ${tag}`}
                    className="text-muted-foreground hover:text-destructive disabled:opacity-50"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-1.5">
            <Input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void onAddTag();
                }
              }}
              placeholder="Add a tag"
              className="text-xs h-8"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void onAddTag();
              }}
              disabled={savingTags || !newTag.trim()}
              className="h-8 px-2"
              aria-label="Add tag"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Source URL */}
        <div className="pt-3 border-t border-border-light">
          <Caption className="block mb-1">URL</Caption>
          <a
            href={asset.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline break-all"
          >
            {asset.url}
          </a>
        </div>
      </div>

      {/* Footer — two-step delete */}
      <div className="p-4 border-t border-border-light bg-surface-elevated">
        {!deleteArmed ? (
          <Button
            variant="outline"
            onClick={onArmDelete}
            disabled={deleting}
            className="w-full gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
          >
            <Trash2 className="h-4 w-4" />
            Delete asset
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onCancelDeleteArm}
              disabled={deleting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                void onConfirmDelete();
              }}
              disabled={deleting}
              className="flex-1 gap-2"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Click again to confirm
                </>
              )}
            </Button>
          </div>
        )}
        {deleteArmed && !deleting && (
          <Caption className="block mt-2 text-center">
            Auto-cancels in 5 seconds
          </Caption>
        )}
      </div>
    </aside>
  );
}

// ============================================================================
// FolderBreadcrumb — shows current folder path above the grid
// ============================================================================

interface FolderBreadcrumbProps {
  selection: FolderSelection;
  folders: MediaFolder[];
  onSelect: (sel: FolderSelection) => void;
}

function FolderBreadcrumb({ selection, folders, onSelect }: FolderBreadcrumbProps) {
  if (selection.kind === 'all') {
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <FolderOpen className="h-3.5 w-3.5 shrink-0" />
        <span className="font-medium text-foreground">All media</span>
      </div>
    );
  }
  if (selection.kind === 'unfiled') {
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <button
          type="button"
          onClick={() => onSelect({ kind: 'all' })}
          className="hover:text-foreground transition-colors"
        >
          All media
        </button>
        <ChevronRight className="h-3 w-3" />
        <span className="font-medium text-foreground">Unfiled</span>
      </div>
    );
  }
  const crumbs = buildBreadcrumb(folders, selection.id);
  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
      <button
        type="button"
        onClick={() => onSelect({ kind: 'all' })}
        className="hover:text-foreground transition-colors"
      >
        All media
      </button>
      {crumbs.map((folder, idx) => {
        const isLast = idx === crumbs.length - 1;
        return (
          <span key={folder.id} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3 shrink-0" />
            {isLast ? (
              <span className="font-medium text-foreground">{folder.name}</span>
            ) : (
              <button
                type="button"
                onClick={() => onSelect({ kind: 'folder', id: folder.id })}
                className="hover:text-foreground transition-colors"
              >
                {folder.name}
              </button>
            )}
          </span>
        );
      })}
    </div>
  );
}

// ============================================================================
// BulkMoveToFolderBar — inline folder picker beneath BulkActionsBar
// ============================================================================

interface BulkMoveToFolderBarProps {
  count: number;
  folders: MediaFolder[];
  open: boolean;
  moving: boolean;
  onToggle: () => void;
  onMove: (folderId: string | null) => void;
}

function BulkMoveToFolderBar({
  count,
  folders,
  open,
  moving,
  onToggle,
  onMove,
}: BulkMoveToFolderBarProps) {
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');

  return (
    <div className="rounded-xl border border-border-strong bg-card px-3 py-2 text-sm">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <Folder className="h-3.5 w-3.5" />
          Move {count} {count === 1 ? 'item' : 'items'} to folder…
          <ChevronRight
            className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-90' : ''}`}
          />
        </button>
        {moving && (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}
      </div>
      {open && (
        <div className="mt-2 flex items-center gap-2">
          <select
            value={selectedFolderId}
            onChange={(e) => setSelectedFolderId(e.target.value)}
            className="flex-1 rounded-md border border-border-strong bg-card px-2 py-1.5 text-xs text-foreground"
            disabled={moving}
          >
            <option value="">Unfiled (remove from folder)</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            disabled={moving}
            onClick={() => onMove(selectedFolderId === '' ? null : selectedFolderId)}
            className="h-8 px-3 text-xs"
          >
            {moving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              'Move'
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2 text-xs">
      <span className="text-muted-foreground w-24 flex-shrink-0">{label}</span>
      <span className="text-foreground break-all">{value}</span>
    </div>
  );
}
