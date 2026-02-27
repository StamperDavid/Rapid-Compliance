/**
 * Unified Data Hooks
 * Data operations for the Command Center
 *
 * Penthouse model: All data fetched from root collections or flat paths.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { type QueryConstraint } from 'firebase/firestore';
import {
  FirestoreService,
  RecordService,
  COLLECTIONS,
} from '@/lib/db/firestore-service';
import { useUnifiedAuth } from './useUnifiedAuth';
import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';

/**
 * Hook options for data fetching
 */
interface UseDataOptions {
  /** Additional Firestore query constraints */
  constraints?: QueryConstraint[];
  /** Enable real-time updates */
  realtime?: boolean;
  /** Skip initial fetch */
  skipInitialFetch?: boolean;
}

/**
 * Hook return type for data operations
 */
interface UseDataReturn<T> {
  data: T[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook return type for single document operations
 */
interface UseDocReturn<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Fetch data from a collection
 *
 * @param collectionName - Collection name (e.g., 'users', 'workflows')
 * @param options - Query options
 * @returns Data array with loading and error states
 *
 * @example
 * const { data: workflows, loading } = useCollectionData<Workflow>('workflows');
 */
export function useCollectionData<T>(
  collectionName: string,
  options: UseDataOptions = {}
): UseDataReturn<T> {
  const { user, loading: authLoading } = useUnifiedAuth();
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const { constraints = [], realtime = false, skipInitialFetch = false } = options;

  const fetchData = useCallback(async () => {
    if (authLoading) {
      return;
    }

    if (!user) {
      setData([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      if (collectionName === COLLECTIONS.USERS) {
        const result = await FirestoreService.getAll<T>(
          COLLECTIONS.USERS,
          constraints
        );
        setData(result);
      } else if (collectionName === COLLECTIONS.ORGANIZATIONS) {
        const org = await FirestoreService.get<T>(COLLECTIONS.ORGANIZATIONS, PLATFORM_ID);
        setData(org ? [org] : []);
      } else {
        // Default: fetch from collection directly
        const result = await FirestoreService.getAll<T>(collectionName, constraints);
        setData(result);
      }

      setLoading(false);
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      logger.error(
        `Error fetching data for ${collectionName}:`,
        errorObj,
        { file: 'useUnifiedData.ts' }
      );
      setError(errorObj);
      setLoading(false);
    }
  }, [user, authLoading, collectionName, constraints]);

  useEffect(() => {
    if (!skipInitialFetch) {
      void fetchData();
    }
  }, [fetchData, skipInitialFetch]);

  useEffect(() => {
    if (!realtime || !user) {
      return;
    }

    if (collectionName === COLLECTIONS.ORGANIZATIONS) {
      const unsubscribe = FirestoreService.subscribe<T>(
        COLLECTIONS.ORGANIZATIONS,
        PLATFORM_ID,
        (org) => {
          setData(org ? [org] : []);
        }
      );
      return unsubscribe;
    }

    const unsubscribe = FirestoreService.subscribeToCollection<T>(
      collectionName,
      constraints,
      (newData) => {
        setData(newData);
      }
    );

    return unsubscribe;
  }, [realtime, user, collectionName, constraints]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
  };
}

/**
 * Fetch a single document
 *
 * @param collectionName - Collection name
 * @param docId - Document ID
 * @param options - Query options
 * @returns Single document with loading and error states
 *
 * @example
 * const { data: workflow, loading } = useDocData<Workflow>('workflows', workflowId);
 */
export function useDocData<T>(
  collectionName: string,
  docId: string | null,
  options: { realtime?: boolean } = {}
): UseDocReturn<T> {
  const { user, loading: authLoading } = useUnifiedAuth();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const { realtime = false } = options;

  const fetchData = useCallback(async () => {
    if (authLoading) {
      return;
    }

    if (!user || !docId) {
      setData(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      if (collectionName === COLLECTIONS.ORGANIZATIONS) {
        const org = await FirestoreService.get<T>(COLLECTIONS.ORGANIZATIONS, docId);
        setData(org);
      } else {
        const result = await FirestoreService.get<T>(collectionName, docId);
        setData(result);
      }

      setLoading(false);
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      logger.error(
        `Error fetching document ${docId} from ${collectionName}:`,
        errorObj,
        { file: 'useUnifiedData.ts' }
      );
      setError(errorObj);
      setLoading(false);
    }
  }, [user, authLoading, collectionName, docId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!realtime || !user || !docId) {
      return;
    }

    if (collectionName === COLLECTIONS.ORGANIZATIONS) {
      const unsubscribe = FirestoreService.subscribe<T>(
        COLLECTIONS.ORGANIZATIONS,
        docId,
        (org) => {
          setData(org);
        }
      );
      return unsubscribe;
    }

    const unsubscribe = FirestoreService.subscribe<T>(
      collectionName,
      docId,
      (newData) => {
        setData(newData);
      }
    );

    return unsubscribe;
  }, [realtime, user, collectionName, docId]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
  };
}

/**
 * Fetch records from a dynamic entity (CRM records)
 *
 * @param entityName - Entity name (e.g., 'leads', 'contacts', 'deals')
 * @param options - Query options
 * @returns Records with loading and error states
 *
 * @example
 * const { data: leads, loading } = useRecords<Lead>('leads');
 */
export function useRecords<T>(
  entityName: string,
  options: UseDataOptions = {}
): UseDataReturn<T> {
  const { user } = useUnifiedAuth();
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const { constraints = [], realtime = false, skipInitialFetch = false } = options;

  const fetchData = useCallback(async () => {
    if (!user) {
      setData([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const records = await RecordService.getAll(
        entityName,
        constraints
      );

      setData(records as T[]);
      setLoading(false);
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      logger.error(
        `Error fetching records for ${entityName}:`,
        errorObj,
        { file: 'useUnifiedData.ts' }
      );
      setError(errorObj);
      setLoading(false);
    }
  }, [user, entityName, constraints]);

  useEffect(() => {
    if (!skipInitialFetch) {
      void fetchData();
    }
  }, [fetchData, skipInitialFetch]);

  useEffect(() => {
    if (!realtime || !user) {
      return;
    }

    const unsubscribe = RecordService.subscribe(
      entityName,
      constraints,
      (newData) => {
        setData(newData as T[]);
      }
    );

    return unsubscribe;
  }, [realtime, user, entityName, constraints]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
  };
}

