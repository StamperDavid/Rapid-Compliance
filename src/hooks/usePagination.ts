/**
 * Reusable Pagination Hook
 * Handles cursor-based pagination for Firestore collections and API endpoints
 * Generic cursor type (C) allows for both QueryDocumentSnapshot and string cursors
 */

import { useState, useCallback } from 'react';
import { logger } from '@/lib/logger/logger';

export interface PaginationState<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

interface UsePaginationOptions<T, C = unknown> {
  fetchFn: (lastDoc?: C) => Promise<{
    data: T[];
    lastDoc: C | null;
    hasMore: boolean;
  }>;
  pageSize?: number;
}

export function usePagination<T, C = unknown>({
  fetchFn,
  pageSize: _pageSize = 50,
}: UsePaginationOptions<T, C>): PaginationState<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState<C | null>(null);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) {return;}

    try {
      setLoading(true);
      setError(null);

      const result = await fetchFn(lastDoc as C | undefined);

      setData(prev => [...prev, ...result.data]);
      setLastDoc(result.lastDoc);
      setHasMore(result.hasMore);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load data';
      setError(errorMessage);
      logger.error('Pagination error:', err instanceof Error ? err : new Error(String(err)), { file: 'usePagination.ts' });
    } finally {
      setLoading(false);
    }
  }, [fetchFn, lastDoc, hasMore, loading]);

  const refresh = useCallback(async () => {
    setData([]);
    setLastDoc(null);
    setHasMore(true);
    setError(null);
    
    try {
      setLoading(true);
      const result = await fetchFn();
      
      setData(result.data);
      setLastDoc(result.lastDoc);
      setHasMore(result.hasMore);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh data';
      setError(errorMessage);
      logger.error('Refresh error:', err instanceof Error ? err : new Error(String(err)), { file: 'usePagination.ts' });
    } finally {
      setLoading(false);
    }
  }, [fetchFn]);

  return {
    data,
    loading,
    error,
    hasMore,
    loadMore,
    refresh,
  };
}




