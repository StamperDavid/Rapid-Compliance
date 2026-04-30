'use client';

/**
 * Media Library — unified browser.
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
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useAuthFetch } from '@/hooks/useAuthFetch';
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
} from 'lucide-react';
import {
  MEDIA_CATEGORIES,
  type MediaAssetCategory,
  type MediaAssetSource,
  type MediaAssetType,
  type UnifiedMediaAsset,
} from '@/types/media-library';

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

  // ── Tag editor ──────────────────────────────────────────────────────────
  const [newTag, setNewTag] = useState('');
  const [savingTags, setSavingTags] = useState(false);

  // ── Delete arming (two-step) ────────────────────────────────────────────
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const disarmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

      setAssets(filtered);
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
  ]);

  useEffect(() => {
    void fetchAssets();
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
    <div className="p-8 space-y-6">
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

      {/* Layout: filter sidebar | grid | detail */}
      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
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
          <div className="flex items-center justify-between">
            <SectionTitle as="h2">
              {loading ? 'Loading...' : `${assets.length} asset${assets.length === 1 ? '' : 's'}`}
            </SectionTitle>
            {errorMsg && (
              <Caption className="text-destructive">{errorMsg}</Caption>
            )}
          </div>

          {/* Grid + detail panel */}
          {selectedAsset ? (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
              <AssetGrid
                assets={assets}
                loading={loading}
                onSelect={setSelectedId}
                selectedId={selectedId}
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
              />
            </div>
          ) : (
            <AssetGrid
              assets={assets}
              loading={loading}
              onSelect={setSelectedId}
              selectedId={selectedId}
            />
          )}
        </div>
      </div>
    </div>
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
}

function AssetGrid({ assets, loading, selectedId, onSelect }: AssetGridProps) {
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
      {assets.map((asset) => {
        const Icon = typeIcon(asset.type);
        const isSelected = selectedId === asset.id;
        const showImage = asset.type === 'image' || asset.thumbnailUrl;
        return (
          <button
            key={asset.id}
            type="button"
            onClick={() => onSelect(asset.id)}
            className={`group relative overflow-hidden rounded-xl border bg-card text-left transition-all ${
              isSelected
                ? 'border-primary ring-2 ring-primary/40'
                : 'border-border-strong hover:border-primary/40'
            }`}
          >
            <div className="aspect-square bg-surface-elevated relative overflow-hidden">
              {showImage ? (
                <Image
                  src={asset.thumbnailUrl ?? asset.url}
                  alt={asset.name}
                  fill
                  unoptimized
                  className="object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Icon className="h-10 w-10 text-muted-foreground" />
                </div>
              )}
              {asset.source === 'ai-generated' && (
                <div className="absolute top-1.5 right-1.5 flex items-center gap-1 rounded-full bg-primary/90 px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                  <Sparkles className="h-3 w-3" />
                  AI
                </div>
              )}
            </div>
            <div className="p-2">
              <p className="text-xs font-medium text-foreground truncate">{asset.name}</p>
              <Caption className="block truncate">{asset.category}</Caption>
            </div>
          </button>
        );
      })}
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
}: AssetDetailPanelProps) {
  const Icon = typeIcon(asset.type);
  const showImage = asset.type === 'image' || asset.thumbnailUrl;
  return (
    <aside className="bg-card border border-border-strong rounded-2xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border-light">
        <CardTitle className="truncate">{asset.name}</CardTitle>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close detail panel"
          className="p-1 rounded-md text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
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

      {/* Metadata */}
      <div className="p-4 space-y-3 overflow-y-auto">
        <MetaRow label="Type" value={asset.type} />
        <MetaRow label="Category" value={asset.category} />
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
        {asset.aiPrompt && (
          <div>
            <Caption className="block mb-1">AI prompt</Caption>
            <p className="text-xs text-foreground bg-surface-elevated rounded-md p-2 whitespace-pre-wrap">
              {asset.aiPrompt}
            </p>
          </div>
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

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2 text-xs">
      <span className="text-muted-foreground w-24 flex-shrink-0">{label}</span>
      <span className="text-foreground break-all">{value}</span>
    </div>
  );
}
