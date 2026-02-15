/**
 * useRecords Hook
 * Reusable hook for managing entity records with Firestore
 * Replaces all mock data usage across CRM pages
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { RecordService } from '@/lib/db/firestore-service';
import { type QueryConstraint } from 'firebase/firestore'
import { logger } from '@/lib/logger/logger';

export interface UseRecordsOptions {
  entityName: string;
  filters?: QueryConstraint[];
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
 * Hook for managing records with Firestore
 * @example
 * const { records, loading, create, update, remove } = useRecords({
 *   entityName: 'leads',
 *   realTime: true
 * });
 */
export function useRecords<T = Record<string, unknown>>(
  options: UseRecordsOptions
): UseRecordsReturn<T> {
  const {
    entityName,
    filters = [],
    realTime = false,
    pageSize: initialPageSize = 50,
    enablePagination = false,
  } = options;

  const [records, setRecords] = useState<T[]>([]);
  const [allRecords, setAllRecords] = useState<T[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [totalItems, setTotalItems] = useState(0);

  // Create stable reference for filters to avoid dependency issues
  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);

  // Use ref to access current filters in callbacks without causing re-renders
  const filtersRef = useRef<QueryConstraint[]>(filters);
  filtersRef.current = filters;

  // Apply pagination to records
  const paginateRecords = useCallback((allRecs: T[]) => {
    if (!enablePagination) {
      setRecords(allRecs);
      setTotalItems(allRecs.length);
      return;
    }

    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginated = allRecs.slice(startIndex, endIndex);

    setRecords(paginated);
    setTotalItems(allRecs.length);
  }, [currentPage, pageSize, enablePagination]);

  // Load records from Firestore
  const loadRecords = useCallback(async () => {
    if (!entityName) {
      setLoading(false);
      return;
    }

    // Parse current filters from serialized key (ensures dependency is used)
    const currentFilters: QueryConstraint[] = filtersKey ? filtersRef.current : [];

    try {
      setLoading(true);
      setError(null);

      const data = await RecordService.getAll(
        entityName,
        currentFilters
      );

      setAllRecords(data as T[]);
      paginateRecords(data as T[]);
    } catch (err) {
      logger.error('Error loading records:', err instanceof Error ? err : new Error(String(err)), { file: 'useRecords.ts' });
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [entityName, filtersKey, paginateRecords]);

  // Initial load
  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  // Real-time subscription (optional)
  useEffect(() => {
    if (!realTime || !entityName) {
      return;
    }

    // Access current filters from ref (filtersKey in deps ensures re-subscription on filter change)
    const currentFilters: QueryConstraint[] = filtersKey ? filtersRef.current : [];

    const unsubscribe = RecordService.subscribe(
      entityName,
      currentFilters,
      (data) => {
        setAllRecords(data as T[]);
        paginateRecords(data as T[]);
        setLoading(false); // Set loading to false when data arrives
      }
    );

    return () => {
      unsubscribe();
    };
  }, [realTime, entityName, filtersKey, paginateRecords]);

  // Create new record
  const create = useCallback(
    async (data: Partial<T>) => {
      try {
        const id = `${entityName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        await RecordService.set(
          entityName,
          id,
          {
            ...data,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
        );

        // Refresh records
        await loadRecords();
      } catch (err) {
        logger.error('Error creating record:', err instanceof Error ? err : new Error(String(err)), { file: 'useRecords.ts' });
        throw err;
      }
    },
    [entityName, loadRecords]
  );

  // Update existing record
  const update = useCallback(
    async (id: string, data: Partial<T>) => {
      try {
        await RecordService.update(
          entityName,
          id,
          data
        );

        // Refresh records
        await loadRecords();
      } catch (err) {
        logger.error('Error updating record:', err instanceof Error ? err : new Error(String(err)), { file: 'useRecords.ts' });
        throw err;
      }
    },
    [entityName, loadRecords]
  );

  // Delete record
  const remove = useCallback(
    async (id: string) => {
      try {
        await RecordService.delete(
          entityName,
          id
        );

        // Refresh records
        await loadRecords();
      } catch (err) {
        logger.error('Error deleting record:', err instanceof Error ? err : new Error(String(err)), { file: 'useRecords.ts' });
        throw err;
      }
    },
    [entityName, loadRecords]
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
    setCurrentPage(1); // Reset to first page when changing page size
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
    // Pagination
    currentPage,
    totalPages,
    totalItems,
    pageSize,
    setPage,
    setPageSize: updatePageSize,
  };
}
