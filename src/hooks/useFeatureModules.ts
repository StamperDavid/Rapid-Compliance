/**
 * Feature Modules Hook
 *
 * Convenience wrapper around the feature store.
 * Handles auto-loading on first use.
 */

'use client';

import { useEffect } from 'react';
import { useFeatureStore } from '@/lib/stores/feature-store';
import type { FeatureModuleId, FeatureConfig } from '@/types/feature-modules';

export interface UseFeatureModulesReturn {
  config: FeatureConfig | null;
  loading: boolean;
  initialized: boolean;
  isModuleEnabled: (id: FeatureModuleId) => boolean;
  updateModule: (id: FeatureModuleId, enabled: boolean) => void;
  updateAllModules: (modules: Record<FeatureModuleId, boolean>) => void;
  setConfig: (config: FeatureConfig) => void;
  loadConfig: () => Promise<void>;
}

export function useFeatureModules(): UseFeatureModulesReturn {
  const config = useFeatureStore((s) => s.config);
  const loading = useFeatureStore((s) => s.loading);
  const initialized = useFeatureStore((s) => s.initialized);
  const isModuleEnabled = useFeatureStore((s) => s.isModuleEnabled);
  const updateModule = useFeatureStore((s) => s.updateModule);
  const updateAllModules = useFeatureStore((s) => s.updateAllModules);
  const setConfig = useFeatureStore((s) => s.setConfig);
  const loadConfig = useFeatureStore((s) => s.loadConfig);

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
    isModuleEnabled,
    updateModule,
    updateAllModules,
    setConfig,
    loadConfig,
  };
}
