'use client';

/**
 * Studio Recent Sidebar — right side.
 *
 * Persistent strip of the operator's last ~20 generations across all tool
 * types. Reads from /api/media. Click an item to revisit it on the canvas.
 * Drag an image item onto the video tool to use it as an avatar portrait.
 */

import { useCallback, useEffect, useState, type DragEvent } from 'react';
import Image from 'next/image';
import { Loader2, RefreshCw, Image as ImageIcon, Music, Video, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import type { MediaItem, MediaListResponse, MediaType } from '@/types/media-library';

// ============================================================================
// Types
// ============================================================================

interface StudioRecentSidebarProps {
  refreshKey: number;
  onSelectItem: (item: MediaItem) => void;
  onDragStartItem?: (item: MediaItem) => void;
}

// ============================================================================
// Component
// ============================================================================

export function StudioRecentSidebar({
  refreshKey,
  onSelectItem,
  onDragStartItem,
}: StudioRecentSidebarProps) {
  const authFetch = useAuthFetch();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRecent = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authFetch('/api/media?limit=20');
      if (!response.ok) {
        throw new Error(`Recent items request failed (${response.status})`);
      }
      const data = (await response.json()) as MediaListResponse;
      if (!data.success) {
        throw new Error('Recent items response indicated failure');
      }
      setItems(data.items);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load recent items';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void loadRecent();
  }, [loadRecent, refreshKey]);

  const handleDragStart = useCallback(
    (event: DragEvent<HTMLButtonElement>, item: MediaItem) => {
      event.dataTransfer.setData('application/x-studio-media', item.id);
      event.dataTransfer.setData('text/plain', item.url);
      event.dataTransfer.effectAllowed = 'copy';
      if (onDragStartItem) {
        onDragStartItem(item);
      }
    },
    [onDragStartItem],
  );

  return (
    <aside
      aria-label="Recent generations"
      className="w-72 shrink-0 border-l border-border-light bg-card/40 flex flex-col"
    >
      <div className="flex items-center justify-between px-4 py-4 border-b border-border-light">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Recent
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => { void loadRecent(); }}
          disabled={isLoading}
          aria-label="Refresh recent generations"
        >
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {error ? (
          <div className="px-3 py-4 text-xs text-destructive">
            {error}
          </div>
        ) : null}

        {!error && !isLoading && items.length === 0 ? (
          <div className="px-3 py-8 text-center text-xs text-muted-foreground">
            No recent generations yet. Generate your first asset to see it here.
          </div>
        ) : null}

        <ul className="flex flex-col gap-1.5">
          {items.map((item) => (
            <li key={item.id}>
              <RecentItem
                item={item}
                onSelect={onSelectItem}
                onDragStart={handleDragStart}
              />
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

interface RecentItemProps {
  item: MediaItem;
  onSelect: (item: MediaItem) => void;
  onDragStart: (event: DragEvent<HTMLButtonElement>, item: MediaItem) => void;
}

function RecentItem({ item, onSelect, onDragStart }: RecentItemProps) {
  const isImage = item.type === 'image';
  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      draggable={isImage}
      onDragStart={(event) => onDragStart(event, item)}
      className="w-full flex items-center gap-3 rounded-lg border border-transparent p-2 text-left hover:border-border-light hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      title={isImage ? 'Click to revisit, or drag onto Video to use as portrait' : 'Click to revisit'}
    >
      <RecentItemThumbnail item={item} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground truncate">
          {item.name || 'Untitled'}
        </p>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
          {item.type}
        </p>
      </div>
    </button>
  );
}

function RecentItemThumbnail({ item }: { item: MediaItem }) {
  const thumbUrl = item.thumbnailUrl ?? (item.type === 'image' ? item.url : null);
  if (thumbUrl) {
    return (
      <Image
        src={thumbUrl}
        alt=""
        unoptimized
        width={48}
        height={48}
        className="h-12 w-12 shrink-0 rounded-md border border-border-light object-cover"
      />
    );
  }
  return (
    <div className="h-12 w-12 shrink-0 rounded-md border border-border-light bg-surface-elevated flex items-center justify-center">
      <FallbackIcon type={item.type} />
    </div>
  );
}

function FallbackIcon({ type }: { type: MediaType }) {
  switch (type) {
    case 'image':
      return <ImageIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />;
    case 'video':
      return <Video className="h-4 w-4 text-muted-foreground" aria-hidden="true" />;
    case 'audio':
      return <Music className="h-4 w-4 text-muted-foreground" aria-hidden="true" />;
    default:
      return <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />;
  }
}
