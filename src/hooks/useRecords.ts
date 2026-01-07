/**
 * useRecords Hook
 * Reusable hook for managing entity records with Firestore
 * Replaces all mock data usage across CRM pages
 */

import { useState, useEffect, useCallback } from 'react';
import { RecordService } from '@/lib/db/firestore-service';
import { where, orderBy, type QueryConstraint } from 'firebase/firestore'
import { logger } from '@/lib/logger/logger';

export interface UseRecordsOptions {
  organizationId: string;
  workspaceId: string;
  entityName: string;
  filters?: QueryConstraint[];
  realTime?: boolean;
  pageSize?: number;
  enablePagination?: boolean;
}

export interface UseRecordsReturn<T = any> {
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
 *   organizationId: 'org-123',
 *   workspaceId: 'workspace-456',
 *   entityName: 'leads',
 *   realTime: true
 * });
 */
export function useRecords<T = any>(
  options: UseRecordsOptions
): UseRecordsReturn<T> {
  const { 
    organizationId, 
    workspaceId, 
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
    if (!organizationId || !workspaceId || !entityName) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const data = await RecordService.getAll(
        organizationId,
        workspaceId,
        entityName,
        filters
      );

      setAllRecords(data as T[]);
      paginateRecords(data as T[]);
    } catch (err) {
      logger.error('Error loading records:', err, { file: 'useRecords.ts' });
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [organizationId, workspaceId, entityName, JSON.stringify(filters), paginateRecords]);

  // Initial load
  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  // Real-time subscription (optional)
  useEffect(() => {
    if (!realTime || !organizationId || !workspaceId || !entityName) {
      return;
    }

    const unsubscribe = RecordService.subscribe(
      organizationId,
      workspaceId,
      entityName,
      filters,
      (data) => {
        setAllRecords(data as T[]);
        paginateRecords(data as T[]);
        setLoading(false); // Set loading to false when data arrives
      }
    );

    return () => {
      unsubscribe();
    };
  }, [realTime, organizationId, workspaceId, entityName, JSON.stringify(filters), paginateRecords]);

  // Create new record
  const create = useCallback(
    async (data: Partial<T>) => {
      try {
        const id = `${entityName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        await RecordService.set(
          organizationId,
          workspaceId,
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
        logger.error('Error creating record:', err, { file: 'useRecords.ts' });
        throw err;
      }
    },
    [organizationId, workspaceId, entityName, loadRecords]
  );

  // Update existing record
  const update = useCallback(
    async (id: string, data: Partial<T>) => {
      try {
        await RecordService.update(
          organizationId,
          workspaceId,
          entityName,
          id,
          data
        );

        // Refresh records
        await loadRecords();
      } catch (err) {
        logger.error('Error updating record:', err, { file: 'useRecords.ts' });
        throw err;
      }
    },
    [organizationId, workspaceId, entityName, loadRecords]
  );

  // Delete record
  const remove = useCallback(
    async (id: string) => {
      try {
        await RecordService.delete(
          organizationId,
          workspaceId,
          entityName,
          id
        );

        // Refresh records
        await loadRecords();
      } catch (err) {
        logger.error('Error deleting record:', err, { file: 'useRecords.ts' });
        throw err;
      }
    },
    [organizationId, workspaceId, entityName, loadRecords]
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

