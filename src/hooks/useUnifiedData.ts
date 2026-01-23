/**
 * Unified Data Hooks
 * Automatic tenant-scoped data operations for the unified Command Center
 *
 * These hooks automatically scope data queries to the authenticated user's tenant:
 * - If platform_admin with no selected tenant: returns platform aggregate data
 * - If platform_admin with selected tenant: returns that tenant's data
 * - For all other roles: returns their tenant's data
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { where, type QueryConstraint } from 'firebase/firestore';
import {
  FirestoreService,
  OrganizationService,
  WorkspaceService,
  RecordService,
  COLLECTIONS,
} from '@/lib/db/firestore-service';
import { useUnifiedAuth } from './useUnifiedAuth';
import { logger } from '@/lib/logger/logger';

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
 * Fetch data scoped to the user's tenant
 *
 * @param collectionName - Collection name within the tenant (e.g., 'users', 'workflows')
 * @param options - Query options
 * @returns Data array with loading and error states
 *
 * @example
 * // Fetch all workflows for the current tenant
 * const { data: workflows, loading } = useTenantData<Workflow>('workflows');
 *
 * // Fetch workflows with filters
 * const { data: activeWorkflows } = useTenantData<Workflow>('workflows', {
 *   constraints: [where('status', '==', 'active')]
 * });
 */
