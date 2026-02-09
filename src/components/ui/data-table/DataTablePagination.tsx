'use client';

import { ChevronDown, Loader2 } from 'lucide-react';

interface DataTablePaginationProps {
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
  itemCountLabel?: string;
}

export function DataTablePagination({
  hasMore,
  loading,
  onLoadMore,
  itemCountLabel,
}: DataTablePaginationProps) {
  if (!hasMore && !loading) {
    return null;
  }

  return (
    <div className="p-4 border-t border-border-light flex justify-center">
      <button
        onClick={onLoadMore}
        disabled={loading || !hasMore}
        aria-label={loading ? 'Loading more items' : 'Load more items'}
        className="inline-flex items-center gap-2 px-6 py-2.5 bg-surface-elevated hover:bg-surface-elevated/80 border border-border-light text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading...
          </>
        ) : hasMore ? (
          <>
            <ChevronDown className="w-4 h-4" />
            Load More{itemCountLabel ? ` (${itemCountLabel})` : ''}
          </>
        ) : (
          'All items loaded'
        )}
      </button>
    </div>
  );
}
