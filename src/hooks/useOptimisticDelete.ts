'use client';

import { useState, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { logger } from '@/lib/logger/logger';

interface UseOptimisticDeleteOptions<T extends { id: string }> {
  /** Current data array */
  data: T[];
  /** Setter for the data array (from usePagination or useState) */
  setData: (updater: (prev: T[]) => T[]) => void;
  /** API endpoint to call for deletion */
  endpoint: string;
  /** Entity name for toast messages (e.g., "leads", "deals") */
  entityName: string;
}

interface UseOptimisticDeleteReturn {
  /** IDs pending deletion (used for ConfirmDialog) */
  deleteIds: string[];
  /** Whether the confirm dialog is open */
  deleteDialogOpen: boolean;
  /** Whether the API call is in flight */
  deleting: boolean;
  /** Opens the confirm dialog for the given IDs */
  requestDelete: (ids: string[]) => void;
  /** Closes the confirm dialog without deleting */
  cancelDelete: () => void;
  /** Optimistically removes items, then confirms via API */
  confirmDelete: () => Promise<void>;
}

/**
 * Hook for optimistic delete with rollback on failure.
 * Immediately removes items from the UI, calls the API,
 * and rolls back with a toast if the request fails.
 */
export function useOptimisticDelete<T extends { id: string }>({
  data: _data,
  setData,
  endpoint,
  entityName,
}: UseOptimisticDeleteOptions<T>): UseOptimisticDeleteReturn {
  const [deleteIds, setDeleteIds] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const snapshotRef = useRef<T[]>([]);

  const requestDelete = useCallback((ids: string[]) => {
    setDeleteIds(ids);
    setDeleteDialogOpen(true);
  }, []);

  const cancelDelete = useCallback(() => {
    setDeleteDialogOpen(false);
    setDeleteIds([]);
  }, []);

  const confirmDelete = useCallback(async () => {
    const idsToDelete = deleteIds;
    const idSet = new Set(idsToDelete);
    const count = idsToDelete.length;

    // 1. Snapshot current data for rollback
    setData((prev) => {
      snapshotRef.current = prev;
      return prev;
    });

    // 2. Optimistically remove items from UI immediately
    setData((prev) => prev.filter((item) => !idSet.has(item.id)));
    setDeleteDialogOpen(false);
    setDeleteIds([]);
    setDeleting(true);

    try {
      // 3. Call the API
      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: idsToDelete }),
      });

      if (!response.ok) {
        throw new Error(`Failed to delete ${entityName}`);
      }

      toast.success(
        `${count} ${count === 1 ? entityName.replace(/s$/, '') : entityName} deleted`,
        { duration: 2000 }
      );
    } catch (error) {
      // 4. Rollback: restore the snapshot
      setData(() => snapshotRef.current);

      toast.error(
        `Failed to delete ${entityName}. Changes reverted.`,
        { duration: 4000 }
      );

      logger.error(
        `Optimistic delete rollback for ${entityName}:`,
        error instanceof Error ? error : new Error(String(error)),
        { file: 'useOptimisticDelete.ts' }
      );
    } finally {
      setDeleting(false);
      snapshotRef.current = [];
    }
  }, [deleteIds, setData, endpoint, entityName]);

  return {
    deleteIds,
    deleteDialogOpen,
    deleting,
    requestDelete,
    cancelDelete,
    confirmDelete,
  };
}
