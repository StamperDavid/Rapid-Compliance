'use client';

/**
 * Content Generator → Library → Projects section.
 *
 * Displays the media-folder tree as a browsable project hierarchy:
 *   - Top-level view: a grid of PROJECT cards (root MediaFolders, parentFolderId null/absent).
 *     Each card shows the project name, sub-project count, and direct media count.
 *   - Clicking a project opens it in-place (no navigation): a breadcrumb appears, child
 *     folders render as sub-project cards, and media filed directly in the folder renders
 *     as thumbnails below with FULL SELECTION + BULK ACTIONS support.
 *   - "New project" (root) and "New sub-project" (inside a folder) both POST to
 *     /api/media-folders, then refresh the folder list.
 *
 * APIs consumed:
 *   GET  /api/media-folders              → { success, folders: MediaFolder[] }
 *   GET  /api/media?folderId=<id>&limit=500
 *                                        → { success, items: UnifiedMediaAsset[], assets: UnifiedMediaAsset[], total: number }
 *   POST /api/media-folders              → { success, folder: MediaFolder }
 *     body: { name: string, parentFolderId?: string | null }
 *   PATCH /api/media/[id]               → { success, asset: UnifiedMediaAsset }
 *   DELETE /api/media/[id]              → { success }
 *   GET /api/video/avatar-profiles?scope=own → { success, profiles: { id, name }[] }
 *
 * The two-level Library nav + page padding/spacing are supplied by the parent
 * layout (content/library/layout.tsx); this page renders only its own content.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/ui/button';
import {
  PageTitle,
  SectionTitle,
  SectionDescription,
  Caption,
  CardTitle,
} from '@/components/ui/typography';
import {
  FolderOpen,
  Folder,
  Plus,
  Loader2,
  Film,
  Image as ImageIcon,
  ChevronRight,
  Trash2,
  Download,
  Square,
  CheckSquare,
  Play,
} from 'lucide-react';
import type { MediaFolder, UnifiedMediaAsset } from '@/types/media-library';
import {
  AssetActionsMenu,
  BulkActionsBar,
  type AssetActions,
  type CharacterOption,
  type ProjectOption,
} from '@/app/(dashboard)/content/video/library/AssetActionsMenu';

// ============================================================================
// Constants
// ============================================================================

/** Auto-disarm window for two-step delete confirmations (matches Media page). */
const DISARM_TIMEOUT_MS = 5000;

// ============================================================================
// API response shapes
// ============================================================================

interface FoldersResponse {
  success: boolean;
  folders: MediaFolder[];
  error?: string;
}

interface MediaResponse {
  success: boolean;
  items: UnifiedMediaAsset[];
  assets: UnifiedMediaAsset[];
  total: number;
  error?: string;
}

interface MediaSingleResponse {
  success: boolean;
  asset: UnifiedMediaAsset;
}

interface CreateFolderResponse {
  success: boolean;
  folder: MediaFolder;
  error?: string;
}

// ============================================================================
// Internal view state
// ============================================================================

/** One entry in the breadcrumb trail (id null = root). */
interface BreadcrumbEntry {
  id: string | null;
  name: string;
}

// ============================================================================
// Helpers
// ============================================================================

/** Common MIME → file-extension map (mirrors Media page). */
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

function extensionFor(asset: Pick<UnifiedMediaAsset, 'mimeType' | 'url' | 'type'>): string | null {
  const mt = asset.mimeType?.toLowerCase().split(';')[0].trim();
  if (mt && MIME_EXTENSIONS[mt]) {
    return MIME_EXTENSIONS[mt];
  }
  if (mt?.includes('/')) {
    const sub = mt.split('/')[1];
    if (sub && /^[a-z0-9]+$/.test(sub)) {
      return sub;
    }
  }
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
    /* malformed URL — fall through */
  }
  const byType: Record<string, string> = {
    image: 'png',
    video: 'mp4',
    audio: 'mp3',
    document: 'pdf',
  };
  return byType[asset.type] ?? null;
}

function downloadName(
  asset: Pick<UnifiedMediaAsset, 'name' | 'id' | 'mimeType' | 'url' | 'type'>,
): string {
  const raw = asset.name && asset.name.trim().length > 0 ? asset.name : asset.id;
  const base = (raw.split('/').pop() ?? '').trim() || asset.id;
  if (/\.[a-z0-9]{1,5}$/i.test(base)) {
    return base;
  }
  const ext = extensionFor(asset);
  return ext ? `${base}.${ext}` : base;
}

