/**
 * Entity Config Hook
 *
 * Convenience wrapper around the entity config store.
 * Handles auto-loading on first use.
 */

'use client';

import { useEffect } from 'react';
import { useEntityConfigStore } from '@/lib/stores/entity-config-store';
import type { EntityConfig } from '@/types/entity-config';

export interface UseEntityConfigReturn {
  config: EntityConfig | null;
  loading: boolean;
  initialized: boolean;
  isEntityEnabled: (entityId: string) => boolean;
  updateEntity: (entityId: string, enabled: boolean) => void;
  updateAllEntities: (entities: Record<string, boolean>) => void;
  setConfig: (config: EntityConfig) => void;
  loadConfig: () => Promise<void>;
}

export function useEntityConfig(): UseEntityConfigReturn {
  const config = useEntityConfigStore((s) => s.config);
  const loading = useEntityConfigStore((s) => s.loading);
  const initialized = useEntityConfigStore((s) => s.initialized);
  const isEntityEnabled = useEntityConfigStore((s) => s.isEntityEnabled);
  const updateEntity = useEntityConfigStore((s) => s.updateEntity);
  const updateAllEntities = useEntityConfigStore((s) => s.updateAllEntities);
  const setConfig = useEntityConfigStore((s) => s.setConfig);
  const loadConfig = useEntityConfigStore((s) => s.loadConfig);

  // Auto-load on first mount
  useEffect(() => {
    if (!initialized && !loading) {
      void loadConfig();
    }
  }, [initialized, loading, loadConfig]);

  return {
    config,
    loading,
    initialized,
    isEntityEnabled,
    updateEntity,
    updateAllEntities,
    setConfig,
    loadConfig,
  };
}
