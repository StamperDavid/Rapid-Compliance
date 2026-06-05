/**
 * useRecords Hook
 * Manages dynamic entity records through the secure, authenticated
 * /api/entities/[entityName]/records routes (Admin SDK server-side).
 * Reads + writes NO LONGER touch Firestore from the browser.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { logger } from '@/lib/logger/logger';

export interface UseRecordsOptions {
  entityName: string;
  /** Accepted for API compatibility; filtering is applied client-side by callers. */
  filters?: unknown[];
  /** Accepted for API compatibility. Live streaming is replaced by refresh-after-change for security. */
  realTime?: boolean;
  pageSize?: number;
  enablePagination?: boolean;
}

export interface UseRecordsReturn<T = Record<string, unknown>> {
  records: T[];
  loading: boolean;
  error: Error | null;
  create: (data: Partial<T>) => Promise<void>;
  update: (id: string, data: Partial<T>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
  // Pagination
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
}

/**
 * Hook for managing records via the authenticated entity-records API.
 * @example
 * const { records, loading, create, update, remove } = useRecords({ entityName: 'leads' });
 */
export function useRecords<T = Record<string, unknown>>(
  options: UseRecordsOptions
): UseRecordsReturn<T> {
  const {
    entityName,
    pageSize: initialPageSize = 50,
    enablePagination = false,
  } = options;

  const authFetch = useAuthFetch();

  const [records, setRecords] = useState<T[]>([]);
  const [allRecords, setAllRecords] = useState<T[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [totalItems, setTotalItems] = useState(0);

  // Apply pagination to records
  const paginateRecords = useCallback((allRecs: T[]) => {
    if (!enablePagination) {
      setRecords(allRecs);
      setTotalItems(allRecs.length);
      return;
    }

    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    setRecords(allRecs.slice(startIndex, endIndex));
    setTotalItems(allRecs.length);
  }, [currentPage, pageSize, enablePagination]);

  // Load records via the secure API route
  const loadRecords = useCallback(async () => {
    if (!entityName) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await authFetch(`/api/entities/${entityName}/records`);
      const json = (await res.json()) as { success?: boolean; records?: T[]; error?: string };
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? `Failed to load ${entityName} (${res.status})`);
      }

      const data = json.records ?? [];
      setAllRecords(data);
      paginateRecords(data);
    } catch (err) {
      logger.error('Error loading records:', err instanceof Error ? err : new Error(String(err)), { file: 'useRecords.ts' });
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [authFetch, entityName, paginateRecords]);

  // Initial load
  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  // Create new record
  const create = useCallback(
    async (data: Partial<T>) => {
      try {
        const id = `${entityName}_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
        const res = await authFetch(`/api/entities/${entityName}/records`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, record: data }),
        });
        const json = (await res.json()) as { success?: boolean; error?: string };
        if (!res.ok || !json.success) {
          throw new Error(json.error ?? 'Failed to create record');
        }
        await loadRecords();
      } catch (err) {
        logger.error('Error creating record:', err instanceof Error ? err : new Error(String(err)), { file: 'useRecords.ts' });
        throw err;
      }
    },
    [authFetch, entityName, loadRecords]
  );

  // Update existing record
  const update = useCallback(
    async (id: string, data: Partial<T>) => {
      try {
        const res = await authFetch(`/api/entities/${entityName}/records/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ record: data }),
        });
        const json = (await res.json()) as { success?: boolean; error?: string };
        if (!res.ok || !json.success) {
          throw new Error(json.error ?? 'Failed to update record');
        }
        await loadRecords();
      } catch (err) {
        logger.error('Error updating record:', err instanceof Error ? err : new Error(String(err)), { file: 'useRecords.ts' });
        throw err;
      }
    },
    [authFetch, entityName, loadRecords]
  );

  // Delete record
  const remove = useCallback(
    async (id: string) => {
      try {
        const res = await authFetch(`/api/entities/${entityName}/records/${id}`, {
          method: 'DELETE',
        });
        const json = (await res.json()) as { success?: boolean; error?: string };
        if (!res.ok || !json.success) {
          throw new Error(json.error ?? 'Failed to delete record');
        }
        await loadRecords();
      } catch (err) {
        logger.error('Error deleting record:', err instanceof Error ? err : new Error(String(err)), { file: 'useRecords.ts' });
        throw err;
      }
    },
    [authFetch, entityName, loadRecords]
  );

  // Manual refresh
  const refresh = useCallback(async () => {
    await loadRecords();
  }, [loadRecords]);

  // Update pagination when page/pageSize changes
  useEffect(() => {
    paginateRecords(allRecords);
  }, [currentPage, pageSize, allRecords, paginateRecords]);

  // Page controls
  const setPage = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const updatePageSize = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  }, []);

  const totalPages = Math.ceil(totalItems / pageSize);

  return {
    records,
    loading,
    error,
    create,
    update,
    remove,
    refresh,
    currentPage,
    totalPages,
    totalItems,
    pageSize,
    setPage,
    setPageSize: updatePageSize,
  };
}