export function useTenantData<T>(
  collectionName: string,
  options: UseDataOptions = {}
): UseDataReturn<T> {
  const { user, isPlatformAdmin, loading: authLoading } = useUnifiedAuth();
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const { constraints = [], realtime = false, skipInitialFetch = false } = options;

  // Cache admin status to prevent recalculation triggering re-renders
  const isAdmin = isPlatformAdmin();

  const fetchData = useCallback(async () => {
    // Guard: Wait for auth to resolve before fetching
    if (authLoading) {
      return;
    }

    if (!user) {
      setData([]);
      setLoading(false);
      return;
    }

    // Platform admin with no tenant selected - return empty for now
    // In the future, this could return aggregated platform-level data
    if (isAdmin && user.tenantId === null) {
      logger.info('Platform admin with no tenant - returning empty data', {
        collection: collectionName,
        file: 'useUnifiedData.ts',
      });
      setData([]);
      setLoading(false);
      return;
    }

    // All other cases: fetch tenant-scoped data
    const tenantId = user.tenantId;

    if (!tenantId) {
      setError(new Error('User has no tenant ID'));
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Build collection path based on structure
      let collectionPath: string;

      // Top-level tenant collections (like USERS, ORGANIZATIONS)
      if (collectionName === COLLECTIONS.USERS) {
        collectionPath = COLLECTIONS.USERS;
        // Add tenant filter for multi-tenant USERS collection
        const tenantConstraints = [
          where('tenantId', '==', tenantId),
          ...constraints,
        ];
        const result = await FirestoreService.getAll<T>(
          collectionPath,
          tenantConstraints
        );
        setData(result);
      } else if (collectionName === COLLECTIONS.ORGANIZATIONS) {
        // Fetch specific organization
        const org = await OrganizationService.get(tenantId);
        setData(org ? [org as T] : []);
      } else if (collectionName === COLLECTIONS.WORKSPACES) {
        // Fetch workspaces for the tenant
        const workspaces = await WorkspaceService.getAll(tenantId);
        setData(workspaces as T[]);
      } else if (collectionName.startsWith('organizations/')) {
        // Nested collection path provided directly
        const result = await FirestoreService.getAll<T>(
          collectionName,
          constraints
        );
        setData(result);
      } else {
        // Default: assume collection is under organizations/{tenantId}/
        collectionPath = `${COLLECTIONS.ORGANIZATIONS}/${tenantId}/${collectionName}`;
        const result = await FirestoreService.getAll<T>(collectionPath, constraints);
        setData(result);
      }

      setLoading(false);
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      logger.error(
        `Error fetching tenant data for ${collectionName}:`,
        errorObj,
        { file: 'useUnifiedData.ts' }
      );
      setError(errorObj);
      setLoading(false);
    }
  }, [user, isAdmin, authLoading, collectionName, constraints]);

  // Initial fetch
  useEffect(() => {
    if (!skipInitialFetch) {
      void fetchData();
    }
  }, [fetchData, skipInitialFetch]);

  // Real-time subscription
  useEffect(() => {
    if (!realtime || !user?.tenantId) {
      return;
    }

    const tenantId = user.tenantId;
    let collectionPath: string;

    // Determine collection path (simplified for subscription)
    if (collectionName === COLLECTIONS.ORGANIZATIONS) {
      // Subscribe to specific organization
      const unsubscribe = OrganizationService.subscribe(tenantId, (org) => {
        setData(org ? [org as T] : []);
      });
      return unsubscribe;
    } else if (collectionName.startsWith('organizations/')) {
      collectionPath = collectionName;
    } else {
      collectionPath = `${COLLECTIONS.ORGANIZATIONS}/${tenantId}/${collectionName}`;
    }

    // Subscribe to collection
    const unsubscribe = FirestoreService.subscribeToCollection<T>(
      collectionPath,
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
 * Fetch a single document scoped to the user's tenant
 *
 * @param collectionName - Collection name within the tenant
 * @param docId - Document ID
 * @param options - Query options
 * @returns Single document with loading and error states
 *
 * @example
 * const { data: workflow, loading } = useTenantDoc<Workflow>('workflows', workflowId);
 */
export function useTenantDoc<T>(
  collectionName: string,
  docId: string | null,
  options: { realtime?: boolean } = {}
): UseDocReturn<T> {
  const { user, isPlatformAdmin, loading: authLoading } = useUnifiedAuth();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const { realtime = false } = options;

  // Cache admin status to prevent recalculation triggering re-renders
  const isAdmin = isPlatformAdmin();

  const fetchData = useCallback(async () => {
    // Guard: Wait for auth to resolve before fetching
    if (authLoading) {
      return;
    }

    if (!user || !docId) {
      setData(null);
      setLoading(false);
      return;
    }

    // Platform admin with no tenant - return null
    if (isAdmin && user.tenantId === null) {
      setData(null);
      setLoading(false);
      return;
    }

    const tenantId = user.tenantId;

    if (!tenantId) {
      setError(new Error('User has no tenant ID'));
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let collectionPath: string;

      if (collectionName === COLLECTIONS.ORGANIZATIONS) {
        const org = await OrganizationService.get(docId);
        setData(org as T | null);
      } else if (collectionName === COLLECTIONS.WORKSPACES) {
        const workspace = await WorkspaceService.get(tenantId, docId);
        setData(workspace as T | null);
      } else if (collectionName.startsWith('organizations/')) {
        const result = await FirestoreService.get<T>(collectionName, docId);
        setData(result);
      } else {
        collectionPath = `${COLLECTIONS.ORGANIZATIONS}/${tenantId}/${collectionName}`;
        const result = await FirestoreService.get<T>(collectionPath, docId);
        setData(result);
      }

      setLoading(false);
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      logger.error(
        `Error fetching tenant document ${docId} from ${collectionName}:`,
        errorObj,
        { file: 'useUnifiedData.ts' }
      );
      setError(errorObj);
      setLoading(false);
    }
  }, [user, isAdmin, authLoading, collectionName, docId]);

  // Initial fetch
  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Real-time subscription
  useEffect(() => {
    if (!realtime || !user?.tenantId || !docId) {
      return;
    }

    const tenantId = user.tenantId;
    let collectionPath: string;

    if (collectionName === COLLECTIONS.ORGANIZATIONS) {
      const unsubscribe = OrganizationService.subscribe(docId, (org) => {
        setData(org as T | null);
      });
      return unsubscribe;
    } else if (collectionName === COLLECTIONS.WORKSPACES) {
      const unsubscribe = WorkspaceService.subscribe(tenantId, docId, (workspace) => {
        setData(workspace as T | null);
      });
      return unsubscribe;
    } else if (collectionName.startsWith('organizations/')) {
      collectionPath = collectionName;
    } else {
      collectionPath = `${COLLECTIONS.ORGANIZATIONS}/${tenantId}/${collectionName}`;
    }

    const unsubscribe = FirestoreService.subscribe<T>(
      collectionPath,
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
 * const { data: leads, loading } = useTenantRecords<Lead>('leads', {
 *   constraints: [where('status', '==', 'new'), orderBy('createdAt', 'desc')]
 * });
 */
export function useTenantRecords<T>(
  entityName: string,
  options: UseDataOptions = {}
): UseDataReturn<T> {
  const { user } = useUnifiedAuth();
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const { constraints = [], realtime = false, skipInitialFetch = false } = options;

  const fetchData = useCallback(async () => {
    if (!user?.tenantId) {
      setData([]);
      setLoading(false);
      return;
    }

    // For records, we need a workspace ID
    // If not provided, use the user's current workspace or first available
    const workspaceId = user.workspaceId ?? 'default';

    try {
      setLoading(true);
      setError(null);

      const records = await RecordService.getAll(
        user.tenantId,
        workspaceId,
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

  // Initial fetch
  useEffect(() => {
    if (!skipInitialFetch) {
      void fetchData();
    }
  }, [fetchData, skipInitialFetch]);

  // Real-time subscription
  useEffect(() => {
    if (!realtime || !user?.tenantId) {
      return;
    }

    const workspaceId = user.workspaceId ?? 'default';

    const unsubscribe = RecordService.subscribe(
      user.tenantId,
      workspaceId,
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

/**
 * Fetch all organizations (platform admin only)
 *
 * @returns All organizations with loading and error states
 *
 * @example
 * const { data: organizations, loading } = usePlatformOrganizations();
 */
export function usePlatformOrganizations(): UseDataReturn<Record<string, unknown>> {
  const { isPlatformAdmin, loading: authLoading } = useUnifiedAuth();
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Cache admin status to prevent recalculation triggering re-renders
  const isAdmin = isPlatformAdmin();

  const fetchData = useCallback(async () => {
    // Guard: Wait for auth to resolve before checking admin status
    if (authLoading) {
      return;
    }

    if (!isAdmin) {
      // Only log once when auth is resolved and user is not admin
      logger.warn('usePlatformOrganizations called by non-admin user', {
        file: 'useUnifiedData.ts',
      });
      setData([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const orgs = await OrganizationService.getAll();
      setData(orgs);
      setLoading(false);
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      logger.error('Error fetching platform organizations:', errorObj, {
        file: 'useUnifiedData.ts',
      });
      setError(errorObj);
      setLoading(false);
    }
  }, [isAdmin, authLoading]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return {
    data,
    loading: authLoading || loading,
    error,
    refetch: fetchData,
  };
}

/**
 * Fetch workspaces for the current tenant
 *
 * @returns Workspaces with loading and error states
 *
 * @example
 * const { data: workspaces, loading } = useTenantWorkspaces();
 */
export function useTenantWorkspaces(): UseDataReturn<Record<string, unknown>> {
  const { user } = useUnifiedAuth();
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!user?.tenantId) {
      setData([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const workspaces = await WorkspaceService.getAll(user.tenantId);
      setData(workspaces);
      setLoading(false);
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      logger.error('Error fetching tenant workspaces:', errorObj, {
        file: 'useUnifiedData.ts',
      });
      setError(errorObj);
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
  };
}
