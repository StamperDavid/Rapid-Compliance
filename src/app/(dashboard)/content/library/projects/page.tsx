'use client';

/**
 * Content Generator → Library → Projects section.
 *
 * Displays the media-folder tree as a browsable project hierarchy:
 *   - Top-level view: a grid of PROJECT cards (root MediaFolders, parentFolderId null/absent).
 *     Each card shows the project name, sub-project count, and direct media count.
 *   - Clicking a project opens it in-place (no navigation): a breadcrumb appears, child
 *     folders render as sub-project cards, and media filed directly in the folder renders
 *     as thumbnails below.
 *   - "New project" (root) and "New sub-project" (inside a folder) both POST to
 *     /api/media-folders, then refresh the folder list.
 *
 * APIs consumed:
 *   GET  /api/media-folders         → { success, folders: MediaFolder[] }
 *   GET  /api/media?folderId=<id>&limit=500
 *                                   → { success, items: UnifiedMediaAsset[], assets: UnifiedMediaAsset[], total: number }
 *   POST /api/media-folders         → { success, folder: MediaFolder }
 *     body: { name: string, parentFolderId?: string | null }
 *
 * The two-level Library nav + page padding/spacing are supplied by the parent
 * layout (content/library/layout.tsx); this page renders only its own content.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useAuthFetch } from '@/hooks/useAuthFetch';
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
} from 'lucide-react';
import type { MediaFolder, UnifiedMediaAsset } from '@/types/media-library';

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
// Page component
// ============================================================================

export default function ProjectsLibraryPage() {
  const authFetch = useAuthFetch();

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
          // Non-fatal: just show an empty tile area.
          return;
        }
        const data = (await res.json()) as MediaResponse;
        // Prefer `items` for backward compat (route always returns both keys).
        setFolderMedia(data.items ?? data.assets ?? []);
      } catch {
        // Non-fatal: swallow and show an empty grid.
      } finally {
        setMediaLoading(false);
      }
    },
    [authFetch],
  );

  useEffect(() => {
    if (currentFolderId) {
      void fetchFolderMedia(currentFolderId);
    } else {
      setFolderMedia([]);
    }
  }, [currentFolderId, fetchFolderMedia]);

  // ── Navigation ───────────────────────────────────────────────────────────
  const openFolder = useCallback((folder: MediaFolder) => {
    setBreadcrumb((prev) => [...prev, { id: folder.id, name: folder.name }]);
    setCreatingFolder(false);
    setNewFolderName('');
    setCreateError(null);
  }, []);

  const navigateToBreadcrumb = useCallback((index: number) => {
    setBreadcrumb((prev) => prev.slice(0, index));
    setCreatingFolder(false);
    setNewFolderName('');
    setCreateError(null);
  }, []);

  // ── Create folder ────────────────────────────────────────────────────────
  const startCreate = useCallback(() => {
    setCreatingFolder(true);
    setNewFolderName('');
    setCreateError(null);
    // Focus the input on next tick.
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
      const body: { name: string; parentFolderId?: string | null } = {
        name: trimmed,
      };
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
      // Optimistic append + re-fetch for consistency.
      setAllFolders((prev) => [...prev, data.folder]);
      setCreatingFolder(false);
      setNewFolderName('');
      // Re-fetch to get any server-side normalizations.
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

  // ── Derived data ─────────────────────────────────────────────────────────
  /** Child folders of the current node (or root if no breadcrumb). */
  const visibleFolders = allFolders.filter((f) => {
    if (currentFolderId === null) {
      // Root view: top-level folders only.
      return !f.parentFolderId;
    }
    return f.parentFolderId === currentFolderId;
  });

  /** Count of direct children (sub-projects) for a given folder. */
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

      {/* Media filed in the current folder */}
      {!isRoot && (
        <section className="space-y-3">
          <SectionTitle as="h3">Media in this project</SectionTitle>
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
                <MediaTile key={asset.id} asset={asset} />
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
// Media tile
// ============================================================================

interface MediaTileProps {
  asset: UnifiedMediaAsset;
}

function MediaTile({ asset }: MediaTileProps) {
  const [imgError, setImgError] = useState(false);
  const thumb = asset.thumbnailUrl ?? (asset.type === 'image' ? asset.url : undefined);
  const isVideo = asset.type === 'video';

  return (
    <div
      title={asset.name}
      className="group relative aspect-square overflow-hidden rounded-xl border border-border-strong bg-surface-elevated"
    >
      {thumb && !imgError ? (
        <Image
          src={thumb}
          alt={asset.name}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
          unoptimized
          className="object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          {isVideo ? (
            <Film className="h-8 w-8 text-muted-foreground" />
          ) : (
            <ImageIcon className="h-8 w-8 text-muted-foreground" />
          )}
        </div>
      )}

      {/* Name tooltip on hover */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-4 opacity-0 transition-opacity group-hover:opacity-100">
        <p className="truncate text-[10px] text-white">{asset.name}</p>
      </div>

      {/* Video badge */}
      {isVideo && (
        <span className="absolute right-1.5 top-1.5 rounded bg-black/55 p-0.5">
          <Film className="h-3 w-3 text-white" />
        </span>
      )}
    </div>
  );
}