// ============================================================================
// Page component
// ============================================================================

export default function ProjectsLibraryPage() {
  const authFetch = useAuthFetch();
  const toast = useToast();

  // All folders fetched once; hierarchy is derived client-side.
  const [allFolders, setAllFolders] = useState<MediaFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Breadcrumb stack. Empty = root view.
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbEntry[]>([]);

  // Media items filed in the current folder (only loaded when inside a folder).
  const [folderMedia, setFolderMedia] = useState<UnifiedMediaAsset[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);

  // Create-folder inline input
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [createBusy, setCreateBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // ── Multi-select (bulk) state ────────────────────────────────────────────
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [bulkArmed, setBulkArmed] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
  const [bulkMoving, setBulkMoving] = useState(false);

  // ── Per-tile delete arming ───────────────────────────────────────────────
  const [armedTileDeleteId, setArmedTileDeleteId] = useState<string | null>(null);
  const [tileDeletingId, setTileDeletingId] = useState<string | null>(null);

  // ── Character Library profiles (lazy-loaded for the assign menus) ─────────
  const [characters, setCharacters] = useState<CharacterOption[]>([]);
  const [charactersLoading, setCharactersLoading] = useState(false);
  const [charactersLoaded, setCharactersLoaded] = useState(false);

  // ── Fetch all folders ────────────────────────────────────────────────────
  const fetchFolders = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await authFetch('/api/media-folders');
      if (!res.ok) {
        setErrorMsg(`Failed to load projects (${res.status})`);
        setAllFolders([]);
        return;
      }
      const data = (await res.json()) as FoldersResponse;
      setAllFolders(data.folders ?? []);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load projects');
      setAllFolders([]);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void fetchFolders();
  }, [fetchFolders]);

  // ── Fetch media for the current folder ──────────────────────────────────
  const currentFolderId = breadcrumb.length > 0 ? breadcrumb[breadcrumb.length - 1]?.id : null;

  const fetchFolderMedia = useCallback(
    async (folderId: string) => {
      setMediaLoading(true);
      setFolderMedia([]);
      try {
        const res = await authFetch(
          `/api/media?folderId=${encodeURIComponent(folderId)}&limit=500`,
        );
        if (!res.ok) {
          return;
        }
        const data = (await res.json()) as MediaResponse;
        setFolderMedia(data.items ?? data.assets ?? []);
      } catch {
        /* Non-fatal: swallow and show an empty grid. */
      } finally {
        setMediaLoading(false);
      }
    },
    [authFetch],
  );

  const refreshFolderMedia = useCallback(() => {
    if (currentFolderId) {
      void fetchFolderMedia(currentFolderId);
    }
  }, [currentFolderId, fetchFolderMedia]);

  useEffect(() => {
    if (currentFolderId) {
      void fetchFolderMedia(currentFolderId);
    } else {
      setFolderMedia([]);
      setCheckedIds(new Set());
    }
  }, [currentFolderId, fetchFolderMedia]);

  // ── Navigation ───────────────────────────────────────────────────────────
  const openFolder = useCallback((folder: MediaFolder) => {
    setBreadcrumb((prev) => [...prev, { id: folder.id, name: folder.name }]);
    setCreatingFolder(false);
    setNewFolderName('');
    setCreateError(null);
    setCheckedIds(new Set());
    setBulkArmed(false);
  }, []);

  const navigateToBreadcrumb = useCallback((index: number) => {
    setBreadcrumb((prev) => prev.slice(0, index));
    setCreatingFolder(false);
    setNewFolderName('');
    setCreateError(null);
    setCheckedIds(new Set());
    setBulkArmed(false);
  }, []);

  // ── Create folder ────────────────────────────────────────────────────────
  const startCreate = useCallback(() => {
    setCreatingFolder(true);
    setNewFolderName('');
    setCreateError(null);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  }, []);

  const cancelCreate = useCallback(() => {
    setCreatingFolder(false);
    setNewFolderName('');
    setCreateError(null);
  }, []);

  const submitCreate = useCallback(async () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) {
      setCreateError('Please enter a name.');
      return;
    }
    setCreateBusy(true);
    setCreateError(null);
    try {
      const body: { name: string; parentFolderId?: string | null } = { name: trimmed };
      if (currentFolderId) {
        body.parentFolderId = currentFolderId;
      }
      const res = await authFetch('/api/media-folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as CreateFolderResponse;
      if (!res.ok || !data.success) {
        setCreateError(data.error ?? 'Could not create the project. Try again.');
        return;
      }
      setAllFolders((prev) => [...prev, data.folder]);
      setCreatingFolder(false);
      setNewFolderName('');
      void fetchFolders();
    } catch {
      setCreateError('Could not create the project. Try again.');
    } finally {
      setCreateBusy(false);
    }
  }, [authFetch, currentFolderId, fetchFolders, newFolderName]);

  const handleCreateKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        void submitCreate();
      } else if (e.key === 'Escape') {
        cancelCreate();
      }
    },
    [submitCreate, cancelCreate],
  );

  // ── Character Library: lazy-load on first use ────────────────────────────
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
        setCharacters((data.profiles ?? []).map((p) => ({ id: p.id, name: p.name })));
        setCharactersLoaded(true);
      } finally {
        setCharactersLoading(false);
      }
    })();
  }, [authFetch, charactersLoaded, charactersLoading]);

  // ── Projects list derived from allFolders (for the assign-project menu) ──
  const projects = useMemo<ProjectOption[]>(
    () =>
      allFolders
        .map((f) => ({ id: f.id, name: f.name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [allFolders],
  );

  // ── Selection helpers ────────────────────────────────────────────────────
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

  // ── PATCH / DELETE helpers ───────────────────────────────────────────────

  /** Patch a single asset and update grid state. */
  const patchAsset = useCallback(
    async (id: string, patch: Record<string, unknown>) => {
      const res = await authFetch(`/api/media/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        const data = (await res.json()) as MediaSingleResponse;
        setFolderMedia((prev) => prev.map((a) => (a.id === data.asset.id ? data.asset : a)));
      }
    },
    [authFetch],
  );

  /** Patch silently (no grid update) — used by the bulk runner. */
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

  /** Delete a set of assets and prune them from the grid + selection. */
  const deleteAssetsByIds = useCallback(
    async (ids: string[]) => {
      await Promise.all(
        ids.map((id) =>
          authFetch(`/api/media/${id}`, { method: 'DELETE' }).catch(() => null),
        ),
      );
      const idSet = new Set(ids);
      setFolderMedia((prev) => prev.filter((a) => !idSet.has(a.id)));
      setCheckedIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    },
    [authFetch],
  );

  // ── Per-tile delete ───────────────────────────────────────────────────────
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

  // ── Download helpers ──────────────────────────────────────────────────────
  const handleDownloadOne = useCallback(
    async (asset: UnifiedMediaAsset) => {
      try {
        const res = await authFetch(`/api/media/${asset.id}/download`);
        if (!res.ok) {
          toast.error(`Download failed (${res.status}). Try again.`);
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
        toast.error(err instanceof Error ? err.message : 'Download failed. Try again.');
      }
    },
    [authFetch, toast],
  );

  const handleBulkDownload = useCallback(async () => {
    const items = folderMedia.filter((a) => checkedIds.has(a.id));
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
        toast.error('Download failed — none of the selected files could be retrieved.');
        return;
      }
      const zipped = await new Promise<Uint8Array>((resolve, reject) => {
        zip(files, (err, data) => (err ? reject(err) : resolve(data)));
      });
      const blob = new Blob([zipped as BlobPart], { type: 'application/zip' });
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `project-${items.length}-files.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } finally {
      setDownloading(false);
    }
  }, [folderMedia, checkedIds, authFetch, toast]);

  // ── Bulk delete ───────────────────────────────────────────────────────────
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

  // ── Bulk move to folder ───────────────────────────────────────────────────
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
        refreshFolderMedia();
        setCheckedIds(new Set());
        setBulkMoveOpen(false);
      } finally {
        setBulkMoving(false);
      }
    },
    [authFetch, checkedIds, refreshFolderMedia],
  );

  // ── Move image onto character ─────────────────────────────────────────────
  const moveImageToCharacter = useCallback(
    async (asset: UnifiedMediaAsset, character: CharacterOption) => {
      try {
        const res = await authFetch(`/api/video/avatar-profiles/${character.id}/add-image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assetId: asset.id }),
        });
        const data = (await res.json().catch(() => null)) as
          | { success?: boolean; error?: string }
          | null;
        if (!res.ok || !data?.success) {
          toast.error(data?.error ?? `Could not add "${asset.name}" to ${character.name}.`);
          return;
        }
        setFolderMedia((prev) => prev.filter((a) => a.id !== asset.id));
        setCheckedIds((prev) => {
          if (!prev.has(asset.id)) {
            return prev;
          }
          const next = new Set(prev);
          next.delete(asset.id);
          return next;
        });
        toast.success(`Added "${asset.name}" to ${character.name}. It now lives on that character.`);
      } catch {
        toast.error('Something went wrong adding that image to the character.');
      }
    },
    [authFetch, toast],
  );

  // ── Apply a patch builder across every checked asset (bulk field actions) ──
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
          const asset = folderMedia.find((a) => a.id === id);
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
        refreshFolderMedia();
      } finally {
        setBulkBusy(false);
        setBulkProgress(null);
      }
    },
    [folderMedia, checkedIds, patchAssetSilent, refreshFolderMedia],
  );

  // ── Per-tile action set ───────────────────────────────────────────────────
  const buildAssetActions = useCallback(
    (asset: UnifiedMediaAsset): AssetActions => ({
      onAssignCharacter: async (character) => {
        if (character) {
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
          await patchAsset(asset.id, { projectId: project.id, projectName: project.name });
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
        await patchAsset(asset.id, { tags: asset.tags.filter((t) => !drop.has(t)) });
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

  // ── Bulk action set ───────────────────────────────────────────────────────
  const bulkActions = useMemo<AssetActions>(
    () => ({
      onAssignCharacter: (character) =>
        runBulkPatch(
          (asset) =>
            character
              ? {
                  characterId: character.id,
                  characterName: character.name,
                  ...(asset.category === 'other' ? { category: 'character' as const } : {}),
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
      onSetCategory: (category) => runBulkPatch(() => ({ category }), 'Updating'),
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
      onSetIntendedUse: (intendedUse) => runBulkPatch(() => ({ intendedUse }), 'Updating'),
      onDownload: () => handleBulkDownload(),
      onDelete: () => handleBulkDelete(),
      onMoveToCharacter: async (character) => {
        const ids = Array.from(checkedIds);
        if (ids.length === 0) {
          return;
        }
        setBulkBusy(true);
        try {
          let done = 0;
          for (const id of ids) {
            const asset = folderMedia.find((a) => a.id === id);
            done += 1;
            setBulkProgress(`Adding ${done} of ${ids.length}…`);
            if (asset?.type !== 'image') {
              continue;
            }
            await authFetch(`/api/video/avatar-profiles/${character.id}/add-image`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ assetId: asset.id }),
            }).catch(() => null);
          }
          refreshFolderMedia();
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
      folderMedia,
      checkedIds,
      authFetch,
      refreshFolderMedia,
      toast,
    ],
  );

  // ── Auto-disarm timers ────────────────────────────────────────────────────
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

  // ── Derived data ──────────────────────────────────────────────────────────
  const visibleFolders = allFolders.filter((f) => {
    if (currentFolderId === null) {
      return !f.parentFolderId;
    }
    return f.parentFolderId === currentFolderId;
  });

  function childCount(folderId: string): number {
    return allFolders.filter((f) => f.parentFolderId === folderId).length;
  }

  const isRoot = breadcrumb.length === 0;

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <PageTitle className="flex items-center gap-3">
            <FolderOpen className="h-7 w-7 text-primary" />
            Projects
          </PageTitle>
          <SectionDescription className="mt-1">
            Organise your media into projects and sub-projects. Every asset filed in a project
            folder is one click away — no more hunting through the full library.
          </SectionDescription>
        </div>
        <Button onClick={startCreate} className="gap-2" disabled={creatingFolder}>
          <Plus className="h-4 w-4" />
          {isRoot ? 'New project' : 'New sub-project'}
        </Button>
      </div>

      {/* Global error */}
      {errorMsg && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3">
          <Caption className="text-destructive">{errorMsg}</Caption>
        </div>
      )}

      {/* Breadcrumb (only when inside a folder) */}
      {!isRoot && (
        <nav aria-label="Project breadcrumb" className="flex items-center gap-1 text-sm">
          <button
            type="button"
            onClick={() => navigateToBreadcrumb(0)}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Projects
          </button>
          {breadcrumb.map((crumb, index) => (
            <span key={crumb.id ?? 'root'} className="flex items-center gap-1">
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              {index < breadcrumb.length - 1 ? (
                <button
                  type="button"
                  onClick={() => navigateToBreadcrumb(index + 1)}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  {crumb.name}
                </button>
              ) : (
                <span className="font-medium text-foreground">{crumb.name}</span>
              )}
            </span>
          ))}
        </nav>
      )}

      {/* Inline "new folder" input */}
      {creatingFolder && (
        <div className="flex items-center gap-2 rounded-xl border border-border-strong bg-card p-3">
          <Folder className="h-5 w-5 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            placeholder={isRoot ? 'Project name…' : 'Sub-project name…'}
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={handleCreateKeyDown}
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          {createError && <Caption className="shrink-0 text-destructive">{createError}</Caption>}
          <Button
            size="sm"
            onClick={() => void submitCreate()}
            disabled={createBusy || !newFolderName.trim()}
            className="h-8 gap-1 px-3 text-xs"
          >
            {createBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Create'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={cancelCreate}
            disabled={createBusy}
            className="h-8 px-3 text-xs"
          >
            Cancel
          </Button>
        </div>
      )}

      {/* Main content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : visibleFolders.length === 0 && !creatingFolder ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center rounded-2xl border border-border-strong bg-card py-20 text-center">
          <FolderOpen className="mb-3 h-12 w-12 text-muted-foreground" />
          {isRoot ? (
            <>
              <SectionTitle as="h3">No projects yet</SectionTitle>
              <SectionDescription className="mt-1 max-w-md">
                Create your first project — it becomes a folder you can file media into and share
                across your team.
              </SectionDescription>
              <Button onClick={startCreate} className="mt-4 gap-2">
                <Plus className="h-4 w-4" />
                New project
              </Button>
            </>
          ) : (
            <>
              <SectionTitle as="h3">No sub-projects yet</SectionTitle>
              <SectionDescription className="mt-1 max-w-md">
                Add a sub-project to organise this project further, or go back and file media
                directly in the parent.
              </SectionDescription>
              <Button onClick={startCreate} className="mt-4 gap-2">
                <Plus className="h-4 w-4" />
                New sub-project
              </Button>
            </>
          )}
        </div>
      ) : (
        /* Folder grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {visibleFolders.map((folder) => (
            <ProjectCard
              key={folder.id}
              folder={folder}
              subCount={childCount(folder.id)}
              onOpen={() => openFolder(folder)}
            />
          ))}
        </div>
      )}

      {/* Media filed in the current folder — with selection + bulk actions */}
      {!isRoot && (
        <section className="space-y-3">
          {/* Section header + "Select all / Clear" */}
          <div className="flex items-center justify-between gap-3">
            <SectionTitle as="h3">Media in this project</SectionTitle>
            {!mediaLoading && folderMedia.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCheckedIds((prev) =>
                    prev.size === folderMedia.length
                      ? new Set<string>()
                      : new Set(folderMedia.map((a) => a.id)),
                  )
                }
              >
                {checkedIds.size === folderMedia.length
                  ? 'Clear selection'
                  : `Select all ${folderMedia.length}`}
              </Button>
            )}
          </div>

          {/* Bulk action bars — appear when ≥1 tile is selected */}
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
                onMove={(folderId) => {
                  void handleBulkMoveToFolder(folderId);
                }}
              />
            </>
          )}

          {/* Media grid */}
          {mediaLoading ? (
            <div className="flex items-center gap-2 py-6">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <Caption>Loading media…</Caption>
            </div>
          ) : folderMedia.length === 0 ? (
            <div className="rounded-xl border border-border-strong bg-card py-10 text-center">
              <Caption className="text-muted-foreground">
                No media filed in this project yet.
              </Caption>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
              {folderMedia.map((asset) => (
                <SelectableMediaTile
                  key={asset.id}
                  asset={asset}
                  isChecked={checkedIds.has(asset.id)}
                  isArmedDelete={armedTileDeleteId === asset.id}
                  isDeleting={tileDeletingId === asset.id}
                  onToggleChecked={toggleChecked}
                  onArmDelete={setArmedTileDeleteId}
                  onCancelDelete={() => setArmedTileDeleteId(null)}
                  onConfirmDelete={(id) => {
                    void handleTileDelete(id);
                  }}
                  onDownload={(a) => {
                    void handleDownloadOne(a);
                  }}
                  characters={characters}
                  charactersLoading={charactersLoading}
                  onLoadCharacters={loadCharacters}
                  projects={projects}
                  actions={buildAssetActions(asset)}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </>
  );
}

// ============================================================================
// Project card
// ============================================================================

interface ProjectCardProps {
  folder: MediaFolder;
  subCount: number;
  onOpen: () => void;
}

function ProjectCard({ folder, subCount, onOpen }: ProjectCardProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative flex flex-col items-start gap-3 overflow-hidden rounded-2xl border border-border-strong bg-card p-5 text-left transition-all hover:border-primary/40 hover:bg-surface-elevated"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
        <FolderOpen className="h-6 w-6 text-primary" />
      </div>

      <div className="min-w-0 flex-1">
        <CardTitle className="truncate">{folder.name}</CardTitle>
        <div className="mt-1.5 flex items-center gap-3">
          {subCount > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Folder className="h-3.5 w-3.5" />
              {subCount} sub-project{subCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      <ChevronRight className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}

// ============================================================================
// Selectable media tile
// ============================================================================

interface SelectableMediaTileProps {
  asset: UnifiedMediaAsset;
  isChecked: boolean;
  isArmedDelete: boolean;
  isDeleting: boolean;
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

function SelectableMediaTile({
  asset,
  isChecked,
  isArmedDelete,
  isDeleting,
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
}: SelectableMediaTileProps) {
  const [imgError, setImgError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isVideo = asset.type === 'video';
  const thumb = asset.thumbnailUrl ?? (asset.type === 'image' ? asset.url : undefined);
  const showImage = Boolean(thumb) && !imgError;

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
      title={asset.name}
      className={`group relative overflow-hidden rounded-xl border bg-surface-elevated transition-all ${
        isChecked
          ? 'border-primary ring-2 ring-primary/40'
          : 'border-border-strong hover:border-primary/40'
      }`}
    >
      {/* Thumbnail / preview area */}
      <div className="aspect-square relative overflow-hidden">
        {showImage ? (
          <Image
            src={thumb as string}
            alt={asset.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
            unoptimized
            className="object-cover"
            onError={() => setImgError(true)}
          />
        ) : isVideo ? (
          <>
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
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/55">
                <Play className="h-4 w-4 fill-white text-white" />
              </span>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            {isVideo ? (
              <Film className="h-8 w-8 text-muted-foreground" />
            ) : (
              <ImageIcon className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
        )}

        {/* Video badge */}
        {isVideo && (
          <span className="absolute right-1.5 top-1.5 rounded bg-black/55 p-0.5 pointer-events-none">
            <Film className="h-3 w-3 text-white" />
          </span>
        )}

        {/* Name tooltip on hover */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-4 opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none">
          <p className="truncate text-[10px] text-white">{asset.name}</p>
        </div>

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
          {isChecked ? (
            <CheckSquare className="h-4 w-4" />
          ) : (
            <Square className="h-4 w-4" />
          )}
        </button>

        {/* Download + delete + actions menu — top-right, on hover */}
        {!isArmedDelete && (
          <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={(e) => {
                stop(e);
                onDownload(asset);
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
            {/* Full action set (three-dot menu) */}
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
                {isDeleting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
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
    </div>
  );
}

// ============================================================================
// BulkMoveToFolderBar — inline folder picker beneath BulkActionsBar
// (mirrors the same component in the Media page)
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
          Move {count} {count === 1 ? 'item' : 'items'} to project folder…
          <ChevronRight
            className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-90' : ''}`}
          />
        </button>
        {moving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>
      {open && (
        <div className="mt-2 flex items-center gap-2">
          <select
            value={selectedFolderId}
            onChange={(e) => setSelectedFolderId(e.target.value)}
            className="flex-1 rounded-md border border-border-strong bg-card px-2 py-1.5 text-xs text-foreground"
            disabled={moving}
          >
            <option value="" disabled>
              Choose a destination…
            </option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
            <option value="__unfiled__">Unfiled (remove from project)</option>
          </select>
          <Button
            size="sm"
            disabled={moving || selectedFolderId === ''}
            onClick={() => onMove(selectedFolderId === '__unfiled__' ? null : selectedFolderId)}
            className="h-8 px-3 text-xs"
          >
            {moving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Move'}
          </Button>
        </div>
      )}
    </div>
  );
}
