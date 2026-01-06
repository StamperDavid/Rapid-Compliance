/**
 * Reusable Pagination Hook
 * Handles cursor-based pagination for Firestore collections
 */

import { useState, useCallback } from 'react';
import type { QueryDocumentSnapshot } from 'firebase/firestore'
import { logger } from '@/lib/logger/logger';;

export interface PaginationState<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

interface UsePaginationOptions<T> {
  fetchFn: (lastDoc?: QueryDocumentSnapshot) => Promise<{
    data: T[];
    lastDoc: QueryDocumentSnapshot | null;
    hasMore: boolean;
  }>;
  pageSize?: number;
}

export function usePagination<T>({
  fetchFn,
  pageSize = 50,
}: UsePaginationOptions<T>): PaginationState<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) {return;}

    try {
      setLoading(true);
      setError(null);

      const result = await fetchFn(lastDoc || undefined);

      setData(prev => [...prev, ...result.data]);
      setLastDoc(result.lastDoc);
      setHasMore(result.hasMore);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
      logger.error('Pagination error:', err, { file: 'usePagination.ts' });
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
    } catch (err: any) {
      setError(err.message || 'Failed to refresh data');
      logger.error('Refresh error:', err, { file: 'usePagination.ts' });
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




